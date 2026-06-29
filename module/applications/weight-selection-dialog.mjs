const { api } = foundry.applications;

/**
 * Dialog for selecting item weight when creating new items
 * @extends {ApplicationV2}
 */
export class WeightSelectionDialog extends api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  
  constructor(options = {}) {
    super(options);
    this.itemType = options.itemType; // 'weapon', 'armor', 'backpack'
    this.itemName = options.itemName;
    this.actor = options.actor;
    this.resolve = options.resolve;
    this.reject = options.reject;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "weight-selection-{id}",
    classes: ["cardigan", "dialog", "weight-selection"],
    tag: "dialog",
    window: {
      title: "CARDIGAN.SelectWeight",
      icon: "fas fa-balance-scale",
      minimizable: false,
      resizable: false
    },
    position: {
      width: 400,
      height: "auto"
    },
    actions: {
      selectWeight: this._onSelectWeight
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: "systems/cardigan/templates/dialogs/weight-selection.hbs"
    }
  };

  /** @override */
  async _prepareContext(options) {
    // Define weight options based on item type
    let weightOptions = [];
    
    if (this.itemType === 'weapon' || this.itemType === 'armor') {
      // Only light and heavy for weapons/armors
      weightOptions = [
        { value: 'leve', label: 'CARDIGAN.Light', description: 'CARDIGAN.WeightDescription.Light' },
        { value: 'pesado', label: 'CARDIGAN.Heavy', description: 'CARDIGAN.WeightDescription.Heavy' }
      ];
    } else {
      // All 5 weights for backpack items
      weightOptions = [
        { value: 'leve', label: 'CARDIGAN.WeightLight', description: 'CARDIGAN.WeightDescription.Light' },
        { value: 'medio', label: 'CARDIGAN.WeightMedium', description: 'CARDIGAN.WeightDescription.Medium' },
        { value: 'pesado', label: 'CARDIGAN.WeightHeavy', description: 'CARDIGAN.WeightDescription.Heavy' },
        { value: 'muito-pesado', label: 'CARDIGAN.WeightVeryHeavy', description: 'CARDIGAN.WeightDescription.VeryHeavy' }
      ];
    }
    
    return {
      ...await super._prepareContext(options),
      itemName: this.itemName,
      itemType: this.itemType,
      weightOptions: weightOptions,
      isBackpackItem: this.itemType === 'backpack'
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Setup click handlers for weight option buttons
    this.element.querySelectorAll('.weight-option').forEach(button => {
      button.addEventListener('click', (event) => {
        this._onSelectWeight(event, button);
      });
    });

    // Setup click handler for cancel button - manual listener
    const cancelButton = this.element.querySelector('[data-action="cancel"]');
    if (cancelButton) {
      cancelButton.addEventListener('click', (event) => {
        event.preventDefault();
        this._onCancel(event, cancelButton);
      });
    }

    // Auto-focus the dialog
    this.element.focus();
  }

  /**
   * Handle selecting a weight
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked button
   * @private
   */
  async _onSelectWeight(event, target) {
    const selectedWeight = target.dataset.weight;
    
    // For backpack items, validate if there's enough space
    if (this.itemType === 'backpack') {
      const hasSpace = await this._validateBackpackSpace(selectedWeight);
      if (!hasSpace) {
        return; // Validation failed, don't create item
      }
    }
    
    // Resolve with selected weight and close dialog
    if (this.resolve) {
      this.resolve({ weight: selectedWeight });
    }
    
    this.close();
  }

  /**
   * Validate if backpack has enough space for the item with selected weight
   * @param {string} weight - Selected weight category
   * @returns {boolean} True if there's enough space
   * @private
   */
  async _validateBackpackSpace(weight) {
    if (!this.actor) return true; // No actor means no validation needed
    
    // Calculate spaces required for this item (quantity 1)
    const requiredSpaces = this._calculateItemSpaces(weight, 1);
    
    // Get current backpack usage
    const backpackItems = this.actor.items.filter(item => 
      ['item-comum', 'item-municao', 'item-consumivel'].includes(item.type) &&
      !item.system.equipped
    );
    
    const currentSpaces = this._calculateBackpackSpaces(backpackItems);
    const maxSpaces = this.actor.system.backpack.max;
    
    // Check if there's enough space
    const totalAfterAdd = currentSpaces + requiredSpaces;
    
    if (totalAfterAdd > maxSpaces) {
      const weightName = game.i18n.localize(this._getWeightLabel(weight));
      ui.notifications.error(
        `Mochila cheia! Item ${weightName} precisa de ${requiredSpaces} espaço(s), mas só há ${maxSpaces - currentSpaces} disponível(is). (${currentSpaces}/${maxSpaces} ocupados)`
      );
      return false;
    }
    
    return true;
  }

  /**
   * Calculate spaces required for an item based on Cardigan RPG rules
   * @param {string} weight - Weight category
   * @param {number} quantity - Item quantity
   * @returns {number} Spaces required
   * @private
   */
  _calculateItemSpaces(weight, quantity) {
    switch (weight) {
      case 'leve':
        return Math.floor(quantity / 10); // 0 spaces, but +1 per 10 items
      case 'leve':
        return Math.ceil(quantity / 11); // 1 space per 11 items
      case 'medio':
        return quantity; // 1 space each
      case 'pesado':
        return quantity * 2; // 2 spaces each
      case 'muito-pesado':
        return quantity * 4; // 4 spaces each
      default:
        return 0;
    }
  }

  /**
   * Calculate total backpack spaces occupied by items
   * @param {Array} backpackItems - Items in backpack
   * @returns {number} Total spaces occupied
   * @private
   */
  _calculateBackpackSpaces(backpackItems) {
    if (!backpackItems || !Array.isArray(backpackItems)) return 0;

    let totalSpaces = 0;
    const weightGroups = { 'leve': 0 };

    // Calculate money weight separately (100 coins = 1 space)
    const moneyAmount = this.actor?.system?.money || 0;
    const moneySpaces = Math.floor(moneyAmount / 100);

    // Group items by weight for special rules
    backpackItems.forEach(item => {
      const weight = item.system?.weight;
      const quantity = item.system?.quantity || 1;

      if (weight === 'leve') {
        weightGroups['leve'] += quantity;
      } else {
        totalSpaces += this._calculateItemSpaces(weight, quantity);
      }
    });

    // Apply special rules for weight groups
    totalSpaces += this._calculateItemSpaces('leve', weightGroups['leve']);
    
    // Add money spaces (100 coins = 1 space)
    totalSpaces += moneySpaces;

    return totalSpaces;
  }

  /**
   * Get localization key for weight label
   * @param {string} weight - Weight category
   * @returns {string} Localization key
   * @private
   */
  _getWeightLabel(weight) {
    const labels = {
      'leve': 'CARDIGAN.WeightLight',
      'medio': 'CARDIGAN.WeightMedium', 
      'pesado': 'CARDIGAN.WeightHeavy',
      'muito-pesado': 'CARDIGAN.WeightVeryHeavy'
    };
    return labels[weight] || weight;
  }

  /**
   * Handle dialog cancellation
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked button
   * @private
   */
  _onCancel(event, target) {
    if (this.resolve) {
      this.resolve(null); // Resolve with null instead of rejecting
    }
    this.close();
  }

  /**
   * Static method to show the dialog and return a promise
   * @param {Object} options - Dialog options
   * @returns {Promise} Promise that resolves with selected weight
   */
  static async show(options = {}) {
    return new Promise((resolve, reject) => {
      const dialog = new WeightSelectionDialog({
        ...options,
        resolve,
        reject
      });
      dialog.render({ force: true });
    });
  }
}

export default WeightSelectionDialog;