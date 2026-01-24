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
    if (!this.#tooltip) {
      this.#tooltip = document.getElementById("tooltip");
    }
    return this.#tooltip;
  }

  #tooltip;

  /* -------------------------------------------- */
  /*  Custom Tooltip Methods (data-cardigan-tooltip) */
  /* -------------------------------------------- */

  /**
   * Activate listeners for custom cardigan tooltips.
   */
  activateCustomTooltips() {
    document.addEventListener('mouseover', this._onMouseOverCustomTooltip.bind(this));
    document.addEventListener('mouseout', this._onMouseOutCustomTooltip.bind(this));
  }

  /**
   * Handle mouse over event for elements with data-cardigan-tooltip attribute.
   * @param {MouseEvent} event
   * @private
   */
  _onMouseOverCustomTooltip(event) {
    const element = event.target.closest('[data-cardigan-tooltip]');
    if (!element) return;

    const text = element.dataset.cardiganTooltip;
    if (!text) return;

    // Usar o sistema nativo de tooltip do Foundry que anexa ao body
    game.tooltip.activate(element, {
      text: text,
      direction: 'DOWN',
      cssClass: 'cardigan-custom-tooltip'
    });
  }

  /**
   * Handle mouse out event for custom tooltips.
   * @param {MouseEvent} event
   * @private
   */
  _onMouseOutCustomTooltip(event) {
    const element = event.target.closest('[data-cardigan-tooltip]');
    if (!element) return;

    game.tooltip.deactivate();
  }

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */

  /**
   * Initialize the mutation observer.
   */
  observe() {
    if (!this.tooltip) {
      console.warn('[CARDIGAN] Tooltip element not found, skipping observer initialization');
      return;
    }
    this.#observer?.disconnect();
    this.#observer = new MutationObserver(this._onMutation.bind(this));
    this.#observer.observe(this.tooltip, { attributeFilter: ["class"], attributeOldValue: true });
    
    // Ativar tooltips customizados
    this.activateCustomTooltips();
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
    if (!tooltip) return;
    
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
    this.tooltip.classList.add("cardigan-tooltip");
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
    if (!this.tooltip) return;
    
    // Always use DOWN direction (tooltip below element)
    const dirs = TooltipManager.TOOLTIP_DIRECTIONS;
    direction = dirs.DOWN;
    
    const pos = this.tooltip.getBoundingClientRect();
    const { innerHeight } = this.tooltip.ownerDocument.defaultView;
    
    // Only switch to UP if there's not enough space below
    if ( pos.y + this.tooltip.offsetHeight > innerHeight ) {
      direction = dirs.UP;
    }

    if ( direction !== game.tooltip.direction ) game.tooltip._setAnchor(direction);
  }
}
