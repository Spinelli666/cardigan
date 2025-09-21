const { api } = foundry.applications;

/**
 * A specialized dialog for selecting general item types (comum, munição, consumível)
 * @extends {foundry.applications.api.ApplicationV2}
 */
export default class GeneralItemsSelectionDialog extends api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  
  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
    this.parentDialog = options.parentDialog;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "general-items-selection-dialog",
    classes: ["cardigan", "dialog", "general-items-selection"],
    tag: "dialog",
    window: {
      frame: true,
      positioned: true,
      title: "CARDIGAN.SelectGeneralItemType",
      icon: "fas fa-boxes",
      resizable: true
    },
    position: {
      width: 450,
      height: 320
    },
    actions: {
      selectType: this._onSelectType,
      back: this._onBack,
      cancel: this._onCancel
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: "systems/cardigan/templates/dialogs/general-items-selection.hbs",
    }
  };

  actor;
  parentDialog;

  /** @override */
  async _prepareContext(options) {
    return {
      ...await super._prepareContext(options)
    };
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers               */
  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Setup click handlers for item type buttons
    this.element.querySelectorAll('.item-type-option').forEach(button => {
      button.addEventListener('click', (event) => {
        this._onSelectType(event, button);
      });
    });

    // Auto-focus the dialog
    this.element.focus();
  }

  /**
   * Handle clicking on item type buttons
   * @param {Event} event
   */
  _onClickButton(event) {
    const button = event.target.closest(".item-type-option");
    if (!button) return;

    const type = button.dataset.type;
    const name = button.dataset.name;
    
    if (type && name) {
      this._createItem(type, name);
    }
  }

  /**
   * Create an item of the specified type
   * @param {string} type - The item type
   * @param {string} name - The item name
   */
  async _createItem(type, name) {
    console.log(`[GeneralItemsSelectionDialog] Creating ${type} item with name: ${name}`);
    
    try {
      const itemData = {
        name: name,
        type: type,
        system: {}
      };

      // Set default values based on type
      switch (type) {
        case 'item-comum':
          itemData.system = {
            quantity: 1,
            weight: 0,
            price: 0,
            category: 'equipment',
            usage: ''
          };
          break;
        case 'item-municao':
          itemData.system = {
            quantity: 20,
            weight: 0,
            price: 0,
            ammunitionType: 'arrow'
          };
          break;
        case 'item-consumivel':
          itemData.system = {
            quantity: 1,
            weight: 0,
            price: 0,
            uses: 1,
            effect: '',
            duration: ''
          };
          break;
      }

      console.log(`[GeneralItemsSelectionDialog] Item data:`, itemData);
      
      const item = await this.actor.createEmbeddedDocuments('Item', [itemData]);
      console.log(`[GeneralItemsSelectionDialog] Successfully created item:`, item);
      
      // Close this dialog
      this.close();
      
      // Also close parent dialog if it exists
      if (this.parentDialog) {
        this.parentDialog.close();
      }
      
    } catch (error) {
      console.error(`[GeneralItemsSelectionDialog] Failed to create ${type} item:`, error);
      ui.notifications.error(`Failed to create ${type} item: ${error.message}`);
    }
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  /**
   * Handle selecting an item type
   * @param {Event} event
   * @param {HTMLElement} target
   */
  async _onSelectType(event, target) {
    const type = target.dataset.type;
    const name = target.dataset.name;
    
    if (type && name) {
      await this._createItem(type, name);
    }
  }

  /**
   * Handle back button
   * @param {Event} event
   * @param {HTMLElement} target
   */
  async _onBack(event, target) {
    // Close this dialog
    this.close();
    
    // Reopen parent dialog if it exists
    if (this.parentDialog) {
      this.parentDialog.element.style.display = 'block';
      this.parentDialog.render(true);
    }
  }

  /**
   * Handle cancel button
   * @param {Event} event
   * @param {HTMLElement} target
   */
  async _onCancel(event, target) {
    this.close();
    
    // Also close parent dialog if it exists
    if (this.parentDialog) {
      this.parentDialog.close();
    }
  }
}