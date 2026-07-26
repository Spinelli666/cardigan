/**
 * Weapon Item Listeners Module
 * Manages all weapon-specific UI listeners for the item sheet.
 */
export class WeaponItemListeners {

  /**
   * Initialize all weapon-related listeners for the item sheet.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static initialize(sheet) {
    this.setupWeaponCategoryButtons(sheet);
  }

  /**
   * Setup melee/ranged category toggle buttons.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupWeaponCategoryButtons(sheet) {
    if (sheet.item.type !== 'arma') return;

    const buttons = sheet.element?.querySelectorAll('.weapon-category-btn[data-weapon-category]');
    if (!buttons?.length) return;

    buttons.forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const category = button.dataset.weaponCategory;
        const path = `system.${category}`;
        const current = foundry.utils.getProperty(sheet.item, path);
        await sheet.item.update({ [path]: !current });
      });
    });
  }
}
