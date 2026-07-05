/**
 * Dialog for selecting custom effects for skills
 */
export class SkillEffectsSelectionDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  
  constructor(options = {}) {
    super(options);
    this.item = options.item;
    this.effects = [];
    this.selectedEffects = options.selectedEffects || [];
    this.enhancementIndex = options.enhancementIndex; // undefined for base skill, 0-2 for enhancements
    this.parentDialog = options.parentDialog; // Reference to parent dialog (for enhancements)
    this.effectType = options.effectType; // For consumables: 'criticalFailureEffects' or 'criticalHitEffects'
  }

  static DEFAULT_OPTIONS = {
    id: "skill-effects-selection-dialog",
    tag: "dialog",
    window: {
      title: "Selecionar Efeitos para Skill",
      icon: "fas fa-magic",
      minimizable: false,
      resizable: true
    },
    position: {
      width: 800,
      height: 700
    },
    actions: {
      confirm: SkillEffectsSelectionDialog.#onConfirm,
      cancel: SkillEffectsSelectionDialog.#onCancel
    }
  };

  static PARTS = {
    form: {
      template: "systems/cardigan/templates/dialogs/skill-effects-selection.hbs"
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  };

  async _prepareContext() {
    // Load effects from compendium
    await this._loadEffectsFromCompendium();

    return {
      positiveEffects: this.positiveEffects || [],
      negativeEffects: this.negativeEffects || [],
      worldEffects: this.worldEffects || [],
      buttons: [
        {
          type: "submit",
          action: "confirm",
          label: "CARDIGAN.Common.Confirm",
          icon: "fas fa-check"
        },
        {
          type: "button", 
          action: "cancel",
          label: "CARDIGAN.Common.Cancel",
          icon: "fas fa-times"
        }
      ]
    };
  }

  async _loadEffectsFromCompendium() {
    try {
      const allEffects = [];
      
      // 1. Load effects from compendium
      const pack = game.packs.get("cardigan.effects-cardigan");
      if (pack) {
        const documents = await pack.getDocuments();
        const compendiumEffects = documents
          .filter(doc => doc.type === 'efeito')
          .map(effect => ({
            id: effect.id,
            uuid: effect.uuid,
            name: effect.name,
            img: effect.img || 'icons/svg/aura.svg',
            selected: this.selectedEffects.some(selected => selected.id === effect.id),
            folder: effect.folder?.name || 'Sem Categoria',
            source: 'compendium'
          }));
        
        allEffects.push(...compendiumEffects);
        console.log('[CARDIGAN DEBUG] Loaded from compendium:', compendiumEffects.length);
      } else {
        ui.notifications.warn("Compêndio de efeitos não encontrado");
      }
      
      // 2. Load effects from world (items created in the game)
      const worldEffects = game.items
        .filter(item => item.type === 'efeito')
        .map(effect => ({
          id: effect.id,
          uuid: effect.uuid,
          name: effect.name,
          img: effect.img || 'icons/svg/aura.svg',
          selected: this.selectedEffects.some(selected => selected.id === effect.id),
          folder: effect.folder?.name || 'World Items',
          source: 'world'
        }));
      
      allEffects.push(...worldEffects);
      console.log('[CARDIGAN DEBUG] Loaded from world:', worldEffects.length);
      
      // Sort all effects by name
      allEffects.sort((a, b) => a.name.localeCompare(b.name));
      
      console.log('[CARDIGAN DEBUG] Total effects loaded:', allEffects.length);
      console.log('[CARDIGAN DEBUG] Selected effects on load:', this.selectedEffects);
      console.log('[CARDIGAN DEBUG] Effects marked as selected:', allEffects.filter(e => e.selected).map(e => e.name));

      // Separate into positive, negative, and world effects
      this.positiveEffects = allEffects.filter(effect => 
        effect.folder === 'Efeitos Positivos'
      );
      
      this.negativeEffects = allEffects.filter(effect => 
        effect.folder === 'Efeitos Negativos'
      );
      
      // World effects (custom effects created in the game)
      this.worldEffects = allEffects.filter(effect => 
        effect.source === 'world'
      );
      
      console.log('[CARDIGAN DEBUG] Positive effects:', this.positiveEffects.length);
      console.log('[CARDIGAN DEBUG] Negative effects:', this.negativeEffects.length);
      console.log('[CARDIGAN DEBUG] World effects:', this.worldEffects.length);
      
    } catch (error) {
      console.error("Error loading effects:", error);
      ui.notifications.error("Erro ao carregar efeitos");
    }
  }

  static async #onConfirm(event, target) {
    try {
      
      // Get selected effects
      const selectedEffects = [];
      const checkboxes = this.element.querySelectorAll('input[type="checkbox"]:checked');
      
      console.log('[CARDIGAN DEBUG] Checkboxes found:', checkboxes.length);
      
      checkboxes.forEach(checkbox => {
        const effectId = checkbox.closest('.effect-option').dataset.effectId;
        console.log('[CARDIGAN DEBUG] Processing effect ID:', effectId);
        // Search in all three effect lists (positive, negative, and world)
        const allEffects = [
          ...(this.positiveEffects || []), 
          ...(this.negativeEffects || []),
          ...(this.worldEffects || [])
        ];
        const effect = allEffects.find(e => e.id === effectId);
        if (effect) {
          selectedEffects.push({
            id: effect.id,
            name: effect.name,
            img: effect.img
          });
          console.log('[CARDIGAN DEBUG] Added effect:', effect.name);
        }
      });

      console.log('[CARDIGAN DEBUG] Total selected effects:', selectedEffects.length, selectedEffects);

      // Check if this is for consumable effects (criticalFailure or criticalHit)
      if (this.effectType) {
        // Save to consumable specific field
        const updateData = {};
        updateData[`system.${this.effectType}`] = selectedEffects;
        
        console.log('[CARDIGAN DEBUG] Updating consumable effects:', this.effectType, selectedEffects);
        
        await this.item.update(updateData);
        
        ui.notifications.info(`${selectedEffects.length} efeitos selecionados`);
      }
      // Check if this is for an enhancement or the base skill
      else if (this.enhancementIndex !== undefined) {
        // Save to enhancement
        const currentEnhancements = foundry.utils.deepClone(this.item.system.enhancements || []);
        
        // Ensure we have enough slots
        while (currentEnhancements.length <= this.enhancementIndex) {
          currentEnhancements.push({ 
            name: '', 
            description: '', 
            hasEnergy: false, 
            energyCost: 0, 
            hasEffects: false,
            customEffects: []
          });
        }
        
        // Update the specific enhancement's effects
        currentEnhancements[this.enhancementIndex].customEffects = selectedEffects;
        
        console.log('[CARDIGAN DEBUG] Updating enhancement:', this.enhancementIndex, currentEnhancements);
        
        await this.item.update({
          'system.enhancements': currentEnhancements
        });
        
        // Update parent dialog if it exists
        if (this.parentDialog) {
          this.parentDialog.enhancementData.customEffects = selectedEffects;
          this.parentDialog.render(true); // Re-render parent to show updated effects
        }
        
        ui.notifications.info(`${selectedEffects.length} efeitos selecionados para aprimoramento ${this.enhancementIndex + 1}`);
      } else {
        // Save to base skill
        console.log('[CARDIGAN DEBUG] Updating base skill custom effects:', selectedEffects);
        
        await this.item.update({
          'system.customEffects': selectedEffects
        });
        
        ui.notifications.info(`${selectedEffects.length} efeitos selecionados para ${this.item.name}`);
      }

      this.close();
    } catch (error) {
      console.error('[CARDIGAN ERROR] Error confirming effects:', error);
      ui.notifications.error(`Erro ao salvar efeitos: ${error.message}`);
    }
  }

  static async #onCancel(event, target) {
    this.close();
  }

  _onRender(context, options) {
    super._onRender(context, options);
    
    // Add click handlers for effect options
    this.element.querySelectorAll('.effect-option').forEach(option => {
      option.addEventListener('click', (event) => {
        if (event.target.type !== 'checkbox') {
          const checkbox = option.querySelector('input[type="checkbox"]');
          checkbox.checked = !checkbox.checked;
        }
      });
    });
  }
}