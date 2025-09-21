const { api, sheets } = foundry.applications;
import ContextMenu5e from '../applications/context-menu.mjs';
import { ItemTypeSelectionDialog } from '../applications/item-type-selection-dialog.mjs';
import { HandSelectionDialog } from '../applications/hand-selection-dialog.mjs';

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
    
    // Track expanded sections for items (similar to D&D5e)
    this.expandedSections = new Map();
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
      createDocWithSelection: this._createDocWithSelection,
      editDoc: this._editDoc,
      deleteDoc: this._deleteDoc,
      toggleExpand: this._onToggleExpand,
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
      reloadAmmunition: this._onReloadAmmunition,
      attackWithWeapon: this._onAttackWithWeapon,
      equipWeapon: this._onEquipWeapon,
      unequipWeapon: this._onUnequipWeapon,
      equipArmor: this._onEquipArmor,
      unequipArmor: this._onUnequipArmor,
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
    backpack: {
      template: 'systems/cardigan/templates/actor/backpack.hbs',
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
        options.parts.push('features', 'backpack', 'spells', 'equipamentos');
        break;
      case 'npc':
        options.parts.push('backpack', 'equipamentos');
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
      case 'backpack':
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
        case 'backpack':
          tab.id = 'backpack';
          tab.label += 'Backpack';
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
    
    // Adicionar event listeners para campos dinâmicos de abilities
    this.#addAbilitiesListeners();
    
    // Clean up any existing tooltips before setting up new ones
    this.#cleanupTooltips();
    
    // Setup weapon tooltips with debug logging
    console.log('Setting up weapon tooltips...');
    this.#setupWeaponTooltips();
    
    // Setup armor tooltips with debug logging
    console.log('Setting up armor tooltips...');
    this.#setupArmorTooltips();
    
    // Setup context menu for weapons
    this.#setupContextMenus();
    
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
    const backpack = [];
    const features = [];
    const efeitos = [];
    const armas = [];
    const armaduras = [];
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

    console.log("=== PREPARE ITEMS DEBUG ===");
    console.log("Total items:", this.document.items.size);

    // Iterate through items, allocating to containers
    for (let i of this.document.items) {
      // Debug weapon items
      if (i.type === 'arma') {
        console.log(`Weapon: ${i.name}, equipped: ${i.system.equipped}, ID: ${i._id}`);
      }
      // Debug armor items
      if (i.type === 'armadura') {
        console.log(`Armor: ${i.name}, equipped: ${i.system.equipped}, type: ${i.system.armorType}, ID: ${i._id}`);
      }
      // Debug backpack items
      if (i.type === 'item-comum' || i.type === 'item-municao' || i.type === 'item-consumivel') {
        console.log(`Backpack Item: ${i.name}, type: ${i.type}, ID: ${i._id}`);
      }

      // Append to backpack.
      if (i.type === 'backpack' || i.type === 'item-comum' || i.type === 'item-municao' || i.type === 'item-consumivel') {
        backpack.push(i);
      }
      // Append to armas (weapons).
      else if (i.type === 'arma') {
        // Only equipped weapons go to armas table, unequipped ones go to backpack table
        if (i.system.equipped) {
          console.log(`  → Adding ${i.name} to ARMAS table (equipped: true)`);
          armas.push(i);
        } else {
          console.log(`  → Adding ${i.name} to BACKPACK table (equipped: false)`);
          // Unequipped weapons go to backpack table
          backpack.push(i);
        }
      }
      // Append to armaduras (armor).
      else if (i.type === 'armadura') {
        // Only equipped armors go to armaduras table, unequipped ones go to backpack table
        if (i.system.equipped) {
          console.log(`  → Adding ${i.name} to ARMADURAS table (equipped: true)`);
          armaduras.push(i);
        } else {
          console.log(`  → Adding ${i.name} to BACKPACK table (equipped: false)`);
          // Unequipped armors go to backpack table
          backpack.push(i);
        }
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

    console.log(`Final counts: backpack=${backpack.length}, armas=${armas.length}, armaduras=${armaduras.length}`);
    console.log("=== END PREPARE ITEMS DEBUG ===");

    for (const s of Object.values(spells)) {
      s.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    }

    // Sort armors by type order (Cabeça, Acessórios, Ombreiras, Torso, Braços, Pernas, Pés)
    const armorTypeOrder = {
      "cabeca": 1,
      "acessorios": 2,
      "ombreiras": 3,
      "torso": 4,
      "bracos": 5,
      "pernas": 6,
      "pes": 7
    };

    // Sort then assign
    context.backpack = backpack.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.features = features.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.efeitos = efeitos.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.armas = armas.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.armaduras = armaduras.sort((a, b) => {
      const orderA = armorTypeOrder[a.system.armorType] || 99;
      const orderB = armorTypeOrder[b.system.armorType] || 99;
      return orderA - orderB;
    });
    context.spells = spells;

    // Calculate armor totals for equipped armors
    this._calculateArmorTotals(context);
  }

  /**
   * Calculate totals from equipped armors for display purposes only
   * This method calculates totals to show in the UI but doesn't modify the actor's actual bonus fields
   * The actual bonuses are calculated in the actor's _calculateArmorBonuses method
   * @param {object} context - The context object
   * @private
   */
  _calculateArmorTotals(context) {
    let totalArmor = 0;
    let totalLifeBonus = 0;
    let totalEnergyBonus = 0;
    let totalMovementBonus = 0;

    // Calculate totals from equipped armors
    context.armaduras.forEach(armor => {
      // Armor protection
      totalArmor += armor.system.protecao || 0;
      
      // Life and energy bonuses
      totalLifeBonus += armor.system.bonusVida || 0;
      totalEnergyBonus += armor.system.bonusEnergia || 0;
      
      // Movement bonus (only if enabled)
      if (armor.system.bonusDeslocamento && armor.system.bonusDeslocamento.enabled) {
        totalMovementBonus += armor.system.bonusDeslocamento.bonus || 0;
      }
    });

    // Store totals in context for display/use only - DO NOT modify actor data
    context.armorTotals = {
      armor: totalArmor,
      life: totalLifeBonus,
      energy: totalEnergyBonus,
      movement: totalMovementBonus
    };

    // REMOVED: Do NOT modify the actor's status fields here!
    // The actor's _calculateArmorBonuses method handles all armor bonuses correctly
    // Modifying status fields here causes duplication in the max calculations

    // Log for debugging
    console.log(`[ARMOR TOTALS] Armor: ${totalArmor}, Life: ${totalLifeBonus}, Energy: ${totalEnergyBonus}, Movement: ${totalMovementBonus}`);
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
   * Handle creating a new item with type selection dialog
   *
   * @this CardiganSystemActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _createDocWithSelection(event, target) {
    try {
      // Show the item type selection dialog
      const result = await ItemTypeSelectionDialog.show(this.document);
      
      // Dialog handles item creation and sheet opening automatically
      console.log(`Created item of type ${result.type}:`, result.document);
      
    } catch (error) {
      if (error.message !== "Cancelled by user") {
        console.error("Error in item creation dialog:", error);
        ui.notifications.error("Failed to create item");
      }
    }
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
        style: CONST.CHAT_MESSAGE_STYLES.OTHER
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
   * Adiciona event listeners para o campo de teste
   * Implementa atualização em tempo real do valor calculado
   */
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
   * Handle reloading ammunition for firearms
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onReloadAmmunition(event, target) {
    event.preventDefault();
    
    const itemId = target.dataset.itemId;
    const item = this.document.items.get(itemId);
    
    if (!item || !item.system.isFirearm || !item.system.ranged) {
      ui.notifications.warn("Esta arma não pode ser recarregada.");
      return;
    }

    const currentAmmo = item.system.ammunition.current;
    const maxAmmo = item.system.ammunition.max;
    
    if (currentAmmo >= maxAmmo) {
      ui.notifications.info("Esta arma já está com munição cheia.");
      return;
    }

    // Criar dialog personalizado para entrada de munição
    const content = `
      <form>
        <div class="form-group">
          <label>${game.i18n.localize("CARDIGAN.ReloadPrompt")}</label>
          <div style="margin-bottom: 10px;">
            <strong>${game.i18n.localize("CARDIGAN.CurrentAmmunition")}: ${currentAmmo}/${maxAmmo}</strong>
          </div>
          <input type="number" name="reloadAmount" value="1" min="1" max="${maxAmmo - currentAmmo}" 
                 style="width: 100%; text-align: center;" />
        </div>
      </form>
    `;

    foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("CARDIGAN.ReloadAmmunition") },
      content,
      ok: {
        icon: "fas fa-sync-alt",
        label: game.i18n.localize("CARDIGAN.ReloadButton"),
        callback: async (event, button, dialog) => {
          const formData = new FormData(button.form);
          const reloadAmount = parseInt(formData.get("reloadAmount")) || 1;
          
          // Validar quantidade
          if (reloadAmount < 1 || reloadAmount > (maxAmmo - currentAmmo)) {
            ui.notifications.error(`Quantidade inválida. Máximo possível: ${maxAmmo - currentAmmo}`);
            return;
          }
          
          // Calcular novos valores
          const newCurrent = currentAmmo + reloadAmount;
          const newMax = maxAmmo - reloadAmount;
          
          try {
            await item.update({
              'system.ammunition.current': newCurrent,
              'system.ammunition.max': newMax
            });
            
            ui.notifications.info(`Recarregado ${reloadAmount} munições. Agora: ${newCurrent}/${newMax}`);
          } catch (error) {
            console.error("Error reloading ammunition:", error);
            ui.notifications.error(`Erro ao recarregar munição: ${error.message}`);
          }
        }
      },
      rejectClose: false,
      modal: true
    });
  }

  /**
   * Handle attacking with a weapon
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onAttackWithWeapon(event, target) {
    event.preventDefault();
    
    const itemId = target.dataset.itemId;
    const item = this.document.items.get(itemId);
    
    if (!item || (!item.system.rightHand && !item.system.leftHand)) {
      ui.notifications.warn(game.i18n.localize("CARDIGAN.WeaponNotEquipped"));
      return;
    }

    // Verificar durabilidade da arma
    if (item.system.durability.current <= 0) {
      ui.notifications.warn(game.i18n.localize("CARDIGAN.WeaponBroken"));
      return;
    }

    const actor = this.document;
    const accuracyValue = actor.system.abilities.accuracy.value || 0;
    const accuracyBonus = actor.system.abilities.accuracy.bonus || 0;
    const totalAccuracy = accuracyValue + accuracyBonus;

    // Verificar munição para armas à distância
    if (item.system.ranged && item.system.isFirearm) {
      if (item.system.ammunition.current <= 0) {
        ui.notifications.warn(`${item.name} ${game.i18n.localize("CARDIGAN.NoAmmunition")}`);
        return;
      }
    }

    // Fazer a rolagem de ataque (1d20 + Accuracy)
    const roll = new Roll("1d20 + @accuracy", { accuracy: totalAccuracy });
    await roll.evaluate();

    // Calcular dano total da arma
    let totalDamage = 0;
    let damageFormula = item.system.damage.value || "0";
    
    // Calcular dano base
    if (damageFormula && damageFormula !== "0" && !isNaN(parseInt(damageFormula))) {
      totalDamage = parseInt(damageFormula);
    }

    // Adicionar modificadores de atributos ao dano
    if (item.system.damage.useStrength) {
      totalDamage += actor.system.abilities.strength.value || 0;
    }
    
    if (item.system.damage.useDexterity) {
      totalDamage += actor.system.abilities.dexterity.value || 0;
    }

    // Consumir munição se for arma à distância de fogo
    if (item.system.ranged && item.system.isFirearm && item.system.ammunition.current > 0) {
      await item.update({
        'system.ammunition.current': item.system.ammunition.current - 1
      });
    }

    // Criar flavor text personalizado
    const flavor = `${game.i18n.localize("CARDIGAN.AttackWith")} ${item.name}`;

    // Enviar rolagem para o chat usando o método padrão do FoundryVTT
    const chatMessage = await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: flavor,
      rollMode: game.settings.get('core', 'rollMode')
    });

    // Criar conteúdo adicional para mostrar o dano total
    let additionalContent = `<div style="text-align: center; margin-top: 8px; padding: 4px 8px; background: rgba(0,0,0,0.1); border-radius: 3px;">
      <strong>${game.i18n.localize("CARDIGAN.DamageTotal")}: ${totalDamage}</strong>
    </div>`;

    // Adicionar informação de munição se aplicável
    if (item.system.ranged && item.system.isFirearm) {
      additionalContent += `<div style="text-align: center; margin-top: 4px; font-size: 12px; color: #666;">
        <i class="fas fa-bullet"></i> ${game.i18n.localize("CARDIGAN.AmmunitionConsumed")} (${item.system.ammunition.current}/${item.system.ammunition.max} ${game.i18n.localize("CARDIGAN.AmmunitionRemaining")})
      </div>`;
    }

    // Criar segunda mensagem com o dano total
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: additionalContent,
      rollMode: game.settings.get('core', 'rollMode')
    });

    return roll;
  }

  /**
   * Handle equipping a weapon from the backpack
   * @this CardiganSystemActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onEquipWeapon(event, target) {
    event.preventDefault();
    
    const itemId = target.dataset.itemId;
    const item = this.document.items.get(itemId);
    
    if (!item || item.type !== 'arma') {
      ui.notifications.warn("Item não encontrado ou não é uma arma.");
      return;
    }

    if (item.system.equipped) {
      ui.notifications.info("Esta arma já está equipada.");
      return;
    }

    try {
      // Import the HandSelectionDialog
      const { HandSelectionDialog } = await import('../applications/hand-selection-dialog.mjs');
      
      // Open dialog to select hand(s) - pass the item as parameter
      const selectedHand = await HandSelectionDialog.show(item);
      
      if (selectedHand === null) {
        // User cancelled the dialog
        return;
      }

      // Prepare update data based on selection
      const updateData = {
        "system.equipped": true,
        "system.rightHand": false,
        "system.leftHand": false
      };
      
      // Set hand assignments based on selection
      switch (selectedHand) {
        case "right":
          updateData["system.rightHand"] = true;
          break;
        case "left":
          updateData["system.leftHand"] = true;
          break;
        case "both":
          updateData["system.rightHand"] = true;
          updateData["system.leftHand"] = true;
          break;
      }

      await item.update(updateData);

      // Show success message based on hand selection
      const handText = selectedHand === "both" ? "ambas as mãos" : 
                      selectedHand === "right" ? "mão principal" : "mão secundária";
      ui.notifications.info(`${item.name} foi equipada em ${handText}.`);
      
      // Force re-render to update the tables
      await this.render(false);
    } catch (error) {
      console.error("Error equipping weapon:", error);
      ui.notifications.error("Erro ao equipar a arma.");
    }
  }

  /**
   * Handle unequipping a weapon to the backpack
   * @this CardiganSystemActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onUnequipWeapon(event, target) {
    event.preventDefault();
    
    const itemId = target.dataset.itemId;
    const item = this.document.items.get(itemId);
    
    if (!item || item.type !== 'arma') {
      ui.notifications.warn("Item não encontrado ou não é uma arma.");
      return;
    }

    if (!item.system.equipped) {
      ui.notifications.info("Esta arma já está desequipada.");
      return;
    }

    try {
      // Clear hand assignments when unequipping
      const updateData = {
        "system.equipped": false,
        "system.rightHand": false,
        "system.leftHand": false
      };
      
      await item.update(updateData);
      ui.notifications.info(`${item.name} foi desequipada e movida para a mochila.`);
      
      // Force re-render to update the tables
      await this.render(false);
    } catch (error) {
      console.error("Error unequipping weapon:", error);
      ui.notifications.error("Erro ao desequipar a arma.");
    }
  }

  /**
   * Handle equipping an armor from the backpack
   * @this CardiganSystemActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onEquipArmor(event, target) {
    event.preventDefault();
    
    const itemId = target.dataset.itemId;
    const item = this.document.items.get(itemId);
    
    if (!item || item.type !== 'armadura') {
      ui.notifications.warn("Item não encontrado ou não é uma armadura.");
      return;
    }

    if (item.system.equipped) {
      ui.notifications.info("Esta armadura já está equipada.");
      return;
    }

    try {
      // Simply equip the armor (no dialog needed like weapons)
      const updateData = {
        "system.equipped": true
      };

      await item.update(updateData);

      const armorTypeLabel = game.i18n.localize(`CARDIGAN.ArmorType.${item.system.armorType.charAt(0).toUpperCase() + item.system.armorType.slice(1)}`);
      ui.notifications.info(`${item.name} (${armorTypeLabel}) foi equipada.`);
      
      // Force re-render to update the tables
      await this.render(false);
    } catch (error) {
      console.error("Error equipping armor:", error);
      ui.notifications.error("Erro ao equipar a armadura.");
    }
  }

  /**
   * Handle unequipping an armor to the backpack
   * @this CardiganSystemActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onUnequipArmor(event, target) {
    event.preventDefault();
    
    const itemId = target.dataset.itemId;
    const item = this.document.items.get(itemId);
    
    if (!item || item.type !== 'armadura') {
      ui.notifications.warn("Item não encontrado ou não é uma armadura.");
      return;
    }

    if (!item.system.equipped) {
      ui.notifications.info("Esta armadura já está desequipada.");
      return;
    }

    try {
      const updateData = {
        "system.equipped": false
      };
      
      await item.update(updateData);
      ui.notifications.info(`${item.name} foi desequipada e movida para a mochila.`);
      
      // Force re-render to update the tables
      await this.render(false);
    } catch (error) {
      console.error("Error unequipping armor:", error);
      ui.notifications.error("Erro ao desequipar a armadura.");
    }
  }

  /**
   * Handle toggling the expand/collapse state of an item via context menu
   * @param {Item} item - The item to expand/collapse
   * @param {HTMLElement} itemContainer - The item container element
   * @private
   */
  async _handleToggleExpand(item, itemContainer) {
    if (!item || !itemContainer) {
      console.warn("Could not find item or item container for expand toggle");
      return;
    }
    
    const summary = itemContainer.querySelector(":scope > .item-description > .wrapper");
    const itemId = item.id;
    
    if (!summary) {
      console.warn("Could not find summary wrapper");
      return;
    }
    
    const expanded = this.expandedSections.get(itemId);
    const isArmor = item.type === 'armadura';
    const summaryClass = isArmor ? ".armor-summary" : ".weapon-summary";
    
    if (expanded) {
      // Collapse
      this.expandedSections.set(itemId, false);
      summary.querySelector(summaryClass)?.remove();
    } else {
      // Expand
      try {
        // Get item data for summary
        const context = {
          item: item,
          system: item.system,
          enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description || "", {
            secrets: item.isOwner,
            documents: true,
            links: true,
            rolls: true,
            rollData: item.getRollData?.() || {}
          })
        };
        
        // Choose template based on item type
        const template = isArmor 
          ? "systems/cardigan/templates/armors/armor-summary.hbs"
          : "systems/cardigan/templates/weapons/weapon-summary.hbs";
        
        const content = await foundry.applications.handlebars.renderTemplate(template, context);
        summary.insertAdjacentHTML("beforeend", content);
        this.expandedSections.set(itemId, true);
      } catch (error) {
        console.error(`Error creating ${isArmor ? 'armor' : 'weapon'} summary:`, error);
        return;
      }
    }
    
    // Update CSS classes
    itemContainer.classList.toggle("collapsed", expanded);
  }

  /**
   * Handle toggling the expand/collapse state of an item
   * Based on D&D5e implementation
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onToggleExpand(event, target) {
    event.preventDefault();
    
    const icon = target.querySelector(":scope > i");
    const row = target.closest("[data-uuid]") || target.closest("[data-item-id]");
    
    if (!row) {
      console.warn("Could not find item row for expand toggle");
      return;
    }
    
    const summary = row.querySelector(":scope > .item-description > .wrapper");
    const itemId = row.dataset.itemId;
    const item = this.document.items.get(itemId);
    
    if (!item || !summary) {
      console.warn("Could not find item or summary wrapper");
      return;
    }
    
    const expanded = this.expandedSections.get(itemId);
    const isArmor = item.type === 'armadura';
    const summaryClass = isArmor ? ".armor-summary" : ".weapon-summary";
    
    if (expanded) {
      // Collapse
      this.expandedSections.set(itemId, false);
      summary.querySelector(summaryClass)?.remove();
    } else {
      // Expand
      try {
        // Get item data for summary
        const context = {
          item: item,
          system: item.system,
          enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description || "", {
            secrets: item.isOwner,
            documents: true,
            links: true,
            rolls: true,
            rollData: item.getRollData?.() || {}
          })
        };
        
        // Choose template based on item type
        const template = isArmor 
          ? "systems/cardigan/templates/armors/armor-summary.hbs"
          : "systems/cardigan/templates/weapons/weapon-summary.hbs";
        
        const content = await foundry.applications.handlebars.renderTemplate(template, context);
        summary.insertAdjacentHTML("beforeend", content);
        this.expandedSections.set(itemId, true);
      } catch (error) {
        console.error("Error creating weapon summary:", error);
        return;
      }
    }
    
    // Update CSS classes
    row.classList.toggle("collapsed", expanded);
    
    // Update icon and tooltip only if we have an icon (from button, not from weapon name click)
    if (icon) {
      icon.classList.toggle("fa-compress", !expanded);
      icon.classList.toggle("fa-expand", expanded);
      target.setAttribute("data-tooltip", !expanded ? "Colapsar Detalhes" : "Expandir Detalhes");
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

  /**
   * Clean up any existing custom tooltips
   * @private
   */
  #cleanupTooltips() {
    // Remove all custom tooltips
    const existingTooltips = document.querySelectorAll('.cardigan-custom-tooltip');
    existingTooltips.forEach(tooltip => tooltip.remove());
    
    // Try to deactivate any active native tooltips
    try {
      if (game.tooltip && typeof game.tooltip.deactivate === 'function') {
        game.tooltip.deactivate();
      }
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Setup weapon name hover tooltips using native FoundryVTT system
   * @private
   */
  #setupWeaponTooltips() {
    const weaponNameElements = this.element.querySelectorAll('.weapon-name-hover');
    
    weaponNameElements.forEach(nameElement => {
      const weaponElement = nameElement.closest('[data-item-id]');
      if (!weaponElement) return;
      
      const itemId = weaponElement.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (!item || item.type !== 'arma') return;
      
      // Remove any existing title attribute to prevent browser tooltip interference
      nameElement.removeAttribute('title');
      
      // Setup hover event handlers
      nameElement.addEventListener('mouseenter', (event) => {
        const tooltipHTML = this.#generateWeaponTooltipHTML(item);
        
        // Use native FoundryVTT tooltip system
        try {
          if (game.tooltip && typeof game.tooltip.activate === 'function') {
            game.tooltip.activate(nameElement, {
              html: tooltipHTML,
              cssClass: 'tooltip cardigan-tooltip'
            });
          }
        } catch (error) {
          console.warn('Failed to show weapon tooltip:', error);
        }
      });
      
      nameElement.addEventListener('mouseleave', (event) => {
        // Deactivate native tooltip
        try {
          if (game.tooltip && typeof game.tooltip.deactivate === 'function') {
            game.tooltip.deactivate();
          }
        } catch (error) {
          // Silent fail
        }
      });
    });

    // Setup weapon image click handlers
    const weaponImageElements = this.element.querySelectorAll('.weapon-image-click');
    
    weaponImageElements.forEach(imageElement => {
      const itemId = imageElement.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (!item || item.type !== 'arma') return;
      
      imageElement.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Show weapon information in chat
        this._showWeaponInChat(item);
      });
    });
  }

  /**
   * Generate weapon tooltip HTML content
   * @param {Object} weapon - Weapon item object
   * @returns {string} - HTML string for weapon tooltip
   * @private
   */
  #generateWeaponTooltipHTML(weapon) {
    // Generate weapon type icons
    let typeIcons = '';
    if (weapon.system.melee && weapon.system.ranged) {
      typeIcons = '<i class="fas fa-fist-raised"></i><span class="separator">/</span><i class="fas fa-bullseye"></i>';
    } else if (weapon.system.melee) {
      typeIcons = '<i class="fas fa-fist-raised"></i>';
    } else if (weapon.system.ranged) {
      typeIcons = '<i class="fas fa-bullseye"></i>';
    } else {
      typeIcons = '<i class="fas fa-question" style="opacity: 0.5;"></i>';
    }
    
    // Generate weight info
    const weightText = weapon.system.weight === 'leve' ? 'Leve' : 'Pesado';
    
    // Build complete tooltip HTML - Simplified approach with inline styles
    let html = '<div class="weapon-tooltip" style="display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 200px; padding: 10px; background: rgba(0, 0, 0, 0.9); border-radius: 8px; color: #f0f0e0;">';
    
    // PRIMEIRO: Propriedades à direita usando inline styles para garantir funcionamento
    html += '<div class="weapon-properties-horizontal" style="display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin-bottom: 6px; font-size: 14px; width: 100%;">';
    html += `${typeIcons}`;
    html += '<span class="property-separator">&nbsp;</span>'; // Espaço em branco ao invés do bullet
    html += '<i class="fas fa-backpack" style="color: #c9c7b8; font-size: 14px;"></i>';
    html += `<span class="weight-text" style="font-style: italic; font-size: 14px; color: #c9c7b8;">${weightText}</span>`;
    html += '</div>';
    
    // SEGUNDO: Imagem da arma centralizada
    html += `<div class="weapon-image" style="display: flex; justify-content: center; margin-bottom: 4px;"><img src="${weapon.img}" alt="${weapon.name}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; border: 2px solid #f0f0e0;" /></div>`;
    
    // TERCEIRO: Nome da arma centralizado
    html += `<div class="weapon-name-line" style="text-align: center; margin-bottom: 4px;"><strong style="color: #f0f0e0; font-size: 16px;">${weapon.name}</strong></div>`;

    // QUARTO: Tipo da arma centralizado (se houver)
    if (weapon.system.weaponType && weapon.system.weaponType.trim() !== '') {
      html += `<div class="weapon-type-line" style="text-align: center; margin-bottom: 4px;"><em style="color: #c9c7b8; font-style: italic; font-size: 14px;">${weapon.system.weaponType}</em></div>`;
    }

    // QUINTO: Estatísticas na mesma linha - Dano, Proteção e Munição
    const baseDamage = weapon.system.damage.value || '0';
    const totalDamage = weapon.system.damage.total || baseDamage;
    const currentAmmo = weapon.system.ammunition?.current || 0;
    const maxAmmo = weapon.system.ammunition?.max || 0;
    const isRanged = weapon.system.ranged;
    const isFirearm = weapon.system.isFirearm;

    // Sempre mostra dano (todas as armas têm dano)
    let damageAmmoHtml = '<div class="weapon-damage-ammo" style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 4px; font-size: 14px;">';
    
    // Ícone de espada + dano base + [dano calculado]
    damageAmmoHtml += '<i class="fas fa-sword" style="color: #c9c7b8; font-size: 14px;"></i>';
    damageAmmoHtml += `<span style="color: #f0f0e0;">${baseDamage}</span>`;
    damageAmmoHtml += `<span style="color: #c9c7b8;">[${totalDamage}]</span>`;
    
    // Proteção (se habilitada) - adiciona na mesma linha
    if (weapon.system.protection?.enabled && weapon.system.protection?.value > 0) {
      // Dois espaços de separação
      damageAmmoHtml += '<span>&nbsp;&nbsp;</span>';
      
      // Ícone de escudo
      damageAmmoHtml += '<i class="fas fa-shield-alt" style="color: #c9c7b8; font-size: 14px;"></i>';
      
      // Valor de proteção
      damageAmmoHtml += `<span style="color: #f0f0e0;">${weapon.system.protection.value}</span>`;
    }
    
    // Munição (apenas para armas ranged)
    if (isRanged && currentAmmo > 0) {
      // Dois espaços de separação
      damageAmmoHtml += '<span>&nbsp;&nbsp;</span>';
      
      // Ícone de munição
      damageAmmoHtml += '<i class="fas fa-circle" style="color: #c9c7b8; font-size: 14px;"></i>';
      
      // Formato da munição baseado se é firearm ou não
      if (isFirearm && maxAmmo > 0) {
        // Firearms mostram atual/máximo
        damageAmmoHtml += `<span style="color: #f0f0e0;">${currentAmmo}/${maxAmmo}</span>`;
      } else {
        // Ranged não-firearms mostram apenas atual
        damageAmmoHtml += `<span style="color: #f0f0e0;">${currentAmmo}</span>`;
      }
    }
    
    damageAmmoHtml += '</div>';
    html += damageAmmoHtml;

    // SÉTIMO: Durabilidade (se houver)
    const currentDurability = weapon.system.durability?.current;
    const maxDurability = weapon.system.durability?.max;
    
    if (currentDurability !== undefined && maxDurability !== undefined && maxDurability > 0) {
      let durabilityHtml = '<div class="weapon-durability" style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 4px; font-size: 14px;">';
      
      // Ícone de forja/martelo
      durabilityHtml += '<i class="fas fa-hammer" style="color: #c9c7b8; font-size: 14px;"></i>';
      
      // Durabilidade atual/máxima
      durabilityHtml += `<span style="color: #f0f0e0;">${currentDurability}/${maxDurability}</span>`;
      
      durabilityHtml += '</div>';
      html += durabilityHtml;
    }

    // OITAVO: Descrição centralizada (se houver)
    if (weapon.system.description) {
      html += `<div class="weapon-description" style="text-align: center; max-width: 180px; margin-top: 4px;"><em style="color: #c9c7b8; font-style: italic; font-size: 12px;">${weapon.system.description}</em></div>`;
    }

    // OITAVO: Artefato Mágico alinhado à esquerda (se for artefato)
    if (weapon.system.magicalArtifact) {
      html += `<div class="weapon-artifact" style="text-align: left; margin-top: 4px; color: #c9c7b8;">◆  🌀Artefato</div>`;
    }

    // NONO: Propriedades das armas alinhadas à esquerda (se houver propriedades)
    if (weapon.system.properties && weapon.system.properties.length > 0) {
      // Filtra propriedades vazias e capitaliza primeira letra de cada palavra
      const validProperties = weapon.system.properties
        .filter(prop => prop && prop.trim() !== '')
        .map(prop => {
          let cleanProp = prop.trim();
          
          // Corrige propriedades conhecidas que estão sem espaços
          const propertyFixes = {
            'disparodividido': 'disparo dividido',
            'dosedupla': 'dose dupla', 
            'queimaroupa': 'queima-roupa',
            'saquerapido': 'saque rapido'
          };
          
          const lowerProp = cleanProp.toLowerCase();
          if (propertyFixes[lowerProp]) {
            cleanProp = propertyFixes[lowerProp];
          }
          
          // Divide em palavras, capitaliza cada uma e junta novamente
          return cleanProp
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        });
      
      if (validProperties.length > 0) {
        const propertiesText = validProperties.join(' ・ ');
        html += `<div class="weapon-properties-list" style="text-align: left; margin-top: 4px; color: #c9c7b8;">◆  ${propertiesText}</div>`;
      }
    }

    // DÉCIMO PRIMEIRO: Bônus de Perícia das armas alinhados à esquerda (se houver bônus)
    if (weapon.system.skillBonuses && weapon.system.skillBonuses.length > 0) {
      // Mapeamento das habilidades para seus nomes completos
      const abilityNames = {
        'accuracy': 'Accuracy',
        'evasion': 'Evasion', 
        'strength': 'Strength',
        'dexterity': 'Dexterity',
        'stamina': 'Stamina',
        'stealth': 'Stealth',
        'persuasion': 'Persuasion',
        'intelligence': 'Intelligence',
        'psionics': 'Psionics'
      };

      // Filtra e formata os bônus de perícia válidos
      const validBonuses = weapon.system.skillBonuses
        .filter(bonus => bonus && bonus.skill && bonus.bonus != null && bonus.bonus !== 0)
        .map(bonus => {
          // Usa o nome completo da habilidade ou capitaliza se não encontrado
          const skillName = abilityNames[bonus.skill.toLowerCase()] || 
                            bonus.skill.charAt(0).toUpperCase() + bonus.skill.slice(1).toLowerCase();
          const bonusValue = bonus.bonus > 0 ? `+${bonus.bonus}` : bonus.bonus.toString();
          return `${skillName} [${bonusValue}]`;
        });
      
      if (validBonuses.length > 0) {
        const bonusesText = validBonuses.join(' ・ ');
        html += `<div class="weapon-skill-bonuses" style="text-align: left; margin-top: 4px; color: #c9c7b8;">◆  ${bonusesText}</div>`;
      }
    }
    
    html += '</div>';
    
    return html;
  }

  /* -------------------------------------------- */
  /*  Context Menu Implementation                 */
  /* -------------------------------------------- */

  /**
   * Setup tooltips for armors
   * @private
   */
  #setupArmorTooltips() {
    // Select all armor name elements (.armor-name-hover) in the armor section
    const armorSection = this.element.querySelector('.equipamentos');
    if (!armorSection) return;
    
    const armorNameElements = armorSection.querySelectorAll('.armor-name-hover');
    
    armorNameElements.forEach(nameElement => {
      const itemRow = nameElement.closest('.item[data-item-id]');
      const itemId = itemRow.dataset.itemId;
      const item = this.document.items.get(itemId);
      
      if (item && item.type === 'armadura') {
        // Remove any existing tooltip event listeners
        nameElement.removeEventListener('mouseenter', this._onArmorMouseEnter);
        nameElement.removeEventListener('mouseleave', this._onArmorMouseLeave);
        
        // Add new event listeners
        nameElement.addEventListener('mouseenter', (event) => this._onArmorMouseEnter(event, item));
        nameElement.addEventListener('mouseleave', this._onArmorMouseLeave.bind(this));
      }
    });
  }

  /**
   * Handle mouse enter for armor tooltip
   * @private
   */
  _onArmorMouseEnter(event, armor) {
    const tooltipHTML = this.#generateArmorTooltipHTML(armor);
    
    game.tooltip.activate(event.currentTarget, {
      html: tooltipHTML,
      cssClass: "tooltip cardigan-tooltip"
    });
  }

  /**
   * Handle mouse leave for armor tooltip
   * @private
   */
  _onArmorMouseLeave(event) {
    game.tooltip.deactivate();
  }

  /**
   * Generate HTML for armor tooltip
   * @private
   */
  #generateArmorTooltipHTML(armor) {
    // Generate weight info
    const weightText = armor.system.weight === 'leve' ? 'Leve' : 'Pesado';
    
    // Build complete tooltip HTML - Simplified approach with inline styles
    let html = '<div class="armor-tooltip" style="display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 200px; padding: 10px; background: rgba(0, 0, 0, 0.9); border-radius: 8px; color: #f0f0e0;">';
    
    // PRIMEIRO: Propriedades à direita usando inline styles para garantir funcionamento
    html += '<div class="armor-properties-horizontal" style="display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin-bottom: 6px; font-size: 14px; width: 100%;">';
    
    // Mostrar ícone de resistência ao frio apenas se estiver marcada
    if (armor.system.resistenciaFrio) {
      html += '<i class="fas fa-sun" style="color: #ffeb3b;"></i>';
      html += '<span class="property-separator">&nbsp;</span>';
    }
    
    html += '<i class="fas fa-backpack" style="color: #c9c7b8; font-size: 14px;"></i>';
    html += `<span class="weight-text" style="font-style: italic; font-size: 14px; color: #c9c7b8;">${weightText}</span>`;
    html += '</div>';
    
    // SEGUNDO: Imagem da armadura centralizada
    html += `<div class="armor-image" style="display: flex; justify-content: center; margin-bottom: 4px;"><img src="${armor.img}" alt="${armor.name}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; border: 2px solid #f0f0e0;" /></div>`;
    
    // TERCEIRO: Nome da armadura centralizado
    html += `<div class="armor-name-line" style="text-align: center; margin-bottom: 4px;"><strong style="color: #f0f0e0; font-size: 16px;">${armor.name}</strong></div>`;

    // QUARTO: Tipo da armadura centralizado (se houver)
    if (armor.system.armorClass && armor.system.armorClass.trim() !== '') {
      html += `<div class="armor-type-line" style="text-align: center; margin-bottom: 4px;"><em style="color: #c9c7b8; font-style: italic; font-size: 14px;">${armor.system.armorClass}</em></div>`;
    }

    // QUINTO: Proteção
    const baseProtection = armor.system.protecao || 0;
    // As armaduras não têm proteção total calculada como as armas têm damage.total
    // então usamos apenas o valor base
    const totalProtection = baseProtection;

    let protectionHtml = '<div class="armor-protection" style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 4px; font-size: 14px;">';
    
    // Ícone de escudo + proteção base
    protectionHtml += '<i class="fas fa-shield-alt" style="color: #c9c7b8; font-size: 14px;"></i>';
    protectionHtml += `<span style="color: #f0f0e0;">${baseProtection}</span>`;
    protectionHtml += '</div>';
    html += protectionHtml;

    // SEXTO: Durabilidade (se houver)
    const currentDurability = armor.system.durability?.current;
    const maxDurability = armor.system.durability?.max;
    
    if (currentDurability !== undefined && maxDurability !== undefined && maxDurability > 0) {
      let durabilityHtml = '<div class="armor-durability" style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 4px; font-size: 14px;">';
      
      // Ícone de forja/martelo
      durabilityHtml += '<i class="fas fa-hammer" style="color: #c9c7b8; font-size: 14px;"></i>';
      
      // Durabilidade atual/máxima
      durabilityHtml += `<span style="color: #f0f0e0;">${currentDurability}/${maxDurability}</span>`;
      
      durabilityHtml += '</div>';
      html += durabilityHtml;
    }

    // SÉTIMO: Descrição centralizada (se houver)
    if (armor.system.description) {
      html += `<div class="armor-description" style="text-align: center; max-width: 180px; margin-top: 4px;"><em style="color: #c9c7b8; font-style: italic; font-size: 12px;">${armor.system.description}</em></div>`;
    }

    // OITAVO: Artefato Mágico alinhado à esquerda (se for artefato)
    if (armor.system.magicalArtifact) {
      html += `<div class="armor-artifact" style="text-align: left; margin-top: 4px; color: #c9c7b8;">◆  🌀Artefato</div>`;
    }

    // NONO: Bônus de Atributos (Vida, Energia, Deslocamento) alinhados à esquerda (se houver)
    const bonusVida = armor.system.bonusVida || 0;
    const bonusEnergia = armor.system.bonusEnergia || 0;
    const bonusDeslocamento = armor.system.bonusDeslocamento?.enabled ? (armor.system.bonusDeslocamento.bonus || 0) : 0;
    
    // Cada bônus em linha separada com ícone próprio
    if (bonusVida !== 0) {
      const vidaText = bonusVida > 0 ? `+${bonusVida}` : bonusVida.toString();
      html += `<div class="armor-vida-bonus" style="text-align: left; margin-top: 4px; color: #c9c7b8;">◆ ❤️Vida [${vidaText}]</div>`;
    }
    
    if (bonusEnergia !== 0) {
      const energiaText = bonusEnergia > 0 ? `+${bonusEnergia}` : bonusEnergia.toString();
      html += `<div class="armor-energia-bonus" style="text-align: left; margin-top: 4px; color: #c9c7b8;">◆ ⚡️Energia [${energiaText}]</div>`;
    }
    
    if (bonusDeslocamento !== 0) {
      const deslocamentoText = bonusDeslocamento > 0 ? `+${bonusDeslocamento}` : bonusDeslocamento.toString();
      html += `<div class="armor-deslocamento-bonus" style="text-align: left; margin-top: 4px; color: #c9c7b8;">◆ 👣Deslocamento [${deslocamentoText}]</div>`;
    }

    // DÉCIMO: Bônus de Perícia das armaduras alinhados à esquerda (se houver bônus)
    if (armor.system.skillBonuses && armor.system.skillBonuses.length > 0) {
      // Mapeamento das habilidades para seus nomes completos
      const abilityNames = {
        'accuracy': 'Accuracy',
        'evasion': 'Evasion', 
        'strength': 'Strength',
        'dexterity': 'Dexterity',
        'stamina': 'Stamina',
        'stealth': 'Stealth',
        'persuasion': 'Persuasion',
        'intelligence': 'Intelligence',
        'psionics': 'Psionics'
      };

      // Filtra e formata os bônus de perícia válidos
      const validBonuses = armor.system.skillBonuses
        .filter(bonus => bonus && bonus.skill && bonus.bonus != null && bonus.bonus !== 0)
        .map(bonus => {
          // Usa o nome completo da habilidade ou capitaliza se não encontrado
          const skillName = abilityNames[bonus.skill.toLowerCase()] || 
                            bonus.skill.charAt(0).toUpperCase() + bonus.skill.slice(1).toLowerCase();
          const bonusValue = bonus.bonus > 0 ? `+${bonus.bonus}` : bonus.bonus.toString();
          return `${skillName} [${bonusValue}]`;
        });
      
      if (validBonuses.length > 0) {
        const bonusesText = validBonuses.join(' ・ ');
        html += `<div class="armor-skill-bonuses" style="text-align: left; margin-top: 4px; color: #c9c7b8;">◆  ${bonusesText}</div>`;
      }
    }
    
    html += '</div>';
    
    return html;
  }

  /**
   * Setup context menus for weapons
   * @private
   */
  #setupContextMenus() {
    // Clear any existing context menu event listeners to prevent duplicates
    for (const control of this.element.querySelectorAll("[data-context-menu]")) {
      // Remove existing listener if any
      control.removeEventListener("click", ContextMenu5e.triggerEvent);
      // Add the listener
      control.addEventListener("click", ContextMenu5e.triggerEvent);
    }

    // Setup context menu for weapon items
    new ContextMenu5e(this.element, "[data-item-id]", [], {
      onOpen: this._onOpenContextMenu.bind(this),
      jQuery: false
    });
  }

  /**
   * Handle opening the context menu for items
   * @param {HTMLElement} element - The element that triggered the context menu
   * @private
   */
  _onOpenContextMenu(element) {
    const { itemId } = element.closest("[data-item-id]")?.dataset ?? {};
    const item = this.actor.items.get(itemId);
    if (!item) return;

    ui.context.menuItems = this._getContextOptions(item, element);
  }

  /**
   * Show weapon information in chat
   * @param {Item} weapon - The weapon item to show
   * @returns {Promise<ChatMessage>} The created chat message
   * @private
   */
  async _showWeaponInChat(weapon) {
    // Reuse the existing tooltip HTML generation function
    const weaponHtml = this.#generateWeaponTooltipHTML(weapon);
    
    // Create chat message with weapon information
    const messageData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      content: `<div class="weapon-chat-display" style="background: linear-gradient(135deg, #2c2c2c, #1a1a1a); border: 2px solid #c9c7b8; border-radius: 8px; padding: 12px; margin: 8px 0; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
        <div style="text-align: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #c9c7b8;">
          <h3 style="margin: 0; color: #f0f0e0; font-size: 16px;">
            <i class="fas fa-sword" style="margin-right: 6px; color: #c9c7b8;"></i>
            Informações da Arma
          </h3>
        </div>
        ${weaponHtml}
      </div>`,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER
    };

    return ChatMessage.create(messageData);
  }

  /**
   * Show armor information in chat
   * @param {Item} armor - The armor item to show
   * @returns {Promise<ChatMessage>} The created chat message
   * @private
   */
  async _showArmorInChat(armor) {
    // Reuse the existing tooltip HTML generation function
    const armorHtml = this.#generateArmorTooltipHTML(armor);
    
    // Create chat message with armor information
    const messageData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      content: `<div class="armor-chat-display" style="background: linear-gradient(135deg, #2c2c2c, #1a1a1a); border: 2px solid #c9c7b8; border-radius: 8px; padding: 12px; margin: 8px 0; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
        <div style="text-align: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #c9c7b8;">
          <h3 style="margin: 0; color: #f0f0e0; font-size: 16px;">
            <i class="fas fa-shield-alt" style="margin-right: 6px; color: #c9c7b8;"></i>
            Informações da Armadura
          </h3>
        </div>
        ${armorHtml}
      </div>`,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER
    };

    return ChatMessage.create(messageData);
  }

  /**
   * Get context menu options for a weapon item
   * @param {Item} item - The item
   * @param {HTMLElement} element - The triggering element
   * @returns {Array} Array of context menu options
   * @private
   */
  _getContextOptions(item, element) {
    const options = [];
    
    // Get the item container to check if it's expanded
    const itemContainer = element.closest('.item.collapsible');
    const isExpanded = itemContainer && !itemContainer.classList.contains('collapsed');

    // Expand/Collapse option (first in the menu) - only for weapons in weapons table
    if (item.type === "arma" && item.system.equipped) {
      options.push({
        name: isExpanded ? "Recolher" : "Expandir",
        icon: isExpanded ? '<i class="fa-solid fa-compress fa-fw"></i>' : '<i class="fa-solid fa-expand fa-fw"></i>',
        condition: () => true,
        callback: li => this._onAction(li, "toggleExpand", item, itemContainer)
      });
    }

    // Edit option
    options.push({
      name: "Editar",
      icon: '<i class="fa-solid fa-pen-to-square fa-fw"></i>',
      condition: () => item.isOwner,
      callback: li => this._onAction(li, "edit", item)
    });

    // Equip/Unequip option for weapons
    if (item.type === "arma") {
      if (item.system.equipped) {
        // Show Unequip option for equipped weapons
        options.push({
          name: game.i18n.localize("CARDIGAN.UnequipWeapon"),
          icon: '<i class="fa-solid fa-shield fa-fw"></i>',
          condition: () => item.isOwner,
          callback: li => this._onAction(li, "unequip", item)
        });
      } else {
        // Show Equip option for unequipped weapons
        options.push({
          name: game.i18n.localize("CARDIGAN.EquipWeapon"),
          icon: '<i class="fa-solid fa-hand-fist fa-fw"></i>',
          condition: () => item.isOwner,
          callback: li => this._onAction(li, "equip", item)
        });
      }
    }

    // Equip/Unequip option for armors
    if (item.type === "armadura") {
      if (item.system.equipped) {
        // Show Unequip option for equipped armors
        options.push({
          name: game.i18n.localize("CARDIGAN.UnequipArmor"),
          icon: '<i class="fa-solid fa-shield-slash fa-fw"></i>',
          condition: () => item.isOwner,
          callback: li => this._onAction(li, "unequipArmor", item)
        });
      } else {
        // Show Equip option for unequipped armors
        options.push({
          name: game.i18n.localize("CARDIGAN.EquipArmor"),
          icon: '<i class="fa-solid fa-shield fa-fw"></i>',
          condition: () => item.isOwner,
          callback: li => this._onAction(li, "equipArmor", item)
        });
      }
    }

    // Show in Chat option for weapons and armors
    if (item.type === "arma") {
      options.push({
        name: "Mostrar no Chat",
        icon: '<i class="fa-solid fa-comment-dots fa-fw"></i>',
        condition: () => item.type === "arma", // Only for weapons
        callback: li => this._onAction(li, "showInChat", item)
      });
    }

    // Show in Chat option for armors
    if (item.type === "armadura") {
      options.push({
        name: "Mostrar no Chat",
        icon: '<i class="fa-solid fa-comment-dots fa-fw"></i>',
        condition: () => item.type === "armadura", // Only for armors
        callback: li => this._onAction(li, "showInChat", item)
      });
    }

    // Delete option
    options.push({
      name: "Excluir",
      icon: '<i class="fa-solid fa-trash fa-fw"></i>',
      condition: () => item.isOwner,
      callback: li => this._onAction(li, "delete", item)
    });

    return options;
  }

  /**
   * Handle context menu actions
   * @param {HTMLElement} target - The action target
   * @param {string} action - The action to perform
   * @param {Item} item - The item to act on
   * @param {HTMLElement} itemContainer - The item container element (for expand/collapse)
   * @private
   */
  async _onAction(target, action, item, itemContainer = null) {
    switch (action) {
      case "toggleExpand":
        // Use the existing expand logic but with the itemContainer passed from context menu
        return this._handleToggleExpand(item, itemContainer);
      case "edit":
        return item.sheet.render(true);
      case "equip":
        // Equip weapon (move from backpack table to weapons table)
        return this._equipWeapon(item);
      case "unequip":
        // Show confirmation dialog before unequipping
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          title: game.i18n.localize("CARDIGAN.ConfirmUnequipWeapon"),
          content: `<p>Tem certeza que deseja desequipar <strong>"${item.name}"</strong>?</p><p><em>${game.i18n.localize("CARDIGAN.ConfirmUnequipDescription")}</em></p>`,
          yes: () => true,
          no: () => false,
          defaultYes: false
        });
        
        if (confirmed) {
          return this._unequipWeapon(item);
        }
        return null;
      case "equipArmor":
        // Equip armor (move from backpack table to armor table)
        return this._equipArmor(item);
      case "unequipArmor":
        // Show confirmation dialog before unequipping armor
        const armorConfirmed = await foundry.applications.api.DialogV2.confirm({
          title: game.i18n.localize("CARDIGAN.ConfirmUnequipArmor"),
          content: `<p>Tem certeza que deseja desequipar <strong>"${item.name}"</strong>?</p><p><em>${game.i18n.localize("CARDIGAN.ConfirmUnequipArmorDescription")}</em></p>`,
          yes: () => true,
          no: () => false,
          defaultYes: false
        });
        
        if (armorConfirmed) {
          return this._unequipArmor(item);
        }
        return null;
      case "showInChat":
        // Handle both weapons and armors
        if (item.type === "arma") {
          return this._showWeaponInChat(item);
        } else if (item.type === "armadura") {
          return this._showArmorInChat(item);
        }
        return null;
      case "delete":
        // Show confirmation dialog before deleting
        const deleteConfirmed = await foundry.applications.api.DialogV2.confirm({
          title: `Excluir ${item.name}?`,
          content: `<p>Tem certeza que deseja excluir <strong>"${item.name}"</strong>?</p><p><em>Esta ação não pode ser desfeita.</em></p>`,
          yes: () => true,
          no: () => false,
          defaultYes: false
        });
        
        if (deleteConfirmed) {
          return item.delete();
        }
        return null;
    }
  }

  /**
   * Equip a weapon (move from backpack table to weapons table)
   * @param {Item} weapon - The weapon to equip
   * @private
   */
  async _equipWeapon(weapon) {
    if (weapon.type !== "arma") return;

    try {
      console.log("=== EQUIP DEBUG ===");
      console.log("Equipando arma:", weapon.name);
      console.log("Status ANTES do update:", weapon.system.equipped);
      console.log("Weapon ID:", weapon._id);
      console.log("Weapon data before:", weapon.system);
      
      // Show hand selection dialog
      const selectedHand = await HandSelectionDialog.show(weapon);
      
      if (selectedHand === null) {
        console.log("User cancelled hand selection");
        return; // User cancelled
      }
      
      console.log("User selected hand:", selectedHand);
      
      // Prepare update data based on selection
      const updateData = {
        "system.equipped": true,
        "system.rightHand": false,
        "system.leftHand": false
      };
      
      // Set hand assignments based on selection
      switch (selectedHand) {
        case "right":
          updateData["system.rightHand"] = true;
          break;
        case "left":
          updateData["system.leftHand"] = true;
          break;
        case "both":
          updateData["system.rightHand"] = true;
          updateData["system.leftHand"] = true;
          break;
      }
      
      console.log("Update data:", updateData);
      
      const result = await weapon.update(updateData);
      console.log("Update result:", result);
      
      // Get fresh weapon data after update
      const updatedWeapon = this.document.items.get(weapon._id);
      console.log("Status DEPOIS do update:", updatedWeapon?.system.equipped);
      console.log("Right hand:", updatedWeapon?.system.rightHand);
      console.log("Left hand:", updatedWeapon?.system.leftHand);
      console.log("Weapon data after:", updatedWeapon?.system);
      console.log("=== END EQUIP DEBUG ===");
      
      // Show success message based on hand selection
      const handText = selectedHand === "both" ? "ambas as mãos" : 
                      selectedHand === "right" ? "mão primária" : "mão secundária";
      ui.notifications.info(`${weapon.name} foi equipada na ${handText}.`);
      
      // Force re-render to update the tables
      await this.render(false);
    } catch (error) {
      console.error("Error equipping weapon:", error);
      ui.notifications.error("Erro ao equipar a arma.");
    }
  }

  /**
   * Unequip a weapon (move from weapons table to backpack table)
   * @param {Item} weapon - The weapon to unequip
   * @private
   */
  async _unequipWeapon(weapon) {
    if (weapon.type !== "arma") return;

    try {
      console.log("Desequipando arma:", weapon.name, "Status atual:", weapon.system.equipped);
      
      // Clear hand assignments when unequipping
      const updateData = {
        "system.equipped": false,
        "system.rightHand": false,
        "system.leftHand": false
      };
      
      await weapon.update(updateData);
      console.log("Arma desequipada:", weapon.name, "Novo status:", weapon.system.equipped);
      ui.notifications.info(`${weapon.name} foi desequipada e movida para a mochila.`);
      
      // Force re-render to update the tables
      await this.render(false);
    } catch (error) {
      console.error("Error unequipping weapon:", error);
      ui.notifications.error("Erro ao desequipar a arma.");
    }
  }

  /**
   * Equip an armor (move from backpack table to armor table)
   * @param {Item} armor - The armor to equip
   * @private
   */
  async _equipArmor(armor) {
    if (armor.type !== "armadura") return;

    try {
      console.log("=== EQUIP ARMOR DEBUG ===");
      console.log("Equipando armadura:", armor.name);
      console.log("Status ANTES do update:", armor.system.equipped);
      console.log("Armor ID:", armor._id);
      console.log("Armor type:", armor.system.armorType);
      
      const updateData = {
        "system.equipped": true
      };
      
      console.log("Update data:", updateData);
      
      const result = await armor.update(updateData);
      console.log("Update result:", result);
      
      // Get fresh armor data after update
      const updatedArmor = this.document.items.get(armor._id);
      console.log("Status DEPOIS do update:", updatedArmor?.system.equipped);
      console.log("=== END EQUIP ARMOR DEBUG ===");
      
      const armorTypeLabel = game.i18n.localize(`CARDIGAN.ArmorType.${armor.system.armorType.charAt(0).toUpperCase() + armor.system.armorType.slice(1)}`);
      ui.notifications.info(`${armor.name} (${armorTypeLabel}) foi equipada.`);
      
      // Force re-render to update the tables
      await this.render(false);
    } catch (error) {
      console.error("Error equipping armor:", error);
      ui.notifications.error("Erro ao equipar a armadura.");
    }
  }

  /**
   * Unequip an armor (move from armor table to backpack table)
   * @param {Item} armor - The armor to unequip
   * @private
   */
  async _unequipArmor(armor) {
    if (armor.type !== "armadura") return;

    try {
      console.log("Desequipando armadura:", armor.name, "Status atual:", armor.system.equipped);
      
      const updateData = {
        "system.equipped": false
      };
      
      await armor.update(updateData);
      console.log("Armadura desequipada:", armor.name, "Novo status:", armor.system.equipped);
      ui.notifications.info(`${armor.name} foi desequipada e movida para a mochila.`);
      
      // Force re-render to update the tables
      await this.render(false);
    } catch (error) {
      console.error("Error unequipping armor:", error);
      ui.notifications.error("Erro ao desequipar a armadura.");
    }
  }

  /**
   * Adicionar event listeners para campos dinâmicos de abilities
   * Implementa o padrão Dynamic Base + Manual Field
   * @private
   */
  #addAbilitiesListeners() {
    const dynamicFields = this.element.querySelectorAll('.dynamic-field');
    
    dynamicFields.forEach(field => {
      const ability = field.dataset.ability;
      const fieldType = field.dataset.field; // 'value' ou 'totalBonus'
      
      // Event listener para focus (mostrar valor manual)
      field.addEventListener('focus', (event) => {
        this.#handleAbilityFieldFocus(event, ability, fieldType);
      });
      
      // Event listener para blur (calcular e mostrar total)
      field.addEventListener('blur', (event) => {
        this.#handleAbilityFieldBlur(event, ability, fieldType);
      });
    });
    
    console.log(`[CARDIGAN] Dynamic abilities listeners added to ${dynamicFields.length} fields`);
  }

  /**
   * Handler para quando o usuário clica em um campo de ability (focus)
   * @private
   */
  #handleAbilityFieldFocus(event, ability, fieldType) {
    const field = event.target;
    const abilityData = this.actor.system.abilities[ability];
    
    if (fieldType === 'value') {
      // Campo base - mostrar apenas o valor manual
      const manualValue = abilityData.manualValue || 0;
      field.value = manualValue === 0 ? '' : manualValue;
      field.dataset.manualValue = manualValue;
      
      console.log(`[ABILITY FOCUS] ${ability}.value - Manual: ${manualValue}`);
    } else if (fieldType === 'totalBonus') {
      // Campo bônus - mostrar apenas o bônus manual
      const manualBonus = abilityData.manualBonus || 0;
      field.value = manualBonus === 0 ? '' : manualBonus;
      field.dataset.manualBonus = manualBonus;
      
      console.log(`[ABILITY FOCUS] ${ability}.totalBonus - Manual: ${manualBonus}`);
    }
    
    field.select();
  }

  /**
   * Handler para quando o usuário sai de um campo de ability (blur)
   * @private
   */
  #handleAbilityFieldBlur(event, ability, fieldType) {
    const field = event.target;
    const userInput = Number(field.value) || 0;
    const abilityData = this.actor.system.abilities[ability];
    
    if (fieldType === 'value') {
      // Campo base - calcular total
      const baseValue = abilityData.baseValue || 0; // Valor padrão
      const totalValue = baseValue + userInput;
      
      field.value = totalValue;
      field.dataset.manualValue = userInput;
      
      // Salvar apenas o valor manual
      this.actor.update({
        [`system.abilities.${ability}.manualValue`]: userInput
      }).catch(error => {
        console.error(`[CARDIGAN] Erro ao atualizar ${ability}.manualValue:`, error);
      });
      
      console.log(`[ABILITY BLUR] ${ability}.value - Manual: ${userInput}, Total: ${totalValue}`);
    } else if (fieldType === 'totalBonus') {
      // Campo bônus - calcular total
      const calculatedBonus = abilityData.weaponBonus || 0;
      const totalBonus = calculatedBonus + userInput;
      
      field.value = totalBonus;
      field.dataset.manualBonus = userInput;
      
      // Salvar apenas o bônus manual
      this.actor.update({
        [`system.abilities.${ability}.manualBonus`]: userInput
      }).catch(error => {
        console.error(`[CARDIGAN] Erro ao atualizar ${ability}.manualBonus:`, error);
      });
      
      console.log(`[ABILITY BLUR] ${ability}.totalBonus - Manual: ${userInput}, Calculated: ${calculatedBonus}, Total: ${totalBonus}`);
    }
  }
}
