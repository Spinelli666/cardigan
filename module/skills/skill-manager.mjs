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
      
      // Remove existing listeners to avoid duplicates
      button.removeEventListener('mouseenter', button._tooltipEnterHandler);
      button.removeEventListener('mouseleave', button._tooltipLeaveHandler);
      
      // Add hover event listeners
      button._tooltipEnterHandler = async (event) => {
        const actorId = event.target.getAttribute('data-actor-id');
        const buttonSkillName = event.target.getAttribute('data-skill');
        
        if (actorId && buttonSkillName === skillName) {
          try {
            let tooltipText;
            
            // Check if this is a secondary attack button
            if (event.target.classList.contains('cardigan-skill-attack-secondary-btn')) {
              if (typeof skillClass._generateSecondaryWeaponTooltip === 'function') {
                tooltipText = await skillClass._generateSecondaryWeaponTooltip(actorId);
              } else {
                tooltipText = 'Tooltip secundário não disponível';
              }
            } else if (typeof skillClass._generateWeaponTooltip === 'function') {
              tooltipText = await skillClass._generateWeaponTooltip(actorId);
            } else {
              tooltipText = 'Tooltip não disponível';
            }
            
            event.target.setAttribute('title', tooltipText);
          } catch (error) {
            console.error('Error generating dynamic tooltip:', error);
            event.target.setAttribute('title', 'Erro ao carregar tooltip');
          }
        }
      };

      button._tooltipLeaveHandler = (event) => {
        // Keep the tooltip for user experience, but it will be refreshed on next hover
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
      
      // Add hover event listeners
      button.addEventListener('mouseenter', async (event) => {
        const actorId = event.target.getAttribute('data-actor-id');
        const skillName = event.target.getAttribute('data-skill');
        
        if (actorId && skillName) {
          const skillClass = this.getSkill(skillName);
          if (skillClass) {
            try {
              let tooltipText;
              
              // Check if this is a secondary attack button
              if (event.target.classList.contains('cardigan-skill-attack-secondary-btn')) {
                if (typeof skillClass._generateSecondaryWeaponTooltip === 'function') {
                  tooltipText = await skillClass._generateSecondaryWeaponTooltip(actorId);
                } else {
                  tooltipText = 'Tooltip secundário não disponível';
                }
              } else if (typeof skillClass._generateWeaponTooltip === 'function') {
                tooltipText = await skillClass._generateWeaponTooltip(actorId);
              } else {
                tooltipText = 'Tooltip não disponível';
              }
              
              event.target.setAttribute('title', tooltipText);
            } catch (error) {
              console.error('Error generating dynamic tooltip:', error);
              event.target.setAttribute('title', 'Erro ao carregar tooltip');
            }
          }
        }
      });

      // Optional: Clear tooltip on mouse leave to ensure fresh data next time
      button.addEventListener('mouseleave', (event) => {
        // Keep the tooltip for user experience, but it will be refreshed on next hover
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
          if (skillClass) {
            // Determine button type from class
            let buttonType = 'unknown';
            if (button.classList.contains('cardigan-skill-attack-btn')) buttonType = 'attack';
            else if (button.classList.contains('cardigan-skill-attack-secondary-btn')) buttonType = 'attack-secondary';
            else if (button.classList.contains('cardigan-skill-energy-btn')) buttonType = 'energy';
            else if (button.classList.contains('cardigan-skill-d6-btn')) buttonType = 'd6';
            else if (button.classList.contains('cardigan-skill-expand-btn')) buttonType = 'expand';
            else if (button.classList.contains('cardigan-apply-effects-btn')) buttonType = 'apply-effects';
            else if (button.classList.contains('cardigan-skill-apply-effects-btn')) buttonType = 'apply-effects';
            
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
              this.#setupDynamicTooltipsHTML(skillName, skillClass, html);
            }
          }
        }
      });
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

    // Add enhancement emojis if skill class supports it
    const skillClass = this.getSkill(skillName);
    if (skillClass && typeof skillClass.generateEnhancementEmojis === 'function') {
      const emojis = skillClass.generateEnhancementEmojis(actorId);
      if (emojis) {
        content += emojis;
      }
    }

    // Add interactive buttons if available
    const buttons = this.generateSkillButtons(skillName, actorId);
    if (buttons) {
      content += buttons;
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
}