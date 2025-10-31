const TooltipManager = foundry.helpers.interaction.TooltipManager.implementation;

/**
 * A class responsible for orchestrating tooltips in the Cardigan system.
 */
export default class CardiganTooltips {
  /* -------------------------------------------- */
  /*  Properties & Getters                        */
  /* -------------------------------------------- */

  /**
   * The currently registered observer.
   * @type {MutationObserver}
   */
  #observer;

  /**
   * The tooltip element.
   * @type {HTMLElement}
   */
  get tooltip() {
    return this.#tooltip;
  }

  #tooltip = document.getElementById("tooltip");

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */

  /**
   * Initialize the mutation observer.
   */
  observe() {
    this.#observer?.disconnect();
    this.#observer = new MutationObserver(this._onMutation.bind(this));
    this.#observer.observe(this.tooltip, { attributeFilter: ["class"], attributeOldValue: true });
  }

  /* -------------------------------------------- */

  /**
   * Handle a mutation event.
   * @param {MutationRecord[]} mutationList  The list of changes.
   * @protected
   */
  _onMutation(mutationList) {
    let isActive = false;
    const tooltip = this.tooltip;
    for ( const { type, attributeName, oldValue } of mutationList ) {
      if ( (type === "attributes") && (attributeName === "class") ) {
        const difference = new Set(tooltip.classList).difference(new Set(oldValue?.split(" ")));
        if ( difference.has("active") ) isActive = true;
      }
    }
    if ( isActive ) this._onTooltipActivate();
  }

  /* -------------------------------------------- */

  /**
   * Handle tooltip activation.
   * @protected
   * @returns {Promise}
   */
  async _onTooltipActivate() {
    // General content links
    if ( game.tooltip.element?.classList.contains("content-link") ) {
      const doc = await fromUuid(game.tooltip.element.dataset.uuid);
      return this._onHoverContentLink(doc);
    }

    const loading = this.tooltip.querySelector(".loading");

    // Sheet-specific tooltips
    if ( loading?.dataset.uuid ) {
      const doc = await fromUuid(loading.dataset.uuid);
      return this._onHoverContentLink(doc);
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle hovering over a content link and showing rich tooltips if possible.
   * @param {Document} doc  The document linked by the content link.
   * @protected
   */
  async _onHoverContentLink(doc) {
    const { content, classes } = await (doc.richTooltip?.() ?? doc.system?.richTooltip?.() ?? {});
    if ( !content ) return;
    this.tooltip.innerHTML = content;
    this.tooltip.classList.remove("theme-dark");
    if ( classes?.length ) this.tooltip.classList.add(...classes);
    const { tooltipDirection } = game.tooltip.element.dataset;
    requestAnimationFrame(() => this._positionItemTooltip(tooltipDirection));
  }

  /* -------------------------------------------- */

  /**
   * Position a tooltip after rendering.
   * @param {string} [direction]  The direction to position the tooltip.
   * @protected
   */
  _positionItemTooltip(direction) {
    if ( !direction ) {
      direction = TooltipManager.TOOLTIP_DIRECTIONS.LEFT;
      game.tooltip._setAnchor(direction);
    }

    const pos = this.tooltip.getBoundingClientRect();
    const dirs = TooltipManager.TOOLTIP_DIRECTIONS;
    const { innerHeight, innerWidth } = this.tooltip.ownerDocument.defaultView;
    switch ( direction ) {
      case dirs.UP:
        if ( pos.y - TooltipManager.TOOLTIP_MARGIN_PX <= 0 ) direction = dirs.DOWN;
        break;
      case dirs.DOWN:
        if ( pos.y + this.tooltip.offsetHeight > innerHeight ) direction = dirs.UP;
        break;
      case dirs.LEFT:
        if ( pos.x - TooltipManager.TOOLTIP_MARGIN_PX <= 0 ) direction = dirs.RIGHT;
        break;
      case dirs.RIGHT:
        if ( pos.x + this.tooltip.offsetWidth + TooltipManager.TOOLTIP_MARGIN_PX > innerWidth ) direction = dirs.LEFT;
        break;
    }

    if ( direction !== game.tooltip.direction ) game.tooltip._setAnchor(direction);
  }
}
