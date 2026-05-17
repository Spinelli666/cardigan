/**
 * Armor Item Listeners Module
 * Manages all armor-specific UI listeners for the item sheet.
 */
export class ArmorItemListeners {

  /**
   * Initialize all armor-related listeners for the item sheet.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static initialize(sheet) {
    this.setupArmorTypeSelectorButtons(sheet);
    this.setupArmorIconCheckboxToggles(sheet);
  }

  /**
   * Setup armor type selector buttons.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupArmorTypeSelectorButtons(sheet) {
    if (sheet.item.type !== 'armadura') return;

    const grid = sheet.element?.querySelector('.armor-type-selector-grid');
    if (!grid) return;

    const buttons = grid.querySelectorAll('.armor-type-selector-btn');
    buttons.forEach(button => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const armorType = button.dataset.armorType;
        if (armorType && armorType !== sheet.item.system.armorType) {
          await sheet.item.update({ 'system.armorType': armorType });
        }
      });
    });
  }


  /**
   * Setup click/keyboard toggles where armor icons control checkbox fields.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupArmorIconCheckboxToggles(sheet) {
    if (sheet.item.type !== 'armadura') return;

    const root = sheet.element;
    if (!root) return;

    const toggleIcons = root.querySelectorAll('[data-armor-checkbox-toggle]');
    if (!toggleIcons.length) return;

    const syncIconState = (icon, isChecked) => {
      icon.classList.toggle('is-active', isChecked);
      icon.setAttribute('aria-pressed', String(isChecked));
      icon.closest('.armor-extra-content')?.classList.toggle('is-active', isChecked);
    };

    toggleIcons.forEach((icon) => {
      const checkboxPath = icon.dataset.armorCheckboxToggle;
      if (!checkboxPath) return;

      const hasExplicitValues =
        Object.prototype.hasOwnProperty.call(icon.dataset, 'armorToggleOnValue') ||
        Object.prototype.hasOwnProperty.call(icon.dataset, 'armorToggleOffValue');

      const onValue = icon.dataset.armorToggleOnValue ?? true;
      const offValue = icon.dataset.armorToggleOffValue ?? false;

      const getCurrentValue = () => foundry.utils.getProperty(sheet.item, checkboxPath);

      const isChecked = () => {
        const current = getCurrentValue();
        if (hasExplicitValues) return String(current) === String(onValue);
        return Boolean(current);
      };

      const toggleCheckbox = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const nextChecked = !isChecked();
        const nextValue = hasExplicitValues ? (nextChecked ? onValue : offValue) : nextChecked;
        syncIconState(icon, nextChecked);
        await sheet.item.update({ [checkboxPath]: nextValue });
      };

      icon.addEventListener('click', toggleCheckbox);
      icon.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          toggleCheckbox(event);
        }
      });

      syncIconState(icon, isChecked());
    });
  }
}
