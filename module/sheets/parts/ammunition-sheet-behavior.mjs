/**
 * Ammunition Sheet Behavior Module
 * Isolates item-municao runtime behavior from the generic item sheet.
 */
export class AmmunitionSheetBehavior {

  /**
   * Apply ammunition-specific render options.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   * @param {Object} options - Render options object
   * @returns {boolean} - True when ammunition-specific options were applied
   */
  static configureRenderOptions(sheet, options) {
    if (sheet.document?.type !== 'item-municao') return false;

    options.parts = ['header', 'tabs', 'attributesItemMunicao', 'description'];
    options.position ??= {};
    options.position.height = 415.222;

    return true;
  }

  /**
   * Apply tab metadata for ammunition parts.
   * @param {string} partId - Render part identifier
   * @param {Object} tab - Mutable tab metadata object
   * @returns {boolean} - True when metadata was applied
   */
  static applyTabMetadata(partId, tab) {
    if (partId !== 'attributesItemMunicao') return false;

    tab.id = 'attributes';
    tab.label = 'Propriedades';
    return true;
  }

  /**
   * Apply ammunition root class on sheet element.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static applyRootClass(sheet) {
    sheet.element?.classList.toggle('item-type-municao', sheet.item?.type === 'item-municao');
  }
}
