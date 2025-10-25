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
    console.log('[CARDIGAN] Initializing Skill Manager...');
    
    // Initialize all registered skills
    for (const [skillName, skillClass] of this.#skillRegistry) {
      try {
        await skillClass.initialize();
      } catch (error) {
        console.error(`Failed to initialize skill ${skillName}:`, error);
      }
    }

    console.log(`[CARDIGAN] Skill Manager initialized with ${this.#skillRegistry.size} skills`);
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
      console.log(`[CARDIGAN] Registered skill: ${skillName}`);
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
   * Handle chat button events
   * @param {HTMLElement} html - The chat HTML element
   */
  static handleChatButtons(html) {
    console.log("SkillManager: Setting up chat button handlers");

    // Find all skill buttons and add event listeners
    this.#skillRegistry.forEach((skillClass, skillName) => {
      if (!skillClass.hasInteractiveButtons) {
        return;
      }

      try {
        this.#setupSkillButtonListeners(html, skillClass);
      } catch (error) {
        console.error(`Error setting up button listeners for skill ${skillName}:`, error);
      }
    });
  }

  /**
   * Setup button event listeners for a specific skill
   * @param {HTMLElement} html - The chat HTML element
   * @param {BaseSkill} skillClass - The skill class
   * @private
   */
  static #setupSkillButtonListeners(html, skillClass) {
    const skillName = skillClass.skillName;
    const buttonSelectors = this.#getButtonSelectorsForSkill(skillName);

    buttonSelectors.forEach(({ selector, buttonType }) => {
      const buttons = html.querySelectorAll(selector);
      console.log(`Found ${buttons.length} ${buttonType} buttons for ${skillName}`);

      buttons.forEach((button, index) => {
        console.log(`Setting up listener for ${skillName} ${buttonType} button ${index}:`, button);
        
        button.addEventListener('click', async (event) => {
          console.log(`${skillName} ${buttonType} button clicked!`);
          const actorId = button.dataset.actorId;
          console.log(`Actor ID from ${buttonType} button:`, actorId);

          if (actorId) {
            try {
              await skillClass.handleButtonClick(buttonType, actorId);
            } catch (error) {
              console.error(`Error handling ${buttonType} button click for ${skillName}:`, error);
              ui.notifications.error(`Erro ao executar ação da skill: ${error.message}`);
            }
          }
        });
      });
    });
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
      { selector: `.cardigan-skill-attack-btn[data-skill="${skillName}"]`, buttonType: 'attack' },
      { selector: `.cardigan-skill-energy-btn[data-skill="${skillName}"]`, buttonType: 'energy' }
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
      console.log(`SkillManager: Handling skill to chat - ${skillName} for actor ${actorId}`);
      
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

    let content = `<div class="cardigan-skill-message" style="text-align: center; padding: 8px; background: rgba(76,175,80,0.1); border: 1px solid #4caf50; border-radius: 3px;">
      <h4 style="margin: 0 0 8px 0; color: #4caf50;">
        <i class="fas fa-star" style="margin-right: 6px;"></i>${skill.name}
      </h4>
      <div style="text-align: left; margin: 8px 0; color: #333;">
        ${skill.system.skillDescription || 'Sem descrição disponível.'}
      </div>`;

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