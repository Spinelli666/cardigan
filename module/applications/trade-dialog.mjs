const { api } = foundry.applications;

/**
 * Trade Dialog for item/gold negotiation between players
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 */
export class TradeDialog extends api.HandlebarsApplicationMixin(api.ApplicationV2) {
  /** @type {string} Unique trade session ID */
  tradeId;
  
  /** @type {Actor} The initiating actor */
  initiator;
  
  /** @type {Actor} The target actor */
  target;
  
  /** @type {boolean} Whether this player is the initiator */
  isInitiator;
  
  /** @type {Object} Trade state data */
  tradeState = {
    initiatorItems: [],
    targetItems: [],
    initiatorGold: 0,
    targetGold: 0,
    initiatorConfirmed: false,
    targetConfirmed: false
  };

  constructor(options = {}) {
    super(options);
    this.tradeId = options.tradeId || foundry.utils.randomID();
    this.initiator = options.initiator;
    this.target = options.target;
    this.isInitiator = options.isInitiator ?? true;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "trade-dialog-{tradeId}",
    classes: ["cardigan", "trade-dialog"],
    tag: "form",
    window: {
      title: "Negociação de Items",
      icon: "fa-solid fa-handshake",
      resizable: false,
      minimizable: false
    },
    position: {
      width: 800,
      height: "auto"
    },
    actions: {
      removeItem: this._onRemoveItem,
      editQuantity: this._onEditQuantity,
      confirmOffer: this._onConfirmOffer,
      undoOffer: this._onUndoOffer,
      cancelTrade: this._onCancelTrade
    },
    form: {
      handler: this._onFormSubmit,
      submitOnChange: false,
      closeOnSubmit: false
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: "systems/cardigan/templates/dialogs/trade-dialog.hbs"
    }
  };

  /** @override */
  get title() {
    const initiatorName = this.initiator?.name || "???";
    const targetName = this.target?.name || "???";
    return `Negociação: ${initiatorName} ⇄ ${targetName}`;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    const initiatorSide = {
      actor: this.initiator,
      items: this.tradeState.initiatorItems,
      gold: this.tradeState.initiatorGold,
      confirmed: this.tradeState.initiatorConfirmed,
      isCurrentPlayer: this.isInitiator,
      canEdit: this.isInitiator && !this.tradeState.initiatorConfirmed
    };
    
    const targetSide = {
      actor: this.target,
      items: this.tradeState.targetItems,
      gold: this.tradeState.targetGold,
      confirmed: this.tradeState.targetConfirmed,
      isCurrentPlayer: !this.isInitiator,
      canEdit: !this.isInitiator && !this.tradeState.targetConfirmed
    };
    
    return foundry.utils.mergeObject(context, {
      tradeId: this.tradeId,
      initiator: initiatorSide,
      target: targetSide,
      canConfirm: this.isInitiator ? !this.tradeState.initiatorConfirmed : !this.tradeState.targetConfirmed,
      bothConfirmed: this.tradeState.initiatorConfirmed && this.tradeState.targetConfirmed
    });
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Setup drag & drop only for the current player's side
    this._setupDragDrop();
    
    // Listen for socket updates
    this._registerSocketListeners();
  }

  /**
   * Setup drag and drop handlers
   * @private
   */
  _setupDragDrop() {
    const dropZone = this.element.querySelector(
      this.isInitiator ? '.initiator-drop-zone' : '.target-drop-zone'
    );
    
    if (!dropZone) return;
    
    // Make drop zone accept drops
    dropZone.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', async (event) => {
      event.preventDefault();
      dropZone.classList.remove('drag-over');
      
      // Don't allow drops if already confirmed
      if (this.isInitiator && this.tradeState.initiatorConfirmed) return;
      if (!this.isInitiator && this.tradeState.targetConfirmed) return;
      
      // Get data from drag event
      let data;
      try {
        data = JSON.parse(event.dataTransfer.getData('text/plain'));
      } catch (err) {
        return;
      }
      
      if (data.type === "Item") {
        await this._onDropItem(data);
      }
    });
  }

  /**
   * Handle item drop
   * @param {Object} data - Drop event data
   * @private
   */
  async _onDropItem(data) {
    const item = await Item.implementation.fromDropData(data);
    const actor = this.isInitiator ? this.initiator : this.target;
    
    if (!item) {
      ui.notifications.warn("Item não encontrado!");
      return;
    }
    
    // Verify the item belongs to the actor
    const ownedItem = actor.items.get(item.id);
    if (!ownedItem) {
      ui.notifications.error("Você não possui este item!");
      return;
    }
    
    // Check if item is already in the trade
    const itemList = this.isInitiator ? this.tradeState.initiatorItems : this.tradeState.targetItems;
    if (itemList.find(i => i.id === item.id)) {
      ui.notifications.warn("Item já adicionado à negociação!");
      return;
    }
    
    // Get max quantity
    const maxQty = ownedItem.system.quantity || 1;
    
    // Prompt for quantity if stackable
    let quantity = 1;
    if (maxQty > 1) {
      quantity = await this._promptQuantity(ownedItem.name, maxQty);
      if (quantity === null) return; // User cancelled
    }
    
    // Add item to trade
    const tradeItem = {
      id: ownedItem.id,
      uuid: ownedItem.uuid,
      name: ownedItem.name,
      img: ownedItem.img,
      quantity: quantity,
      maxQuantity: maxQty,
      equipped: ownedItem.system.equipped || false
    };
    
    itemList.push(tradeItem);
    
    // Emit update to other player
    this._emitTradeUpdate();
    
    // Re-render
    this.render();
  }

  /**
   * Prompt user for item quantity
   * @param {string} itemName - Name of the item
   * @param {number} maxQty - Maximum available quantity
   * @returns {Promise<number|null>} Selected quantity or null if cancelled
   * @private
   */
  async _promptQuantity(itemName, maxQty) {
    return new Promise((resolve) => {
      const dialog = new foundry.applications.api.DialogV2({
        window: {
          title: "Quantidade a Negociar",
          icon: "fa-solid fa-hashtag"
        },
        content: `
          <div style="padding: 16px;">
            <p style="margin-bottom: 12px;">Quantos <strong>${itemName}</strong> você quer negociar?</p>
            <div style="display: flex; align-items: center; gap: 8px;">
              <label for="trade-qty">Quantidade:</label>
              <input 
                type="number" 
                id="trade-qty" 
                name="quantity" 
                value="1" 
                min="1" 
                max="${maxQty}" 
                style="width: 100px; padding: 4px;"
                autofocus
              />
              <span style="color: #666;">/ ${maxQty}</span>
            </div>
          </div>
        `,
        buttons: [
          {
            action: "confirm",
            label: "Confirmar",
            icon: "fa-solid fa-check",
            default: true,
            callback: (event, button, dialog) => {
              const input = dialog.element.querySelector('#trade-qty');
              const qty = parseInt(input.value) || 1;
              resolve(Math.min(Math.max(1, qty), maxQty));
            }
          },
          {
            action: "cancel",
            label: "Cancelar",
            icon: "fa-solid fa-times",
            callback: () => resolve(null)
          }
        ],
        position: {
          width: 400,
          height: "auto"
        }
      });
      
      dialog.render(true);
    });
  }

  /**
   * Remove item from trade
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Clicked element
   * @private
   */
  static async _onRemoveItem(event, target) {
    const itemId = target.dataset.itemId;
    const side = target.dataset.side; // 'initiator' or 'target'
    
    if (side === 'initiator' && !this.isInitiator) return;
    if (side === 'target' && this.isInitiator) return;
    
    // Don't allow removal if confirmed
    if (side === 'initiator' && this.tradeState.initiatorConfirmed) return;
    if (side === 'target' && this.tradeState.targetConfirmed) return;
    
    const itemList = side === 'initiator' ? this.tradeState.initiatorItems : this.tradeState.targetItems;
    const index = itemList.findIndex(i => i.id === itemId);
    
    if (index !== -1) {
      itemList.splice(index, 1);
      this._emitTradeUpdate();
      this.render();
    }
  }

  /**
   * Edit item quantity in trade
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Clicked element
   * @private
   */
  static async _onEditQuantity(event, target) {
    const itemId = target.dataset.itemId;
    const side = target.dataset.side; // 'initiator' or 'target'
    
    if (side === 'initiator' && !this.isInitiator) return;
    if (side === 'target' && this.isInitiator) return;
    
    // Don't allow editing if confirmed
    if (side === 'initiator' && this.tradeState.initiatorConfirmed) return;
    if (side === 'target' && this.tradeState.targetConfirmed) return;
    
    const itemList = side === 'initiator' 
      ? this.tradeState.initiatorItems 
      : this.tradeState.targetItems;
    
    const item = itemList.find(i => i.id === itemId);
    if (!item) return;
    
    // Prompt for new quantity
    const newQty = await this._promptEditQuantity(item.name, item.maxQuantity, item.quantity);
    
    if (newQty === null) return;
    
    if (newQty === 0) {
      // Remove item if quantity is 0
      const index = itemList.indexOf(item);
      itemList.splice(index, 1);
    } else {
      // Update quantity
      item.quantity = newQty;
    }
    
    this._emitTradeUpdate();
    this.render();
  }

  /**
   * Prompt for editing quantity
   * @param {string} itemName - Name of the item
   * @param {number} maxQty - Maximum available quantity
   * @param {number} currentQty - Current quantity in trade
   * @returns {Promise<number|null>} New quantity or null if cancelled
   * @private
   */
  async _promptEditQuantity(itemName, maxQty, currentQty) {
    return new Promise((resolve) => {
      const dialog = new foundry.applications.api.DialogV2({
        window: {
          title: "Editar Quantidade",
          icon: "fa-solid fa-edit"
        },
        content: `
          <div style="padding: 16px;">
            <p style="margin-bottom: 12px;">Editar quantidade de <strong>${itemName}</strong></p>
            <p style="margin-bottom: 8px; color: #64b5f6; font-size: 12px;">
              <i class="fas fa-info-circle"></i> Atualmente: <strong>${currentQty}</strong>
            </p>
            <div style="display: flex; align-items: center; gap: 8px;">
              <label for="edit-qty">Nova quantidade:</label>
              <input 
                type="number" 
                id="edit-qty" 
                name="quantity" 
                value="${currentQty}" 
                min="0" 
                max="${maxQty}" 
                style="width: 100px; padding: 4px;"
                autofocus
              />
              <span style="color: #666;">/ ${maxQty} disponível</span>
            </div>
            <p style="margin-top: 8px; color: #999; font-size: 11px;">
              <i class="fas fa-lightbulb"></i> Dica: Use 0 para remover o item
            </p>
          </div>
        `,
        buttons: [
          {
            action: "confirm",
            label: "Confirmar",
            icon: "fa-solid fa-check",
            default: true,
            callback: (event, button, dialog) => {
              const qty = parseInt(dialog.element.querySelector('#edit-qty').value);
              if (isNaN(qty)) {
                resolve(null);
              } else {
                resolve(Math.min(Math.max(0, qty), maxQty));
              }
            }
          },
          {
            action: "cancel",
            label: "Cancelar",
            icon: "fa-solid fa-times",
            callback: () => resolve(null)
          }
        ],
        position: { width: 420 }
      });
      
      dialog.render(true);
    });
  }

  /**
   * Confirm offer
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Clicked element
   * @private
   */
  static async _onConfirmOffer(event, target) {
    // Update gold from form
    const goldInput = this.element.querySelector(
      this.isInitiator ? 'input[name="initiator-gold"]' : 'input[name="target-gold"]'
    );
    
    const goldAmount = parseInt(goldInput?.value) || 0;
    
    if (this.isInitiator) {
      this.tradeState.initiatorGold = goldAmount;
      this.tradeState.initiatorConfirmed = true;
    } else {
      this.tradeState.targetGold = goldAmount;
      this.tradeState.targetConfirmed = true;
    }
    
    // Emit confirmation to other player
    this._emitTradeConfirm();
    
    // Check if both confirmed
    if (this.tradeState.initiatorConfirmed && this.tradeState.targetConfirmed) {
      await this._executeTrade();
    } else {
      this.render();
    }
  }

  /**
   * Undo offer confirmation
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Clicked element
   * @private
   */
  static async _onUndoOffer(event, target) {
    const side = target.dataset.side;
    
    if (side === 'initiator' && this.isInitiator) {
      this.tradeState.initiatorConfirmed = false;
      ui.notifications.info("Confirmação desfeita. Você pode modificar sua oferta novamente.");
    } else if (side === 'target' && !this.isInitiator) {
      this.tradeState.targetConfirmed = false;
      ui.notifications.info("Confirmação desfeita. Você pode modificar sua oferta novamente.");
    }
    
    // Emit undo to other player
    this._emitTradeUndo();
    
    // Re-render
    this.render();
  }

  /**
   * Cancel trade
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Clicked element
   * @private
   */
  static async _onCancelTrade(event, target) {
    const cancellerName = this.isInitiator ? this.initiator.name : this.target.name;
    
    // Emit cancellation to other player
    game.socket.emit('system.cardigan', {
      action: 'tradeCancel',
      data: {
        tradeId: this.tradeId,
        cancelledBy: cancellerName
      }
    });
    
    // Show notification
    await ChatMessage.create({
      content: `<p>🚫 <strong>${cancellerName}</strong> cancelou a negociação.</p>`,
      speaker: { alias: "Sistema de Negociação" }
    });
    
    this.close();
  }

  /**
   * Handle window close (X button)
   * Triggers same logic as Cancel button
   * @override
   */
  async _onClose(options = {}) {
    // Only emit cancellation if dialog still exists in active trades
    // (prevents double emission when close() is called from _onCancelTrade)
    if (globalThis.cardiganActiveTradeDialogs?.has(this.tradeId)) {
      const cancellerName = this.isInitiator ? this.initiator.name : this.target.name;
      
      // Emit cancellation to other player
      game.socket.emit('system.cardigan', {
        action: 'tradeCancel',
        data: {
          tradeId: this.tradeId,
          cancelledBy: cancellerName
        }
      });
      
      // Show notification
      await ChatMessage.create({
        content: `<p>🚫 <strong>${cancellerName}</strong> cancelou a negociação.</p>`,
        speaker: { alias: "Sistema de Negociação" }
      });
    }
    
    return super._onClose(options);
  }

  /**
   * Execute the trade (transfer items and gold)
   * @private
   */
  async _executeTrade() {
    // Double-check execution flag (defense in depth)
    if (this.isExecuting) {
      console.log('[CARDIGAN TRADE] Already executing, aborting duplicate call');
      return;
    }
    
    // Set execution flag immediately
    this.isExecuting = true;
    
    console.log('[CARDIGAN TRADE] Executing trade...', this.tradeState);
    
    // Validation: Check if actors still exist and are online
    if (!this.initiator || !this.target) {
      ui.notifications.error("Um dos jogadores não está mais disponível!");
      this.isExecuting = false;
      return;
    }
    
    // Validation: Check item ownership and quantities
    const validationResult = await this._validateTrade();
    if (!validationResult.valid) {
      ui.notifications.error(validationResult.error);
      this._resetConfirmations();
      this.isExecuting = false;
      return;
    }
    
    // Validation: Check encumbrance
    const encumbranceCheck = await this._checkEncumbrance();
    if (!encumbranceCheck.valid) {
      ui.notifications.error(encumbranceCheck.error);
      this._resetConfirmations();
      this.isExecuting = false;
      return;
    }
    
    try {
      // Emit to GM to execute the transfer
      game.socket.emit('system.cardigan', {
        action: 'executeTradeTransfer',
        data: {
          tradeId: this.tradeId,
          initiatorId: this.initiator.id,
          targetId: this.target.id,
          initiatorItems: this.tradeState.initiatorItems,
          targetItems: this.tradeState.targetItems,
          initiatorGold: this.tradeState.initiatorGold,
          targetGold: this.tradeState.targetGold
        }
      });
      
      // If current user is GM, also execute locally
      if (game.user.isGM) {
        // The GM handler will be called via socket, but also trigger locally
        // This ensures the initiator closes even if they are the GM
        console.log('[CARDIGAN TRADE] Initiator is GM, will close after GM executes');
      }
      
      ui.notifications.info("Processando negociação...");
      
      // Mark as executed to prevent duplicate executions
      this.executedAt = Date.now();
      
    } catch (error) {
      console.error('[CARDIGAN TRADE] Error executing trade:', error);
      ui.notifications.error("Erro ao executar a negociação!");
      this._resetConfirmations();
      this.isExecuting = false;
    }
  }

  /**
   * Validate trade before execution
   * @returns {Promise<{valid: boolean, error?: string}>}
   * @private
   */
  async _validateTrade() {
    // Check initiator items
    for (const tradeItem of this.tradeState.initiatorItems) {
      const item = this.initiator.items.get(tradeItem.id);
      if (!item) {
        return { valid: false, error: `${this.initiator.name} não possui mais o item: ${tradeItem.name}` };
      }
      if ((item.system.quantity || 1) < tradeItem.quantity) {
        return { valid: false, error: `${this.initiator.name} não possui quantidade suficiente de: ${tradeItem.name}` };
      }
    }
    
    // Check target items
    for (const tradeItem of this.tradeState.targetItems) {
      const item = this.target.items.get(tradeItem.id);
      if (!item) {
        return { valid: false, error: `${this.target.name} não possui mais o item: ${tradeItem.name}` };
      }
      if ((item.system.quantity || 1) < tradeItem.quantity) {
        return { valid: false, error: `${this.target.name} não possui quantidade suficiente de: ${tradeItem.name}` };
      }
    }
    
    // Check gold
    const initiatorGold = this.initiator.system.money || 0;
    const targetGold = this.target.system.money || 0;
    
    if (initiatorGold < this.tradeState.initiatorGold) {
      return { valid: false, error: `${this.initiator.name} não possui ouro suficiente!` };
    }
    
    if (targetGold < this.tradeState.targetGold) {
      return { valid: false, error: `${this.target.name} não possui ouro suficiente!` };
    }
    
    return { valid: true };
  }

  /**
   * Check encumbrance limits
   * @returns {Promise<{valid: boolean, error?: string}>}
   * @private
   */
  async _checkEncumbrance() {
    // Calculate weight that initiator will receive
    let weightToInitiator = 0;
    for (const tradeItem of this.tradeState.targetItems) {
      const item = this.target.items.get(tradeItem.id);
      if (item) {
        const itemWeight = item.system.peso || 0;
        weightToInitiator += itemWeight * tradeItem.quantity;
      }
    }
    
    // Calculate weight that target will receive
    let weightToTarget = 0;
    for (const tradeItem of this.tradeState.initiatorItems) {
      const item = this.initiator.items.get(tradeItem.id);
      if (item) {
        const itemWeight = item.system.peso || 0;
        weightToTarget += itemWeight * tradeItem.quantity;
      }
    }
    
    // Check initiator encumbrance (simplified - adjust based on your encumbrance system)
    const initiatorCurrentWeight = this.initiator.system.peso?.atual || 0;
    const initiatorMaxWeight = this.initiator.system.peso?.maximo || 999;
    
    if (initiatorCurrentWeight + weightToInitiator > initiatorMaxWeight) {
      return { 
        valid: false, 
        error: `${this.initiator.name} não consegue carregar tanto peso! (Limite: ${initiatorMaxWeight}, Atual: ${initiatorCurrentWeight}, Adicional: ${weightToInitiator})` 
      };
    }
    
    // Check target encumbrance
    const targetCurrentWeight = this.target.system.peso?.atual || 0;
    const targetMaxWeight = this.target.system.peso?.maximo || 999;
    
    if (targetCurrentWeight + weightToTarget > targetMaxWeight) {
      return { 
        valid: false, 
        error: `${this.target.name} não consegue carregar tanto peso! (Limite: ${targetMaxWeight}, Atual: ${targetCurrentWeight}, Adicional: ${weightToTarget})` 
      };
    }
    
    return { valid: true };
  }

  /**
   * Transfer items from source to target actor
   * @param {Actor} source - Source actor
   * @param {Actor} target - Target actor
   * @param {Array} tradeItems - Items to transfer
   * @private
   */
  async _transferItems(source, target, tradeItems) {
    for (const tradeItem of tradeItems) {
      const sourceItem = source.items.get(tradeItem.id);
      if (!sourceItem) continue;
      
      // Unequip if equipped
      if (sourceItem.system.equipped) {
        await sourceItem.update({ 'system.equipped': false });
      }
      
      // Create copy for target
      const itemData = sourceItem.toObject();
      itemData.system.quantity = tradeItem.quantity;
      itemData.system.equipped = false; // Always unequipped when received
      
      await target.createEmbeddedDocuments('Item', [itemData]);
      
      // Update or delete from source
      const remainingQty = (sourceItem.system.quantity || 1) - tradeItem.quantity;
      if (remainingQty <= 0) {
        await sourceItem.delete();
      } else {
        await sourceItem.update({ 'system.quantity': remainingQty });
      }
    }
  }

  /**
   * Transfer gold between actors (DEPRECATED - not used, transfers handled by GM via socket)
   * @private
   * @deprecated
   */
  async _transferGold() {
    // Transfer from initiator to target
    if (this.tradeState.initiatorGold > 0) {
      const initiatorCurrentGold = this.initiator.system.money || 0;
      const targetCurrentGold = this.target.system.money || 0;
      
      await this.initiator.update({
        'system.money': initiatorCurrentGold - this.tradeState.initiatorGold
      });
      
      await this.target.update({
        'system.money': targetCurrentGold + this.tradeState.initiatorGold
      });
    }
    
    // Transfer from target to initiator
    if (this.tradeState.targetGold > 0) {
      const initiatorCurrentGold = this.initiator.system.money || 0;
      const targetCurrentGold = this.target.system.money || 0;
      
      await this.target.update({
        'system.money': targetCurrentGold - this.tradeState.targetGold
      });
      
      await this.initiator.update({
        'system.money': initiatorCurrentGold + this.tradeState.targetGold
      });
    }
  }

  /**
   * Create success message in chat
   * @private
   */
  async _createTradeSuccessMessage() {
    let content = `
      <div style="border: 2px solid #28a745; border-radius: 4px; padding: 12px; background: rgba(40, 167, 69, 0.1);">
        <h3 style="margin: 0 0 8px 0; color: #28a745;">
          <i class="fas fa-handshake"></i> NEGOCIAÇÃO CONCLUÍDA
        </h3>
    `;
    
    // Initiator gave
    if (this.tradeState.initiatorItems.length > 0 || this.tradeState.initiatorGold > 0) {
      content += `<p style="margin: 8px 0;"><strong>${this.initiator.name}</strong> → <strong>${this.target.name}</strong>:</p><ul style="margin: 4px 0;">`;
      
      for (const item of this.tradeState.initiatorItems) {
        content += `<li>${item.quantity}x ${item.name}</li>`;
      }
      
      if (this.tradeState.initiatorGold > 0) {
        content += `<li>${this.tradeState.initiatorGold} PO</li>`;
      }
      
      content += `</ul>`;
    }
    
    // Target gave
    if (this.tradeState.targetItems.length > 0 || this.tradeState.targetGold > 0) {
      content += `<p style="margin: 8px 0;"><strong>${this.target.name}</strong> → <strong>${this.initiator.name}</strong>:</p><ul style="margin: 4px 0;">`;
      
      for (const item of this.tradeState.targetItems) {
        content += `<li>${item.quantity}x ${item.name}</li>`;
      }
      
      if (this.tradeState.targetGold > 0) {
        content += `<li>${this.tradeState.targetGold} PO</li>`;
      }
      
      content += `</ul>`;
    }
    
    content += `</div>`;
    
    await ChatMessage.create({
      content: content,
      speaker: { alias: "Sistema de Negociação" }
    });
  }

  /**
   * Reset confirmations and re-render
   * @private
   */
  _resetConfirmations() {
    this.tradeState.initiatorConfirmed = false;
    this.tradeState.targetConfirmed = false;
    this._emitTradeUpdate();
    this.render();
  }

  /**
   * Emit trade update via socket
   * @private
   */
  _emitTradeUpdate() {
    game.socket.emit('system.cardigan', {
      action: 'tradeUpdate',
      data: {
        tradeId: this.tradeId,
        state: this.tradeState
      }
    });
  }

  /**
   * Emit trade confirmation via socket
   * @private
   */
  _emitTradeConfirm() {
    game.socket.emit('system.cardigan', {
      action: 'tradeConfirm',
      data: {
        tradeId: this.tradeId,
        side: this.isInitiator ? 'initiator' : 'target',
        gold: this.isInitiator ? this.tradeState.initiatorGold : this.tradeState.targetGold
      }
    });
  }

  /**
   * Emit trade undo via socket
   * @private
   */
  _emitTradeUndo() {
    game.socket.emit('system.cardigan', {
      action: 'tradeUndo',
      data: {
        tradeId: this.tradeId,
        side: this.isInitiator ? 'initiator' : 'target'
      }
    });
  }

  /**
   * Register socket event listeners
   * @private
   */
  _registerSocketListeners() {
    // These are registered globally in cardigan.mjs
    // This method is here for documentation purposes
  }

  /**
   * Handle incoming trade update from socket
   * @param {Object} state - Updated trade state
   */
  updateTradeState(state) {
    this.tradeState = foundry.utils.mergeObject(this.tradeState, state);
    this.render();
  }

  /**
   * Handle incoming confirmation from socket
   * @param {string} side - Which side confirmed ('initiator' or 'target')
   * @param {number} gold - Gold amount
   */
  async handleConfirmation(side, gold) {
    // Prevent multiple executions if trade is already executing or was recently executed
    if (this.isExecuting) {
      console.log('[CARDIGAN TRADE] Trade already executing, ignoring duplicate confirmation');
      return;
    }
    
    // Prevent execution if trade was executed in the last 2 seconds (debounce)
    if (this.executedAt && (Date.now() - this.executedAt) < 2000) {
      console.log('[CARDIGAN TRADE] Trade was recently executed, ignoring duplicate');
      return;
    }
    
    if (side === 'initiator') {
      this.tradeState.initiatorConfirmed = true;
      this.tradeState.initiatorGold = gold;
    } else {
      this.tradeState.targetConfirmed = true;
      this.tradeState.targetGold = gold;
    }
    
    // Only the initiator should execute the trade
    if (this.tradeState.initiatorConfirmed && this.tradeState.targetConfirmed) {
      if (this.isInitiator) {
        await this._executeTrade();
      } else {
        // Target just re-renders to show both confirmed
        this.render();
      }
    } else {
      this.render();
    }
  }

  /** @override */
  async _onFormSubmit(event, form, formData) {
    // Form submission handled by confirmOffer action
    event.preventDefault();
  }

  /** @override */
  async close(options = {}) {
    // Clean up socket listeners if needed
    return super.close(options);
  }
}
