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
    this.selectedIndex = null;
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
      width: 380,
      height: "auto"
    },
    actions: {
      craft: RecipeCraftingDialog.prototype._onCraft,
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
    
    // Check if recipe has result items defined
    const resultItems = this.recipe.system.resultItems || [];
    
    if (resultItems.length > 0) {
      // Use new result items system
      context.hasResultItems = true;
      context.resultItems = resultItems;
    } else {
      // Fallback to old item type selection system
      context.hasResultItems = false;
      
      // Item types available for crafting (old system)
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
      
      context.itemTypes = itemTypes;
    }

    context.recipe = this.recipe;
    context.recipeType = this.recipeType;
    
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Add click handlers to item cards for selection
    const cards = this.element.querySelectorAll('.result-item-card');
    cards.forEach(card => {
      card.addEventListener('click', (event) => {
        // Remove selection from all cards
        cards.forEach(c => c.classList.remove('selected'));
        // Add selection to clicked card
        card.classList.add('selected');
        // Store selected index
        this.selectedIndex = parseInt(card.dataset.itemIndex);
        // Enable craft button
        const craftButton = this.element.querySelector('button[data-action="craft"]');
        if (craftButton) craftButton.disabled = false;
      });
    });
  }

  /**
   * Handle craft button click
   * @param {Event} event
   * @param {HTMLElement} target
   */
  async _onCraft(event, target) {
    if (this.selectedIndex === null) return;

    const resultItems = this.recipe.system.resultItems || [];
    if (this.selectedIndex >= 0 && this.selectedIndex < resultItems.length) {
      const selectedResult = resultItems[this.selectedIndex];
      
      console.log("[RECIPE-DIALOG] Crafting item:", selectedResult);
      
      if (this.resolve) {
        this.resolve({
          resultItem: selectedResult,
          resultIndex: this.selectedIndex,
          recipe: this.recipe,
          recipeType: this.recipeType
        });
      }
      
      this.close();
    }
  }

  /**
   * Handle selecting an item type (old system)
   * @param {Event} event
   * @param {HTMLElement} target
   */
  async _onSelectItemType(event, target) {
    const itemType = target.dataset.itemType;
    const resultIndex = target.dataset.resultIndex;
    
    // New system: selecting a specific result item
    if (resultIndex !== undefined) {
      const index = parseInt(resultIndex);
      const resultItems = this.recipe.system.resultItems || [];
      
      if (index >= 0 && index < resultItems.length) {
        const selectedResult = resultItems[index];
        
        console.log("[RECIPE-DIALOG] Selected result item:", selectedResult);
        
        if (this.resolve) {
          this.resolve({
            resultItem: selectedResult,
            resultIndex: index,
            recipe: this.recipe,
            recipeType: this.recipeType
          });
        }
        
        this.close();
        return;
      }
    }
    
    // Old system: selecting item type
    if (itemType) {
      console.log("[RECIPE-DIALOG] Selected item type:", itemType);
      
      if (this.resolve) {
        this.resolve({
          itemType: itemType,
          recipe: this.recipe,
          recipeType: this.recipeType
        });
      }
      
      this.close();
    }
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