/**
 * Weapon Ammunition Behavior Module
 * Isolates conditional ammunition field behavior used by weapon sheets.
 */
export class WeaponAmmunitionBehavior {

  /**
   * Setup conditional visibility and ammunition field rendering.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupConditionalAmmunition(sheet) {
    const rangedCheckbox = sheet.element?.querySelector('input[name="system.ranged"]');
    const isFirearmCheckbox = sheet.element?.querySelector('input[name="system.isFirearm"]');
    const firearmSection = sheet.element?.querySelector('.firearm-section');
    const ammunitionSection = sheet.element?.querySelector('.ammunition-section');

    if (!rangedCheckbox || !isFirearmCheckbox || !firearmSection || !ammunitionSection) return;

    const updateVisibility = () => {
      const isRanged = rangedCheckbox.checked;
      const isFirearm = isFirearmCheckbox.checked;

      firearmSection.style.display = isRanged ? 'block' : 'none';
      ammunitionSection.style.display = isRanged ? 'block' : 'none';

      if (isRanged) {
        this.updateAmmunitionFields(sheet, isFirearm);
      }
    };

    rangedCheckbox.addEventListener('change', updateVisibility);
    isFirearmCheckbox.addEventListener('change', updateVisibility);

    updateVisibility();
  }

  /**
   * Update ammunition fields based on firearm status.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   * @param {boolean} isFirearm - Whether current weapon uses firearm ammo format
   */
  static updateAmmunitionFields(sheet, isFirearm) {
    const ammunitionSection = sheet.element?.querySelector('.ammunition-section');
    if (!ammunitionSection) return;

    const label = ammunitionSection.querySelector('label');
    if (!label?.parentNode) return;

    const existingContainer = ammunitionSection.querySelector('.ammunition-container, input[name="system.ammunition.current"]:not([type="hidden"])');
    if (existingContainer) {
      existingContainer.remove();
    }

    if (isFirearm) {
      const container = document.createElement('div');
      container.className = 'ammunition-container';
      container.style.cssText = 'display: flex; align-items: center; gap: 5px;';

      const currentField = document.createElement('input');
      currentField.type = 'number';
      currentField.name = 'system.ammunition.current';
      currentField.value = sheet.document.system.ammunition.current;
      currentField.min = '0';
      currentField.max = sheet.document.system.ammunition.max;
      currentField.style.width = '60px';

      const separator = document.createElement('span');
      separator.textContent = '/';

      const maxField = document.createElement('input');
      maxField.type = 'number';
      maxField.name = 'system.ammunition.max';
      maxField.value = sheet.document.system.ammunition.max;
      maxField.min = '0';
      maxField.style.width = '60px';

      container.appendChild(currentField);
      container.appendChild(separator);
      container.appendChild(maxField);
      label.parentNode.appendChild(container);
      return;
    }

    const currentField = document.createElement('input');
    currentField.type = 'number';
    currentField.name = 'system.ammunition.current';
    currentField.value = sheet.document.system.ammunition.current;
    currentField.min = '0';
    currentField.style.width = '80px';

    label.parentNode.appendChild(currentField);
  }
}
