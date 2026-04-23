/**
 * Item Prepare Actions Module
 * Handles item organization and preparation for the actor sheet context
 */

import { InventoryActions } from './inventory-actions.mjs';
import { ProfessionFilterActions } from './profession-filter-actions.mjs';

export class ItemPrepareActions {

  /**
   * Organize and classify Items for Actor sheets.
   * Main orchestrator for sorting items into categories (backpack, weapons, armor, skills, etc.)
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   * @param {object} context - The context object to mutate
   * @static
   */
  static prepareItems(sheet, context) {
    // Initialize containers.
    const backpack = [];
    const proficiencies = [];
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

    // Iterate through items, allocating to containers
    for (let i of sheet.document.items) {

      // Append to backpack.
      if (i.type === 'backpack' || i.type === 'item-comum' || i.type === 'item-municao' || i.type === 'item-consumivel' || i.type === 'item-ingredient') {
        backpack.push(i);
      }
      // Append to armas (weapons).
      else if (i.type === 'arma') {
        // Only equipped weapons go to armas table, unequipped ones go to backpack table
        if (i.system.equipped) {
          armas.push(i);
        } else {
          // Unequipped weapons go to backpack table
          backpack.push(i);
        }
      }
      // Append to armaduras (armor).
      else if (i.type === 'armadura') {
        // Only equipped armors go to armaduras table, unequipped ones go to backpack table
        if (i.system.equipped) {
          armaduras.push(i);
        } else {
          // Unequipped armors go to backpack table
          backpack.push(i);
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
        if (recipeType === 'culinary') {
          culinaryRecipes.push(i);
        } else if (recipeType === 'tailoring') {
          tailoringRecipes.push(i);
        } else if (recipeType === 'tecnomagic') {
          tecnomagicRecipes.push(i);
        } else if (recipeType === 'blacksmithing') {
          blacksmithingRecipes.push(i);
        } else if (recipeType === 'alchemy') {
          alchemyRecipes.push(i);
        }
      }
    }

    // Add unarmed attacks for free hands
    ItemPrepareActions.addUnarmedAttacks(sheet, armas);

    // Sort armors by type order (Cabeça, Acessórios, Torso, Braços, Pernas, Pés)
    const armorTypeOrder = {
      "cabeca": 1,
      "acessorios": 2,
      "torso": 3,
      "bracos": 4,
      "pernas": 5,
      "pes": 6
    };

    // Sort then assign
    let sortedBackpack = backpack.sort((a, b) => (a.sort || 0) - (b.sort || 0));

    // Apply profession filter
    sortedBackpack = ProfessionFilterActions.applyBackpackFilter(sheet, sortedBackpack);
    
    context.backpack = sortedBackpack;
    context.proficiencies = proficiencies.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.efeitos = efeitos.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    context.recipes = recipes.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    
    // Find race item if exists
    context.raceItem = sheet.document.items.find(i => i.type === 'race') || null;
    
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

    // Calculate armor totals for equipped armors
    InventoryActions.calculateArmorTotals(context);
    
    // Calculate backpack spaces occupied
    context.backpackSpacesOccupied = InventoryActions.calculateBackpackSpaces(context.backpack, sheet.document.system?.money || 0);
  }

  /**
   * Add unarmed attack options for free hands
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   * @param {Array} armas - The weapons array to modify
   * @static
   */
  static addUnarmedAttacks(sheet, armas) {
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

    // Get actor's total strength for damage calculation (value + bonuses)
    const strengthValue = sheet.document.system.abilities.strength.value || 0;
    const strengthBonus = sheet.document.system.abilities.strength.totalBonus || 0;
    const actorStrength = strengthValue + strengthBonus;

    // Create unarmed attack for right hand if free
    if (!rightHandOccupied) {
      const rightHandUnarmed = ItemPrepareActions.createUnarmedAttack(actorStrength, true, false);
      armas.push(rightHandUnarmed);
    }

    // Create unarmed attack for left hand if free
    if (!leftHandOccupied) {
      const leftHandUnarmed = ItemPrepareActions.createUnarmedAttack(actorStrength, false, true);
      armas.push(leftHandUnarmed);
    }
  }

  /**
   * Create a virtual unarmed attack item
   * @param {number} strengthValue - Strength value for damage (dano = força)
   * @param {boolean} rightHand - Whether this is for right hand
   * @param {boolean} leftHand - Whether this is for left hand
   * @returns {object} Virtual weapon item
   * @static
   */
  static createUnarmedAttack(strengthValue, rightHand, leftHand) {
    // Apply minimum damage rule: if strength is 0, minimum damage is 1
    const totalDamage = strengthValue > 0 ? strengthValue : 1;

    return {
      _id: `unarmed-${rightHand ? 'right' : 'left'}`, // Virtual ID
      name: `Ataque Desarmado`,
      type: 'arma',
      img: 'systems/cardigan/assets/images/decorative/icons/icon-unarmed.svg', // Unarmed icon
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
}
