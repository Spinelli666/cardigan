const { api } = foundry.applications;

/**
 * Merchant Trade Dialog - GM acts as merchant with pre-filled inventory
 * @extends {foundry.applications.api.HandlebarsApplicationMixin}
 */
export class MerchantTradeDialog extends api.HandlebarsApplicationMixin(api.ApplicationV2) {
  /** @type {string} Unique trade session ID */
  tradeId;
  
  /** @type {Actor} The customer (player) */
  customer;
  
  /** @type {Actor} The merchant (GM's character) */
  merchant;
  
  /** @type {boolean} Whether this player is the customer */
  isCustomer;
  
  /** @type {Object} Trade state data */
  tradeState = {
    customerOfferedItems: [],    // Items customer gives to merchant
    customerRequestedItems: [],  // Items customer wants from merchant
    customerOfferedGold: 0,      // Gold customer offers
    merchantGold: 0,
    customerConfirmed: false,
    merchantConfirmed: false
  };

  constructor(options = {}) {
    super(options);
    
    // Store the trade ID
    this.tradeId = foundry.utils.randomID();
    
    // Determine roles
    this.isCustomer = game.user.id === options.customerOwnerId;
    
    // Store actor references
    this.customer = options.customer;
    this.merchant = options.merchant;
    this.customerOwnerId = options.customerOwnerId;
    this.merchantOwnerId = options.merchantOwnerId;
    
    // Initialize trade state
    this.tradeState = {
      customerOfferedItems: [],    // Items customer gives to merchant
      customerRequestedItems: [],  // Items customer wants from merchant
      customerOfferedGold: 0,      // Gold customer offers
      merchantGold: 0,
      customerConfirmed: false,
      merchantConfirmed: false
    };
    
    // Execution control flags
    this.isExecuting = false;
    this.executedAt = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "merchant-trade-dialog-{id}",
    classes: ["merchant-trade-dialog"],
    tag: "form",
    window: {
      title: "Modo Comerciante",
      icon: "fa-solid fa-store",
      resizable: true,
      minimizable: false
    },
    position: {
      width: 900,
      height: 700
    },
    actions: {
      removeItem: this._onRemoveItem,
      editQuantity: this._onEditQuantity,
      confirmOffer: this._onConfirmOffer,
      undoOffer: this._onUndoOffer,
      cancelTrade: this._onCancelTrade
    },
    form: {
      submitOnChange: false,
      closeOnSubmit: false,
      handler: this._onFormSubmit
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: "systems/cardigan/templates/dialogs/merchant-trade-dialog.hbs"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    // Get all merchant items (only unequipped items from backpack)
    const merchantAllItems = this.merchant.items
      .filter(i => !['feature', 'race', 'spell', 'efeito', 'skill'].includes(i.type))
      .filter(i => !i.system.equipped) // Only show items that are NOT equipped
      .map(i => ({
        id: i.id,
        uuid: i.uuid,
        name: i.name,
        img: i.img,
        quantity: i.system.quantity || 1,
        equipped: false // All items here are unequipped
      }));
    
    const customerSide = {
      actor: this.customer,
      offeredItems: this.tradeState.customerOfferedItems,
      requestedItems: this.tradeState.customerRequestedItems,
      offeredGold: this.tradeState.customerOfferedGold,
      confirmed: this.tradeState.customerConfirmed,
      isCurrentPlayer: this.isCustomer,
      canEdit: this.isCustomer && !this.tradeState.customerConfirmed
    };
    
    const merchantSide = {
      actor: this.merchant,
      allItems: merchantAllItems,  // Pre-fill with all items
      gold: this.tradeState.merchantGold,
      confirmed: this.tradeState.merchantConfirmed,
      isCurrentPlayer: !this.isCustomer,
      canEdit: !this.isCustomer && !this.tradeState.merchantConfirmed
    };
    
    return foundry.utils.mergeObject(context, {
      tradeId: this.tradeId,
      customer: customerSide,
      merchant: merchantSide,
      canConfirm: this.isCustomer ? !this.tradeState.customerConfirmed : !this.tradeState.merchantConfirmed,
      bothConfirmed: this.tradeState.customerConfirmed && this.tradeState.merchantConfirmed
    });
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Setup drag & drop
    this._setupDragDrop();
    
    // Setup right-click handler for merchant items
    this._setupRightClickHandler();
    
    // Setup gold input listeners
    this._setupGoldInputListeners();
    
    // Listen for socket updates
    this._registerSocketListeners();
  }

  /**
   * Setup drag and drop handlers
   * @private
   */
  _setupDragDrop() {
    // Setup drop zones for customer's two columns
    const offerDropZone = this.element.querySelector('.customer-offer-zone');
    const requestDropZone = this.element.querySelector('.customer-request-zone');
    
    if (!offerDropZone || !requestDropZone) return;
    
    // Customer OFFER zone (for items from their inventory)
    this._setupDropZone(offerDropZone, 'customer-offer');
    
    // Customer REQUEST zone (for items from merchant)
    this._setupDropZone(requestDropZone, 'customer-request');
    
    // Make merchant items draggable
    const merchantItems = this.element.querySelectorAll('.merchant-item');
    merchantItems.forEach(item => {
      item.addEventListener('dragstart', (event) => {
        const itemId = item.dataset.itemId;
        const merchantItem = this.merchant.items.get(itemId);
        
        if (!merchantItem) return;
        
        const dragData = {
          type: 'Item',
          uuid: merchantItem.uuid,
          source: 'merchant'
        };
        
        event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      });
    });
  }

  /**
   * Setup a single drop zone
   * @private
   */
  _setupDropZone(dropZone, targetColumn) {
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
      if (this.isCustomer && this.tradeState.customerConfirmed) return;
      if (!this.isCustomer && this.tradeState.merchantConfirmed) return;
      
      // Get data from drag event
      let data;
      try {
        data = JSON.parse(event.dataTransfer.getData('text/plain'));
      } catch (err) {
        return;
      }
      
      if (data.type !== 'Item') return;
      
      await this._onDrop(data, targetColumn);
    });
  }

  /**
   * Setup right-click handler on merchant items
   * @private
   */
  _setupRightClickHandler() {
    const merchantItems = this.element.querySelectorAll('.merchant-item');
    
    merchantItems.forEach(item => {
      item.addEventListener('contextmenu', async (event) => {
        event.preventDefault();
        
        // Only customer can right-click
        if (!this.isCustomer) return;
        
        // Don't allow if already confirmed
        if (this.tradeState.customerConfirmed) return;
        
        const itemId = item.dataset.itemId;
        const merchantItem = this.merchant.items.get(itemId);
        
        if (!merchantItem) return;
        
        // Add 1 unit to customer's REQUEST list (items they want from merchant)
        await this._addItemToTrade(merchantItem, 1, 'customer-request');
      });
    });
  }

  /**
   * Setup gold input listeners to sync values
   * @private
   */
  _setupGoldInputListeners() {
    const customerGoldInput = this.element.querySelector('#customer-gold');
    const merchantGoldInput = this.element.querySelector('#merchant-gold');
    
    // Debounce function to avoid too many socket emissions
    let goldUpdateTimeout;
    const emitGoldUpdate = () => {
      clearTimeout(goldUpdateTimeout);
      goldUpdateTimeout = setTimeout(() => {
        // Update local state
        if (this.isCustomer && customerGoldInput) {
          this.tradeState.customerOfferedGold = parseInt(customerGoldInput.value) || 0;
        } else if (!this.isCustomer && merchantGoldInput) {
          this.tradeState.merchantGold = parseInt(merchantGoldInput.value) || 0;
        }
        
        // Emit update to other player
        this._emitTradeUpdate();
      }, 300); // 300ms debounce
    };
    
    // Add listeners
    if (this.isCustomer && customerGoldInput) {
      customerGoldInput.addEventListener('input', emitGoldUpdate);
      customerGoldInput.addEventListener('change', emitGoldUpdate);
    }
    
    if (!this.isCustomer && merchantGoldInput) {
      merchantGoldInput.addEventListener('input', emitGoldUpdate);
      merchantGoldInput.addEventListener('change', emitGoldUpdate);
    }
  }

  /**
   * Register socket listeners
   * @private
   */
  _registerSocketListeners() {
    // Socket listeners will be handled by cardigan.mjs
    // This is just a placeholder for any client-side reactive updates
  }

  /**
   * Handle item drop
   * @private
   */
  async _onDrop(data, targetColumn) {
    const item = await Item.fromDropData(data);
    
    if (!item) {
      ui.notifications.warn("Item inválido!");
      return;
    }
    
    // Determine if item is from customer's inventory or merchant's inventory
    const isFromCustomer = item.actor?.id === this.customer.id;
    const isFromMerchant = item.actor?.id === this.merchant.id;
    
    if (!isFromCustomer && !isFromMerchant) {
      ui.notifications.warn("Você só pode adicionar seus próprios itens ou itens do comerciante!");
      return;
    }
    
    // Validate drop target
    if (targetColumn === 'customer-offer') {
      // OFFER column: Only accept items from customer's inventory
      if (!isFromCustomer) {
        ui.notifications.warn("Nesta coluna você só pode colocar seus próprios itens!");
        return;
      }
    } else if (targetColumn === 'customer-request') {
      // REQUEST column: Only accept items from merchant's inventory
      if (!isFromMerchant) {
        ui.notifications.warn("Nesta coluna você só pode colocar itens do comerciante!");
        return;
      }
    }
    
    // Check if item already exists in the target column
    const itemList = targetColumn === 'customer-offer' 
      ? this.tradeState.customerOfferedItems 
      : this.tradeState.customerRequestedItems;
    const existing = itemList.find(i => i.id === item.id);
    
    // Prompt for quantity (considering what's already in trade)
    const maxQty = item.system.quantity || 1;
    const alreadyInTrade = existing ? existing.quantity : 0;
    const quantity = await this._promptQuantity(item.name, maxQty, alreadyInTrade);
    
    if (!quantity) return;
    
    // Add to appropriate list
    await this._addItemToTrade(item, quantity, targetColumn);
  }

  /**
   * Add item to trade
   * @private
   */
  async _addItemToTrade(item, quantity, targetColumn) {
    let itemList;
    
    if (targetColumn === 'customer-offer') {
      itemList = this.tradeState.customerOfferedItems;
    } else if (targetColumn === 'customer-request') {
      itemList = this.tradeState.customerRequestedItems;
    } else {
      ui.notifications.error("Coluna inválida!");
      return;
    }
    
    // Check if already in trade
    const existing = itemList.find(i => i.id === item.id);
    const maxQty = item.system.quantity || 1;
    
    if (existing) {
      // Item já está na lista - aumentar quantidade
      const newTotal = existing.quantity + quantity;
      
      if (newTotal > maxQty) {
        ui.notifications.warn(`Quantidade máxima disponível: ${maxQty}. Já tem ${existing.quantity} na negociação.`);
        return;
      }
      
      existing.quantity = newTotal;
      ui.notifications.info(`${item.name}: quantidade aumentada para ${newTotal}`);
    } else {
      // Item novo - adicionar à lista
      const tradeItem = {
        id: item.id,
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        quantity: quantity,
        maxQuantity: maxQty,
        equipped: item.system.equipped || false
      };
      
      itemList.push(tradeItem);
    }
    
    // Emit update to other player
    this._emitTradeUpdate();
    
    // Re-render
    this.render();
  }

  /**
   * Prompt user for item quantity
   * @param {string} itemName - Name of the item
   * @param {number} maxQty - Maximum quantity available
   * @param {number} alreadyInTrade - Quantity already in the trade
   * @private
   */
  async _promptQuantity(itemName, maxQty, alreadyInTrade = 0) {
    const remaining = maxQty - alreadyInTrade;
    
    if (remaining <= 0) {
      ui.notifications.warn(`Você já tem toda a quantidade disponível de ${itemName} na negociação!`);
      return null;
    }
    
    return new Promise((resolve) => {
      const dialog = new foundry.applications.api.DialogV2({
        window: {
          title: "Quantidade",
          icon: "fa-solid fa-hashtag"
        },
        content: `
          <div style="padding: 16px;">
            <p style="margin-bottom: 12px;">Quantos <strong>${itemName}</strong>?</p>
            ${alreadyInTrade > 0 ? `<p style="margin-bottom: 8px; color: #ffb74d; font-size: 12px;">
              <i class="fas fa-info-circle"></i> Já tem <strong>${alreadyInTrade}</strong> na negociação
            </p>` : ''}
            <div style="display: flex; align-items: center; gap: 8px;">
              <label for="trade-qty">Adicionar:</label>
              <input 
                type="number" 
                id="trade-qty" 
                name="quantity" 
                value="1" 
                min="1" 
                max="${remaining}" 
                style="width: 100px; padding: 4px;"
                autofocus
              />
              <span style="color: #666;">/ ${remaining} disponível${remaining !== maxQty ? ` (total: ${maxQty})` : ''}</span>
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
              const qty = parseInt(dialog.element.querySelector('#trade-qty').value) || 1;
              resolve(Math.min(Math.max(1, qty), remaining));
            }
          },
          {
            action: "cancel",
            label: "Cancelar",
            icon: "fa-solid fa-times",
            callback: () => resolve(null)
          }
        ],
        position: { width: 400 }
      });
      
      dialog.render(true);
    });
  }

  /**
   * Emit trade update via socket
   * @private
   */
  _emitTradeUpdate() {
    const updateData = {
      tradeId: this.tradeId,
      customerOfferedItems: this.tradeState.customerOfferedItems,
      customerRequestedItems: this.tradeState.customerRequestedItems,
      customerOfferedGold: this.tradeState.customerOfferedGold,
      merchantGold: this.tradeState.merchantGold
    };
    
    console.log('[CARDIGAN MERCHANT TRADE] Emitting update:', updateData);
    
    game.socket.emit('system.cardigan', {
      action: 'merchantTradeUpdate',
      data: updateData
    });
  }

  /**
   * Remove item from trade
   * @param {Event} event
   * @param {HTMLElement} target
   * @private
   */
  static async _onRemoveItem(event, target) {
    const itemId = target.dataset.itemId;
    const side = target.dataset.side;
    
    let itemList;
    if (side === 'customer-offer') {
      itemList = this.tradeState.customerOfferedItems;
    } else if (side === 'customer-request') {
      itemList = this.tradeState.customerRequestedItems;
    } else {
      return;
    }
    
    const index = itemList.findIndex(i => i.id === itemId);
    
    if (index > -1) {
      itemList.splice(index, 1);
      this._emitTradeUpdate();
      this.render();
    }
  }

  /**
   * Edit item quantity
   * @param {Event} event
   * @param {HTMLElement} target
   * @private
   */
  static async _onEditQuantity(event, target) {
    const itemId = target.dataset.itemId;
    const side = target.dataset.side;
    
    let itemList;
    if (side === 'customer-offer') {
      itemList = this.tradeState.customerOfferedItems;
    } else if (side === 'customer-request') {
      itemList = this.tradeState.customerRequestedItems;
    } else {
      return;
    }
    
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
   * @param {Event} event
   * @param {HTMLElement} target
   * @private
   */
  static async _onConfirmOffer(event, target) {
    // Both customer and merchant can offer gold
    const goldInput = this.isCustomer 
      ? this.element.querySelector('#customer-gold')
      : this.element.querySelector('#merchant-gold');
    
    const gold = parseInt(goldInput?.value) || 0;
    const side = this.isCustomer ? 'customer' : 'merchant';
    
    // Emit confirmation to other player
    game.socket.emit('system.cardigan', {
      action: 'merchantTradeConfirm',
      data: {
        tradeId: this.tradeId,
        side: side,
        gold: gold
      }
    });
    
    // Update local state
    await this.handleConfirmation(side, gold);
  }

  /**
   * Undo offer confirmation
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Clicked element
   * @private
   */
  static async _onUndoOffer(event, target) {
    const side = target.dataset.side; // 'customer' or 'merchant'
    
    // Verify permission
    if (side === 'customer' && !this.isCustomer) return;
    if (side === 'merchant' && this.isCustomer) return;
    
    // Update confirmation state
    if (side === 'customer') {
      this.tradeState.customerConfirmed = false;
    } else {
      this.tradeState.merchantConfirmed = false;
    }
    
    // Emit undo to other player
    this._emitMerchantTradeUndo(side);
    
    // Re-render
    this.render();
  }

  /**
   * Emit undo confirmation to other player
   * @param {string} side - Which side is undoing ('customer' or 'merchant')
   * @private
   */
  _emitMerchantTradeUndo(side) {
    game.socket.emit('system.cardigan', {
      type: 'merchantTradeUndo',
      data: {
        tradeId: this.tradeId,
        side: side
      }
    });
  }

  /**
   * Handle confirmation from either side
   * @param {string} side
   * @param {number} gold
   */
  async handleConfirmation(side, gold) {
    // Prevent multiple executions if trade is already executing or was recently executed
    if (this.isExecuting) {
      console.log('[CARDIGAN MERCHANT TRADE] Trade already executing, ignoring duplicate confirmation');
      return;
    }
    
    // Prevent execution if trade was executed in the last 2 seconds (debounce)
    if (this.executedAt && (Date.now() - this.executedAt) < 2000) {
      console.log('[CARDIGAN MERCHANT TRADE] Trade was recently executed, ignoring duplicate');
      return;
    }
    
    if (side === 'customer') {
      this.tradeState.customerConfirmed = true;
      this.tradeState.customerOfferedGold = gold;
    } else {
      this.tradeState.merchantConfirmed = true;
      this.tradeState.merchantGold = gold;
    }
    
    // Only the merchant (GM) should execute the trade
    if (this.tradeState.customerConfirmed && this.tradeState.merchantConfirmed) {
      if (!this.isCustomer) {
        await this._executeTrade();
      } else {
        // Customer just re-renders to show both confirmed
        this.render();
      }
    } else {
      this.render();
    }
  }

  /**
   * Execute the trade
   * @private
   */
  async _executeTrade() {
    // Double-check execution flag (defense in depth)
    if (this.isExecuting) {
      console.log('[CARDIGAN MERCHANT TRADE] Already executing, aborting duplicate call');
      return;
    }
    
    // Set execution flag immediately
    this.isExecuting = true;
    
    console.log('[CARDIGAN MERCHANT TRADE] Executing trade...', this.tradeState);
    
    // Validation: Check if actors still exist
    if (!this.customer || !this.merchant) {
      ui.notifications.error("Um dos participantes não está mais disponível!");
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
      const transferData = {
        tradeId: this.tradeId,
        customerId: this.customer.id,
        merchantId: this.merchant.id,
        customerOfferedItems: this.tradeState.customerOfferedItems,
        customerRequestedItems: this.tradeState.customerRequestedItems,
        customerOfferedGold: this.tradeState.customerOfferedGold,
        merchantGold: this.tradeState.merchantGold
      };
      
      console.log('[CARDIGAN MERCHANT TRADE] Executing transfer...', transferData);
      
      // If current user is GM, execute locally (sockets don't loop back to sender)
      // Otherwise, emit to GM via socket
      if (game.user.isGM) {
        console.log('[CARDIGAN MERCHANT TRADE] GM executing transfer locally');
        
        // Call the global handler function directly
        if (typeof globalThis.handleExecuteMerchantTradeTransfer === 'function') {
          await globalThis.handleExecuteMerchantTradeTransfer(transferData);
        } else {
          console.error('[CARDIGAN MERCHANT TRADE] Handler function not available!');
          ui.notifications.error("Erro ao executar o comércio!");
          this._resetConfirmations();
          this.isExecuting = false;
          return;
        }
      } else {
        console.log('[CARDIGAN MERCHANT TRADE] Non-GM emitting to socket for GM execution');
        game.socket.emit('system.cardigan', {
          action: 'executeMerchantTradeTransfer',
          data: transferData
        });
        ui.notifications.info("Aguardando GM processar comércio...");
      }
      
      // Mark as executed to prevent duplicate executions
      this.executedAt = Date.now();
      
    } catch (error) {
      console.error('[CARDIGAN MERCHANT TRADE] Error executing trade:', error);
      ui.notifications.error("Erro ao executar o comércio!");
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
    // Check customer OFFERED items (items customer gives to merchant)
    for (const tradeItem of this.tradeState.customerOfferedItems) {
      const item = this.customer.items.get(tradeItem.id);
      if (!item) {
        return { valid: false, error: `${this.customer.name} não possui mais o item: ${tradeItem.name}` };
      }
      if ((item.system.quantity || 1) < tradeItem.quantity) {
        return { valid: false, error: `${this.customer.name} não possui quantidade suficiente de: ${tradeItem.name}` };
      }
    }
    
    // Check customer REQUESTED items (items customer wants from merchant)
    for (const tradeItem of this.tradeState.customerRequestedItems) {
      const item = this.merchant.items.get(tradeItem.id);
      if (!item) {
        return { valid: false, error: `${this.merchant.name} não possui mais o item: ${tradeItem.name}` };
      }
      if ((item.system.quantity || 1) < tradeItem.quantity) {
        return { valid: false, error: `${this.merchant.name} não possui quantidade suficiente de: ${tradeItem.name}` };
      }
    }
    
    // Check gold for both sides
    const customerGold = this.customer.system.money || 0;
    const merchantGold = this.merchant.system.money || 0;
    
    if (customerGold < this.tradeState.customerOfferedGold) {
      return { valid: false, error: `${this.customer.name} não possui ouro suficiente!` };
    }
    
    if (merchantGold < this.tradeState.merchantGold) {
      return { valid: false, error: `${this.merchant.name} não possui ouro suficiente!` };
    }
    
    return { valid: true };
  }

  /**
   * Check encumbrance limits
   * @returns {Promise<{valid: boolean, error?: string}>}
   * @private
   */
  async _checkEncumbrance() {
    // Calculate weight that customer will receive (requested items from merchant)
    let weightToCustomer = 0;
    for (const tradeItem of this.tradeState.customerRequestedItems) {
      const item = this.merchant.items.get(tradeItem.id);
      if (item) {
        const itemWeight = item.system.peso || 0;
        weightToCustomer += itemWeight * tradeItem.quantity;
      }
    }
    
    // Calculate weight that merchant will receive (offered items from customer)
    let weightToMerchant = 0;
    for (const tradeItem of this.tradeState.customerOfferedItems) {
      const item = this.customer.items.get(tradeItem.id);
      if (item) {
        const itemWeight = item.system.peso || 0;
        weightToMerchant += itemWeight * tradeItem.quantity;
      }
    }
    
    // Check customer encumbrance
    const customerCurrentWeight = this.customer.system.peso?.atual || 0;
    const customerMaxWeight = this.customer.system.peso?.maximo || 999;
    
    // Net weight change for customer (receiving - giving)
    const customerWeightGiving = this.tradeState.customerOfferedItems.reduce((sum, tradeItem) => {
      const item = this.customer.items.get(tradeItem.id);
      return sum + ((item?.system.peso || 0) * tradeItem.quantity);
    }, 0);
    
    const customerNetWeight = customerCurrentWeight + weightToCustomer - customerWeightGiving;
    
    if (customerNetWeight > customerMaxWeight) {
      return { 
        valid: false, 
        error: `${this.customer.name} não consegue carregar tanto peso! (${customerNetWeight.toFixed(1)} / ${customerMaxWeight})` 
      };
    }
    
    // Check merchant encumbrance
    const merchantCurrentWeight = this.merchant.system.peso?.atual || 0;
    const merchantMaxWeight = this.merchant.system.peso?.maximo || 999;
    
    // Net weight change for merchant (receiving - giving)
    const merchantWeightGiving = this.tradeState.customerRequestedItems.reduce((sum, tradeItem) => {
      const item = this.merchant.items.get(tradeItem.id);
      return sum + ((item?.system.peso || 0) * tradeItem.quantity);
    }, 0);
    
    const merchantNetWeight = merchantCurrentWeight + weightToMerchant - merchantWeightGiving;
    
    if (merchantNetWeight > merchantMaxWeight) {
      return { 
        valid: false, 
        error: `${this.merchant.name} não consegue carregar tanto peso! (${merchantNetWeight.toFixed(1)} / ${merchantMaxWeight})` 
      };
    }
    
    return { valid: true };
  }

  /**
   * Reset confirmations
   * @private
   */
  _resetConfirmations() {
    this.tradeState.customerConfirmed = false;
    this.tradeState.merchantConfirmed = false;
    this.render();
  }

  /**
   * Cancel trade
   * @param {Event} event
   * @param {HTMLElement} target
   * @private
   */
  static async _onCancelTrade(event, target) {
    const cancellerName = this.isCustomer ? this.customer.name : this.merchant.name;
    
    // Emit cancellation to other player
    game.socket.emit('system.cardigan', {
      action: 'merchantTradeCancel',
      data: {
        tradeId: this.tradeId,
        cancelledBy: cancellerName
      }
    });
    
    // Show notification
    await ChatMessage.create({
      content: `<p>🚫 <strong>${cancellerName}</strong> cancelou o comércio.</p>`,
      speaker: { alias: "Sistema de Comércio" }
    });
    
    this.close();
  }

  /**
   * Handle window close (X button)
   * @override
   */
  async _onClose(options = {}) {
    // Only emit cancellation if dialog still exists in active trades
    if (globalThis.cardiganActiveMerchantTrades?.has(this.tradeId)) {
      const cancellerName = this.isCustomer ? this.customer.name : this.merchant.name;
      
      // Emit cancellation to other player
      game.socket.emit('system.cardigan', {
        action: 'merchantTradeCancel',
        data: {
          tradeId: this.tradeId,
          cancelledBy: cancellerName
        }
      });
      
      // Show notification
      await ChatMessage.create({
        content: `<p>🚫 <strong>${cancellerName}</strong> cancelou o comércio.</p>`,
        speaker: { alias: "Sistema de Comércio" }
      });
    }
    
    return super._onClose(options);
  }

  /** @override */
  async _onFormSubmit(event, form, formData) {
    event.preventDefault();
  }

  /** @override */
  async close(options = {}) {
    return super.close(options);
  }
}
