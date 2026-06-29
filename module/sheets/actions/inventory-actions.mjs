/**
 * Inventory Actions Module
 * Handles event handlers related to the inventory banner toggles
 */
export class InventoryActions {

  /**
   * Toggle the visibility of the backpack container
   * @param {Event} event
   * @param {HTMLElement} target
   * @param {CardiganSystemActorSheet} sheet
   */
  static async onToggleBackpackContainer(event, target, sheet) {
    const checkbox = target.closest('.backpack-toggle').querySelector('input[name="system.details.showBackpackContainer"]');
    const currentValue = checkbox.checked;
    await sheet.actor.update({ 'system.details.showBackpackContainer': !currentValue });
  }

  /**
   * Toggle the visibility of the weapons table
   * @param {Event} event
   * @param {HTMLElement} target
   * @param {CardiganSystemActorSheet} sheet
   */
  static async onToggleWeaponsTable(event, target, sheet) {
    const checkbox = target.closest('.equipament-toggle').querySelector('input[name="system.details.showWeaponsTable"]');
    const currentValue = checkbox.checked;
    await sheet.actor.update({ 'system.details.showWeaponsTable': !currentValue });
  }

  /**
   * Return all items that belong in the backpack table for a given actor.
   * Canonical filter used by all backpack-related logic.
   * @param {Actor} actor
   * @returns {Item[]}
   */
  static getBackpackItems(actor) {
    return actor.items.filter(i => {
      if (i.type === 'item-comum' || i.type === 'item-municao' || i.type === 'item-consumivel' || i.type === 'item-ingredient') {
        return true;
      }
      if (i.type === 'arma' && !i.system.equipped) return true;
      if (i.type === 'armadura' && !i.system.equipped) return true;
      return false;
    });
  }

  /**
   * Check whether the backpack has room for extra spaces given the current occupied count.
   * @param {Actor} actor
   * @param {number} currentSpaces - Already-occupied spaces (from context)
   * @param {string} weight
   * @param {number} quantity
   * @returns {boolean}
   */
  static hasBackpackSpace(actor, currentSpaces, weight, quantity) {
    const maxSpaces = actor.system.backpack.max;
    const requiredSpaces = InventoryActions.calculateItemSpaces(weight, quantity);
    return (currentSpaces + requiredSpaces) <= maxSpaces;
  }

  /**
   * Check whether an equipped item can be moved to the backpack (enough free space).
   * Self-contained: recalculates current backpack occupation from scratch.
   * @param {Actor} actor
   * @param {Item} item - The equipped item to test
   * @returns {boolean}
   */
  static canUnequipItem(actor, item) {
    if (!item || !item.system) return true;
    const backpackItems = InventoryActions.getBackpackItems(actor);
    const currentSpaces = InventoryActions.calculateBackpackSpaces(backpackItems, actor.system?.money || 0);
    const requiredSpaces = InventoryActions.calculateItemSpaces(item.system.weight, item.system.quantity || 1);
    return (currentSpaces + requiredSpaces) <= actor.system.backpack.max;
  }

  /**
   * Calculate spaces occupied by a given item weight and quantity.
   * Pure function — no sheet/actor context needed.
   * @param {string} weight - 'leve', 'medio', 'pesado' or 'muito-pesado'
   * @param {number} quantity - Item quantity
   * @returns {number} Spaces occupied
   */
  static calculateItemSpaces(weight, quantity) {
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
   * Calculate total backpack spaces occupied by a list of items.
   * Pure function — no sheet/actor context needed.
   * @param {Array} backpackItems - Array of items in the backpack
   * @param {number} [moneyAmount=0] - Current money amount (100 coins = 1 space)
   * @returns {number} Total spaces occupied
   */
  static calculateBackpackSpaces(backpackItems, moneyAmount = 0) {
    if (!backpackItems || !Array.isArray(backpackItems)) return 0;

    let totalSpaces = 0;
    const weightGroups = { leve: 0 };
    const moneySpaces = Math.floor(moneyAmount / 100);

    backpackItems.forEach(item => {
      const weight = item.system?.weight;
      const quantity = item.system?.quantity || 1;

      if (weight === 'leve') {
        weightGroups.leve += quantity;
      } else {
        totalSpaces += InventoryActions.calculateItemSpaces(weight, quantity);
      }
    });

    // Apply special leve grouping rule, then add money spaces
    totalSpaces += InventoryActions.calculateItemSpaces('leve', weightGroups.leve);
    totalSpaces += moneySpaces;

    return totalSpaces;
  }

  /**
   * Calculate totals from equipped armors for display purposes only
   * This method calculates totals to show in the UI but doesn't modify the actor's actual bonus fields
   * The actual bonuses are calculated in the actor's _calculateArmorBonuses method
   * @param {object} context - The context object containing armaduras array
   * @static
   */
  static calculateArmorTotals(context) {
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
  }
}
