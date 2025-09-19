const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dialog for selecting which type of armor to create
 * @extends {ApplicationV2}
 */
export class ArmorTypeSelectionDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(options = {}) {
    super(options);
    this.resolve = null;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "armor-type-selection-dialog",
    classes: ["cardigan", "armor-type-selection-dialog"],
    tag: "dialog",
    window: {
      title: "CARDIGAN.SelectArmorTypeTitle",
      contentClasses: ["standard-form"],
      resizable: false,
      positioned: true
    },
    position: {
      width: 450,
      height: "auto"
    },
    actions: {
      selectType: this._onSelectType,
      cancel: this._onCancel
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: "systems/cardigan/templates/dialogs/armor-type-selection.hbs"
    }
  };

  /**
   * Show the dialog and return a promise that resolves with the selected armor type
   * @returns {Promise<string|null>} The selected armor type or null if cancelled
   * @static
   */
  static async show() {
    const dialog = new this();
    return new Promise((resolve) => {
      dialog.resolve = resolve;
      dialog.render(true);
    });
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    context.armorTypes = [
      { key: "cabeca", label: game.i18n.localize("CARDIGAN.ArmorType.Cabeca"), icon: "fa-solid fa-hat-hard" },
      { key: "acessorios", label: game.i18n.localize("CARDIGAN.ArmorType.Acessorios"), icon: "fa-solid fa-gem" },
      { key: "ombreiras", label: game.i18n.localize("CARDIGAN.ArmorType.Ombreiras"), icon: "fa-solid fa-shield-halved" },
      { key: "torso", label: game.i18n.localize("CARDIGAN.ArmorType.Torso"), icon: "fa-solid fa-shirt" },
      { key: "bracos", label: game.i18n.localize("CARDIGAN.ArmorType.Bracos"), icon: "fa-solid fa-hand-fist" },
      { key: "pernas", label: game.i18n.localize("CARDIGAN.ArmorType.Pernas"), icon: "fa-solid fa-socks" },
      { key: "pes", label: game.i18n.localize("CARDIGAN.ArmorType.Pes"), icon: "fa-solid fa-shoe-prints" }
    ];
    
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Add click handlers to armor type options
    this.element.querySelectorAll('.armor-type-option').forEach(option => {
      option.addEventListener('click', (event) => {
        const armorType = option.dataset.armorType;
        this._selectType(armorType);
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
   * Handle armor type selection
   * @param {Event} event
   * @param {HTMLElement} target
   * @private
   */
  static async _onSelectType(event, target) {
    const armorType = target.dataset.armorType || target.closest('[data-armor-type]')?.dataset.armorType;
    if (armorType) {
      this._selectType(armorType);
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
   * Select an armor type and resolve the promise
   * @param {string} armorType - The selected armor type
   * @private
   */
  _selectType(armorType) {
    if (this.resolve) {
      this.resolve(armorType);
    }
    this.close();
  }
}