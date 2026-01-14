const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dialog for selecting rest type (Short Rest or Long Rest)
 * @extends {ApplicationV2}
 */
export class RestSelectionDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.resolve = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "rest-selection-dialog",
    classes: ["cardigan", "rest-selection-dialog"],
    tag: "dialog",
    window: {
      title: "CARDIGAN.Rest.SelectRestType",
      contentClasses: ["standard-form"],
      resizable: false,
      positioned: true
    },
    position: {
      width: 450,
      height: "auto"
    },
    actions: {
      selectRest: this._onSelectRest,
      cancel: this._onCancel
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: "systems/cardigan/templates/dialogs/rest-selection.hbs"
    }
  };

  /**
   * Show the dialog and return a promise that resolves with the selected rest type
   * @param {Actor} actor - The actor taking a rest
   * @returns {Promise<string|null>} The selected rest type ('short' or 'long') or null if cancelled
   * @static
   */
  static async show(actor) {
    const dialog = new this(actor);
    return new Promise((resolve) => {
      dialog.resolve = resolve;
      dialog.render(true);
    });
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.actorName = this.actor.name;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Add click handlers to rest options
    this.element.querySelectorAll('.rest-option').forEach(option => {
      option.addEventListener('click', (event) => {
        const restType = option.dataset.restType;
        this._selectRest(restType);
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
   * Handle selecting a rest type
   * @param {string} restType - The selected rest type
   * @private
   */
  _selectRest(restType) {
    if (this.resolve) {
      this.resolve(restType);
    }
    this.close();
  }

  /**
   * Handle rest selection action
   * @param {Event} event - The triggering event
   * @param {HTMLElement} target - The target element
   * @private
   */
  static async _onSelectRest(event, target) {
    const restType = target.dataset.restType;
    this._selectRest(restType);
  }

  /**
   * Handle cancel action
   * @param {Event} event - The triggering event
   * @param {HTMLElement} target - The target element
   * @private
   */
  static async _onCancel(event, target) {
    if (this.resolve) {
      this.resolve(null);
    }
    this.close();
  }
}
