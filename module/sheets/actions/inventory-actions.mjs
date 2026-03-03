/**
 * Inventory Actions Module
 * Handles event handlers related to the inventory banner (backpack toggle)
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
}
