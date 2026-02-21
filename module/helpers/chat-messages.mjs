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
    
    // Get target data for tooltips and display
    let targetNames = '';
    let hasSingleTarget = false;
    let targetImg = '';
    let targetName = '';
    
    if (game.user.targets && game.user.targets.size > 0) {
      const targets = Array.from(game.user.targets);
      
      if (isJointRoll) {
        // Joint roll: get all target names for tooltip
        const names = targets.map(token => token.actor?.name || token.name);
        targetNames = names.join('<br>');
      } else if (targets.length === 1 && (primaryHand || secondaryHand)) {
        // Single target with hand selected: get target avatar
        hasSingleTarget = true;
        const target = targets[0];
        targetImg = target.actor?.img || target.texture.src;
        targetName = target.actor?.name || target.name;
      }
    }
    
    // Debug: Log rollType for verification
    console.log('[CARDIGAN CHAT] Creating roll message with rollType:', rollType);
    
    // Extract dice result and modifiers for cleaner display
    let diceResultFormula = roll.formula;
    try {
      // Get the first term (should be the dice pool)
      const diceTerm = roll.terms[0];
      if (diceTerm && diceTerm.results) {
        // Build modifier string from remaining terms
        let modifierString = '';
        for (let i = 1; i < roll.terms.length; i++) {
          const term = roll.terms[i];
          if (term.operator) {
            modifierString += ` ${term.operator} `;
          } else if (term.number !== undefined) {
            modifierString += term.number;
          }
        }
        
        // For advantage/disadvantage, show ALL dice results
        if (diceTerm.results.length > 1) {
          // Sort results in descending order (highest first) for better readability
          const sortedResults = [...diceTerm.results].sort((a, b) => b.result - a.result);
          const formulas = sortedResults.map(r => {
            return modifierString ? `${r.result}${modifierString}` : `${r.result}`;
          });
          diceResultFormula = formulas.join('\n');
        } else {
          // Normal roll: single die
          const diceValue = diceTerm.results[0].result;
          diceResultFormula = modifierString ? `${diceValue}${modifierString}` : `${diceValue}`;
        }
      }
    } catch (error) {
      console.warn('[CARDIGAN] Could not parse dice result, using formula:', error);
      diceResultFormula = roll.formula;
    }
    
    const content = template({
      actorImg: actor.img,
      actorName: actor.name,
      rollLabel: label,
      rollType: rollDescription,
      rollTypeClass: rollType,
      rollResult: roll.total,
      rollFormula: diceResultFormula,
      handIndicator: handIndicator,
      handIndicatorClass: handIndicatorClass,
      modifiers: modifiers.length > 0 ? modifiers : null,
      isJointRoll: isJointRoll,
      hasSpecialAction: hasSpecialAction,
      targetNames: targetNames,
      hasSingleTarget: hasSingleTarget,
      targetImg: targetImg,
      targetName: targetName
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
