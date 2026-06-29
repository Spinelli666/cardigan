/**
 * Ingredient Sheet Behavior Module
 * Isolates item-ingredient runtime behavior from the generic item sheet.
 */
export class IngredientSheetBehavior {

  /**
   * Apply ingredient-specific render options.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   * @param {Object} options - Render options object
   * @returns {boolean} - True when ingredient-specific options were applied
   */
  static configureRenderOptions(sheet, options) {
    if (sheet.document?.type !== 'item-ingredient') return false;

    options.parts = ['header', 'tabs', 'attributesItemIngredient', 'description'];
    options.position ??= {};
    options.position.width = 400.444;
    options.position.height = 388.445;
    return true;
  }

  /**
   * Apply tab metadata for ingredient parts.
   * @param {string} partId - Render part identifier
   * @param {Object} tab - Mutable tab metadata object
   * @returns {boolean} - True when metadata was applied
   */
  static applyTabMetadata(partId, tab) {
    if (partId !== 'attributesItemIngredient') return false;

    tab.id = 'attributes';
    tab.label = 'Propriedades';
    return true;
  }

  /**
   * Apply ingredient root class on sheet element.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static applyRootClass(sheet) {
    sheet.element?.classList.toggle('item-type-ingredient', sheet.item?.type === 'item-ingredient');
  }
}
