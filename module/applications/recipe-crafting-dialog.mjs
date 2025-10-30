const { api } = foundry.applications;

/**
 * Dialog for selecting item type when crafting from recipes
 * @extends {ApplicationV2}
 */
export class RecipeCraftingDialog extends api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  
  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
    this.recipe = options.recipe;
    this.recipeType = options.recipeType;
    this.resolve = options.resolve;
    this.reject = options.reject;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "recipe-crafting-{id}",
    classes: ["cardigan", "dialog", "recipe-crafting"],
    tag: "dialog",
    window: {
      title: "CARDIGAN.Crafting.CraftFromRecipe",
      icon: "fas fa-hammer",
      minimizable: false,
      resizable: false
    },
    position: {
      width: 450,
      height: "auto"
    },
    actions: {
      selectItemType: RecipeCraftingDialog.prototype._onSelectItemType,
      cancel: RecipeCraftingDialog.prototype._onCancel
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: "systems/cardigan/templates/dialogs/recipe-crafting.hbs"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    // Item types available for crafting
    const itemTypes = [
      {
        type: "item-consumivel",
        name: "CARDIGAN.ItemConsumivel.Title",
        icon: "fas fa-flask",
        description: "CARDIGAN.ItemConsumivel.Subtitle"
      },
      {
        type: "item-comum",
        name: "CARDIGAN.ItemComum.Title", 
        icon: "fas fa-cube",
        description: "CARDIGAN.ItemComum.Subtitle"
      },
      {
        type: "item-municao",
        name: "CARDIGAN.ItemMunicao.Title",
        icon: "fas fa-bullseye",
        description: "CARDIGAN.ItemMunicao.Subtitle"
      },
      {
        type: "arma",
        name: "CARDIGAN.Arma.Title",
        icon: "fas fa-sword",
        description: "CARDIGAN.Arma.Subtitle"
      },
      {
        type: "armadura",
        name: "CARDIGAN.Armadura.Title",
        icon: "fas fa-shield-alt",
        description: "CARDIGAN.Armadura.Subtitle"
      }
    ];

    context.recipe = this.recipe;
    context.recipeType = this.recipeType;
    context.itemTypes = itemTypes;
    
    return context;
  }

  /**
   * Handle selecting an item type
   * @param {Event} event
   * @param {HTMLElement} target
   */
  async _onSelectItemType(event, target) {
    const itemType = target.dataset.itemType;
    if (!itemType) return;

    
    // Resolve with the selected item type
    if (this.resolve) {
      this.resolve({
        itemType: itemType,
        recipe: this.recipe,
        recipeType: this.recipeType
      });
    }
    
    this.close();
  }

  /**
   * Handle cancel action
   * @param {Event} event
   * @param {HTMLElement} target
   */
  async _onCancel(event, target) {
    if (this.reject) {
      this.reject(new Error('Dialog cancelled'));
    }
    this.close();
  }

  /**
   * Static method to show the dialog and return a promise
   * @param {Actor} actor - The actor crafting the item
   * @param {Item} recipe - The recipe being used
   * @param {string} recipeType - The type of recipe (culinary, tailoring, etc.)
   * @returns {Promise<Object>} Promise that resolves with selected item type
   */
  static async show(actor, recipe, recipeType) {
    return new Promise((resolve, reject) => {
      const dialog = new this({
        actor: actor,
        recipe: recipe,
        recipeType: recipeType,
        resolve: resolve,
        reject: reject
      });
      dialog.render(true);
    });
  }
}

export default RecipeCraftingDialog;