const { api, sheets } = foundry.applications;
import { ItemTypeSelectionDialog } from '../applications/item-type-selection-dialog.mjs';
import { RecipeCraftingDialog } from '../applications/recipe-crafting-dialog.mjs';
import EffectsCompendiumSelectionDialog from '../applications/effects-compendium-selection-dialog.mjs';
import { HeaderActions } from './actions/header-actions.mjs';
import { HeaderStatusActions } from './actions/header-status-actions.mjs';
import { HeaderListeners } from './listeners/header-listeners.mjs';
import { AbilitiesListeners } from './listeners/abilities-listeners.mjs';
import { EquipmentFieldListeners } from './listeners/equipment-field-listeners.mjs';
import { StatFieldListeners } from './listeners/stat-field-listeners.mjs';
import { ProficiencyListeners } from './listeners/proficiency-listeners.mjs';
import { EnhancementListeners } from './listeners/enhancement-listeners.mjs';
import { MiscListeners } from './listeners/misc-listeners.mjs';
import { ProficienciesActions } from './actions/proficiencies-actions.mjs';
import { MoneyTradeActions } from './actions/money-trade-actions.mjs';
import { InventoryActions } from './actions/inventory-actions.mjs';
import { AmmunitionActions } from './actions/ammunition-actions.mjs';
import { WeaponActions } from './actions/weapon-actions.mjs';
import { EquipmentActions } from './actions/equipment-actions.mjs';
import { ConsumableActions } from './actions/consumable-actions.mjs';
import { ProfessionFilterActions } from './actions/profession-filter-actions.mjs';
import { BackpackSearchActions } from './actions/backpack-search-actions.mjs';
import { SheetScrollActions } from './actions/sheet-scroll-actions.mjs';
import { ItemPrepareActions } from './actions/item-prepare-actions.mjs';
import { RecipeActions } from './actions/recipe-actions.mjs';
import { DragDropActions } from './actions/drag-drop-actions.mjs';
import { ContextMenuActions } from './actions/context-menu-actions.mjs';
import { WindowControlsListeners } from './listeners/window-controls-listeners.mjs';
import { OverridesListeners } from './listeners/overrides-listeners.mjs';
import { ItemExpand } from './parts/item-expand.mjs';
import { DeleteActions } from './actions/delete-actions.mjs';
import CardiganTooltipManager from '../tooltips/tooltip-manager.mjs';

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
    
    // Track expanded sections for items (similar to D&D5e)
    this.expandedSections = new Map();
    
    // Track profession filter state
    this.professionFilter = 'all';
    this.isProfessionFilterOpen = false;

    // Track backpack search UI state
    this.isBackpackSearchOpen = false;
    this.backpackSearch = '';

    // Track collapsed/expanded durability state for item rows
    this.durabilityExpandedItems = new Set();

    // Preserve scroll state across re-renders
    this._pendingScrollState = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['cardigan', 'actor'],
    position: {
      width: 526,
      height: 679,
    },
    window: {
      resizable: true,
      minimizable: true,
      controls: [
        {
          icon: 'fa-solid fa-cog',
          label: 'SHEETS.DefaultDocumentSheet',
          action: 'showSheetConfig'
        }
      ]
    },
    actions: {
      onEditImage: this._onEditImage,
      createDoc: this._createDoc,
      createDocWithSelection: this._createDocWithSelection,
      openEffectsSelection: this._openEffectsSelection,
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
      sendEffectToChat: this._onSendEffectToChat,
      skillToChat: this._onSkillToChat,

      rest: this._onRest,
      shortRest: this._onShortRest,
      longRest: this._onLongRest,

      attackWithWeapon: this._onAttackWithWeapon,
      manageAmmunition: this._onManageAmmunition,
      equipWeapon: this._onEquipWeapon,
      unequipWeapon: this._onUnequipWeapon,
      equipArmor: this._onEquipArmor,
      unequipArmor: this._onUnequipArmor,
      consumeItem: this._onConsumeItem,
      cookRecipe: this._onCookRecipe,
      craftFromRecipe: this._onCraftFromRecipe,
      filterProfession: this._onFilterProfession,
      initiateTrade: this._onInitiateTrade,
      openCharacterWizard: this._onOpenCharacterWizard,
      openLevelUpWizard: this._onOpenLevelUpWizard,
      toggleEffectsSection: this._toggleEffectsSection,
      toggleBackpackContainer: this._toggleBackpackContainer,
      toggleWeaponsTable: this._toggleWeaponsTable,
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
    proficiencies: {
      template: 'systems/cardigan/templates/actor/proficiencies.hbs',
    },
    biography: {
      template: 'systems/cardigan/templates/actor/biography.hbs',
    },
    skills: {
      template: 'systems/cardigan/templates/actor/skills.hbs',
    },
    equipment: {
      template: 'systems/cardigan/templates/actor/equipment.hbs',
    },
    professions: {
      template: 'systems/cardigan/templates/actor/professions.hbs',
    },
  };

  /** @override */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    // Not all parts always render
    options.parts = ['header', 'tabs', 'proficiencies']; // Perícias como padrão
    // Don't show the other tabs if only limited view
    if (this.document.limited) return;
    // Control which parts show based on document subtype
    switch (this.document.type) {
      case 'character':
        options.parts.push('equipment', 'skills', 'professions', 'biography');
        break;
      case 'npc':
        options.parts.push('equipment', 'skills', 'biography');
        break;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    
    // Add decorative left frame to the window frame (persists through minimize/maximize)
    const existingLeftFrame = frame.querySelector('.moldura-esquerda-overlay');
    if (!existingLeftFrame) {
      const leftFrame = document.createElement('img');
      leftFrame.className = 'moldura-esquerda-overlay';
      leftFrame.src = 'systems/cardigan/assets/images/decorative/left-frame.webp';
      leftFrame.alt = 'Moldura Esquerda';
      
      // Insert at the beginning of the frame
      frame.insertBefore(leftFrame, frame.firstChild);
    }
    
    // Add decorative right frame to the window frame (persists through minimize/maximize)
    const existingRightFrame = frame.querySelector('.moldura-direita-overlay');
    if (!existingRightFrame) {
      const rightFrame = document.createElement('img');
      rightFrame.className = 'moldura-direita-overlay';
      rightFrame.src = 'systems/cardigan/assets/images/decorative/right-frame.webp';
      rightFrame.alt = 'Moldura Direita';
      
      // Insert after left frame
      frame.insertBefore(rightFrame, frame.children[1]);
    }
    
    return frame;
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
      // Check if current user is GM
      isGM: game.user.isGM,
    };



    // Offloading context prep to a helper function
    ItemPrepareActions.prepareItems(this, context);
    
    // Add profession filter state to context
    ProfessionFilterActions.addToContext(this, context);
    BackpackSearchActions.addToContext(this, context);
    
    // Filter ActiveEffects to hide those that duplicate Item efeitos
    // This prevents duplicate display in the effects list while keeping the ActiveEffect
    // active for token icon display
    context.filteredEffects = Array.from(this.actor.effects).filter(effect => {
      // Check if there's an Item with the same name
      const hasDuplicateItem = context.efeitos?.some(item => item.name === effect.name);
      // Only show ActiveEffects that don't have a duplicate Item
      return !hasDuplicateItem;
    });

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context) {
    switch (partId) {
      case 'proficiencies':
        context.tab = context.tabs[partId];
        break;
      case 'skills':
      case 'equipment':
      case 'professions':
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
    if (!this.tabGroups[tabGroup]) this.tabGroups[tabGroup] = 'proficiencies';
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
        case 'proficiencies':
          tab.id = 'proficiencies';
          tab.label += 'Proficiencies';
          break;
        case 'equipment':
          tab.id = 'equipment';
          tab.label += 'Equipment';
          break;
        case 'skills':
          tab.id = 'skills';
          tab.label += 'Skills';
          break;
        case 'professions':
          tab.id = 'professions';
          tab.label += 'Professions';
          break;
        case 'biography':
          tab.id = 'biography';
          tab.label += 'Biography';
          break;
        default:
          // Unknown part, skip it
          return tabs;
      }
      if (this.tabGroups[tabGroup] === tab.id) tab.cssClass = 'active';
      tabs[partId] = tab;
      return tabs;
    }, {});
  }

  /** @override */
  render(options = {}) {
    SheetScrollActions.captureBeforeRender(this);
    return super.render(options);
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
    
    // Adicionar event listeners do header (status, critical hit, movement)
    HeaderListeners.initialize(this.element, this.actor);

    // Limitar XP atual entre 0 e 100 durante a digitação
    StatFieldListeners.addExperienceListeners(this.element);
    
    // Adicionar event listeners para campos de durabilidade
    EquipmentFieldListeners.addDurabilityListeners(this.element, this.actor, this);
    EquipmentFieldListeners.restoreDurabilityVisibility(this.element, this);

    // Adicionar event listeners para campos de quantidade
    EquipmentFieldListeners.addQuantityListeners(this.element, this.actor);
    EquipmentFieldListeners.syncQuantityInputWidths(this.element);

    // Adicionar event listeners para campos de munição
    EquipmentFieldListeners.addAmmunitionListeners(this.element, this.actor);
    
    // Adicionar event listeners para campos dinâmicos de abilities
    AbilitiesListeners.initialize(this.element, this.actor);
    
    // Adicionar event listeners para rolagem nas perícias (Accuracy, Evasion, etc.)
    ProficiencyListeners.addProficiencyRollListeners(this.element, this);
    
    // Adicionar event listeners para campos dinâmicos de bonus
    StatFieldListeners.addBonusFieldsListeners(this.element, this.actor);
    
    // Adicionar tooltips ricos de proficiências
    CardiganTooltipManager.attachProficiencyTooltips(this.element, this.actor);
    
    // Adicionar tooltips ricos de efeitos
    CardiganTooltipManager.attachEffectTooltips(this.element, this.actor);
    
    // NOTE: Profession table toggles are handled automatically by Foundry's form system
    // The checkboxes update system.details.show*Table which triggers a re-render
    // No manual event listeners needed
    
    // Adicionar event listeners para checkboxes de aprimoramentos de skills
    EnhancementListeners.addEnhancementCheckboxListeners(this.element, this.actor, this);
    
    // Adicionar event listeners para campos dinâmicos de valores atuais
    StatFieldListeners.addValueFieldsListeners(this.element, this.actor);
    
    // Ajustar font-size do input name baseado no número de caracteres
    MiscListeners.setupNameInputFontSize(this.element, this);

    // Ajustar font-size do input de XP para 3 dígitos
    StatFieldListeners.setupExperienceInputFontSize(this.element);
    
    // Prevenir submit do formulário ao pressionar Enter em inputs
    MiscListeners.preventEnterSubmit(this.element);
    
    // Setup context menu for weapons
    this.#setupContextMenu();
    
    // Setup custom window controls (includes drag functionality)
    this.#setupCustomControls();

    // Setup backpack profession filter toggle persistence
    ProfessionFilterActions.bindFilterToggleListener(this, this.element);

    // Setup backpack search toggle and live filtering
    BackpackSearchActions.bindSearchListeners(this, this.element);
    BackpackSearchActions.applySearchFilter(this, this.element);
    
    // Setup minimized window header drag and double-click
    this.#setupMinimizedHeader();

    // Restore previous scroll position after all post-render bindings.
    SheetScrollActions.restoreAfterRender(this);
    
    // You may want to add other special handling here
    // Foundry comes with a large number of utility classes, e.g. SearchFilter
    // That you may want to implement yourself.
  }

  /**
   * Organize and classify Items for Actor sheets.
   *
   * @param {object} context The context object to mutate
   * @deprecated Use ItemPrepareActions.prepareItems() instead
   */
  _prepareItems(context) {
    ItemPrepareActions.prepareItems(this, context);
  }


  /**
   * Add unarmed attack options for free hands
   * @param {Array} armas - The weapons array to modify
   * @deprecated Use ItemPrepareActions.addUnarmedAttacks() instead
   * @private
   */
  _addUnarmedAttacks(armas) {
    ItemPrepareActions.addUnarmedAttacks(this, armas);
  }


  /**
   * Create a virtual unarmed attack item
   * @param {string} handName - Name of the hand (e.g., "Mão Primária")
   * @param {number} strengthValue - Strength value for damage (dano = força)
   * @param {boolean} rightHand - Whether this is for right hand
   * @param {boolean} leftHand - Whether this is for left hand
   * @returns {object} Virtual weapon item
   * @deprecated Use ItemPrepareActions.createUnarmedAttack() instead
   * @private
   */
  _createUnarmedAttack(handName, strengthValue, rightHand, leftHand) {
    return ItemPrepareActions.createUnarmedAttack(strengthValue, rightHand, leftHand);
  }


  /**
   * Calculate totals from equipped armors for display purposes only
   * @param {object} context - The context object
   * @deprecated Use InventoryActions.calculateArmorTotals() instead
   * @private
   */
  _calculateArmorTotals(context) {
    InventoryActions.calculateArmorTotals(context);
  }


  /**
   * Calculate spaces occupied by a single item based on its weight and quantity
   * Implements Cardigan's backpack space rules:
   * - Leve: 0 spaces, but +1 space per 10 items accumulated
   * - Médio: 1 space each
   * - Pesado: 2 spaces each
   * - Muito Pesado: 4 spaces each
   * @param {string} weight - Item weight category
   * @param {number} quantity - Item quantity
   * @returns {number} Spaces occupied by this item
   * @private
   */
  _calculateItemSpaces(weight, quantity) {
    return InventoryActions.calculateItemSpaces(weight, quantity);
  }

  /**
   * Calculate total spaces occupied in backpack by all items
   * Only counts items that are in the backpack table (unequipped)
   * @param {Array} backpackItems - Array of items in the backpack
   * @returns {number} Total spaces occupied
   * @private
   */
  _calculateBackpackSpaces(backpackItems) {
    return InventoryActions.calculateBackpackSpaces(backpackItems, this.actor?.system?.money || 0);
  }

  /**
   * Check if there is enough space in the backpack to accommodate an item
   * @param {string} weight - Item weight category
   * @param {number} quantity - Item quantity
   * @returns {boolean} True if there's enough space
   * @private
   */
  _hasBackpackSpace(weight, quantity) {
    return InventoryActions.hasBackpackSpace(this.actor, this.context?.backpackSpacesOccupied || 0, weight, quantity);
  }

  /**
   * Calculate how much space would be needed if an equipped item was unequipped
   * @param {Object} item - The item to check
   * @returns {number} Spaces required for the item
   * @private
   */
  _getItemRequiredSpaces(item) {
    if (!item || !item.system) return 0;
    return InventoryActions.calculateItemSpaces(item.system.weight, item.system.quantity || 1);
  }

  /**
   * Check if an equipped item can be unequipped (has space in backpack)
   * @param {Object} item - The item to check
   * @returns {boolean} True if item can be unequipped
   * @private
   */
  _canUnequipItem(item) {
    return InventoryActions.canUnequipItem(this.actor, item);
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
    const fp = new foundry.applications.apps.FilePicker({
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
    return DeleteActions.deleteDoc(this, event, target);
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
    
    // Set recipeType based on the recipe name for item-recipe type
    if (target.dataset.type === 'item-recipe' && target.dataset.name) {
      const name = target.dataset.name.toLowerCase();
      if (name.includes('culinary')) {
        createData.system = { recipeType: 'culinary' };
      } else if (name.includes('tailoring')) {
        createData.system = { recipeType: 'tailoring' };
      } else if (name.includes('tecnomagic')) {
        createData.system = { recipeType: 'tecnomagic' };
      } else if (name.includes('blacksmithing')) {
        createData.system = { recipeType: 'blacksmithing' };
      } else if (name.includes('alchemy')) {
        createData.system = { recipeType: 'alchemy' };
      }
    }
    
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
      // Check if backpack is full before allowing item creation
      const currentSpaces = this.context?.backpackSpacesOccupied || 0;
      const maxSpaces = this.document.system.backpack.max;
      
      if (currentSpaces >= maxSpaces) {
        ui.notifications.warn("Mochila cheia! Não é possível adicionar novos itens. Equipe ou remova alguns itens primeiro.");
        return;
      }
      
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
   * Open effects compendium selection dialog
   *
   * @this CardiganSystemActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @private
   */
  static async _openEffectsSelection(event, target) {
    event.preventDefault();
    await EffectsCompendiumSelectionDialog.show(this.document);
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
   * Toggle the effects section visibility
   *
   * @this CardiganSystemActorSheet
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _toggleEffectsSection(event, target) {
    const checkbox = target.closest('.effects-toggle').querySelector('input[name="system.details.showEffectsTab"]');
    const currentValue = checkbox.checked;
    await this.actor.update({ 'system.details.showEffectsTab': !currentValue });
  }

  static async _toggleBackpackContainer(event, target) {
    return InventoryActions.onToggleBackpackContainer(event, target, this);
  }

  static async _toggleWeaponsTable(event, target) {
    return InventoryActions.onToggleWeaponsTable(event, target, this);
  }

  // ========================================
  // HEADER STATUS/ROLLS ACTIONS (delegated to HeaderStatusActions module)
  // ========================================

  /**
   * Handle generic roll - delegates to HeaderStatusActions
   */
  static async _onRoll(event, target) {
    return HeaderStatusActions.onRoll(event, target, this);
  }

  /**
   * Handle death die roll - delegates to HeaderStatusActions
   */
  static async _onRollDeathDie(event, target) {
    return HeaderStatusActions.onRollDeathDie(event, target, this);
  }

  /**
   * Handle reset gift of life - delegates to HeaderStatusActions
   */
  static async _onResetGiftOfLife(event, target) {
    return HeaderStatusActions.onResetGiftOfLife(event, target, this);
  }

  /**
   * Handle reset death sentence - delegates to HeaderStatusActions
   */
  static async _onResetDeathSentence(event, target) {
    return HeaderStatusActions.onResetDeathSentence(event, target, this);
  }

  /**
   * Handle reset sanity - delegates to HeaderStatusActions
   */
  static async _onResetSanity(event, target) {
    return HeaderStatusActions.onResetSanity(event, target, this);
  }

  /**
   * Handle reset toxicity - delegates to HeaderStatusActions
   */
  static async _onResetToxicity(event, target) {
    return HeaderStatusActions.onResetToxicity(event, target, this);
  }

  /**
   * Handle reset fracture - delegates to HeaderStatusActions
   */
  static async _onResetFracture(event, target) {
    return HeaderStatusActions.onResetFracture(event, target, this);
  }

  /**
   * Handle reset hunger - delegates to HeaderStatusActions
   */
  static async _onResetHunger(event, target) {
    return HeaderStatusActions.onResetHunger(event, target, this);
  }

  /**
   * Handle reset thirst - delegates to HeaderStatusActions
   */
  static async _onResetThirst(event, target) {
    return HeaderStatusActions.onResetThirst(event, target, this);
  }

  /**
   * Handle showing effect information in chat - delegates to ProficienciesActions
   */
  static async _onShowEffectInChat(event, target) {
    return ProficienciesActions.onShowEffectInChat(event, target, this);
  }

  /**
   * Handle sending effect to chat when clicking image - delegates to ProficienciesActions
   */
  static async _onSendEffectToChat(event, target) {
    return ProficienciesActions.onSendEffectToChat(event, target, this);
  }

  /**
   * Show skill description in chat - delegates to ProficienciesActions
   */
  static async _onSkillToChat(event, target) {
    return ProficienciesActions.onSkillToChat(event, target, this);
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

  _canDragStart(selector) {
    return DragDropActions.canDragStart(this);
  }

  _canDragDrop(selector) {
    return DragDropActions.canDragDrop(this);
  }

  _onDragStart(event) {
    return DragDropActions.onDragStart(event, this.actor);
  }

  _onDragOver(event) {}

  async _onDrop(event) {
    return DragDropActions.onDrop(event, this.actor, this);
  }

  async _onDropActiveEffect(event, data) {
    return DragDropActions.onDropActiveEffect(event, data, this.actor);
  }

  async _onDropActor(event, data) {
    return DragDropActions.onDropActor(event, data, this.actor);
  }

  async _onDropItem(event, data) {
    return DragDropActions.onDropItem(event, data, this.actor);
  }

  async _onDropFolder(event, data) {
    return DragDropActions.onDropFolder(event, data, this.actor);
  }

  async _onDropItemCreate(itemData, event) {
    return DragDropActions.onDropItemCreate(itemData, event, this.actor);
  }

  _onSortItem(event, item) {
    return DragDropActions.onSortItem(event, item, this.actor);
  }

  #createDragDropHandlers() {
    return DragDropActions.createHandlers(this);
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

  /**
   * Handle managing ammunition for ranged weapons
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onManageAmmunition(event, target) {
    return AmmunitionActions.onManageAmmunition(event, target, this);
  }

  /**
   * Render ammunition dialog content
   * @param {Item} weapon - The weapon item
   * @returns {Promise<string>} The rendered HTML content
   */
  static async _renderAmmunitionContent(weapon) {
    return AmmunitionActions.renderAmmunitionContent(weapon, this);
  }

  /**
   * Setup listener for item changes to update ammunition dialog
   * @param {Item} weapon - The weapon item
   */
  static _setupAmmunitionDialogListener(weapon) {
    return AmmunitionActions.setupAmmunitionDialogListener(weapon, this);
  }

  /**
   * Load ammunition into weapon
   * @param {Item} weapon - The weapon to load ammunition into
   * @param {string} ammunitionId - The ID of the ammunition item
   * @param {number} amount - The amount to load
   */
  async _loadAmmunition(weapon, ammunitionId, amount) {
    return AmmunitionActions.loadAmmunition(weapon, ammunitionId, amount, this);
  }

  /**
   * Handle attacking with a weapon
   * @param {PointerEvent|Item} eventOrItem   The originating click event or weapon item
   * @param {HTMLElement|string} targetOrAmmoId   The capturing HTML element or specific ammunition ID
   * @protected
   */
  static async _onAttackWithWeapon(eventOrItem, targetOrAmmoId) {
    return WeaponActions.onAttackWithWeapon(eventOrItem, targetOrAmmoId, this);
  }

  /**
   * Perform a single attack roll with damage calculation
   * @param {Item} item - The weapon item being used
   * @param {Actor} actor - The actor performing the attack
   * @param {string} rollType - Type of roll (normal, advantage, etc.)
   * @param {string} attackMode - Attack mode (individual or conjunto)
   * @param {Array} targetTokens - Array of target tokens for this attack
   * @param {string|null} specificAmmoId - Specific ammunition ID if selected
   * @param {number} manualModifier - Manual modifier to add to the roll
   * @private
   */
  static async _performSingleAttack(item, actor, rollType, attackMode, targetTokens, specificAmmoId, manualModifier = 0) {
    return WeaponActions.performSingleAttack(item, actor, rollType, attackMode, targetTokens, specificAmmoId, this, manualModifier);
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
    return EquipmentActions.onEquipWeapon(event, target, this);
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
    return EquipmentActions.onUnequipWeapon(event, target, this);
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
    return EquipmentActions.onEquipArmor(event, target, this);
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
    return EquipmentActions.onUnequipArmor(event, target, this);
  }

  /**
   * Handle consuming a consumable item
   * @param {Event} event           The originating click event
   * @param {HTMLElement} target    The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onConsumeItem(event, target) {
    return ConsumableActions.onConsumeItem(event, target, this);
  }

  /**
   * Show dialog to select quantity to consume
   * @param {string} itemName - Name of the item
   * @param {number} maxQuantity - Maximum available quantity
   * @returns {Promise<number|null>} - Selected quantity or null if cancelled
   * @private
   */
  static async _showQuantityDialog(itemName, maxQuantity) {
    return ConsumableActions.showQuantityDialog(itemName, maxQuantity);
  }

  /**
   * Process the consumption of an item and apply effects using tracking system
   * @param {Item} item - The consumable item
   * @param {number} quantity - Quantity to consume
   * @private
   */
  async _processItemConsumption(item, quantity) {
    return ConsumableActions.processItemConsumption(item, quantity, this);
  }

  /**
   * Process a skill check for item consumption
   * @param {Item} item - The consumable item with skill check
   * @returns {Promise<Object|null>} - Roll result or null if failed
   * @private
   */
  async _processSkillCheck(item) {
    return ConsumableActions.processSkillCheck(item, this);
  }

  /**
   * Check if a roll resulted in a critical failure
   * @param {Roll} roll - The roll to check
   * @param {boolean} hasAdvantage - Whether the roll had advantage
   * @returns {boolean} Whether the roll is a critical failure
   * @private
   */
  _checkCriticalFailure(roll, hasAdvantage) {
    return ConsumableActions.checkCriticalFailure(roll, hasAdvantage);
  }

  /**
   * Check if a roll resulted in a critical hit (for all abilities)
   * @param {Roll} roll - The roll to check
   * @param {boolean} hasAdvantage - Whether the roll had advantage
   * @returns {boolean} Whether the roll is a critical hit
   * @private
   */
  _checkCriticalHit(roll, hasAdvantage) {
    return ConsumableActions.checkCriticalHit(roll, hasAdvantage);
  }

  /**
   * Process critical failure effects and skill losses
   * @param {Item} item - The item being used
   * @param {Roll} roll - The failed roll
   * @private
   */
  async _processCriticalFailure(item, roll) {
    return ConsumableActions.processCriticalFailure(item, roll, this);
  }

  /**
   * Apply a critical failure effect to the actor
   * @param {string} effectId - The ID of the effect to apply
   * @private
   */
  async _applyCriticalFailureEffect(effectId) {
    return ConsumableActions.applyCriticalFailureEffect(effectId, this);
  }

  /**
   * Apply skill loss from critical failure
   * @param {string} ability - The ability to reduce
   * @param {number} lossValue - The amount to reduce
   * @private
   */
  async _applyCriticalFailureSkillLoss(ability, lossValue) {
    return ConsumableActions.applyCriticalFailureSkillLoss(ability, lossValue, this);
  }

  /**
   * Process critical hit effects and skill bonuses
   * @param {Item} item - The item being used
   * @param {Roll} roll - The successful roll
   * @private
   */
  async _processCriticalHit(item, roll) {
    return ConsumableActions.processCriticalHit(item, roll, this);
  }

  /**
   * Apply a critical hit effect to the actor
   * @param {string} effectId - The ID of the effect to apply
   * @private
   */
  async _applyCriticalHitEffect(effectId) {
    return ConsumableActions.applyCriticalHitEffect(effectId, this);
  }

  /**
   * Apply skill bonus from critical hit
   * @param {string} ability - The ability to bonus
   * @param {number} bonusValue - The amount to add
   * @private
   */
  async _applyCriticalHitSkillBonus(ability, bonusValue) {
    return ConsumableActions.applyCriticalHitSkillBonus(ability, bonusValue, this);
  }

  /**
   * Apply skill bonuses directly to actor abilities
   * @param {Array} appliedSkillBonuses - Array of skill bonuses to apply
   * @private
   */
  async _applySkillBonuses(appliedSkillBonuses) {
    return ConsumableActions.applySkillBonuses(appliedSkillBonuses, this);
  }

  /**
   * Create a tracking effect item for consumed items
   * @param {Item} originalItem - The original consumed item
   * @param {string} rollType - Type of roll: 'normal', 'critical-failure', 'critical-hit'
   * @param {Array} appliedEffects - Array of effect IDs that were applied
   * @param {Array} appliedSkillBonuses - Array of skill bonuses that were applied
   * @private
   */
  async _createTrackingEffectItem(originalItem, rollType, appliedEffects = [], appliedSkillBonuses = [], appliedAttributeModifiers = []) {
    return ConsumableActions.createTrackingEffectItem(originalItem, rollType, appliedEffects, appliedSkillBonuses, appliedAttributeModifiers, this);
  }

  /**
   * Handle toggling the expand/collapse state of an item via context menu
   * @param {Item} item - The item to expand/collapse
   * @param {HTMLElement} itemContainer - The item container element
   * @private
   */
  async _handleToggleExpand(item, itemContainer) {
    return ItemExpand.handleToggleExpand(this, item, itemContainer);
  }

  /**
   * Refresh the expanded summary for an item without collapsing/expanding
   * Used when enhancement checkboxes change
   * @param {string} itemId - The ID of the item
   * @param {object} item - The item object
   * @private
   */
  async _refreshExpandedSummary(itemId, item) {
    return ItemExpand.refreshExpandedSummary(this, itemId, item);
  }

  /**
   * Handle toggling the expand/collapse state of an item
   * Based on D&D5e implementation
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onToggleExpand(event, target) {
    return ItemExpand.onToggleExpand(this, event, target);
  }

  /**
   * Disables inputs subject to active effects
   */
  #disableOverrides() {
    return OverridesListeners.disableOverrides(this);
  }

  /**
   * Setup context menu for items
   * @private
   */
  #setupContextMenu() {
    return ContextMenuActions.setupContextMenu(this);
  }

  /**
   * Setup custom window control buttons (toggle dropdown, close) and drag/minimize behaviour.
   * @private
   */
  #setupCustomControls() {
    return WindowControlsListeners.setupCustomControls(this);
  }

  /**
   * Setup drag and double-click functionality for the minimized window header.
   * @private
   */
  #setupMinimizedHeader() {
    return WindowControlsListeners.setupMinimizedHeader(this);
  }

  /**
   * Handle opening the context menu for items
   * @param {HTMLElement} element - The element that triggered the context menu
   * @private
   */
  _onOpenContextMenu(element) {
    return ContextMenuActions.onOpenContextMenu(element, this);
  }

  /**
   * Show weapon information in chat
   * @param {Item} weapon - The weapon item to show
   * @returns {Promise<ChatMessage>} The created chat message
   * @private
   */
  async _showWeaponInChat(weapon) {
    return ContextMenuActions.showWeaponInChat(weapon, this.document);
  }

  /**
   * Show armor information in chat
   * @param {Item} armor - The armor item to show
   * @returns {Promise<ChatMessage>} The created chat message
   * @private
   */
  async _showArmorInChat(armor) {
    return ContextMenuActions.showArmorInChat(armor, this.document);
  }

  /**
   * Get context menu options for a weapon item
   * @param {Item} item - The item
   * @param {HTMLElement} element - The triggering element
   * @returns {Array} Array of context menu options
   * @private
   */
  _getContextOptions(item, element) {
    return ContextMenuActions.getContextOptions(item, element, this);
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
    return ContextMenuActions.onAction(target, action, item, this, itemContainer);
  }

  static async _onCookRecipe(event, target) {
    console.log("[RECIPES] _onCookRecipe called!", event, target);
    event.preventDefault();
    const itemId = target.dataset.itemId;
    console.log("[RECIPES] Item ID:", itemId);
    const recipe = this.document.items.get(itemId);
    if (!recipe) {
      console.log("[RECIPES] No recipe found with ID:", itemId);
      return;
    }
    return RecipeActions.cookRecipe(this.document, recipe);
  }

  static _validateRecipeIngredients(recipe, actor, selectedResultIndex = null) {
    return RecipeActions.validateRecipeIngredients(recipe, actor, selectedResultIndex);
  }

  static async _consumeRecipeIngredients(recipe, actor, selectedResultIndex = null) {
    return RecipeActions.consumeRecipeIngredients(recipe, actor, selectedResultIndex);
  }

  static async _onCraftFromRecipe(event, target) {
    console.log("[CRAFTING] _onCraftFromRecipe called!", event, target);
    event.preventDefault();
    const itemId = target.dataset.recipeId;
    const recipeType = target.dataset.recipeType;
    console.log("[CRAFTING] Recipe ID:", itemId, "Type:", recipeType);
    const recipe = this.document.items.get(itemId);
    if (!recipe) {
      console.log("[CRAFTING] No recipe found with ID:", itemId);
      ui.notifications.error("Recipe not found!");
      return;
    }
    return RecipeActions.craftFromRecipe(this.document, recipe, recipeType);
  }

  /**
   * Handle profession filter change
   * @param {Event} event - The triggering event
   * @param {HTMLElement} target - The target element
   */
  static _onFilterProfession(event, target) {
    return ProfessionFilterActions.onFilterProfession(event, target, this);
  }

  /**
   * Detect critical results from a roll and return appropriate flags
   * @param {Roll} roll - The roll to analyze
   * @param {Object} actor - The actor who made the roll (optional, used for critical hit threshold)
   * @param {string} abilityKey - The ability key being rolled (optional, used for accuracy-specific logic)
   * @returns {Object} - Flags object for critical hit/failure, empty if no critical
   */
  static _detectCriticalResults(roll, actor = null, abilityKey = null) {
    return WeaponActions.detectCriticalResults(roll, actor, abilityKey);
  }

  /**
   * Process health modifier from consumable items
   * @param {Item} item The consumable item
   * @returns {Promise<Object|null>} Result object with message
   * @private
   */
  async _processHealthModifier(item) {
    return ConsumableActions.processHealthModifier(item, this);
  }

  /**
   * Process energy modifier from consumable items
   * @param {Item} item The consumable item
   * @returns {Promise<Object|null>} Result object with message
   * @private
   */
  async _processEnergyModifier(item) {
    return ConsumableActions.processEnergyModifier(item, this);
  }

  /**
   * Process armor bonus effects when consuming an item
   * @param {Item} item The consumable item being used
   * @returns {Promise<Object|null>} Result with message or null if error
   * @private
   */
  async _processArmorBonus(item) {
    return ConsumableActions.processArmorBonus(item, this);
  }

  /**
   * Process status ailments effects when consuming an item
   * @param {Item} item The consumable item being used
   * @returns {Promise<Object|null>} Result with message or null if error
   * @private
   */
  async _processStatusAilments(item) {
    return ConsumableActions.processStatusAilments(item, this);
  }

  /**
   * Process toxicity modifications for consumable items
   * @param {Item} item - The consumable item with toxicity modifiers
   * @returns {Object|null} Processing result with message
   */
  async _processToxicity(item) {
    return ConsumableActions.processToxicity(item, this);
  }

  /**
   * Process fracture modifications for consumable items
   * @param {Item} item - The consumable item with fracture modifiers
   * @returns {Object|null} Processing result with message
   */
  async _processFracture(item) {
    return ConsumableActions.processFracture(item, this);
  }

  /**
   * Process food modifications for consumable items
   * @param {Item} item - The consumable item with food modifiers
   * @returns {Object|null} Processing result with message
   */
  async _processFood(item) {
    return ConsumableActions.processFood(item, this);
  }

  /**
   * Process water modifications for consumable items
   * @param {Item} item - The consumable item with water modifiers
   * @returns {Object|null} Processing result with message
   */
  async _processWater(item) {
    return ConsumableActions.processWater(item, this);
  }

  /**
   * Process movement boost for consumable items
   * @param {Item} item - The consumable item with movement boost
   * @returns {Object|null} Processing result with message
   */
  async _processMovementBoost(item) {
    return ConsumableActions.processMovementBoost(item, this);
  }

  /**
   * Process critical hit boost for consumable items
   * @param {Item} item - The consumable item with critical hit boost
   * @returns {Object|null} Processing result with message
   */
  async _processCriticalHitBoost(item) {
    return ConsumableActions.processCriticalHitBoost(item, this);
  }

  // ========================================
  // HEADER ACTIONS (delegated to HeaderActions module)
  // ========================================

  /**
   * Handle rest button click - delegates to HeaderActions
   */
  static async _onRest(event, target) {
    return HeaderActions.onRest(event, target, this);
  }

  /**
   * Handle short rest action - delegates to HeaderActions
   */
  static async _onShortRest(event, target) {
    return HeaderActions.onShortRest(event, target, this);
  }

  /**
   * Handle long rest action - delegates to HeaderActions
   */
  static async _onLongRest(event, target) {
    return HeaderActions.onLongRest(event, target, this);
  }

  /**
   * Handle initiating trade - delegates to MoneyTradeActions
   */
  static async _onInitiateTrade(event, target) {
    return MoneyTradeActions.onInitiateTrade(event, target, this);
  }

  /**
   * Handle opening character wizard - delegates to HeaderActions
   */
  static async _onOpenCharacterWizard(event, target) {
    return HeaderActions.onOpenCharacterWizard(event, target, this);
  }

  /**
   * Handle opening level up wizard - delegates to HeaderActions
   */
  static async _onOpenLevelUpWizard(event, target) {
    return HeaderActions.onOpenLevelUpWizard(event, target, this);
  }

}
