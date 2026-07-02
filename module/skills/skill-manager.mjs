import { BaseSkill } from './base-skill.mjs';
import { checkAndConsumeAmmunition, detectCriticalResults, performDefaultPrimaryAttack, performDefaultSecondaryAttack, performUnifiedSkillAttack } from './skill-default-attacks.mjs';
import { defaultSkillToChat, updateSkillChatMessage as updateSkillChatMessageFn, spendEnergyForUnregisteredSkill } from './skill-chat-message.mjs';
import { expandDefaultSkill, setupDefaultDynamicTooltips } from './skill-expand-ui.mjs';
import { onRenderChatMessageHTML } from './skill-chat-hooks.mjs';

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
    Hooks.on('renderChatMessageHTML', (message, html) => onRenderChatMessageHTML(message, html, this));

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
        await defaultSkillToChat(skillName, actorId, this);
      }
    } catch (error) {
      console.error(`Error handling skill to chat for ${skillName}:`, error);
      ui.notifications.error(`Erro ao mostrar skill no chat: ${error.message}`);
    }
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
        // Unified attack - hand selection via dialog checkboxes
        await performUnifiedSkillAttack(actor, skillName);
        break;
        
      case 'expand':
        // Show generic expanded content
        await expandDefaultSkill(actor, skillName, button, this);
        break;
        
      case 'energy':
        // Spend energy for unregistered skills
        await spendEnergyForUnregisteredSkill(actor, skillName, button, this);
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
   * Update an existing skill chat message with new content
   * @param {ChatMessage} chatMessage - The chat message to update
   * @param {string} skillName - The skill name
   * @param {string} actorId - The actor ID
   */
  static async updateSkillChatMessage(chatMessage, skillName, actorId) {
    await updateSkillChatMessageFn(chatMessage, skillName, actorId, this);
  }

  static async applyCustomEffectsForUnregisteredSkill(actor, skillName) {
    await this.#applyCustomEffectsForUnregisteredSkill(actor, skillName);
  }

  static async handleDefaultButtonClick(buttonType, actorId, skillName, button) {
    await this.#handleDefaultButtonClick(buttonType, actorId, skillName, button);
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

}
