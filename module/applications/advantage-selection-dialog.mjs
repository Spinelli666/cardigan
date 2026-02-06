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
      width: 600,
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
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Add mutual exclusivity to checkboxes
    const conjuntoCheckbox = this.element.querySelector('#attack-conjunto');
    const individualCheckbox = this.element.querySelector('#attack-individual');

    if (conjuntoCheckbox && individualCheckbox) {
      conjuntoCheckbox.addEventListener('change', () => {
        if (conjuntoCheckbox.checked) {
          individualCheckbox.checked = false;
        } else if (!individualCheckbox.checked) {
          individualCheckbox.checked = true;
        }
      });

      individualCheckbox.addEventListener('change', () => {
        if (individualCheckbox.checked) {
          conjuntoCheckbox.checked = false;
        } else if (!conjuntoCheckbox.checked) {
          conjuntoCheckbox.checked = true;
        }
      });
    }

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
    
    // Get attack mode
    const attackMode = this.element.querySelector('input[name="attackType"]:checked')?.value || 'individual';
    
    if (this.resolve) {
      this.resolve({ rollType, attackMode });
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