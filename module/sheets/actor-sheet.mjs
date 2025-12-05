const { api, sheets } = foundry.applications;
import ContextMenu5e from '../applications/context-menu.mjs';
import { ItemTypeSelectionDialog } from '../applications/item-type-selection-dialog.mjs';
import { HandSelectionDialog } from '../applications/hand-selection-dialog.mjs';
import { RecipeCraftingDialog } from '../applications/recipe-crafting-dialog.mjs';
import { AdvantageSelectionDialog } from '../applications/advantage-selection-dialog.mjs';

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
    
    // Track profession filter state
    this.professionFilter = 'all';
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
      skillToChat: this._onSkillToChat,

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
    skills: {
      template: 'systems/cardigan/templates/actor/skills.hbs',
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
        options.parts.push('features', 'skills', 'spells', 'equipamentos');
        break;
      case 'npc':
        options.parts.push('skills', 'equipamentos');
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
    
    // Add profession filter state to context
    context.professionFilter = this.professionFilter || 'all';

    return context;
  }

  /** @override */
  async _preparePartContext(partId, context) {
    switch (partId) {
      case 'features':
        context.tab = context.tabs[partId];
        break;
      case 'spells':
      case 'skills':
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
        case 'skills':
          tab.id = 'skills';
          tab.label += 'Skills';
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
    
    // Adicionar event listeners para campos de quantidade
    this.#addQuantityListeners();
    
    // Adicionar event listeners para campos de munição
    this.#addAmmunitionListeners();
    
    // Adicionar event listeners para campos dinâmicos de abilities
    this.#addAbilitiesListeners();
    
    // Adicionar event listeners para campo dinâmico de critical hit
    this.#addCriticalHitListeners();
    
    // Adicionar event listeners para campo dinâmico de movement
    this.#addMovementListeners();
    
    // Adicionar event listeners para campos dinâmicos de bonus
    this.#addBonusFieldsListeners();
    
    // Adicionar event listeners para checkboxes das tabelas de profissão
    this.#addProfessionTableListeners();
    
    // Adicionar event listeners para checkboxes de aprimoramentos de skills
    this.#addEnhancementCheckboxListeners();
    
    // Adicionar event listeners para campos dinâmicos de valores atuais
    this.#addValueFieldsListeners();
    
    // Clean up any existing tooltips before setting up new ones
    this.#cleanupTooltips();
    
    // Setup weapon tooltips with debug logging
    console.log('Setting up weapon tooltips...');
    this.#setupWeaponTooltips();
    
    // Setup armor tooltips with debug logging
    console.log('Setting up armor tooltips...');
    this.#setupArmorTooltips();
    
    // Setup effect tooltips with enriched HTML
    this.#setupEffectTooltips();
    
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
    const recipes = [];
    const skills = [];
    const skillsAndarilho = [];
    const skillsGuerreiro = [];
    const skillsLadino = [];
    const skillsFeiticeiro = [];
    const skillsRaciais = [];
    const skillsUnicas = [];
    const culinaryRecipes = [];
    const tailoringRecipes = [];
    const tecnomagicRecipes = [];
    const blacksmithingRecipes = [];
    const alchemyRecipes = [];
    const carpentryRecipes = [];
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
      if (i.type === 'item-comum' || i.type === 'item-municao' || i.type === 'item-consumivel' || i.type === 'item-ingredient') {
        console.log(`Backpack Item: ${i.name}, type: ${i.type}, ID: ${i._id}`);
      }

      // Append to backpack.
      if (i.type === 'backpack' || i.type === 'item-comum' || i.type === 'item-municao' || i.type === 'item-consumivel' || i.type === 'item-ingredient') {
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
      // Append to skills.
      else if (i.type === 'skill') {
        skills.push(i);
        
        // Also categorize by skill class
        switch (i.system.skillClass) {
          case 'andarilho':
            skillsAndarilho.push(i);
            break;
          case 'guerreiro':
            skillsGuerreiro.push(i);
            break;
          case 'ladino':
            skillsLadino.push(i);
            break;
          case 'feiticeiro':
            skillsFeiticeiro.push(i);
            break;
          case 'raciais':
            skillsRaciais.push(i);
            break;
          case 'unicas':
            skillsUnicas.push(i);
            break;
        }
      }
      // Append to recipes by profession type using recipeType field.
      else if (i.type === 'item-recipe') {
        recipes.push(i);
        const recipeType = i.system.recipeType;
        if (recipeType === 'culinary' || recipeType === 'general') {
          culinaryRecipes.push(i);
        } else if (recipeType === 'tailoring') {
          tailoringRecipes.push(i);
        } else if (recipeType === 'tecnomagic') {
          tecnomagicRecipes.push(i);
        } else if (recipeType === 'blacksmithing') {
          blacksmithingRecipes.push(i);
        } else if (recipeType === 'alchemy') {
          alchemyRecipes.push(i);
        } else if (recipeType === 'carpentry') {
          carpentryRecipes.push(i);
        }
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

    // Add unarmed attacks for free hands
    this._addUnarmedAttacks(armas);

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
    let sortedBackpack = backpack.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    
    // Apply profession filter
    if (this.professionFilter && this.professionFilter !== 'all') {
      sortedBackpack = sortedBackpack.filter(item => {
        // Only filter items that have a profession field (ingredients, consumables, common items)
        if (item.system.profession) {
          return item.system.profession === this.professionFilter;
        }
        // Items without profession field (weapons, armor, etc) don't show in profession-specific filters
        return false;
      });
    } else if (this.professionFilter === 'all') {
      // "All Items" shows only items without profession field OR with profession set to "general"
      sortedBackpack = sortedBackpack.filter(item => {
        // Items without profession field always show (weapons, armor, ammunition, etc)
        if (!item.system.profession) {
          return true;
        }
        // Items with profession field only show if set to "general"
        return item.system.profession === 'general';
      });
    }
    
    context.backpack = sortedBackpack;
    context.features = features.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.efeitos = efeitos.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.recipes = recipes.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    
    // Find race item if exists
    context.raceItem = this.document.items.find(i => i.type === 'race') || null;
    
    context.skills = skills.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.skillsAndarilho = skillsAndarilho.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.skillsGuerreiro = skillsGuerreiro.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.skillsLadino = skillsLadino.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.skillsFeiticeiro = skillsFeiticeiro.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.skillsRaciais = skillsRaciais.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.skillsUnicas = skillsUnicas.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.culinaryRecipes = culinaryRecipes.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.tailoringRecipes = tailoringRecipes.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.tecnomagicRecipes = tecnomagicRecipes.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.blacksmithingRecipes = blacksmithingRecipes.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.alchemyRecipes = alchemyRecipes.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.carpentryRecipes = carpentryRecipes.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    // Custom sort for weapons: Primary hand first, then secondary hand, then by sort order
    context.armas = armas.sort((a, b) => {
      // Primary hand weapons (rightHand) always come first
      const aIsPrimary = a.system.rightHand && !a.system.leftHand;
      const bIsPrimary = b.system.rightHand && !b.system.leftHand;
      
      // Ambidextrous weapons (both hands) come after primary
      const aIsAmbidextrous = a.system.rightHand && a.system.leftHand;
      const bIsAmbidextrous = b.system.rightHand && b.system.leftHand;
      
      // Secondary hand weapons (leftHand only) come last
      const aIsSecondary = !a.system.rightHand && a.system.leftHand;
      const bIsSecondary = !b.system.rightHand && b.system.leftHand;
      
      // Priority order: Primary > Ambidextrous > Secondary > Unarmed
      const getPriority = (weapon) => {
        if (weapon.system.isUnarmed && weapon.system.rightHand) return 10; // Unarmed primary
        if (weapon.system.isUnarmed && weapon.system.leftHand) return 30; // Unarmed secondary  
        if (weapon.system.rightHand && !weapon.system.leftHand) return 0; // Primary hand
        if (weapon.system.rightHand && weapon.system.leftHand) return 1; // Ambidextrous
        if (!weapon.system.rightHand && weapon.system.leftHand) return 20; // Secondary hand
        return 40; // Fallback
      };
      
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // If same priority, sort by original sort order
      return (a.sort || 0) - (b.sort || 0);
    });
    
    // Check if there are any non-unarmed weapons to show column headers
    context.hasNonUnarmedWeapons = armas.some(weapon => !weapon.system.isUnarmed);
    
    // Check if there are any ranged weapons to show ammunition-related columns
    context.hasRangedWeapons = armas.some(weapon => weapon.system.ranged || weapon.system.isFirearm);
    
    context.armaduras = armaduras.sort((a, b) => {
      const orderA = armorTypeOrder[a.system.armorType] || 99;
      const orderB = armorTypeOrder[b.system.armorType] || 99;
      return orderA - orderB;
    });
    context.spells = spells;

    // Calculate armor totals for equipped armors
    this._calculateArmorTotals(context);
    
    // Calculate backpack spaces occupied
    context.backpackSpacesOccupied = this._calculateBackpackSpaces(context.backpack);
  }

  /**
   * Add unarmed attack options for free hands
   * @param {Array} armas - The weapons array to modify
   * @private
   */
  _addUnarmedAttacks(armas) {
    // Check which hands are occupied
    let rightHandOccupied = false;
    let leftHandOccupied = false;

    // Check equipped weapons
    for (const weapon of armas) {
      if (weapon.system.rightHand) {
        rightHandOccupied = true;
      }
      if (weapon.system.leftHand) {
        leftHandOccupied = true;
      }
    }

    console.log("Hand occupation status:", { rightHandOccupied, leftHandOccupied });

    // Get actor's total strength for damage calculation (value + bonuses)
    const strengthValue = this.document.system.abilities.strength.value || 0;
    const strengthBonus = this.document.system.abilities.strength.totalBonus || 0;
    const actorStrength = strengthValue + strengthBonus;

    // Create unarmed attack for right hand if free
    if (!rightHandOccupied) {
      const rightHandUnarmed = this._createUnarmedAttack(null, actorStrength, true, false);
      armas.push(rightHandUnarmed);
      console.log("Added right hand unarmed attack");
    }

    // Create unarmed attack for left hand if free
    if (!leftHandOccupied) {
      const leftHandUnarmed = this._createUnarmedAttack(null, actorStrength, false, true);
      armas.push(leftHandUnarmed);
      console.log("Added left hand unarmed attack");
    }
  }

  /**
   * Create a virtual unarmed attack item
   * @param {string} handName - Name of the hand (e.g., "Mão Primária")
   * @param {number} strengthValue - Strength value for damage (dano = força)
   * @param {boolean} rightHand - Whether this is for right hand
   * @param {boolean} leftHand - Whether this is for left hand
   * @returns {object} Virtual weapon item
   * @private
   */
  _createUnarmedAttack(handName, strengthValue, rightHand, leftHand) {
    // Apply minimum damage rule: if strength is 0, minimum damage is 1
    const totalDamage = strengthValue > 0 ? strengthValue : 1;

    return {
      _id: `unarmed-${rightHand ? 'right' : 'left'}`, // Virtual ID
      name: `Ataque Desarmado`,
      type: 'arma',
      img: 'icons/skills/melee/unarmed-punch-fist.webp', // Default fist icon
      system: {
        equipped: true,
        rightHand: rightHand,
        leftHand: leftHand,
        ranged: false,
        damage: {
          value: totalDamage,
          total: totalDamage,
          useDexterity: false,
          useStrength: false  // Não usar modificador adicional - dano já foi calculado
        },
        durability: {
          current: 999, // Unarmed attacks don't break
          max: 999
        },
        // Properties for template compatibility
        properties: [],
        skillBonuses: {},
        isUnarmed: true // Flag to identify unarmed attacks
      },
      // Template compatibility
      sort: 1000 // Put unarmed attacks at the end
    };
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
    if (!weight || quantity <= 0) return 0;

    switch (weight) {
      case 'leve':
        // 0 spaces, but +1 space per 10 items
        return Math.floor(quantity / 10);
      
      case 'medio':
        // 1 space each
        return quantity;
      
      case 'pesado':
        // 2 spaces each
        return quantity * 2;
      
      case 'muito-pesado':
        // 4 spaces each
        return quantity * 4;
      
      default:
        console.warn(`[CARDIGAN] Unknown weight category: ${weight}`);
        return 0;
    }
  }

  /**
   * Calculate total spaces occupied in backpack by all items
   * Only counts items that are in the backpack table (unequipped)
   * @param {Array} backpackItems - Array of items in the backpack
   * @returns {number} Total spaces occupied
   * @private
   */
  _calculateBackpackSpaces(backpackItems) {
    if (!backpackItems || !Array.isArray(backpackItems)) return 0;

    let totalSpaces = 0;

    // Group items by weight for special rules
    const weightGroups = {
      'leve': 0
    };

    // Calculate money weight separately (30 coins = 1 space)
    const moneyAmount = this.actor?.system?.money || 0;
    const moneySpaces = Math.floor(moneyAmount / 30);

    // First pass: calculate individual item spaces and count weight groups
    backpackItems.forEach(item => {
      const weight = item.system?.weight;
      const quantity = item.system?.quantity || 1;

      if (weight === 'leve') {
        weightGroups['leve'] += quantity;
      } else {
        // For other weights, calculate normally
        totalSpaces += this._calculateItemSpaces(weight, quantity);
      }
    });

    // Apply special rules for weight groups
    totalSpaces += this._calculateItemSpaces('leve', weightGroups['leve']);
    
    // Add money spaces (30 coins = 1 space)
    totalSpaces += moneySpaces;

    console.log(`[BACKPACK SPACES] Total occupied: ${totalSpaces} (includes ${moneySpaces} spaces from ${moneyAmount} coins)`);
    return totalSpaces;
  }

  /**
   * Check if there is enough space in the backpack to accommodate an item
   * @param {string} weight - Item weight category
   * @param {number} quantity - Item quantity
   * @returns {boolean} True if there's enough space
   * @private
   */
  _hasBackpackSpace(weight, quantity) {
    const currentSpaces = this.context?.backpackSpacesOccupied || 0;
    const maxSpaces = this.actor.system.backpack.max;
    const requiredSpaces = this._calculateItemSpaces(weight, quantity);
    
    return (currentSpaces + requiredSpaces) <= maxSpaces;
  }

  /**
   * Calculate how much space would be needed if an equipped item was unequipped
   * @param {Object} item - The item to check
   * @returns {number} Spaces required for the item
   * @private
   */
  _getItemRequiredSpaces(item) {
    if (!item || !item.system) return 0;
    
    const weight = item.system.weight;
    const quantity = item.system.quantity || 1;
    
    return this._calculateItemSpaces(weight, quantity);
  }

  /**
   * Check if an equipped item can be unequipped (has space in backpack)
   * @param {Object} item - The item to check
   * @returns {boolean} True if item can be unequipped
   * @private
   */
  _canUnequipItem(item) {
    const requiredSpaces = this._getItemRequiredSpaces(item);
    const currentSpaces = this.context?.backpackSpacesOccupied || 0;
    const maxSpaces = this.actor.system.backpack.max;
    
    return (currentSpaces + requiredSpaces) <= maxSpaces;
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
      // Check if it's a Race item and delete associated racial skills
      if (doc.type === "race" && doc.system.racialSkills?.length > 0) {
        console.log("[RACIAL SKILLS] Removing racial skills on race deletion:", {
          raceName: doc.name,
          skillsCount: doc.system.racialSkills.length
        });
        
        const actor = doc.parent;
        const skillsToDelete = [];
        
        // Find all racial skills that belong to this race
        for (const racialSkill of doc.system.racialSkills) {
          // Match by name and skillClass instead of UUID (UUIDs change when skills become owned items)
          const skillItem = actor.items.find(item => 
            item.type === 'skill' && 
            item.name === racialSkill.name &&
            item.system.skillClass === 'raciais'
          );
          
          if (skillItem) {
            skillsToDelete.push(skillItem);
          }
        }
        
        // Delete all found racial skills
        if (skillsToDelete.length > 0) {
          console.log("[RACIAL SKILLS] Deleting racial skills:", {
            count: skillsToDelete.length,
            skills: skillsToDelete.map(s => s.name)
          });
          
          for (const skill of skillsToDelete) {
            await skill.delete();
          }
          
          ui.notifications.info(`Raça removida junto com ${skillsToDelete.length} skill(s) racial(is)`);
        }
      }
      
      // Check if it's a temporary health effect and adjust Health Bonus before deletion
      if (doc.type === "efeito" && doc.system.isTemporaryHealth && doc.system.healthBonusValue) {
        console.log("[TEMPORARY HEALTH] Removing health bonus on effect deletion via _deleteDoc:", {
          effectName: doc.name,
          bonusToRemove: doc.system.healthBonusValue
        });
        
        // Get the actor from the document
        const actor = doc.parent;
        
        // Remove the health bonus value from Health Bonus
        const currentHealthBonus = actor.system.status.healthBonus || 0;
        const calculatedHealthBonus = currentHealthBonus - doc.system.healthBonusValue;
        const newHealthBonus = Math.max(0, calculatedHealthBonus); // Only apply Math.max on final result
        
        console.log("[TEMPORARY HEALTH] Health bonus calculation details:", {
          currentBonus: currentHealthBonus,
          bonusToRemove: doc.system.healthBonusValue,
          calculated: calculatedHealthBonus,
          final: newHealthBonus
        });
        
        await actor.update({
          'system.status.healthBonus': newHealthBonus
        });
        
        console.log("[TEMPORARY HEALTH] Health bonus adjusted via _deleteDoc:", {
          previousBonus: currentHealthBonus,
          newBonus: newHealthBonus
        });
      } else if (doc.type === "efeito" && doc.system.isTemporaryEnergy && doc.system.energyBonusValue) {
        console.log("[TEMPORARY ENERGY] Removing energy bonus on effect deletion via _deleteDoc:", {
          effectName: doc.name,
          bonusToRemove: doc.system.energyBonusValue
        });
        
        // Get the actor from the document
        const actor = doc.parent;
        
        // Remove the energy bonus value from Energy Bonus
        const currentEnergyBonus = actor.system.status.energyBonus || 0;
        const calculatedEnergyBonus = currentEnergyBonus - doc.system.energyBonusValue;
        const newEnergyBonus = Math.max(0, calculatedEnergyBonus); // Only apply Math.max on final result
        
        console.log("[TEMPORARY ENERGY] Energy bonus calculation details:", {
          currentBonus: currentEnergyBonus,
          bonusToRemove: doc.system.energyBonusValue,
          calculated: calculatedEnergyBonus,
          final: newEnergyBonus
        });
        
        await actor.update({
          'system.status.energyBonus': newEnergyBonus
        });
        
        console.log("[TEMPORARY ENERGY] Energy bonus adjusted via _deleteDoc:", {
          previousBonus: currentEnergyBonus,
          newBonus: newEnergyBonus
        });
      } else if (doc.type === "efeito" && doc.system.isTemporaryArmor && doc.system.armorBonusValue) {
        console.log("[TEMPORARY ARMOR] Removing armor bonus on effect deletion via _deleteDoc:", {
          effectName: doc.name,
          bonusToRemove: doc.system.armorBonusValue
        });
        
        // Get the actor from the document
        const actor = doc.parent;
        
        // Remove the armor bonus value from Armor Bonus
        const currentArmorBonus = actor.system.status.armorBonus || 0;
        const calculatedArmorBonus = currentArmorBonus - doc.system.armorBonusValue;
        const newArmorBonus = Math.max(0, calculatedArmorBonus); // Only apply Math.max on final result
        
        console.log("[TEMPORARY ARMOR] Armor bonus calculation details:", {
          currentBonus: currentArmorBonus,
          bonusToRemove: doc.system.armorBonusValue,
          calculated: calculatedArmorBonus,
          final: newArmorBonus
        });
        
        await actor.update({
          'system.status.armorBonus': newArmorBonus
        });
        
        console.log("[TEMPORARY ARMOR] Armor bonus adjusted via _deleteDoc:", {
          previousBonus: currentArmorBonus,
          newBonus: newArmorBonus
        });
      } else if (doc.type === "efeito" && doc.system.consumableTracking?.isTrackingEffect && doc.system.consumableTracking?.appliedAttributeModifiers?.length > 0) {
        console.log("[ATTRIBUTE MODIFIERS] Reverting attribute modifiers on tracking effect deletion:", {
          effectName: doc.name,
          modifiers: doc.system.consumableTracking.appliedAttributeModifiers
        });
        
        // Get the actor from the document
        const actor = doc.parent;
        const updateData = {};
        
        // Process each attribute modifier
        for (const modifier of doc.system.consumableTracking.appliedAttributeModifiers) {
          if (modifier.type === 'movement') {
            const currentMovementManual = actor.system.details.movementManual || 0;
            const newMovementManual = currentMovementManual - modifier.amount; // Subtract the amount we added
            updateData['system.details.movementManual'] = newMovementManual;
            
            console.log("[MOVEMENT] Reverting movement boost:", {
              currentManual: currentMovementManual,
              amountToRevert: modifier.amount,
              newManual: newMovementManual
            });
          } else if (modifier.type === 'criticalHit') {
            const currentCriticalHitManual = actor.system.details.criticalHitManual || 0;
            const newCriticalHitManual = currentCriticalHitManual + modifier.amount; // Add back the amount (reverse the improvement)
            updateData['system.details.criticalHitManual'] = newCriticalHitManual;
            
            console.log("[CRITICAL HIT] Reverting critical hit boost:", {
              currentManual: currentCriticalHitManual,
              amountToRevert: modifier.amount,
              newManual: newCriticalHitManual
            });
          }
        }
        
        // Apply all updates at once
        if (Object.keys(updateData).length > 0) {
          await actor.update(updateData);
          console.log("[ATTRIBUTE MODIFIERS] Attribute modifiers reverted:", updateData);
        }
      } else if (doc.type === "efeito") {
        console.log("[DEBUG DELETE] Effect item does not match temporary health criteria in _deleteDoc:", {
          isEfeito: doc.type === "efeito",
          hasIsTemporaryHealth: !!doc.system.isTemporaryHealth,
          hasHealthBonusValue: !!doc.system.healthBonusValue,
          systemData: doc.system
        });
      }
      
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
      } else if (name.includes('carpentry')) {
        createData.system = { recipeType: 'carpentry' };
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
        // Show advantage selection dialog
        const advantageType = await AdvantageSelectionDialog.show();
        if (!advantageType) return; // User cancelled

        let rollFormula = dataset.roll;
        let rollDescription = "Rolagem Normal";
        
        // Modify the formula based on advantage type
        switch (advantageType) {
          case 'normal':
            // Keep original formula
            rollDescription = "Rolagem Normal";
            break;
            
          case 'advantage':
            // Replace d20 with 2d20kh (keep highest)
            rollFormula = rollFormula.replace(/1?d20/g, '2d20kh');
            rollDescription = "Rolagem com Vantagem";
            break;
            
          case 'disadvantage':
            // Replace d20 with 2d20kl (keep lowest)
            rollFormula = rollFormula.replace(/1?d20/g, '2d20kl');
            rollDescription = "Rolagem com Desvantagem";
            break;
            
          default:
            return;
        }
        
        // Create the roll with modified formula
        const roll = new Roll(rollFormula, this.document.getRollData());
        
        // Evaluate the roll
        await roll.evaluate();
        
        // Check for Sangramento effect and apply damage if rolling an ability
        const abilityKey = dataset.key || null;
        if (abilityKey) {
          const abilityLabel = label || dataset.label || '';
          const { SangramentoEffect } = await import('../effects/index.mjs');
          await SangramentoEffect.applyBleedingDamage(this.document, abilityLabel, abilityKey);
        }
        
        // Detect critical results, passing the ability key if available
        const flags = this.constructor._detectCriticalResults(roll, this.document, abilityKey);
        
        // Create custom flavor text showing the advantage type
        const flavorText = `<div style="text-align: center; margin-bottom: 4px;">
          <strong>${label}</strong> - ${rollDescription}
        </div>`;
        
        // Send to chat
        const message = await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: this.document }),
          flavor: flavorText,
          rollMode: game.settings.get('core', 'rollMode'),
          flags: flags
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
      
      // Detect critical results
      const flags = this.constructor._detectCriticalResults(roll, this.document, null);
      
      // Send to chat
      const chatMessage = await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.document }),
        flavor: flavorMessage,
        rollMode: game.settings.get('core', 'rollMode'),
        flags: flags
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
      
      // Efeito de exaustão será gerenciado automaticamente pelo ExaustaoEffect
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
      
      // Efeito de exaustão será gerenciado automaticamente pelo ExaustaoEffect
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
   * Show skill description in chat
   * @param {Event} event   The triggering event
   * @param {HTMLElement} target  The targeted element
   * @protected
   */
  static async _onSkillToChat(event, target) {
    event.preventDefault();
    
    try {
      const itemId = target.dataset.itemId;
      const skill = this.document.items.get(itemId);
      
      if (!skill) {
        ui.notifications.error("Skill não encontrada");
        return;
      }
      
      const skillName = skill.name;
      const actorId = this.document.id;
      
      // Use the SkillManager to handle skill-to-chat
      try {
        const { getSkillManager } = await import('../skills/index.mjs');
        const skillManager = await getSkillManager();
        await skillManager.handleSkillToChat(skillName, actorId);
      } catch (error) {
        console.error(`Error showing skill ${skillName} in chat:`, error);
        ui.notifications.error(`Erro ao mostrar skill no chat: ${error.message}`);
      }
      
    } catch (error) {
      console.error("Error showing skill in chat:", error);
      ui.notifications.error(`Erro ao mostrar skill no chat: ${error.message}`);
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
    
    // Special handling for race items - only one race allowed
    const raceItems = itemData.filter(item => item.type === 'race');
    if (raceItems.length > 0) {
      // Remove any existing race item
      const existingRace = this.actor.items.find(i => i.type === 'race');
      if (existingRace) {
        await existingRace.delete();
        ui.notifications.info(`Raça anterior "${existingRace.name}" foi substituída`);
      }
      
      // Add racial skills automatically
      for (const raceItem of raceItems) {
        const racialSkills = raceItem.system?.racialSkills || [];
        
        if (racialSkills.length > 0) {
          console.log('[CARDIGAN] Adding racial skills:', racialSkills.length);
          
          // Create an array to hold skill items to add
          const skillsToAdd = [];
          
          for (const skillRef of racialSkills) {
            try {
              // Try to get the skill from UUID
              let skillDoc = null;
              if (skillRef.uuid) {
                skillDoc = await fromUuid(skillRef.uuid);
              }
              
              // If not found by UUID, try to find in compendium by ID
              if (!skillDoc && skillRef.id) {
                const pack = game.packs.get("cardigan.skills-cardigan");
                if (pack) {
                  skillDoc = await pack.getDocument(skillRef.id);
                }
              }
              
              if (skillDoc) {
                // Check if skill already exists on actor
                const existingSkill = this.actor.items.find(i => 
                  i.type === 'skill' && i.name === skillDoc.name
                );
                
                if (!existingSkill) {
                  skillsToAdd.push(skillDoc.toObject());
                  console.log('[CARDIGAN] Will add racial skill:', skillDoc.name);
                } else {
                  console.log('[CARDIGAN] Skill already exists:', skillDoc.name);
                }
              } else {
                console.warn('[CARDIGAN] Could not find skill:', skillRef.name || skillRef.id);
              }
            } catch (error) {
              console.error('[CARDIGAN] Error loading racial skill:', error);
            }
          }
          
          // Add all racial skills
          if (skillsToAdd.length > 0) {
            await this.actor.createEmbeddedDocuments('Item', skillsToAdd);
            ui.notifications.info(`${skillsToAdd.length} skill(s) racial(is) adicionada(s)`);
          }
        }
      }
    }
    
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
        
        // Efeito de exaustão será gerenciado automaticamente pelo ExaustaoEffect
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

    // Adicionar listeners para os grupos sequenciais (giftOfLife, deathSentence, sanity, toxicity, fracture)
    html.querySelectorAll('.sequential-group').forEach(group => {
      const field = group.dataset.field;
      const checkboxes = group.querySelectorAll('input[type="checkbox"]');
      
      checkboxes.forEach(checkbox => {
        // Remover listener anterior se existir
        if (checkbox._sequentialHandler) {
          checkbox.removeEventListener('change', checkbox._sequentialHandler);
        }
        
        // Criar e armazenar o handler
        checkbox._sequentialHandler = async (ev) => {
          ev.preventDefault();
          ev.stopPropagation(); // Previne que o evento chegue ao handler do formulário
          ev.stopImmediatePropagation(); // Garante que nenhum outro listener seja executado
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
        };
        
        // Adicionar o listener
        checkbox.addEventListener('change', checkbox._sequentialHandler);
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
   * Adiciona event listeners para campos de quantidade de itens da backpack
   * Implementa sincronização instantânea entre actor sheet e item sheet
   */
  #addQuantityListeners() {
    const html = this.element;
    
    // Encontrar todos os inputs de quantidade dos itens da backpack
    const quantityInputs = html.querySelectorAll('input[name*="quantity"]');
    
    quantityInputs.forEach(input => {
      // Armazenar valor anterior para comparação
      input.dataset.previousValue = input.value;
      
      // Usar apenas 'blur' para evitar processamento excessivo
      input.addEventListener('blur', this.#handleQuantityChange.bind(this));
    });
  }

  /**
   * Manipula mudanças nos campos de quantidade dos itens da backpack
   * @param {Event} event - O evento blur do input
   */
  async #handleQuantityChange(event) {
    const input = event.target;
    const name = input.name;
    const value = parseInt(input.value) || 0;
    const previousValue = input.dataset.previousValue;
    
    // Se o valor não mudou, não fazer nada
    if (value.toString() === previousValue) return;
    
    console.log(`[CARDIGAN] Quantidade alterada: ${previousValue} → ${value}`);
    
    // Extrair o ID do item do nome do campo (formato: items.itemId.system.quantity)
    const match = name.match(/^items\.([^.]+)\.system\.quantity$/);
    if (!match) {
      console.warn('[CARDIGAN] Nome do campo de quantidade inválido:', name);
      return;
    }
    
    const itemId = match[1];
    const item = this.actor.items.get(itemId);
    
    if (!item) {
      console.warn('[CARDIGAN] Item não encontrado:', itemId);
      return;
    }
    
    // Validar se é um dos tipos permitidos para edição de quantidade
    if (!['item-comum', 'item-municao', 'item-consumivel'].includes(item.type)) {
      console.warn('[CARDIGAN] Tipo de item não permitido para edição de quantidade:', item.type);
      return;
    }
    
    // Validar valor mínimo
    const finalValue = Math.max(0, value);
    if (finalValue !== value) {
      console.log(`[CARDIGAN] Valor ${value} ajustado para mínimo 0`);
      input.value = finalValue;
    }
    
    // Preparar a atualização
    const updateData = {
      'system.quantity': finalValue
    };
    
    try {
      // Atualizar o item diretamente
      await item.update(updateData);
      
      // Atualizar o valor anterior para a próxima comparação
      input.dataset.previousValue = finalValue.toString();
      
      console.log(`[CARDIGAN] Quantidade atualizada com sucesso para ${item.name}: ${finalValue}`);
    } catch (error) {
      console.error('[CARDIGAN] Erro ao atualizar quantidade:', error);
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
      const autoValue = Math.max(1, 20 - dexterityCriticalEffect);
      
      // Obter o valor manual atual (se existir)
      const manualValue = system.details.criticalHitManual || 0;
      const newCriticalHit = autoValue + manualValue;
      
      // Calculate movement: a cada 2 pontos de Destreza = +1 movimento
      const dexterityMovement = Math.floor(totalDexterity / 2);
      const armorMovementBonus = this.actor._armorMovementBonus || 0;
      const autoMovementValue = dexterityMovement + armorMovementBonus;
      const manualMovementValue = system.details.movementManual || 0;
      const newMovement = autoMovementValue + manualMovementValue;
      
      const criticalHitInput = this.element.querySelector('input[name="system.details.criticalHit"]');
      if (criticalHitInput) {
        // Se o campo não está em foco, mostrar o valor total
        if (document.activeElement !== criticalHitInput) {
          criticalHitInput.value = newCriticalHit;
        }
      }
      
      // Update movement input
      const movementInput = this.element.querySelector('input[name="system.details.movement"]');
      if (movementInput) {
        // Se o campo não está em foco, mostrar o valor total
        if (document.activeElement !== movementInput) {
          movementInput.value = newMovement;
        }
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
   * Handle managing ammunition for ranged weapons
   * @param {PointerEvent} event   The originating click event
   * @param {HTMLElement} target   The capturing HTML element which defined a [data-action]
   * @protected
   */
  static async _onManageAmmunition(event, target) {
    event.preventDefault();
    
    const itemId = target.dataset.itemId;
    const item = this.document.items.get(itemId);
    
    if (!item || !item.system.ranged) {
      ui.notifications.warn("Esta arma não é de longo alcance.");
      return;
    }

    // Check if dialog is already open, if so, close it first
    if (this._ammunitionDialog) {
      this._ammunitionDialog.close();
    }

    // Create reactive ammunition management dialog
    const actorSheet = this;
    actorSheet._ammunitionDialog = new foundry.applications.api.DialogV2({
      window: {
        title: "Ammunition Management",
        resizable: true,
        classes: ["ammunition-dialog", "cardigan-ammunition"]
      },
      content: await CardiganSystemActorSheet._renderAmmunitionContent.call(this, item),
      buttons: [{
        action: "close",
        icon: "fas fa-check",
        label: "Close",
        callback: () => {
          actorSheet._ammunitionDialog = null;
        }
      }],
      modal: false,
      rejectClose: false
    });

    // Render the dialog first
    await actorSheet._ammunitionDialog.render({ force: true });
    
    // Setup item change listener for reactive updates AFTER rendering
    CardiganSystemActorSheet._setupAmmunitionDialogListener.call(this, item);
  }

  /**
   * Render ammunition dialog content
   * @param {Item} weapon - The weapon item
   * @returns {Promise<string>} The rendered HTML content
   */
  static async _renderAmmunitionContent(weapon) {
    // Get actor from weapon or use this.document if called from instance
    const actor = weapon.parent || this.document;
    
    // Get all ammunition items
    const allAmmunitionItems = actor.items.filter(i => i.type === "item-municao");
    
    // Filter ammunition based on weapon type
    const filteredAmmunitionItems = allAmmunitionItems.filter(ammoItem => {
      // If weapon is a firearm, show only firearm ammunition
      if (weapon.system.isFirearm) {
        return ammoItem.system.isFirearmAmmo === true;
      }
      // If weapon is not a firearm, show only non-firearm ammunition
      else {
        return ammoItem.system.isFirearmAmmo === false;
      }
    });
    
    const templatePath = "systems/cardigan/templates/dialogs/ammunition-management.hbs";
    const templateData = {
      weapon: weapon,
      ammunitionItems: filteredAmmunitionItems
    };

    return await foundry.applications.handlebars.renderTemplate(templatePath, templateData);
  }

  /**
   * Setup listener for item changes to update ammunition dialog
   * @param {Item} weapon - The weapon item
   */
  static _setupAmmunitionDialogListener(weapon) {
    const actorSheet = this;
    
    // Check if dialog element exists
    if (!actorSheet._ammunitionDialog || !actorSheet._ammunitionDialog.element) {
      console.warn("Ammunition dialog element not available for setup");
      return;
    }
    
    // No need for loadedAmounts Map since we persist in weapon.system.loadedAmmo
    
    // Add method to update weapon table ammunition display
    actorSheet._updateWeaponTableAmmunition = function(weaponId, loadedAmmo, magazine, isFirearm) {
      const weaponRow = actorSheet.element.querySelector(`[data-item-id="${weaponId}"]`);
      if (weaponRow) {
        const ammunitionDisplay = weaponRow.querySelector('.ammunition-display');
        if (ammunitionDisplay) {
          const displayText = isFirearm ? `${loadedAmmo}/${magazine}` : loadedAmmo.toString();
          ammunitionDisplay.textContent = displayText;
        }
      }
    };
    
    // Add method to update ammunition dialog inputs
    actorSheet._updateAmmunitionDialogInputs = function(weaponId, loadedAmmoTypes) {
      if (actorSheet._ammunitionDialog && actorSheet._ammunitionDialog.element) {
        const dialogElement = actorSheet._ammunitionDialog.element;
        
        // Update each ammunition input based on the loadedAmmoTypes mapping
        for (const [ammoId, amount] of Object.entries(loadedAmmoTypes)) {
          const input = dialogElement.querySelector(`input[data-item-id="${ammoId}"]`);
          if (input) {
            input.value = amount.toString();
          }
        }
        
        // Set inputs to 0 for ammo types not in the mapping
        const allInputs = dialogElement.querySelectorAll('.ammunition-load-input');
        allInputs.forEach(input => {
          const ammoId = input.getAttribute('data-item-id');
          if (!loadedAmmoTypes[ammoId]) {
            input.value = '0';
          }
        });
      }
    };
    
    // Setup input listeners for ammunition loading
    actorSheet._ammunitionDialog.element.addEventListener('input', async (event) => {
      if (event.target.classList.contains('ammunition-load-input')) {
        const input = event.target;
        const itemId = input.getAttribute('data-item-id');
        
        // Clean the input value to prevent leading zeros
        let rawValue = input.value.replace(/^0+/, '') || '0';
        let newValue = parseInt(rawValue) || 0;
        
        // Update the input value to the cleaned version
        if (input.value !== newValue.toString()) {
          input.value = newValue.toString();
        }
        
        // Get ammunition item
        const ammunition = actorSheet.actor.items.get(itemId);
        if (!ammunition) return;
        
        // Get current loaded amount for this specific ammunition type
        const loadedAmmoTypes = weapon.system.loadedAmmoTypes || {};
        const currentLoadedAmount = loadedAmmoTypes[itemId] || 0;
        
        // Calculate available quantity (current inventory + what's currently loaded of this type)
        const currentQuantity = ammunition.system.quantity;
        const totalAvailable = currentQuantity + currentLoadedAmount;
        
        // Calculate total loaded ammunition across all types
        const totalLoadedAcrossTypes = Object.values(loadedAmmoTypes).reduce((sum, amount) => sum + amount, 0);
        
        // Validate maximum value for firearms considering total capacity
        if (weapon.system.isFirearm) {
          const otherTypesLoaded = totalLoadedAcrossTypes - currentLoadedAmount;
          const availableCapacity = weapon.system.magazine - otherTypesLoaded;
          
          if (newValue > availableCapacity) {
            input.value = availableCapacity;
            newValue = availableCapacity; // Update newValue to the corrected value
            ui.notifications.warn(`Magazine capacity exceeded. Available space: ${availableCapacity} rounds. Value adjusted automatically.`);
          }
        }
        
        // Validate against total available quantity
        if (newValue > totalAvailable) {
          input.value = totalAvailable;
          newValue = totalAvailable; // Update newValue to the corrected value
          ui.notifications.warn(`Only ${totalAvailable} rounds available in inventory. Value adjusted automatically.`);
        }
        
        // Calculate the difference in loaded ammunition
        const loadedDifference = newValue - currentLoadedAmount;
        
        let newQuantity = currentQuantity;
        
        if (loadedDifference > 0) {
          // Loading more ammunition: reduce inventory
          newQuantity = currentQuantity - loadedDifference;
        } else if (loadedDifference < 0) {
          // Unloading ammunition: for consumed ammo, don't return to inventory
          // Only return to inventory if we're manually unloading (not after consumption)
          // Since this is manual input change, we consider it "disposal" of loaded ammo
          // So we don't add it back to inventory - it's considered consumed/lost
          newQuantity = currentQuantity; // Keep inventory unchanged
        }
        
        await ammunition.update({
          "system.quantity": newQuantity
        });
        
        // Update weapon's loaded ammo types mapping
        const updatedLoadedAmmoTypes = { ...loadedAmmoTypes };
        if (newValue > 0) {
          updatedLoadedAmmoTypes[itemId] = newValue;
        } else {
          delete updatedLoadedAmmoTypes[itemId]; // Remove entry if 0
        }
        
        // Calculate new total loaded ammo
        const newTotalLoaded = Object.values(updatedLoadedAmmoTypes).reduce((sum, amount) => sum + amount, 0);
        
        // Update weapon with both the mapping and total
        await weapon.update({
          "system.loadedAmmoTypes": updatedLoadedAmmoTypes,
          "system.loadedAmmo": newTotalLoaded
        });
        
        // No need to track in Map anymore since we persist in weapon
        
        // Update the display immediately
        const quantityElement = input.parentElement.querySelector('.ammunition-quantity');
        if (quantityElement) {
          quantityElement.textContent = newQuantity;
          quantityElement.setAttribute('data-quantity', newQuantity);
        }
        
        // Update weapon table display in real-time
        actorSheet._updateWeaponTableAmmunition(weapon._id, newTotalLoaded, weapon.system.magazine, weapon.system.isFirearm);
        
        // Update ammunition dialog inputs if open (for cross-dialog synchronization)
        if (actorSheet._ammunitionDialog && actorSheet._ammunitionDialog.rendered) {
          actorSheet._updateAmmunitionDialogInputs(weapon._id, updatedLoadedAmmoTypes);
        }
      }
    });
    
    // Setup ammunition-specific attack button listeners
    actorSheet._ammunitionDialog.element.addEventListener('click', async (event) => {
      if (event.target.classList.contains('ammunition-attack-btn') || 
          event.target.closest('.ammunition-attack-btn')) {
        
        const button = event.target.classList.contains('ammunition-attack-btn') ? 
                      event.target : event.target.closest('.ammunition-attack-btn');
        
        const ammunitionId = button.getAttribute('data-item-id');
        const weaponId = button.getAttribute('data-weapon-id');
        
        // Get the weapon and ammunition items
        const weaponItem = actorSheet.actor.items.get(weaponId);
        const ammunitionItem = actorSheet.actor.items.get(ammunitionId);
        
        if (!weaponItem || !ammunitionItem) {
          ui.notifications.error("Weapon or ammunition not found.");
          return;
        }
        
        // Check if this ammunition type has loaded rounds
        const loadedAmmoTypes = weaponItem.system.loadedAmmoTypes || {};
        const loadedAmount = loadedAmmoTypes[ammunitionId] || 0;
        
        if (loadedAmount <= 0) {
          ui.notifications.warn(`No ${ammunitionItem.name} loaded in weapon.`);
          return;
        }
        
        // Call the existing attack method but specify the ammunition to use
        try {
          await CardiganSystemActorSheet._onAttackWithWeapon.call(actorSheet, weaponItem, ammunitionId);
          
          // Optionally close the dialog after attack
          // actorSheet._ammunitionDialog.close();
          
        } catch (error) {
          console.error("Error attacking with specific ammunition:", error);
          ui.notifications.error("Failed to attack with this ammunition.");
        }
      }
    });
    
    // Setup auto-load button listeners
    actorSheet._ammunitionDialog.element.addEventListener('click', async (event) => {
      if (event.target.classList.contains('ammunition-auto-load-btn') || 
          event.target.closest('.ammunition-auto-load-btn')) {
        
        const button = event.target.classList.contains('ammunition-auto-load-btn') ? 
                      event.target : event.target.closest('.ammunition-auto-load-btn');
        
        const itemId = button.getAttribute('data-item-id');
        const availableQuantity = parseInt(button.getAttribute('data-quantity')) || 0;
        
        if (availableQuantity === 0) {
          ui.notifications.warn("No ammunition available in inventory.");
          return;
        }
        
        // Get ammunition item
        const ammunition = actorSheet.actor.items.get(itemId);
        if (!ammunition) return;
        
        // Get current loaded amounts
        const loadedAmmoTypes = weapon.system.loadedAmmoTypes || {};
        const currentLoadedAmount = loadedAmmoTypes[itemId] || 0;
        
        // Calculate how much we can load
        let amountToLoad = 0;
        
        if (weapon.system.isFirearm) {
          // For firearms: respect magazine capacity
          const totalLoadedAcrossTypes = Object.values(loadedAmmoTypes).reduce((sum, amount) => sum + amount, 0);
          const otherTypesLoaded = totalLoadedAcrossTypes - currentLoadedAmount;
          const availableCapacity = weapon.system.magazine - otherTypesLoaded;
          
          // Load up to capacity or available quantity, whichever is smaller
          amountToLoad = Math.min(availableCapacity, availableQuantity);
        } else {
          // For non-firearms: load all available ammunition
          amountToLoad = availableQuantity;
        }
        
        if (amountToLoad <= 0) {
          ui.notifications.warn("No capacity available or ammunition already loaded.");
          return;
        }
        
        // Update the input value to trigger the existing logic
        const input = button.parentElement.querySelector('.ammunition-load-input');
        if (input) {
          const newTotalLoaded = currentLoadedAmount + amountToLoad;
          input.value = newTotalLoaded.toString();
          
          // Trigger input event to use existing validation and update logic
          const inputEvent = new Event('input', { bubbles: true });
          input.dispatchEvent(inputEvent);
          
          ui.notifications.info(`Auto-loaded ${amountToLoad} rounds of ${ammunition.name}.`);
        }
      }
    });
    
    // Remove existing listener if any
    if (actorSheet._ammunitionUpdateHook) {
      Hooks.off("updateItem", actorSheet._ammunitionUpdateHook);
    }

    // Create new listener
    actorSheet._ammunitionUpdateHook = Hooks.on("updateItem", async (item, changes, options, userId) => {
      if (!actorSheet._ammunitionDialog || !actorSheet._ammunitionDialog.rendered) {
        return;
      }

      // Handle ammunition item updates
      if (item.type === "item-municao") {
        // Check if quantity changed (simple update)
        if (changes.system?.quantity !== undefined && !changes.system?.isFirearmAmmo) {
          // Find the specific ammunition item in the dialog
          const itemElement = actorSheet._ammunitionDialog.element.querySelector(`[data-item-id="${item.id}"]`);
          if (itemElement) {
            // Update just the quantity text
            const quantityElement = itemElement.querySelector('.ammunition-quantity');
            if (quantityElement) {
              quantityElement.textContent = `${item.system.quantity}`;
              quantityElement.setAttribute('data-quantity', item.system.quantity);
            }
          }
        } 
        // Check if firearm ammo type changed (needs full re-render for filtering)
        else if (changes.system?.isFirearmAmmo !== undefined) {
          // Re-render to apply ammunition filtering
          const newContent = await CardiganSystemActorSheet._renderAmmunitionContent(weapon);
          const contentElement = actorSheet._ammunitionDialog.element.querySelector('.dialog-content');
          if (contentElement) {
            contentElement.innerHTML = newContent;
          }
        }
        else {
          // For other changes (like name, image), re-render full content
          const newContent = await CardiganSystemActorSheet._renderAmmunitionContent(weapon);
          const contentElement = actorSheet._ammunitionDialog.element.querySelector('.dialog-content');
          if (contentElement) {
            contentElement.innerHTML = newContent;
          }
        }
      }
      
      // Handle weapon updates (magazine capacity)
      else if (item.id === weapon.id && item.type === weapon.type) {
        // Check if magazine capacity or isFirearm changed
        if (changes.system?.magazine !== undefined || changes.system?.isFirearm !== undefined) {
          // Update the capacity display
          const capacityElement = actorSheet._ammunitionDialog.element.querySelector('.capacity-value');
          const capacitySection = actorSheet._ammunitionDialog.element.querySelector('.magazine-capacity-section');
          
          if (changes.system?.magazine !== undefined && capacityElement) {
            // Update just the capacity number
            capacityElement.textContent = item.system.magazine;
          }
          
          if (changes.system?.isFirearm !== undefined) {
            // Re-render to show/hide capacity section
            const newContent = await CardiganSystemActorSheet._renderAmmunitionContent(item);
            const contentElement = actorSheet._ammunitionDialog.element.querySelector('.dialog-content');
            if (contentElement) {
              contentElement.innerHTML = newContent;
            }
          }
        }
        
        // Handle ammunition consumption/loading updates
        if (changes.system?.loadedAmmo !== undefined || changes.system?.loadedAmmoTypes !== undefined) {
          // Update dialog inputs to reflect current loaded ammunition
          const loadedAmmoTypes = item.system.loadedAmmoTypes || {};
          actorSheet._updateAmmunitionDialogInputs(item.id, loadedAmmoTypes);
          
          // Update weapon table display
          actorSheet._updateWeaponTableAmmunition(item.id, item.system.loadedAmmo, item.system.magazine, item.system.isFirearm);
        }
      }
    });

    // Also listen for item creation/deletion
    actorSheet._ammunitionCreateHook = Hooks.on("createItem", async (item, options, userId) => {
      if (item.type === "item-municao" && actorSheet._ammunitionDialog && actorSheet._ammunitionDialog.rendered) {
        const newContent = await CardiganSystemActorSheet._renderAmmunitionContent(weapon);
        const contentElement = actorSheet._ammunitionDialog.element.querySelector('.dialog-content');
        if (contentElement) {
          contentElement.innerHTML = newContent;
        }
      }
    });

    actorSheet._ammunitionDeleteHook = Hooks.on("deleteItem", async (item, options, userId) => {
      if (item.type === "item-municao" && actorSheet._ammunitionDialog && actorSheet._ammunitionDialog.rendered) {
        const itemElement = actorSheet._ammunitionDialog.element.querySelector(`[data-item-id="${item.id}"]`);
        if (itemElement) {
          itemElement.remove();
        }
      }
    });

    // Cleanup listeners when dialog closes
    const originalClose = actorSheet._ammunitionDialog.close.bind(actorSheet._ammunitionDialog);
    actorSheet._ammunitionDialog.close = (...args) => {
      if (actorSheet._ammunitionUpdateHook) {
        Hooks.off("updateItem", actorSheet._ammunitionUpdateHook);
        actorSheet._ammunitionUpdateHook = null;
      }
      if (actorSheet._ammunitionCreateHook) {
        Hooks.off("createItem", actorSheet._ammunitionCreateHook);
        actorSheet._ammunitionCreateHook = null;
      }
      if (actorSheet._ammunitionDeleteHook) {
        Hooks.off("deleteItem", actorSheet._ammunitionDeleteHook);
        actorSheet._ammunitionDeleteHook = null;
      }
      actorSheet._ammunitionDialog = null;
      return originalClose(...args);
    };
  }

  /**
   * Load ammunition into weapon
   * @param {Item} weapon - The weapon to load ammunition into
   * @param {string} ammunitionId - The ID of the ammunition item
   * @param {number} amount - The amount to load
   */
  async _loadAmmunition(weapon, ammunitionId, amount) {
    try {
      const ammunition = this.actor.items.get(ammunitionId);
      if (!ammunition) {
        ui.notifications.error("Ammunition not found.");
        return;
      }

      // Validate available quantity
      if (amount > ammunition.system.quantity) {
        ui.notifications.error(`Only ${ammunition.system.quantity} rounds available.`);
        return;
      }

      // For firearms, validate magazine capacity
      if (weapon.system.isFirearm && amount > weapon.system.magazine) {
        ui.notifications.error(`Cannot load more than ${weapon.system.magazine} rounds.`);
        return;
      }

      // Update ammunition quantity (subtract loaded amount)
      await ammunition.update({
        "system.quantity": ammunition.system.quantity - amount
      });

      // For now, just show notification of successful loading
      // In the future, you might want to track loaded ammunition on the weapon
      const weaponType = weapon.system.isFirearm ? "magazine" : "quiver";
      ui.notifications.info(`Loaded ${amount} rounds into ${weapon.name}'s ${weaponType}.`);

    } catch (error) {
      console.error("Error loading ammunition:", error);
      ui.notifications.error("Failed to load ammunition.");
    }
  }

  /**
   * Create a virtual unarmed attack item (static version)
   * @param {string} handName - Name of the hand (e.g., "Mão Primária")
   * @param {number} strengthValue - Strength value for damage (dano = força)
   * @param {boolean} rightHand - Whether this is for right hand
   * @param {boolean} leftHand - Whether this is for left hand
   * @returns {object} Virtual weapon item
   * @private
   * @static
   */
  static _createUnarmedAttack(handName, strengthValue, rightHand, leftHand) {
    // Apply minimum damage rule: if strength is 0, minimum damage is 1
    const totalDamage = strengthValue > 0 ? strengthValue : 1;

    return {
      _id: `unarmed-${rightHand ? 'right' : 'left'}`, // Virtual ID
      name: `Ataque Desarmado`,
      type: 'arma',
      img: 'icons/skills/melee/unarmed-punch-fist.webp', // Default fist icon
      system: {
        equipped: true,
        rightHand: rightHand,
        leftHand: leftHand,
        ranged: false,
        damage: {
          value: totalDamage,
          total: totalDamage,
          useDexterity: false,
          useStrength: false  // Não usar modificador adicional - dano já foi calculado
        },
        durability: {
          current: 999, // Unarmed attacks don't break
          max: 999
        },
        // Properties for template compatibility
        properties: [],
        skillBonuses: {},
        isUnarmed: true // Flag to identify unarmed attacks
      },
      // Template compatibility
      sort: 1000 // Put unarmed attacks at the end
    };
  }

  /**
   * Handle attacking with a weapon
   * @param {PointerEvent|Item} eventOrItem   The originating click event or weapon item
   * @param {HTMLElement|string} targetOrAmmoId   The capturing HTML element or specific ammunition ID
   * @protected
   */
  static async _onAttackWithWeapon(eventOrItem, targetOrAmmoId) {
    let event, target, item, specificAmmoId;
    
    // Determine if this is a normal attack or specific ammunition attack
    if (eventOrItem instanceof Event) {
      // Normal attack from weapon table
      event = eventOrItem;
      target = targetOrAmmoId;
      event.preventDefault();
      
      const itemId = target.dataset.itemId;
      
      // Handle unarmed attacks (virtual items)
      if (itemId.startsWith('unarmed-')) {
        // Create virtual unarmed attack item on the fly
        const isRightHand = itemId === 'unarmed-right';
        const strengthValue = this.document.system.abilities.strength.value || 0;
        const strengthBonus = this.document.system.abilities.strength.totalBonus || 0;
        const actorStrength = strengthValue + strengthBonus;
        
        item = CardiganSystemActorSheet._createUnarmedAttack(null, actorStrength, isRightHand, !isRightHand);
      } else {
        item = this.document.items.get(itemId);
      }
      specificAmmoId = null; // Use priority order
    } else {
      // Specific ammunition attack from dialog
      item = eventOrItem;
      specificAmmoId = targetOrAmmoId;
      event = null;
      target = null;
    }
    
    console.log("Attack with weapon triggered", { 
      isSpecificAmmo: !!specificAmmoId, 
      specificAmmoId, 
      item: item?.name,
      isUnarmed: item?.system?.isUnarmed 
    });
    
    // Skip equipment check for unarmed attacks
    if (!item || (!item.system.isUnarmed && !item.system.rightHand && !item.system.leftHand)) {
      ui.notifications.warn(game.i18n.localize("CARDIGAN.WeaponNotEquipped"));
      return;
    }

    // Verificar durabilidade da arma (pular para ataques desarmados)
    if (!item.system.isUnarmed && item.system.durability.current <= 0) {
      ui.notifications.warn(game.i18n.localize("CARDIGAN.WeaponBroken"));
      return;
    }

    // Verificar munição para armas à distância antes do ataque
    if (item.system.ranged) {
      const loadedAmmoTypes = item.system.loadedAmmoTypes || {};
      const hasAnyAmmunition = Object.values(loadedAmmoTypes).some(amount => amount > 0);
      
      console.log("Ranged weapon ammo check:", { loadedAmmoTypes, hasAnyAmmunition });
      
      if (!hasAnyAmmunition) {
        ui.notifications.warn(game.i18n.localize("CARDIGAN.NoAmmunition"));
        return;
      }
    }

    const actor = this.document;
    
    // Show advantage selection dialog
    const advantageType = await AdvantageSelectionDialog.show();
    if (!advantageType) return; // User cancelled
    
    // Use getRollData() method for consistent roll data like in skills
    const rollData = actor.getRollData();

    let rollFormula;
    let rollDescription = "";
    
    switch (advantageType) {
      case 'normal':
        // Normal roll - 1d20
        rollFormula = "1d20 + @accuracy.total";
        rollDescription = "Rolagem Normal";
        break;
        
      case 'advantage':
        // Advantage - roll 2d20, keep highest
        rollFormula = "2d20kh + @accuracy.total";
        rollDescription = "Rolagem com Vantagem";
        break;
        
      case 'disadvantage':
        // Disadvantage - roll 2d20, keep lowest
        rollFormula = "2d20kl + @accuracy.total";
        rollDescription = "Rolagem com Desvantagem";
        break;
        
      default:
        return;
    }

    // Fazer a rolagem de ataque com a fórmula escolhida
    const roll = new Roll(rollFormula, rollData);
    await roll.evaluate();

    // 🆕 Verificar se há um alvo selecionado
    const targets = game.user.targets;
    if (targets.size === 0) {
      ui.notifications.warn("Selecione um alvo antes de atacar!");
      return;
    }
    
    const targetToken = Array.from(targets)[0];
    const targetActor = targetToken?.actor;
    
    if (!targetActor) {
      ui.notifications.error("Alvo selecionado é inválido!");
      return;
    }
    
    // 🆕 Preparar rolagem de evasão do alvo (só avaliar, não enviar ainda)
    const targetEvasion = targetActor.system?.abilities?.evasion?.total ?? 0;
    const evasionRoll = new Roll("1d20 + @evasion", { evasion: targetEvasion });
    await evasionRoll.evaluate();

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

    // Criar flavor text personalizado com tipo de rolagem
    const flavor = `<div style="text-align: center; margin-bottom: 4px;">
      <strong>${game.i18n.localize("CARDIGAN.AttackWith")} ${item.name}</strong> - ${rollDescription}
    </div>`;

    // Detect critical results - use accuracy logic for weapon attacks
    const flags = this.constructor._detectCriticalResults(roll, actor, 'accuracy');

    // Check for critical results
    const isCriticalHit = flags.cardigan?.criticalHit || false;
    const isCriticalFailure = flags.cardigan?.criticalFailure || false;
    let finalDamage = totalDamage;
    let criticalMessage = '';
    
    // Handle critical hit - double damage
    if (isCriticalHit) {
      finalDamage = totalDamage * 2;
      criticalMessage = `<div style="text-align: center; margin-top: 4px; color: #4CAF50; font-weight: bold;">
        <i class="fas fa-star"></i> ${game.i18n.localize("CARDIGAN.CriticalHitDamageDoubled") || "CRITICAL HIT! Damage doubled!"}
      </div>`;
    }
    
    // Handle critical failure - reduce durability
    if (isCriticalFailure) {
      const currentDurability = item.system.durability.current;
      if (currentDurability > 0) {
        const newDurability = Math.max(0, currentDurability - 1);
        await item.update({
          'system.durability.current': newDurability
        });
        
        criticalMessage = `<div style="text-align: center; margin-top: 4px; color: #f44336; font-weight: bold;">
          <i class="fas fa-exclamation-triangle"></i> ${game.i18n.localize("CARDIGAN.CriticalFailureDurabilityLoss") || "CRITICAL FAILURE! Weapon durability reduced!"}
        </div>
        <div style="text-align: center; margin-top: 2px; font-size: 12px; color: #666;">
          ${game.i18n.localize("CARDIGAN.DurabilityReduced") || "Durability:"} ${currentDurability} → ${newDurability}
        </div>`;
      }
    }

    // Handle ammunition consumption for ranged weapons
    let ammunitionMessage = '';
    if (item.system.ranged && !isCriticalFailure) {
      const loadedAmmoTypes = item.system.loadedAmmoTypes || {};
      const currentLoaded = item.system.loadedAmmo || 0;
      
      // Find first ammunition type with loaded ammo following display order
      let consumedAmmoType = null;
      const actor = this.document;
      
      // Get ammunition items in the same order as displayed in the dialog
      const allAmmunitionItems = actor.items.filter(i => i.type === "item-municao");
      const filteredAmmunitionItems = allAmmunitionItems.filter(ammoItem => {
        if (item.system.isFirearm) {
          return ammoItem.system.isFirearmAmmo === true;
        } else {
          return ammoItem.system.isFirearmAmmo === false;
        }
      });
      
      // Find ammunition to consume with prioritization or use specific ammunition
      console.log("Searching for ammo to consume:", { 
        specificAmmoId, 
        filteredAmmunitionItems: filteredAmmunitionItems.map(i => ({ id: i.id, name: i.name, isSpecial: i.system.isSpecialAmmo })), 
        loadedAmmoTypes 
      });
      
      let consumedAmmoItem = null;
      
      if (specificAmmoId) {
        // Use specific ammunition if provided
        console.log("Using specific ammunition:", specificAmmoId);
        const specificAmmoAmount = loadedAmmoTypes[specificAmmoId] || 0;
        
        if (specificAmmoAmount > 0) {
          consumedAmmoType = specificAmmoId;
          consumedAmmoItem = actor.items.get(specificAmmoId);
          console.log(`Selected SPECIFIC ammo for consumption: ${consumedAmmoItem?.name} (${specificAmmoId})`);
        } else {
          console.warn("Specific ammunition has no loaded rounds:", specificAmmoId);
          ui.notifications.warn("Selected ammunition has no loaded rounds.");
          return;
        }
      } else {
        // Use priority order: normal first, then special
        
        // Phase 1: Look for normal ammunition (isSpecialAmmo: false) first
        console.log("Phase 1: Searching for normal ammunition...");
        for (const ammoItem of filteredAmmunitionItems) {
          const ammoId = ammoItem.id;
          const ammoAmount = loadedAmmoTypes[ammoId] || 0;
          const isSpecial = ammoItem.system.isSpecialAmmo || false;
          console.log(`Checking ammo ${ammoItem.name} (${ammoId}): ${ammoAmount}, special: ${isSpecial}`);
          
          if (!isSpecial && ammoAmount > 0) {
            consumedAmmoType = ammoId;
            consumedAmmoItem = ammoItem;
            console.log(`Selected NORMAL ammo for consumption: ${ammoItem.name} (${ammoId})`);
            break;
          }
        }
        
        // Phase 2: If no normal ammunition available, look for special ammunition
        if (!consumedAmmoType) {
          console.log("Phase 2: No normal ammo available, searching for special ammunition...");
          for (const ammoItem of filteredAmmunitionItems) {
            const ammoId = ammoItem.id;
            const ammoAmount = loadedAmmoTypes[ammoId] || 0;
            const isSpecial = ammoItem.system.isSpecialAmmo || false;
            console.log(`Checking special ammo ${ammoItem.name} (${ammoId}): ${ammoAmount}, special: ${isSpecial}`);
            
            if (isSpecial && ammoAmount > 0) {
              consumedAmmoType = ammoId;
              consumedAmmoItem = ammoItem;
              console.log(`Selected SPECIAL ammo for consumption: ${ammoItem.name} (${ammoId})`);
              break;
            }
          }
        }
      }
      
      if (consumedAmmoType) {
        // Reduce the specific ammunition type by 1
        const updatedLoadedAmmoTypes = { ...loadedAmmoTypes };
        updatedLoadedAmmoTypes[consumedAmmoType] = Math.max(0, updatedLoadedAmmoTypes[consumedAmmoType] - 1);
        
        // Keep entry even if it becomes 0 to maintain ammunition order consistency
        // Do not delete entries - just set to 0
        console.log(`Reduced ${consumedAmmoType} from ${loadedAmmoTypes[consumedAmmoType]} to ${updatedLoadedAmmoTypes[consumedAmmoType]}`);
        console.log("Updated loadedAmmoTypes:", updatedLoadedAmmoTypes);
        
        // Calculate new total
        const newLoaded = Object.values(updatedLoadedAmmoTypes).reduce((sum, amount) => sum + amount, 0);
        
        await item.update({
          'system.loadedAmmo': newLoaded,
          'system.loadedAmmoTypes': updatedLoadedAmmoTypes
        });
        
        // Update weapon table display in real-time
        const actorSheet = this;
        if (actorSheet._updateWeaponTableAmmunition) {
          actorSheet._updateWeaponTableAmmunition(item._id, newLoaded, item.system.magazine, item.system.isFirearm);
        }
        
        // Update ammunition dialog if open
        if (actorSheet._ammunitionDialog && actorSheet._ammunitionDialog.rendered) {
          actorSheet._updateAmmunitionDialogInputs(item._id, updatedLoadedAmmoTypes);
        }
        
        const magazine = item.system.magazine || 0;
        const ammunitionDisplay = item.system.isFirearm ? `${newLoaded}/${magazine}` : newLoaded.toString();
        
        // Check if consumed ammunition is special
        const isSpecialAmmo = consumedAmmoItem && (consumedAmmoItem.system.isSpecialAmmo || false);
        const ammoTypeText = isSpecialAmmo ? 
          (game.i18n.localize("CARDIGAN.SpecialAmmunitionUsed") || "Special Ammunition Used") :
          (game.i18n.localize("CARDIGAN.AmmunitionUsed") || "Ammunition Used");
        
        const ammoIcon = isSpecialAmmo ? "fas fa-star" : "fas fa-crosshairs";
        const ammoColor = isSpecialAmmo ? "#FFD700" : "#2196F3";  // Gold for special, blue for normal
        
        ammunitionMessage = `<div style="text-align: center; margin-top: 4px; color: ${ammoColor}; font-size: 12px;">
          <i class="${ammoIcon}"></i> ${ammoTypeText}
          ${isSpecialAmmo ? `<span style="margin-left: 4px; font-size: 10px;">(${consumedAmmoItem.name})</span>` : ''}
        </div>
        <div style="text-align: center; margin-top: 2px; font-size: 12px; color: #666;">
          ${game.i18n.localize("CARDIGAN.RemainingAmmo") || "Remaining:"} ${ammunitionDisplay}
        </div>`;
      }
    }

    // Enviar rolagem de ataque para o chat (sempre pública)
    const attackMessage = await roll.toMessage({
      speaker: { alias: actor.name },  // Usar nome do ator ao invés do token
      flavor: flavor,
      rollMode: game.settings.get('core', 'rollMode'),
      flags: flags
    });
    
    // Aguardar animação do Dice So Nice terminar (se estiver ativo)
    if (game.dice3d) {
      await game.dice3d.waitFor3DAnimationByMessageID(attackMessage.id);
    }
    
    // 🆕 Determinar se a evasão deve ser cega (blind roll) para NPCs
    // Se o alvo NÃO tem dono jogador = é NPC do GM = rolagem cega
    const isNPCTarget = !targetActor.hasPlayerOwner;
    const rollMode = isNPCTarget ? CONST.DICE_ROLL_MODES.BLIND : CONST.DICE_ROLL_MODES.PUBLIC;
    
    console.log("Evasion roll mode check:", {
      targetName: targetActor.name,
      isNPC: isNPCTarget,
      hasPlayerOwner: targetActor.hasPlayerOwner,
      rollMode: rollMode
    });
    
    // Enviar rolagem de evasão para o chat
    const evasionFlavor = `<div style="text-align: center; margin-bottom: 4px;">
      <strong>Rolagem de Evasão</strong> - ${targetActor.name}
    </div>`;
    
    // IMPORTANTE: rollMode deve ser passado como SEGUNDO parâmetro de toMessage()
    const evasionMessage = await evasionRoll.toMessage(
      {
        speaker: { alias: targetActor.name },
        flavor: evasionFlavor
      },
      { rollMode: rollMode }  // <-- rollMode como segundo parâmetro!
    );
    
    // Aguardar animação do Dice So Nice terminar (se estiver ativo)
    // IMPORTANTE: Para rolagens blind, a animação só aparece para o GM, não para jogadores
    // Então só aguardamos se o usuário atual for GM OU se não for uma rolagem blind
    if (game.dice3d && (game.user.isGM || !isNPCTarget)) {
      await game.dice3d.waitFor3DAnimationByMessageID(evasionMessage.id);
    }

    // Criar conteúdo adicional para mostrar o dano total
    let additionalContent = `<div style="text-align: center; margin-top: 8px; padding: 4px 8px; background: rgba(0,0,0,0.1); border-radius: 3px;">
      <strong>${game.i18n.localize("CARDIGAN.DamageTotal")}: ${finalDamage}${isCriticalHit ? ` (${totalDamage} x2)` : ''}</strong>
    </div>${criticalMessage}${ammunitionMessage}`;

    // Criar segunda mensagem com o dano total APÓS as rolagens
    await ChatMessage.create({
      user: game.user.id,
      speaker: { alias: actor.name },  // Usar nome do ator ao invés do token
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

    // Check if there's enough space in backpack
    const requiredSpaces = this._calculateItemSpaces(item.system.weight, item.system.quantity || 1);
    
    // Calculate current backpack spaces
    const backpackItems = this.document.items.filter(i => {
      // Items that go to backpack table: unequipped items or specific types
      if (i.type === 'item-comum' || i.type === 'item-municao' || i.type === 'item-consumivel' || i.type === 'item-ingredient') {
        return true;
      }
      // Unequipped weapons and armors
      if (i.type === 'arma' && !i.system.equipped) return true;
      if (i.type === 'armadura' && !i.system.equipped) return true;
      return false;
    });
    
    const currentSpaces = this._calculateBackpackSpaces(backpackItems);
    const maxSpaces = this.document.system.backpack.max;
    
    console.log(`[UNEQUIP WEAPON CHECK] Current: ${currentSpaces}, Required: ${requiredSpaces}, Max: ${maxSpaces}`);
    
    if ((currentSpaces + requiredSpaces) > maxSpaces) {
      ui.notifications.warn(`Não é possível desequipar ${item.name}. Mochila cheia! Precisa de ${requiredSpaces} espaço(s) livre(s).`);
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

    // Check if there's enough space in backpack
    const requiredSpaces = this._calculateItemSpaces(item.system.weight, item.system.quantity || 1);
    
    // Calculate current backpack spaces
    const backpackItems = this.document.items.filter(i => {
      // Items that go to backpack table: unequipped items or specific types
      if (i.type === 'item-comum' || i.type === 'item-municao' || i.type === 'item-consumivel' || i.type === 'item-ingredient') {
        return true;
      }
      // Unequipped weapons and armors
      if (i.type === 'arma' && !i.system.equipped) return true;
      if (i.type === 'armadura' && !i.system.equipped) return true;
      return false;
    });
    
    const currentSpaces = this._calculateBackpackSpaces(backpackItems);
    const maxSpaces = this.document.system.backpack.max;
    
    console.log(`[UNEQUIP ARMOR CHECK] Current: ${currentSpaces}, Required: ${requiredSpaces}, Max: ${maxSpaces}`);
    
    if ((currentSpaces + requiredSpaces) > maxSpaces) {
      ui.notifications.warn(`Não é possível desequipar ${item.name}. Mochila cheia! Precisa de ${requiredSpaces} espaço(s) livre(s).`);
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
   * Handle consuming a consumable item
   * @param {Event} event           The originating click event
   * @param {HTMLElement} target    The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   * @protected
   */
  static async _onConsumeItem(event, target) {
    event.preventDefault();
    
    const itemId = target.dataset.itemId;
    const item = this.document.items.get(itemId);
    
    if (!item || item.type !== 'item-consumivel') {
      ui.notifications.warn("Item não encontrado ou não é um consumível.");
      return;
    }

    const currentQuantity = item.system.quantity || 0;
    if (currentQuantity <= 0) {
      ui.notifications.warn(`${item.name} não possui unidades disponíveis para consumo.`);
      return;
    }

    // Show quantity selection dialog
    const quantityToConsume = await CardiganSystemActorSheet._showQuantityDialog(item.name, currentQuantity);
    if (!quantityToConsume) return; // User cancelled

    // Process consumption
    await this._processItemConsumption(item, quantityToConsume);
  }

  /**
   * Show dialog to select quantity to consume
   * @param {string} itemName - Name of the item
   * @param {number} maxQuantity - Maximum available quantity
   * @returns {Promise<number|null>} - Selected quantity or null if cancelled
   * @private
   */
  static async _showQuantityDialog(itemName, maxQuantity) {
    return new Promise(resolve => {
      new foundry.applications.api.DialogV2({
        window: {
          title: `Consumir ${itemName}`,
          contentClasses: ["cardigan-dialog"]
        },
        content: `
          <div class="form-group">
            <label>Quantidade a consumir:</label>
            <input type="number" name="quantity" value="1" min="1" max="${maxQuantity}" style="width: 100%; margin-top: 5px;">
            <small>Disponível: ${maxQuantity} unidade(s)</small>
          </div>
        `,
        buttons: [
          {
            action: "consume",
            icon: "fas fa-flask",
            label: "Consumir",
            default: true,
            callback: (event, button, dialog) => {
              const quantity = parseInt(dialog.element.querySelector('[name="quantity"]').value) || 1;
              if (quantity > maxQuantity || quantity < 1) {
                ui.notifications.warn("Quantidade inválida.");
                resolve(null);
              } else {
                resolve(quantity);
              }
            }
          },
          {
            action: "cancel",
            icon: "fas fa-times",
            label: "Cancelar",
            callback: () => resolve(null)
          }
        ],
        render: (event, dialog) => {
          const input = dialog.element.querySelector('[name="quantity"]');
          if (input) {
            input.focus();
            input.select();
          }
        }
      }).render(true);
    });
  }

  /**
   * Process the consumption of an item and apply effects using tracking system
   * @param {Item} item - The consumable item
   * @param {number} quantity - Quantity to consume
   * @private
   */
  async _processItemConsumption(item, quantity) {
    try {
      // Process skill check if enabled and track results
      let rollResult = null;
      if (item.system.hasSkillCheck && item.system.skillCheckAbility) {
        rollResult = await this._processSkillCheck(item);
      }

      // Determine roll type for tracking
      let rollType = 'normal';
      if (rollResult) {
        if (rollResult.isCriticalFailure) {
          rollType = 'critical-failure';
        } else if (rollResult.isCriticalHit) {
          rollType = 'critical-hit';
        }
      }

      // Collect effects to apply (normal consumption effects)
      const appliedEffects = [];
      const appliedSkillBonuses = [];
      const messages = [];

      // Process normal effects from the item
      const effects = item.system.effects || [];
      for (const effect of effects) {
        if (!effect.effectId || (!effect.apply && !effect.remove)) continue;

        // Get effect from compendium
        const pack = game.packs.get("cardigan.efeitos-cardigan");
        const effectDocument = await pack.getDocument(effect.effectId);
        
        if (!effectDocument) {
          console.warn(`Effect ${effect.effectId} not found in compendium`);
          continue;
        }

        const effectName = effectDocument.name;

        if (effect.apply) {
          // Check if effect already exists
          const existingEffect = this.document.items.find(i => 
            i.type === 'efeito' && 
            i.name === effectName &&
            !i.system.consumableTracking?.isTrackingEffect
          );

          if (existingEffect) {
            messages.push(`Effect ${effectName} was already active`);
          } else {
            // Create new effect on actor
            const effectData = foundry.utils.deepClone(effectDocument.toObject());
            effectData._id = foundry.utils.randomID();
            
            await this.document.createEmbeddedDocuments("Item", [effectData]);
            appliedEffects.push(effect.effectId);
            messages.push(`Applied effect: ${effectName}`);
          }
        } else if (effect.remove) {
          // Find and remove effect
          const existingEffect = this.document.items.find(i => 
            i.type === 'efeito' && 
            i.name === effectName &&
            !i.system.consumableTracking?.isTrackingEffect
          );
          
          if (existingEffect) {
            await existingEffect.delete();
            messages.push(`Removed effect: ${effectName}`);
          } else {
            messages.push(`Effect ${effectName} was not active`);
          }
        }
      }

      // Process temporary skill bonuses (always applied on consumption)
      if (item.system.hasTemporarySkillBonus && item.system.temporarySkillBonus?.length > 0) {
        const validBonuses = item.system.temporarySkillBonus.filter(bonus => 
          bonus.ability && bonus.ability.trim() !== "" && bonus.value && bonus.value !== 0
        );
        
        if (validBonuses.length > 0) {
          appliedSkillBonuses.push(...validBonuses);
          const bonusMessages = validBonuses.map(bonus => 
            `${bonus.ability}: +${bonus.value}`
          );
          messages.push(`Applied temporary skill bonuses: ${bonusMessages.join(', ')}`);
        }
      }

      // Process health modifier (always applied on consumption)
      console.log("[CONSUME] Checking health modifier:", {
        hasHealthModifier: item.system.hasHealthModifier,
        healthModifierDice: item.system.healthModifierDice,
        healthModifierType: item.system.healthModifierType
      });
      
      if (item.system.hasHealthModifier && item.system.healthModifierDice) {
        console.log("[CONSUME] Processing health modifier for item:", item.name);
        const healthModifierResult = await this._processHealthModifier(item);
        if (healthModifierResult) {
          messages.push(healthModifierResult.message);
          console.log("[CONSUME] Health modifier processed, message added:", healthModifierResult.message);
        } else {
          console.log("[CONSUME] Health modifier processing returned null");
        }
      } else {
        console.log("[CONSUME] Health modifier not configured or not enabled");
      }

      // Process energy modifier (always applied on consumption)
      console.log("[CONSUME] Checking energy modifier:", {
        hasEnergyModifier: item.system.hasEnergyModifier,
        energyModifierDice: item.system.energyModifierDice,
        energyModifierType: item.system.energyModifierType
      });
      
      if (item.system.hasEnergyModifier && item.system.energyModifierDice) {
        console.log("[CONSUME] Processing energy modifier for item:", item.name);
        const energyModifierResult = await this._processEnergyModifier(item);
        if (energyModifierResult) {
          messages.push(energyModifierResult.message);
          console.log("[CONSUME] Energy modifier processed, message added:", energyModifierResult.message);
        } else {
          console.log("[CONSUME] Energy modifier processing returned null");
        }
      } else {
        console.log("[CONSUME] Energy modifier not configured or not enabled");
      }

      // Process armor bonus (always applied on consumption)
      console.log("[CONSUME] Checking armor bonus:", {
        hasArmorBonus: item.system.hasArmorBonus,
        armorBonusAmount: item.system.armorBonusAmount
      });

      if (item.system.hasArmorBonus && item.system.armorBonusAmount > 0) {
        console.log("[CONSUME] Processing armor bonus for item:", item.name);
        const armorBonusResult = await this._processArmorBonus(item);
        if (armorBonusResult) {
          messages.push(armorBonusResult.message);
          console.log("[CONSUME] Armor bonus processed, message added:", armorBonusResult.message);
        } else {
          console.log("[CONSUME] Armor bonus processing returned null");
        }
      } else {
        console.log("[CONSUME] Armor bonus not configured or not enabled");
      }

      // Process status ailments (always applied on consumption)
      console.log("[CONSUME] Checking status ailments:", {
        hasStatusAilments: item.system.hasStatusAilments,
        hasSanityModifier: item.system.hasSanityModifier,
        sanityModifierType: item.system.sanityModifierType,
        sanityModifierAmount: item.system.sanityModifierAmount
      });

      if (item.system.hasStatusAilments && item.system.hasSanityModifier && item.system.sanityModifierAmount > 0) {
        console.log("[CONSUME] Processing status ailments for item:", item.name);
        const statusAilmentsResult = await this._processStatusAilments(item);
        if (statusAilmentsResult) {
          messages.push(statusAilmentsResult.message);
          console.log("[CONSUME] Status ailments processed, message added:", statusAilmentsResult.message);
        } else {
          console.log("[CONSUME] Status ailments processing returned null");
        }
      } else {
        console.log("[CONSUME] Status ailments not configured or not enabled");
      }

      // Process toxicity modifier (always applied on consumption)
      console.log("[CONSUME] Checking toxicity:", {
        hasToxicityModifier: item.system.hasToxicityModifier,
        toxicityModifierType: item.system.toxicityModifierType,
        toxicityModifierAmount: item.system.toxicityModifierAmount
      });

      if (item.system.hasToxicityModifier && item.system.toxicityModifierAmount > 0) {
        console.log("[CONSUME] Processing toxicity for item:", item.name);
        const toxicityResult = await this._processToxicity(item);
        if (toxicityResult) {
          messages.push(toxicityResult.message);
          console.log("[CONSUME] Toxicity processed, message added:", toxicityResult.message);
        } else {
          console.log("[CONSUME] Toxicity processing returned null");
        }
      } else {
        console.log("[CONSUME] Toxicity not configured or not enabled");
      }

      // Process fracture modifier (always applied on consumption)
      console.log("[CONSUME] Checking fracture:", {
        hasFractureModifier: item.system.hasFractureModifier,
        fractureModifierType: item.system.fractureModifierType,
        fractureModifierAmount: item.system.fractureModifierAmount
      });

      if (item.system.hasFractureModifier && item.system.fractureModifierAmount > 0) {
        console.log("[CONSUME] Processing fracture for item:", item.name);
        const fractureResult = await this._processFracture(item);
        if (fractureResult) {
          messages.push(fractureResult.message);
          console.log("[CONSUME] Fracture processed, message added:", fractureResult.message);
        } else {
          console.log("[CONSUME] Fracture processing returned null");
        }
      } else {
        console.log("[CONSUME] Fracture not configured or not enabled");
      }

      // Process food modifier (always applied on consumption)
      console.log("[CONSUME] Checking food:", {
        hasFoodAndWater: item.system.hasFoodAndWater,
        hasFoodModifier: item.system.hasFoodModifier,
        foodModifierType: item.system.foodModifierType,
        foodModifierAmount: item.system.foodModifierAmount
      });

      if (item.system.hasFoodAndWater && item.system.hasFoodModifier && item.system.foodModifierAmount > 0) {
        console.log("[CONSUME] Processing food for item:", item.name);
        const foodResult = await this._processFood(item);
        if (foodResult) {
          messages.push(foodResult.message);
          console.log("[CONSUME] Food processed, message added:", foodResult.message);
        } else {
          console.log("[CONSUME] Food processing returned null");
        }
      } else {
        console.log("[CONSUME] Food not configured or not enabled");
      }

      // Process water modifier (always applied on consumption)
      console.log("[CONSUME] Checking water:", {
        hasFoodAndWater: item.system.hasFoodAndWater,
        hasWaterModifier: item.system.hasWaterModifier,
        waterModifierType: item.system.waterModifierType,
        waterModifierAmount: item.system.waterModifierAmount
      });

      if (item.system.hasFoodAndWater && item.system.hasWaterModifier && item.system.waterModifierAmount > 0) {
        console.log("[CONSUME] Processing water for item:", item.name);
        const waterResult = await this._processWater(item);
        if (waterResult) {
          messages.push(waterResult.message);
          console.log("[CONSUME] Water processed, message added:", waterResult.message);
        } else {
          console.log("[CONSUME] Water processing returned null");
        }
      } else {
        console.log("[CONSUME] Water not configured or not enabled");
      }

      // Track applied attribute modifiers for the tracking item
      const appliedAttributeModifiers = [];

      // Process movement boost
      console.log("[CONSUME] Checking movement boost:", {
        hasMovementBoost: item.system.hasMovementBoost,
        movementBoostAmount: item.system.movementBoostAmount
      });

      if (item.system.hasMovementBoost && item.system.movementBoostAmount > 0) {
        console.log("[CONSUME] Processing movement boost for item:", item.name);
        const movementResult = await this._processMovementBoost(item);
        if (movementResult) {
          messages.push(movementResult.message);
          appliedAttributeModifiers.push({
            type: 'movement',
            amount: item.system.movementBoostAmount,
            label: `Movement +${item.system.movementBoostAmount}`
          });
          console.log("[CONSUME] Movement boost processed, message added:", movementResult.message);
        } else {
          console.log("[CONSUME] Movement boost processing returned null");
        }
      } else {
        console.log("[CONSUME] Movement boost not configured or not enabled");
      }

      // Process critical hit boost
      console.log("[CONSUME] Checking critical hit boost:", {
        hasCriticalHitBoost: item.system.hasCriticalHitBoost,
        criticalHitBoostAmount: item.system.criticalHitBoostAmount
      });

      if (item.system.hasCriticalHitBoost && item.system.criticalHitBoostAmount > 0) {
        console.log("[CONSUME] Processing critical hit boost for item:", item.name);
        const criticalHitResult = await this._processCriticalHitBoost(item);
        if (criticalHitResult) {
          messages.push(criticalHitResult.message);
          appliedAttributeModifiers.push({
            type: 'criticalHit',
            amount: item.system.criticalHitBoostAmount,
            label: `Critical Hit -${item.system.criticalHitBoostAmount}`
          });
          console.log("[CONSUME] Critical hit boost processed, message added:", criticalHitResult.message);
        } else {
          console.log("[CONSUME] Critical hit boost processing returned null");
        }
      } else {
        console.log("[CONSUME] Critical hit boost not configured or not enabled");
      }

      // If we have a roll result with critical effects, they were already processed
      // and stored in the rollResult. We need to collect them for tracking.
      if (rollResult && rollResult.isCriticalFailure) {
        // Critical failure effects were already processed in _processCriticalFailure
        // We need to collect what was applied for tracking
        if (item.system.hasCriticalFailureEffects && item.system.criticalFailureEffects?.length > 0) {
          appliedEffects.push(...item.system.criticalFailureEffects.filter(id => id && id.trim() !== ""));
        }
        if (item.system.hasCriticalFailureSkillLoss && item.system.criticalFailureSkillLoss?.length > 0) {
          // Convert skill losses to negative bonuses for tracking
          const skillLosses = item.system.criticalFailureSkillLoss.map(loss => ({
            ability: loss.ability,
            value: -loss.value // Store as negative for tracking
          }));
          appliedSkillBonuses.push(...skillLosses);
        }
      }

      if (rollResult && rollResult.isCriticalHit) {
        // Critical hit effects were already processed in _processCriticalHit
        if (item.system.hasCriticalHitEffects && item.system.criticalHitEffects?.length > 0) {
          appliedEffects.push(...item.system.criticalHitEffects.filter(id => id && id.trim() !== ""));
        }
        if (item.system.hasCriticalHitSkillBonus && item.system.criticalHitSkillBonus?.length > 0) {
          appliedSkillBonuses.push(...item.system.criticalHitSkillBonus);
        }
      }

      // Apply skill bonuses directly to abilities
      if (appliedSkillBonuses.length > 0) {
        await this._applySkillBonuses(appliedSkillBonuses);
      }

      // Create tracking effect item if there were any effects, bonuses, or attribute modifiers applied
      if (appliedEffects.length > 0 || appliedSkillBonuses.length > 0 || appliedAttributeModifiers.length > 0) {
        await this._createTrackingEffectItem(item, rollType, appliedEffects, appliedSkillBonuses, appliedAttributeModifiers);
      }

      // Update item quantity or remove if depleted
      const newQuantity = Math.max(0, (item.system.quantity || 0) - quantity);
      
      if (newQuantity <= 0) {
        await item.delete();
      } else {
        await item.update({ "system.quantity": newQuantity });
      }

      // Show success message
      const consumeMessage = newQuantity <= 0 
        ? `${item.name} foi consumido completamente (${quantity} unidade(s))`
        : `${item.name} foi consumido (${quantity} unidade(s))`;
        
      if (messages.length > 0) {
        ui.notifications.info(`${consumeMessage}. ${messages.join('. ')}.`);
      } else {
        ui.notifications.info(`${consumeMessage}.`);
      }

      // Force re-render after consumption
      await this.render(false);

    } catch (error) {
      console.error("Error consuming item:", error);
      ui.notifications.error("Erro ao consumir o item.");
    }
  }

  /**
   * Process a skill check for item consumption
   * @param {Item} item - The consumable item with skill check
   * @returns {Promise<Object|null>} - Roll result or null if failed
   * @private
   */
  async _processSkillCheck(item) {
    try {
      const ability = item.system.skillCheckAbility;
      const hasAdvantage = item.system.skillCheckAdvantage;
      
      // Get the ability value and total bonus
      const abilityData = this.document.system.abilities[ability];
      const abilityValue = abilityData.value || 0;
      const abilityBonus = abilityData.totalBonus || 0;
      const totalModifier = abilityValue + abilityBonus;
      
      // Create roll formula based on advantage
      let rollFormula;
      let flavorText;
      
      if (hasAdvantage) {
        rollFormula = `2d20kh1 + ${totalModifier}`;
        flavorText = `${item.name} - ${game.i18n.localize(`CARDIGAN.Ability.${ability.charAt(0).toUpperCase() + ability.slice(1)}.long`)} Check (Advantage)`;
      } else {
        rollFormula = `1d20 + ${totalModifier}`;
        flavorText = `${item.name} - ${game.i18n.localize(`CARDIGAN.Ability.${ability.charAt(0).toUpperCase() + ability.slice(1)}.long`)} Check`;
      }
      
      // Create and evaluate the roll
      const roll = await Roll.create(rollFormula, this.document.getRollData());
      await roll.evaluate();
      
      // Check for critical failure (natural 1 on any d20)
      const isCriticalFailure = this._checkCriticalFailure(roll, hasAdvantage);
      
      // Check for critical hit (for all ability rolls)
      const isCriticalHit = this._checkCriticalHit(roll, hasAdvantage);
      
      // Process critical failure effects if applicable
      if (isCriticalFailure) {
        await this._processCriticalFailure(item, roll);
      }
      
      // Process critical hit effects if applicable
      if (isCriticalHit) {
        await this._processCriticalHit(item, roll);
      }
      
      // Use Foundry's native roll-to-chat system with colored total
      const rollData = {
        speaker: ChatMessage.getSpeaker({ actor: this.document }),
        flavor: `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                   <i class="fas fa-dice-d20" style="color: #2196F3;"></i>
                   <strong>${flavorText}</strong>
                   ${isCriticalHit ? '<span style="color: #4CAF50; font-weight: bold; margin-left: 8px;">[CRITICAL HIT]</span>' : ''}
                   ${isCriticalFailure ? '<span style="color: #FF5722; font-weight: bold; margin-left: 8px;">[CRITICAL FAILURE]</span>' : ''}
                 </div>`,
        rollMode: game.settings.get("core", "rollMode"),
        flags: {
          cardigan: {
            isCriticalHit: isCriticalHit,
            isCriticalFailure: isCriticalFailure
          }
        }
      };
      
      await roll.toMessage(rollData);

      return {
        roll: roll,
        total: roll.total,
        formula: rollFormula,
        ability: ability,
        hasAdvantage: hasAdvantage,
        isCriticalFailure: isCriticalFailure,
        isCriticalHit: isCriticalHit
      };

    } catch (error) {
      console.error("Error processing skill check:", error);
      ui.notifications.warn(`Erro no teste de perícia: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if a roll resulted in a critical failure
   * @param {Roll} roll - The roll to check
   * @param {boolean} hasAdvantage - Whether the roll had advantage
   * @returns {boolean} Whether the roll is a critical failure
   * @private
   */
  _checkCriticalFailure(roll, hasAdvantage) {
    try {
      if (!roll) return false;
      
      // Critical failure occurs when the total result is 1 or less
      const totalResult = roll.total;
      if (totalResult <= 1) return true;
      
      // Also check for natural 1s on the dice (traditional critical failure)
      if (!roll.dice || roll.dice.length === 0) return false;
      
      // Find the d20 die in the roll
      const d20Die = roll.dice.find(die => die.faces === 20);
      if (!d20Die || !d20Die.results || d20Die.results.length === 0) return false;
      
      // For advantage rolls (2d20kh1), critical failure only occurs if both dice show natural 1
      if (hasAdvantage) {
        if (d20Die.results.length < 2) return false;
        const results = d20Die.results.map(r => r?.result).filter(r => r !== undefined);
        return results.length >= 2 && results.every(result => result === 1);
      } else {
        // For normal rolls (1d20), critical failure occurs on natural 1
        const firstResult = d20Die.results[0];
        return firstResult && firstResult.result === 1;
      }
    } catch (error) {
      console.warn("Error checking critical failure:", error);
      return false;
    }
  }

  /**
   * Check if a roll resulted in a critical hit (for all abilities)
   * @param {Roll} roll - The roll to check
   * @param {boolean} hasAdvantage - Whether the roll had advantage
   * @returns {boolean} Whether the roll is a critical hit
   * @private
   */
  _checkCriticalHit(roll, hasAdvantage) {
    try {
      if (!roll || !roll.dice || roll.dice.length === 0) return false;
      
      // Find the d20 die in the roll
      const d20Die = roll.dice.find(die => die.faces === 20);
      if (!d20Die || !d20Die.results || d20Die.results.length === 0) return false;
      
      // Critical hit when total roll is 20 or higher
      return roll.total >= 20;
    } catch (error) {
      console.warn("Error checking critical hit:", error);
      return false;
    }
  }

  /**
   * Process critical failure effects and skill losses
   * @param {Item} item - The item being used
   * @param {Roll} roll - The failed roll
   * @private
   */
  async _processCriticalFailure(item, roll) {
    try {
      const criticalFailureMessages = [];
      
      // Apply critical failure effects
      if (item.system.hasCriticalFailureEffects && item.system.criticalFailureEffects?.length > 0) {
        for (const effectId of item.system.criticalFailureEffects) {
          if (effectId && effectId.trim() !== "") {
            await this._applyCriticalFailureEffect(effectId);
            
            // Get effect name for message
            const effect = game.packs.find(p => p.metadata.id === "cardigan.efeitos-cardigan")?.index.get(effectId);
            const effectName = effect?.name || effectId;
            criticalFailureMessages.push(`Applied effect: <strong>${effectName}</strong>`);
          }
        }
      }
      
      // Skill losses will be applied by the unified _applySkillBonuses method
      // just prepare the messages for chat
      if (item.system.hasCriticalFailureSkillLoss && item.system.criticalFailureSkillLoss?.length > 0) {
        for (const skillLoss of item.system.criticalFailureSkillLoss) {
          if (skillLoss.ability && skillLoss.value > 0) {
            const abilityName = game.i18n.localize(`CARDIGAN.Ability.${skillLoss.ability.charAt(0).toUpperCase() + skillLoss.ability.slice(1)}.long`);
            criticalFailureMessages.push(`Lost <strong>${skillLoss.value}</strong> points from <strong>${abilityName}</strong>`);
          }
        }
      }
      
      // Send critical failure message to chat if there were any effects
      if (criticalFailureMessages.length > 0) {
        const messageContent = `
          <div style="background: rgba(255, 87, 34, 0.1); border: 1px solid #FF5722; border-radius: 4px; padding: 8px; margin-top: 8px;">
            <div style="color: #FF5722; font-weight: bold; margin-bottom: 4px;">
              <i class="fas fa-exclamation-triangle"></i> Critical Failure Effects:
            </div>
            <ul style="margin: 0; padding-left: 16px;">
              ${criticalFailureMessages.map(msg => `<li>${msg}</li>`).join('')}
            </ul>
          </div>
        `;
        
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.document }),
          content: messageContent,
          rollMode: game.settings.get("core", "rollMode")
        });
      }
      
    } catch (error) {
      console.error("Error processing critical failure:", error);
      ui.notifications.warn(`Erro ao processar falha crítica: ${error.message}`);
    }
  }

  /**
   * Apply a critical failure effect to the actor
   * @param {string} effectId - The ID of the effect to apply
   * @private
   */
  async _applyCriticalFailureEffect(effectId) {
    try {
      // Get the effect from the compendium
      const pack = game.packs.get("cardigan.efeitos-cardigan");
      if (!pack) {
        console.warn("Could not find effects compendium");
        return;
      }
      
      const effectDocument = await pack.getDocument(effectId);
      if (!effectDocument) {
        console.warn(`Could not find effect with ID: ${effectId}`);
        return;
      }
      
      // Create the effect on the actor
      const effectData = effectDocument.toObject();
      effectData.origin = `Actor.${this.document.id}`;
      
      await this.document.createEmbeddedDocuments("Item", [effectData]);
      
    } catch (error) {
      console.error(`Error applying critical failure effect ${effectId}:`, error);
    }
  }

  /**
   * Apply skill loss from critical failure
   * @param {string} ability - The ability to reduce
   * @param {number} lossValue - The amount to reduce
   * @private
   */
  async _applyCriticalFailureSkillLoss(ability, lossValue) {
    try {
      const abilityData = this.document.system.abilities[ability];
      
      // We need to modify manualValue, not value (which is calculated)
      const currentManualValue = abilityData?.manualValue || 0;
      const newManualValue = currentManualValue - lossValue; // Can go negative as penalties
      
      const updateData = {};
      updateData[`system.abilities.${ability}.manualValue`] = newManualValue;
      
      await this.document.update(updateData);
      
    } catch (error) {
      console.error(`Error applying skill loss for ${ability}:`, error);
    }
  }

  /**
   * Process critical hit effects and skill bonuses
   * @param {Item} item - The item being used
   * @param {Roll} roll - The successful roll
   * @private
   */
  async _processCriticalHit(item, roll) {
    try {
      const criticalHitMessages = [];
      
      // Apply critical hit effects
      if (item.system.hasCriticalHitEffects && item.system.criticalHitEffects?.length > 0) {
        for (const effectId of item.system.criticalHitEffects) {
          if (effectId && effectId.trim() !== "") {
            await this._applyCriticalHitEffect(effectId);
            
            // Get effect name for message
            const effect = game.packs.find(p => p.metadata.id === "cardigan.efeitos-cardigan")?.index.get(effectId);
            const effectName = effect?.name || effectId;
            criticalHitMessages.push(`Applied effect: <strong>${effectName}</strong>`);
          }
        }
      }
      
      // Skill bonuses will be applied by the unified _applySkillBonuses method
      // just prepare the messages for chat
      if (item.system.hasCriticalHitSkillBonus && item.system.criticalHitSkillBonus?.length > 0) {
        for (const skillBonus of item.system.criticalHitSkillBonus) {
          if (skillBonus.ability && skillBonus.value > 0) {
            const abilityName = game.i18n.localize(`CARDIGAN.Ability.${skillBonus.ability.charAt(0).toUpperCase() + skillBonus.ability.slice(1)}.long`);
            criticalHitMessages.push(`Gained <strong>${skillBonus.value}</strong> bonus to <strong>${abilityName}</strong>`);
          }
        }
      }
      
      // Send critical hit message to chat if there were any effects
      if (criticalHitMessages.length > 0) {
        const messageContent = `
          <div style="background: rgba(76, 175, 80, 0.1); border: 1px solid #4CAF50; border-radius: 4px; padding: 8px; margin-top: 8px;">
            <div style="color: #4CAF50; font-weight: bold; margin-bottom: 4px;">
              <i class="fas fa-star"></i> Critical Hit Effects:
            </div>
            <ul style="margin: 0; padding-left: 16px;">
              ${criticalHitMessages.map(msg => `<li>${msg}</li>`).join('')}
            </ul>
          </div>
        `;
        
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.document }),
          content: messageContent,
          rollMode: game.settings.get("core", "rollMode")
        });
      }
      
    } catch (error) {
      console.error("Error processing critical hit:", error);
      ui.notifications.warn(`Erro ao processar acerto crítico: ${error.message}`);
    }
  }

  /**
   * Apply a critical hit effect to the actor
   * @param {string} effectId - The ID of the effect to apply
   * @private
   */
  async _applyCriticalHitEffect(effectId) {
    try {
      // Get the effect from the compendium
      const pack = game.packs.get("cardigan.efeitos-cardigan");
      if (!pack) {
        console.warn("Could not find effects compendium");
        return;
      }
      
      const effectDocument = await pack.getDocument(effectId);
      if (!effectDocument) {
        console.warn(`Could not find effect with ID: ${effectId}`);
        return;
      }
      
      // Create the effect on the actor
      const effectData = effectDocument.toObject();
      effectData.origin = `Actor.${this.document.id}`;
      
      await this.document.createEmbeddedDocuments("Item", [effectData]);
      
    } catch (error) {
      console.error(`Error applying critical hit effect ${effectId}:`, error);
    }
  }

  /**
   * Apply skill bonus from critical hit
   * @param {string} ability - The ability to bonus
   * @param {number} bonusValue - The amount to add
   * @private
   */
  async _applyCriticalHitSkillBonus(ability, bonusValue) {
    try {
      const abilityData = this.document.system.abilities[ability];
      
      // We need to modify manualBonus, which is part of totalBonus calculation
      const currentManualBonus = abilityData?.manualBonus || 0;
      const newManualBonus = currentManualBonus + bonusValue;
      
      const updateData = {};
      updateData[`system.abilities.${ability}.manualBonus`] = newManualBonus;
      
      await this.document.update(updateData);
      
    } catch (error) {
      console.error(`Error applying skill bonus for ${ability}:`, error);
    }
  }

  /**
   * Apply skill bonuses directly to actor abilities
   * @param {Array} appliedSkillBonuses - Array of skill bonuses to apply
   * @private
   */
  async _applySkillBonuses(appliedSkillBonuses) {
    const updateData = {};
    
    for (const bonus of appliedSkillBonuses) {
      const ability = bonus.ability;
      const bonusValue = bonus.bonus || bonus.value || 0; // Support both bonus and value fields
      
      if (ability && bonusValue !== 0) {
        const abilityData = this.document.system.abilities[ability];
        
        if (bonusValue < 0) {
          // This is a penalty (Critical Failure Skill Loss) - apply to manualValue
          const currentManualValue = abilityData?.manualValue || 0;
          const newManualValue = currentManualValue + bonusValue; // bonusValue is negative
          updateData[`system.abilities.${ability}.manualValue`] = newManualValue;
          
          console.log(`[CARDIGAN] Applied ${bonusValue} penalty to ${ability}.manualValue: ${currentManualValue} -> ${newManualValue}`);
        } else {
          // This is a bonus (Critical Hit or Temporary Skill Bonus) - apply to manualBonus
          const currentManualBonus = abilityData?.manualBonus || 0;
          const newManualBonus = currentManualBonus + bonusValue;
          updateData[`system.abilities.${ability}.manualBonus`] = newManualBonus;
          
          console.log(`[CARDIGAN] Applied ${bonusValue} bonus to ${ability}.manualBonus: ${currentManualBonus} -> ${newManualBonus}`);
        }
      }
    }
    
    if (Object.keys(updateData).length > 0) {
      await this.document.update(updateData);
    }
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
    try {
      // Create descriptive name based on roll type
      let itemName = originalItem.name;
      let description = `Effects from consuming ${originalItem.name}`;
      
      switch (rollType) {
        case 'critical-failure':
          itemName += ' (Critical Failure)';
          description = `Critical failure effects from consuming ${originalItem.name}`;
          break;
        case 'critical-hit':
          itemName += ' (Critical Hit)';
          description = `Critical hit effects from consuming ${originalItem.name}`;
          break;
        default:
          itemName += ' (Consumed)';
          break;
      }

      // Build description with applied effects
      const effectDescriptions = [];
      
      if (appliedEffects.length > 0) {
        effectDescriptions.push('<strong>Applied Effects:</strong>');
        for (const effectId of appliedEffects) {
          // Try to get effect name from compendium
          const pack = game.packs.get("cardigan.efeitos-cardigan");
          if (pack) {
            const effectDoc = await pack.getDocument(effectId);
            const effectName = effectDoc?.name || effectId;
            effectDescriptions.push(`• ${effectName}`);
          }
        }
      }

      if (appliedSkillBonuses.length > 0) {
        effectDescriptions.push('<strong>Applied Skill Bonuses:</strong>');
        for (const bonus of appliedSkillBonuses) {
          const abilityName = game.i18n.localize(`CARDIGAN.Ability.${bonus.ability.charAt(0).toUpperCase() + bonus.ability.slice(1)}.long`);
          const bonusValue = bonus.value || bonus.bonus || 0;
          const sign = bonusValue >= 0 ? '+' : '';
          effectDescriptions.push(`• ${abilityName}: ${sign}${bonusValue}`);
        }
      }

      if (appliedAttributeModifiers.length > 0) {
        effectDescriptions.push('<strong>Applied Attribute Modifiers:</strong>');
        for (const modifier of appliedAttributeModifiers) {
          if (modifier.type === 'movement') {
            effectDescriptions.push(`• Movement: +${modifier.amount}`);
          } else if (modifier.type === 'criticalHit') {
            effectDescriptions.push(`• Critical Hit: -${modifier.amount} (improved)`);
          }
        }
      }

      if (effectDescriptions.length > 0) {
        description += '<br><br>' + effectDescriptions.join('<br>');
      }

      // Create the tracking effect item
      const trackingItemData = {
        name: itemName,
        type: 'efeito',
        system: {
          description: description,
          efeitoType: 'positivo', // Tracking effects are positive
          consumableTracking: {
            isTrackingEffect: true,
            originalItemName: originalItem.name,
            originalItemId: originalItem.id,
            rollType: rollType,
            appliedEffects: appliedEffects,
            appliedSkillBonuses: appliedSkillBonuses,
            appliedAttributeModifiers: appliedAttributeModifiers,
          }
        }
      };

      // Create the item on the actor
      const createdItems = await this.document.createEmbeddedDocuments("Item", [trackingItemData]);
      return createdItems[0];

    } catch (error) {
      console.error("Error creating tracking effect item:", error);
      throw error;
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
    const isWeapon = item.type === 'arma';
    const isSkill = item.type === 'skill';
    const isRecipe = item.type?.includes('recipe') || item.type?.includes('-recipe');
    
    let summaryClass;
    if (isArmor) summaryClass = ".armor-summary";
    else if (isWeapon) summaryClass = ".weapon-summary";
    else if (isSkill) summaryClass = ".skill-summary";
    else if (isRecipe) summaryClass = ".recipe-summary";
    else summaryClass = ".weapon-summary"; // fallback
    
    if (expanded) {
      // Collapse
      this.expandedSections.set(itemId, false);
      summary.querySelector(summaryClass)?.remove();
    } else {
      // Expand
      try {
        // Get item data for summary
        const context = {
          actor: this.actor, // Add actor to context for ingredient checking
          item: item,
          system: item.system,
          config: CONFIG.CARDIGAN,
          enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description || "", {
            secrets: item.isOwner,
            documents: true,
            links: true,
            rolls: true,
            rollData: item.getRollData?.() || {}
          })
        };
        
        // Process enhancements for skills
        if (isSkill && item.system.enhancements && Array.isArray(item.system.enhancements)) {
          const enhancements = [];
          for (let i = 0; i < item.system.enhancements.length; i++) {
            const enhancement = item.system.enhancements[i];
            const isAcquired = item.system.acquiredEnhancements?.[i] === true;
            
            // Only show enhancements that have a description
            if (enhancement?.description) {
              enhancements.push({
                number: i + 1,
                name: enhancement.name || `Enhancement ${i + 1}`,
                description: enhancement.description,
                acquired: isAcquired,
                enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(enhancement.description, {
                  secrets: item.isOwner,
                  documents: true,
                  links: true,
                  rolls: true,
                  rollData: item.getRollData?.() || {}
                })
              });
            }
          }
          if (enhancements.length > 0) {
            context.enhancements = enhancements;
          }
        }
        
        // Choose template based on item type
        let template;
        if (isArmor) {
          template = "systems/cardigan/templates/armors/armor-summary.hbs";
        } else if (isSkill) {
          template = "systems/cardigan/templates/skills/skill-summary.hbs";
        } else if (isRecipe) {
          template = "systems/cardigan/templates/recipes/recipe-summary.hbs";
        } else {
          template = "systems/cardigan/templates/weapons/weapon-summary.hbs";
        }
        
        const content = await foundry.applications.handlebars.renderTemplate(template, context);
        summary.insertAdjacentHTML("beforeend", content);
        this.expandedSections.set(itemId, true);
      } catch (error) {
        console.error(`Error creating ${isArmor ? 'armor' : isSkill ? 'skill' : isRecipe ? 'recipe' : 'weapon'} summary:`, error);
        return;
      }
    }
    
    // Update CSS classes
    itemContainer.classList.toggle("collapsed", expanded);
  }

  /**
   * Refresh the expanded summary for an item without collapsing/expanding
   * Used when enhancement checkboxes change
   * @param {string} itemId - The ID of the item
   * @param {object} item - The item object
   * @private
   */
  async _refreshExpandedSummary(itemId, item) {
    const itemContainer = this.element.querySelector(`[data-item-id="${itemId}"]`)?.closest('.item-row, .item');
    if (!itemContainer) {
      console.warn("Could not find item container for refresh");
      return;
    }

    const summary = itemContainer.querySelector(":scope > .item-description > .wrapper");
    if (!summary) {
      console.warn("Could not find summary wrapper for refresh");
      return;
    }

    const isSkill = item.type === 'skill';
    if (!isSkill) return; // Only refresh for skills

    // Remove old summary
    const oldSummary = summary.querySelector(".skill-summary");
    if (oldSummary) {
      oldSummary.remove();
    }

    // Rebuild context
    try {
      const context = {
        actor: this.actor,
        item: item,
        system: item.system,
        config: CONFIG.CARDIGAN,
        enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description || "", {
          secrets: item.isOwner,
          documents: true,
          links: true,
          rolls: true,
          rollData: item.getRollData?.() || {}
        })
      };

      // Process enhancements for skills
      if (item.system.enhancements && Array.isArray(item.system.enhancements)) {
        const enhancements = [];
        for (let i = 0; i < item.system.enhancements.length; i++) {
          const enhancement = item.system.enhancements[i];
          const isAcquired = item.system.acquiredEnhancements?.[i] === true;
          
          // Only show enhancements that have a description
          if (enhancement?.description) {
            enhancements.push({
              number: i + 1,
              name: enhancement.name || `Enhancement ${i + 1}`,
              description: enhancement.description,
              acquired: isAcquired,
              enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(enhancement.description, {
                secrets: item.isOwner,
                documents: true,
                links: true,
                rolls: true,
                rollData: item.getRollData?.() || {}
              })
            });
          }
        }
        if (enhancements.length > 0) {
          context.enhancements = enhancements;
        }
      }

      const template = "systems/cardigan/templates/skills/skill-summary.hbs";
      const content = await foundry.applications.handlebars.renderTemplate(template, context);
      summary.insertAdjacentHTML("beforeend", content);
    } catch (error) {
      console.error("Error refreshing skill summary:", error);
    }
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
    const isWeapon = item.type === 'arma';
    const isSkill = item.type === 'skill';
    const isRecipe = item.type?.includes('recipe') || item.type?.includes('-recipe');
    
    let summaryClass;
    if (isArmor) summaryClass = ".armor-summary";
    else if (isWeapon) summaryClass = ".weapon-summary";
    else if (isSkill) summaryClass = ".skill-summary";
    else if (isRecipe) summaryClass = ".recipe-summary";
    else summaryClass = ".weapon-summary"; // fallback
    
    if (expanded) {
      // Collapse
      this.expandedSections.set(itemId, false);
      summary.querySelector(summaryClass)?.remove();
    } else {
      // Expand
      try {
        // Get item data for summary
        const context = {
          actor: this.document, // Add actor to context for ingredient checking (static method uses this.document)
          item: item,
          system: item.system,
          config: CONFIG.CARDIGAN,
          enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description || "", {
            secrets: item.isOwner,
            documents: true,
            links: true,
            rolls: true,
            rollData: item.getRollData?.() || {}
          })
        };
        
        // If skill, process enhancements
        if (isSkill && item.system.enhancements && Array.isArray(item.system.enhancements)) {
          const enhancements = [];
          for (let i = 0; i < item.system.enhancements.length; i++) {
            const enhancement = item.system.enhancements[i];
            const isAcquired = item.system.acquiredEnhancements?.[i] === true;
            
            // Only show enhancements that have a description
            if (enhancement && enhancement.description) {
              enhancements.push({
                number: i + 1,
                name: enhancement.name || `Enhancement ${i + 1}`,
                description: enhancement.description,
                acquired: isAcquired,
                enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(enhancement.description, {
                  secrets: item.isOwner,
                  documents: true,
                  links: true,
                  rolls: true,
                  rollData: item.getRollData?.() || {}
                })
              });
            }
          }
          if (enhancements.length > 0) {
            context.enhancements = enhancements;
          }
        }
        
        // Choose template based on item type
        let template;
        if (isArmor) {
          template = "systems/cardigan/templates/armors/armor-summary.hbs";
        } else if (isSkill) {
          template = "systems/cardigan/templates/skills/skill-summary.hbs";
        } else if (isRecipe) {
          template = "systems/cardigan/templates/recipes/recipe-summary.hbs";
        } else {
          template = "systems/cardigan/templates/weapons/weapon-summary.hbs";
        }
        
        const content = await foundry.applications.handlebars.renderTemplate(template, context);
        summary.insertAdjacentHTML("beforeend", content);
        this.expandedSections.set(itemId, true);
      } catch (error) {
        console.error(`Error creating ${isArmor ? 'armor' : isSkill ? 'skill' : isRecipe ? 'recipe' : 'weapon'} summary:`, error);
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
   * Setup effect tooltips with enriched HTML descriptions
   * @private
   */
  #setupEffectTooltips() {
    // Select all effect items in the features section
    const effectItems = this.element.querySelectorAll('.effect-item[data-item-uuid]');
    
    effectItems.forEach(element => {
      const uuid = element.dataset.itemUuid;
      
      // Add mouse enter/leave listeners
      element.addEventListener('mouseenter', async (event) => {
        const item = await fromUuid(uuid);
        if (!item) return;
        
        // Enrich the description HTML
        let enrichedDescription = '';
        if (item.system?.description) {
          // Use modern Foundry v13 API for TextEditor
          const TextEditor = foundry.applications.ux.TextEditor.implementation;
          enrichedDescription = await TextEditor.enrichHTML(item.system.description, {
            secrets: item.isOwner,
            relativeTo: item
          });
        }
        
        // Create tooltip HTML
        const tooltipHTML = `
          <div class="effect-tooltip" style="max-width: 300px; padding: 8px;">
            <div style="margin-bottom: 6px;">
              <strong>${item.name}</strong>
            </div>
            ${enrichedDescription ? `<div style="font-size: 12px;">${enrichedDescription}</div>` : ''}
          </div>
        `;
        
        game.tooltip.activate(event.currentTarget, {
          html: tooltipHTML,
          cssClass: "tooltip cardigan-tooltip effect-tooltip"
        });
      });
      
      element.addEventListener('mouseleave', () => {
        game.tooltip.deactivate();
      });
    });
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
          // Debug: Log item details before deletion
          console.log("[DEBUG DELETE] Item details:", {
            name: item.name,
            type: item.type,
            system: item.system,
            isTemporaryHealth: item.system.isTemporaryHealth,
            healthBonusValue: item.system.healthBonusValue
          });
          
          // Check if it's a temporary health effect and adjust Health Bonus before deletion
          if (item.type === "efeito" && item.system.isTemporaryHealth && item.system.healthBonusValue) {
            console.log("[TEMPORARY HEALTH] Removing health bonus on effect deletion:", {
              effectName: item.name,
              bonusToRemove: item.system.healthBonusValue
            });
            
            // Remove the health bonus value from Health Bonus
            const currentHealthBonus = this.document.system.status.healthBonus || 0;
            const calculatedHealthBonus = currentHealthBonus - item.system.healthBonusValue;
            const newHealthBonus = Math.max(0, calculatedHealthBonus); // Only apply Math.max on final result
            
            console.log("[TEMPORARY HEALTH] Health bonus calculation details:", {
              currentBonus: currentHealthBonus,
              bonusToRemove: item.system.healthBonusValue,
              calculated: calculatedHealthBonus,
              final: newHealthBonus
            });
            
            await this.document.update({
              'system.status.healthBonus': newHealthBonus
            });
            
            console.log("[TEMPORARY HEALTH] Health bonus adjusted:", {
              previousBonus: currentHealthBonus,
              newBonus: newHealthBonus
            });
          } else if (item.type === "efeito" && item.system.isTemporaryEnergy && item.system.energyBonusValue) {
            console.log("[TEMPORARY ENERGY] Removing energy bonus on effect deletion:", {
              effectName: item.name,
              bonusToRemove: item.system.energyBonusValue
            });
            
            // Remove the energy bonus value from Energy Bonus
            const currentEnergyBonus = this.document.system.status.energyBonus || 0;
            const calculatedEnergyBonus = currentEnergyBonus - item.system.energyBonusValue;
            const newEnergyBonus = Math.max(0, calculatedEnergyBonus); // Only apply Math.max on final result
            
            console.log("[TEMPORARY ENERGY] Energy bonus calculation details:", {
              currentBonus: currentEnergyBonus,
              bonusToRemove: item.system.energyBonusValue,
              calculated: calculatedEnergyBonus,
              final: newEnergyBonus
            });
            
            await this.document.update({
              'system.status.energyBonus': newEnergyBonus
            });
            
            console.log("[TEMPORARY ENERGY] Energy bonus adjusted:", {
              previousBonus: currentEnergyBonus,
              newBonus: newEnergyBonus
            });
          } else if (item.type === "efeito" && item.system.isTemporaryArmor && item.system.armorBonusValue) {
            console.log("[TEMPORARY ARMOR] Removing armor bonus on effect deletion:", {
              effectName: item.name,
              bonusToRemove: item.system.armorBonusValue
            });
            
            // Remove the armor bonus value from Armor Bonus
            const currentArmorBonus = this.document.system.status.armorBonus || 0;
            const calculatedArmorBonus = currentArmorBonus - item.system.armorBonusValue;
            const newArmorBonus = Math.max(0, calculatedArmorBonus); // Only apply Math.max on final result
            
            console.log("[TEMPORARY ARMOR] Armor bonus calculation details:", {
              currentBonus: currentArmorBonus,
              bonusToRemove: item.system.armorBonusValue,
              calculated: calculatedArmorBonus,
              final: newArmorBonus
            });
            
            await this.document.update({
              'system.status.armorBonus': newArmorBonus
            });
            
            console.log("[TEMPORARY ARMOR] Armor bonus adjusted:", {
              previousBonus: currentArmorBonus,
              newBonus: newArmorBonus
            });
          } else {
            console.log("[DEBUG DELETE] Item does not match temporary health criteria:", {
              isEfeito: item.type === "efeito",
              hasIsTemporaryHealth: !!item.system.isTemporaryHealth,
              hasHealthBonusValue: !!item.system.healthBonusValue
            });
          }
          
          return item.delete();
        }
        return null;
      case "rollSkill":
        // Roll a skill check
        const skillId = target.dataset.skillId;
        const skillItem = this.document.items.get(skillId);
        if (skillItem && skillItem.system.rollSkillCheck) {
          return skillItem.system.rollSkillCheck();
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

  /**
   * Add listeners for critical hit dynamic field
   * @private
   */
  #addCriticalHitListeners() {
    const criticalHitField = this.element.querySelector('input[name="system.details.criticalHit"].dynamic-field');
    
    if (criticalHitField) {
      // Event listener para focus (mostrar valor manual)
      criticalHitField.addEventListener('focus', (event) => {
        this.#handleCriticalHitFocus(event);
      });
      
      // Event listener para blur (calcular e mostrar total)
      criticalHitField.addEventListener('blur', (event) => {
        this.#handleCriticalHitBlur(event);
      });
      
      console.log('[CARDIGAN] Critical Hit dynamic field listener added');
    }
  }

  /**
   * Handler para quando o usuário clica no campo de critical hit (focus)
   * @private
   */
  #handleCriticalHitFocus(event) {
    const field = event.target;
    const system = this.actor.system;
    
    // Obter o valor manual armazenado ou 0 se não existir
    const manualValue = system.details.criticalHitManual || 0;
    
    // Mostrar apenas o valor manual
    field.value = manualValue === 0 ? '' : manualValue;
    field.dataset.manualValue = manualValue;
    
    console.log(`[CRITICAL HIT FOCUS] Manual: ${manualValue}`);
    field.select();
  }

  /**
   * Handler para quando o usuário sai do campo de critical hit (blur)
   * @private
   */
  #handleCriticalHitBlur(event) {
    const field = event.target;
    const userInput = Number(field.value) || 0;
    const system = this.actor.system;
    
    // Calcular o valor automático baseado na Destreza
    const dexterity = system.abilities.dexterity.value || 0;
    const dexterityTotalBonus = system.abilities.dexterity.totalBonus || 0;
    const totalDexterity = dexterity + dexterityTotalBonus;
    const dexterityCriticalEffect = Math.floor(totalDexterity / 3);
    const autoValue = Math.max(1, 20 - dexterityCriticalEffect);
    
    // O valor total é o automático + o manual
    const totalValue = autoValue + userInput;
    
    // Mostrar o valor total no campo
    field.value = totalValue;
    field.dataset.manualValue = userInput;
    
    // Salvar o valor manual e o total
    this.actor.update({
      'system.details.criticalHitManual': userInput,
      'system.details.criticalHit': totalValue
    }).catch(error => {
      console.error('[CARDIGAN] Erro ao atualizar criticalHit:', error);
    });
    
    console.log(`[CRITICAL HIT BLUR] Manual: ${userInput}, Auto: ${autoValue}, Total: ${totalValue}`);
  }

  /**
   * Add listeners for movement dynamic field
   * @private
   */
  #addMovementListeners() {
    const movementField = this.element.querySelector('input[name="system.details.movement"].dynamic-field');
    
    if (movementField) {
      // Event listener para focus (mostrar valor manual)
      movementField.addEventListener('focus', (event) => {
        this.#handleMovementFocus(event);
      });
      
      // Event listener para blur (calcular e mostrar total)
      movementField.addEventListener('blur', (event) => {
        this.#handleMovementBlur(event);
      });
      
      console.log('[CARDIGAN] Movement dynamic field listener added');
    }
  }

  /**
   * Handler para quando o usuário clica no campo de movement (focus)
   * @private
   */
  #handleMovementFocus(event) {
    const field = event.target;
    const system = this.actor.system;
    
    // Obter o valor manual armazenado ou 0 se não existir
    const manualValue = system.details.movementManual || 0;
    
    // Mostrar apenas o valor manual
    field.value = manualValue === 0 ? '' : manualValue;
    field.dataset.manualValue = manualValue;
    
    console.log(`[MOVEMENT FOCUS] Manual: ${manualValue}`);
    field.select();
  }

  /**
   * Handler para quando o usuário sai do campo de movement (blur)
   * @private
   */
  #handleMovementBlur(event) {
    const field = event.target;
    const userInput = Number(field.value) || 0;
    const system = this.actor.system;
    
    // Calcular o valor automático baseado na Destreza
    const dexterity = system.abilities.dexterity.value || 0;
    const dexterityTotalBonus = system.abilities.dexterity.totalBonus || 0;
    const totalDexterity = dexterity + dexterityTotalBonus;
    const dexterityMovement = Math.floor(totalDexterity / 2);
    
    // Calcular bônus de armaduras
    const armorMovementBonus = this.actor._armorMovementBonus || 0;
    
    // O valor automático é Destreza + Armaduras
    const autoValue = dexterityMovement + armorMovementBonus;
    
    // O valor total é o automático + o manual
    const totalValue = autoValue + userInput;
    
    // Mostrar o valor total no campo
    field.value = totalValue;
    field.dataset.manualValue = userInput;
    
    // Salvar o valor manual e o total
    this.actor.update({
      'system.details.movementManual': userInput,
      'system.details.movement': totalValue
    }).catch(error => {
      console.error('[CARDIGAN] Erro ao atualizar movement:', error);
    });
    
    console.log(`[MOVEMENT BLUR] Manual: ${userInput}, Auto: ${autoValue} (Dex: ${dexterityMovement} + Armor: ${armorMovementBonus}), Total: ${totalValue}`);
  }

  /**
   * Add listeners for bonus fields (health, energy, armor)
   * @private
   */
  #addBonusFieldsListeners() {
    const bonusFields = [
      { selector: 'input[name="system.status.healthBonus"].dynamic-field', type: 'healthBonus' },
      { selector: 'input[name="system.status.energyBonus"].dynamic-field', type: 'energyBonus' },
      { selector: 'input[name="system.status.armorBonus"].dynamic-field', type: 'armorBonus' }
    ];
    
    bonusFields.forEach(({ selector, type }) => {
      const field = this.element.querySelector(selector);
      
      if (field) {
        // Event listener para focus (mostrar valor atual)
        field.addEventListener('focus', (event) => {
          this.#handleBonusFieldFocus(event, type);
        });
        
        // Event listener para blur (salvar valor)
        field.addEventListener('blur', (event) => {
          this.#handleBonusFieldBlur(event, type);
        });
      }
    });
    
    console.log('[CARDIGAN] Bonus fields dynamic listeners added');
  }

  /**
   * Handler para quando o usuário clica em um campo de bonus (focus)
   * @private
   */
  #handleBonusFieldFocus(event, bonusType) {
    const field = event.target;
    const system = this.actor.system;
    
    // Para bonus fields, não há valor automático, apenas manual
    const currentValue = system.status[bonusType] || 0;
    
    // Mostrar o valor atual
    field.value = currentValue === 0 ? '' : currentValue;
    field.dataset.currentValue = currentValue;
    
    console.log(`[${bonusType.toUpperCase()} FOCUS] Current: ${currentValue}`);
    field.select();
  }

  /**
   * Handler para quando o usuário sai de um campo de bonus (blur)
   * @private
   */
  #handleBonusFieldBlur(event, bonusType) {
    const field = event.target;
    const userInput = Number(field.value) || 0;
    
    // Para bonus fields, o valor final é apenas o que o usuário inseriu
    field.value = userInput;
    field.dataset.currentValue = userInput;
    
    // Salvar o valor
    this.actor.update({
      [`system.status.${bonusType}`]: userInput
    }).catch(error => {
      console.error(`[CARDIGAN] Erro ao atualizar ${bonusType}:`, error);
    });
    
    console.log(`[${bonusType.toUpperCase()} BLUR] Value: ${userInput}`);
  }

  /**
   * Add listeners for all profession table visibility toggles
   * @private
   */
  #addProfessionTableListeners() {
    const professions = [
      { name: 'culinary', displayName: 'CULINARY TABLE' },
      { name: 'tailoring', displayName: 'TAILORING TABLE' },
      { name: 'tecnomagic', displayName: 'TECNOMAGIC TABLE' },
      { name: 'blacksmithing', displayName: 'BLACKSMITHING TABLE' },
      { name: 'alchemy', displayName: 'ALCHEMY TABLE' },
      { name: 'carpentry', displayName: 'CARPENTRY TABLE' }
    ];

    professions.forEach(profession => {
      const toggle = this.element.querySelector(`[data-${profession.name}-table-toggle]`);
      const tableSection = this.element.querySelector(`[data-${profession.name}-table-section]`);
      
      if (!toggle || !tableSection) return;
      
      // Add event listener for the profession table toggle checkbox
      toggle.addEventListener('change', (event) => {
        const isChecked = event.target.checked;
        
        if (isChecked) {
          tableSection.classList.remove('hidden');
        } else {
          tableSection.classList.add('hidden');
        }
        
        console.log(`[${profession.displayName}] Visibility toggled: ${isChecked ? 'visible' : 'hidden'}`);
      });
      
      console.log(`[CARDIGAN] ${profession.displayName} toggle listener added`);
    });
  }

  /**
   * Add listeners for skill enhancement checkboxes
   * @private
   */
  #addEnhancementCheckboxListeners() {
    // Get all enhancement checkboxes
    const checkboxes = this.element.querySelectorAll('input[type="checkbox"][name^="system.acquiredEnhancements"][data-item-id]');
    
    checkboxes.forEach(checkbox => {
      // Remove any existing listeners to prevent duplicates
      checkbox.removeEventListener('change', checkbox._enhancementHandler);
      
      // Create handler
      checkbox._enhancementHandler = async (event) => {
        const itemId = checkbox.dataset.itemId;
        const item = this.actor.items.get(itemId);
        
        if (!item) {
          console.error('[CARDIGAN] Item not found for enhancement checkbox:', itemId);
          return;
        }
        
        // Parse the enhancement index from the name (e.g., "system.acquiredEnhancements.1" -> index 1)
        const match = checkbox.name.match(/system\.acquiredEnhancements\.(\d+)/);
        if (!match) {
          console.error('[CARDIGAN] Could not parse enhancement index from:', checkbox.name);
          return;
        }
        
        const index = parseInt(match[1]);
        const isChecked = checkbox.checked;
        
        console.log(`[CARDIGAN] Enhancement ${index} for skill ${item.name} changed to:`, isChecked);
        
        // Update the item's acquiredEnhancements array
        const currentEnhancements = item.system.acquiredEnhancements || [false, false, false];
        const newEnhancements = [...currentEnhancements];
        newEnhancements[index] = isChecked;
        
        try {
          await item.update({
            'system.acquiredEnhancements': newEnhancements
          }, {
            render: false  // Prevent automatic re-render to avoid checkbox state issues
          });
          
          console.log(`[CARDIGAN] Updated skill ${item.name} enhancements:`, newEnhancements);
          
          // Handle linked skills for this enhancement
          const enhancement = item.system.enhancements?.[index];
          if (enhancement && enhancement.hasLinkedSkills && enhancement.linkedSkills?.length > 0) {
            if (isChecked) {
              // Add linked skills
              await this._addEnhancementLinkedSkills(item, index, enhancement.linkedSkills);
            } else {
              // Remove linked skills
              await this._removeEnhancementLinkedSkills(item, index);
            }
          }
          
          // Update expanded summary if it's currently open
          const itemContainer = this.element.querySelector(`[data-item-id="${itemId}"]`)?.closest('.item-row, .item');
          if (itemContainer && this.expandedSections?.get(itemId)) {
            console.log(`[CARDIGAN] Refreshing expanded summary for ${item.name}`);
            await this._refreshExpandedSummary(itemId, item);
          }
          
        } catch (error) {
          console.error('[CARDIGAN] Error updating enhancement:', error);
          // Revert checkbox on error
          checkbox.checked = !isChecked;
        }
      };
      
      checkbox.addEventListener('change', checkbox._enhancementHandler);
    });
    
    console.log(`[CARDIGAN] Enhancement checkbox listeners added (${checkboxes.length} checkboxes)`);
  }

  /**
   * Add linked skills when an enhancement is acquired
   * @param {Item} parentSkill - The parent skill item
   * @param {number} enhancementIndex - Index of the enhancement (0, 1, or 2)
   * @param {Array} linkedSkills - Array of linked skill data
   * @private
   */
  async _addEnhancementLinkedSkills(parentSkill, enhancementIndex, linkedSkills) {
    if (!linkedSkills || linkedSkills.length === 0) return;

    console.log(`[CARDIGAN] Adding ${linkedSkills.length} linked skills for enhancement ${enhancementIndex} of ${parentSkill.name}`);

    const skillsToAdd = [];
    for (const linkedSkill of linkedSkills) {
      try {
        // Get the skill from compendium
        const skillDoc = await fromUuid(linkedSkill.uuid);
        if (!skillDoc) {
          console.warn(`[CARDIGAN] Could not find skill with UUID: ${linkedSkill.uuid}`);
          continue;
        }

        // Check if skill already exists in actor
        const existingSkill = this.actor.items.find(i => 
          i.type === 'skill' && i.name === skillDoc.name
        );

        if (existingSkill) {
          console.log(`[CARDIGAN] Skill ${skillDoc.name} already exists, skipping`);
          continue;
        }

        // Prepare skill data with enhancement linked flag
        const skillData = skillDoc.toObject();
        skillData.system.enhancementLinkedSkill = {
          isEnhancementLinked: true,
          parentSkillId: parentSkill.id,
          parentSkillName: parentSkill.name,
          enhancementIndex: enhancementIndex
        };

        skillsToAdd.push(skillData);
      } catch (error) {
        console.error(`[CARDIGAN] Error processing linked skill:`, error);
      }
    }

    if (skillsToAdd.length > 0) {
      await this.actor.createEmbeddedDocuments('Item', skillsToAdd);
      ui.notifications.info(`${skillsToAdd.length} skill(s) vinculada(s) adicionada(s) pelo aprimoramento ${enhancementIndex + 1} de ${parentSkill.name}`);
    }
  }

  /**
   * Remove linked skills when an enhancement is unacquired
   * @param {Item} parentSkill - The parent skill item
   * @param {number} enhancementIndex - Index of the enhancement (0, 1, or 2)
   * @private
   */
  async _removeEnhancementLinkedSkills(parentSkill, enhancementIndex) {
    console.log(`[CARDIGAN] Removing linked skills for enhancement ${enhancementIndex} of ${parentSkill.name}`);

    // Find all skills linked to this enhancement
    const linkedSkills = this.actor.items.filter(item => 
      item.type === 'skill' &&
      item.system.enhancementLinkedSkill?.isEnhancementLinked === true &&
      item.system.enhancementLinkedSkill?.parentSkillId === parentSkill.id &&
      item.system.enhancementLinkedSkill?.enhancementIndex === enhancementIndex
    );

    if (linkedSkills.length > 0) {
      const idsToDelete = linkedSkills.map(s => s.id);
      await this.actor.deleteEmbeddedDocuments('Item', idsToDelete);
      ui.notifications.info(`${linkedSkills.length} skill(s) vinculada(s) removida(s) do aprimoramento ${enhancementIndex + 1} de ${parentSkill.name}`);
    }
  }

  /**
   * Add listeners for value fields (health, energy, armor current values)
   * @private
   */
  #addValueFieldsListeners() {
    const valueFields = [
      { selector: 'input[name="system.health.value"].dynamic-field', type: 'health', path: 'system.health.value' },
      { selector: 'input[name="system.power.value"].dynamic-field', type: 'power', path: 'system.power.value' },
      { selector: 'input[name="system.armor.value"].dynamic-field', type: 'armor', path: 'system.armor.value' }
    ];
    
    valueFields.forEach(({ selector, type, path }) => {
      const field = this.element.querySelector(selector);
      
      if (field) {
        // Event listener para focus (mostrar valor atual)
        field.addEventListener('focus', (event) => {
          this.#handleValueFieldFocus(event, type, path);
        });
        
        // Event listener para blur (salvar valor)
        field.addEventListener('blur', (event) => {
          this.#handleValueFieldBlur(event, type, path);
        });
      }
    });
    
    console.log('[CARDIGAN] Value fields dynamic listeners added');
  }

  /**
   * Handler para quando o usuário clica em um campo de valor (focus)
   * @private
   */
  #handleValueFieldFocus(event, valueType, valuePath) {
    const field = event.target;
    const system = this.actor.system;
    
    // Para value fields, obter valor atual baseado no path
    const pathParts = valuePath.split('.');
    let currentValue = system;
    for (let i = 1; i < pathParts.length; i++) { // Pula 'system'
      currentValue = currentValue[pathParts[i]];
    }
    
    // Mostrar o valor atual
    field.value = currentValue === 0 ? '' : currentValue;
    field.dataset.currentValue = currentValue;
    
    console.log(`[${valueType.toUpperCase()} VALUE FOCUS] Current: ${currentValue}`);
    field.select();
  }

  /**
   * Handler para quando o usuário sai de um campo de valor (blur)
   * @private
   */
  #handleValueFieldBlur(event, valueType, valuePath) {
    const field = event.target;
    const userInput = Number(field.value) || 0;
    const system = this.actor.system;
    
    // Obter valor máximo para validação
    const pathParts = valuePath.split('.');
    const resourceType = pathParts[pathParts.length - 2]; // 'health', 'power', ou 'armor'
    const maxValue = system[resourceType].max;
    
    // Garantir que o valor não exceda o máximo
    const finalValue = Math.min(userInput, maxValue);
    
    // Se o valor foi ajustado, mostrar o valor final
    if (finalValue !== userInput) {
      field.value = finalValue;
      console.warn(`[${valueType.toUpperCase()} VALUE] Value ${userInput} capped to max ${maxValue}`);
    } else {
      field.value = finalValue;
    }
    
    field.dataset.currentValue = finalValue;
    
    // Salvar o valor
    const updateData = {};
    updateData[valuePath] = finalValue;
    
    this.actor.update(updateData).catch(error => {
      console.error(`[CARDIGAN] Erro ao atualizar ${valuePath}:`, error);
    });
    
    console.log(`[${valueType.toUpperCase()} VALUE BLUR] Value: ${finalValue}${finalValue !== userInput ? ` (capped from ${userInput})` : ''}`);
  }

  /**
   * Handle cook recipe action - creates a consumable item from recipe
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The button that was clicked
   * @private
   */
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
    try {
      console.log("[RECIPES] Cooking recipe:", recipe.name);
      
      if (recipe.type !== "item-recipe") {
        ui.notifications.error("Invalid recipe item.");
        return;
      }
      
      // Show confirmation dialog
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        title: `Cook ${recipe.name}?`,
        content: `
          <div style="margin-bottom: 15px;">
            <p>Do you want to cook <strong>"${recipe.name}"</strong>?</p>
            <div style="background: rgba(43, 24, 16, 0.3); padding: 10px; border-radius: 5px; margin-top: 10px;">
              <p><strong>Difficulty:</strong> ${game.i18n.localize(`CARDIGAN.Item.ItemRecipe.difficulty.${recipe.system.difficulty}`)}</p>
              <p><strong>Cooking Time:</strong> ${recipe.system.cookingTime} minutes</p>
              <p><strong>Servings:</strong> ${recipe.system.servings}</p>
              ${recipe.system.ingredients ? `<p><strong>Ingredients:</strong> ${recipe.system.ingredients}</p>` : ''}
            </div>
          </div>
        `,
        yes: () => true,
        no: () => false,
        defaultYes: true
      });
      
      if (!confirmed) {
        console.log("[RECIPES] Cooking cancelled by user");
        return;
      }
      
      // Check if consumable with same name already exists in backpack
      const existingConsumable = this.document.items.find(item => 
        item.type === "item-consumivel" && 
        item.name === recipe.name
      );
      
      let resultItem;
      let isNewItem = false;
      
      if (existingConsumable) {
        // Item exists - increase quantity
        const currentQuantity = existingConsumable.system.quantity || 1;
        const servingsToAdd = recipe.system.servings || 1;
        const newQuantity = currentQuantity + servingsToAdd;
        
        await existingConsumable.update({
          "system.quantity": newQuantity
        });
        
        resultItem = existingConsumable;
        console.log(`[RECIPES] Increased quantity of "${recipe.name}" from ${currentQuantity} to ${newQuantity}`);
        ui.notifications.info(`Added ${servingsToAdd} more "${recipe.name}" to your backpack! (Total: ${newQuantity})`);
        
      } else {
        // Item doesn't exist - create new consumable
        const consumableData = {
          name: recipe.name,
          type: "item-consumivel",
          img: recipe.img,
          system: {
            quantity: recipe.system.servings || 1,
            weight: recipe.system.weight || "leve",
            price: Math.ceil(recipe.system.price / 2) || 1,
            effects: []
          }
        };
        
        // If recipe has effects, add them to description
        if (recipe.system.effects) {
          consumableData.system.description = `<p><strong>Recipe Effects:</strong></p><p>${recipe.system.effects}</p>`;
        }
        
        const newConsumable = await this.document.createEmbeddedDocuments("Item", [consumableData]);
        resultItem = newConsumable[0];
        isNewItem = true;
        
        console.log("[RECIPES] Created new consumable from recipe:", resultItem);
        ui.notifications.info(`Successfully cooked "${recipe.name}"! Check your equipment backpack.`);
      }
      
      // Show cooking success message in chat
      const actionText = isNewItem ? "cooked" : "added more";
      const quantityText = isNewItem ? resultItem.system.quantity : `+${recipe.system.servings || 1} (Total: ${resultItem.system.quantity})`;
      
      const messageContent = `
        <div class="cardigan-cook-message" style="background: linear-gradient(90deg, #2b1810 0%, #3d2317 100%); border: 2px solid #8B4513; border-radius: 8px; padding: 15px; color: #c9c7b8;">
          <h3 style="color: #d4af37; margin-bottom: 10px;">
            <i class="fas fa-fire" style="margin-right: 8px; color: #ff6b35;"></i>
            Cooking Complete!
          </h3>
          <p><strong>${this.document.name}</strong> has ${actionText} <strong>"${resultItem.name}"</strong>!</p>
          <div style="margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px;">
            <p style="margin: 2px 0;"><strong>Recipe:</strong> ${recipe.name}</p>
            <p style="margin: 2px 0;"><strong>Difficulty:</strong> ${game.i18n.localize(`CARDIGAN.Item.ItemRecipe.difficulty.${recipe.system.difficulty}`)}</p>
            <p style="margin: 2px 0;"><strong>Servings:</strong> ${quantityText}</p>
          </div>
        </div>
      `;
      
      ChatMessage.create({
        content: messageContent,
        speaker: ChatMessage.getSpeaker({ actor: this.document })
      });
      
    } catch (error) {
      console.error("[RECIPES] Error cooking recipe:", error);
      ui.notifications.error("Error cooking recipe. Please try again.");
    }
  }

  /**
   * Validate if actor has all required ingredients for a recipe
   * @param {Item} recipe - The recipe item to validate
   * @param {Actor} actor - The actor whose inventory to check
   * @returns {Object} Validation result with valid boolean and message
   * @protected
   */
  static _validateRecipeIngredients(recipe, actor) {
    const requiredIngredients = recipe.system.requiredIngredients || [];
    
    // If no ingredients required, validation passes
    if (requiredIngredients.length === 0) {
      return { valid: true, message: "" };
    }

    const missing = [];
    const insufficient = [];
    
    for (const required of requiredIngredients) {
      if (!required.name || !required.quantity) continue;
      
      const searchTerm = required.name.toLowerCase().trim();
      let totalAvailable = 0;
      
      // Search through actor's items for matches
      for (const item of actor.items) {
        const itemName = item.name.toLowerCase();
        
        // Check for exact or partial name match
        if (itemName === searchTerm || 
            itemName.includes(searchTerm) || 
            searchTerm.includes(itemName)) {
          totalAvailable += (item.system.quantity || 1);
        }
      }
      
      if (totalAvailable === 0) {
        missing.push(required.name);
      } else if (totalAvailable < required.quantity) {
        insufficient.push({
          name: required.name,
          required: required.quantity,
          available: totalAvailable
        });
      }
    }
    
    // Build detailed HTML error message if validation fails
    if (missing.length > 0 || insufficient.length > 0) {
      let message = `<div style="font-family: monospace;"><strong>🚫 ${game.i18n.localize("CARDIGAN.Crafting.CannotCraft")}</strong><br><br>`;
      
      if (missing.length > 0) {
        message += `<strong>❌ ${game.i18n.localize("CARDIGAN.Crafting.MissingIngredients")}:</strong><br>`;
        // Get required quantities for missing ingredients
        const missingWithQuantity = missing.map(name => {
          const required = requiredIngredients.find(ing => ing.name === name);
          return `&nbsp;&nbsp;&nbsp;• <span style="color: #ff6b6b;">${name}</span> (${game.i18n.localize("CARDIGAN.Crafting.Required")}: <strong>${required?.quantity || 1}</strong>)`;
        });
        message += missingWithQuantity.join('<br>') + "<br><br>";
      }
      
      if (insufficient.length > 0) {
        message += `<strong>⚠️ ${game.i18n.localize("CARDIGAN.Crafting.InsufficientIngredients")}:</strong><br>`;
        const insufficientDetails = insufficient.map(ing => {
          const stillNeeded = ing.required - ing.available;
          return `&nbsp;&nbsp;&nbsp;• <span style="color: #ffa500;">${ing.name}</span>: ${game.i18n.localize("CARDIGAN.Crafting.Have")} <span style="color: #ff6b6b;">${ing.available}</span>/<strong>${ing.required}</strong> (${game.i18n.localize("CARDIGAN.Crafting.Missing")} <strong style="color: #ff6b6b;">${stillNeeded}</strong>)`;
        });
        message += insufficientDetails.join('<br>');
      }
      
      // Add summary and helpful tip
      const totalMissing = missing.length + insufficient.reduce((sum, ing) => sum + (ing.required - ing.available), 0);
      message += `<br><div style="background: rgba(255,255,255,0.1); padding: 6px; border-radius: 4px; margin-top: 8px;">`;
      message += `<strong>${game.i18n.localize("CARDIGAN.Crafting.Summary")}:</strong> ${totalMissing} ${game.i18n.localize("CARDIGAN.Crafting.ItemsNeeded")}`;
      message += `</div>`;
      
      // Add helpful tip
      message += `<br><div style="background: rgba(100,149,237,0.1); padding: 8px; border-left: 3px solid #6495ed; margin-top: 10px;"><strong>💡 ${game.i18n.localize("CARDIGAN.Crafting.Tip")}</strong></div></div>`;
      
      return { valid: false, message };
    }
    
    return { valid: true, message: "" };
  }

  /**
   * Consume required ingredients from actor's inventory
   * @param {Item} recipe - The recipe item
   * @param {Actor} actor - The actor whose ingredients to consume
   * @returns {boolean} Whether consumption was successful
   * @protected
   */
  static async _consumeRecipeIngredients(recipe, actor) {
    const requiredIngredients = recipe.system.requiredIngredients || [];
    
    if (requiredIngredients.length === 0) {
      return true;
    }

    try {
      for (const required of requiredIngredients) {
        if (!required.name || !required.quantity) continue;
        
        const searchTerm = required.name.toLowerCase().trim();
        let remainingToConsume = required.quantity;
        
        // Find matching items and consume them
        const matchingItems = actor.items.filter(item => {
          const itemName = item.name.toLowerCase();
          return itemName === searchTerm || 
                 itemName.includes(searchTerm) || 
                 searchTerm.includes(itemName);
        }).sort((a, b) => (a.system.quantity || 1) - (b.system.quantity || 1)); // Consume smallest stacks first
        
        for (const item of matchingItems) {
          if (remainingToConsume <= 0) break;
          
          const itemQuantity = item.system.quantity || 1;
          
          if (itemQuantity <= remainingToConsume) {
            // Consume entire stack
            await item.delete();
            remainingToConsume -= itemQuantity;
            console.log(`[CRAFTING] Consumed entire stack of ${item.name} (${itemQuantity})`);
          } else {
            // Consume partial stack
            await item.update({
              "system.quantity": itemQuantity - remainingToConsume
            });
            console.log(`[CRAFTING] Consumed ${remainingToConsume} of ${item.name}, ${itemQuantity - remainingToConsume} remaining`);
            remainingToConsume = 0;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error("[CRAFTING] Error consuming ingredients:", error);
      return false;
    }
  }

  /**
   * Handle crafting from recipe
   * @param {Event} event - The triggering event
   * @param {HTMLElement} target - The target element
   */
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

    try {
      // Validate ingredients before showing dialog
      const ingredientValidation = CardiganSystemActorSheet._validateRecipeIngredients(recipe, this.document);
      if (!ingredientValidation.valid) {
        console.log("[CRAFTING] Ingredient validation failed:", ingredientValidation);
        ui.notifications.error(ingredientValidation.message);
        return;
      }

      // Show crafting dialog to select item type
      const result = await RecipeCraftingDialog.show(this.document, recipe, recipeType);
      console.log("[CRAFTING] Dialog result:", result);
      
      if (!result || !result.itemType) {
        console.log("[CRAFTING] No item type selected");
        return;
      }

      // Create the new item based on selection
      const itemData = {
        name: recipe.system.resultItem || recipe.name,
        type: result.itemType,
        img: recipe.img || "icons/sundries/miscellaneous/mortar-pestle.svg",
        system: {
          quantity: recipe.system.resultQuantity || 1,
          // Use correct weight for each item type
          weight: (result.itemType === "arma" || result.itemType === "armadura") ? "leve" : "leve",
          price: recipe.system.price || 10,
          description: `Crafted from ${recipe.name} recipe.${recipe.system.description ? `\n\n${recipe.system.description}` : ''}`
        }
      };

      // Add type-specific properties
      switch (result.itemType) {
        case "item-consumivel":
          itemData.system.effects = recipe.system.effects || "";
          itemData.system.consumableType = recipe.system.consumableType || "other";
          break;
        case "arma":
          itemData.system.weaponType = "";
          itemData.system.melee = true;
          itemData.system.ranged = false;
          itemData.system.isFirearm = false;
          itemData.system.ammunition = { current: 0, max: 0 };
          itemData.system.damage = { 
            value: "1d4", 
            useStrength: false, 
            useDexterity: false, 
            total: "1d4" 
          };
          itemData.system.properties = [];
          itemData.system.rightHand = false;
          itemData.system.leftHand = false;
          break;
        case "armadura":
          itemData.system.armorType = "torso"; // Use valid armor type
          itemData.system.protecao = 1;
          itemData.system.armorClass = "";
          itemData.system.equipped = false;
          itemData.system.properties = [];
          itemData.system.skillBonuses = [];
          itemData.system.magicalArtifact = false;
          itemData.system.resistenciaFrio = false;
          itemData.system.bonusVida = 0;
          itemData.system.bonusEnergia = 0;
          itemData.system.bonusDeslocamento = { enabled: false, bonus: 0 };
          itemData.system.durability = { current: 3, max: 3 };
          break;
        case "item-municao":
          itemData.system.ammunitionType = "arrow";
          break;
      }

      // Check if item with same name and type already exists
      const existingItem = this.document.items.find(item => 
        item.type === result.itemType && 
        item.name === itemData.name
      );

      let resultItem;
      if (existingItem) {
        // Increase existing item quantity
        const currentQuantity = existingItem.system.quantity || 1;
        const quantityToAdd = itemData.system.quantity;
        const newQuantity = currentQuantity + quantityToAdd;
        
        await existingItem.update({
          "system.quantity": newQuantity
        });
        
        resultItem = existingItem;
        ui.notifications.info(`Added ${quantityToAdd} more "${itemData.name}" to your backpack! (Total: ${newQuantity})`);
      } else {
        // Create new item
        const newItems = await this.document.createEmbeddedDocuments("Item", [itemData]);
        resultItem = newItems[0];
        ui.notifications.info(game.i18n.format("CARDIGAN.Crafting.CraftingSuccess", {
          itemName: resultItem.name,
          recipeName: recipe.name
        }));
      }

      // Consume ingredients after successful crafting
      const consumeSuccess = await CardiganSystemActorSheet._consumeRecipeIngredients(recipe, this.document);
      if (!consumeSuccess) {
        console.warn("[CRAFTING] Failed to consume ingredients, but item was created");
        ui.notifications.warn("Item created but some ingredients could not be consumed properly.");
      } else {
        console.log("[CRAFTING] Successfully consumed all required ingredients");
      }

      // Prepare ingredients consumed message
      const requiredIngredients = recipe.system.requiredIngredients || [];
      let ingredientsText = "";
      if (requiredIngredients.length > 0) {
        ingredientsText = `
          <div style="margin-top: 8px; padding: 8px; background: rgba(220, 53, 69, 0.1); border-left: 3px solid #dc3545; border-radius: 4px;">
            <p style="margin: 2px 0; color: #dc3545; font-weight: bold;"><strong>${game.i18n.localize("CARDIGAN.Crafting.IngredientsConsumed")}:</strong></p>
            ${requiredIngredients.map(ing => `<p style="margin: 1px 0; font-size: 0.9em; color: #c9c7b8;">• ${ing.name} x${ing.quantity}</p>`).join('')}
          </div>
        `;
      }

      // Show crafting success message in chat
      const messageContent = `
        <div class="cardigan-craft-message" style="background: linear-gradient(90deg, #1a1a2e 0%, #16213e 100%); border: 2px solid #0f3460; border-radius: 8px; padding: 15px; color: #c9c7b8;">
          <h3 style="color: #4dabf7; margin-bottom: 10px;">
            <i class="fas fa-hammer" style="margin-right: 8px; color: #fd7e14;"></i>
            Crafting Complete!
          </h3>
          <p><strong>${this.document.name}</strong> has crafted <strong>"${resultItem.name}"</strong>!</p>
          <div style="margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px;">
            <p style="margin: 2px 0;"><strong>Recipe:</strong> ${recipe.name}</p>
            <p style="margin: 2px 0;"><strong>Item Type:</strong> ${game.i18n.localize(`TYPES.Item.${result.itemType}`)}</p>
            <p style="margin: 2px 0;"><strong>Quantity:</strong> ${resultItem.system.quantity}</p>
          </div>
          ${ingredientsText}
        </div>
      `;
      
      ChatMessage.create({
        content: messageContent,
        speaker: ChatMessage.getSpeaker({ actor: this.document })
      });

    } catch (error) {
      console.error("[CRAFTING] Error crafting from recipe:", error);
      ui.notifications.error(game.i18n.localize("CARDIGAN.Crafting.CraftingError"));
    }
  }

  /**
   * Handle profession filter change
   * @param {Event} event - The triggering event
   * @param {HTMLElement} target - The target element
   */
  static _onFilterProfession(event, target) {
    event.preventDefault();
    const profession = target.value;
    
    console.log("[FILTER] Changing profession filter to:", profession);
    
    // Update the filter state
    this.professionFilter = profession;
    
    // Re-render to apply the filter
    this.render();
  }

  /**
   * Detect critical results from a roll and return appropriate flags
   * @param {Roll} roll - The roll to analyze
   * @param {Object} actor - The actor who made the roll (optional, used for critical hit threshold)
   * @param {string} abilityKey - The ability key being rolled (optional, used for accuracy-specific logic)
   * @returns {Object} - Flags object for critical hit/failure, empty if no critical
   */
  static _detectCriticalResults(roll, actor = null, abilityKey = null) {
    if (!roll || !roll.dice || roll.dice.length === 0) return {};

    try {
      // Evaluate the roll if not already evaluated
      if (!roll._evaluated) {
        roll.evaluate({ async: false });
      }

      const flags = {};
      
      // Check for critical failure (total ≤ 1 or natural 1)
      if (roll.total <= 1) {
        flags.criticalFailure = true;
        return { cardigan: flags };
      }

      // Check for natural 1 on d20
      const d20Die = roll.dice.find(die => die.faces === 20);
      if (d20Die && d20Die.results && d20Die.results.length > 0) {
        const hasNaturalOne = d20Die.results.some(result => result?.result === 1);
        if (hasNaturalOne) {
          flags.criticalFailure = true;
          return { cardigan: flags };
        }
      }

      // Check for critical hit - different logic for accuracy vs other rolls
      if (d20Die && d20Die.results && d20Die.results.length > 0) {
        // For accuracy rolls, use actor's criticalHit threshold
        if (abilityKey === 'accuracy' && actor && actor.system?.details?.criticalHit) {
          const criticalThreshold = actor.system.details.criticalHit;
          if (roll.total >= criticalThreshold) {
            flags.criticalHit = true;
            return { cardigan: flags };
          }
        }
        // For all other rolls, critical hit when total is 20 or higher
        else if (roll.total >= 20) {
          flags.criticalHit = true;
          return { cardigan: flags };
        }
      }

      return {};

    } catch (error) {
      console.warn("Error detecting critical results:", error);
      return {};
    }
  }

  /**
   * Process health modifier from consumable items
   * @param {Item} item The consumable item
   * @returns {Promise<Object|null>} Result object with message
   * @private
   */
  async _processHealthModifier(item) {
    try {
      console.log("[HEALTH MODIFIER] Processing health modifier for item:", item.name);
      
      const baseDice = item.system.healthModifierDice;
      const quantity = item.system.healthModifierQuantity || 1;
      const modifierType = item.system.healthModifierType;
      
      console.log("[HEALTH MODIFIER] Base dice:", baseDice);
      console.log("[HEALTH MODIFIER] Quantity:", quantity);
      console.log("[HEALTH MODIFIER] Modifier type:", modifierType);
      
      if (!baseDice || !modifierType) {
        console.log("[HEALTH MODIFIER] Missing dice formula or modifier type");
        return null;
      }
      
      // Build the dice formula with quantity (e.g., "2d20", "3d6")
      const diceFormula = `${quantity}${baseDice.substring(1)}`; // Remove "1" and add quantity
      console.log("[HEALTH MODIFIER] Final dice formula:", diceFormula);
      
      // Roll the dice
      const roll = new Roll(diceFormula);
      await roll.evaluate();
      
      let rollTotal = roll.total;
      const currentHealth = this.document.system.health.value;
      const maxHealth = this.document.system.health.max;
      
      console.log("[HEALTH MODIFIER] Base roll total:", rollTotal);
      
      // Add skill bonus if configured
      let skillBonus = 0;
      let skillName = "";
      if (item.system.healthModifierAddSkill && item.system.healthModifierSkill) {
        const skillKey = item.system.healthModifierSkill;
        const abilityData = this.document.system.abilities[skillKey];
        const skillValue = (abilityData?.value || 0) + (abilityData?.totalBonus || 0);
        
        // Double the skill value if requested
        skillBonus = item.system.healthModifierDoubleSkill ? skillValue * 2 : skillValue;
        skillName = game.i18n.localize(`CARDIGAN.Ability.${skillKey.charAt(0).toUpperCase() + skillKey.slice(1)}.long`);
        
        rollTotal += skillBonus;
        
        console.log("[HEALTH MODIFIER] Skill bonus:", {
          skill: skillName,
          baseValue: skillValue,
          doubled: item.system.healthModifierDoubleSkill,
          finalBonus: skillBonus,
          totalWithSkill: rollTotal
        });
      }
      
      // Add additional bonus if configured
      let additionalBonus = 0;
      if (item.system.healthModifierAdditionalBonus && item.system.healthModifierAdditionalBonus > 0) {
        additionalBonus = item.system.healthModifierAdditionalBonus;
        rollTotal += additionalBonus;
        
        console.log("[HEALTH MODIFIER] Additional bonus:", {
          bonus: additionalBonus,
          totalWithBonus: rollTotal
        });
      }
      
      console.log("[HEALTH MODIFIER] Final total (dice + skill + bonus):", rollTotal);
      console.log("[HEALTH MODIFIER] Current health:", currentHealth);
      console.log("[HEALTH MODIFIER] Max health:", maxHealth);
      console.log("[HEALTH MODIFIER] Is temporary:", item.system.healthModifierIsTemporary);
      
      let formula = `${diceFormula}: ${roll.total}`;
      if (skillBonus > 0) {
        formula += ` + ${skillName} ${skillBonus}`;
      }
      if (additionalBonus > 0) {
        formula += ` + Bônus ${additionalBonus}`;
      }
      
      let message;
      let updateResult;
      
      // Check if this is a temporary health point
      if (item.system.healthModifierIsTemporary) {
        console.log("[HEALTH MODIFIER] Creating temporary health effect for tracking table");
        
        // Apply the health bonus directly to the actor's Health Bonus
        const healthBonus = modifierType === 'add' ? rollTotal : -rollTotal; // Negative for subtract
        const currentHealthBonus = this.document.system.status.healthBonus || 0;
        const newHealthBonus = currentHealthBonus + healthBonus; // Allow negative values temporarily
        
        // Update Health Bonus
        updateResult = await this.document.update({
          'system.status.healthBonus': newHealthBonus
        });
        
        // Create tracking effect item for the effects table
        const trackingEffectName = modifierType === 'add' 
          ? `${item.name} (consumed)` 
          : `${item.name} (consumed)`;
        
        const trackingDescription = modifierType === 'add' 
          ? `Health Bonus: +${rollTotal} (${formula})`
          : `Health Bonus: ${rollTotal} (${formula})`;
        
        // Create effect item with health bonus data
        const effectItemData = {
          name: trackingEffectName,
          type: "efeito",
          system: {
            description: trackingDescription,
            // Store the health bonus value for removal purposes
            healthBonusValue: healthBonus,
            sourceItemId: item.id,
            sourceItemName: item.name,
            isTemporaryHealth: true
          }
        };
        
        console.log("[HEALTH MODIFIER] Creating effect item with data:", effectItemData);
        
        // Create the tracking effect item in actor's items
        const createdItems = await this.document.createEmbeddedDocuments("Item", [effectItemData]);
        console.log("[HEALTH MODIFIER] Created effect item:", createdItems[0]);
        console.log("[HEALTH MODIFIER] Created item system data:", createdItems[0].system);
        
        if (modifierType === 'add') {
          message = `Temporary Health added: +${rollTotal} (${formula}) - Added to Health Bonus`;
        } else {
          message = `Temporary Health reduced: -${rollTotal} (${formula}) - Removed from Health Bonus`;
        }
        console.log("[HEALTH MODIFIER] Temporary health tracking effect created with healthBonusValue:", healthBonus);
        
      } else {
        // Standard health modification (permanent)
        let newHealth;
        
        if (modifierType === 'add') {
          // Add health (but don't exceed max)
          newHealth = Math.min(currentHealth + rollTotal, maxHealth);
          message = `Health restored: +${rollTotal} (${formula}) - Health: ${currentHealth} → ${newHealth}`;
        } else if (modifierType === 'subtract') {
          // Subtract health (but don't go below 0)
          newHealth = Math.max(currentHealth - rollTotal, 0);
          message = `Health lost: -${rollTotal} (${formula}) - Health: ${currentHealth} → ${newHealth}`;
        }
        
        console.log("[HEALTH MODIFIER] New health calculated:", newHealth);
        
        // Update the actor's health
        console.log("[HEALTH MODIFIER] Updating actor health to:", newHealth);
        updateResult = await this.document.update({
          'system.health.value': newHealth
        });
      }
      
      console.log("[HEALTH MODIFIER] Update result:", updateResult);
      
      // Send the roll to chat
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.document }),
        flavor: `Health Modifier (${modifierType === 'add' ? 'Healing' : 'Damage'})`,
        rollMode: game.settings.get('core', 'rollMode')
      });
      
      console.log("[HEALTH MODIFIER] Health modifier processed successfully");
      return { message };
      
    } catch (error) {
      console.error("[HEALTH MODIFIER] Error processing health modifier:", error);
      return null;
    }
  }

  /**
   * Process energy modifier from consumable items
   * @param {Item} item The consumable item
   * @returns {Promise<Object|null>} Result object with message
   * @private
   */
  async _processEnergyModifier(item) {
    try {
      console.log("[ENERGY MODIFIER] Processing energy modifier for item:", item.name);
      
      const baseDice = item.system.energyModifierDice;
      const quantity = item.system.energyModifierQuantity || 1;
      const modifierType = item.system.energyModifierType;
      
      console.log("[ENERGY MODIFIER] Base dice:", baseDice);
      console.log("[ENERGY MODIFIER] Quantity:", quantity);
      console.log("[ENERGY MODIFIER] Modifier type:", modifierType);
      
      if (!baseDice || !modifierType) {
        console.log("[ENERGY MODIFIER] Missing dice formula or modifier type");
        return null;
      }
      
      // Build the dice formula with quantity (e.g., "2d20", "3d6")
      const diceFormula = `${quantity}${baseDice.substring(1)}`; // Remove "1" and add quantity
      console.log("[ENERGY MODIFIER] Final dice formula:", diceFormula);
      
      // Roll the dice
      const roll = new Roll(diceFormula);
      await roll.evaluate();
      
      let rollTotal = roll.total;
      const currentEnergy = this.document.system.power.value;
      const maxEnergy = this.document.system.power.max;
      
      console.log("[ENERGY MODIFIER] Base roll total:", rollTotal);
      
      // Add skill bonus if configured
      let skillBonus = 0;
      let skillName = "";
      if (item.system.energyModifierAddSkill && item.system.energyModifierSkill) {
        const skillKey = item.system.energyModifierSkill;
        
        console.log("[ENERGY MODIFIER] Debug - Skill check:", {
          skillKey: skillKey,
          abilities: this.document.system.abilities,
          hasAbilities: !!this.document.system.abilities,
          specificAbility: this.document.system.abilities?.[skillKey]
        });
        
        const abilityData = this.document.system.abilities?.[skillKey];
        if (!abilityData) {
          console.warn("[ENERGY MODIFIER] Ability data not found for skill:", skillKey);
          // Skip skill bonus if ability not found
        } else {
          const skillValue = (abilityData?.value || 0) + (abilityData?.totalBonus || 0);
        
          // Double the skill value if requested
          skillBonus = item.system.energyModifierDoubleSkill ? skillValue * 2 : skillValue;
          skillName = game.i18n.localize(`CARDIGAN.Ability.${skillKey.charAt(0).toUpperCase() + skillKey.slice(1)}.long`);
          
          rollTotal += skillBonus;
          
          console.log("[ENERGY MODIFIER] Skill bonus:", {
            skill: skillName,
            baseValue: skillValue,
            doubled: item.system.energyModifierDoubleSkill,
            finalBonus: skillBonus,
            totalWithSkill: rollTotal
          });
        }
      }
      
      // Add additional bonus if configured
      let additionalBonus = 0;
      if (item.system.energyModifierAdditionalBonus && item.system.energyModifierAdditionalBonus > 0) {
        additionalBonus = item.system.energyModifierAdditionalBonus;
        rollTotal += additionalBonus;
        
        console.log("[ENERGY MODIFIER] Additional bonus:", {
          bonus: additionalBonus,
          totalWithBonus: rollTotal
        });
      }
      
      console.log("[ENERGY MODIFIER] Final total (dice + skill + bonus):", rollTotal);
      console.log("[ENERGY MODIFIER] Current energy:", currentEnergy);
      console.log("[ENERGY MODIFIER] Max energy:", maxEnergy);
      console.log("[ENERGY MODIFIER] Is temporary:", item.system.energyModifierIsTemporary);
      
      let formula = `${diceFormula}: ${roll.total}`;
      if (skillBonus > 0) {
        formula += ` + ${skillName} ${skillBonus}`;
      }
      if (additionalBonus > 0) {
        formula += ` + Bônus ${additionalBonus}`;
      }
      
      let message;
      let updateResult;
      
      // Check if this is a temporary energy point
      if (item.system.energyModifierIsTemporary) {
        console.log("[ENERGY MODIFIER] Creating temporary energy effect for tracking table");
        
        // Apply the energy bonus directly to the actor's Energy Bonus
        const energyBonus = modifierType === 'add' ? rollTotal : -rollTotal; // Negative for subtract
        const currentEnergyBonus = this.document.system.status.energyBonus || 0;
        const newEnergyBonus = currentEnergyBonus + energyBonus; // Allow negative values temporarily
        
        // Update Energy Bonus
        updateResult = await this.document.update({
          'system.status.energyBonus': newEnergyBonus
        });
        
        // Create tracking effect item for the effects table
        const trackingEffectName = modifierType === 'add' 
          ? `${item.name} (consumed)` 
          : `${item.name} (consumed)`;
        
        const trackingDescription = modifierType === 'add' 
          ? `Energy Bonus: +${rollTotal} (${formula})`
          : `Energy Bonus: ${rollTotal} (${formula})`;
        
        // Create effect item with energy bonus data
        const effectItemData = {
          name: trackingEffectName,
          type: "efeito",
          system: {
            description: trackingDescription,
            // Store the energy bonus value for removal purposes
            energyBonusValue: energyBonus,
            sourceItemId: item.id,
            sourceItemName: item.name,
            isTemporaryEnergy: true
          }
        };
        
        console.log("[ENERGY MODIFIER] Creating effect item with data:", effectItemData);
        
        // Create the tracking effect item in actor's items
        const createdItems = await this.document.createEmbeddedDocuments("Item", [effectItemData]);
        console.log("[ENERGY MODIFIER] Created effect item:", createdItems[0]);
        console.log("[ENERGY MODIFIER] Created item system data:", createdItems[0].system);
        
        if (modifierType === 'add') {
          message = `Temporary Energy added: +${rollTotal} (${formula}) - Added to Energy Bonus`;
        } else {
          message = `Temporary Energy reduced: -${rollTotal} (${formula}) - Removed from Energy Bonus`;
        }
        console.log("[ENERGY MODIFIER] Temporary energy tracking effect created with energyBonusValue:", energyBonus);
        
      } else {
        // Standard energy modification (permanent)
        let newEnergy;
        
        if (modifierType === 'add') {
          // Add energy (but don't exceed max)
          newEnergy = Math.min(currentEnergy + rollTotal, maxEnergy);
          message = `Energy restored: +${rollTotal} (${formula}) - Energy: ${currentEnergy} → ${newEnergy}`;
        } else if (modifierType === 'subtract') {
          // Subtract energy (but don't go below 0)
          newEnergy = Math.max(currentEnergy - rollTotal, 0);
          message = `Energy lost: -${rollTotal} (${formula}) - Energy: ${currentEnergy} → ${newEnergy}`;
        }
        
        console.log("[ENERGY MODIFIER] New energy calculated:", newEnergy);
        
        // Update the actor's energy
        console.log("[ENERGY MODIFIER] Updating actor energy to:", newEnergy);
        updateResult = await this.document.update({
          'system.power.value': newEnergy
        });
      }
      
      console.log("[ENERGY MODIFIER] Update result:", updateResult);
      
      // Send the roll to chat
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.document }),
        flavor: `Energy Modifier (${modifierType === 'add' ? 'Restoration' : 'Drain'})`,
        rollMode: game.settings.get('core', 'rollMode')
      });
      
      console.log("[ENERGY MODIFIER] Energy modifier processed successfully");
      return { message };
      
    } catch (error) {
      console.error("[ENERGY MODIFIER] Error processing energy modifier:", error);
      return null;
    }
  }

  /**
   * Process armor bonus effects when consuming an item
   * @param {Item} item The consumable item being used
   * @returns {Promise<Object|null>} Result with message or null if error
   * @private
   */
  async _processArmorBonus(item) {
    try {
      console.log("[ARMOR BONUS] Processing armor bonus for item:", item.name);
      
      if (!item.system.hasArmorBonus || !item.system.armorBonusAmount || item.system.armorBonusAmount <= 0) {
        console.log("[ARMOR BONUS] No armor bonus configured or amount is 0");
        return null;
      }
      
      const bonusAmount = item.system.armorBonusAmount;
      let message = "";
      let updateResult = null;
      
      console.log("[ARMOR BONUS] Applying temporary armor bonus:", bonusAmount);
      
      // Apply the armor bonus directly to the actor's Armor Bonus
      const currentArmorBonus = this.document.system.status.armorBonus || 0;
      const newArmorBonus = currentArmorBonus + bonusAmount;
      
      // Update Armor Bonus
      updateResult = await this.document.update({
        'system.status.armorBonus': newArmorBonus
      });
      
      // Create tracking effect item for the effects table
      const trackingEffectName = `${item.name} (consumed)`;
      const trackingDescription = `Armor Bonus: +${bonusAmount}`;
      
      // Create effect item with armor bonus data
      const effectItemData = {
        name: trackingEffectName,
        type: "efeito",
        system: {
          description: trackingDescription,
          // Store the armor bonus value for removal purposes
          armorBonusValue: bonusAmount,
          sourceItemId: item.id,
          sourceItemName: item.name,
          isTemporaryArmor: true
        }
      };
      
      console.log("[ARMOR BONUS] Creating effect item with data:", effectItemData);
      
      // Create the tracking effect item in actor's items
      const createdItems = await this.document.createEmbeddedDocuments("Item", [effectItemData]);
      console.log("[ARMOR BONUS] Created effect item:", createdItems[0]);
      console.log("[ARMOR BONUS] Created item system data:", createdItems[0].system);
      
      message = `Temporary Armor Bonus added: +${bonusAmount} - Added to Armor Bonus`;
      console.log("[ARMOR BONUS] Temporary armor tracking effect created with armorBonusValue:", bonusAmount);
      
      console.log("[ARMOR BONUS] Update result:", updateResult);
      
      console.log("[ARMOR BONUS] Armor bonus processed successfully");
      return { message };
      
    } catch (error) {
      console.error("[ARMOR BONUS] Error processing armor bonus:", error);
      return null;
    }
  }

  /**
   * Process status ailments effects when consuming an item
   * @param {Item} item The consumable item being used
   * @returns {Promise<Object|null>} Result with message or null if error
   * @private
   */
  async _processStatusAilments(item) {
    try {
      console.log("[STATUS AILMENTS] Processing status ailments for item:", item.name);
      console.log("[STATUS AILMENTS] Item configuration:", {
        hasStatusAilments: item.system.hasStatusAilments,
        hasSanityModifier: item.system.hasSanityModifier,
        sanityModifierType: item.system.sanityModifierType,
        sanityModifierAmount: item.system.sanityModifierAmount
      });
      
      if (!item.system.hasStatusAilments || !item.system.hasSanityModifier || !item.system.sanityModifierAmount) {
        console.log("[STATUS AILMENTS] No status ailments configured - missing requirements");
        return null;
      }
      
      const modifierType = item.system.sanityModifierType; // "increase" or "decrease"
      const amount = item.system.sanityModifierAmount; // 1-5
      let message = "";
      
      console.log("[STATUS AILMENTS] Processing sanity modifier:", {
        type: modifierType,
        amount: amount
      });
      
      // Get current sanity value
      const currentSanity = this.document.system.status.sanity || 0;
      let newSanity = currentSanity;
      let chatMessage = "";
      
      if (modifierType === "increase") {
        // Increase sanity (max 5)
        newSanity = Math.min(currentSanity + amount, 5);
        message = `Sanity increased by ${amount}: ${currentSanity} → ${newSanity}`;
        
        // Generate descriptive chat message based on new sanity level after increase
        if (newSanity === 0) {
          chatMessage = `${this.document.name}: Estado mental estabilizado.`;
        } else if (newSanity > 0) {
          // Show the current sanity level message after the increase
          const sanityMessages = {
            1: "Ansioso, você está estressado, tenso e desconfiado.",
            2: "Paranoico, você está desesperado, neurótico e pessimista.",
            3: "Violento, você inconsequente, você está hostil e insensível.",
            4: "Vilanesco, você está completamente insano, todos são inimigos e odiáveis.",
            5: "Perdido, o narrador assume seu personagem para guiá-lo à auto-destruição."
          };
          chatMessage = `${this.document.name}: ${sanityMessages[newSanity]}`;
        }
      } else if (modifierType === "decrease") {
        // Decrease sanity (min 0)
        if (currentSanity === 0) {
          message = `Sanity is already at 0 and cannot be decreased further`;
          console.log("[STATUS AILMENTS] Sanity already at minimum");
          return { message };
        }
        
        newSanity = Math.max(currentSanity - amount, 0);
        message = `Sanity decreased by ${amount}: ${currentSanity} → ${newSanity}`;
        
        // Generate descriptive chat message based on new sanity level
        if (newSanity > 0) {
          const sanityMessages = {
            1: "Ansioso, você está estressado, tenso e desconfiado.",
            2: "Paranoico, você está desesperado, neurótico e pessimista.",
            3: "Violento, você inconsequente, você está hostil e insensível.",
            4: "Vilanesco, você está completamente insano, todos são inimigos e odiáveis.",
            5: "Perdido, o narrador assume seu personagem para guiá-lo à auto-destruição."
          };
          chatMessage = `${this.document.name}: ${sanityMessages[newSanity]}`;
        } else {
          chatMessage = `${this.document.name}: Estado mental estabilizado.`;
        }
      }
      
      console.log("[STATUS AILMENTS] Sanity change:", {
        current: currentSanity,
        new: newSanity,
        change: newSanity - currentSanity
      });
      
      // Update the actor's sanity
      const updateResult = await this.document.update({
        'system.status.sanity': newSanity
      });
      
      // Send descriptive message to chat if there's a change in sanity level
      console.log("[STATUS AILMENTS] Chat message debug:", {
        chatMessage,
        newSanity,
        currentSanity,
        hasChange: newSanity !== currentSanity,
        shouldSendMessage: chatMessage && newSanity !== currentSanity
      });
      
      if (chatMessage && newSanity !== currentSanity) {
        console.log("[STATUS AILMENTS] Sending chat message:", chatMessage);
        await ChatMessage.create({ 
          content: chatMessage,
          speaker: ChatMessage.getSpeaker({ actor: this.document })
        });
        console.log("[STATUS AILMENTS] Chat message sent successfully");
      } else {
        console.log("[STATUS AILMENTS] Chat message not sent - conditions not met");
      }
      
      console.log("[STATUS AILMENTS] Update result:", updateResult);
      console.log("[STATUS AILMENTS] Status ailments processed successfully");
      return { message };
      
    } catch (error) {
      console.error("[STATUS AILMENTS] Error processing status ailments:", error);
      return null;
    }
  }

  /**
   * Process toxicity modifications for consumable items
   * @param {Item} item - The consumable item with toxicity modifiers
   * @returns {Object|null} Processing result with message
   */
  async _processToxicity(item) {
    try {
      console.log("[TOXICITY] Processing toxicity for item:", item.name);
      console.log("[TOXICITY] Item configuration:", {
        hasToxicityModifier: item.system.hasToxicityModifier,
        toxicityModifierType: item.system.toxicityModifierType,
        toxicityModifierAmount: item.system.toxicityModifierAmount
      });
      
      if (!item.system.hasToxicityModifier || !item.system.toxicityModifierAmount) {
        console.log("[TOXICITY] No toxicity modifier configured - missing requirements");
        return null;
      }

      const modifierType = item.system.toxicityModifierType; // "increase" or "decrease"
      const amount = item.system.toxicityModifierAmount;
      let message = "";
      let chatMessage = "";

      const currentToxicity = this.document.system.status.toxicity || 0;
      let newToxicity = currentToxicity;
      
      if (modifierType === "increase") {
        // Increase toxicity (max 5)
        newToxicity = Math.min(currentToxicity + amount, 5);
        message = `Toxicity increased by ${amount}: ${currentToxicity} → ${newToxicity}`;
        
        // Generate descriptive chat message based on new toxicity level after increase
        if (newToxicity === 0) {
          chatMessage = `${this.document.name}: Toxinas eliminadas do organismo.`;
        } else if (newToxicity > 0) {
          // Show the current toxicity level message after the increase
          const toxicityMessages = {
            1: "Levemente intoxicado, você sente náusea e tontura.",
            2: "Intoxicação moderada, você está enjoado e com visão turva.",
            3: "Severamente intoxicado, você está vomitando e com dores intensas.",
            4: "Intoxicação crítica, você está delirando e perdendo consciência.",
            5: "Envenenamento fatal, você está à beira da morte por toxinas."
          };
          chatMessage = `${this.document.name}: ${toxicityMessages[newToxicity]}`;
        }
      } else if (modifierType === "decrease") {
        // Decrease toxicity (min 0)
        if (currentToxicity === 0) {
          message = `Toxicity is already at 0 and cannot be decreased further`;
          console.log("[TOXICITY] Toxicity already at minimum");
          return { message };
        }
        
        newToxicity = Math.max(currentToxicity - amount, 0);
        message = `Toxicity decreased by ${amount}: ${currentToxicity} → ${newToxicity}`;
        
        // Generate descriptive chat message based on new toxicity level
        if (newToxicity > 0) {
          const toxicityMessages = {
            1: "Levemente intoxicado, você sente náusea e tontura.",
            2: "Intoxicação moderada, você está enjoado e com visão turva.",
            3: "Severamente intoxicado, você está vomitando e com dores intensas.",
            4: "Intoxicação crítica, você está delirando e perdendo consciência.",
            5: "Envenenamento fatal, você está à beira da morte por toxinas."
          };
          chatMessage = `${this.document.name}: ${toxicityMessages[newToxicity]}`;
        } else {
          chatMessage = `${this.document.name}: Toxinas eliminadas do organismo.`;
        }
      }
      
      console.log("[TOXICITY] Toxicity change:", {
        current: currentToxicity,
        new: newToxicity,
        change: newToxicity - currentToxicity
      });
      
      // Update the actor's toxicity
      const updateResult = await this.document.update({
        'system.status.toxicity': newToxicity
      });
      
      // Send descriptive message to chat if there's a change in toxicity level
      console.log("[TOXICITY] Chat message debug:", {
        chatMessage,
        newToxicity,
        currentToxicity,
        hasChange: newToxicity !== currentToxicity,
        shouldSendMessage: chatMessage && newToxicity !== currentToxicity
      });
      
      if (chatMessage && newToxicity !== currentToxicity) {
        console.log("[TOXICITY] Sending chat message:", chatMessage);
        await ChatMessage.create({ 
          content: chatMessage,
          speaker: ChatMessage.getSpeaker({ actor: this.document })
        });
        console.log("[TOXICITY] Chat message sent successfully");
      } else {
        console.log("[TOXICITY] Chat message not sent - conditions not met");
      }
      
      console.log("[TOXICITY] Update result:", updateResult);
      console.log("[TOXICITY] Toxicity processed successfully");
      return { message };
      
    } catch (error) {
      console.error("[TOXICITY] Error processing toxicity:", error);
      return null;
    }
  }

  /**
   * Process fracture modifications for consumable items
   * @param {Item} item - The consumable item with fracture modifiers
   * @returns {Object|null} Processing result with message
   */
  async _processFracture(item) {
    try {
      console.log("[FRACTURE] Processing fracture for item:", item.name);
      console.log("[FRACTURE] Item configuration:", {
        hasFractureModifier: item.system.hasFractureModifier,
        fractureModifierType: item.system.fractureModifierType,
        fractureModifierAmount: item.system.fractureModifierAmount
      });
      
      if (!item.system.hasFractureModifier || !item.system.fractureModifierAmount) {
        console.log("[FRACTURE] No fracture modifier configured - missing requirements");
        return null;
      }

      const modifierType = item.system.fractureModifierType; // "increase" or "decrease"
      const amount = item.system.fractureModifierAmount;
      let message = "";
      let chatMessage = "";

      const currentFracture = this.document.system.status.fracture || 0;
      let newFracture = currentFracture;
      
      if (modifierType === "increase") {
        // Increase fracture (max 5)
        newFracture = Math.min(currentFracture + amount, 5);
        message = `Fracture increased by ${amount}: ${currentFracture} → ${newFracture}`;
        
        // Generate descriptive chat message based on new fracture level after increase
        if (newFracture === 0) {
          chatMessage = `${this.document.name}: Fraturas curadas completamente.`;
        } else if (newFracture > 0) {
          // Show the current fracture level message after the increase
          const fractureMessages = {
            1: "Fratura leve, você sente dor e desconforto nos movimentos.",
            2: "Fratura moderada, seus movimentos estão limitados e dolorosos.",
            3: "Fratura severa, você mal consegue se mover sem dor intensa.",
            4: "Fratura crítica, seus ossos estão severamente danificados.",
            5: "Fraturas múltiplas, você está completamente incapacitado."
          };
          chatMessage = `${this.document.name}: ${fractureMessages[newFracture]}`;
        }
      } else if (modifierType === "decrease") {
        // Decrease fracture (min 0)
        if (currentFracture === 0) {
          message = `Fracture is already at 0 and cannot be decreased further`;
          console.log("[FRACTURE] Fracture already at minimum");
          return { message };
        }
        
        newFracture = Math.max(currentFracture - amount, 0);
        message = `Fracture decreased by ${amount}: ${currentFracture} → ${newFracture}`;
        
        // Generate descriptive chat message based on new fracture level
        if (newFracture > 0) {
          const fractureMessages = {
            1: "Fratura leve, você sente dor e desconforto nos movimentos.",
            2: "Fratura moderada, seus movimentos estão limitados e dolorosos.",
            3: "Fratura severa, você mal consegue se mover sem dor intensa.",
            4: "Fratura crítica, seus ossos estão severamente danificados.",
            5: "Fraturas múltiplas, você está completamente incapacitado."
          };
          chatMessage = `${this.document.name}: ${fractureMessages[newFracture]}`;
        } else {
          chatMessage = `${this.document.name}: Fraturas curadas completamente.`;
        }
      }
      
      console.log("[FRACTURE] Fracture change:", {
        current: currentFracture,
        new: newFracture,
        change: newFracture - currentFracture
      });
      
      // Update the actor's fracture
      const updateResult = await this.document.update({
        'system.status.fracture': newFracture
      });
      
      // Send descriptive message to chat if there's a change in fracture level
      console.log("[FRACTURE] Chat message debug:", {
        chatMessage,
        newFracture,
        currentFracture,
        hasChange: newFracture !== currentFracture,
        shouldSendMessage: chatMessage && newFracture !== currentFracture
      });
      
      if (chatMessage && newFracture !== currentFracture) {
        console.log("[FRACTURE] Sending chat message:", chatMessage);
        await ChatMessage.create({ 
          content: chatMessage,
          speaker: ChatMessage.getSpeaker({ actor: this.document })
        });
        console.log("[FRACTURE] Chat message sent successfully");
      } else {
        console.log("[FRACTURE] Chat message not sent - conditions not met");
      }
      
      console.log("[FRACTURE] Update result:", updateResult);
      console.log("[FRACTURE] Fracture processed successfully");
      return { message };
      
    } catch (error) {
      console.error("[FRACTURE] Error processing fracture:", error);
      return null;
    }
  }

  /**
   * Process food modifications for consumable items
   * @param {Item} item - The consumable item with food modifiers
   * @returns {Object|null} Processing result with message
   */
  async _processFood(item) {
    try {
      console.log("[FOOD] Processing food for item:", item.name);
      console.log("[FOOD] Item configuration:", {
        hasFoodModifier: item.system.hasFoodModifier,
        foodModifierType: item.system.foodModifierType,
        foodModifierAmount: item.system.foodModifierAmount
      });
      
      if (!item.system.hasFoodModifier || !item.system.foodModifierAmount) {
        console.log("[FOOD] No food modifier configured - missing requirements");
        return null;
      }

      const modifierType = item.system.foodModifierType; // "increase" or "decrease"
      const amount = item.system.foodModifierAmount;
      let message = "";
      let chatMessage = "";

      const currentHunger = this.document.system.status.hunger || 0;
      let newHunger = currentHunger;
      
      if (modifierType === "increase") {
        // Increase hunger (max 5) - worse condition
        newHunger = Math.min(currentHunger + amount, 5);
        message = `Hunger increased by ${amount}: ${currentHunger} → ${newHunger}`;
        
        // Generate descriptive chat message based on new hunger level after increase
        if (newHunger === 0) {
          chatMessage = `${this.document.name}: Fome saciada completamente.`;
        } else if (newHunger > 0) {
          // Show the current hunger level message after the increase
          const hungerMessages = {
            1: "Levemente faminto, você sente um leve desconforto no estômago.",
            2: "Moderadamente faminto, seu estômago está roncando e você pensa em comida.",
            3: "Muito faminto, a fome está afetando sua concentração e energia.",
            4: "Extremamente faminto, você está fraco e desesperado por comida.",
            5: "Morrendo de fome, você está à beira do colapso por desnutrição."
          };
          chatMessage = `${this.document.name}: ${hungerMessages[newHunger]}`;
        }
      } else if (modifierType === "decrease") {
        // Decrease hunger (min 0) - better condition, feeding the character
        if (currentHunger === 0) {
          message = `Hunger is already at 0 and cannot be decreased further`;
          console.log("[FOOD] Hunger already at minimum");
          return { message };
        }
        
        newHunger = Math.max(currentHunger - amount, 0);
        message = `Hunger decreased by ${amount}: ${currentHunger} → ${newHunger}`;
        
        // Generate descriptive chat message based on new hunger level
        if (newHunger > 0) {
          const hungerMessages = {
            1: "Levemente faminto, você sente um leve desconforto no estômago.",
            2: "Moderadamente faminto, seu estômago está roncando e você pensa em comida.",
            3: "Muito faminto, a fome está afetando sua concentração e energia.",
            4: "Extremamente faminto, você está fraco e desesperado por comida.",
            5: "Morrendo de fome, você está à beira do colapso por desnutrição."
          };
          chatMessage = `${this.document.name}: ${hungerMessages[newHunger]}`;
        } else {
          chatMessage = `${this.document.name}: Fome saciada completamente.`;
        }
      }
      
      console.log("[FOOD] Hunger change:", {
        current: currentHunger,
        new: newHunger,
        change: newHunger - currentHunger
      });
      
      // Update the actor's hunger
      const updateResult = await this.document.update({
        'system.status.hunger': newHunger
      });
      
      // Send descriptive message to chat if there's a change in hunger level
      console.log("[FOOD] Chat message debug:", {
        chatMessage,
        newHunger,
        currentHunger,
        hasChange: newHunger !== currentHunger,
        shouldSendMessage: chatMessage && newHunger !== currentHunger
      });
      
      if (chatMessage && newHunger !== currentHunger) {
        console.log("[FOOD] Sending chat message:", chatMessage);
        await ChatMessage.create({ 
          content: chatMessage,
          speaker: ChatMessage.getSpeaker({ actor: this.document })
        });
        console.log("[FOOD] Chat message sent successfully");
      } else {
        console.log("[FOOD] Chat message not sent - conditions not met");
      }
      
      console.log("[FOOD] Update result:", updateResult);
      console.log("[FOOD] Food processed successfully");
      return { message };
      
    } catch (error) {
      console.error("[FOOD] Error processing food:", error);
      return null;
    }
  }

  /**
   * Process water modifications for consumable items
   * @param {Item} item - The consumable item with water modifiers
   * @returns {Object|null} Processing result with message
   */
  async _processWater(item) {
    try {
      console.log("[WATER] Processing water for item:", item.name);
      console.log("[WATER] Item configuration:", {
        hasWaterModifier: item.system.hasWaterModifier,
        waterModifierType: item.system.waterModifierType,
        waterModifierAmount: item.system.waterModifierAmount
      });
      
      if (!item.system.hasWaterModifier || !item.system.waterModifierAmount) {
        console.log("[WATER] No water modifier configured - missing requirements");
        return null;
      }

      const modifierType = item.system.waterModifierType; // "increase" or "decrease"
      const amount = item.system.waterModifierAmount;
      let message = "";
      let chatMessage = "";

      const currentThirst = this.document.system.status.thirst || 0;
      let newThirst = currentThirst;
      
      if (modifierType === "increase") {
        // Increase thirst (max 5) - worse condition
        newThirst = Math.min(currentThirst + amount, 5);
        message = `Thirst increased by ${amount}: ${currentThirst} → ${newThirst}`;
        
        // Generate descriptive chat message based on new thirst level after increase
        if (newThirst === 0) {
          chatMessage = `${this.document.name}: Sede saciada completamente.`;
        } else if (newThirst > 0) {
          // Show the current thirst level message after the increase
          const thirstMessages = {
            1: "Levemente sedento, você sente a boca um pouco seca.",
            2: "Moderadamente sedento, você precisa de água e pensa em beber algo.",
            3: "Muito sedento, a sede está afetando sua capacidade de concentração.",
            4: "Extremamente sedento, você está desesperado por água e se sente fraco.",
            5: "Morrendo de sede, você está à beira do colapso por desidratação."
          };
          chatMessage = `${this.document.name}: ${thirstMessages[newThirst]}`;
        }
      } else if (modifierType === "decrease") {
        // Decrease thirst (min 0) - better condition, hydrating the character
        if (currentThirst === 0) {
          message = `Thirst is already at 0 and cannot be decreased further`;
          console.log("[WATER] Thirst already at minimum");
          return { message };
        }
        
        newThirst = Math.max(currentThirst - amount, 0);
        message = `Thirst decreased by ${amount}: ${currentThirst} → ${newThirst}`;
        
        // Generate descriptive chat message based on new thirst level
        if (newThirst > 0) {
          const thirstMessages = {
            1: "Levemente sedento, você sente a boca um pouco seca.",
            2: "Moderadamente sedento, você precisa de água e pensa em beber algo.",
            3: "Muito sedento, a sede está afetando sua capacidade de concentração.",
            4: "Extremamente sedento, você está desesperado por água e se sente fraco.",
            5: "Morrendo de sede, você está à beira do colapso por desidratação."
          };
          chatMessage = `${this.document.name}: ${thirstMessages[newThirst]}`;
        } else {
          chatMessage = `${this.document.name}: Sede saciada completamente.`;
        }
      }
      
      console.log("[WATER] Thirst change:", {
        current: currentThirst,
        new: newThirst,
        change: newThirst - currentThirst
      });
      
      // Update the actor's thirst
      const updateResult = await this.document.update({
        'system.status.thirst': newThirst
      });
      
      // Send descriptive message to chat if there's a change in thirst level
      console.log("[WATER] Chat message debug:", {
        chatMessage,
        newThirst,
        currentThirst,
        hasChange: newThirst !== currentThirst,
        shouldSendMessage: chatMessage && newThirst !== currentThirst
      });
      
      if (chatMessage && newThirst !== currentThirst) {
        console.log("[WATER] Sending chat message:", chatMessage);
        await ChatMessage.create({ 
          content: chatMessage,
          speaker: ChatMessage.getSpeaker({ actor: this.document })
        });
        console.log("[WATER] Chat message sent successfully");
      } else {
        console.log("[WATER] Chat message not sent - conditions not met");
      }
      
      console.log("[WATER] Update result:", updateResult);
      console.log("[WATER] Water processed successfully");
      return { message };
      
    } catch (error) {
      console.error("[WATER] Error processing water:", error);
      return null;
    }
  }

  /**
   * Process movement boost for consumable items
   * @param {Item} item - The consumable item with movement boost
   * @returns {Object|null} Processing result with message
   */
  async _processMovementBoost(item) {
    try {
      console.log("[MOVEMENT] Processing movement boost for item:", item.name);
      console.log("[MOVEMENT] Actor system structure:", this.document.system);
      console.log("[MOVEMENT] Actor details:", this.document.system.details);
      
      if (!item.system.hasMovementBoost || !item.system.movementBoostAmount) {
        console.log("[MOVEMENT] No movement boost configured");
        return null;
      }

      const amount = item.system.movementBoostAmount;
      const currentMovementManual = this.document.system.details.movementManual || 0;
      const newMovementManual = currentMovementManual + amount;
      
      console.log("[MOVEMENT] Current movementManual value:", currentMovementManual);
      console.log("[MOVEMENT] Amount to add:", amount);
      console.log("[MOVEMENT] New movementManual value:", newMovementManual);

      // Update the actor's movementManual (which will be added to the auto-calculated value)
      console.log("[MOVEMENT] About to update actor with:", {
        'system.details.movementManual': newMovementManual
      });
      
      const updateResult = await this.document.update({
        'system.details.movementManual': newMovementManual
      });
      
      console.log("[MOVEMENT] Update result:", updateResult);
      console.log("[MOVEMENT] Actor movementManual after update:", this.document.system.details.movementManual);

      console.log("[MOVEMENT] Movement boost applied:", {
        currentManual: currentMovementManual,
        amount: amount,
        newManual: newMovementManual
      });

      return { 
        message: `Movement increased by ${amount}`,
        type: 'movement',
        amount: amount
      };
      
    } catch (error) {
      console.error("[MOVEMENT] Error processing movement boost:", error);
      return null;
    }
  }

  /**
   * Process critical hit boost for consumable items
   * @param {Item} item - The consumable item with critical hit boost
   * @returns {Object|null} Processing result with message
   */
  async _processCriticalHitBoost(item) {
    try {
      console.log("[CRITICAL HIT] Processing critical hit boost for item:", item.name);
      console.log("[CRITICAL HIT] Actor system structure:", this.document.system);
      console.log("[CRITICAL HIT] Actor details:", this.document.system.details);
      
      if (!item.system.hasCriticalHitBoost || !item.system.criticalHitBoostAmount) {
        console.log("[CRITICAL HIT] No critical hit boost configured");
        return null;
      }

      const amount = item.system.criticalHitBoostAmount;
      const currentCriticalHitManual = this.document.system.details.criticalHitManual || 0;
      const newCriticalHitManual = currentCriticalHitManual - amount; // Subtract to improve (lower is better)
      
      console.log("[CRITICAL HIT] Current criticalHitManual value:", currentCriticalHitManual);
      console.log("[CRITICAL HIT] Amount to subtract:", amount);
      console.log("[CRITICAL HIT] New criticalHitManual value:", newCriticalHitManual);

      // Update the actor's criticalHitManual (which will be added to the auto-calculated value)
      console.log("[CRITICAL HIT] About to update actor with:", {
        'system.details.criticalHitManual': newCriticalHitManual
      });
      
      const updateResult = await this.document.update({
        'system.details.criticalHitManual': newCriticalHitManual
      });
      
      console.log("[CRITICAL HIT] Update result:", updateResult);
      console.log("[CRITICAL HIT] Actor criticalHitManual after update:", this.document.system.details.criticalHitManual);

      console.log("[CRITICAL HIT] Critical hit boost applied:", {
        currentManual: currentCriticalHitManual,
        amount: amount,
        newManual: newCriticalHitManual
      });

      return { 
        message: `Critical Hit improved by ${amount}`,
        type: 'criticalHit',
        amount: amount
      };
      
    } catch (error) {
      console.error("[CRITICAL HIT] Error processing critical hit boost:", error);
      return null;
    }
  }

  /**
   * Handle short rest action
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onShortRest(event, target) {
    event.preventDefault();
    const actor = this.document;
    
    // Confirm rest action using DialogV2
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("CARDIGAN.Rest.ShortRest") || "Short Rest" },
      content: `<p>${game.i18n.localize("CARDIGAN.Rest.Confirmation.ShortRest") || "Take a short rest? This will restore some health and power based on your vigor."}</p>`
    });
    
    if (!confirmed) return;
    
    await CardiganSystemActorSheet._performRest(actor, "short");
  }

  /**
   * Handle long rest action
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onLongRest(event, target) {
    event.preventDefault();
    const actor = this.document;
    
    // Confirm rest action using DialogV2
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("CARDIGAN.Rest.LongRest") || "Long Rest" },
      content: `<p>${game.i18n.localize("CARDIGAN.Rest.Confirmation.LongRest") || "Take a long rest? This will restore more health and power, remove certain effects, and potentially remove exhaustion."}</p>`
    });
    
    if (!confirmed) return;
    
    await CardiganSystemActorSheet._performRest(actor, "long");
  }

  /**
   * Perform the rest mechanics
   * @param {Actor} actor - The actor taking the rest
   * @param {string} restType - "short" or "long"
   */
  static async _performRest(actor, restType) {
    try {
      const actorData = actor.system;
      
      // Calculate total stamina (value + bonus) like in the character data model
      const staminaValue = actorData.abilities?.stamina?.value || 0;
      const staminaBonus = actorData.abilities?.stamina?.totalBonus || 0;
      const vigor = staminaValue + staminaBonus;
      
      let recoveryRoll;
      let results = [];
      
      if (restType === "short") {
        // Short rest: 1d20 + 2×vigor
        recoveryRoll = new Roll("1d20 + @vigor", { vigor: vigor * 2 });
      } else {
        // Long rest: 2d20 + 3×vigor
        recoveryRoll = new Roll("2d20 + @vigor", { vigor: vigor * 3 });
      }
      
      // Roll for recovery (same value for health and energy)
      await recoveryRoll.evaluate();
      
      const recoveredAmount = recoveryRoll.total;
      
      // Update health and energy
      const currentHealth = actorData.health?.value || 0;
      const maxHealth = actorData.health?.max || 0;
      const currentPower = actorData.power?.value || 0;
      const maxPower = actorData.power?.max || 0;
      
      const newHealth = Math.min(currentHealth + recoveredAmount, maxHealth);
      const newPower = Math.min(currentPower + recoveredAmount, maxPower);
      
      const updateData = {
        "system.health.value": newHealth,
        "system.power.value": newPower
      };
      
      results.push(`Vida Recuperada: ${recoveredAmount}`);
      results.push(`Energia Recuperada: ${recoveredAmount}`);
      
      // Long rest specific effects
      if (restType === "long") {
        // Remove certain effects (fracture, sanity, toxicity)
        const statusUpdates = {};
        let effectsRemoved = [];
        
        if (actorData.status?.fracture > 0) {
          statusUpdates["system.status.fracture"] = 0;
          effectsRemoved.push("Fratura");
        }
        
        if (actorData.status?.sanity !== null && actorData.status?.sanity > 0) {
          statusUpdates["system.status.sanity"] = 0;
          effectsRemoved.push("Sanidade");
        }
        
        if (actorData.status?.toxicity !== null && actorData.status?.toxicity > 0) {
          statusUpdates["system.status.toxicity"] = 0;
          effectsRemoved.push("Toxicidade");
        }
        
        Object.assign(updateData, statusUpdates);
        
        if (effectsRemoved.length > 0) {
          results.push("Efeitos Removidos: " + effectsRemoved.join(", "));
        }
      }
      
      // Check for exhaustion removal for both short and long rest (only if not wearing heavy armor)
      const isWearingHeavyArmor = await CardiganSystemActorSheet._checkHeavyArmor(actor);
      
      // Find exhaustion effect in actor items (Cardigan uses items for effects, not Active Effects)
      const exhaustionEffect = actor.items.find(item => {
        const name = item.name?.toLowerCase() || "";
        const type = item.type?.toLowerCase() || "";
        const isExhaustion = (type === "efeito") && 
                           (name.includes("exaustão") || 
                            name.includes("exhaustion") ||
                            name.includes("exaust"));
        
        console.log(`[REST] Checking item "${item.name}" (type: ${item.type}): isExhaustion = ${isExhaustion}`);
        return isExhaustion;
      });
      
      console.log(`[REST] Exhaustion effect found:`, exhaustionEffect ? exhaustionEffect.name : "None");
      console.log(`[REST] Available effect items:`, actor.items.filter(i => i.type === "efeito").map(e => e.name));
      
      if (exhaustionEffect) {
        if (isWearingHeavyArmor) {
          results.push("Não é possível remover exaustão enquanto usa armadura pesada");
        } else {
          console.log(`[REST] Removing exhaustion effect: ${exhaustionEffect.name}`);
          await exhaustionEffect.delete();
          results.push("Exaustão removida");
        }
      } else {
        console.log(`[REST] No exhaustion effect found in items.`);
      }
      
      // Apply all updates
      await actor.update(updateData);
      
      // Show results in chat
      await CardiganSystemActorSheet._showRestResults(actor, restType, recoveryRoll, results);
      
      ui.notifications.info("Descanso realizado com sucesso");
      
    } catch (error) {
      console.error("[REST] Error performing rest:", error);
      ui.notifications.error("Error performing rest: " + error.message);
    }
  }

  /**
   * Check if actor is wearing heavy armor
   * @param {Actor} actor - The actor to check
   * @returns {boolean} - True if wearing heavy armor
   */
  static async _checkHeavyArmor(actor) {
    const equippedArmor = actor.items.filter(item => 
      item.type === "armadura" && item.system.equipped
    );
    
    return equippedArmor.some(armor => armor.system.weight === "pesado");
  }

  /**
   * Show rest results in chat
   * @param {Actor} actor - The actor who rested
   * @param {string} restType - "short" or "long"
   * @param {Roll} recoveryRoll - The recovery roll
   * @param {Array} results - Array of result messages
   */
  static async _showRestResults(actor, restType, recoveryRoll, results) {
    const restLabel = restType === "short" 
      ? (game.i18n.localize("CARDIGAN.Rest.ShortRest") || "Descanso Curto")
      : (game.i18n.localize("CARDIGAN.Rest.LongRest") || "Descanso Longo");
    
    // Create flavor text with additional effects
    let flavor = `<h3>${restLabel}</h3>`;
    if (results.length > 0) {
      flavor += `<div class="rest-effects">`;
      flavor += results.map(result => `<div>• ${result}</div>`).join("");
      flavor += `</div>`;
    }
    
    // Send roll to chat like skill tests
    await recoveryRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: flavor,
      rollMode: game.settings.get('core', 'rollMode')
    });
  }



}
