/**
 * Profession Filter Actions Module
 * Encapsulates backpack profession-filter UI state and filtering behavior.
 */
export class ProfessionFilterActions {

  /**
   * Add profession filter state to template context.
   * @param {CardiganSystemActorSheet} sheet
   * @param {object} context
   */
  static addToContext(sheet, context) {
    context.professionFilter = sheet.professionFilter || 'all';
    context.isProfessionFilterOpen = sheet.isProfessionFilterOpen || false;
  }

  /**
   * Apply profession filter to backpack items.
   * @param {CardiganSystemActorSheet} sheet
   * @param {Item[]} items
   * @returns {Item[]}
   */
  static applyBackpackFilter(sheet, items) {
    if (sheet.professionFilter && sheet.professionFilter !== 'all') {
      return items.filter(item => item.system.profession === sheet.professionFilter);
    }

    // "All" / General Use shows every item with no restrictions
    return items;
  }

  /**
   * Bind filter panel toggle persistence listener after render.
   * @param {CardiganSystemActorSheet} sheet
   * @param {HTMLElement} element
   */
  static bindFilterToggleListener(sheet, element) {
    const filterToggle = element.querySelector('.filter-button');
    if (!filterToggle) return;

    filterToggle.checked = !!sheet.isProfessionFilterOpen;

    filterToggle.addEventListener('change', (event) => {
      sheet.isProfessionFilterOpen = !!event.target.checked;
    });
  }

  /**
   * Handle profession radio-filter action.
   * Keeps panel open while switching profession options.
   * @param {Event} event
   * @param {HTMLElement} target
   * @param {CardiganSystemActorSheet} sheet
   */
  static onFilterProfession(event, target, sheet) {
    event.preventDefault();

    sheet.professionFilter = target.value;
    sheet.isProfessionFilterOpen = true;

    sheet.render();
  }
}
