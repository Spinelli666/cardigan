const { api } = foundry.applications;
import GeneralItemsSelectionDialog from './general-items-selection-dialog.mjs';
import WeightSelectionDialog from './weight-selection-dialog.mjs';

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
      openGeneralItems: this._onOpenGeneralItems,
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
      if (button.classList.contains('general-items-button')) {
        // Special handler for general items button
        button.addEventListener('click', (event) => {
          this._onOpenGeneralItems(event, button);
        });
      } else {
        // Regular item type button
        button.addEventListener('click', (event) => {
          this._onSelectType(event, button);
        });
      }
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
      // Special handling for armor - need to select armor type first, then weight
      if (itemType === "armadura") {
        // Import and show armor type selection dialog
        const { ArmorTypeSelectionDialog } = await import('./armor-type-selection-dialog.mjs');
        const selectedArmorType = await ArmorTypeSelectionDialog.show();
        
        if (selectedArmorType === null) {
          // User cancelled armor type selection
          return;
        }
        
        // Show weight selection dialog for armor
        const weightResult = await WeightSelectionDialog.show({
          itemType: 'armor',
          itemName: itemName,
          actor: this.actor
        });
        
        if (!weightResult) {
          // User cancelled weight selection
          return;
        }
        
        // Create armor with selected type and weight
        const itemClass = getDocumentClass("Item");
        const createData = { 
          name: itemName, 
          type: itemType,
          system: {
            armorType: selectedArmorType,
            weight: weightResult.weight
          }
        };
        
        console.log('[ARMOR CREATION] Create data:', createData);
        
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
      
      // Special handling for weapons - need weight selection
      if (itemType === "arma") {
        // Show weight selection dialog for weapon
        const weightResult = await WeightSelectionDialog.show({
          itemType: 'weapon',
          itemName: itemName,
          actor: this.actor
        });
        
        if (!weightResult) {
          // User cancelled weight selection
          return;
        }
        
        // Create weapon with selected weight
        const itemClass = getDocumentClass("Item");
        const createData = { 
          name: itemName, 
          type: itemType,
          system: {
            weight: weightResult.weight
          }
        };
        
        console.log('[WEAPON CREATION] Create data:', createData);
        
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
          console.error('Failed to create weapon document');
          ui.notifications.error('Failed to create weapon item');
        }

        this.close();
        return;
      }
      
      // Regular item creation for non-armor/weapon types
      const itemClass = getDocumentClass("Item");
      const createData = { 
        name: itemName, 
        type: itemType 
      };
      
      // Debug logging for backpack creation
      if (itemType === 'backpack') {
        console.log('[BACKPACK CREATION] Item class:', itemClass);
        console.log('[BACKPACK CREATION] Create data:', createData);
        console.log('[BACKPACK CREATION] Available item types:', Object.keys(CONFIG.Item.dataModels || {}));
        console.log('[BACKPACK CREATION] Item class TYPES:', itemClass.TYPES);
        console.log('[BACKPACK CREATION] System document types:', game.system?.documentTypes?.Item);
      }
      
      const document = await itemClass.create(createData, {
        parent: this.actor,
      });
      
      // Check if document was created successfully
      if (!document) {
        console.error('Failed to create document for type:', itemType);
        ui.notifications.error(`Failed to create ${itemType} item`);
        return;
      }
      
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
   * Handle opening the general items dialog
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked button
   * @private
   */
  async _onOpenGeneralItems(event, target) {
    try {
      // Hide this dialog (don't close it completely)
      this.element.style.display = 'none';
      
      // Create and show the general items dialog
      const generalDialog = new GeneralItemsSelectionDialog({
        actor: this.actor,
        parentDialog: this
      });
      
      await generalDialog.render(true);
      
    } catch (error) {
      console.error("Error opening general items dialog:", error);
      ui.notifications.error("Failed to open general items dialog");
      
      // Restore this dialog if there was an error
      this.element.style.display = 'block';
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