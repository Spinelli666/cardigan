/**
 * Simple dialog for creating items - following D&D5e pattern
 * This replaces the default Foundry item creation dialog
 */
export class CreateItemDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  
  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["cardigan", "create-item-dialog"],
    tag: "dialog",
    window: {
      title: "Criar Novo Item",
      minimizable: false,
      resizable: false
    },
    position: {
      width: 400,
      height: "auto"
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: "systems/cardigan/templates/dialogs/create-item-dialog.hbs"
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.types = [
      { type: 'arma', label: 'Arma', icon: 'fa-sword' },
      { type: 'armadura', label: 'Armadura', icon: 'fa-shield' },
      { type: 'comum', label: 'Item Comum', icon: 'fa-box' }
    ];
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Setup click handlers
    this.element.querySelectorAll('[data-item-type]').forEach(button => {
      button.addEventListener('click', async (event) => {
        const type = event.currentTarget.dataset.itemType;
        await this._createItem(type);
      });
    });
  }

  /**
   * Create the item and close dialog
   */
  async _createItem(type) {
    const itemData = {
      name: `Novo ${type}`,
      type: type
    };

    const created = await Item.implementation.create(itemData, {
      parent: this.actor,
      renderSheet: true
    });

    if (created) {
      this.close();
    }
  }

  /**
   * Show the dialog
   */
  static async show(actor) {
    const dialog = new this({ actor });
    dialog.render({ force: true });
    return dialog;
  }
}
