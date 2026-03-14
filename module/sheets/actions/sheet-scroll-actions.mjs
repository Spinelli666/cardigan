/**
 * Sheet Scroll Actions Module
 * Encapsulates scroll state capture/restore across sheet re-renders.
 */
export class SheetScrollActions {

  /**
   * Capture scroll state before a re-render.
   * @param {CardiganSystemActorSheet} sheet
   */
  static captureBeforeRender(sheet) {
    const root = sheet.element;
    if (!root?.isConnected) return;

    const windowContent = root.matches('.window-content') ? root : root.querySelector('.window-content');
    const activeTab = root.querySelector('.sheet-body .tab.active, .tab.active[data-tab]');

    sheet._pendingScrollState = {
      windowContentTop: typeof windowContent?.scrollTop === 'number' ? windowContent.scrollTop : null,
      windowContentLeft: typeof windowContent?.scrollLeft === 'number' ? windowContent.scrollLeft : null,
      activeTabKey: activeTab?.dataset?.tab || null,
      activeTabTop: typeof activeTab?.scrollTop === 'number' ? activeTab.scrollTop : null,
      activeTabLeft: typeof activeTab?.scrollLeft === 'number' ? activeTab.scrollLeft : null,
    };
  }

  /**
   * Restore scroll state after a re-render.
   * @param {CardiganSystemActorSheet} sheet
   */
  static restoreAfterRender(sheet) {
    const scrollState = sheet._pendingScrollState;
    if (!scrollState) return;

    const applyScrollState = () => {
      const root = sheet.element;
      if (!root?.isConnected) return;

      const windowContent = root.matches('.window-content') ? root : root.querySelector('.window-content');
      if (windowContent) {
        if (typeof scrollState.windowContentTop === 'number') windowContent.scrollTop = scrollState.windowContentTop;
        if (typeof scrollState.windowContentLeft === 'number') windowContent.scrollLeft = scrollState.windowContentLeft;
      }

      const activeTab = scrollState.activeTabKey
        ? root.querySelector(`.tab[data-tab="${scrollState.activeTabKey}"]`)
        : root.querySelector('.sheet-body .tab.active, .tab.active[data-tab]');

      if (activeTab) {
        if (typeof scrollState.activeTabTop === 'number') activeTab.scrollTop = scrollState.activeTabTop;
        if (typeof scrollState.activeTabLeft === 'number') activeTab.scrollLeft = scrollState.activeTabLeft;
      }
    };

    // Apply immediately and one frame later to cover delayed layout changes.
    applyScrollState();
    requestAnimationFrame(applyScrollState);

    // State consumed for this render cycle.
    sheet._pendingScrollState = null;
  }
}
