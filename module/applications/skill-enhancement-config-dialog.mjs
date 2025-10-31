/**
 * Dialog for configuring skill enhancements with rich text description
 */
export default class SkillEnhancementConfigDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  constructor(options = {}) {
    super(options);
    this.skill = options.skill;
    this.enhancementIndex = options.enhancementIndex;
    this.enhancementData = options.enhancementData || { name: '', description: '' };
  }

  static DEFAULT_OPTIONS = {
    id: 'skill-enhancement-config',
    tag: 'dialog',
    window: {
      title: 'Configure Enhancement',
      icon: 'fas fa-magic',
      resizable: true,
    },
    position: {
      width: 600,
      height: 500,
    },
    actions: {
      cancel: SkillEnhancementConfigDialog.#onCancel,
    },
  };

  static PARTS = {
    form: {
      template: 'systems/cardigan/templates/dialogs/skill-enhancement-config.hbs',
    },
    footer: {
      template: 'templates/generic/form-footer.hbs',
    },
  };

  get title() {
    const enhancementNumber = this.enhancementIndex + 1;
    return game.i18n.format('CARDIGAN.EnhancementConfig.Title', {
      enhancement: enhancementNumber,
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Pass the document for template access
    context.document = this.skill;

    // Prepare the enhancement data
    context.enhancement = {
      description: this.enhancementData.description || '',
      hasEnergy: this.enhancementData.hasEnergy || false,
      energyCost: this.enhancementData.energyCost || 0,
    };

    // Enrich the description for display (like biography system)
    context.enrichedDescription = await foundry.applications.ux.TextEditor.enrichHTML(
      this.enhancementData.description || '',
      {
        secrets: this.skill.isOwner,
        rollData: this.skill.getRollData?.() || {},
        relativeTo: this.skill,
      }
    );

    // Footer buttons
    context.buttons = [
      {
        type: 'button',
        action: 'cancel',
        label: 'Aplicar',
        icon: 'fas fa-check',
      },
    ];

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Add event listener to toggle energy cost input visibility
    const checkbox = this.element.querySelector('input[name="hasEnergy"]');
    const energyInput = this.element.querySelector('.energy-cost-input');
    
    if (checkbox && energyInput) {
      // Set initial visibility
      energyInput.style.display = checkbox.checked ? 'block' : 'none';
      
      // Toggle on change
      checkbox.addEventListener('change', (e) => {
        energyInput.style.display = e.target.checked ? 'block' : 'none';
      });
    }
  }

  /**
   * Handle applying the changes (save and close)
   */
  static async #onCancel(event, target) {
    // Get form data from the prose-mirror editor
    const formData = new foundry.applications.ux.FormDataExtended(this.element.querySelector('form'));
    const data = formData.object;

    // Get current enhancements array
    const currentEnhancements = foundry.utils.deepClone(
      this.skill.system.enhancements || []
    );

    // Ensure we have enough slots
    while (currentEnhancements.length <= this.enhancementIndex) {
      currentEnhancements.push({ name: '', description: '', hasEnergy: false, energyCost: 0 });
    }

    // Fixed names for each enhancement
    const enhancementNames = [
      'Aprimoramento 1',
      'Aprimoramento 2', 
      'Aprimoramento 3'
    ];

    // Update the specific enhancement
    currentEnhancements[this.enhancementIndex] = {
      name: enhancementNames[this.enhancementIndex] || `Aprimoramento ${this.enhancementIndex + 1}`,
      description: data.description || '',
      hasEnergy: data.hasEnergy || false,
      energyCost: data.hasEnergy ? (parseInt(data.energyCost) || 0) : 0,
    };

    // Update the skill item
    await this.skill.update({
      'system.enhancements': currentEnhancements,
    });

    // Close the dialog after saving
    this.close();
  }
}