import { BaseSkill } from './base-skill.mjs';
import { buildRollFormula } from '../helpers/config.mjs';

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
   * Check if a skill has any effects to apply (base effects OR active enhancement effects)
   * @param {Item} skill - The skill item
   * @returns {boolean} True if skill has effects to apply
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
        emoji.dataset.tooltipDirection = 'UP';
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
      actionTypes: skill.system.skillActionTypes,
      hasEnergyCost: skill.system.hasEnergyCost,
      energyCost: skill.system.energyCost
    });

    let content = `<div class="cardigan-skill-message" style="text-align: center; padding: 8px; background: rgba(76,175,80,0.1); border: 1px solid #4caf50; border-radius: 3px;">
      <h4 style="margin: 0 0 8px 0; color: #4caf50;">
        <i class="fas fa-star" style="margin-right: 6px;"></i>${skill.name}
      </h4>`;

    // Add skill action types badge if available
    if (skill.system.skillActionTypes && Array.isArray(skill.system.skillActionTypes) && skill.system.skillActionTypes.length > 0) {
      // Format action types with | separator
      const formattedTypes = skill.system.skillActionTypes
        .map(type => {
          const localizationKey = CONFIG.CARDIGAN?.skillTypes?.[type] || type;
          return game.i18n.localize(localizationKey);
        })
        .join(' | ');
      
      content += `<div style="margin: 4px 0; color: #666; font-style: italic; font-size: 0.9em; text-align: center;">
        ${formattedTypes}
      </div>`;
    }

    // Add energy button if skill has energy cost
    if (skill.system.hasEnergyCost) {
      const energyCost = skill.system.effectiveEnergyCost ?? (skill.system.energyCost || 0);
      if (energyCost > 0) {
        const energySpent = skill.system.energySpent || false;
        const buttonColor = energySpent ? '#4caf50' : '#2196f3'; // Green if spent (can recover), blue if not spent
        const buttonIcon = energySpent ? 'fa-redo' : 'fa-bolt';
        const buttonText = energySpent ? `Recuperar Energia (+${energyCost})` : `Gastar Energia (-${energyCost})`;
        
        content += `<div style="margin: 8px 0; text-align: center;">
          <button class="cardigan-skill-energy-btn" data-actor-id="${actorId}" data-skill="${skillName}"
                  style="padding: 6px 12px; background: ${buttonColor}; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
            <i class="fas ${buttonIcon}" style="margin-right: 4px;"></i>${buttonText}
          </button>
        </div>`;
      }
    }

    // Add spell categories display if skill is Feiticeiro and has categories
    if (skill.system.skillClass === 'feiticeiro' && skill.system.spellCategories && Array.isArray(skill.system.spellCategories) && skill.system.spellCategories.length > 0) {
      const categoryImages = {
        'neutro': 'systems/cardigan/assets/images/others/neutral-spell.webp',
        'feerico': 'systems/cardigan/assets/images/bestiary/fae-creatures.webp',
        'caos': 'systems/cardigan/assets/images/bestiary/indivisible-chaos.webp',
        'necromancia': 'systems/cardigan/assets/images/bestiary/necromancy.webp'
      };
      
      let categoriesHtml = '<div class="spell-categories-display-chat" style="display: flex; align-items: center; justify-content: center; gap: 10px; margin: 12px 0; padding: 12px 20px; background: rgba(147, 112, 219, 0.1); border: 2px solid rgba(147, 112, 219, 0.3); border-radius: 8px;">';
      
      skill.system.spellCategories.forEach((category, index) => {
        const imagePath = categoryImages[category];
        if (imagePath) {
          const categoryLabel = game.i18n.localize(`CARDIGAN.SpellCategory.${category.charAt(0).toUpperCase() + category.slice(1)}`) || category;
          categoriesHtml += `<img src="${imagePath}" 
            alt="${categoryLabel}" 
            title="${categoryLabel}"
            class="spell-category-image" 
            style="width: 30px; height: 38px; object-fit: contain; border-radius: 4px; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));" />`;
          
          // Add separator if not the last category
          if (index < skill.system.spellCategories.length - 1) {
            categoriesHtml += '<span style="font-size: 36px; color: #9370db; line-height: 1; user-select: none; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);">⬩</span>';
          }
        }
      });
      
      categoriesHtml += '</div>';
      content += categoriesHtml;
    }

    // Add toggle button for description
    const randomId = foundry.utils.randomID();
    content += `
      <div style="text-align: center; margin: 8px 0;">
        <button 
          class="toggle-skill-description" 
          data-target="skill-desc-${randomId}"
          style="padding: 4px 12px; background: rgba(76, 175, 80, 0.2); color: #4caf50; border: 1px solid #4caf50; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s;"
          onmouseover="this.style.background='rgba(76, 175, 80, 0.3)'"
          onmouseout="this.style.background='rgba(76, 175, 80, 0.2)'"
        >
          <i class="fas fa-eye"></i> Mostrar Descrição
        </button>
      </div>
      <div id="skill-desc-${randomId}" style="display: none; text-align: left; margin: 8px 0; padding: 8px; color: #333; background: rgba(0,0,0,0.03); border-radius: 4px; border-left: 3px solid #4caf50;">
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
      // Check if skill has custom effects to show expand button (base or active enhancements)
      const skill = actor.items.find(item => item.type === 'skill' && item.name === skillName);
      const hasCustomEffects = this.hasAnyEffects(skill);
      
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
        ${hasCustomEffects ? `<button class="cardigan-skill-expand-btn" data-actor-id="${actorId}" data-skill="${skillName}"
                style="display: inline-block; padding: 4px 12px; background: #9e9e9e; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
          <i class="fas fa-chevron-down" style="margin-right: 4px;"></i>Expandir
        </button>` : ''}
      </div>`;
    }

    content += `</div>`;

    const chatMessage = await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor }),
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      flags: {
        cardigan: {
          skillName: skillName,
          actorId: actorId,
          isSkillMessage: true,
          energySpent: false // Each message starts with energy NOT spent
        }
      }
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
        await this.#spendEnergyForUnregisteredSkill(actor, skillName, button);
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
   * Spend energy for unregistered skills (generic implementation with toggle)
   * @param {Actor} actor - The actor
   * @param {string} skillName - The skill name
   * @param {HTMLElement} button - The button that was clicked
   * @private
   */
  static async #spendEnergyForUnregisteredSkill(actor, skillName, button) {
    try {
      // Get the chat message from the button
      const messageElement = button.closest('.message');
      if (!messageElement) {
        console.error("Could not find message element");
        return;
      }
      
      const messageId = messageElement.dataset.messageId;
      const chatMessage = game.messages.get(messageId);
      if (!chatMessage) {
        console.error("Could not find chat message");
        return;
      }
      
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
      const maxEnergy = actor.system.power.max || 0;
      
      // Check if energy was already spent (toggle mode) - USE MESSAGE STATE
      const energySpent = chatMessage.getFlag('cardigan', 'energySpent') || false;

      if (energySpent) {
        // RECOVER ENERGY - Toggle back
        const newEnergy = Math.min(maxEnergy, currentEnergy + energyCost);

        // Update actor's power (energy)
        await actor.update({
          'system.power.value': newEnergy
        });
        
        // Update message state
        await chatMessage.setFlag('cardigan', 'energySpent', false);

        // Show notification
        ui.notifications.info(`${actor.name} recuperou ${energyCost} de energia! (${currentEnergy} → ${newEnergy})`);
        
        // Update the existing chat message with new state
        await this.updateSkillChatMessage(chatMessage, skillName, actor.id);

      } else {
        // SPEND ENERGY - First time or after recovery
        
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

        // Update actor's power (energy)
        await actor.update({
          'system.power.value': newEnergy
        });
        
        // Update message state
        await chatMessage.setFlag('cardigan', 'energySpent', true);

        // Show notification
        ui.notifications.info(`${actor.name} gastou ${energyCost} de energia! (${currentEnergy} → ${newEnergy})`);
        
        // Update the existing chat message with new state
        await this.updateSkillChatMessage(chatMessage, skillName, actor.id);
      }

    } catch (error) {
      console.error("Error spending skill energy:", error);
      ui.notifications.error(`Erro ao gastar energia: ${error.message}`);
    }
  }

  /**
   * Update an existing skill chat message with new content
   * @param {ChatMessage} chatMessage - The chat message to update
   * @param {string} skillName - The skill name
   * @param {string} actorId - The actor ID
   */
  static async updateSkillChatMessage(chatMessage, skillName, actorId) {
    try {
      const actor = game.actors.get(actorId);
      if (!actor) return;

      const skill = actor.items.find(item => item.type === 'skill' && item.name === skillName);
      if (!skill) return;

      // Regenerate the skill content with updated button state
      let content = `<div class="cardigan-skill-message" style="text-align: center; padding: 8px; background: rgba(76,175,80,0.1); border: 1px solid #4caf50; border-radius: 3px;">
        <h4 style="margin: 0 0 8px 0; color: #4caf50;">
          <i class="fas fa-star" style="margin-right: 6px;"></i>${skill.name}
        </h4>`;

      // Add skill action types badge if available
      if (skill.system.skillActionTypes && Array.isArray(skill.system.skillActionTypes) && skill.system.skillActionTypes.length > 0) {
        const formattedTypes = skill.system.skillActionTypes
          .map(type => {
            const localizationKey = CONFIG.CARDIGAN?.skillTypes?.[type] || type;
            return game.i18n.localize(localizationKey);
          })
          .join(' | ');
        
        content += `<div style="margin: 4px 0; color: #666; font-style: italic; font-size: 0.9em; text-align: center;">
          ${formattedTypes}
        </div>`;
      }

      // Add energy button if skill has energy cost - WITH UPDATED STATE FROM MESSAGE
      if (skill.system.hasEnergyCost) {
        const energyCost = skill.system.effectiveEnergyCost ?? (skill.system.energyCost || 0);
        if (energyCost > 0) {
          const energySpent = chatMessage.getFlag('cardigan', 'energySpent') || false;
          const buttonColor = energySpent ? '#4caf50' : '#2196f3';
          const buttonIcon = energySpent ? 'fa-redo' : 'fa-bolt';
          const buttonText = energySpent ? `Recuperar Energia (+${energyCost})` : `Gastar Energia (-${energyCost})`;
          
          content += `<div style="margin: 8px 0; text-align: center;">
            <button class="cardigan-skill-energy-btn" data-actor-id="${actorId}" data-skill="${skillName}"
                    style="padding: 6px 12px; background: ${buttonColor}; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
              <i class="fas ${buttonIcon}" style="margin-right: 4px;"></i>${buttonText}
            </button>
          </div>`;
        }
      }

      content += `<div style="text-align: left; margin: 8px 0; color: #333;">
          ${skill.system.description || 'Sem descrição disponível.'}
        </div>`;

      // Add enhancement emojis if available
      const enhancementEmojis = ['⚔️', '🎯', '💀'];
      let emojisHtml = '';
      
      if (skill.system.enhancements && Array.isArray(skill.system.enhancements)) {
        for (let i = 0; i < skill.system.enhancements.length; i++) {
          const enhancement = skill.system.enhancements[i];
          const isAcquired = skill.system.acquiredEnhancements?.[i] === true;
          const hasContent = enhancement?.description?.trim();
          
          if (hasContent) {
            const filterStyle = isAcquired ? '' : 'filter: grayscale(100%); opacity: 0.4;';
            const emoji = enhancementEmojis[i] || '⭐';
            const enhancementName = enhancement.name || `Aprimoramento ${i + 1}`;
            const statusText = isAcquired ? '✓ Adquirido' : '✗ Não Adquirido';
            
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

      // Add interactive buttons
      const buttons = this.generateSkillButtons(skillName, actorId);
      if (buttons) {
        content += buttons;
      } else {
        const hasCustomEffects = this.hasAnyEffects(skill);
        
        content += `<div style="text-align: center; margin: 12px 0; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; align-items: center;">
          <button class="cardigan-skill-attack-simple-btn cardigan-dynamic-tooltip" data-actor-id="${actorId}" data-skill="${skillName}"
                  style="display: inline-block; padding: 8px 16px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
            <i class="fas fa-dice-d20" style="margin-right: 4px;"></i>Ataque S
          </button>
          <button class="cardigan-skill-attack-btn cardigan-dynamic-tooltip" data-actor-id="${actorId}" data-skill="${skillName}"
                  style="display: inline-block; padding: 8px 16px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
            <i class="fas fa-dice-d20" style="margin-right: 4px;"></i>Ataque
          </button>
          ${hasCustomEffects ? `<button class="cardigan-skill-expand-btn" data-actor-id="${actorId}" data-skill="${skillName}"
                  style="display: inline-block; padding: 4px 12px; background: #9e9e9e; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
            <i class="fas fa-chevron-down" style="margin-right: 4px;"></i>Expandir
          </button>` : ''}
        </div>`;
      }

      content += `</div>`;

      // Update the chat message content
      await chatMessage.update({ content });

    } catch (error) {
      console.error("Error updating skill chat message:", error);
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
        ui.notifications.info(`${skillName} não tem efeitos personalizados configurados`);
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
      // Validate target selection
      const selectedTargets = game.user.targets;
      if (selectedTargets.size === 0) {
        ui.notifications.warn("Por favor, selecione um ou mais alvos para atacar.");
        return;
      }

      // Get all REAL weapons (not virtual unarmed attacks) that are equipped
      const realWeapons = actor.items.filter(item => 
        item.type === 'arma' && 
        item.system.equipped && 
        !item.system.isUnarmed &&
        (item.system.rightHand || item.system.leftHand)
      );

      // Check if right hand is occupied by a REAL weapon
      const primaryWeapon = realWeapons.find(weapon => weapon.system.rightHand);
      
      // Calculate weapon damage (base damage + ability modifiers)
      let weaponDamage = 0;
      if (primaryWeapon) {
        const baseDamage = parseInt(primaryWeapon.system.damage?.value) || 0;
        weaponDamage = baseDamage;
        
        // Add ability modifiers
        if (primaryWeapon.system.damage?.useStrength) {
          weaponDamage += actor.system.abilities.strength.value || 0;
        }
        if (primaryWeapon.system.damage?.useDexterity) {
          weaponDamage += actor.system.abilities.dexterity.value || 0;
        }
      } else {
        // No weapon equipped - calculate unarmed attack damage
        const strengthValue = actor.system.abilities.strength.value || 0;
        const strengthBonus = actor.system.abilities.strength.totalBonus || 0;
        const totalStrength = strengthValue + strengthBonus;
        weaponDamage = totalStrength > 0 ? totalStrength : 1; // Minimum 1 damage
      }
      
      // Check ammunition for ranged weapons before showing dialog
      if (primaryWeapon && primaryWeapon.system.ranged) {
        const canAttack = await this.#checkAndConsumeAmmunition(actor, primaryWeapon);
        if (!canAttack) return;
      }

      // Import the advantage selection dialog
      const { AdvantageSelectionDialog } = await import('../applications/advantage-selection-dialog.mjs');
      
      // Show advantage selection dialog
      const result = await AdvantageSelectionDialog.show();
      if (!result) return; // User cancelled

      const { rollType, attackMode } = result;

      // Get roll data
      const rollData = actor.getRollData();
      
      const formula = buildRollFormula(rollType, "@accuracy.total");
      let rollDescription = "";
      
      switch (rollType) {
        case 'advantage':
          rollDescription = "Rolagem com Vantagem";
          break;
        case 'disadvantage':
          rollDescription = "Rolagem com Desvantagem";
          break;
        case 'enhanced-advantage':
          rollDescription = "Rolagem com Vantagem Aprimorada";
          break;
        case 'enhanced-disadvantage':
          rollDescription = "Rolagem com Desvantagem Aprimorada";
          break;
        case 'normal':
          rollDescription = "Rolagem Normal";
          break;
        default:
          return;
      }

      // Check if we need to make individual attacks for each target
      const shouldRollIndividually = attackMode === 'individual' && selectedTargets.size > 1;
      
      if (shouldRollIndividually) {
        // Make individual attack for each target
        const targetArray = Array.from(selectedTargets);
        
        // Show notification about multiple attacks
        ui.notifications.info(`Realizando ${targetArray.length} ataques individuais...`);
        
        for (let i = 0; i < targetArray.length; i++) {
          const targetToken = targetArray[i];
          
          // Add small delay between attacks for visual clarity
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          // Add attack mode and target name to description
          let individualRollDescription = `${rollDescription} (Individual) → ${targetToken.name}`;
          
          // Check for Congelado effect and apply skill penalty
          const { CongeladoEffect } = await import('../effects/effects/congelado.mjs');
          const congeladoPenalty = CongeladoEffect.getSkillPenalty(actor);
          
          // Apply Congelado penalty to formula if present
          if (congeladoPenalty !== 0) {
            formula += ` ${congeladoPenalty}`;
            individualRollDescription += ` [Congelado ${congeladoPenalty}]`;
          }
          
          // Create flavor text
          const flavorText = `<div style="text-align: center; margin-bottom: 4px;">
            <strong>${skillName}</strong> - ${individualRollDescription}
          </div>`;
          
          // Roll with critical detection
          const roll = new Roll(formula, rollData);
          await roll.evaluate();
          
          // Apply Sangramento effect for accuracy rolls
          const { SangramentoEffect } = await import('../effects/effects/sangramento.mjs');
          await SangramentoEffect.applyBleedingDamage(actor, 'Precisão', 'accuracy');
          
          // Detect critical results using accuracy logic
          const flags = this.#detectCriticalResults(roll, actor, 'accuracy');
          
          // Calculate final damage (double on critical hit)
          const isCriticalHit = flags?.cardigan?.criticalHit || false;
          const finalDamage = isCriticalHit ? weaponDamage * 2 : weaponDamage;
          
          // Show notification for critical results (only for the user who rolled)
          if (flags?.cardigan?.criticalHit) {
            const critThreshold = actor.system?.details?.criticalHit;
            if (critThreshold) {
              ui.notifications.info(`Acerto Crítico! (${roll.total} >= ${critThreshold})`);
            } else {
              ui.notifications.info(`Acerto Crítico!`);
            }
          } else if (flags?.cardigan?.criticalFailure) {
            // Check if weapon will lose durability
            if (primaryWeapon && primaryWeapon.system.durability) {
              const currentDurability = primaryWeapon.system.durability.current;
              if (currentDurability > 0) {
                const newDurability = Math.max(0, currentDurability - 1);
                ui.notifications.warn(`Erro Crítico! ${primaryWeapon.name} perdeu durabilidade (${currentDurability} → ${newDurability})`);
              } else {
                ui.notifications.warn(`Erro Crítico!`);
              }
            } else {
              ui.notifications.warn(`Erro Crítico!`);
            }
          }
          
          // Handle critical failure - reduce weapon durability
          const isCriticalFailure = flags.cardigan?.criticalFailure || false;
          if (isCriticalFailure && primaryWeapon && primaryWeapon.system.durability) {
            const currentDurability = primaryWeapon.system.durability.current;
            if (currentDurability > 0) {
              const newDurability = Math.max(0, currentDurability - 1);
              await primaryWeapon.update({
                'system.durability.current': newDurability
              });
            }
          }
          
          // Add single target data to flags
          if (targetToken.actor) {
            flags.cardigan = flags.cardigan || {};
            flags.cardigan.attackTargets = {
              targets: [{
                tokenId: targetToken.id,
                actorId: targetToken.actor.id,
                name: targetToken.name
              }],
              attackerId: actor.id,
              attackerName: actor.name,
              skillName: skillName,
              weaponId: primaryWeapon?._id || primaryWeapon?.id,
              weaponName: primaryWeapon?.name,
              weaponProperties: primaryWeapon?.system?.properties || [],
              damage: weaponDamage,  // ALWAYS use BASE damage (not doubled) in flags
              attackerCriticalHit: isCriticalHit  // Add critical hit flag
            };
          }
          
          // Determine roll mode: if current user is GM, use blind mode
          const rollMode = game.settings.get('core', 'rollMode');

          // Create message data with flags
          const messageData = {
            speaker: { alias: actor.name },
            flavor: flavorText,
            rolls: [roll],
            flags: flags
          };

          // Apply roll mode using Foundry's official API method
          ChatMessage.applyRollMode(messageData, rollMode);
          
          // Send attack roll to chat
          await ChatMessage.create(messageData);
        }
        
        return; // Exit after processing all individual attacks
      }
      
      // Single attack for all targets (conjunto mode or single target)
      const modeText = attackMode === 'conjunto' ? ' (Conjunto)' : ' (Individual)';
      rollDescription += modeText;

      // Check for Congelado effect and apply skill penalty
      const { CongeladoEffect } = await import('../effects/effects/congelado.mjs');
      const congeladoPenalty = CongeladoEffect.getSkillPenalty(actor);
      
      // Apply Congelado penalty to formula if present
      if (congeladoPenalty !== 0) {
        formula += ` ${congeladoPenalty}`;
        rollDescription += ` [Congelado ${congeladoPenalty}]`;
      }

      // Create flavor text
      const flavorText = `<div style="text-align: center; margin-bottom: 4px;">
        <strong>${skillName}</strong> - ${rollDescription}
      </div>`;

      // Roll with critical detection
      const roll = new Roll(formula, rollData);
      await roll.evaluate();
      
      // Apply Sangramento effect for accuracy rolls
      const { SangramentoEffect } = await import('../effects/effects/sangramento.mjs');
      await SangramentoEffect.applyBleedingDamage(actor, 'Precisão', 'accuracy');

      // Detect critical results using accuracy logic
      const flags = this.#detectCriticalResults(roll, actor, 'accuracy');

      // Calculate final damage (double on critical hit)
      const isCriticalHit = flags?.cardigan?.criticalHit || false;
      const finalDamage = isCriticalHit ? weaponDamage * 2 : weaponDamage;

      // Show notification for critical results (only for the user who rolled)
      if (flags?.cardigan?.criticalHit) {
        const critThreshold = actor.system?.details?.criticalHit;
        if (critThreshold) {
          ui.notifications.info(`Acerto Crítico! (${roll.total} >= ${critThreshold})`);
        } else {
          ui.notifications.info(`Acerto Crítico!`);
        }
      } else if (flags?.cardigan?.criticalFailure) {
        // Check if weapon will lose durability
        if (primaryWeapon && primaryWeapon.system.durability) {
          const currentDurability = primaryWeapon.system.durability.current;
          if (currentDurability > 0) {
            const newDurability = Math.max(0, currentDurability - 1);
            ui.notifications.warn(`Erro Crítico! ${primaryWeapon.name} perdeu durabilidade (${currentDurability} → ${newDurability})`);
          } else {
            ui.notifications.warn(`Erro Crítico!`);
          }
        } else {
          ui.notifications.warn(`Erro Crítico!`);
        }
      }

      // Handle critical failure - reduce weapon durability
      const isCriticalFailure = flags.cardigan?.criticalFailure || false;
      if (isCriticalFailure && primaryWeapon && primaryWeapon.system.durability) {
        const currentDurability = primaryWeapon.system.durability.current;
        if (currentDurability > 0) {
          const newDurability = Math.max(0, currentDurability - 1);
          await primaryWeapon.update({
            'system.durability.current': newDurability
          });
        }
      }

      // Collect target data for evasion buttons
      const attackTargets = game.user.targets;
      const targetData = [];
      attackTargets.forEach(target => {
        if (target.actor) {
          targetData.push({
            tokenId: target.id,
            actorId: target.actor.id,
            name: target.name
          });
        }
      });

      // Add target data to flags
      if (targetData.length > 0) {
        flags.cardigan = flags.cardigan || {};
        flags.cardigan.attackTargets = {
          targets: targetData,
          attackerId: actor.id,
          attackerName: actor.name,
          skillName: skillName,
          weaponId: primaryWeapon?._id || primaryWeapon?.id,
          weaponName: primaryWeapon?.name,
          weaponProperties: primaryWeapon?.system?.properties || [],
          damage: weaponDamage,  // ALWAYS use BASE damage (not doubled) in flags
          attackerCriticalHit: isCriticalHit  // Add critical hit flag
        };
      }

      // Use player's roll mode setting (GM can choose blind manually)
      const rollMode = game.settings.get('core', 'rollMode');

      // Create message data with flags
      const messageData = {
        speaker: { alias: actor.name },
        flavor: flavorText,
        rolls: [roll],
        flags: flags
      };

      // Apply roll mode using Foundry's official API method
      ChatMessage.applyRollMode(messageData, rollMode);
      
      // Send attack roll to chat
      await ChatMessage.create(messageData);

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
      // Validate target selection
      const targets = game.user.targets;
      if (targets.size === 0) {
        ui.notifications.warn("Por favor, selecione um ou mais alvos para atacar.");
        return;
      }

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
      
      // Calculate weapon damage (base damage + ability modifiers)
      let weaponDamage = 0;
      if (secondaryWeapon) {
        const baseDamage = parseInt(secondaryWeapon.system.damage?.value) || 0;
        weaponDamage = baseDamage;
        
        // Add ability modifiers
        if (secondaryWeapon.system.damage?.useStrength) {
          weaponDamage += actor.system.abilities.strength.value || 0;
        }
        if (secondaryWeapon.system.damage?.useDexterity) {
          weaponDamage += actor.system.abilities.dexterity.value || 0;
        }
      } else {
        // No weapon equipped - calculate unarmed attack damage
        const strengthValue = actor.system.abilities.strength.value || 0;
        const strengthBonus = actor.system.abilities.strength.totalBonus || 0;
        const totalStrength = strengthValue + strengthBonus;
        weaponDamage = totalStrength > 0 ? totalStrength : 1; // Minimum 1 damage
      }
      
      // Check ammunition for ranged weapons before showing dialog
      if (secondaryWeapon && secondaryWeapon.system.ranged) {
        const canAttack = await this.#checkAndConsumeAmmunition(actor, secondaryWeapon);
        if (!canAttack) return;
      }

      // Import the advantage selection dialog
      const { AdvantageSelectionDialog } = await import('../applications/advantage-selection-dialog.mjs');
      
      // Show advantage selection dialog
      const result = await AdvantageSelectionDialog.show();
      if (!result) return; // User cancelled

      const { rollType, attackMode } = result;

      // Get roll data
      const rollData = actor.getRollData();
      
      const formula = buildRollFormula(rollType, "@accuracy.total");
      let rollDescription = "";
      
      switch (rollType) {
        case 'advantage':
          rollDescription = "Rolagem com Vantagem";
          break;
        case 'disadvantage':
          rollDescription = "Rolagem com Desvantagem";
          break;
        case 'enhanced-advantage':
          rollDescription = "Rolagem com Vantagem Aprimorada";
          break;
        case 'enhanced-disadvantage':
          rollDescription = "Rolagem com Desvantagem Aprimorada";
          break;
        case 'normal':
          rollDescription = "Rolagem Normal";
          break;
        default:
          return;
      }

      // Check if we need to make individual attacks for each target
      const shouldRollIndividually = attackMode === 'individual' && targets.size > 1;
      
      if (shouldRollIndividually) {
        // Make individual attack for each target
        const targetArray = Array.from(targets);
        
        // Show notification about multiple attacks
        ui.notifications.info(`Realizando ${targetArray.length} ataques secundários individuais...`);
        
        for (let i = 0; i < targetArray.length; i++) {
          const targetToken = targetArray[i];
          
          // Add small delay between attacks for visual clarity
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          // Add attack mode and target name to description
          const individualRollDescription = `${rollDescription} (Individual) → ${targetToken.name}`;
          
          // Create flavor text
          const flavorText = `<div style="text-align: center; margin-bottom: 4px;">
            <strong>${skillName}</strong> (Secundário) - ${individualRollDescription}
          </div>`;
          
          // Roll with critical detection
          const roll = new Roll(formula, rollData);
          await roll.evaluate();
          
          // Apply Sangramento effect for accuracy rolls
          const { SangramentoEffect } = await import('../effects/effects/sangramento.mjs');
          await SangramentoEffect.applyBleedingDamage(actor, 'Precisão', 'accuracy');
          
          // Detect critical results using accuracy logic
          const flags = this.#detectCriticalResults(roll, actor, 'accuracy');
          
          // Calculate final damage (double on critical hit)
          const isCriticalHit = flags?.cardigan?.criticalHit || false;
          const finalDamage = isCriticalHit ? weaponDamage * 2 : weaponDamage;
          
          // Show notification for critical results (only for the user who rolled)
          if (flags?.cardigan?.criticalHit) {
            const critThreshold = actor.system?.details?.criticalHit;
            if (critThreshold) {
              ui.notifications.info(`Acerto Crítico! (${roll.total} >= ${critThreshold})`);
            } else {
              ui.notifications.info(`Acerto Crítico!`);
            }
          } else if (flags?.cardigan?.criticalFailure) {
            // Check if weapon will lose durability
            if (secondaryWeapon && secondaryWeapon.system.durability) {
              const currentDurability = secondaryWeapon.system.durability.current;
              if (currentDurability > 0) {
                const newDurability = Math.max(0, currentDurability - 1);
                ui.notifications.warn(`Erro Crítico! ${secondaryWeapon.name} perdeu durabilidade (${currentDurability} → ${newDurability})`);
              } else {
                ui.notifications.warn(`Erro Crítico!`);
              }
            } else {
              ui.notifications.warn(`Erro Crítico!`);
            }
          }
          
          // Handle critical failure - reduce weapon durability
          const isCriticalFailure = flags.cardigan?.criticalFailure || false;
          if (isCriticalFailure && secondaryWeapon && secondaryWeapon.system.durability) {
            const currentDurability = secondaryWeapon.system.durability.current;
            if (currentDurability > 0) {
              const newDurability = Math.max(0, currentDurability - 1);
              await secondaryWeapon.update({
                'system.durability.current': newDurability
              });
            }
          }
          
          // Add single target data to flags
          if (targetToken.actor) {
            flags.cardigan = flags.cardigan || {};
            flags.cardigan.attackTargets = {
              targets: [{
                tokenId: targetToken.id,
                actorId: targetToken.actor.id,
                name: targetToken.name
              }],
              attackerId: actor.id,
              attackerName: actor.name,
              skillName: skillName,
              weaponId: secondaryWeapon?._id || secondaryWeapon?.id,
              weaponName: secondaryWeapon?.name,
              weaponProperties: secondaryWeapon?.system?.properties || [],
              damage: weaponDamage,  // ALWAYS use BASE damage (not doubled) in flags
              attackerCriticalHit: isCriticalHit  // Add critical hit flag
            };
          }
          
          // Determine roll mode: if current user is GM, use blind mode
          const rollMode = game.settings.get('core', 'rollMode');

          // Create message data with flags
          const messageData = {
            speaker: { alias: actor.name },
            flavor: flavorText,
            rolls: [roll],
            flags: flags
          };

          // Apply roll mode using Foundry's official API method
          ChatMessage.applyRollMode(messageData, rollMode);
          
          // Send attack roll to chat
          await ChatMessage.create(messageData);
        }
        
        return; // Exit after processing all individual attacks
      }
      
      // Single attack for all targets (conjunto mode or single target)
      const modeText = attackMode === 'conjunto' ? ' (Conjunto)' : ' (Individual)';
      rollDescription += modeText;

      // Create flavor text
      const flavorText = `<div style="text-align: center; margin-bottom: 4px;">
        <strong>${skillName}</strong> (Secundário) - ${rollDescription}
      </div>`;

      // Roll with critical detection
      const roll = new Roll(formula, rollData);
      await roll.evaluate();
      
      // Apply Sangramento effect for accuracy rolls
      const { SangramentoEffect } = await import('../effects/effects/sangramento.mjs');
      await SangramentoEffect.applyBleedingDamage(actor, 'Precisão', 'accuracy');

      // Detect critical results using accuracy logic
      const flags = this.#detectCriticalResults(roll, actor, 'accuracy');

      // Calculate final damage (double on critical hit)
      const isCriticalHit = flags?.cardigan?.criticalHit || false;
      const finalDamage = isCriticalHit ? weaponDamage * 2 : weaponDamage;

      // Show notification for critical results (only for the user who rolled)
      if (flags?.cardigan?.criticalHit) {
        const critThreshold = actor.system?.details?.criticalHit;
        if (critThreshold) {
          ui.notifications.info(`Acerto Crítico! (${roll.total} >= ${critThreshold})`);
        } else {
          ui.notifications.info(`Acerto Crítico!`);
        }
      } else if (flags?.cardigan?.criticalFailure) {
        // Check if weapon will lose durability
        if (secondaryWeapon && secondaryWeapon.system.durability) {
          const currentDurability = secondaryWeapon.system.durability.current;
          if (currentDurability > 0) {
            const newDurability = Math.max(0, currentDurability - 1);
            ui.notifications.warn(`Erro Crítico! ${secondaryWeapon.name} perdeu durabilidade (${currentDurability} → ${newDurability})`);
          } else {
            ui.notifications.warn(`Erro Crítico!`);
          }
        } else {
          ui.notifications.warn(`Erro Crítico!`);
        }
      }

      // Handle critical failure - reduce weapon durability
      const isCriticalFailure = flags.cardigan?.criticalFailure || false;
      if (isCriticalFailure && secondaryWeapon && secondaryWeapon.system.durability) {
        const currentDurability = secondaryWeapon.system.durability.current;
        if (currentDurability > 0) {
          const newDurability = Math.max(0, currentDurability - 1);
          await secondaryWeapon.update({
            'system.durability.current': newDurability
          });
        }
      }

      // Collect target data for evasion buttons
      const attackTargets = game.user.targets;
      const targetData = [];
      attackTargets.forEach(target => {
        if (target.actor) {
          targetData.push({
            tokenId: target.id,
            actorId: target.actor.id,
            name: target.name
          });
        }
      });

      // Add target data to flags
      if (targetData.length > 0) {
        flags.cardigan = flags.cardigan || {};
        flags.cardigan.attackTargets = {
          targets: targetData,
          attackerId: actor.id,
          attackerName: actor.name,
          skillName: skillName,
          weaponId: secondaryWeapon?._id || secondaryWeapon?.id,
          weaponName: secondaryWeapon?.name,
          weaponProperties: secondaryWeapon?.system?.properties || [],
          damage: weaponDamage,  // ALWAYS use BASE damage (not doubled) in flags
          attackerCriticalHit: isCriticalHit  // Add critical hit flag
        };
      }

      // Use player's roll mode setting (GM can choose blind manually)
      const rollMode = game.settings.get('core', 'rollMode');

      // Create message data with flags
      const messageData = {
        speaker: { alias: actor.name },
        flavor: flavorText,
        rolls: [roll],
        flags: flags
      };

      // Apply roll mode using Foundry's official API method
      ChatMessage.applyRollMode(messageData, rollMode);
      
      // Send attack roll to chat
      await ChatMessage.create(messageData);

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
  static #detectCriticalResults(roll, actor = null, abilityKey = null) {
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
      console.warn("Error detecting critical results:", error);
      return {};
    }
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

    // Check if skill has custom effects to show apply button (base or active enhancements)
    const skill = actor.items.find(item => item.type === 'skill' && item.name === skillName);
    const hasCustomEffects = this.hasAnyEffects(skill);

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
