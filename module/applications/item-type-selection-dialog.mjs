const { api } = foundry.applications;

/**
 * Dialog for selecting item type when creating new items
 * @extends {ApplicationV2}
 */
export class ItemTypeSelectionDialog extends api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  
  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
    this.resolve = options.resolve;
    this.reject = options.reject;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "item-type-selection-{id}",
    classes: ["cardigan", "dialog", "item-type-selection"],
    tag: "dialog",
    window: {
      title: "CARDIGAN.SelectItemType",
      icon: "fas fa-plus-circle",
      minimizable: false,
      resizable: false
    },
    position: {
      width: 500,
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
      template: "systems/cardigan/templates/dialogs/item-type-selection.hbs"
    }
  };

  /** @override */
  async _prepareContext(options) {
    return {
      ...await super._prepareContext(options)
    };
  }

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
   * Handle selecting an item type
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked button
   * @private
   */
  async _onSelectType(event, target) {
    const itemType = target.dataset.type;
    const itemName = target.dataset.name;
    
    try {
      // Special handling for armor - need to select armor type first
      if (itemType === "armadura") {
        // Import and show armor type selection dialog
        const { ArmorTypeSelectionDialog } = await import('./armor-type-selection-dialog.mjs');
        const selectedArmorType = await ArmorTypeSelectionDialog.show();
        
        if (selectedArmorType === null) {
          // User cancelled armor type selection
          return;
        }
        
        // Create armor with selected type
        const itemClass = getDocumentClass("Item");
        const createData = { 
          name: itemName, 
          type: itemType,
          system: {
            armorType: selectedArmorType
          }
        };
        
        // Debug logging
        console.log('[ARMOR CREATION] Item class:', itemClass);
        console.log('[ARMOR CREATION] Create data:', createData);
        console.log('[ARMOR CREATION] Available item types:', Object.keys(CONFIG.Item.dataModels || {}));
        console.log('[ARMOR CREATION] System template types:', game.system?.template?.Item?.types);
        
        const document = await itemClass.create(createData, {
          parent: this.actor,
        });
        
        // Check if document was created successfully
        if (document) {
          // Open the item sheet
          document.sheet.render(true);
          
          // Resolve the promise and close the dialog
          if (this.resolve) {
            this.resolve({ document, type: itemType });
          }
        } else {
          console.error('Failed to create armor document');
          ui.notifications.error('Failed to create armor item');
        }
        
        this.close();
        return;
      }
      
      // Regular item creation for non-armor types
      const itemClass = getDocumentClass("Item");
      const createData = { 
        name: itemName, 
        type: itemType 
      };
      
      const document = await itemClass.create(createData, {
        parent: this.actor,
      });
      
      // Open the item sheet
      document.sheet.render(true);
      
      // Resolve the promise and close the dialog
      if (this.resolve) {
        this.resolve({ document, type: itemType });
      }
      
      this.close();
    } catch (error) {
      console.error("Error creating item:", error);
      ui.notifications.error("Failed to create item");
      
      if (this.reject) {
        this.reject(error);
      }
    }
  }

  /**
   * Handle canceling the dialog
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked button
   * @private
   */
  _onCancel(event, target) {
    if (this.reject) {
      this.reject(new Error("Cancelled by user"));
    }
    this.close();
  }

  /** @override */
  close(options = {}) {
    // Clean up any remaining event listeners
    if (this.element) {
      this.element.querySelectorAll('.item-type-option').forEach(button => {
        button.removeEventListener('click', this._onSelectType);
      });
    }
    
    return super.close(options);
  }

  /**
   * Static method to show the dialog and return a promise
   * @param {Actor} actor - The actor to create the item for
   * @returns {Promise<{document: Item, type: string}>}
   */
  static async show(actor) {
    return new Promise((resolve, reject) => {
      const dialog = new ItemTypeSelectionDialog({
        actor,
        resolve,
        reject
      });
      dialog.render(true);
    });
  }
}