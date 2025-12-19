// @ts-nocheck
// TypeScript checking disabled: Static methods access private instance fields (#folder, #types)
// which TypeScript flags as error, but works correctly because Foundry's ApplicationV2
// automatically binds the correct 'this' context when invoking action handlers.
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dialog for creating a new item with type selection organized by categories (D&D5e style)
 */
export class ItemCreateDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  
  static DEFAULT_OPTIONS = {
    id: "item-create-{id}",
    classes: ["cardigan", "dialog", "item-create"],
    tag: "dialog",
    window: {
      title: "CARDIGAN.ItemCreate.Title",
      icon: "fas fa-suitcase",
      minimizable: false,
      resizable: false
    },
    position: {
      width: 400,
      height: "auto"
    },
    actions: {
      create: ItemCreateDialog._onCreateItem,
      close: ItemCreateDialog._onClose
    }
  };

  static PARTS = {
    form: {
      template: "systems/cardigan/templates/dialogs/item-create-dialog.hbs"
    }
  };

  /**
   * Item type configuration organized by categories
   */
  static get ITEM_CATEGORIES() {
    return {
      equipment: {
        label: "CARDIGAN.ItemCreate.Categories.Equipment",
        icon: "fas fa-shield-alt",
        types: [
          { type: "arma", label: "TYPES.Item.arma", icon: "fas fa-sword" },
          { type: "armadura", label: "TYPES.Item.armadura", icon: "fas fa-shield-alt" },
          { type: "item-municao", label: "TYPES.Item.item-municao", icon: "fas fa-bullseye" }
        ]
      },
      items: {
        label: "CARDIGAN.ItemCreate.Categories.Items",
        icon: "fas fa-box",
        types: [
          { type: "item-comum", label: "TYPES.Item.item-comum", icon: "fas fa-box" },
          { type: "item-consumivel", label: "TYPES.Item.item-consumivel", icon: "fas fa-flask" },
          { type: "item-ingredient", label: "TYPES.Item.item-ingredient", icon: "fas fa-leaf" }
        ]
      },
      crafting: {
        label: "CARDIGAN.ItemCreate.Categories.Crafting",
        icon: "fas fa-hammer",
        types: [
          { type: "item-recipe", label: "TYPES.Item.item-recipe", icon: "fas fa-book" }
        ]
      },
      character: {
        label: "CARDIGAN.ItemCreate.Categories.Character",
        icon: "fas fa-user",
        types: [
          { type: "skill", label: "TYPES.Item.skill", icon: "fas fa-fist-raised" },
          { type: "spell", label: "TYPES.Item.spell", icon: "fas fa-magic" },
          { type: "feature", label: "TYPES.Item.feature", icon: "fas fa-star" },
          { type: "race", label: "TYPES.Item.race", icon: "fas fa-users" }
        ]
      },
      effects: {
        label: "CARDIGAN.ItemCreate.Categories.Effects",
        icon: "fas fa-fire",
        types: [
          { type: "efeito", label: "TYPES.Item.efeito", icon: "fas fa-fire" }
        ]
      }
    };
  }

  constructor(options = {}) {
    super(options);
    this.#folder = options.folder;
    this.#types = options.types;
  }

  /** @type {Folder} */
  #folder;

  /** @type {string[]} */
  #types;

  /* -------------------------------------------- */

  /**
   * Render the item creation dialog
   * @param {object} [options]
   * @param {Folder} [options.folder]  A folder in which to create the item
   * @param {string[]} [options.types] An array of item types to allow. If undefined, all types are allowed
   * @returns {Promise<Item|null>}
   */
  static async createDialog(options = {}) {
    return new Promise((resolve) => {
      const dialog = new this({
        ...options,
        window: {
          title: game.i18n.localize("CARDIGAN.ItemCreate.Title")
        }
      });
      dialog.addEventListener("close", () => resolve(null), { once: true });
      dialog.render({ force: true });
    });
  }

  /* -------------------------------------------- */

  async _prepareContext(_options) {
    const context = await super._prepareContext(_options);
    
    // Get all categories with their types
    const categories = [];
    for (const [key, category] of Object.entries(ItemCreateDialog.ITEM_CATEGORIES)) {
      // Filter types if specified
      let types = category.types;
      if (this.#types?.length) {
        types = types.filter(t => this.#types.includes(t.type));
      }
      
      if (types.length > 0) {
        categories.push({
          key,
          label: game.i18n.localize(category.label),
          icon: category.icon,
          types: types.map(t => ({
            ...t,
            label: game.i18n.localize(t.label)
          }))
        });
      }
    }
    
    context.categories = categories;
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Handle creating the item
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async _onCreateItem(event, target) {
    event.preventDefault();
    
    const form = target.closest("form");
    const fd = new foundry.applications.ux.FormDataExtended(form);
    const formData = fd.object;
    
    if (!formData.type) {
      ui.notifications.warn(game.i18n.localize("CARDIGAN.ItemCreate.NoTypeSelected"));
      return;
    }
    
    // Prepare item data
    const itemData = {
      name: formData.name || game.i18n.localize(`DOCUMENT.New.${formData.type}`),
      type: formData.type
    };
    
    // Add folder if specified
    // Static method accesses private field but Foundry binds context correctly at runtime
    // @ts-expect-error
    if (this.#folder) {
      // @ts-expect-error
      itemData.folder = this.#folder.id;
    }
    
    // Create the item
    const item = await Item.create(itemData);
    
    // Open the sheet
    if (item) {
      item.sheet.render(true);
    }
    
    // Close the dialog
    this.close();
  }

  /**
   * Handle closing the dialog
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async _onClose(event, target) {
    event.preventDefault();
    this.close();
  }
}