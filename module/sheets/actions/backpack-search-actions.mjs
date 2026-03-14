/**
 * Backpack Search Actions Module
 * Encapsulates backpack search UI state, listeners and live filtering behavior.
 */
export class BackpackSearchActions {

  /**
   * Normalize text for case/diacritic-insensitive search.
   * @param {string} text
   * @returns {string}
   */
  static normalizeSearchText(text) {
    return (text || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  /**
   * Add backpack search state to template context.
   * @param {CardiganSystemActorSheet} sheet
   * @param {object} context
   */
  static addToContext(sheet, context) {
    context.isBackpackSearchOpen = sheet.isBackpackSearchOpen || false;
    context.backpackSearch = sheet.backpackSearch || '';
  }

  /**
   * Bind backpack search toggle and field listeners after render.
   * @param {CardiganSystemActorSheet} sheet
   * @param {HTMLElement} element
   */
  static bindSearchListeners(sheet, element) {
    const searchToggle = element.querySelector('.search-button');
    const searchField = element.querySelector('.backpack-search-field');

    if (searchToggle) {
      searchToggle.checked = !!sheet.isBackpackSearchOpen;

      searchToggle.addEventListener('change', (event) => {
        sheet.isBackpackSearchOpen = !!event.target.checked;

        if (!sheet.isBackpackSearchOpen) {
          sheet.backpackSearch = '';
          if (searchField) searchField.value = '';
        }

        BackpackSearchActions.applySearchFilter(sheet, element);

        if (sheet.isBackpackSearchOpen && searchField) {
          searchField.focus();
          searchField.select();
        }
      });
    }

    if (searchField) {
      searchField.value = sheet.backpackSearch || '';

      searchField.addEventListener('input', (event) => {
        sheet.backpackSearch = event.target.value || '';
        BackpackSearchActions.applySearchFilter(sheet, element);
      });

      searchField.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          sheet.backpackSearch = '';
          searchField.value = '';

          if (searchToggle) {
            searchToggle.checked = false;
            sheet.isBackpackSearchOpen = false;
          }

          BackpackSearchActions.applySearchFilter(sheet, element);
        }
      });
    }
  }

  /**
   * Apply live search filtering to backpack rows without re-rendering the sheet.
   * @param {CardiganSystemActorSheet} sheet
   * @param {HTMLElement} element
   */
  static applySearchFilter(sheet, element) {
    const searchTerm = BackpackSearchActions.normalizeSearchText(sheet.backpackSearch);
    const backpackRows = element.querySelectorAll('.backpack-table li.item[data-item-id]');

    backpackRows.forEach((row) => {
      const itemNameNode = row.querySelector('.item-name div, .item-name');
      const itemName = BackpackSearchActions.normalizeSearchText(itemNameNode?.textContent);
      const shouldHide = !!searchTerm && !itemName.includes(searchTerm);

      // Ensure old inline-style based filtering never conflicts with class-based filtering.
      row.style.removeProperty('display');
      row.classList.toggle('is-search-hidden', shouldHide);
    });
  }
}
