/**
 * Base class for all skill implementations in the Cardigan system
 * Provides common functionality and structure for skill-specific logic
 */
export class BaseSkill {
  
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
      
      console.log(`${this.skillName} roll:`, {
        actor: actor.name,
        formula: roll.formula,
        result: roll.total
      });

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

      console.log(`${this.skillName} spent ${amount} ${resourceType}:`, {
        actor: actor.name,
        before: currentAmount,
        after: newAmount
      });

      return true;
    } catch (error) {
      console.error(`Error spending ${resourceType}:`, error);
      ui.notifications.error(`Erro ao gastar ${resourceType}: ${error.message}`);
      return false;
    }
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
   * Handle button clicks (should be overridden by subclasses)
   * @param {string} buttonType - Type of button clicked
   * @param {string} actorId - The actor ID
   * @returns {Promise<void>}
   */
  static async handleButtonClick(buttonType, actorId) {
    console.warn(`${this.skillName}: Button click handler not implemented for type: ${buttonType}`);
  }

  /**
   * Initialize the skill (called during system initialization)
   * Override this method to add skill-specific initialization
   * @returns {Promise<void>}
   */
  static async initialize() {
    console.log(`Initializing skill: ${this.skillName}`);
  }
}