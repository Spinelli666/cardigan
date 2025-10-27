const { api } = foundry.applications;

/**
 * Dialog for applying effects to targeted tokens
 */
export class EffectsApplicationDialog extends api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "effects-application-dialog",
    classes: ["cardigan", "dialog", "effects-application"],
    tag: "dialog",
    window: {
      frame: true,
      positioned: true,
      title: "Aplicar Efeitos nos Tokens Alvo",
      icon: "fas fa-magic",
      resizable: true
    },
    position: {
      width: 500,
      height: 600
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: "systems/cardigan/templates/dialogs/effects-application.hbs"
    }
  };

  /**
   * Create and show the effects application dialog
   * @param {Token[]} targetedTokens - Array of targeted tokens
   * @param {string[]} [filteredEffects] - Optional array of effect names to filter by
   * @param {string} [customTitle] - Optional custom title for the dialog
   * @returns {Promise<void>}
   */
  static async show(targetedTokens, filteredEffects = null, customTitle = null) {
    if (!targetedTokens || targetedTokens.length === 0) {
      ui.notifications.warn("Nenhum token alvo selecionado!");
      return;
    }

    const dialog = new this({ targetedTokens, filteredEffects, customTitle });
    return dialog.render(true);
  }

  /**
   * Constructor
   * @param {object} options - Dialog options
   * @param {Token[]} options.targetedTokens - Array of targeted tokens
   * @param {string[]} [options.filteredEffects] - Optional array of effect names to filter by
   * @param {string} [options.customTitle] - Optional custom title for the dialog
   */
  constructor({ targetedTokens, filteredEffects, customTitle, ...options } = {}) {
    // Set custom title if provided
    if (customTitle) {
      options.window = options.window || {};
      options.window.title = customTitle;
    }
    
    super(options);
    this.targetedTokens = targetedTokens || [];
    this.filteredEffects = filteredEffects || null;
  }

  targetedTokens;
  filteredEffects;

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    // Get all effects from compendium
    const effectsCompendium = game.packs.get("cardigan.efeitos-cardigan");
    if (!effectsCompendium) {
      console.error("[CARDIGAN] Effects compendium not found!");
      ui.notifications.error("Compêndio de efeitos não encontrado!");
      return context;
    }

    // Load compendium content
    const compendiumContent = await effectsCompendium.getDocuments();
    
    let effects = compendiumContent
      .filter(item => item.type === "efeito")
      .map(effect => ({
        id: effect.id,
        name: effect.name,
        img: effect.img,
        description: effect.system.description || ""
      }));
    
    // Filter effects if filteredEffects array is provided
    if (this.filteredEffects && Array.isArray(this.filteredEffects)) {
      effects = effects.filter(effect => this.filteredEffects.includes(effect.name));
    }
    
    effects.sort((a, b) => a.name.localeCompare(b.name));

    // Prepare targeted tokens info
    const tokens = this.targetedTokens.map(token => ({
      id: token.id,
      name: token.actor?.name || "Token sem nome",
      img: token.document.texture.src || token.actor?.img || 'icons/svg/mystery-man.svg'
    }));
    
    return {
      ...context,
      effects,
      tokens,
      tokenCount: tokens.length
    };
  }





  /** @override */
  _onRender() {
    super._onRender();
    
    // Setup click handlers for effect options
    this.element.querySelectorAll('.effect-option').forEach(option => {
      option.addEventListener('click', (event) => {
        // Toggle the checkbox
        const checkbox = option.querySelector('input[type="checkbox"]');
        if (event.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        
        // Update visual state
        this._updateEffectOptionVisual(option, checkbox.checked);
      });
      
      // Setup hover effects
      option.addEventListener('mouseenter', () => {
        option.style.backgroundColor = 'rgba(255,255,255,0.1)';
      });
      
      option.addEventListener('mouseleave', () => {
        const checkbox = option.querySelector('input[type="checkbox"]');
        option.style.backgroundColor = checkbox.checked ? 'rgba(76, 175, 80, 0.2)' : 'transparent';
      });
    });

    // Setup action button handlers
    this.element.querySelectorAll('[data-action="apply"]').forEach(button => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        this._onApply(event, button);
      });
    });

    this.element.querySelectorAll('[data-action="cancel"]').forEach(button => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        this._onCancel(event, button);
      });
    });
  }

  /**
   * Update visual state of effect option
   * @param {HTMLElement} option - The effect option element
   * @param {boolean} selected - Whether the option is selected
   * @private
   */
  _updateEffectOptionVisual(option, selected) {
    if (selected) {
      option.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
      option.style.borderLeft = '3px solid #4caf50';
    } else {
      option.style.backgroundColor = 'transparent';
      option.style.borderLeft = 'none';
    }
  }

  /**
   * Handle apply button click
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Button element
   */
  async _onApply(event, target) {
    return this._applyEffects();
  }

  /**
   * Handle cancel button click  
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Button element
   */
  async _onCancel(event, target) {
    this.close();
  }

  /**
   * Apply selected effects to targeted tokens
   * @returns {Promise<void>}
   * @private
   */
  async _applyEffects() {
    const selectedCheckboxes = this.element.querySelectorAll('input[type="checkbox"]:checked');
    const selectedEffectIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    
    if (selectedEffectIds.length === 0) {
      ui.notifications.warn("Selecione pelo menos um efeito para aplicar!");
      return;
    }

    try {
      // Get effects from compendium
      const effectsCompendium = game.packs.get("cardigan.efeitos-cardigan");
      const compendiumContent = await effectsCompendium.getDocuments();
      const selectedEffects = compendiumContent.filter(effect => selectedEffectIds.includes(effect.id));

      if (selectedEffects.length === 0) {
        ui.notifications.error("Efeitos selecionados não encontrados no compêndio!");
        return;
      }

      // Apply effects to each targeted token
      const applicationResults = [];
      
      for (const token of this.targetedTokens) {
        if (!token.actor) continue;

        const appliedEffects = [];
        
        for (const effect of selectedEffects) {
          try {
            // Create item data for the actor
            const itemData = effect.toObject();
            await token.actor.createEmbeddedDocuments("Item", [itemData]);
            appliedEffects.push(effect.name);
          } catch (error) {
            console.error(`Erro ao aplicar efeito ${effect.name} no token ${token.actor.name}:`, error);
          }
        }

        if (appliedEffects.length > 0) {
          applicationResults.push({
            tokenName: token.actor.name,
            effects: appliedEffects
          });
        }
      }

      // Show results in chat
      await this._sendChatMessage(applicationResults);
      
      // Close dialog
      this.close();
      
      ui.notifications.info(`Efeitos aplicados com sucesso em ${applicationResults.length} token(s)!`);

    } catch (error) {
      console.error("Erro ao aplicar efeitos:", error);
      ui.notifications.error("Erro ao aplicar efeitos. Verifique o console para mais detalhes.");
    }
  }

  /**
   * Send chat message with application results
   * @param {Array} results - Array of application results
   * @returns {Promise<void>}
   * @private
   */
  async _sendChatMessage(results) {
    if (results.length === 0) return;

    let content = `
      <div class="cardigan-effects-application-message" style="
        background: rgba(76, 175, 80, 0.1); 
        border-left: 4px solid #4caf50; 
        padding: 12px; 
        margin: 8px 0; 
        border-radius: 6px;
      ">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <i class="fas fa-magic" style="color: #4caf50; margin-right: 6px;"></i>
          <strong style="color: #4caf50;">Efeitos Aplicados:</strong>
        </div>
        <ul style="margin: 0; padding-left: 20px;">
    `;

    for (const result of results) {
      content += `<li><strong>${result.tokenName}:</strong> ${result.effects.join(', ')}</li>`;
    }

    content += `
        </ul>
      </div>
    `;

    await ChatMessage.create({
      content: content,
      speaker: ChatMessage.getSpeaker({ actor: game.user.character }),
      style: CONST.CHAT_MESSAGE_STYLES.OTHER
    });
  }
}