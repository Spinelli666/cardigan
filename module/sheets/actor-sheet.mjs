const { api, sheets } = foundry.applications;

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheetV2}
 */
export class CardiganSystemActorSheet extends api.HandlebarsApplicationMixin(
  sheets.ActorSheetV2
) {
  /** @type {foundry.applications.ux.DragDrop[]} */
  #dragDrop;

  constructor(options = {}) {
    super(options);
    this.#dragDrop = this.#createDragDropHandlers();
    
    // Store modal state to persist across re-renders
    this._modalState = {
      isOpen: false,
      focusedInput: null
    };
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['cardigan', 'actor'],
    position: {
      width: 600,
      height: 600,  // ✅ Volta para altura fixa original
    },
    window: {
      resizable: true,      // ✅ Mantém redimensionável
      minimizable: true,    // ✅ Mantém minimizável
    },
    actions: {
      onEditImage: this._onEditImage,
      createDoc: this._createDoc,
      editDoc: this._editDoc,
      deleteDoc: this._deleteDoc,
      roll: this._onRoll,
      rollDeathDie: this._onRollDeathDie,
      resetGiftOfLife: this._onResetGiftOfLife,
      resetDeathSentence: this._onResetDeathSentence,
      resetSanity: this._onResetSanity,
      resetToxicity: this._onResetToxicity,
      resetFracture: this._onResetFracture,
      resetHunger: this._onResetHunger,
      resetThirst: this._onResetThirst,
      showEffectInChat: this._onShowEffectInChat,
      // Removemos as ações do modal para implementar via event listeners diretos
    },
    // Custom property that's merged into `this.options`
    dragDrop: [{ dragSelector: '[data-drag]', dropSelector: null }],
    form: {
      submitOnChange: true,
    },
  };

  /** @override */
  static PARTS = {
    header: {
      template: 'systems/cardigan/templates/actor/header.hbs',
    },
    tabs: {
      // Foundry-provided generic template
      template: 'templates/generic/tab-navigation.hbs',
    },
    features: {
      template: 'systems/cardigan/templates/actor/features.hbs',
    },
    biography: {
      template: 'systems/cardigan/templates/actor/biography.hbs',
    },
    gear: {
      template: 'systems/cardigan/templates/actor/gear.hbs',
    },
    spells: {
      template: 'systems/cardigan/templates/actor/spells.hbs',
    },
    equipamentos: {
      template: 'systems/cardigan/templates/actor/equipamentos.hbs',
    },
  };

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    // Not all parts always render
    options.parts = ['header', 'tabs', 'biography']; // ✅ Header restaurado
    // Don't show the other tabs if only limited view
    if (this.document.limited) return;
    // Control which parts show based on document subtype
    switch (this.document.type) {
      case 'character':
        options.parts.push('features', 'gear', 'spells', 'equipamentos');
        break;
      case 'npc':
        options.parts.push('gear', 'equipamentos');
        break;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    // Output initialization
    const context = {
      // Validates both permissions and compendium status
      editable: this.isEditable,
      owner: this.document.isOwner,
      limited: this.document.limited,
      // Add the actor document.
      actor: this.actor,
      // Add the actor's data to context.data for easier access, as well as flags.
      system: this.actor.system,
      flags: this.actor.flags,
      // Adding a pointer to CONFIG.CARDIGAN
      config: CONFIG.CARDIGAN,
      tabs: this._getTabs(options.parts),
      // Necessary for formInput and formFields helpers
      fields: this.document.schema.fields,
      systemFields: this.document.system.schema.fields,
    };



    // Offloading context prep to a helper function
    this._prepareItems(context);

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context) {
    switch (partId) {
      case 'features':
        context.tab = context.tabs[partId];
        break;
      case 'spells':
      case 'gear':
      case 'equipamentos':
        context.tab = context.tabs[partId];
        break;
      case 'biography':
        context.tab = context.tabs[partId];
        // Enrich biography info for display
        // Enrichment turns text like `[[/r 1d20]]` into buttons
        context.enrichedBiography = await foundry.applications.ux.TextEditor.enrichHTML(
          this.actor.system.biography,
          {
            // Whether to show secret blocks in the finished html
            secrets: this.document.isOwner,
            // Data to fill in for inline rolls
            rollData: this.actor.getRollData(),
            // Relative UUID resolution
            relativeTo: this.actor,
          }
        );
        break;
    }
    return context;
  }

  /**
   * Generates the data for the generic tab navigation template
   * @param {string[]} parts An array of named template parts to render
   * @returns {Record<string, Partial<ApplicationTab>>}
   * @protected
   */
  _getTabs(parts) {
    // If you have sub-tabs this is necessary to change
    const tabGroup = 'primary';
    // Default tab for first time it's rendered this session
    if (!this.tabGroups[tabGroup]) this.tabGroups[tabGroup] = 'biography';
    return parts.reduce((tabs, partId) => {
      const tab = {
        cssClass: '',
        group: tabGroup,
        // Matches tab property to
        id: '',
        // FontAwesome Icon, if you so choose
        icon: '',
        // Run through localization
        label: 'CARDIGAN.Actor.Tabs.',
      };
      switch (partId) {
        case 'header':
        case 'tabs':
          return tabs;
        case 'biography':
          tab.id = 'biography';
          tab.label += 'Biography';
          break;
        case 'features':
          tab.id = 'features';
          tab.label += 'Features';
          break;
        case 'gear':
          tab.id = 'gear';
          tab.label += 'Gear';
          break;
        case 'spells':
          tab.id = 'spells';
          tab.label += 'Spells';
          break;
        case 'equipamentos':
          tab.id = 'equipamentos';
          tab.label += 'Equipamentos';
          break;
      }
      if (this.tabGroups[tabGroup] === tab.id) tab.cssClass = 'active';
      tabs[partId] = tab;
      return tabs;
    }, {});
  }

  /**
   * Actions performed after any render of the Application.
   * Post-render steps are not awaited by the render process.
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   * @override
   */
  _onRender(context, options) {
    this.#dragDrop.forEach((d) => d.bind(this.element));
    this.#disableOverrides();
    
    // Clear any existing modal listeners to prevent conflicts
    this._clearAbilitiesModalListeners();
    
    // Setup abilities modal event listeners
    this._setupAbilitiesButtonListeners();
    
    // Restore modal state if it was open before re-render
    if (this._modalState.isOpen) {
      setTimeout(() => {
        this._restoreModalState();
      }, 50); // Small delay to ensure DOM is ready
    }
    
    // Adicionar event listeners para checkboxes de hunger e thirst
    this.#addStatusListeners();
    
    // Adicionar event listeners para campos de durabilidade
    this.#addDurabilityListeners();
    
    // Adicionar event listeners para campos de munição
    this.#addAmmunitionListeners();
    
    // You may want to add other special handling here
    // Foundry comes with a large number of utility classes, e.g. SearchFilter
    // That you may want to implement yourself.
  }

  /**
   * Organize and classify Items for Actor sheets.
   *
   * @param {object} context The context object to mutate
   */
  _prepareItems(context) {
    // Initialize containers.
    // You can just use `this.document.itemTypes` instead
    // if you don't need to subdivide a given type like
    // this sheet does with spells
    const gear = [];
    const features = [];
    const efeitos = [];
    const armas = [];
    const spells = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
      8: [],
      9: [],
    };

    // Iterate through items, allocating to containers
    for (let i of this.document.items) {
      // Append to gear.
      if (i.type === 'gear') {
        gear.push(i);
      }
      // Append to armas (weapons).
      else if (i.type === 'arma') {
        armas.push(i);
      }
      // Append to features or efeitos.
      else if (i.type === 'feature') {
        // Se o nome contém "Efeito", vai para efeitos
        if (i.name && i.name.includes('Efeito')) {
          efeitos.push(i);
        } else {
          features.push(i);
        }
      }
      // Append to efeitos (tipo dedicado).
      else if (i.type === 'efeito') {
        efeitos.push(i);
      }
      // Append to spells.
      else if (i.type === 'spell') {
        if (i.system.spellLevel != undefined) {
          spells[i.system.spellLevel].push(i);
        }
      }
    }

    for (const s of Object.values(spells)) {
      s.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    }

    // Sort then assign
    context.gear = gear.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.features = features.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.efeitos = efeitos.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.armas = armas.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.spells = spells;
  }

  /**************
   *
   *   ACTIONS
   *
   **************/

  /**
   * Handle changing a Document's image.
   *
   * @this CardiganSystemActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onEditImage(event, target) {
    const attr = target.dataset.edit;
    const current = foundry.utils.getProperty(this.document, attr);
    const { img } =
      this.document.constructor.getDefaultArtwork?.(this.document.toObject()) ??
      {};
    const fp = new FilePicker({
      current,
      type: 'image',
      redirectToRoot: img ? [img] : [],
      callback: (path) => {
        this.document.update({ [attr]: path });
      },
      top: this.position.top + 40,
      left: this.position.left + 10,
    });
    return fp.browse();
  }

  /**
   * Handles item deletion
   *
   * @this CardiganSystemActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _deleteDoc(event, target) {
    const doc = this._getEmbeddedDocument(target);
    const performDeletion = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.format('DOCUMENT.Delete', { type: doc.documentName }) },
      content: game.i18n.format('DOCUMENT.DeleteWarning', { name: doc.name }),
    });
    if (performDeletion) {
      const deleted = await doc.delete();
      deleted.sheet.render(false);
    }
  }

  /**
   * Handle creating a new Owned Item or ActiveEffect for the actor using initial data defined in the HTML dataset
   *
   * @this CardiganSystemActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _createDoc(event, target) {
    // Retrieve the configured document class for Item or ActiveEffect
    const documentClass = getDocumentClass(target.dataset.documentClass);
    // Prepare the document creation data by building a default name and any additional data defined by the form element
    const createData = { name: target.dataset.name || documentClass.defaultName };
    if (target.dataset.type) createData.type = target.dataset.type;
    // Create the document and render its sheet
    const document = await documentClass.create(createData, {
      parent: this.document,
    });
    document.sheet.render(true);
  }

  /**
   * Handle editing an existing Owned Item or ActiveEffect for the actor
   *
   * @this CardiganSystemActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _editDoc(event, target) {
    const itemElement = target.closest('[data-item-id]');
    if (!itemElement) return;
    
    const itemId = itemElement.dataset.itemId;
    const item = this.document.items.get(itemId);
    
    if (item) {
      item.sheet.render(true);
    }
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onRoll(event, target) {
    event.preventDefault();
    
    const element = target;
    const dataset = element.dataset;

    // Handle item rolls.
    switch (dataset.rollType) {
      case 'item':
        const itemId = element.closest('[data-item-id]')?.dataset.itemId;
        const item = this.document.items.get(itemId);
        if (item) return item.roll();
        break;
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      const label = dataset.label || 'Roll';
      
      try {
        // Create the roll
        const roll = new Roll(dataset.roll, this.document.getRollData());
        
        // Evaluate the roll
        await roll.evaluate();
        
        // Send to chat
        const message = await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: this.document }),
          flavor: label,
          rollMode: game.settings.get('core', 'rollMode'),
        });
        
        return roll;
      } catch (error) {
        console.error("Error during roll:", error);
        ui.notifications.error(`Erro ao rolar ${label}: ${error.message}`);
      }
    }
  }

  /**
   * Handle rolling the Death Die (1d12)
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onRollDeathDie(event, target) {
    event.preventDefault();
    
    try {
      // Create the death die roll (1d12)
      const roll = new Roll('1d12');
      
      // Evaluate the roll
      await roll.evaluate();
      
      // Create custom flavor message based on result and apply automatic effects
      let flavorMessage = "Death Die";
      const result = roll.total;
      let updateData = {};
      
      // Apply automatic effects based on result
      if (result >= 1 && result <= 6) {
        // 1-6: Death Sentence
        const currentDeathSentence = this.document.system.status?.deathSentence ?? null;
        
        if (currentDeathSentence === 3) {
          // Já está no máximo
          flavorMessage += `\n Sentença de Morte! (${result})`;
          flavorMessage += `\n→ Já possui 3 Sentenças de Morte - PERSONAGEM MORREU!!`;
        } else if (currentDeathSentence === null) {
          // Começar do 1 (contagem zerada ou nunca marcada)
          updateData['system.status.deathSentence'] = 1;
          flavorMessage += `\n Sentença de Morte! (${result})`;
          flavorMessage += `\n→ Sentença de Morte nível 1 automaticamente marcada`;
        } else {
          // Incrementar (de 1 para 2, ou de 2 para 3)
          const newLevel = currentDeathSentence + 1;
          updateData['system.status.deathSentence'] = newLevel;
          flavorMessage += `\n Sentença de Morte! (${result})`;
          flavorMessage += `\n→ Sentença de Morte nível ${newLevel} automaticamente marcada`;

          if (newLevel === 3) {
            flavorMessage += `\n PERSONAGEM MORREU! (3 Sentenças de Morte)`;
          }
        }
      } else if (result >= 7 && result <= 12) {
        // 7-12: Dádiva da Vida
        const currentLifeGift = this.document.system.status?.giftOfLife ?? null;
        
        if (currentLifeGift === 3) {
          // Já está no máximo
          flavorMessage += `\n Dádiva da Vida! (${result})`;
          flavorMessage += `\n→ Já possui 3 Dádivas da Vida - ESTABILIZADO!`;
        } else if (currentLifeGift === null) {
          // Começar do 1 (contagem zerada ou nunca marcada)
          updateData['system.status.giftOfLife'] = 1;
          flavorMessage += `\n Dádiva da Vida! (${result})`;
          flavorMessage += `\n→ Dádiva da Vida nível 1 automaticamente marcada`;
        } else {
          // Incrementar (de 1 para 2, ou de 2 para 3)
          const newLevel = currentLifeGift + 1;
          updateData['system.status.giftOfLife'] = newLevel;
          flavorMessage += `\n Dádiva da Vida! (${result})`;
          flavorMessage += `\n→ Dádiva da Vida nível ${newLevel} automaticamente marcada`;

          if (newLevel === 3) {
            flavorMessage += `\n ESTABILIZADO! (3 Dádivas da Vida)`;
          }
        }
      }
      
      // Update the actor if there are changes to apply
      if (Object.keys(updateData).length > 0) {
        await this.document.update(updateData);
      }
      
      // Send to chat
      const chatMessage = await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.document }),
        flavor: flavorMessage,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      
      return roll;
    } catch (error) {
      console.error("Error during death die roll:", error);
      ui.notifications.error(`Erro ao rolar Dado de Morte: ${error.message}`);
    }
  }

  /**
   * Handle resetting Dádiva da Vida
   *  checkboxes
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onResetGiftOfLife(event, target) {
    event.preventDefault();
    
    try {
      // Reset Dádiva da Vida to null (unchecked)
      await this.document.update({
        'system.status.giftOfLife': null
      });
      
      ui.notifications.info("Dádiva da Vida zerada.");
    } catch (error) {
      console.error("Error resetting Gift of Life:", error);
      ui.notifications.error(`Erro ao zerar Dádiva da Vida: ${error.message}`);
    }
  }

  /**
   * Handle resetting Sentença de Morte checkboxes
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onResetDeathSentence(event, target) {
    event.preventDefault();
    
    try {
      // Reset Death Sentence to null (unchecked)
      await this.document.update({
        'system.status.deathSentence': null
      });
      
      ui.notifications.info("Sentença de Morte zerada.");
    } catch (error) {
      console.error("Error resetting Death Sentence:", error);
      ui.notifications.error(`Erro ao zerar Sentença de Morte: ${error.message}`);
    }
  }

  /**
   * Handle resetting Sanity checkboxes
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onResetSanity(event, target) {
    event.preventDefault();
    
    try {
      // Reset Sanity to null (unchecked)
      await this.document.update({
        'system.status.sanity': null
      });
      
      ChatMessage.create({ 
        content: `${this.document.name}: Estado mental estabilizado.`,
        speaker: ChatMessage.getSpeaker({ actor: this.document })
      });
      
      ui.notifications.info("Sanidade zerada.");
    } catch (error) {
      console.error("Error resetting Sanity:", error);
      ui.notifications.error(`Erro ao zerar Sanidade: ${error.message}`);
    }
  }

  /**
   * Handle resetting Toxicity checkboxes
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onResetToxicity(event, target) {
    event.preventDefault();
    
    try {
      // Reset Toxicity to null (unchecked)
      await this.document.update({
        'system.status.toxicity': null
      });
      
      ChatMessage.create({ 
        content: `${this.document.name}: Toxinas eliminadas do organismo.`,
        speaker: ChatMessage.getSpeaker({ actor: this.document })
      });
      
      ui.notifications.info("Toxicidade zerada.");
    } catch (error) {
      console.error("Error resetting Toxicity:", error);
      ui.notifications.error(`Erro ao zerar Toxicidade: ${error.message}`);
    }
  }



  /**
   * Handle resetting Fracture checkboxes
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onResetFracture(event, target) {
    event.preventDefault();
    
    try {
      // Reset Fracture to 0 (unchecked)
      await this.document.update({
        'system.status.fracture': 0
      });
      
      ChatMessage.create({ 
        content: `${this.document.name}: Fraturas completamente curadas.`,
        speaker: ChatMessage.getSpeaker({ actor: this.document })
      });
      
      ui.notifications.info("Fratura zerada.");
    } catch (error) {
      console.error("Error resetting Fracture:", error);
      ui.notifications.error(`Erro ao zerar Fratura: ${error.message}`);
    }
  }

  /**
   * Handle resetting Hunger to normal (0)
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onResetHunger(event, target) {
    event.preventDefault();
    
    try {
      // Resetar hunger para 0 (sem fome)
      await this.document.update({
        'system.status.hunger': 0
      });
      
      ChatMessage.create({ 
        content: `${this.document.name}: Fome resetada (sem fome).`,
        speaker: ChatMessage.getSpeaker({ actor: this.document })
      });
      
      ui.notifications.info("Fome resetada.");
      
      // Verificar efeito de exaustão após reset
      setTimeout(() => {
        const hungerLevel = this.document.system.status?.hunger ?? 0;
        const thirstLevel = this.document.system.status?.thirst ?? 0;
        this.document.system._checkAndApplyExhaustionEffect(hungerLevel, thirstLevel);
      }, 200);
    } catch (error) {
      console.error("Error resetting Hunger:", error);
      ui.notifications.error(`Erro ao resetar Fome: ${error.message}`);
    }
  }

  /**
   * Handle resetting Thirst to normal (0)
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onResetThirst(event, target) {
    event.preventDefault();
    
    try {
      // Resetar thirst para 0 (sem sede)
      await this.document.update({
        'system.status.thirst': 0
      });
      
      ChatMessage.create({ 
        content: `${this.document.name}: Sede resetada (sem sede).`,
        speaker: ChatMessage.getSpeaker({ actor: this.document })
      });
      
      ui.notifications.info("Sede resetada.");
      
      // Verificar efeito de exaustão após reset
      setTimeout(() => {
        const hungerLevel = this.document.system.status?.hunger ?? 0;
        const thirstLevel = this.document.system.status?.thirst ?? 0;
        this.document.system._checkAndApplyExhaustionEffect(hungerLevel, thirstLevel);
      }, 200);
    } catch (error) {
      console.error("Error resetting Thirst:", error);
      ui.notifications.error(`Erro ao resetar Sede: ${error.message}`);
    }
  }

  /**
   * Handle showing effect information in chat
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onShowEffectInChat(event, target) {
    event.preventDefault();
    
    try {
      const effectName = target.dataset.effectName;
      const effectDescription = target.dataset.effectDescription || "";
      const actorName = this.document.name;
      
      // Criar o conteúdo da mensagem
      let content = `<div class="cardigan-effect-message">
        <h3 style="margin: 0 0 8px 0; color: #b5b3a4; border-bottom: 1px solid #c9c7b8; padding-bottom: 4px;">
          <i class="fas fa-magic" style="margin-right: 6px;"></i>Efeito Ativo
        </h3>
        <p style="margin: 4px 0; font-weight: bold;">
          <strong>${actorName}</strong> está sob o efeito: <em style="color: #b5b3a4;">${effectName}</em>
        </p>`;
      
      if (effectDescription && effectDescription.trim() !== "") {
        content += `<div style="margin-top: 8px; padding: 6px; background: rgba(0,0,0,0.1); border-left: 3px solid #b5b3a4; border-radius: 3px;">
          <div style="margin: 0; font-style: italic; color: #666;">${effectDescription}</div>
        </div>`;
      }
      
      content += `</div>`;
      
      // Enviar mensagem para o chat
      await ChatMessage.create({
        content: content,
        speaker: ChatMessage.getSpeaker({ actor: this.document }),
        type: CONST.CHAT_MESSAGE_TYPES.OTHER
      });
      
    } catch (error) {
      console.error("Error showing effect in chat:", error);
      ui.notifications.error(`Erro ao mostrar efeito no chat: ${error.message}`);
    }
  }

  /**
   * Get an embedded document from the target element
   * @param {HTMLElement} target    The target element
   * @returns {Document}             The embedded document
   * @protected
   */
  _getEmbeddedDocument(target) {
    const docRow = target.closest('[data-document-id], [data-item-id], [data-effect-id]');
    if (docRow?.dataset.documentId) {
      return this.document.effects.get(docRow.dataset.documentId);
    } else if (docRow?.dataset.itemId) {
      return this.document.items.get(docRow.dataset.itemId);
    } else if (docRow?.dataset.effectId) {
      // Handle effects that might be on items (parent-id) or directly on actor
      const effectId = docRow.dataset.effectId;
      const parentId = docRow.dataset.parentId;
      
      // If there's a parent ID and it's not the actor's ID, look for the effect on that item
      if (parentId && parentId !== this.document.id) {
        const parentItem = this.document.items.get(parentId);
        if (parentItem?.effects) {
          const effect = parentItem.effects.get(effectId);
          if (effect) return effect;
        }
      }
      
      // Otherwise, look for the effect directly on the actor
      return this.document.effects.get(effectId);
    }
    throw new Error('Could not find document from element');
  }

  /********************
   *
   * Drag and Drop
   *
   ********************/

  /**
   * Define whether a user is able to begin a dragstart workflow for a given element
   * @param {string} selector       The candidate HTML selector for dragging
   * @returns {boolean}             Can the current user drag this element?
   * @protected
   */
  _canDragStart(selector) {
    // game.user fetches the current user
    return this.isEditable;
  }

  /**
   * Define whether a user is able to conclude a drag-and-drop workflow for a given element
   * @param {string} selector       The candidate HTML selector for the drop target
   * @returns {boolean}             Can the current user drop on this element?
   * @protected
   */
  _canDragDrop(selector) {
    // game.user fetches the current user
    return this.isEditable;
  }

  /**
   * Callback actions which occur at the beginning of a drag start workflow.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragStart(event) {
    const li = event.currentTarget;
    if ('link' in event.target.dataset) return;

    let dragData = null;

    // Active Effect
    if (li.dataset.effectId) {
      const effect = this.actor.effects.get(li.dataset.effectId);
      dragData = effect.toDragData();
    }

    // Owned Item
    else if (li.dataset.itemId) {
      const item = this.actor.items.get(li.dataset.itemId);
      dragData = item.toDragData();
    }

    // Set data transfer
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  /**
   * Callback actions which occur when a dragged element is over a drop target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragOver(event) {}

  /**
   * Callback actions which occur when a dragged element is dropped on a target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.getDragEventData(event);
    const actor = this.actor;
    const allowed = Hooks.call('dropActorSheetData', actor, this, data);
    if (allowed === false) return;

    // Handle different data types
    switch (data.type) {
      case 'ActiveEffect':
        return this._onDropActiveEffect(event, data);
      case 'Actor':
        return this._onDropActor(event, data);
      case 'Item':
        return this._onDropItem(event, data);
      case 'Folder':
        return this._onDropFolder(event, data);
    }
  }

  /**
   * Handle the dropping of ActiveEffect data onto an Actor Sheet
   * @param {DragEvent} event                  The concluding DragEvent which contains drop data
   * @param {object} data                      The data transfer extracted from the event
   * @returns {Promise<ActiveEffect|boolean>}  The created ActiveEffect object or false if it couldn't be created.
   * @protected
   */
  async _onDropActiveEffect(event, data) {
    const aeCls = getDocumentClass('ActiveEffect');
    const effect = await aeCls.fromDropData(data);
    if (!this.actor.isOwner || !effect) return false;
    if (effect.target === this.actor) return false;
    return aeCls.create(effect.toObject(), { parent: this.actor });
  }

  /**
   * Handle dropping of an Actor data onto another Actor sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<object|boolean>}  A data object which describes the result of the drop, or false if the drop was
   *                                     not permitted.
   * @protected
   */
  async _onDropActor(event, data) {
    if (!this.actor.isOwner) return false;
  }

  /**
   * Handle dropping of an item reference or item data onto an Actor Sheet
   * @param {DragEvent} event            The concluding DragEvent which contains drop data
   * @param {object} data                The data transfer extracted from the event
   * @returns {Promise<Item[]|boolean>}  The created or updated Item instances, or false if the drop was not
   *                                     permitted.
   * @protected
   */
  async _onDropItem(event, data) {
    if (!this.actor.isOwner) return false;
    const item = await Item.implementation.fromDropData(data);

    // Handle item sorting within the same Actor
    if (this.actor.uuid === item.parent?.uuid) return this._onSortItem(event, item);

    // Create the owned item
    return this._onDropItemCreate(item, event);
  }

  /**
   * Handle dropping of a Folder on an Actor Sheet.
   * The core sheet currently supports dropping a Folder of Items to create all items as owned items.
   * @param {DragEvent} event     The concluding DragEvent which contains drop data
   * @param {object} data         The data transfer extracted from the event
   * @returns {Promise<Item[]>}
   * @protected
   */
  async _onDropFolder(event, data) {
    if (!this.actor.isOwner) return [];
    const folder = await Folder.implementation.fromDropData(data);
    if (folder.type !== 'Item') return [];
    const droppedItemData = await Promise.all(
      folder.contents.map(async (item) => {
        if (!(document instanceof Item)) item = await fromUuid(item.uuid);
        return item.toObject();
      })
    );
    return this._onDropItemCreate(droppedItemData, event);
  }

  /**
   * Handle the final creation of dropped Item data on the Actor.
   * This method is factored out to allow downstream classes the opportunity to override item creation behavior.
   * @param {object[]|object} itemData     The item data requested for creation
   * @param {DragEvent} event              The concluding DragEvent which provided the drop data
   * @returns {Promise<Item[]>}
   * @protected
   */
  async _onDropItemCreate(itemData, event) {
    itemData = itemData instanceof Array ? itemData : [itemData];
    return this.actor.createEmbeddedDocuments('Item', itemData);
  }

  /**
   * Handle a drop event for an existing embedded Item to sort that Item relative to its siblings
   * @param {Event} event
   * @param {Item} item
   * @private
   */
  _onSortItem(event, item) {
    // Get the drag source and drop target
    const items = this.actor.items;
    const source = items.get(item.id);
    const dropTarget = event.target.closest('[data-item-id]');
    if (!dropTarget) return;
    const target = items.get(dropTarget.dataset.itemId);

    // Don't sort on yourself
    if (source.id === target.id) return;

    // Identify sibling items based on type and parent
    const siblings = items.filter((i) => {
      return i.type === source.type && i.parent === source.parent;
    });

    // Perform the sort
    const sortUpdates = SortingHelpers.performIntegerSort(source, {
      target,
      siblings,
    });
    const updateData = sortUpdates.map((u) => {
      const update = u.update;
      update._id = u.target._id;
      return update;
    });

    // Perform the update
    return this.actor.updateEmbeddedDocuments('Item', updateData);
  }

  /**
   * Creates drag & drop handlers for this application
   * @returns {foundry.applications.ux.DragDrop[]}     An array of DragDrop handlers
   * @private
   */
  #createDragDropHandlers() {
    return this.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      };
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this),
      };
      return new foundry.applications.ux.DragDrop(d);
    });
  }

  /********************
   *
   * Actor Override Handling
   *
   ********************/

  /**
   * Submit a document update based on the processed form data.
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {object} submitData                   Processed and validated form data to be used for a document update
   * @returns {Promise<void>}
   * @protected
   * @override
   */
  async _processSubmitData(event, form, submitData) {
    const overrides = foundry.utils.flattenObject(this.actor.overrides);
    for (let k of Object.keys(overrides)) delete submitData[k];
    
    // Process item updates separately
    const itemUpdates = [];
    const actorUpdates = {};
    
    for (const [key, value] of Object.entries(submitData)) {
      // Ignorar campos de durabilidade pois são processados pelo nosso listener
      if (key.includes('durability')) {
        console.log(`[CARDIGAN] Ignorando campo de durabilidade no submitData: ${key}`);
        continue;
      }
      
      if (key.startsWith('items.')) {
        // Extract item ID and property path
        const match = key.match(/^items\.([^.]+)\.(.+)$/);
        if (match) {
          const [, itemId, propertyPath] = match;
          let existingUpdate = itemUpdates.find(u => u._id === itemId);
          if (!existingUpdate) {
            existingUpdate = { _id: itemId };
            itemUpdates.push(existingUpdate);
          }
          foundry.utils.setProperty(existingUpdate, propertyPath, value);
        }
      } else {
        actorUpdates[key] = value;
      }
    }
    
    // Update items if there are any changes
    if (itemUpdates.length > 0) {
      await this.actor.updateEmbeddedDocuments('Item', itemUpdates);
    }
    
    // Update actor if there are any changes
    if (Object.keys(actorUpdates).length > 0) {
      await this.document.update(actorUpdates);
    }
  }

  /********************
   *
   * Actor Override Handling
   *
   ********************/

  /**
   * Configura checkboxes para serem acumulativos (podem ser desmarcados)
   * @param {NodeList} checkboxes 
   * @param {string} field 
   */
  #setupIndependentRadios(checkboxes, field) {
    checkboxes.forEach(checkbox => {
      let wasChecked = false;
      
      // Capturar estado em mousedown
      checkbox.addEventListener('mousedown', () => {
        wasChecked = checkbox.checked;
      });
      
      // Processar click
      checkbox.addEventListener('click', async (ev) => {
        ev.preventDefault();
        
        const clickedLevel = parseInt(checkbox.dataset.level);
        let newValue = 0;
        
        if (wasChecked) {
          // Se estava marcado, desmarcar todos (volta para 0)
          checkboxes.forEach(r => r.checked = false);
          newValue = 0;
        } else {
          // Se não estava marcado, marcar este e todos os anteriores (acumulativo)
          checkboxes.forEach(r => {
            const rLevel = parseInt(r.dataset.level);
            r.checked = rLevel <= clickedLevel;
          });
          newValue = clickedLevel;
        }
        
        // Atualizar o documento
        await this.actor.update({
          [`system.status.${field}`]: newValue
        });
        
        // Gerar mensagem para chat
        this.#sendFieldMessage(field, newValue);
        
        // Verificar efeito de exaustão se for hunger ou thirst
        if (field === 'hunger' || field === 'thirst') {
          setTimeout(() => {
            const hungerLevel = this.actor.system.status?.hunger ?? 0;
            const thirstLevel = this.actor.system.status?.thirst ?? 0;
            this.actor.system._checkAndApplyExhaustionEffect(hungerLevel, thirstLevel);
          }, 200);
        }
      });
    });
  }

  /**
   * Calcula o valor do campo baseado nos radios marcados
   * @param {string} field 
   * @returns {number}
   */
  #calculateFieldValue(field) {
    const radios = document.querySelectorAll(`.radio-group[data-field="${field}"] input[type="radio"]:checked`);
    if (radios.length === 0) return 0;
    
    // Para radio buttons, pegar o valor mais alto marcado
    let maxValue = 0;
    radios.forEach(radio => {
      const level = parseInt(radio.dataset.level) || 0;
      if (level > maxValue) maxValue = level;
    });
    
    return maxValue;
  }

  /**
   * Calcula penalty total baseado em hunger e thirst
   * @returns {number}
   */
  #calculatePenalty() {
    // Removida penalidade automática por fome/sede
    // Nova regra será implementada posteriormente
    return 0;
  }

  /**
   * Envia mensagem para o chat baseada no valor do campo
   * @param {string} field 
   * @param {number} value 
   */
  #sendFieldMessage(field, value) {
    let message = "";
    
    if (field === 'hunger') {
      if (value === 0) {
        message = `${this.actor.name} não está mais com fome.`;
      } else if (value === 1) {
        message = `${this.actor.name} está com 1 de Fome.`;
      } else if (value === 2) {
        message = `${this.actor.name} está com 2 de Fome.`;
      } else if (value === 3) {
        message = `${this.actor.name} está com fome! [3 de Fome]`;
      }
    } else if (field === 'thirst') {
      if (value === 0) {
        message = `${this.actor.name} não está mais com sede.`;
      } else if (value === 1) {
        message = `${this.actor.name} está com 1 de Sede.`;
      } else if (value === 2) {
        message = `${this.actor.name} está com 2 de Sede.`;
      } else if (value === 3) {
        message = `${this.actor.name} está com sede! [3 de Sede]`;
      }
    }
    
    if (message) {
      ChatMessage.create({ 
        content: message,
        speaker: ChatMessage.getSpeaker({ actor: this.actor })
      });
    }
  }

  /**
   * Adiciona event listeners para os checkboxes de hunger e thirst
   */
  #addStatusListeners() {
    const html = this.element;

    // Configurar checkboxes de fome e sede (acumulativos)
    const hungerCheckboxes = html.querySelectorAll('.radio-group[data-field="hunger"] input[type="checkbox"]');
    const thirstCheckboxes = html.querySelectorAll('.radio-group[data-field="thirst"] input[type="checkbox"]');
    
    this.#setupIndependentRadios(hungerCheckboxes, 'hunger');
    this.#setupIndependentRadios(thirstCheckboxes, 'thirst');

    // Adicionar listeners para os grupos sequenciais (giftOfLife, deathSentence, sanity, toxicity)
    html.querySelectorAll('.sequential-group').forEach(group => {
      const field = group.dataset.field;
      const checkboxes = group.querySelectorAll('input[type="checkbox"]');
      
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', async (ev) => {
          ev.preventDefault();
          const level = parseInt(ev.target.dataset.level);
          const currentValue = this.actor.system.status?.[field] ?? null;
          let newValue = null;
          let message = "";
          
          if (ev.target.checked) {
            // Marcar: definir o valor como o nível da checkbox
            newValue = level;
            
            // Gerar mensagem baseada no campo e nível
            if (field === 'sanity') {
              const messages = {
                1: "Ansioso, você está estressado, tenso e desconfiado.",
                2: "Paranoico, você está desesperado, neurótico e pessimista.",
                3: "Violento, você inconsequente, você está hostil e insensível.",
                4: "Vilanesco, você está completamente insano, todos são inimigos e odiáveis.",
                5: "Perdido, o narrador assume seu personagem para guiá-lo à auto-destruição."
              };
              message = `${this.actor.name}: ${messages[level]}`;
            } else if (field === 'toxicity') {
              const messages = {
                1: "Levemente intoxicado, você sente náusea e tontura.",
                2: "Intoxicação moderada, você está enjoado e com visão turva.",
                3: "Severamente intoxicado, você está vomitando e com dores intensas.",
                4: "Intoxicação crítica, você está delirando e perdendo consciência.",
                5: "Envenenamento fatal, você está à beira da morte por toxinas."
              };
              message = `${this.actor.name}: ${messages[level]}`;
            }
          } else {
            // Desmarcar: definir como o nível anterior (level - 1) ou null se for 1
            newValue = level > 1 ? level - 1 : null;
            
            if (field === 'sanity' && newValue === null) {
              message = `${this.actor.name}: Estado mental estabilizado.`;
            } else if (field === 'toxicity' && newValue === null) {
              message = `${this.actor.name}: Toxinas eliminadas do organismo.`;
            }
          }
          
          // Atualizar o valor no ator
          await this.actor.update({
            [`system.status.${field}`]: newValue
          });
          
          // Enviar mensagem para o chat se houver
          if (message) {
            ChatMessage.create({ 
              content: message,
              speaker: ChatMessage.getSpeaker({ actor: this.actor })
            });
          }
        });
      });
    });
  }

  /**
   * Adiciona event listeners para campos de durabilidade de armas
   * Implementa sincronização instantânea entre actor sheet e item sheet
   */
  #addDurabilityListeners() {
    const html = this.element;
    
    // Encontrar todos os inputs de durabilidade de armas (atual e máxima)
    const durabilityInputs = html.querySelectorAll('input[name*="durability"]');
    
    durabilityInputs.forEach(input => {
      // Armazenar valor anterior para comparação
      input.dataset.previousValue = input.value;
      
      // Usar apenas 'blur' para evitar processamento excessivo
      input.addEventListener('blur', this.#handleDurabilityChange.bind(this));
      
      // Usar 'keydown' para capturar Enter
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.target.blur(); // Força o blur que irá processar a mudança
        }
      });
    });
  }

  /**
   * Manipula mudanças nos campos de durabilidade com debounce e validação
   * @param {Event} event 
   */
  async #handleDurabilityChange(event) {
    const input = event.target;
    const name = input.name;
    const currentValue = input.value.trim();
    const previousValue = input.dataset.previousValue;
    
    // Se o valor não mudou, não faz nada
    if (currentValue === previousValue) return;
    
    // Se o campo está vazio, não processa ainda (permite edição)
    if (currentValue === '') {
      console.log('[CARDIGAN] Campo vazio, aguardando valor...');
      return;
    }
    
    // Extrair o ID do item e o campo específico
    const match = name.match(/^items\.([^.]+)\.system\.durability\.(.+)$/);
    if (!match) return;
    
    const [, itemId, field] = match;
    let value = parseInt(currentValue);
    
    // Validar se é um número válido
    if (isNaN(value) || value < 0) {
      console.log('[CARDIGAN] Valor inválido, restaurando valor anterior');
      input.value = previousValue;
      return;
    }
    
    // Buscar o item para validação
    const item = this.actor.items.get(itemId);
    if (!item) return;
    
    // Validar limites baseados no tipo de campo
    if (field === 'current') {
      const maxDurability = item.system.durability.max;
      if (value > maxDurability) {
        console.log(`[CARDIGAN] Valor ${value} excede máximo ${maxDurability}, ajustando`);
        value = maxDurability;
        input.value = value;
      }
    } else if (field === 'max') {
      // Durabilidade máxima deve ser pelo menos 1
      if (value < 1) {
        console.log(`[CARDIGAN] Durabilidade máxima deve ser pelo menos 1, ajustando`);
        value = 1;
        input.value = value;
      }
      
      // Se a durabilidade atual for maior que a nova máxima, ajustar
      const currentDurability = item.system.durability.current;
      if (currentDurability > value) {
        console.log(`[CARDIGAN] Ajustando durabilidade atual de ${currentDurability} para ${value}`);
        await item.update({
          'system.durability.current': value,
          'system.durability.max': value
        });
        input.dataset.previousValue = value.toString();
        return;
      }
    }
    
    console.log(`[CARDIGAN] Atualizando durabilidade - Item: ${itemId}, Campo: ${field}, Valor: ${value}`);
    
    // Preparar a atualização
    const updateData = {};
    updateData[`system.durability.${field}`] = value;
    
    try {
      // Atualizar o item diretamente (sem usar o form submit para evitar conflito)
      await item.update(updateData);
      
      // Atualizar o valor anterior para a próxima comparação
      input.dataset.previousValue = value.toString();
      
      console.log(`[CARDIGAN] Durabilidade atualizada com sucesso para ${item.name}`);
    } catch (error) {
      console.error('[CARDIGAN] Erro ao atualizar durabilidade:', error);
      // Restaurar valor anterior em caso de erro
      input.value = previousValue;
    }
  }

  /**
   * Adiciona event listeners para campos de munição de armas
   * Implementa sincronização instantânea entre actor sheet e item sheet
   */
  #addAmmunitionListeners() {
    const html = this.element;
    
    // Encontrar todos os inputs de munição de armas (atual e máxima)
    const ammunitionInputs = html.querySelectorAll('input[name*="ammunition"]');
    
    ammunitionInputs.forEach(input => {
      // Armazenar valor anterior para comparação
      input.dataset.previousValue = input.value;
      
      // Usar apenas 'blur' para evitar processamento excessivo
      input.addEventListener('blur', this.#handleAmmunitionChange.bind(this));
      
      // Usar 'keydown' para capturar Enter
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.target.blur(); // Força o blur que irá processar a mudança
        }
      });
    });
  }

  /**
   * Manipula mudanças nos campos de munição com debounce e validação
   * @param {Event} event 
   */
  async #handleAmmunitionChange(event) {
    const input = event.target;
    const name = input.name;
    const currentValue = input.value.trim();
    const previousValue = input.dataset.previousValue;
    
    // Se o valor não mudou, não faz nada
    if (currentValue === previousValue) return;
    
    // Se o campo está vazio, não processa ainda (permite edição)
    if (currentValue === '') {
      console.log('[CARDIGAN] Campo vazio, aguardando valor...');
      return;
    }
    
    // Extrair o ID do item e o campo específico
    const match = name.match(/^items\.([^.]+)\.system\.ammunition\.(.+)$/);
    if (!match) return;
    
    const [, itemId, field] = match;
    let value = parseInt(currentValue);
    
    // Validar se é um número válido
    if (isNaN(value) || value < 0) {
      console.log('[CARDIGAN] Valor inválido, restaurando valor anterior');
      input.value = previousValue;
      return;
    }
    
    // Buscar o item para validação
    const item = this.actor.items.get(itemId);
    if (!item) return;
    
    // Validar limites baseados no tipo de campo
    if (field === 'current') {
      const maxAmmunition = item.system.ammunition.max;
      if (value > maxAmmunition) {
        console.log(`[CARDIGAN] Valor ${value} excede máximo ${maxAmmunition}, ajustando`);
        value = maxAmmunition;
        input.value = value;
      }
    } else if (field === 'max') {
      // Munição máxima deve ser pelo menos 0
      if (value < 0) {
        console.log(`[CARDIGAN] Munição máxima deve ser pelo menos 0, ajustando`);
        value = 0;
        input.value = value;
      }
      
      // Se a munição atual for maior que a nova máxima, ajustar
      const currentAmmunition = item.system.ammunition.current;
      if (currentAmmunition > value) {
        console.log(`[CARDIGAN] Ajustando munição atual de ${currentAmmunition} para ${value}`);
        await item.update({
          'system.ammunition.current': value,
          'system.ammunition.max': value
        });
        input.dataset.previousValue = value.toString();
        return;
      }
    }
    
    console.log(`[CARDIGAN] Atualizando munição - Item: ${itemId}, Campo: ${field}, Valor: ${value}`);
    
    // Preparar a atualização
    const updateData = {};
    updateData[`system.ammunition.${field}`] = value;
    
    try {
      // Atualizar o item diretamente (sem usar o form submit para evitar conflito)
      await item.update(updateData);
      
      // Atualizar o valor anterior para a próxima comparação
      input.dataset.previousValue = value.toString();
      
      console.log(`[CARDIGAN] Munição atualizada com sucesso para ${item.name}`);
    } catch (error) {
      console.error('[CARDIGAN] Erro ao atualizar munição:', error);
      // Restaurar valor anterior em caso de erro
      input.value = previousValue;
    }
  }

  /**
   * Setup event listeners for abilities modal buttons
   * @protected
   */
  _setupAbilitiesButtonListeners() {
    // Edit button
    const editButton = this.element.querySelector('[data-action="editAbilities"]');
    if (editButton) {
      editButton.addEventListener('click', (event) => {
        event.preventDefault();
        this.openAbilitiesModal();
      });
    }
  }

  /**
   * Setup event listeners for modal close buttons (called when modal opens)
   * @protected
   */
  _setupModalCloseListeners() {
    // Close buttons inside the modal
    const closeButtons = this.element.querySelectorAll('[data-action="closeAbilitiesModal"]');
    console.log('[CARDIGAN] Found close buttons:', closeButtons.length);
    
    closeButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        console.log('[CARDIGAN] Close button clicked');
        event.preventDefault();
        event.stopPropagation();
        this.closeAbilitiesModal();
      });
    });
  }

  /**
   * Instance method to open abilities modal
   * @protected
   */
  openAbilitiesModal() {
    const modal = this.element.querySelector('#abilities-edit-modal');
    if (modal) {
      modal.style.display = 'flex';
      
      // Store modal state
      this._modalState.isOpen = true;
      
      // Clear any existing listeners to prevent duplicates
      this._clearAbilitiesModalListeners();
      
      // Setup close button listeners (must be after modal is visible)
      this._setupModalCloseListeners();
      
      // Setup real-time input listeners for the modal
      this._setupAbilitiesModalListeners();
    }
  }

  /**
   * Instance method to close abilities modal
   * @protected
   */
  closeAbilitiesModal() {
    console.log('[CARDIGAN] Close button clicked');
    
    const modal = this.element.querySelector('#abilities-edit-modal');
    if (modal) {
      console.log('[CARDIGAN] Closing modal via close button');
      modal.style.display = 'none';
      
      // Update modal state
      this._modalState.isOpen = false;
      this._modalState.focusedInput = null;
      
      // Clear listeners when closing
      this._clearAbilitiesModalListeners();
    }
  }

  /**
   * Restore modal state after re-render
   * @protected
   */
  _restoreModalState() {
    const modal = this.element.querySelector('#abilities-edit-modal');
    if (modal && this._modalState.isOpen) {
      console.log('[CARDIGAN] Restoring modal state after re-render');
      modal.style.display = 'flex';
      
      // Setup close button listeners again
      this._setupModalCloseListeners();
      
      // Setup listeners again
      this._setupAbilitiesModalListeners();
      
      // Restore focus if there was a focused input
      if (this._modalState.focusedInput) {
        const input = modal.querySelector(`[data-ability="${this._modalState.focusedInput}"]`);
        if (input) {
          setTimeout(() => input.focus(), 100);
        }
      }
    }
  }

  /**
   * Clear existing modal listeners to prevent duplicates
   * @protected
   */
  _clearAbilitiesModalListeners() {
    const modal = this.element?.querySelector('#abilities-edit-modal');
    if (!modal) return;
    
    // Clone the modal to remove all event listeners
    const newModal = modal.cloneNode(true);
    modal.parentNode.replaceChild(newModal, modal);
  }

  /** @override */
  async close(options={}) {
    // Clean up modal listeners and state before closing
    this._modalState.isOpen = false;
    this._modalState.focusedInput = null;
    this._clearAbilitiesModalListeners();
    return super.close(options);
  }

  /**
   * Setup real-time listeners for abilities modal inputs
   * @protected
   */
  _setupAbilitiesModalListeners() {
    const modal = this.element.querySelector('#abilities-edit-modal');
    if (!modal) return;
    
    console.log('[CARDIGAN] Setting up modal listeners');
    
    // Store reference to close handler
    const modalClickHandler = (event) => {
      // Only close if clicking on the modal overlay itself
      if (event.target === modal) {
        console.log('[CARDIGAN] Closing modal via overlay click');
        modal.style.display = 'none';
        this._modalState.isOpen = false;
        this._modalState.focusedInput = null;
        this._clearAbilitiesModalListeners();
      }
    };
    
    // Close modal when clicking on overlay
    modal.addEventListener('click', modalClickHandler);
    
    // Prevent modal content from propagating clicks
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.addEventListener('click', (event) => {
        event.stopPropagation();
      });
    }
    
    // Handle ESC key to close modal
    const escHandler = (event) => {
      if (event.key === 'Escape') {
        console.log('[CARDIGAN] Closing modal via ESC key');
        modal.style.display = 'none';
        this._modalState.isOpen = false;
        this._modalState.focusedInput = null;
        this._clearAbilitiesModalListeners();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
    
    // Setup input listeners
    const inputs = modal.querySelectorAll('.ability-value-edit, .ability-bonus-edit');
    console.log(`[CARDIGAN] Found ${inputs.length} ability inputs`);
    
    inputs.forEach(input => {
      // Store the original value
      input.dataset.originalValue = input.value;
      
      // ONLY use change event - when user tabs out or moves to another field
      const changeHandler = (event) => {
        event.stopPropagation();
        console.log('[CARDIGAN] Change event triggered for', input.dataset.ability);
        this._onAbilityModalInput(event);
      };
      
      input.addEventListener('change', changeHandler);
      
      // Prevent clicks and focus from bubbling
      input.addEventListener('click', (event) => {
        event.stopPropagation();
      });
      
      input.addEventListener('focus', (event) => {
        event.stopPropagation();
        // Store which input has focus
        this._modalState.focusedInput = input.dataset.ability;
      });
      
      input.addEventListener('blur', (event) => {
        // Clear focused input when leaving
        if (this._modalState.focusedInput === input.dataset.ability) {
          this._modalState.focusedInput = null;
        }
      });
      
      // Handle Enter key - just move focus away, don't trigger any updates
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          // Find next input or blur current one
          const allInputs = Array.from(modal.querySelectorAll('.ability-value-edit, .ability-bonus-edit'));
          const currentIndex = allInputs.indexOf(input);
          const nextInput = allInputs[currentIndex + 1];
          
          if (nextInput) {
            nextInput.focus();
          } else {
            input.blur();
          }
        }
        event.stopPropagation();
      });
    });
  }

  /**
   * Handle input changes in abilities modal
   * @param {Event} event The input event
   * @protected
   */
  async _onAbilityModalInput(event) {
    event.stopPropagation();
    
    const input = event.target;
    const ability = input.dataset.ability;
    const isValue = input.classList.contains('ability-value-edit');
    const currentValue = input.value.trim();
    const originalValue = input.dataset.originalValue;
    
    // Only update if value actually changed
    if (currentValue === originalValue) {
      console.log(`[CARDIGAN] Value for ${ability} unchanged, skipping update`);
      return;
    }
    
    const value = parseInt(currentValue) || 0;
    
    // Update the document
    const field = isValue ? 'value' : 'bonus';
    const updatePath = `system.abilities.${ability}.${field}`;
    
    try {
      console.log(`[CARDIGAN] Updating ${ability} ${field} from ${originalValue} to ${value}`);
      
      // Store current focus state before update
      this._modalState.focusedInput = ability;
      
      // Update the document with minimal re-render
      await this.document.update({
        [updatePath]: value
      }, {
        render: false  // Prevent automatic re-render
      });
      
      // Update the stored original value
      input.dataset.originalValue = currentValue;
      
      // Manually update displays without full re-render
      this._updateAbilityDisplays(ability);
      
      console.log(`[CARDIGAN] Successfully updated ${ability} ${field} to ${value}`);
      
    } catch (error) {
      console.error('[CARDIGAN] Error updating ability:', error);
      // Restore original value on error
      input.value = originalValue;
    }
  }

  /**
   * Manually update ability displays without triggering full re-render
   * @param {string} ability The ability key
   * @protected
   */
  _updateAbilityDisplays(ability) {
    const abilityData = this.document.system.abilities[ability];
    // Usar totalBonus que inclui bônus manual + bônus de armas
    const total = (abilityData.value || 0) + (abilityData.totalBonus || 0);
    
    // Update modal total display
    this._updateAbilityTotal(ability);
    
    // Update main sheet readonly inputs
    this._syncMainSheetAbilities(ability);
    
    // Update derived stats based on the changed ability
    this._updateDerivedStats(ability);
    
    // Update any rollable ability displays
    const rollableElements = this.element.querySelectorAll(`[data-roll*="${ability}"]`);
    rollableElements.forEach(element => {
      if (element.textContent.includes(':')) {
        const parts = element.textContent.split(':');
        if (parts.length > 1) {
          element.textContent = `${parts[0].trim()}: ${total}`;
        }
      }
    });
  }

  /**
   * Update the total display for an ability in the modal
   * @param {string} ability The ability key
   * @protected
   */
  _updateAbilityTotal(ability) {
    const modal = this.element.querySelector('#abilities-edit-modal');
    if (!modal) return;
    
    const abilityData = this.document.system.abilities[ability];
    // Usar totalBonus que inclui bônus manual + bônus de armas
    const total = (abilityData.value || 0) + (abilityData.totalBonus || 0);
    
    // Find the total element for this specific ability
    const abilityRow = modal.querySelector(`.ability-edit-row`);
    const abilityRows = modal.querySelectorAll('.ability-edit-row');
    
    abilityRows.forEach(row => {
      const input = row.querySelector(`[data-ability="${ability}"]`);
      if (input) {
        const totalElement = row.querySelector('.ability-total');
        if (totalElement) {
          totalElement.textContent = total;
        }
      }
    });
  }

  /**
   * Sync main sheet ability inputs with modal values
   * @param {string} ability The ability key
   * @protected
   */
  _syncMainSheetAbilities(ability) {
    const abilityData = this.document.system.abilities[ability];
    
    // Update main sheet readonly inputs
    const valueInput = this.element.querySelector(`input[name="system.abilities.${ability}.value"]`);
    const bonusInput = this.element.querySelector(`input[name="system.abilities.${ability}.bonus"]`);
    
    if (valueInput) {
      valueInput.value = abilityData.value || 0;
    }
    
    if (bonusInput) {
      bonusInput.value = abilityData.bonus || 0;
    }
  }

  /**
   * Update derived stats based on ability changes
   * @param {string} changedAbility The ability that was changed
   * @protected
   */
  _updateDerivedStats(changedAbility) {
    const system = this.document.system;
    
    // Update Critical Hit when Dexterity changes
    if (changedAbility === 'dexterity') {
      const dexterity = system.abilities.dexterity.value || 0;
      const dexterityTotalBonus = system.abilities.dexterity.totalBonus || 0;
      const totalDexterity = dexterity + dexterityTotalBonus;
      const dexterityCriticalEffect = Math.floor(totalDexterity / 3);
      const newCriticalHit = Math.max(1, 20 - dexterityCriticalEffect);
      
      // Calculate movement: a cada 2 pontos de Destreza = +1 movimento
      const newMovement = Math.floor(totalDexterity / 2);
      
      const criticalHitInput = this.element.querySelector('input[name="system.details.criticalHit"]');
      if (criticalHitInput) {
        criticalHitInput.value = newCriticalHit;
      }
      
      // Update movement input
      const movementInput = this.element.querySelector('input[name="system.details.movement"]');
      if (movementInput) {
        movementInput.value = newMovement;
      }
      
      // Update the document silently
      this.document.update({
        'system.details.criticalHit': newCriticalHit,
        'system.details.movement': newMovement
      }, { render: false });
    }
    
    // Update Health/Energy maximums when Stamina changes
    if (changedAbility === 'stamina') {
      const stamina = system.abilities.stamina.value || 0;
      const staminaTotalBonus = system.abilities.stamina.totalBonus || 0;
      const totalStamina = stamina + staminaTotalBonus;
      
      // Calculate health and energy max
      const level = system.attributes?.level?.value ?? 0;
      const levelBonus = Math.min(level, 10) * 5;
      const fractureLevel = system.status?.fracture ?? 0;
      const fractureReduction = fractureLevel * 5;
      const healthBonus = system.status?.healthBonus ?? 0;
      const energyBonus = system.status?.energyBonus ?? 0;
      
      const newHealthMax = Math.max(0, 0 + (totalStamina * 5) + levelBonus - fractureReduction + healthBonus);
      const newEnergyMax = Math.max(0, 0 + (totalStamina * 5) + levelBonus - fractureReduction + energyBonus);
      
      // Update health max input
      const healthMaxInput = this.element.querySelector('input[name="system.health.max"]');
      if (healthMaxInput) {
        healthMaxInput.value = newHealthMax;
      }
      
      // Update energy max input
      const energyMaxInput = this.element.querySelector('input[name="system.power.max"]');
      if (energyMaxInput) {
        energyMaxInput.value = newEnergyMax;
      }
      
      // Update the document silently
      this.document.update({
        'system.health.max': newHealthMax,
        'system.power.max': newEnergyMax
      }, { render: false });
    }
    
    // Force recalculation of weapon skill bonuses for all abilities
    // This ensures weapon bonuses are properly recalculated and totalBonus is updated
    if (this.document.system._calculateWeaponSkillBonuses) {
      this.document.system._calculateWeaponSkillBonuses();
      
      // Update totalBonus input fields in the UI to reflect the new calculated values
      Object.keys(this.document.system.abilities).forEach(abilityKey => {
        const totalBonusInput = this.element.querySelector(`input[name="system.abilities.${abilityKey}.totalBonus"]`);
        if (totalBonusInput) {
          totalBonusInput.value = this.document.system.abilities[abilityKey].totalBonus || 0;
        }
      });
    }
  }

  /**
   * Disables inputs subject to active effects
   */
  #disableOverrides() {
    const flatOverrides = foundry.utils.flattenObject(this.actor.overrides);
    for (const override of Object.keys(flatOverrides)) {
      const input = this.element.querySelector(`[name="${override}"]`);
      if (input) {
        input.disabled = true;
      }
    }
  }
}
