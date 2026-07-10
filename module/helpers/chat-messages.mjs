import { getCoreRollMode, applyRollModeToMessageData } from './roll-mode.mjs';

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
    
    const hasAttackTargets = !!flags?.cardigan?.attackTargets;

    // Check if special action mode is active (hand selection, attack targets or joint roll)
    const hasSpecialAction = primaryHand || secondaryHand || isJointRoll || hasAttackTargets;
    
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
      } else if (targets.length === 1 && (primaryHand || secondaryHand || hasAttackTargets)) {
        // Single target attack: get target avatar
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
    let diceFormulaData = null; // Structured data for rich tooltip
    let naturalDiceResult = null; // Natural (pre-modifier) kept die result
    
    try {
      // Get the first term (should be the dice pool)
      const diceTerm = roll.terms[0];
      if (diceTerm && diceTerm.results) {
        // Extract the natural result of the kept die (before modifiers)
        const keptResult = diceTerm.results.find(r => !r.discarded);
        if (keptResult) naturalDiceResult = keptResult.result;

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
        
        // Build structured data for rich tooltip
        const sortedResults = diceTerm.results.length > 1 
          ? [...diceTerm.results].sort((a, b) => b.result - a.result)
          : diceTerm.results;
        
        const formulas = sortedResults.map(r => {
          const formula = modifierString ? `${r.result}${modifierString}` : `${r.result}`;
          const isKept = !r.discarded;
          return { formula, isKept };
        });
        
        // Store structured data for tooltip
        diceFormulaData = JSON.stringify({
          formulas: formulas,
          rollType: rollType
        });
        
        // Simple text version for fallback
        diceResultFormula = formulas.map(f => f.formula).join('\n');
      }
    } catch (error) {
      console.warn('[CARDIGAN] Could not parse dice result, using formula:', error);
      diceResultFormula = roll.formula;
    }
    
    // Check for critical results:
    // - Critical success: natural 20 on the die OR total >= 20
    // - Critical failure: natural 1 on the die OR total <= 1 (covers natural 1 with modifiers like +2 = 3)
    const isCriticalSuccess = naturalDiceResult === 20 || roll.total >= 20;
    const isCriticalFailure = naturalDiceResult === 1 || roll.total <= 1;
    
    const content = template({
      actorImg: actor.img,
      actorName: actor.name,
      rollLabel: label,
      rollType: rollDescription,
      rollTypeClass: rollType,
      rollResult: roll.total,
      rollFormula: diceResultFormula,
      diceFormulaData: diceFormulaData, // Structured data for rich tooltip
      handIndicator: handIndicator,
      handIndicatorClass: handIndicatorClass,
      modifiers: modifiers.length > 0 ? modifiers : null,
      isJointRoll: isJointRoll,
      hasSpecialAction: hasSpecialAction,
      targetNames: targetNames,
      hasSingleTarget: hasSingleTarget,
      targetImg: targetImg,
      targetName: targetName,
      isCriticalSuccess: isCriticalSuccess,
      isCriticalFailure: isCriticalFailure
    });
    
    // Use provided rollMode or get from settings
    const effectiveRollMode = rollMode || getCoreRollMode();

    // Store display metadata in flags so whisper placeholder can reconstruct the visual
    flags.cardigan = {
      ...(flags.cardigan || {}),
      rollLabel: label,           // flat — always reliable for non-recipients
      whisperDisplay: {
        actorImg: actor.img,
        actorName: actor.name,
        rollLabel: label,
        hasSpecialAction: hasSpecialAction,
        isJointRoll: isJointRoll
      }
    };
    
    // Create message data (no speaker to avoid duplication)
    const messageData = {
      content: content,
      rolls: [roll],
      flags: flags
    };
    
    // Apply roll mode using Foundry's official API method
    applyRollModeToMessageData(messageData, effectiveRollMode);
    
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
