const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dialog for selecting which hand(s) to equip a weapon in
 * @extends {ApplicationV2}
 */
export class HandSelectionDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(weapon, options = {}) {
    super(options);
    this.weapon = weapon;
    this.resolve = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "hand-selection-dialog",
    classes: ["cardigan", "hand-selection-dialog"],
    tag: "dialog",
    window: {
      title: "CARDIGAN.SelectHandsTitle",
      contentClasses: ["standard-form"],
      resizable: false,
      positioned: true
    },
    position: {
      width: 400,
      height: "auto"
    },
    actions: {
      selectHand: this._onSelectHand,
      cancel: this._onCancel
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: "systems/cardigan/templates/dialogs/hand-selection.hbs"
    }
  };

  /**
   * Show the dialog and return a promise that resolves with the selected hand(s)
   * @param {Item} weapon - The weapon to equip
   * @returns {Promise<string|null>} The selected hand option or null if cancelled
   * @static
   */
  static async show(weapon) {
    const dialog = new this(weapon);
    return new Promise((resolve) => {
      dialog.resolve = resolve;
      dialog.render(true);
    });
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.weaponName = this.weapon.name;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Add click handlers to hand options
    this.element.querySelectorAll('.hand-option').forEach(option => {
      option.addEventListener('click', (event) => {
        const hand = option.dataset.hand;
        this._selectHand(hand);
      });
      
      // Add hover effects
      option.addEventListener('mouseenter', () => {
        option.classList.add('hovered');
      });
      option.addEventListener('mouseleave', () => {
        option.classList.remove('hovered');
      });
    });
  }

  /**
   * Handle hand selection
   * @param {Event} event
   * @param {HTMLElement} target
   * @private
   */
  static async _onSelectHand(event, target) {
    const hand = target.dataset.hand || target.closest('[data-hand]')?.dataset.hand;
    if (hand) {
      this._selectHand(hand);
    }
  }

  /**
   * Handle cancel action
   * @param {Event} event
   * @param {HTMLElement} target
   * @private
   */
  static async _onCancel(event, target) {
    if (this.resolve) {
      this.resolve(null);
    }
    this.close();
  }

  /**
   * Select a hand option and resolve the promise
   * @param {string} hand - The selected hand option ('right', 'left', or 'both')
   * @private
   */
  _selectHand(hand) {
    if (this.resolve) {
      this.resolve(hand);
    }
    this.close();
  }

  /** @override */
  async close(options = {}) {
    // If dialog is closed without selection, resolve with null
    if (this.resolve) {
      this.resolve(null);
    }
    return super.close(options);
  }
}