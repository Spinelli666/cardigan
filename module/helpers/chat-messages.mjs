/**
 * Chat Message Helper
 * Centralizes custom chat message rendering for rolls
 */
export class ChatMessageHelper {
  
  /**
   * Create a custom roll chat message with actor header
   * @param {Object} options - Message options
   * @param {Actor} options.actor - The actor making the roll
   * @param {Roll} options.roll - The roll object
   * @param {string} options.label - Roll label (e.g., "Precisão", "Evasão")
   * @param {string} options.rollType - Type of roll ("normal", "advantage", "disadvantage")
   * @param {string} options.rollDescription - Description text for the roll type
   * @param {string} [options.handIndicator] - Hand indicator text ("Mão Primária", "Mão Secundária", "Desarmado")
   * @param {Array<string>} [options.modifiers] - Array of modifier texts to display
   * @param {boolean} [options.isJointRoll] - Whether this is a joint roll (Rolagem em Conjunto)
   * @param {boolean} [options.primaryHand] - Whether primary hand was selected
   * @param {boolean} [options.secondaryHand] - Whether secondary hand was selected
   * @param {Object} [options.flags] - Additional flags to attach to the message
   * @param {string} [options.rollMode] - Roll mode override (uses game setting if not provided)
   * @returns {Promise<ChatMessage>} The created chat message
   */
  static async createRollMessage({
    actor,
    roll,
    label,
    rollType = 'normal',
    rollDescription = 'Rolagem Normal',
    handIndicator = null,
    modifiers = [],
    isJointRoll = false,
    primaryHand = false,
    secondaryHand = false,
    flags = {},
    rollMode = null
  }) {
    
    // Determine hand indicator class
    let handIndicatorClass = '';
    if (handIndicator) {
      if (handIndicator === 'Mão Primária') {
        handIndicatorClass = 'primary-hand';
      } else if (handIndicator === 'Mão Secundária') {
        handIndicatorClass = 'secondary-hand';
      } else if (handIndicator === 'Desarmado') {
        handIndicatorClass = 'unarmed';
      }
    }
    
    // Render custom chat template
    const template = await foundry.applications.handlebars.getTemplate(
      'systems/cardigan/templates/chat/roll-message.hbs'
    );
    
    // Check if special action mode is active (hand selection or joint roll)
    const hasSpecialAction = primaryHand || secondaryHand || isJointRoll;
    
    // Get target names for joint roll tooltip (one per line)
    let targetNames = '';
    if (isJointRoll && game.user.targets && game.user.targets.size > 0) {
      const names = Array.from(game.user.targets).map(token => token.actor?.name || token.name);
      targetNames = names.join('<br>');
    }
    
    const content = template({
      actorImg: actor.img,
      actorName: actor.name,
      rollLabel: label,
      rollType: rollDescription,
      rollTypeClass: rollType,
      handIndicator: handIndicator,
      handIndicatorClass: handIndicatorClass,
      modifiers: modifiers.length > 0 ? modifiers : null,
      isJointRoll: isJointRoll,
      hasSpecialAction: hasSpecialAction,
      targetNames: targetNames
    });
    
    // Use provided rollMode or get from settings
    const effectiveRollMode = rollMode || game.settings.get('core', 'rollMode');
    
    // Create message data (no speaker to avoid duplication)
    const messageData = {
      content: content,
      rolls: [roll],
      flags: flags
    };
    
    // Apply roll mode using Foundry's official API method
    ChatMessage.applyRollMode(messageData, effectiveRollMode);
    
    // Create and return the chat message
    return await ChatMessage.create(messageData);
  }
  
  /**
   * Helper to get roll type description in Portuguese
   * @param {string} rollType - Roll type ("normal", "advantage", "disadvantage")
   * @returns {string} Localized description
   */
  static getRollTypeDescription(rollType) {
    const descriptions = {
      'normal': 'Rolagem Normal',
      'advantage': 'Rolagem com Vantagem',
      'disadvantage': 'Rolagem com Desvantagem'
    };
    return descriptions[rollType] || 'Rolagem Normal';
  }
  
  /**
   * Helper to convert hand source to display text
   * @param {string} weaponSource - Weapon source ("primary", "secondary", "unarmed")
   * @returns {string|null} Hand indicator text or null
   */
  static getHandIndicator(weaponSource) {
    const indicators = {
      'primary': 'Mão Primária',
      'secondary': 'Mão Secundária',
      'unarmed': 'Desarmado'
    };
    return indicators[weaponSource] || null;
  }
}
