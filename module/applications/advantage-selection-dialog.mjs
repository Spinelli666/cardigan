const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dialog for selecting advantage/disadvantage type for attack rolls
 * @extends {ApplicationV2}
 */
export class AdvantageSelectionDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.resolve = null;
    this.hideAttackMode = options.hideAttackMode || false;
    this.hideHandSelection = options.hideHandSelection || false;
    this.hideJointRoll = options.hideJointRoll || false;
    this.hideAttackModeBorder = options.hideAttackModeBorder || false;
  }

  static DEFAULT_OPTIONS = {
    id: "advantage-selection-dialog",
    classes: ["cardigan", "dialog", "advantage-selection-dialog"],
    tag: "dialog",
    window: {
      title: "Tipo de Teste",
      contentClasses: ["standard-form"],
      minimizable: false,
      resizable: false,
      positioned: true
    },
    position: {
      width: 455,
      height: "auto"
    },
    actions: {
      rollTest: this._onRollTest
    }
  };

  static PARTS = {
    form: {
      template: "systems/cardigan/templates/dialogs/advantage-selection.hbs"
    }
  };

  /**
   * Show the advantage selection dialog
   * @param {Object} options - Dialog options
   * @returns {Promise<Object>} Object with rollType and attackMode properties
   */
  static async show(options = {}) {
    const dialog = new this(options);
    return new Promise((resolve) => {
      dialog.resolve = resolve;
      dialog.render(true);
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.hideAttackMode = this.hideAttackMode;
    context.hideHandSelection = this.hideHandSelection;
    context.hideJointRoll = this.hideJointRoll;
    context.hideAttackModeBorder = this.hideAttackModeBorder;
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Allow deselecting radio buttons by clicking again
    const radioButtons = this.element.querySelectorAll('input[name="rollModifier"]');
    let lastSelected = null;

    radioButtons.forEach(radio => {
      radio.addEventListener('click', (event) => {
        if (lastSelected === radio) {
          radio.checked = false;
          lastSelected = null;
        } else {
          lastSelected = radio;
        }
      });
    });
  }

  /**
   * Handle roll test button click
   * @param {Event} event
   * @param {HTMLElement} target
   * @private
   */
  static async _onRollTest(event, target) {
    // Get selected roll modifier (if any)
    const selectedModifier = this.element.querySelector('input[name="rollModifier"]:checked');
    const rollType = selectedModifier ? selectedModifier.value : 'normal';
    
    // Get attack mode: 'conjunto' if checked, 'individual' if not
    const conjuntoCheckbox = this.element.querySelector('#attack-conjunto');
    const attackMode = conjuntoCheckbox?.checked ? 'conjunto' : 'individual';
    
    // Get manual modifier
    const manualModifierInput = this.element.querySelector('#manual-modifier');
    const manualModifier = parseInt(manualModifierInput?.value || 0);
    
    // Get hand selection checkboxes (correct IDs from template)
    const primaryHandCheckbox = this.element.querySelector('#attack-hand-primary');
    const secondaryHandCheckbox = this.element.querySelector('#attack-hand-secondary');
    const primaryHand = primaryHandCheckbox?.checked || false;
    const secondaryHand = secondaryHandCheckbox?.checked || false;
    
    if (this.resolve) {
      this.resolve({ rollType, attackMode, manualModifier, primaryHand, secondaryHand });
    }
    this.close();
  }

  async close(options = {}) {
    // If closing without selection (via X button), resolve with null
    if (this.resolve) {
      this.resolve(null);
    }
    return super.close(options);
  }
}