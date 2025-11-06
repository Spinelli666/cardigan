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
              this.#setupDynamicTooltipsHTML(skillName, skillClass, html);
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
        
      default:
        ui.notifications.warn(`Ação não implementada: ${buttonType}`);
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
    const existingExpanded = messageElement.querySelector('.cardigan-expanded-content');
    if (existingExpanded) {
      existingExpanded.remove();
      button.innerHTML = '<i class="fas fa-chevron-down" style="margin-right: 4px;"></i>Expandir';
      return;
    }

    // Create expanded content
    const targetedTokens = Array.from(game.user.targets);
    let expandedHtml = '';

    if (targetedTokens.length === 0) {
      expandedHtml = `
        <div class="cardigan-expanded-content" style="
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
    } else {
      const tokensHtml = targetedTokens.map(token => {
        const tokenActor = token.actor;
        if (!tokenActor) return '';
        const tokenImg = token.document.texture.src || tokenActor.img || 'icons/svg/mystery-man.svg';
        return `<img src="${tokenImg}" alt="${tokenActor.name}" title="${tokenActor.name}"
                 style="width: 32px; height: 32px; border-radius: 50%; margin: 4px; border: 2px solid #4caf50; cursor: pointer;">`;
      }).filter(html => html !== '').join('');

      expandedHtml = `
        <div class="cardigan-expanded-content" style="
          background: rgba(76, 175, 80, 0.1); 
          border-left: 4px solid #4caf50; 
          padding: 12px; 
          margin: 8px 0; 
          border-radius: 6px;
          text-align: center;
        ">
          <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
            <i class="fas fa-crosshairs" style="color: #4caf50; margin-right: 6px;"></i>
            <strong style="color: #4caf50;">Tokens Alvo:</strong>
          </div>
          <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center;">
            ${tokensHtml}
          </div>
        </div>
      `;
    }

    // Insert expanded content after the button container
    const buttonContainer = button.closest('div[style*="display: flex"]') || button.parentElement;
    buttonContainer.insertAdjacentHTML('afterend', expandedHtml);
    button.innerHTML = '<i class="fas fa-chevron-up" style="margin-right: 4px;"></i>Recolher';
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
    
    // Remove existing listeners to avoid duplicates
    button.removeEventListener('mouseenter', button._defaultTooltipEnterHandler);
    button.removeEventListener('mouseleave', button._defaultTooltipLeaveHandler);
    
    // Add hover event listeners
    button._defaultTooltipEnterHandler = async (event) => {
      const isSecondary = buttonType === 'attack-simple';
      const tooltipText = this.#setupDefaultWeaponTooltip(button, actorId, isSecondary);
      event.target.setAttribute('title', tooltipText);
    };

    button._defaultTooltipLeaveHandler = (event) => {
      // Keep the tooltip for user experience
    };
    
    button.addEventListener('mouseenter', button._defaultTooltipEnterHandler);
    button.addEventListener('mouseleave', button._defaultTooltipLeaveHandler);
  }
}
