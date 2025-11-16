import BaseEffect from '../base-effect.mjs';

/**
 * Imparável Effect - Prevents and removes crowd control effects
 * Blocks: Enraizado, Atordoado, Caído, Congelado, Encantado, Inconsciente・Sono
 */
export default class ImparavelEffect extends BaseEffect {
  /**
   * List of effect names that are blocked by Imparável
   * @type {string[]}
   */
  static BLOCKED_EFFECTS = [
    'Enraizado',
    'Atordoado',
    'Caído',
    'Congelado • Petrificado',
    'Encantado',
    'Inconsciente・Sono'
  ];

  /**
   * Apply the Imparável effect to an actor
   * Removes any existing blocked effects
   * @param {Actor} actor - The actor to apply the effect to
   * @returns {Promise<void>}
   */
  async apply(actor) {
    console.log(`Applying Imparável effect to ${actor.name}`);
    
    // Find and remove any blocked effects that are currently on the actor
    const effectsToRemove = actor.items.filter(item => 
      item.type === 'efeito' && 
      ImparavelEffect.BLOCKED_EFFECTS.includes(item.name)
    );
    
    if (effectsToRemove.length > 0) {
      const removedNames = effectsToRemove.map(e => e.name).join(', ');
      console.log(`Imparável removing blocked effects: ${removedNames}`);
      
      // Delete the blocked effects
      const idsToDelete = effectsToRemove.map(e => e.id);
      await actor.deleteEmbeddedDocuments('Item', idsToDelete);
      
      ui.notifications.info(
        `${actor.name} ganhou Imparável e removeu: ${removedNames}`
      );
    } else {
      ui.notifications.info(`${actor.name} ganhou o efeito Imparável!`);
    }
  }

  /**
   * Remove the Imparável effect from an actor
   * @param {Actor} actor - The actor to remove the effect from
   * @returns {Promise<void>}
   */
  async remove(actor) {
    console.log(`Removing Imparável effect from ${actor.name}`);
    ui.notifications.info(`${actor.name} perdeu o efeito Imparável.`);
  }

  /**
   * Check if an effect should be blocked by Imparável
   * This is called before adding any effect to an actor
   * @param {Actor} actor - The actor that would receive the effect
   * @param {string} effectName - The name of the effect being added
   * @returns {boolean} - True if the effect should be blocked
   */
  static shouldBlockEffect(actor, effectName) {
    // Check if actor has Imparável effect
    const hasImparavel = actor.items.some(item => 
      item.type === 'efeito' && item.name === 'Imparável'
    );
    
    if (!hasImparavel) return false;
    
    // Check if the effect being added is in the blocked list
    const isBlocked = this.BLOCKED_EFFECTS.includes(effectName);
    
    if (isBlocked) {
      console.log(`Imparável blocking effect: ${effectName}`);
      ui.notifications.warn(
        `${actor.name} está Imparável e não pode receber o efeito ${effectName}!`
      );
    }
    
    return isBlocked;
  }
}
