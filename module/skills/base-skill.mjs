import { EffectsApplicationDialog } from '../applications/effects-application-dialog.mjs';

/**
 * Base Skill Class - Foundation for all skills in the Cardigan system
 * Provides common functionality, ammunition management, critical detection, and expansion system
 */
export class BaseSkill {
  
  /**
   * Check if a skill has any effects to apply (base effects OR active enhancement effects)
   * @param {Item} skill - The skill item
   * @returns {boolean} True if skill has effects to apply
   * @protected
   */
  static hasAnyEffects(skill) {
    if (!skill || skill.type !== 'skill') return false;
    
    // Check base effects
    if (skill.system.hasCustomEffects && skill.system.customEffects && skill.system.customEffects.length > 0) {
      return true;
    }
    
    // Check active enhancement effects
    if (skill.system.enhancements && skill.system.acquiredEnhancements) {
      for (let i = 0; i < 3; i++) {
        const enhancement = skill.system.enhancements[i];
        const isAcquired = skill.system.acquiredEnhancements[i];
        
        // If enhancement is active and has effects
        if (isAcquired && enhancement?.hasEffects && enhancement.customEffects && enhancement.customEffects.length > 0) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * The name of the skill (should be overridden by subclasses)
   * @type {string}
   */
  static get skillName() {
    throw new Error("Subclasses must implement skillName getter");
  }

  /**
   * Whether this skill has interactive buttons in chat
   * @type {boolean}
   */
  static get hasInteractiveButtons() {
    return false;
  }

  /**
   * Get actor safely with error handling
   * @param {string} actorId - The actor ID
   * @returns {Actor|null} The actor or null if not found
   */
  static getActor(actorId) {
    try {
      const actor = game.actors.get(actorId);
      if (!actor) {
        ui.notifications.error("Ator não encontrado");
        console.error(`Actor not found: ${actorId}`);
        return null;
      }
      return actor;
    } catch (error) {
      console.error("Error getting actor:", error);
      ui.notifications.error(`Erro ao buscar ator: ${error.message}`);
      return null;
    }
  }

  /**
   * Create a chat message with consistent formatting
   * @param {Object} options - Chat message options
   * @param {string} options.content - HTML content for the message
   * @param {Actor} options.actor - The actor sending the message
   * @param {Roll[]} [options.rolls] - Array of rolls to include
   * @returns {Promise<ChatMessage>}
   */
  static async createChatMessage({ content, actor, rolls = [] }) {
    try {
      return await ChatMessage.create({
        content,
        speaker: ChatMessage.getSpeaker({ actor }),
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        rolls
      });
    } catch (error) {
      console.error("Error creating chat message:", error);
      ui.notifications.error(`Erro ao criar mensagem no chat: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a standardized skill chat message
   * @param {Actor} actor - The actor
   * @param {string} skillName - Name of the skill
   * @param {string} action - Action performed
   * @param {string} result - Result description
   * @param {string} [backgroundColor] - Background color (optional)
   * @param {string} [borderColor] - Border color (optional)
   * @param {string} [icon] - FontAwesome icon class (optional)
   * @returns {Promise<ChatMessage>}
   */
  static async createSkillChatMessage(actor, skillName, action, result, backgroundColor = "rgba(76,175,80,0.1)", borderColor = "#4caf50", icon = "fas fa-dice") {
    const content = `<div class="cardigan-skill-message" style="text-align: center; padding: 8px; background: ${backgroundColor}; border: 1px solid ${borderColor}; border-radius: 3px;">
      <h4 style="margin: 0 0 4px 0; color: ${borderColor};">
        <i class="${icon}" style="margin-right: 6px;"></i>${skillName}
      </h4>
      <p style="margin: 4px 0; color: #666;">
        <strong>${actor.name}</strong> ${action}
      </p>
      <div style="margin: 8px 0; padding: 8px; background: ${backgroundColor.replace('0.1', '0.2')}; border-radius: 3px;">
        ${result}
      </div>
    </div>`;

    return await this.createChatMessage({ content, actor });
  }

  /**
   * Roll a die with standard formatting
   * @param {string} formula - The roll formula (e.g., "1d20", "1d6")
   * @param {Actor} actor - The actor making the roll
   * @returns {Promise<Roll>}
   */
  static async rollDie(formula, actor) {
    try {
      const roll = new Roll(formula);
      await roll.evaluate();

      return roll;
    } catch (error) {
      console.error(`Error rolling ${formula}:`, error);
      ui.notifications.error(`Erro ao rolar dados: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if actor has sufficient resources (power, mana, etc.)
   * @param {Actor} actor - The actor
   * @param {string} resourceType - Type of resource (e.g., 'power', 'mana')
   * @param {number} amount - Amount needed
   * @returns {boolean}
   */
  static hasEnoughResource(actor, resourceType, amount) {
    const currentAmount = actor.system.resources?.[resourceType]?.value || 0;
    return currentAmount >= amount;
  }

  /**
   * Spend resources from actor
   * @param {Actor} actor - The actor
   * @param {string} resourceType - Type of resource
   * @param {number} amount - Amount to spend
   * @returns {Promise<boolean>} Success status
   */
  static async spendResource(actor, resourceType, amount) {
    try {
      if (!this.hasEnoughResource(actor, resourceType, amount)) {
        const resourceName = resourceType === 'power' ? 'Poder' : resourceType;
        ui.notifications.warn(`${actor.name} não possui ${resourceName} suficiente!`);
        return false;
      }

      const currentAmount = actor.system.resources[resourceType].value;
      const newAmount = Math.max(0, currentAmount - amount);

      await actor.update({
        [`system.resources.${resourceType}.value`]: newAmount
      });

      return true;
    } catch (error) {
      console.error(`Error spending ${resourceType}:`, error);
      ui.notifications.error(`Erro ao gastar ${resourceType}: ${error.message}`);
      return false;
    }
  }

  /**
   * Whether this skill supports expansion functionality
   * Override this method in subclasses to enable expansion
   * @returns {boolean}
   */
  static supportsExpansion() {
    return false; // No expansion by default
  }

  /**
   * Get the expanded content for this skill
   * Override this method in subclasses to provide custom content
   * @param {string} actorId - The actor ID
   * @returns {string} HTML content to show when expanded
   */
  static getExpandedContent(actorId) {
    return this._generateSelectedTokensContent(actorId); // Default: show targeted tokens
  }

  /**
   * Generates content showing currently targeted tokens
   * @param {string} actorId - The actor ID
   * @returns {string} HTML content for targeted tokens
   */
  static _generateSelectedTokensContent(actorId) {
    // Check if game and user are available
    if (!game || !game.user) {
      return `
        <div class="cardigan-expanded-content">
          <div class="no-tokens-message">
            <i class="fas fa-exclamation-triangle"></i>
            <span>Sistema não disponível</span>
          </div>
        </div>
      `;
    }

    const targetedTokens = Array.from(game.user.targets);

    if (targetedTokens.length === 0) {
      return `
        <div class="cardigan-expanded-content">
          <div class="no-tokens-message">
            <i class="fas fa-crosshairs"></i>
            <span>Nenhum token alvo</span>
          </div>
        </div>
      `;
    }

    // Generate HTML for each targeted token (only images)
    const tokensHtml = targetedTokens.map(token => {
      const actor = token.actor;
      if (!actor) return '';

      // Get token image
      const tokenImg = token.document.texture.src || actor.img || 'icons/svg/mystery-man.svg';

      return `
        <img src="${tokenImg}" alt="${actor.name}" title="${actor.name}"
             style="width: 32px; height: 32px; border-radius: 50%; margin: 4px; border: 2px solid #4caf50; cursor: pointer;">
      `;
    }).filter(html => html !== '').join('');

    const htmlContent = `
      <div class="cardigan-expanded-content" style="
        background: rgba(76, 175, 80, 0.1); 
        border-left: 4px solid #4caf50; 
        padding: 12px; 
        margin: 8px 0; 
        border-radius: 6px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        text-align: center;
      ">
        <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
          <i class="fas fa-crosshairs" style="color: #4caf50; margin-right: 6px;"></i>
          <strong style="color: #4caf50;">Tokens Alvo:</strong>
        </div>
        <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; margin-bottom: 12px;">
          ${tokensHtml}
        </div>
        <div style="text-align: center;">
          <button class="cardigan-skill-apply-effects-btn" data-skill="${this.skillName}" data-actor-id="${actorId}" style="
            padding: 6px 12px; 
            background: #9c27b0; 
            color: white; 
            border: none; 
            border-radius: 3px; 
            cursor: pointer; 
            font-weight: bold;
          ">
            <i class="fas fa-magic" style="margin-right: 4px;"></i>Aplicar Efeitos
          </button>
        </div>
      </div>
    `;
    
    return htmlContent;
  }

  /**
   * Generate enhancement emojis display for chat
   * Shows 3 emojis representing the enhancements
   * Grayscale when not acquired, colored when acquired
   * @param {string} actorId - The actor ID
   * @returns {string} HTML string for enhancement emojis
   */
  static generateEnhancementEmojis(actorId) {
    try {
      const actor = this.getActor(actorId);
      if (!actor) {
        return ''; // No display if actor not found
      }

      // Get the skill item to check enhancements
      const skill = actor.items.find(item => item.type === 'skill' && item.name === this.skillName);
      if (!skill || !skill.system.enhancements || !Array.isArray(skill.system.enhancements)) {
        return ''; // No display if no enhancements
      }

      // Define emojis for each enhancement (you can customize these)
      const enhancementEmojis = ['⚔️', '🎯', '💀'];
      
      let emojisHtml = '';
      for (let i = 0; i < 3; i++) {
        const enhancement = skill.system.enhancements[i];
        const isAcquired = skill.system.acquiredEnhancements?.[i] === true;
        
        // Check if enhancement has content
        const hasContent = enhancement?.description?.trim();
        
        if (hasContent) {
          // Apply grayscale filter if not acquired
          const filterStyle = isAcquired ? '' : 'filter: grayscale(100%); opacity: 0.4;';
          const emoji = enhancementEmojis[i] || '⭐';
          
          // Get the enhancement name and description
          const enhancementName = enhancement.name || `Enhancement ${i + 1}`;
          const statusText = isAcquired ? '✓ Acquired' : '✗ Not Acquired';
          
          // Store enhancement data in data attributes for async enrichment
          const enhancementData = {
            name: enhancementName,
            description: enhancement.description,
            status: statusText,
            acquired: isAcquired,
            actorUuid: actor.uuid,
            skillName: this.skillName,
            index: i
          };
          
          // Use data attributes to store enhancement info
          emojisHtml += `<span 
            class="enhancement-emoji" 
            style="font-size: 24px; margin: 0 8px; cursor: help; ${filterStyle}" 
            data-enhancement='${JSON.stringify(enhancementData).replace(/'/g, "&apos;")}'
            data-tooltip-direction="UP"
          >${emoji}</span>`;
        }
      }

      if (!emojisHtml) {
        return ''; // No emojis to display
      }

      return `<div style="margin: 12px 0; text-align: center; padding: 8px; background: rgba(0,0,0,0.03); border-radius: 4px;">
        ${emojisHtml}
      </div>`;
    } catch (error) {
      console.error("Error generating enhancement emojis:", error);
      return ''; // Return empty if error
    }
  }

  /**
   * Generate expand button HTML
   * @param {string} actorId - The actor ID
   * @returns {string} HTML string for expand button or empty
   * @protected
   */
  static _generateExpandButton(actorId) {
    // Check if skill explicitly supports expansion (like Acerto Debilitante)
    if (this.supportsExpansion()) {
      return `<button class="cardigan-skill-expand-btn" data-actor-id="${actorId}" data-skill="${this.skillName}"
                style="padding: 4px 8px; background: #9e9e9e; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; margin-left: 4px;">
          <i class="fas fa-chevron-down" style="margin-right: 2px;"></i>Expandir
        </button>`;
    }

    // Check if skill has custom effects configured (for generic skills)
    try {
      const actor = this.getActor(actorId);
      if (actor) {
        const skill = actor.items.find(item => item.type === 'skill' && item.name === this.skillName);
        if (this.hasAnyEffects(skill)) {
          return `<button class="cardigan-skill-expand-btn" data-actor-id="${actorId}" data-skill="${this.skillName}"
                    style="padding: 4px 8px; background: #9e9e9e; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; margin-left: 4px;">
              <i class="fas fa-chevron-down" style="margin-right: 2px;"></i>Expandir
            </button>`;
        }
      }
    } catch (error) {
      console.warn(`Error checking custom effects for ${this.skillName}:`, error);
    }

    return ''; // No expand button if not supported
  }

  /**
   * Generate interactive buttons HTML for chat
   * Override this method in subclasses to add custom buttons
   * @param {string} actorId - The actor ID
   * @returns {string} HTML string for buttons
   */
  static generateChatButtons(actorId) {
    return ''; // No buttons by default
  }

  /**
   * Handle button clicks for base functionality
   * @param {string} buttonType - Type of button clicked
   * @param {string} actorId - The actor ID
   * @param {HTMLElement} buttonElement - The button element that was clicked
   * @returns {Promise<void>}
   */
  static async handleButtonClick(buttonType, actorId, buttonElement) {
    if (buttonType === 'expand') {
      await this._handleExpandClick(actorId, buttonElement);
    } else if (buttonType === 'apply-effects') {
      await this.showCustomEffectsDialog(actorId);
    } else if (buttonType === 'energy') {
      await this.spendEnergy(actorId);
    } else {
      console.warn(`${this.skillName}: Button click handler not implemented for type: ${buttonType}`);
    }
  }

  /**
   * Generic method to spend energy for skills
   * Can be overridden by subclasses for custom behavior
   * @param {string} actorId - The actor ID
   * @returns {Promise<void>}
   */
  static async spendEnergy(actorId) {
    try {
      const actor = this.getActor(actorId);
      if (!actor) {
        console.error("Actor not found for ID:", actorId);
        ui.notifications.error("Personagem não encontrado");
        return;
      }

      // Get the skill item from the actor to check energy cost
      const skill = actor.items.find(item => item.type === 'skill' && item.name === this.skillName);
      if (!skill) {
        ui.notifications.error("Skill não encontrada no personagem");
        return;
      }

      // Check if the skill has energy cost configured
      if (!skill.system.hasEnergyCost) {
        ui.notifications.info(`${this.skillName} não gasta energia`);
        return;
      }

      // Use effective energy cost (considers active enhancements)
      const energyCost = skill.system.effectiveEnergyCost ?? (skill.system.energyCost || 0);
      
      // If energy cost is 0, don't spend anything
      if (energyCost <= 0) {
        ui.notifications.info(`${this.skillName} não tem custo de energia configurado`);
        return;
      }

      const currentEnergy = actor.system.power.value || 0;
      const maxEnergy = actor.system.power.max || 0;
      
      // Check if energy was already spent (toggle mode)
      const energySpent = skill.system.energySpent || false;

      if (energySpent) {
        // RECOVER ENERGY - Toggle back
        const newEnergy = Math.min(maxEnergy, currentEnergy + energyCost);

        // Update actor's power (energy) and skill state
        await actor.update({
          'system.power.value': newEnergy
        });
        
        await skill.update({
          'system.energySpent': false
        });

        // Create recovery message in chat
        await this.createSkillChatMessage(
          actor,
          this.skillName,
          `recuperou <strong>${energyCost}</strong> de energia de <strong>${this.skillName}</strong>!`,
          `Energia: <strong>${currentEnergy}</strong> → <strong>${newEnergy}</strong> (+${energyCost})`,
          "rgba(76,175,80,0.1)",
          "#4caf50",
          "fas fa-redo"
        );

        // Show notification
        ui.notifications.info(`${actor.name} recuperou ${energyCost} de energia! (${currentEnergy} → ${newEnergy})`);
        
        // Update the existing chat message instead of creating a new one
        const chatMessageId = skill.getFlag('cardigan', 'lastChatMessageId');
        const chatMessage = chatMessageId ? game.messages.get(chatMessageId) : null;
        
        if (chatMessage) {
          // Update existing message by re-rendering the skill
          const SkillManager = (await import('./skill-manager.mjs')).default;
          await SkillManager.updateSkillChatMessage(chatMessage, this.skillName, actorId);
        } else {
          // Fallback: Re-render the skill in chat with updated button state
          const SkillManager = (await import('./skill-manager.mjs')).default;
          await SkillManager.handleSkillToChat(this.skillName, actorId);
        }

      } else {
        // SPEND ENERGY - First time or after recovery
        
        // Check if has enough energy
        if (currentEnergy < energyCost) {
          ui.notifications.warn(`${actor.name} não tem energia suficiente! (Atual: ${currentEnergy}, Necessário: ${energyCost})`);
          
          // Still show message in chat informing about the attempt
          await this.createSkillChatMessage(
            actor,
            this.skillName,
            `tentou usar <strong>${this.skillName}</strong> mas não tem energia suficiente!`,
            `Energia atual: <strong>${currentEnergy}</strong> | Necessário: <strong>${energyCost}</strong>`,
            "rgba(255,193,7,0.1)",
            "#ffc107",
            "fas fa-exclamation-triangle"
          );
          return;
        }

        // Calculate new energy value
        const newEnergy = Math.max(0, currentEnergy - energyCost);

        // Update actor's power (energy) and skill state
        await actor.update({
          'system.power.value': newEnergy
        });
        
        await skill.update({
          'system.energySpent': true
        });

        // Create success message in chat
        await this.createSkillChatMessage(
          actor,
          this.skillName,
          `gastou <strong>${energyCost}</strong> de energia para potencializar <strong>${this.skillName}</strong>!`,
          `Energia: <strong>${currentEnergy}</strong> → <strong>${newEnergy}</strong> (-${energyCost})`,
          "rgba(33,150,243,0.1)",
          "#2196f3",
          "fas fa-bolt"
        );

        // Show notification as well
        ui.notifications.info(`${actor.name} gastou ${energyCost} de energia! (${currentEnergy} → ${newEnergy})`);
        
        // Update the existing chat message instead of creating a new one
        const chatMessageId = skill.getFlag('cardigan', 'lastChatMessageId');
        const chatMessage = chatMessageId ? game.messages.get(chatMessageId) : null;
        
        if (chatMessage) {
          // Update existing message by re-rendering the skill
          const SkillManager = (await import('./skill-manager.mjs')).default;
          await SkillManager.updateSkillChatMessage(chatMessage, this.skillName, actorId);
        } else {
          // Fallback: Re-render the skill in chat with updated button state
          const SkillManager = (await import('./skill-manager.mjs')).default;
          await SkillManager.handleSkillToChat(this.skillName, actorId);
        }
      }

    } catch (error) {
      console.error("Error spending skill energy:", error);
      ui.notifications.error(`Erro ao gastar energia: ${error.message}`);
    }
  }

  /**
   * Generic method to show effects dialog for skills with custom effects
   * Can be overridden by subclasses for custom behavior
   * @param {string} actorId - The actor ID
   * @returns {Promise<void>}
   */
  static async showCustomEffectsDialog(actorId) {
    try {
      // Get currently targeted tokens
      if (!game || !game.user) {
        ui.notifications.error("Sistema não disponível!");
        return;
      }

      const targetedTokens = Array.from(game.user.targets);
      
      if (targetedTokens.length === 0) {
        ui.notifications.warn("Nenhum token alvo selecionado! Use T ou Shift+T para mirar em tokens.");
        return;
      }

      // Get the actor and skill
      const actor = this.getActor(actorId);
      if (!actor) return;

      const skill = actor.items.find(item => item.type === 'skill' && item.name === this.skillName);
      if (!skill) {
        ui.notifications.error("Skill não encontrada no personagem");
        return;
      }

      // Collect all effects: base effects + active enhancements effects
      let allEffects = [];
      
      // Add base custom effects
      if (skill.system.hasCustomEffects && skill.system.customEffects && skill.system.customEffects.length > 0) {
        allEffects = [...skill.system.customEffects];
      }
      
      // Add effects from active enhancements
      if (skill.system.enhancements && skill.system.acquiredEnhancements) {
        for (let i = 0; i < 3; i++) {
          const enhancement = skill.system.enhancements[i];
          const isAcquired = skill.system.acquiredEnhancements[i];
          
          // Check if enhancement is acquired/active and has effects
          if (isAcquired && enhancement?.hasEffects && enhancement.customEffects && enhancement.customEffects.length > 0) {
            allEffects = [...allEffects, ...enhancement.customEffects];
          }
        }
      }
      
      // Check if there are any effects to show
      if (allEffects.length === 0) {
        ui.notifications.info(`${this.skillName} não tem efeitos personalizados configurados`);
        return;
      }

      // Extract effect names from all collected effects (remove duplicates)
      const effectNames = [...new Set(allEffects.map(effect => effect.name))];

      // Import the effects dialog
      const { EffectsApplicationDialog } = await import('../applications/effects-application-dialog.mjs');

      // Open the effects application dialog with filtered effects
      await EffectsApplicationDialog.show(
        targetedTokens, 
        effectNames, 
        `${this.skillName} - Aplicar Efeitos`
      );

    } catch (error) {
      console.error("Erro ao abrir dialog de aplicação de efeitos:", error);
      ui.notifications.error("Erro ao abrir dialog de efeitos. Verifique o console para mais detalhes.");
    }
  }

  /**
   * Handle expand button click - toggle expanded content
   * @param {string} actorId - The actor ID
   * @param {HTMLElement} buttonElement - The button element that was clicked
   * @returns {Promise<void>}
   * @private
   */
  static async _handleExpandClick(actorId, buttonElement) {
    if (!this.supportsExpansion()) {
      console.warn(`${this.skillName}: Expansion not supported but expand button was clicked`);
      return;
    }

    // Find the chat message containing this button
    const messageElement = buttonElement.closest('.chat-message');
    if (!messageElement) {
      console.warn(`${this.skillName}: Could not find chat message element`);
      return;
    }

    const expandButton = buttonElement;

    // Find or create the expanded content container
    let expandedContainer = messageElement.querySelector('.cardigan-skill-expanded-content');
    
    if (expandedContainer) {
      // Toggle visibility
      const isVisible = expandedContainer.style.display !== 'none';
      expandedContainer.style.display = isVisible ? 'none' : 'block';
      
      // Handle refresh interval and hooks
      if (isVisible) {
        // Hiding - clear interval and hook
        if (expandedContainer._refreshInterval) {
          clearInterval(expandedContainer._refreshInterval);
          expandedContainer._refreshInterval = null;
        }
        if (expandedContainer._hookId && Hooks) {
          Hooks.off('targetToken', expandedContainer._hookId);
          expandedContainer._hookId = null;
        }
        expandButton.innerHTML = '<i class="fas fa-chevron-down" style="margin-right: 2px;"></i>Expandir';
      } else {
        // Showing - start interval, hook, and update content
        const updateContent = () => {
          expandedContainer.innerHTML = this.getExpandedContent(actorId);
        };
        
        updateContent();
        
        // Listen for token targeting changes
        if (Hooks) {
          expandedContainer._hookId = Hooks.on('targetToken', updateContent);
        }
        
        // Fallback refresh
        expandedContainer._refreshInterval = setInterval(updateContent, 3000);
        expandButton.innerHTML = '<i class="fas fa-chevron-up" style="margin-right: 2px;"></i>Recolher';
      }
    } else {
      // Create expanded content container
      expandedContainer = document.createElement('div');
      expandedContainer.className = 'cardigan-skill-expanded-content';
      expandedContainer.style.cssText = `
        margin-top: 8px; 
        padding: 12px; 
        background: rgba(76, 175, 80, 0.1); 
        border-radius: 6px; 
        border-left: 4px solid #4caf50;
        font-size: 14px;
          color: #333;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        
        // Set up auto-refresh for token content
        const updateContent = () => {
          expandedContainer.innerHTML = this.getExpandedContent(actorId);
        };
        
        // Initial content
        updateContent();
        
        // Set up direct click listener for apply effects button
        const setupApplyEffectsListener = () => {
          // Generic apply effects button
          const applyButton = expandedContainer.querySelector('.cardigan-apply-effects-btn');
          if (applyButton) {
            applyButton.addEventListener('click', async (event) => {
              event.preventDefault();
              await this._handleApplyEffectsClick();
            });
          }
          
          // Skill-specific apply effects button
          const skillApplyButton = expandedContainer.querySelector('.cardigan-skill-apply-effects-btn');
          if (skillApplyButton) {
            skillApplyButton.addEventListener('click', async (event) => {
              event.preventDefault();
              // Use the skill's own button handler
              const skillName = skillApplyButton.dataset.skill;
              const actorId = skillApplyButton.dataset.actorId;
              if (skillName && actorId) {
                try {
                  const { SkillManager } = await import('./skill-manager.mjs');
                  const skillClass = SkillManager.getSkill(skillName);
                  if (skillClass && skillClass.handleButtonClick) {
                    await skillClass.handleButtonClick('apply-effects', actorId);
                  }
                } catch (error) {
                  console.error('Error handling skill apply effects button:', error);
                  ui.notifications.error('Erro ao aplicar efeitos da skill');
                }
              }
            });
          }
        };
        
        // Listen for token targeting changes for immediate updates
        const onTokenTargetingChange = () => {
          if (expandedContainer.style.display !== 'none') {
            updateContent();
            // Re-setup listener after content update
            setTimeout(setupApplyEffectsListener, 100);
          }
        };
        
        // Hook into Foundry's targeting events if available
        if (Hooks) {
          expandedContainer._hookId = Hooks.on('targetToken', onTokenTargetingChange);
        }
        
        // Fallback: Auto-refresh every 3 seconds when expanded
        expandedContainer._refreshInterval = setInterval(() => {
          updateContent();
          setTimeout(setupApplyEffectsListener, 100);
        }, 3000);
        
        // Setup initial listener
        setTimeout(setupApplyEffectsListener, 100);
        
        // Insert after the buttons container
        const buttonsContainer = expandButton.closest('div');
        buttonsContainer.parentNode.insertBefore(expandedContainer, buttonsContainer.nextSibling);
        
        // Update button to "Recolher"
        expandButton.innerHTML = '<i class="fas fa-chevron-up" style="margin-right: 2px;"></i>Recolher';
      }
  }

  /**
   * Handle apply effects button click - open effects application dialog
   * @returns {Promise<void>}
   * @private
   */
  static async _handleApplyEffectsClick() {
    // Get currently targeted tokens
    if (!game || !game.user) {
      ui.notifications.error("Sistema não disponível!");
      return;
    }

    const targetedTokens = Array.from(game.user.targets);
    
    if (targetedTokens.length === 0) {
      ui.notifications.warn("Nenhum token alvo selecionado! Use T ou Shift+T para mirar em tokens.");
      return;
    }

    // Open the effects application dialog
    try {
      await EffectsApplicationDialog.show(targetedTokens);
    } catch (error) {
      console.error("Erro ao abrir dialog de aplicação de efeitos:", error);
      ui.notifications.error("Erro ao abrir dialog de efeitos. Verifique o console para mais detalhes.");
    }
  }

  /**
   * Get the primary weapon for attack (rightHand priority, then ambidextrous)
   * @param {Actor} actor - The actor
   * @returns {Item|null} Primary weapon or null
   * @protected
   */
  static _getPrimaryWeapon(actor) {
    // Get all REAL weapons (not virtual unarmed attacks) that are equipped
    const realWeapons = actor.items.filter(item => 
      item.type === 'arma' && 
      item.system.equipped && 
      !item.system.isUnarmed && // Exclude virtual unarmed attacks
      (item.system.rightHand || item.system.leftHand)
    );

    // Check if right hand is occupied by a REAL weapon
    const rightHandWeapon = realWeapons.find(weapon => weapon.system.rightHand);
    
    // If right hand has a real weapon, return it (priority over secondary hand)
    if (rightHandWeapon) {
      return rightHandWeapon;
    }
    
    // If right hand is empty (unarmed), do NOT show secondary hand weapons
    // Return null to show unarmed attack instead
    return null;
  }

  /**
   * Get the secondary weapon for attack (leftHand only, excluding ambidextrous)
   * @param {Actor} actor - The actor
   * @returns {Item|null} Secondary weapon or null
   * @protected
   */
  static _getSecondaryWeapon(actor) {
    // Get all REAL weapons (not virtual unarmed attacks) that are equipped
    const realWeapons = actor.items.filter(item => 
      item.type === 'arma' && 
      item.system.equipped && 
      !item.system.isUnarmed && // Exclude virtual unarmed attacks
      (item.system.rightHand || item.system.leftHand)
    );

    // Find secondary hand weapon (leftHand only, NOT ambidextrous)
    const secondaryWeapon = realWeapons.find(weapon => 
      weapon.system.leftHand && !weapon.system.rightHand
    );
    
    return secondaryWeapon || null;
  }

  /**
   * Check ammunition and consume it for ranged weapons
   * @param {Actor} actor - The actor
   * @param {Item} weapon - The weapon item
   * @returns {Promise<boolean>} True if attack can proceed, false if no ammunition
   * @protected
   */
  static async _checkAndConsumeAmmunition(actor, weapon) {
    // Skip ammunition check for melee weapons or unarmed attacks
    if (!weapon || !weapon.system.ranged || weapon.system.isUnarmed) {
      return true;
    }

    const loadedAmmoTypes = weapon.system.loadedAmmoTypes || {};
    const hasAnyAmmunition = Object.values(loadedAmmoTypes).some(amount => amount > 0);
    
    if (!hasAnyAmmunition) {
      ui.notifications.warn(game.i18n.localize("CARDIGAN.NoAmmunition") || "Sem munição disponível!");
      return false;
    }

    // Find ammunition to consume using the same logic as _onAttackWithWeapon
    const allAmmunitionItems = actor.items.filter(i => i.type === "item-municao");
    const filteredAmmunitionItems = allAmmunitionItems.filter(ammoItem => {
      if (weapon.system.isFirearm) {
        return ammoItem.system.isFirearmAmmo === true;
      } else {
        return ammoItem.system.isFirearmAmmo === false;
      }
    });
    
    let consumedAmmoType = null;
    let consumedAmmoItem = null;
    
    // Phase 1: Look for normal ammunition (isSpecialAmmo: false) first
    for (const ammoItem of filteredAmmunitionItems) {
      const ammoId = ammoItem.id;
      const ammoAmount = loadedAmmoTypes[ammoId] || 0;
      const isSpecial = ammoItem.system.isSpecialAmmo || false;
      
      if (!isSpecial && ammoAmount > 0) {
        consumedAmmoType = ammoId;
        consumedAmmoItem = ammoItem;
        break;
      }
    }
    
    // Phase 2: If no normal ammunition available, look for special ammunition
    if (!consumedAmmoType) {
      for (const ammoItem of filteredAmmunitionItems) {
        const ammoId = ammoItem.id;
        const ammoAmount = loadedAmmoTypes[ammoId] || 0;
        const isSpecial = ammoItem.system.isSpecialAmmo || false;
        
        if (isSpecial && ammoAmount > 0) {
          consumedAmmoType = ammoId;
          consumedAmmoItem = ammoItem;
          break;
        }
      }
    }

    if (consumedAmmoType) {
      // Reduce the specific ammunition type by 1
      const updatedLoadedAmmoTypes = { ...loadedAmmoTypes };
      updatedLoadedAmmoTypes[consumedAmmoType] = Math.max(0, updatedLoadedAmmoTypes[consumedAmmoType] - 1);
      
      
      // Calculate new total
      const newLoaded = Object.values(updatedLoadedAmmoTypes).reduce((sum, amount) => sum + amount, 0);
      
      await weapon.update({
        'system.loadedAmmo': newLoaded,
        'system.loadedAmmoTypes': updatedLoadedAmmoTypes
      });
      
      return true;
    }

    // This shouldn't happen if hasAnyAmmunition was true, but just in case
    ui.notifications.warn(game.i18n.localize("CARDIGAN.NoAmmunition") || "Sem munição disponível!");
    return false;
  }

  /**
   * Perform an attack roll with ammunition check for primary weapon
   * @param {string} actorId - The actor ID
   * @param {Function} rollCallback - Function to execute the actual roll (receives actor, advantageType, and rollWithCriticals function)
   * @returns {Promise<void>}
   * @protected
   */
  static async _performPrimaryAttack(actorId, rollCallback) {
    try {
      const actor = this.getActor(actorId);
      if (!actor) return;

      // Get the primary weapon for ammunition check
      const primaryWeapon = this._getPrimaryWeapon(actor);
      
      // Check ammunition for ranged weapons before showing dialog
      if (primaryWeapon && primaryWeapon.system.ranged) {
        const canAttack = await this._checkAndConsumeAmmunition(actor, primaryWeapon);
        if (!canAttack) return; // Stop attack if no ammunition
      }

      // Import here to avoid circular dependencies
      const { AdvantageSelectionDialog } = await import('../applications/advantage-selection-dialog.mjs');
      
      // Show advantage selection dialog
      const advantageType = await AdvantageSelectionDialog.show();
      if (!advantageType) return; // User cancelled

      // Check for Congelado effect and get penalty
      const { CongeladoEffect } = await import('../effects/effects/congelado.mjs');
      const congeladoPenalty = CongeladoEffect.getSkillPenalty(actor);

      // Helper function to roll with critical detection
      const rollWithCriticals = async (formula, rollData, flavorText) => {
        // Apply Congelado penalty to formula if present
        let finalFormula = formula;
        let finalFlavor = flavorText;
        if (congeladoPenalty !== 0) {
          finalFormula += ` ${congeladoPenalty}`;
          finalFlavor += ` [Congelado ${congeladoPenalty}]`;
        }
        
        const roll = new Roll(finalFormula, rollData);
        await roll.evaluate();

        // Detect critical results using accuracy logic (like weapon attacks)
        const flags = this._detectCriticalResults(roll, actor, 'accuracy');

        // Show notification for critical results (only for the user who rolled)
        if (flags?.cardigan?.criticalHit) {
          const critThreshold = actor.system?.details?.criticalHit;
          if (critThreshold) {
            ui.notifications.info(`Acerto Crítico! (${roll.total} >= ${critThreshold})`);
          } else {
            ui.notifications.info(`Acerto Crítico!`);
          }
        } else if (flags?.cardigan?.criticalFailure) {
          ui.notifications.warn(`Erro Crítico!`);
        }

        // Send roll to chat with critical detection
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: finalFlavor,
          rollMode: game.settings.get('core', 'rollMode'),
          flags: flags
        });

        return { roll, flags };
      };

      // Execute the roll callback with the critical-enabled roll function
      await rollCallback(actor, advantageType, rollWithCriticals);

    } catch (error) {
      console.error(`Error performing primary attack for ${this.skillName}:`, error);
    }
  }

  /**
   * Perform an attack roll with ammunition check for secondary weapon
   * @param {string} actorId - The actor ID
   * @param {Function} rollCallback - Function to execute the actual roll (receives actor, advantageType, and rollWithCriticals function)
   * @returns {Promise<void>}
   * @protected
   */
  static async _performSecondaryAttack(actorId, rollCallback) {
    try {
      const actor = this.getActor(actorId);
      if (!actor) return;

      // Get the secondary weapon for ammunition check
      const secondaryWeapon = this._getSecondaryWeapon(actor);
      
      // Check ammunition for ranged weapons before showing dialog
      if (secondaryWeapon && secondaryWeapon.system.ranged) {
        const canAttack = await this._checkAndConsumeAmmunition(actor, secondaryWeapon);
        if (!canAttack) return; // Stop attack if no ammunition
      }

      // Import here to avoid circular dependencies
      const { AdvantageSelectionDialog } = await import('../applications/advantage-selection-dialog.mjs');
      
      // Show advantage selection dialog
      const advantageType = await AdvantageSelectionDialog.show();
      if (!advantageType) return; // User cancelled

      // Check for Congelado effect and get penalty
      const { CongeladoEffect } = await import('../effects/effects/congelado.mjs');
      const congeladoPenalty = CongeladoEffect.getSkillPenalty(actor);

      // Helper function to roll with critical detection
      const rollWithCriticals = async (formula, rollData, flavorText) => {
        // Apply Congelado penalty to formula if present
        let finalFormula = formula;
        let finalFlavor = flavorText;
        if (congeladoPenalty !== 0) {
          finalFormula += ` ${congeladoPenalty}`;
          finalFlavor += ` [Congelado ${congeladoPenalty}]`;
        }
        
        const roll = new Roll(finalFormula, rollData);
        await roll.evaluate();

        // Detect critical results using accuracy logic (like weapon attacks)
        const flags = this._detectCriticalResults(roll, actor, 'accuracy');

        // Show notification for critical results (only for the user who rolled)
        if (flags?.cardigan?.criticalHit) {
          const critThreshold = actor.system?.details?.criticalHit;
          if (critThreshold) {
            ui.notifications.info(`Acerto Crítico! (${roll.total} >= ${critThreshold})`);
          } else {
            ui.notifications.info(`Acerto Crítico!`);
          }
        } else if (flags?.cardigan?.criticalFailure) {
          ui.notifications.warn(`Erro Crítico!`);
        }

        // Send roll to chat with critical detection
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: finalFlavor,
          rollMode: game.settings.get('core', 'rollMode'),
          flags: flags
        });

        return { roll, flags };
      };

      // Execute the roll callback with the critical-enabled roll function
      await rollCallback(actor, advantageType, rollWithCriticals);

    } catch (error) {
      console.error(`Error performing secondary attack for ${this.skillName}:`, error);
    }
  }

  /**
   * Detect critical results for skill rolls (imported from actor-sheet logic)
   * @param {Roll} roll - The roll to analyze
   * @param {Actor} actor - The actor making the roll
   * @param {string} abilityKey - The ability being rolled (e.g., 'accuracy')
   * @returns {Object} Flags object for Foundry chat coloring
   * @protected
   */
  static _detectCriticalResults(roll, actor = null, abilityKey = null) {
    if (!roll || !roll.dice || roll.dice.length === 0) return {};

    try {
      // Evaluate the roll if not already evaluated
      if (!roll._evaluated) {
        roll.evaluate({ async: false });
      }

      const flags = {};
      
      // Check for critical failure (total ≤ 1 or natural 1)
      if (roll.total <= 1) {
        flags.criticalFailure = true;
        return { cardigan: flags };
      }

      // Check for natural 1 on d20
      // Only check ACTIVE dice (not discarded by advantage/disadvantage)
      const d20Die = roll.dice.find(die => die.faces === 20);
      if (d20Die && d20Die.results && d20Die.results.length > 0) {
        const hasNaturalOne = d20Die.results.some(result => 
          result?.active !== false && result?.result === 1
        );
        if (hasNaturalOne) {
          flags.criticalFailure = true;
          return { cardigan: flags };
        }
      }

      // Check for critical hit - different logic for accuracy vs other rolls
      // Only check ACTIVE dice (not discarded by advantage/disadvantage)
      if (d20Die && d20Die.results && d20Die.results.length > 0) {
        // For accuracy rolls, use actor's criticalHit threshold
        if (abilityKey === 'accuracy' && actor && actor.system?.details?.criticalHit) {
          const criticalThreshold = actor.system.details.criticalHit;
          // Check if any active die result is 20 or higher for natural critical
          const hasNaturalCritical = d20Die.results.some(result => 
            result?.active !== false && result?.result === 20
          );
          if (roll.total >= criticalThreshold || hasNaturalCritical) {
            flags.criticalHit = true;
            return { cardigan: flags };
          }
        }
        // For all other rolls, critical hit when total is 20 or higher OR natural 20
        else {
          const hasNaturalTwenty = d20Die.results.some(result => 
            result?.active !== false && result?.result === 20
          );
          if (roll.total >= 20 || hasNaturalTwenty) {
            flags.criticalHit = true;
            return { cardigan: flags };
          }
        }
      }

      return {};

    } catch (error) {
      console.warn(`Error detecting critical results for ${this.skillName}:`, error);
      return {};
    }
  }

  /**
   * Generate HTML tooltip for weapon (public method for dynamic tooltips)
   * @param {string} actorId - The actor ID
   * @returns {string} HTML tooltip content
   */
  static _generateWeaponTooltipHTML(actorId) {
    try {
      const actor = this.getActor(actorId);
      if (!actor) return this._createTooltipHTML("Sem Arma", "—", "Nenhuma arma equipada");

      const primaryWeapon = this._getPrimaryWeapon(actor);
      if (!primaryWeapon) {
        return this._formatUnarmedTooltipHTML(actor);
      }

      return this._formatWeaponTooltipHTML(primaryWeapon, actor);
    } catch (error) {
      console.error("Error generating weapon tooltip HTML:", error);
      return this._createTooltipHTML("Erro", "—", "Erro ao carregar informações");
    }
  }

  /**
   * Generate HTML tooltip for secondary weapon (public method for dynamic tooltips)
   * @param {string} actorId - The actor ID
   * @returns {string} HTML tooltip content
   */
  static _generateSecondaryWeaponTooltipHTML(actorId) {
    try {
      const actor = this.getActor(actorId);
      if (!actor) return this._createTooltipHTML("Sem Arma", "—", "Nenhuma arma equipada");

      const secondaryWeapon = this._getSecondaryWeapon(actor);
      if (!secondaryWeapon) {
        return this._formatUnarmedTooltipHTML(actor);
      }

      return this._formatWeaponTooltipHTML(secondaryWeapon, actor);
    } catch (error) {
      console.error("Error generating secondary weapon tooltip HTML:", error);
      return this._createTooltipHTML("Erro", "—", "Erro ao carregar informações");
    }
  }

  /**
   * Format weapon tooltip as HTML
   * @param {Item} weapon - The weapon item
   * @param {Actor} actor - The actor
   * @returns {string} Formatted HTML tooltip
   * @protected
   */
  static _formatWeaponTooltipHTML(weapon, actor) {
    const weaponName = weapon.name;
    const damageTotal = weapon.system.damage.total || "0";
    const damageBreakdown = this._calculateDamageBreakdown(weapon, actor);
    
    let subtitle = "";
    
    // Determine weapon type and create subtitle
    if (weapon.system.isFirearm && weapon.system.ranged) {
      const currentAmmo = weapon.system.loadedAmmo || 0;
      const maxAmmo = weapon.system.magazine || 0;
      subtitle = `[${currentAmmo}/${maxAmmo}] Munição`;
    } else if (weapon.system.ranged && !weapon.system.melee) {
      const currentAmmo = weapon.system.loadedAmmo || 0;
      subtitle = `[${currentAmmo}] Munição`;
    } else {
      subtitle = weapon.system.melee ? "Corpo a Corpo" : "Arma";
    }
    
    return this._createTooltipHTML(weaponName, damageTotal, damageBreakdown, subtitle);
  }

  /**
   * Format unarmed attack tooltip as HTML
   * @param {Actor} actor - The actor
   * @returns {string} Formatted HTML tooltip
   * @protected
   */
  static _formatUnarmedTooltipHTML(actor) {
    const strengthValue = actor.system.abilities?.strength?.value || 0;
    const strengthTotalBonus = actor.system.abilities?.strength?.totalBonus || 0;
    const totalStrength = strengthValue + strengthTotalBonus;
    const unarmedDamage = totalStrength > 0 ? totalStrength : 1;
    
    let damageBreakdown;
    if (totalStrength > 0) {
      if (strengthTotalBonus > 0) {
        damageBreakdown = `${strengthValue} + ${strengthTotalBonus} (Força)`;
      } else {
        damageBreakdown = `${strengthValue} (Força)`;
      }
    } else {
      damageBreakdown = "1 (mínimo)";
    }
    
    return this._createTooltipHTML("Ataque Desarmado", String(unarmedDamage), damageBreakdown, "Corpo a Corpo");
  }

  /**
   * Calculate damage breakdown showing base + ability modifier
   * @param {Item} weapon - The weapon item
   * @param {Actor} actor - The actor
   * @returns {string} Damage breakdown text
   * @protected
   */
  static _calculateDamageBreakdown(weapon, actor) {
    const baseDamage = weapon.system.damage.value || "0";
    
    // Get ability modifier
    let abilityModifier = 0;
    let abilityName = "";
    
    if (weapon.system.damage.useStrength && actor.system.abilities?.strength) {
      abilityModifier = actor.system.abilities.strength.value || 0;
      abilityName = "Força";
    } else if (weapon.system.damage.useDexterity && actor.system.abilities?.dexterity) {
      abilityModifier = actor.system.abilities.dexterity.value || 0;  
      abilityName = "Destreza";
    }

    // Format breakdown
    if (abilityModifier > 0) {
      return `${baseDamage} + ${abilityModifier} (${abilityName})`;
    } else {
      return baseDamage;
    }
  }

  /**
   * Create HTML tooltip structure
   * @param {string} title - Tooltip title (weapon name)
   * @param {string} damage - Total damage
   * @param {string} breakdown - Damage breakdown
   * @param {string} subtitle - Optional subtitle (weapon type/ammo info)
   * @returns {string} HTML tooltip
   * @protected
   */
  static _createTooltipHTML(title, damage, breakdown, subtitle = "") {
    return `
      <div class="cardigan-attack-tooltip">
        <div class="attack-tooltip-header">
          <strong>${title}</strong>
        </div>
        ${subtitle ? `<div class="attack-tooltip-subtitle">${subtitle}</div>` : ''}
        <div class="attack-tooltip-damage">
          <span class="damage-value">${damage}</span>
        </div>
        <div class="attack-tooltip-breakdown">
          ${breakdown}
        </div>
      </div>
    `.trim();
  }

  /**
   * Initialize the skill (called during system initialization)
   * Override this method to add skill-specific initialization
   * @returns {Promise<void>}
   */
  static async initialize() {
  }
}