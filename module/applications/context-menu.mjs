/**
 * A specialized subclass of ContextMenu that places the menu in a fixed position.
 * Based on the D&D5e implementation.
 * @extends {ContextMenu}
 */
export default class ContextMenu5e extends foundry.applications.ux.ContextMenu {
  /** @override */
  _setPosition(html, target, options={}) {
    html.classList.add("cardigan-context-menu");
    return this._setFixedPosition(html, target, options);
  }

  /* -------------------------------------------- */

  /**
   * Trigger a context menu event in response to a normal click on a additional options button.
   * @param {PointerEvent} event
   */
  static triggerEvent(event) {
    try {
      event.preventDefault();
      event.stopPropagation();
      const { clientX, clientY } = event;
      const selector = "[data-item-id]";
      const target = event.target.closest(selector) ?? event.currentTarget.closest(selector);
      
      // Check if target exists and is still in the DOM
      if (target && target.isConnected && document.contains(target)) {
        target.dispatchEvent(new PointerEvent("contextmenu", {
          view: window, bubbles: true, cancelable: true, clientX, clientY
        }));
      } else {
        console.warn("Context menu target not found or disconnected from DOM");
      }
    } catch (error) {
      console.error("Error triggering context menu:", error);
    }
  }
}