const { api } = foundry.applications;

/**
 * A dialog for selecting effects from the compendium
 * @extends {foundry.applications.api.ApplicationV2}
 */
export default class EffectsCompendiumSelectionDialog extends api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  
  constructor(options = {}) {
    super(options);
    this.actor = options.actor;
    this.onEffectsAdded = options.onEffectsAdded;
    this.createOnActor = options.createOnActor !== false;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "effects-compendium-selection-dialog",
    classes: ["cardigan", "dialog", "effects-selection"],
    tag: "dialog",
    window: {
      title: "Selecionar Efeitos",
      resizable: true,
      minimizable: false
    },
    position: {
      width: 940,
      height: 580
    },
    actions: {
      addEffects: this._onAddEffects,
      cancel: this._onCancel
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: "systems/cardigan/templates/dialogs/effects-selection.hbs",
    }
  };

  actor;
  onEffectsAdded;
  createOnActor;

  /** @override */
  async _prepareContext(options) {
    const effects = await this._getEffectsFromCompendium();
    
    return {
      ...await super._prepareContext(options),
      effects: effects
    };
  }

  /**
   * Get all effects from the compendium
   * @returns {Promise<Array>}
   * @private
   */
  async _getEffectsFromCompendium() {
    const pack = game.packs.get('cardigan.efeitos-cardigan');
    const mappedEffects = [];

    // 1) Effects from system compendium
    if (!pack) {
      console.warn('[CARDIGAN] Compendium "efeitos-cardigan" not found');
    } else {
      const compendiumDocs = await pack.getDocuments();
      mappedEffects.push(...compendiumDocs.filter(doc => doc.type === 'efeito').map(doc => ({
        id: doc.id,
        uuid: doc.uuid,
        name: doc.name,
        img: doc.img,
        system: {
          efeitoType: doc.system?.efeitoType,
          description: doc.system?.description
        }
      })));
    }

    // 2) Effects created in world (Create Entry)
    const worldEffects = (game.items ?? [])
      .filter(item => item.type === 'efeito')
      .map(item => ({
        id: item.id,
        uuid: item.uuid,
        name: item.name,
        img: item.img,
        system: {
          efeitoType: item.system?.efeitoType,
          description: item.system?.description
        }
      }));

    mappedEffects.push(...worldEffects);

    // Keep unique entries by UUID to avoid duplicates.
    const seen = new Set();
    const uniqueEffects = mappedEffects.filter(effect => {
      if (!effect?.uuid || seen.has(effect.uuid)) return false;
      seen.add(effect.uuid);
      return true;
    });

    // Sort effects: positivos first, then others, then alphabetically.
    return uniqueEffects.sort((a, b) => {
      const typeA = a.system?.efeitoType || '';
      const typeB = b.system?.efeitoType || '';

      if (typeA === 'positivo' && typeB !== 'positivo') return -1;
      if (typeA !== 'positivo' && typeB === 'positivo') return 1;

      return (a.name || '').localeCompare(b.name || '', 'pt-BR');
    });
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers               */
  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Add search functionality
    const searchInput = this.element.querySelector('.effect-search-input');
    const clearButton = this.element.querySelector('.clear-search-button');
    const effectItems = this.element.querySelectorAll('.effect-item');
    
    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        const searchTerm = event.target.value.toLowerCase().trim();
        
        effectItems.forEach(item => {
          const effectName = item.querySelector('.effect-name')?.textContent.toLowerCase() || '';
          const effectType = item.querySelector('.effect-type')?.textContent.toLowerCase() || '';
          
          const matches = effectName.includes(searchTerm) || effectType.includes(searchTerm);
          item.style.display = matches ? '' : 'none';
        });
        
        // Show/hide clear button
        if (clearButton) {
          clearButton.style.display = searchTerm ? 'flex' : 'none';
        }
      });
    }
    
    if (clearButton) {
      clearButton.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input'));
          searchInput.focus();
        }
      });
    }
    
    // Add click handler for effect items to toggle selection
    this.element.querySelectorAll('.effect-item').forEach(item => {
      item.addEventListener('click', (event) => {
        // Don't toggle if clicking on rounds counter or its children
        if (event.target.closest('.rounds-counter')) return;
        
        // Toggle selected state
        item.classList.toggle('selected');
      });
    });

    // Add click handler for rounds buttons
    this.element.querySelectorAll('.rounds-button').forEach(button => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        const item = event.target.closest('.effect-item');
        if (!item) return;
        
        // Get current rounds value
        let currentRounds = item.dataset.rounds || '0';
        
        // Cycle through: 0 → 1 → 2 → 3 → 4 → 5 → ∞ → 0
        let nextRounds;
        if (currentRounds === '0') nextRounds = '1';
        else if (currentRounds === '1') nextRounds = '2';
        else if (currentRounds === '2') nextRounds = '3';
        else if (currentRounds === '3') nextRounds = '4';
        else if (currentRounds === '4') nextRounds = '5';
        else if (currentRounds === '5') nextRounds = '∞';
        else if (currentRounds === '∞') nextRounds = '0';
        else nextRounds = '0';
        
        // Update dataset and button
        item.dataset.rounds = nextRounds;
        if (nextRounds === '∞') {
          button.innerHTML = '<img src="systems/cardigan/assets/images/decorative/icons/icon-infinite.svg" alt="Infinito" class="icon-infinite" width="10" height="10">';
        } else {
          button.textContent = nextRounds;
        }
      });
    });
  }

  /**
   * Handle adding selected effects
   * @param {Event} event
   * @param {HTMLElement} target
   * @private
   */
  static async _onAddEffects(event, target) {
    event.preventDefault();
    
    const selectedItems = this.element.querySelectorAll('.effect-item.selected');
    const selectedUUIDs = Array.from(selectedItems).map(item => item.dataset.effectUuid);
    
    if (selectedUUIDs.length === 0) {
      ui.notifications.warn('Nenhum efeito selecionado');
      return;
    }

    const selectedEffects = Array.from(selectedItems).map((effectItem) => {
      const rounds = effectItem.dataset.rounds || '0';
      return {
        uuid: effectItem.dataset.effectUuid,
        name: effectItem.querySelector('.effect-name')?.textContent?.trim() ?? '',
        img: effectItem.querySelector('.effect-icon')?.getAttribute('src') ?? '',
        rounds,
        roundsValue: rounds === '∞' ? 'infinito' : rounds,
      };
    }).filter(effect => !!effect.uuid);

    if (typeof this.onEffectsAdded === 'function') {
      await this.onEffectsAdded(selectedEffects);
    }

    if (this.createOnActor) {
      if (!this.actor || this.actor.documentName !== 'Actor') {
        ui.notifications.warn('Ator inválido para adicionar efeitos.');
        this.close();
        return;
      }

      // Create items from selected effects
      const itemsToCreate = [];
      for (const effect of selectedEffects) {
        const doc = await fromUuid(effect.uuid);
        if (!doc) continue;

        const itemData = doc.toObject();
        if (!itemData.system) itemData.system = {};
        itemData.system.rodadas = effect.roundsValue;
        itemsToCreate.push(itemData);
      }

      if (itemsToCreate.length > 0) {
        await this.actor.createEmbeddedDocuments('Item', itemsToCreate);
        ui.notifications.info(`${itemsToCreate.length} efeito(s) adicionado(s)`);
      }
    }

    this.close();
  }

  /**
   * Handle cancel button
   * @param {Event} event
   * @param {HTMLElement} target
   * @private
   */
  static async _onCancel(event, target) {
    event.preventDefault();
    this.close();
  }

  /**
   * Static method to show the dialog
   * @param {Actor|null} actor - The actor to add effects to
   * @param {object} options - Additional options
   * @returns {Promise<EffectsCompendiumSelectionDialog>}
   */
  static async show(actor, options = {}) {
    const dialog = new this({ actor, ...options });
    dialog.render(true);
    return dialog;
  }
}
