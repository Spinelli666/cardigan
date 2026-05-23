/**
 * Armor Sheet Behavior Module
 * Isolates armor-specific runtime behavior from the generic item sheet.
 */
export class ArmorSheetBehavior {

  /**
   * Apply armor-specific tab metadata when needed.
   * @param {string} partId - Render part identifier
   * @param {Object} tab - Mutable tab metadata object
   * @returns {boolean} - True when metadata was applied
   */
  static applyTabMetadata(partId, tab) {
    if (partId !== 'attributesArmadura') return false;

    tab.id = 'attributes';
    tab.label += 'Properties';
    return true;
  }

  /**
   * Apply armor-specific render options.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   * @param {Object} options - Render options object
   * @returns {boolean} - True when armor-specific options were applied
   */
  static configureRenderOptions(sheet, options) {
    if (sheet.document?.type !== 'armadura') return false;

    options.parts = ['header', 'tabs', 'attributesArmadura', 'description'];
    options.position = {
      ...options.position,
      width: 400.444,
      height: 520.333,
    };

    return true;
  }

  /**
   * Handle durability field changes for armor items.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   * @param {Event} event - Form change event
   * @returns {Promise<boolean>} - True when the event was fully handled
   */
  static async handleDurabilityChange(sheet, event) {
    const target = event?.target;
    const name = target?.name;

    if (sheet.item?.type !== 'armadura') return false;
    if (name !== 'system.durability.current' && name !== 'system.durability.max') return false;

    const currentInput = sheet.element?.querySelector('input[name="system.durability.current"]');
    const maxInput = sheet.element?.querySelector('input[name="system.durability.max"]');
    if (!currentInput || !maxInput) return true;

    const existingCurrent = Number(sheet.item.system?.durability?.current ?? 0);
    const existingMax = Math.max(1, Number(sheet.item.system?.durability?.max ?? 1));

    const rawCurrent = String(currentInput.value ?? '').trim();
    const rawMax = String(maxInput.value ?? '').trim();

    if (rawCurrent === '' || rawMax === '') return true;

    let nextCurrent = Number(rawCurrent);
    let nextMax = Number(rawMax);

    if (!Number.isFinite(nextCurrent)) nextCurrent = existingCurrent;
    if (!Number.isFinite(nextMax)) nextMax = existingMax;

    nextCurrent = Math.max(0, Math.floor(nextCurrent));
    nextMax = Math.max(1, Math.floor(nextMax));

    const editingCurrent = name === 'system.durability.current';
    if (editingCurrent && nextCurrent > nextMax) {
      ui.notifications.warn('Não é possível definir a durabilidade atual acima da durabilidade máxima.');
    }

    if (nextCurrent > nextMax) nextCurrent = nextMax;

    currentInput.value = String(nextCurrent);
    currentInput.max = String(nextMax);
    maxInput.value = String(nextMax);

    const changed = nextCurrent !== existingCurrent || nextMax !== existingMax;
    if (changed) {
      await sheet.item.update({
        'system.durability.current': nextCurrent,
        'system.durability.max': nextMax,
      });
    }

    return true;
  }

}
