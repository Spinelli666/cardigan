/**
 * Sheet Base Behavior Module
 * Centralizes generic behavior shared by multiple item sheet types.
 */
export class SheetBaseBehavior {

  /**
   * Resolve default primary tab id for this item sheet.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   * @returns {string}
   */
  static resolveDefaultPrimaryTab(sheet) {
    const attributesFirstTypes = ['armadura', 'arma', 'item-comum', 'item-municao', 'item-ingredient'];
    return attributesFirstTypes.includes(sheet.document?.type) ? 'attributes' : 'description';
  }

  /**
   * Remove specific window-header elements for selected item sheets.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static applyHeaderCleanup(sheet) {
    if (!['armadura', 'arma', 'item-comum', 'item-municao', 'item-ingredient'].includes(sheet.item?.type)) return;

    const header = sheet.element?.querySelector('.window-header');
    if (!header) return;

    const normalize = (value) =>
      String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const phrases = [
      'copiar uuid do documento',
      'alternar controles',
      'copy document uuid',
      'toggle controls',
    ];

    const title = header.querySelector('h1.window-title');
    if (title) title.remove();

    const candidates = header.querySelectorAll('button, a, li, div, span');
    candidates.forEach((element) => {
      const values = [
        element.getAttribute('title'),
        element.getAttribute('aria-label'),
        element.getAttribute('data-tooltip'),
        element.textContent,
      ];

      const matches = values.some((value) => {
        const normalized = normalize(value);
        return phrases.some((phrase) => normalized.includes(phrase));
      });

      if (matches) element.remove();
    });

    const closePhrases = ['fechar janela', 'close window'];
    const closeControl = Array.from(header.querySelectorAll('button, a, li, div, span')).find((element) => {
      const values = [
        element.getAttribute('title'),
        element.getAttribute('aria-label'),
        element.getAttribute('data-tooltip'),
        element.textContent,
      ];

      return values.some((value) => {
        const normalized = normalize(value);
        return closePhrases.some((phrase) => normalized.includes(phrase));
      });
    });

    if (closeControl) {
      const closeNode = closeControl.closest('button, a, li, div') || closeControl;
      closeNode.style.marginLeft = 'auto';
      if (closeNode.parentElement !== header) header.appendChild(closeNode);
      return;
    }

    const controlsDropdown = header.querySelector('.controls-dropdown');
    if (controlsDropdown) controlsDropdown.style.marginLeft = 'auto';
  }
}
