import { BaseSkill } from './base-skill.mjs';

/**
 * Skill Manager - Orchestrates all skill-related functionality
 * Handles registration, event listeners, and coordination between skills
 */
export class SkillManager {
  
  /**
   * Registry of all available skills
   * @type {Map<string, BaseSkill>}
   */
  static #skillRegistry = new Map();

  /**
   * Initialize the skill system
   * @returns {Promise<void>}
   */
  static async initialize() {
    
    // Initialize all registered skills
    for (const [skillName, skillClass] of this.#skillRegistry) {
      try {
        await skillClass.initialize();
      } catch (error) {
        console.error(`Failed to initialize skill ${skillName}:`, error);
      }
    }

    // Set up the chat message hook to handle skill buttons
    Hooks.on('renderChatMessageHTML', this.#onRenderChatMessageHTML.bind(this));

  }

  /**
   * Register a skill class with the manager
   * @param {BaseSkill} skillClass - The skill class to register
   */
  static registerSkill(skillClass) {
    try {
      const skillName = skillClass.skillName;
      if (!skillName) {
        throw new Error("Skill class must implement skillName getter");
      }

      if (this.#skillRegistry.has(skillName)) {
        console.warn(`Skill ${skillName} is already registered, overwriting...`);
      }

      this.#skillRegistry.set(skillName, skillClass);
    } catch (error) {
      console.error("Error registering skill:", error);
    }
  }

  /**
   * Get a registered skill by name
   * @param {string} skillName - Name of the skill
   * @returns {BaseSkill|null} The skill class or null if not found
   */
  static getSkill(skillName) {
    return this.#skillRegistry.get(skillName) || null;
  }

  /**
   * Get all registered skills
   * @returns {Map<string, BaseSkill>}
   */
  static getAllSkills() {
    return new Map(this.#skillRegistry);
  }

  /**
   * Check if a skill is registered
   * @param {string} skillName - Name of the skill
   * @returns {boolean}
   */
  static hasSkill(skillName) {
    return this.#skillRegistry.has(skillName);
  }

  /**
   * Generate chat buttons for a specific skill
   * @param {string} skillName - Name of the skill
   * @param {string} actorId - The actor ID
   * @returns {string} HTML string for buttons
   */
  static generateSkillButtons(skillName, actorId) {
    const skillClass = this.getSkill(skillName);
    if (!skillClass) {
      console.warn(`Skill not found: ${skillName}`);
      return '';
    }

    if (!skillClass.hasInteractiveButtons) {
      return '';
    }

    try {
      return skillClass.generateChatButtons(actorId);
    } catch (error) {
      console.error(`Error generating buttons for skill ${skillName}:`, error);
      return '';
    }
  }



  /**
   * Setup dynamic tooltip handlers for buttons that need real-time updates (HTML version)
   * @param {string} skillName - Name of the skill
   * @param {BaseSkill} skillClass - The skill class
   * @param {HTMLElement} html - The chat HTML element
   * @private
   */
  static #setupDynamicTooltipsHTML(skillName, skillClass, html) {
    const tooltipButtons = html.querySelectorAll('.cardigan-dynamic-tooltip');

    tooltipButtons.forEach(button => {
      // Remove any existing tooltip
      button.removeAttribute('title');
      button.removeAttribute('data-tooltip');
      
      // Remove existing listeners to avoid duplicates
      button.removeEventListener('mouseenter', button._tooltipEnterHandler);
      button.removeEventListener('mouseleave', button._tooltipLeaveHandler);
      
      let customTooltip = null;
      
      // Add hover event listeners for custom HTML tooltips
      button._tooltipEnterHandler = async (event) => {
        const actorId = event.target.getAttribute('data-actor-id');
        const buttonSkillName = event.target.getAttribute('data-skill');
        
        if (actorId && buttonSkillName === skillName) {
          try {
            let tooltipHTML;
            
            // Check if this is a secondary attack button
            if (event.target.classList.contains('cardigan-skill-attack-secondary-btn')) {
              if (typeof skillClass._generateSecondaryWeaponTooltipHTML === 'function') {
                tooltipHTML = await skillClass._generateSecondaryWeaponTooltipHTML(actorId);
              } else if (typeof skillClass._generateSecondaryWeaponTooltip === 'function') {
                // Fallback to text tooltip
                const tooltipText = await skillClass._generateSecondaryWeaponTooltip(actorId);
                event.target.setAttribute('title', tooltipText);
                return;
              } else {
                return;
              }
            } else if (typeof skillClass._generateWeaponTooltipHTML === 'function') {
              tooltipHTML = await skillClass._generateWeaponTooltipHTML(actorId);
            } else if (typeof skillClass._generateWeaponTooltip === 'function') {
              // Fallback to text tooltip
              const tooltipText = await skillClass._generateWeaponTooltip(actorId);
              event.target.setAttribute('title', tooltipText);
              return;
            } else {
              return;
            }
            
            // Create custom tooltip element
            customTooltip = document.createElement('div');
            customTooltip.className = 'cardigan-custom-tooltip';
            customTooltip.innerHTML = tooltipHTML;
            customTooltip.style.position = 'fixed';
            customTooltip.style.zIndex = '10000';
            customTooltip.style.pointerEvents = 'none';
            
            document.body.appendChild(customTooltip);
            
            // Position tooltip above button
            const rect = event.target.getBoundingClientRect();
            const tooltipRect = customTooltip.getBoundingClientRect();
            
            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            let top = rect.top - tooltipRect.height - 10;
            
            // Keep tooltip within viewport
            if (left < 5) left = 5;
            if (left + tooltipRect.width > window.innerWidth - 5) {
              left = window.innerWidth - tooltipRect.width - 5;
            }
            if (top < 5) {
              top = rect.bottom + 10; // Show below if no space above
            }
            
            customTooltip.style.left = `${left}px`;
            customTooltip.style.top = `${top}px`;
            
            // Store tooltip reference for cleanup
            button._customTooltip = customTooltip;
            
          } catch (error) {
            console.error('Error generating dynamic tooltip:', error);
            event.target.setAttribute('title', 'Erro ao carregar tooltip');
          }
        }
      };

      button._tooltipLeaveHandler = (event) => {
        // Remove custom tooltip
        if (button._customTooltip) {
          button._customTooltip.remove();
          button._customTooltip = null;
        }
      };
      
      button.addEventListener('mouseenter', button._tooltipEnterHandler);
      button.addEventListener('mouseleave', button._tooltipLeaveHandler);
    });
  }

  /**
   * Setup dynamic tooltip handlers for buttons that need real-time updates
   * @param {HTMLElement} html - The chat HTML element
   * @private
   */
  static #setupDynamicTooltips(html) {
    const tooltipButtons = html.querySelectorAll('.cardigan-dynamic-tooltip');

    tooltipButtons.forEach(button => {
      // Remove any existing tooltip
      button.removeAttribute('title');
      button.removeAttribute('data-tooltip');
      
      let customTooltip = null;
      
      // Add hover event listeners
      button.addEventListener('mouseenter', async (event) => {
        const actorId = event.target.getAttribute('data-actor-id');
        const skillName = event.target.getAttribute('data-skill');
        
        if (actorId && skillName) {
          const skillClass = this.getSkill(skillName) || BaseSkill;
          
          try {
            let tooltipHTML;
            
            // Check if this is a secondary attack button
            if (event.target.classList.contains('cardigan-skill-attack-secondary-btn')) {
              if (typeof skillClass._generateSecondaryWeaponTooltipHTML === 'function') {
                tooltipHTML = await skillClass._generateSecondaryWeaponTooltipHTML(actorId);
              } else if (typeof skillClass._generateSecondaryWeaponTooltip === 'function') {
                // Fallback to text tooltip
                const tooltipText = await skillClass._generateSecondaryWeaponTooltip(actorId);
                event.target.setAttribute('title', tooltipText);
                return;
              } else {
                return;
              }
            } else if (typeof skillClass._generateWeaponTooltipHTML === 'function') {
              tooltipHTML = await skillClass._generateWeaponTooltipHTML(actorId);
            } else if (typeof skillClass._generateWeaponTooltip === 'function') {
              // Fallback to text tooltip
              const tooltipText = await skillClass._generateWeaponTooltip(actorId);
              event.target.setAttribute('title', tooltipText);
              return;
            } else {
              return;
            }
            
            // Create custom tooltip element
            customTooltip = document.createElement('div');
            customTooltip.className = 'cardigan-custom-tooltip';
            customTooltip.innerHTML = tooltipHTML;
            customTooltip.style.position = 'fixed';
            customTooltip.style.zIndex = '10000';
            customTooltip.style.pointerEvents = 'none';
            
            document.body.appendChild(customTooltip);
            
            // Position tooltip above button
            const rect = event.target.getBoundingClientRect();
            const tooltipRect = customTooltip.getBoundingClientRect();
            
            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            let top = rect.top - tooltipRect.height - 10;
            
            // Keep tooltip within viewport
            if (left < 5) left = 5;
            if (left + tooltipRect.width > window.innerWidth - 5) {
              left = window.innerWidth - tooltipRect.width - 5;
            }
            if (top < 5) {
              top = rect.bottom + 10; // Show below if no space above
            }
            
            customTooltip.style.left = `${left}px`;
            customTooltip.style.top = `${top}px`;
            
            // Store tooltip reference for cleanup
            button._customTooltip = customTooltip;
            
          } catch (error) {
            console.error('Error generating dynamic tooltip:', error);
            event.target.setAttribute('title', 'Erro ao carregar tooltip');
          }
        }
      });

      // Clear tooltip on mouse leave
      button.addEventListener('mouseleave', (event) => {
        // Remove custom tooltip
        if (button._customTooltip) {
          button._customTooltip.remove();
          button._customTooltip = null;
        }
      });
    });
  }



  /**
   * Handle chat message rendering to set up event listeners for skill buttons
   * @param {ChatMessage} message - The chat message being rendered
   * @param {HTMLElement} html - The HTML content of the message
   * @private
   */
  static #onRenderChatMessageHTML(message, html) {
    // Look for skill buttons in the rendered message (including apply effects button)
    const skillButtons = html.querySelectorAll('[class*="cardigan-skill-"], .cardigan-apply-effects-btn');
    
    if (skillButtons.length > 0) {
      // Set up event listeners for each skill button
      skillButtons.forEach((button) => {
        const skillName = button.dataset.skill;
        const actorId = button.dataset.actorId;
        
        if (skillName && actorId) {
          const skillClass = this.getSkill(skillName);
          
          // Determine button type from class
          let buttonType = 'unknown';
          if (button.classList.contains('cardigan-skill-attack-btn')) buttonType = 'attack';
          else if (button.classList.contains('cardigan-skill-attack-simple-btn')) buttonType = 'attack-simple';
          else if (button.classList.contains('cardigan-skill-attack-secondary-btn')) buttonType = 'attack-secondary';
          else if (button.classList.contains('cardigan-skill-energy-btn')) buttonType = 'energy';
          else if (button.classList.contains('cardigan-skill-d6-btn')) buttonType = 'd6';
          else if (button.classList.contains('cardigan-skill-expand-btn')) buttonType = 'expand';
          else if (button.classList.contains('cardigan-apply-effects-btn')) buttonType = 'apply-effects';
          else if (button.classList.contains('cardigan-skill-apply-effects-btn')) buttonType = 'apply-effects';
          
          if (skillClass) {
            // Skill is registered - use its handler
            // Remove any existing listeners to avoid duplicates
            button.removeEventListener('click', button._skillManagerHandler);
            
            // Add click handler
            button._skillManagerHandler = async (event) => {
              event.preventDefault();
              try {
                await skillClass.handleButtonClick(buttonType, actorId, button);
              } catch (error) {
                console.error(`Error handling ${buttonType} button click for ${skillName}:`, error);
                ui.notifications.error(`Erro ao executar ação da skill: ${error.message}`);
              }
            };
            
            button.addEventListener('click', button._skillManagerHandler);
            
            // Set up dynamic tooltips for attack buttons
            if (buttonType === 'attack' || buttonType === 'attack-secondary') {
              this.#setupDynamicTooltipsHTML(skillName, skillClass || BaseSkill, html);
            }
          } else {
            // Skill not registered - use default handlers
            button.removeEventListener('click', button._defaultSkillHandler);
            
            button._defaultSkillHandler = async (event) => {
              event.preventDefault();
              try {
                await this.#handleDefaultButtonClick(buttonType, actorId, skillName, button);
              } catch (error) {
                console.error(`Error handling ${buttonType} button click for ${skillName}:`, error);
                ui.notifications.error(`Erro ao executar ação: ${error.message}`);
              }
            };
            
            button.addEventListener('click', button._defaultSkillHandler);
            
            // Set up default tooltips for attack buttons
            if (buttonType === 'attack' || buttonType === 'attack-simple') {
              // Setup dynamic tooltips with mouseenter events
              this.#setupDefaultDynamicTooltips(button, actorId, buttonType);
            }
          }
        }
      });
    }
    
    // Set up enhancement emoji tooltips
    this.#setupEnhancementTooltips(html);
  }

  /**
   * Set up tooltips for enhancement emojis
   * @param {HTMLElement} html - The HTML content of the message
   * @private
   */
  static async #setupEnhancementTooltips(html) {
    const enhancementEmojis = html.querySelectorAll('.enhancement-emoji[data-enhancement]');
    
    for (const emoji of enhancementEmojis) {
      try {
        const enhancementData = JSON.parse(emoji.dataset.enhancement);
        
        // Enrich the description HTML with UUIDs and other content
        const enrichedDescription = await foundry.applications.ux.TextEditor.enrichHTML(
          enhancementData.description,
          {
            secrets: false,
            async: true,
            relativeTo: await fromUuid(enhancementData.actorUuid)
          }
        );
        
        // Create the tooltip content
        const tooltipContent = `
          <div class="enhancement-tooltip">
            <div class="enhancement-header">
              <strong>${enhancementData.name}</strong>
              <span class="enhancement-status ${enhancementData.acquired ? 'acquired' : 'not-acquired'}">${enhancementData.status}</span>
            </div>
            <div class="enhancement-description">
              ${enrichedDescription}
            </div>
          </div>
        `;
        
        // Set the tooltip using Foundry's tooltip system
        emoji.dataset.tooltip = tooltipContent;
        emoji.dataset.tooltipClass = 'cardigan-enhancement-tooltip';
        
        // Activate tooltip manually for this element
        game.tooltip.activate(emoji, {
          text: tooltipContent,
          cssClass: 'cardigan-enhancement-tooltip',
          direction: 'UP'
        });
      } catch (error) {
        console.error('Error setting up enhancement tooltip:', error);
      }
    }
  }

  /**
   * Get button selectors for a specific skill
   * @param {string} skillName - Name of the skill
   * @returns {Array<{selector: string, buttonType: string}>}
   * @private
   */
  static #getButtonSelectorsForSkill(skillName) {
    // Use only specific selectors to avoid duplicate event listeners
    return [
      { selector: `.cardigan-skill-attack-secondary-btn[data-skill="${skillName}"]`, buttonType: 'attack-secondary' },
      { selector: `.cardigan-skill-attack-btn[data-skill="${skillName}"]`, buttonType: 'attack' },
      { selector: `.cardigan-skill-energy-btn[data-skill="${skillName}"]`, buttonType: 'energy' },
      { selector: `.cardigan-skill-d6-btn[data-skill="${skillName}"]`, buttonType: 'd6' },
      { selector: `.cardigan-skill-expand-btn[data-skill="${skillName}"]`, buttonType: 'expand' },
      { selector: `.cardigan-skill-apply-effects-btn[data-skill="${skillName}"]`, buttonType: 'apply-effects' },
      { selector: `.cardigan-apply-effects-btn`, buttonType: 'apply-effects' }
    ];
  }

  /**
   * Handle skill-to-chat functionality
   * @param {string} skillName - Name of the skill
   * @param {string} actorId - The actor ID
   * @returns {Promise<void>}
   */
  static async handleSkillToChat(skillName, actorId) {
    try {
      
      const skillClass = this.getSkill(skillName);
      if (skillClass && typeof skillClass.handleSkillToChat === 'function') {
        await skillClass.handleSkillToChat(actorId);
      } else {
        // Default behavior - just show skill description
        await this.#defaultSkillToChat(skillName, actorId);
      }
    } catch (error) {
      console.error(`Error handling skill to chat for ${skillName}:`, error);
      ui.notifications.error(`Erro ao mostrar skill no chat: ${error.message}`);
    }
  }

  /**
   * Default skill-to-chat behavior
   * @param {string} skillName - Name of the skill
   * @param {string} actorId - The actor ID
   * @private
   */
  static async #defaultSkillToChat(skillName, actorId) {
    console.log(`[SkillManager] Default skill to chat: ${skillName}`, { actorId });
    
    const actor = game.actors.get(actorId);
    if (!actor) {
      ui.notifications.error("Ator não encontrado");
      return;
    }

    const skill = actor.items.find(item => item.type === 'skill' && item.name === skillName);
    if (!skill) {
      ui.notifications.error("Skill não encontrada");
      return;
    }

    console.log(`[SkillManager] Skill data:`, {
      name: skill.name,
      type: skill.system.skillType,
      hasEnergyCost: skill.system.hasEnergyCost,
      energyCost: skill.system.energyCost
    });

    let content = `<div class="cardigan-skill-message" style="text-align: center; padding: 8px; background: rgba(76,175,80,0.1); border: 1px solid #4caf50; border-radius: 3px;">
      <h4 style="margin: 0 0 8px 0; color: #4caf50;">
        <i class="fas fa-star" style="margin-right: 6px;"></i>${skill.name}
      </h4>`;

    // Add skill type badge if available (same style as Acerto Debilitante)
    if (skill.system.skillType) {
      let skillTypeText = skill.system.skillType;
      
      // Convert known types to display names
      const typeMap = {
        'passive': 'PASSIVE',
        'active': 'ACTIVE',
        'reaction': 'REACTION',
        'extra': 'EXTRA',
        'bonus': 'BONUS',
        'free': 'FREE'
      };
      
      skillTypeText = typeMap[skillTypeText.toLowerCase()] || skillTypeText.toUpperCase();
      
      content += `<div style="margin: 4px 0; color: #666; font-style: italic; font-size: 0.9em; text-align: center;">
        ${skillTypeText}
      </div>`;
    }

    // Add energy button if skill has energy cost
    if (skill.system.hasEnergyCost) {
      const energyCost = skill.system.effectiveEnergyCost ?? (skill.system.energyCost || 0);
      if (energyCost > 0) {
        content += `<div style="margin: 8px 0; text-align: center;">
          <button class="cardigan-skill-energy-btn" data-actor-id="${actorId}" data-skill="${skillName}"
                  style="padding: 6px 12px; background: #2196f3; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
            <i class="fas fa-bolt" style="margin-right: 4px;"></i>Gastar Energia (-${energyCost})
          </button>
        </div>`;
      }
    }

    content += `<div style="text-align: left; margin: 8px 0; color: #333;">
        ${skill.system.description || 'Sem descrição disponível.'}
      </div>`;

    // Add enhancement emojis - try skill class first, fallback to default
    const skillClass = this.getSkill(skillName);
    let emojisAdded = false;
    
    if (skillClass && typeof skillClass.generateEnhancementEmojis === 'function') {
      const emojis = skillClass.generateEnhancementEmojis(actorId);
      if (emojis) {
        content += emojis;
        emojisAdded = true;
      }
    }
    
    // If no skill class, generate default enhancement emojis for all skills
    if (!emojisAdded && skill.system.enhancements && Array.isArray(skill.system.enhancements)) {
      const enhancementEmojis = ['⚔️', '🎯', '💀'];
      let emojisHtml = '';
      
      for (let i = 0; i < 3; i++) {
        const enhancement = skill.system.enhancements[i];
        const isAcquired = skill.system.acquiredEnhancements?.[i] === true;
        const hasContent = enhancement?.description?.trim();
        
        if (hasContent) {
          const filterStyle = isAcquired ? '' : 'filter: grayscale(100%); opacity: 0.4;';
          const emoji = enhancementEmojis[i] || '⭐';
          const enhancementName = enhancement.name || `Aprimoramento ${i + 1}`;
          const statusText = isAcquired ? '✓ Adquirido' : '✗ Não Adquirido';
          
          // Create enhancement data for tooltip (same as BaseSkill)
          const enhancementData = {
            name: enhancementName,
            description: enhancement.description,
            status: statusText,
            acquired: isAcquired,
            actorUuid: actor.uuid,
            skillName: skill.name,
            index: i
          };
          
          emojisHtml += `<span 
            class="enhancement-emoji" 
            style="font-size: 24px; margin: 0 8px; cursor: help; ${filterStyle}" 
            data-enhancement='${JSON.stringify(enhancementData).replace(/'/g, "&apos;")}'
            data-tooltip-direction="UP"
          >${emoji}</span>`;
        }
      }
      
      if (emojisHtml) {
        content += `<div style="margin: 12px 0; text-align: center; padding: 8px; background: rgba(0,0,0,0.03); border-radius: 4px;">
          ${emojisHtml}
        </div>`;
      }
    }

    // Add interactive buttons if available
    const buttons = this.generateSkillButtons(skillName, actorId);
    if (buttons) {
      content += buttons;
    } else {
      // Add default attack buttons for all skills (same style as Acerto Debilitante)
      content += `<div style="text-align: center; margin: 12px 0; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; align-items: center;">
        <button class="cardigan-skill-attack-simple-btn cardigan-dynamic-tooltip" data-actor-id="${actorId}" data-skill="${skillName}"
                style="display: inline-block; padding: 8px 16px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
          <i class="fas fa-dice-d20" style="margin-right: 4px;"></i>Ataque S
        </button>
        <button class="cardigan-skill-attack-btn cardigan-dynamic-tooltip" data-actor-id="${actorId}" data-skill="${skillName}"
                style="display: inline-block; padding: 8px 16px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
          <i class="fas fa-dice-d20" style="margin-right: 4px;"></i>Ataque
        </button>
        <button class="cardigan-skill-expand-btn" data-actor-id="${actorId}" data-skill="${skillName}"
                style="display: inline-block; padding: 4px 12px; background: #9e9e9e; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
          <i class="fas fa-chevron-down" style="margin-right: 4px;"></i>Expandir
        </button>
      </div>`;
    }

    content += `</div>`;

    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor }),
      style: CONST.CHAT_MESSAGE_STYLES.OTHER
    });
  }

  /**
   * Get statistics about registered skills
   * @returns {Object}
   */
  static getStats() {
    const skills = Array.from(this.#skillRegistry.values());
    return {
      totalSkills: skills.length,
      interactiveSkills: skills.filter(skill => skill.hasInteractiveButtons).length,
      skillNames: Array.from(this.#skillRegistry.keys())
    };
  }

  /**
   * Handle default button clicks for unregistered skills
   * @param {string} buttonType - Type of button clicked
   * @param {string} actorId - The actor ID
   * @param {string} skillName - The skill name
   * @param {HTMLElement} button - The button element
   * @private
   */
  static async #handleDefaultButtonClick(buttonType, actorId, skillName, button) {
    const actor = game.actors.get(actorId);
    if (!actor) {
      ui.notifications.error("Ator não encontrado");
      return;
    }

    switch (buttonType) {
      case 'attack':
        // Primary hand attack
        await this.#performDefaultPrimaryAttack(actor, skillName);
        break;
        
      case 'attack-simple':
        // Secondary hand attack
        await this.#performDefaultSecondaryAttack(actor, skillName);
        break;
        
      case 'expand':
        // Show generic expanded content
        await this.#expandDefaultSkill(actor, skillName, button);
        break;
        
      case 'energy':
        // Spend energy for unregistered skills
        await this.#spendEnergyForUnregisteredSkill(actor, skillName);
        break;
        
      case 'apply-effects':
        // Apply custom effects for unregistered skills
        await this.#applyCustomEffectsForUnregisteredSkill(actor, skillName);
        break;
        
      default:
        ui.notifications.warn(`Ação não implementada: ${buttonType}`);
    }
  }

  /**
   * Spend energy for unregistered skills (generic implementation)
   * @param {Actor} actor - The actor
   * @param {string} skillName - The skill name
   * @private
   */
  static async #spendEnergyForUnregisteredSkill(actor, skillName) {
    try {
      // Get the skill item from the actor
      const skill = actor.items.find(item => item.type === 'skill' && item.name === skillName);
      if (!skill) {
        ui.notifications.error("Skill não encontrada no personagem");
        return;
      }

      // Check if the skill has energy cost configured
      if (!skill.system.hasEnergyCost) {
        ui.notifications.info(`${skillName} não gasta energia`);
        return;
      }

      // Use effective energy cost (considers active enhancements)
      const energyCost = skill.system.effectiveEnergyCost ?? (skill.system.energyCost || 0);
      
      // If energy cost is 0, don't spend anything
      if (energyCost <= 0) {
        ui.notifications.info(`${skillName} não tem custo de energia configurado`);
        return;
      }

      const currentEnergy = actor.system.power.value || 0;

      // Check if has enough energy
      if (currentEnergy < energyCost) {
        ui.notifications.warn(`${actor.name} não tem energia suficiente! (Atual: ${currentEnergy}, Necessário: ${energyCost})`);
        
        // Still show message in chat informing about the attempt
        const content = `<div class="cardigan-skill-message" style="text-align: center; padding: 8px; background: rgba(255,193,7,0.1); border: 1px solid #ffc107; border-radius: 3px;">
          <h4 style="margin: 0 0 4px 0; color: #ffc107;">
            <i class="fas fa-exclamation-triangle" style="margin-right: 6px;"></i>${skillName}
          </h4>
          <p style="margin: 4px 0; color: #666;">
            <strong>${actor.name}</strong> tentou usar <strong>${skillName}</strong> mas não tem energia suficiente!
          </p>
          <div style="margin: 8px 0; padding: 8px; background: rgba(255,193,7,0.2); border-radius: 3px;">
            Energia atual: <strong>${currentEnergy}</strong> | Necessário: <strong>${energyCost}</strong>
          </div>
        </div>`;
        
        await ChatMessage.create({
          content,
          speaker: ChatMessage.getSpeaker({ actor }),
          style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
        return;
      }

      // Calculate new energy value
      const newEnergy = Math.max(0, currentEnergy - energyCost);

      // Update actor's power (energy) directly
      await actor.update({
        'system.power.value': newEnergy
      });

      // Create success message in chat
      const content = `<div class="cardigan-skill-message" style="text-align: center; padding: 8px; background: rgba(33,150,243,0.1); border: 1px solid #2196f3; border-radius: 3px;">
        <h4 style="margin: 0 0 4px 0; color: #2196f3;">
          <i class="fas fa-bolt" style="margin-right: 6px;"></i>${skillName}
        </h4>
        <p style="margin: 4px 0; color: #666;">
          <strong>${actor.name}</strong> gastou <strong>${energyCost}</strong> de energia para potencializar <strong>${skillName}</strong>!
        </p>
        <div style="margin: 8px 0; padding: 8px; background: rgba(33,150,243,0.2); border-radius: 3px;">
          Energia: <strong>${currentEnergy}</strong> → <strong>${newEnergy}</strong> (-${energyCost})
        </div>
      </div>`;

      await ChatMessage.create({
        content,
        speaker: ChatMessage.getSpeaker({ actor }),
        style: CONST.CHAT_MESSAGE_STYLES.OTHER
      });

      // Show notification as well
      ui.notifications.info(`${actor.name} gastou ${energyCost} de energia! (${currentEnergy} → ${newEnergy})`);

    } catch (error) {
      console.error("Error spending skill energy:", error);
      ui.notifications.error(`Erro ao gastar energia: ${error.message}`);
    }
  }

  /**
   * Apply custom effects for unregistered skills (generic implementation)
   * @param {Actor} actor - The actor
   * @param {string} skillName - The skill name
   * @private
   */
  static async #applyCustomEffectsForUnregisteredSkill(actor, skillName) {
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

      // Get the skill item
      const skill = actor.items.find(item => item.type === 'skill' && item.name === skillName);
      if (!skill) {
        ui.notifications.error("Skill não encontrada no personagem");
        return;
      }

      // Check if skill has custom effects configured
      if (!skill.system.hasCustomEffects || !skill.system.customEffects || skill.system.customEffects.length === 0) {
        ui.notifications.info(`${skillName} não tem efeitos personalizados configurados`);
        return;
      }

      // Extract effect names from customEffects
      const effectNames = skill.system.customEffects.map(effect => effect.name);

      // Import the effects dialog
      const { EffectsApplicationDialog } = await import('../applications/effects-application-dialog.mjs');

      // Open the effects application dialog with filtered effects
      await EffectsApplicationDialog.show(
        targetedTokens, 
        effectNames, 
        `${skillName} - Aplicar Efeitos`
      );

    } catch (error) {
      console.error("Erro ao abrir dialog de aplicação de efeitos:", error);
      ui.notifications.error("Erro ao abrir dialog de efeitos. Verifique o console para mais detalhes.");
    }
  }

  /**
   * Perform a default primary attack for unregistered skills
   * @param {Actor} actor - The actor
   * @param {string} skillName - The skill name
   * @private
   */
  static async #performDefaultPrimaryAttack(actor, skillName) {
    try {
      // Get all REAL weapons (not virtual unarmed attacks) that are equipped
      const realWeapons = actor.items.filter(item => 
        item.type === 'arma' && 
        item.system.equipped && 
        !item.system.isUnarmed &&
        (item.system.rightHand || item.system.leftHand)
      );

      // Check if right hand is occupied by a REAL weapon
      const primaryWeapon = realWeapons.find(weapon => weapon.system.rightHand);
      
      // Check ammunition for ranged weapons before showing dialog
      if (primaryWeapon && primaryWeapon.system.ranged) {
        const canAttack = await this.#checkAndConsumeAmmunition(actor, primaryWeapon);
        if (!canAttack) return;
      }

      // Import the advantage selection dialog
      const { AdvantageSelectionDialog } = await import('../applications/advantage-selection-dialog.mjs');
      
      // Show advantage selection dialog
      const advantageType = await AdvantageSelectionDialog.show();
      if (!advantageType) return; // User cancelled

      // Get roll data
      const rollData = actor.getRollData();
      
      let formula;
      let rollDescription = "";
      
      switch (advantageType) {
        case 'normal':
          formula = "1d20 + @accuracy.total";
          rollDescription = "Rolagem Normal";
          break;
        case 'advantage':
          formula = "2d20kh + @accuracy.total";
          rollDescription = "Rolagem com Vantagem";
          break;
        case 'disadvantage':
          formula = "2d20kl + @accuracy.total";
          rollDescription = "Rolagem com Desvantagem";
          break;
        default:
          return;
      }

      // Create flavor text
      const flavorText = `<div style="text-align: center; margin-bottom: 4px;">
        <strong>${skillName}</strong> - ${rollDescription}
      </div>`;

      // Roll with critical detection
      const roll = new Roll(formula, rollData);
      await roll.evaluate();

      // Detect critical results using accuracy logic
      const flags = this.#detectCriticalResults(roll, actor, 'accuracy');

      // Send roll to chat
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: flavorText,
        rollMode: game.settings.get('core', 'rollMode'),
        flags: flags
      });

    } catch (error) {
      console.error(`Error performing default primary attack for ${skillName}:`, error);
      ui.notifications.error(`Erro ao realizar ataque: ${error.message}`);
    }
  }

  /**
   * Perform a default secondary attack for unregistered skills
   * @param {Actor} actor - The actor
   * @param {string} skillName - The skill name
   * @private
   */
  static async #performDefaultSecondaryAttack(actor, skillName) {
    try {
      // Get all REAL weapons (not virtual unarmed attacks) that are equipped
      const realWeapons = actor.items.filter(item => 
        item.type === 'arma' && 
        item.system.equipped && 
        !item.system.isUnarmed &&
        (item.system.rightHand || item.system.leftHand)
      );

      // Find secondary hand weapon (leftHand only, NOT ambidextrous)
      const secondaryWeapon = realWeapons.find(weapon => 
        weapon.system.leftHand && !weapon.system.rightHand
      );
      
      // Check ammunition for ranged weapons before showing dialog
      if (secondaryWeapon && secondaryWeapon.system.ranged) {
        const canAttack = await this.#checkAndConsumeAmmunition(actor, secondaryWeapon);
        if (!canAttack) return;
      }

      // Import the advantage selection dialog
      const { AdvantageSelectionDialog } = await import('../applications/advantage-selection-dialog.mjs');
      
      // Show advantage selection dialog
      const advantageType = await AdvantageSelectionDialog.show();
      if (!advantageType) return; // User cancelled

      // Get roll data
      const rollData = actor.getRollData();
      
      let formula;
      let rollDescription = "";
      
      switch (advantageType) {
        case 'normal':
          formula = "1d20 + @accuracy.total";
          rollDescription = "Rolagem Normal";
          break;
        case 'advantage':
          formula = "2d20kh + @accuracy.total";
          rollDescription = "Rolagem com Vantagem";
          break;
        case 'disadvantage':
          formula = "2d20kl + @accuracy.total";
          rollDescription = "Rolagem com Desvantagem";
          break;
        default:
          return;
      }

      // Create flavor text
      const flavorText = `<div style="text-align: center; margin-bottom: 4px;">
        <strong>${skillName}</strong> (Secundário) - ${rollDescription}
      </div>`;

      // Roll with critical detection
      const roll = new Roll(formula, rollData);
      await roll.evaluate();

      // Detect critical results using accuracy logic
      const flags = this.#detectCriticalResults(roll, actor, 'accuracy');

      // Send roll to chat
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: flavorText,
        rollMode: game.settings.get('core', 'rollMode'),
        flags: flags
      });

    } catch (error) {
      console.error(`Error performing default secondary attack for ${skillName}:`, error);
      ui.notifications.error(`Erro ao realizar ataque secundário: ${error.message}`);
    }
  }

  /**
   * Check ammunition and consume it for ranged weapons
   * @param {Actor} actor - The actor
   * @param {Item} weapon - The weapon item
   * @returns {Promise<boolean>} True if attack can proceed, false if no ammunition
   * @private
   */
  static async #checkAndConsumeAmmunition(actor, weapon) {
    // Skip ammunition check for melee weapons
    if (!weapon || !weapon.system.ranged) {
      return true;
    }

    const loadedAmmoTypes = weapon.system.loadedAmmoTypes || {};
    const hasAnyAmmunition = Object.values(loadedAmmoTypes).some(amount => amount > 0);
    
    if (!hasAnyAmmunition) {
      ui.notifications.warn(`${weapon.name} não possui munição carregada!`);
      return false;
    }

    // Consume 1 ammunition
    const firstAmmoType = Object.keys(loadedAmmoTypes).find(type => loadedAmmoTypes[type] > 0);
    if (firstAmmoType) {
      const newAmount = loadedAmmoTypes[firstAmmoType] - 1;
      await weapon.update({
        [`system.loadedAmmoTypes.${firstAmmoType}`]: newAmount
      });
    }

    return true;
  }

  /**
   * Detect critical results for skill rolls
   * @param {Roll} roll - The roll to analyze
   * @param {Actor} actor - The actor
   * @param {string} attributeKey - The attribute key (e.g., 'accuracy')
   * @returns {Object} Flags object with critical information
   * @private
   */
  static #detectCriticalResults(roll, actor, attributeKey) {
    const flags = {};
    
    // Get the d20 results
    const d20Results = roll.dice.filter(d => d.faces === 20).flatMap(d => d.results.map(r => r.result));
    
    if (d20Results.length === 0) return flags;

    // Get critical thresholds from actor
    const criticalSuccess = actor.system.attributes?.[attributeKey]?.criticalSuccess || 20;
    const criticalFailure = actor.system.attributes?.[attributeKey]?.criticalFailure || 1;

    // Check for critical success
    const hasCriticalSuccess = d20Results.some(result => result >= criticalSuccess);
    if (hasCriticalSuccess) {
      flags['cardigan.criticalSuccess'] = true;
    }

    // Check for critical failure
    const hasCriticalFailure = d20Results.some(result => result <= criticalFailure);
    if (hasCriticalFailure) {
      flags['cardigan.criticalFailure'] = true;
    }

    return flags;
  }

  /**
   * Expand a default skill in chat
   * @param {Actor} actor - The actor
   * @param {string} skillName - The skill name
   * @param {HTMLElement} button - The expand button
   * @private
   */
  static async #expandDefaultSkill(actor, skillName, button) {
    const messageElement = button.closest('.message-content');
    if (!messageElement) return;

    // Check if already expanded
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
        button.innerHTML = '<i class="fas fa-chevron-down" style="margin-right: 4px;"></i>Expandir';
      } else {
        // Showing - start interval, hook, and update content
        const updateContent = () => {
          expandedContainer.innerHTML = this.#generateExpandedContentForSkill(actor, skillName);
          // Setup event listeners for apply effects button after updating content
          this.#setupApplyEffectsButtonListener(expandedContainer, actor, skillName);
        };
        
        updateContent();
        
        // Listen for token targeting changes
        if (Hooks) {
          expandedContainer._hookId = Hooks.on('targetToken', updateContent);
        }
        
        // Fallback refresh every 500ms
        expandedContainer._refreshInterval = setInterval(updateContent, 500);
        button.innerHTML = '<i class="fas fa-chevron-up" style="margin-right: 4px;"></i>Recolher';
      }
    } else {
      // Create expanded content container
      expandedContainer = document.createElement('div');
      expandedContainer.className = 'cardigan-skill-expanded-content';
      
      // Set up auto-refresh for token content
      const updateContent = () => {
        expandedContainer.innerHTML = this.#generateExpandedContentForSkill(actor, skillName);
        // Setup event listeners for apply effects button after updating content
        this.#setupApplyEffectsButtonListener(expandedContainer, actor, skillName);
      };
      
      // Initial content
      updateContent();
      
      // Listen for token targeting changes
      if (Hooks) {
        expandedContainer._hookId = Hooks.on('targetToken', updateContent);
      }
      
      // Fallback refresh every 500ms
      expandedContainer._refreshInterval = setInterval(updateContent, 500);
      
      // Insert after button container
      const buttonContainer = button.closest('div[style*="display: flex"]') || button.parentElement;
      buttonContainer.insertAdjacentElement('afterend', expandedContainer);
      button.innerHTML = '<i class="fas fa-chevron-up" style="margin-right: 4px;"></i>Recolher';
    }
  }

  /**
   * Setup event listener for apply effects button
   * @param {HTMLElement} container - The container element
   * @param {Actor} actor - The actor
   * @param {string} skillName - The skill name
   * @private
   */
  static #setupApplyEffectsButtonListener(container, actor, skillName) {
    const applyButton = container.querySelector('.cardigan-skill-apply-effects-btn');
    if (applyButton) {
      // Remove existing listener to avoid duplicates
      applyButton.removeEventListener('click', applyButton._clickHandler);
      
      // Add new listener
      applyButton._clickHandler = async (event) => {
        event.preventDefault();
        await this.#applyCustomEffectsForUnregisteredSkill(actor, skillName);
      };
      
      applyButton.addEventListener('click', applyButton._clickHandler);
    }
  }

  /**
   * Generate expanded content HTML for a skill
   * @param {Actor} actor - The actor
   * @param {string} skillName - The skill name
   * @returns {string} HTML content
   * @private
   */
  static #generateExpandedContentForSkill(actor, skillName) {
    const targetedTokens = Array.from(game.user.targets);

    if (targetedTokens.length === 0) {
      return `
        <div style="
          background: rgba(255, 193, 7, 0.1); 
          border-left: 4px solid #ffc107; 
          padding: 12px; 
          margin: 8px 0; 
          border-radius: 6px;
          text-align: center;
          color: #856404;
        ">
          <i class="fas fa-exclamation-triangle" style="margin-right: 6px;"></i>
          <strong>Nenhum token alvo selecionado</strong><br>
          <small>Use T ou Shift+T para mirar em tokens</small>
        </div>
      `;
    }

    const tokensHtml = targetedTokens.map(token => {
      const tokenActor = token.actor;
      if (!tokenActor) return '';
      const tokenImg = token.document.texture.src || tokenActor.img || 'icons/svg/mystery-man.svg';
      return `<img src="${tokenImg}" alt="${tokenActor.name}" title="${tokenActor.name}"
               style="width: 32px; height: 32px; border-radius: 50%; margin: 4px; border: 2px solid #4caf50; cursor: pointer;">`;
    }).filter(html => html !== '').join('');

    // Check if skill has custom effects to show apply button
    const skill = actor.items.find(item => item.type === 'skill' && item.name === skillName);
    const hasCustomEffects = skill && skill.system.hasCustomEffects && skill.system.customEffects && skill.system.customEffects.length > 0;

    return `
      <div style="
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
        <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; margin-bottom: ${hasCustomEffects ? '12px' : '0'};">
          ${tokensHtml}
        </div>
        ${hasCustomEffects ? `
          <div style="text-align: center;">
            <button class="cardigan-skill-apply-effects-btn" data-actor-id="${actor.id}" data-skill="${skillName}"
                    style="padding: 6px 12px; background: #9c27b0; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
              <i class="fas fa-magic" style="margin-right: 4px;"></i>Aplicar Efeitos
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Setup default weapon tooltip for unregistered skills
   * @param {HTMLElement} button - The button element
   * @param {string} actorId - The actor ID
   * @param {boolean} isSecondary - Whether this is for secondary hand (true) or primary hand (false)
   * @private
   */
  static #setupDefaultWeaponTooltip(button, actorId, isSecondary = false) {
    const actor = game.actors.get(actorId);
    if (!actor) return;

    let weapon = null;
    
    if (isSecondary) {
      // Find secondary hand weapon (leftHand only, excluding ambidextrous)
      // Get all REAL weapons (not virtual unarmed attacks) that are equipped
      const realWeapons = actor.items.filter(item => 
        item.type === 'arma' && 
        item.system.equipped && 
        !item.system.isUnarmed && // Exclude virtual unarmed attacks
        (item.system.rightHand || item.system.leftHand)
      );

      // Find secondary hand weapon (leftHand only, NOT ambidextrous)
      weapon = realWeapons.find(w => 
        w.system.leftHand && !w.system.rightHand
      );
    } else {
      // Find primary hand weapon (rightHand priority)
      // Get all REAL weapons (not virtual unarmed attacks) that are equipped
      const realWeapons = actor.items.filter(item => 
        item.type === 'arma' && 
        item.system.equipped && 
        !item.system.isUnarmed && // Exclude virtual unarmed attacks
        (item.system.rightHand || item.system.leftHand)
      );

      // Check if right hand is occupied by a REAL weapon
      weapon = realWeapons.find(w => w.system.rightHand);
      
      // If right hand is empty (unarmed), do NOT show secondary hand weapons
      // Return null to show unarmed attack instead
    }

    let tooltipText = '';
    
    if (weapon) {
      // Weapon equipped - format like Acerto Debilitante
      const weaponName = weapon.name;
      const damageTotal = weapon.system.damage?.total || "0";
      const baseDamage = weapon.system.damage?.value || "0";
      
      // Calculate ability modifier
      let abilityModifier = 0;
      let abilityName = "";
      
      if (weapon.system.damage?.useStrength && actor.system.abilities?.strength) {
        abilityModifier = actor.system.abilities.strength.value || 0;
        abilityName = "Força";
      } else if (weapon.system.damage?.useDexterity && actor.system.abilities?.dexterity) {
        abilityModifier = actor.system.abilities.dexterity.value || 0;
        abilityName = "Destreza";
      }
      
      // Format damage breakdown
      let damageBreakdown;
      if (abilityModifier > 0) {
        damageBreakdown = `${baseDamage} + ${abilityModifier}(${abilityName})`;
      } else {
        damageBreakdown = baseDamage;
      }
      
      // Format tooltip based on weapon type
      if (weapon.system.isFirearm && weapon.system.ranged) {
        // Firearm: Nome - [current/max]
        const currentAmmo = weapon.system.loadedAmmo || 0;
        const maxAmmo = weapon.system.magazine || 0;
        tooltipText = `${weaponName} - [${currentAmmo}/${maxAmmo}]\n${damageTotal}\n(${damageBreakdown})`;
      } else if (weapon.system.ranged && !weapon.system.melee) {
        // Ranged (non-firearm): Nome - [current]
        const currentAmmo = weapon.system.loadedAmmo || 0;
        tooltipText = `${weaponName} - [${currentAmmo}]\n${damageTotal}\n(${damageBreakdown})`;
      } else {
        // Melee: Nome
        tooltipText = `${weaponName}\n${damageTotal}\n(${damageBreakdown})`;
      }
    } else {
      // Unarmed attack - format like Acerto Debilitante
      const strengthValue = actor.system.abilities?.strength?.value || 0;
      const strengthTotalBonus = actor.system.abilities?.strength?.totalBonus || 0;
      const totalStrength = strengthValue + strengthTotalBonus;
      
      // Apply same minimum damage rule
      const unarmedDamage = totalStrength > 0 ? totalStrength : 1;
      
      // Format breakdown
      let damageBreakdown;
      if (totalStrength > 0) {
        if (strengthTotalBonus > 0) {
          damageBreakdown = `${strengthValue} + ${strengthTotalBonus}(Força)`;
        } else {
          damageBreakdown = `${strengthValue}(Força)`;
        }
      } else {
        damageBreakdown = "1 (mínimo)";
      }
      
      tooltipText = `Ataque Desarmado\n${unarmedDamage}\n(${damageBreakdown})`;
    }

    return tooltipText;
  }

  /**
   * Setup dynamic tooltips with mouseenter events for default skills
   * @param {HTMLElement} button - The button element
   * @param {string} actorId - The actor ID
   * @param {string} buttonType - Type of button (attack or attack-simple)
   * @private
   */
  static #setupDefaultDynamicTooltips(button, actorId, buttonType) {
    // Remove any existing tooltip
    button.removeAttribute('title');
    button.removeAttribute('data-tooltip');
    
    // Remove existing listeners to avoid duplicates
    button.removeEventListener('mouseenter', button._defaultTooltipEnterHandler);
    button.removeEventListener('mouseleave', button._defaultTooltipLeaveHandler);
    
    let customTooltip = null;
    
    // Add hover event listeners for HTML tooltips
    button._defaultTooltipEnterHandler = async (event) => {
      try {
        const isSecondary = buttonType === 'attack-simple';
        let tooltipHTML;
        
        // Use BaseSkill methods for HTML tooltips
        if (isSecondary && typeof BaseSkill._generateSecondaryWeaponTooltipHTML === 'function') {
          tooltipHTML = await BaseSkill._generateSecondaryWeaponTooltipHTML(actorId);
        } else if (typeof BaseSkill._generateWeaponTooltipHTML === 'function') {
          tooltipHTML = await BaseSkill._generateWeaponTooltipHTML(actorId);
        } else {
          // Fallback to text tooltip
          const tooltipText = this.#setupDefaultWeaponTooltip(button, actorId, isSecondary);
          event.target.setAttribute('title', tooltipText);
          return;
        }
        
        // Create custom tooltip element
        customTooltip = document.createElement('div');
        customTooltip.className = 'cardigan-custom-tooltip';
        customTooltip.innerHTML = tooltipHTML;
        customTooltip.style.position = 'fixed';
        customTooltip.style.zIndex = '10000';
        customTooltip.style.pointerEvents = 'none';
        
        document.body.appendChild(customTooltip);
        
        // Position tooltip above button
        const rect = event.target.getBoundingClientRect();
        const tooltipRect = customTooltip.getBoundingClientRect();
        
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.top - tooltipRect.height - 10;
        
        // Keep tooltip within viewport
        if (left < 5) left = 5;
        if (left + tooltipRect.width > window.innerWidth - 5) {
          left = window.innerWidth - tooltipRect.width - 5;
        }
        if (top < 5) {
          top = rect.bottom + 10; // Show below if no space above
        }
        
        customTooltip.style.left = `${left}px`;
        customTooltip.style.top = `${top}px`;
        
        // Store tooltip reference for cleanup
        button._customTooltip = customTooltip;
        
      } catch (error) {
        console.error('Error generating default tooltip:', error);
        const tooltipText = this.#setupDefaultWeaponTooltip(button, actorId, buttonType === 'attack-simple');
        event.target.setAttribute('title', tooltipText);
      }
    };

    button._defaultTooltipLeaveHandler = (event) => {
      // Remove custom tooltip
      if (button._customTooltip) {
        button._customTooltip.remove();
        button._customTooltip = null;
      }
    };
    
    button.addEventListener('mouseenter', button._defaultTooltipEnterHandler);
    button.addEventListener('mouseleave', button._defaultTooltipLeaveHandler);
  }
}
