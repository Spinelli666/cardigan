import BaseEffect from '../base-effect.mjs';

/**
 * Envenenado Effect
 * Increases toxicity level by 1 when applied
 * Additional poison damage will be implemented later
 */
export class EnvenenadoEffect extends BaseEffect {
  static effectName = "Envenenado";

  /**
   * Apply the effect to an actor - increase toxicity
   * This is called when the effect is added to a character sheet
   * @param {Actor} actor - The actor to apply the effect to
   * @returns {Promise<void>}
   */
  async apply(actor) {
    if (!actor) return;

    // Get current toxicity level (null means 0)
    const currentToxicity = actor.system.status?.toxicity ?? 0;
    
    // Increase by 1, max is 5
    const newToxicity = Math.min(5, currentToxicity + 1);
    
    // Update actor's toxicity
    await actor.update({
      'system.status.toxicity': newToxicity
    });
    
    // Show notification
    ui.notifications.info(`${actor.name} ganhou 1 ponto de Toxicidade! (${currentToxicity} → ${newToxicity})`);
    
    // Send message to chat with toxicity level description
    const toxicityMessages = {
      1: "Levemente intoxicado, você sente náusea e tontura.",
      2: "Intoxicação moderada, você está enjoado e com visão turva.",
      3: "Severamente intoxicado, você está vomitando e com dores intensas.",
      4: "Intoxicação crítica, você está delirando e perdendo consciência.",
      5: "Envenenamento fatal, você está à beira da morte por toxinas."
    };
    
    const message = `${actor.name}: ${toxicityMessages[newToxicity]}`;
    
    await ChatMessage.create({
      content: message,
      speaker: ChatMessage.getSpeaker({ actor: actor })
    });
    
    console.log(`[Envenenado] Applied to ${actor.name} - toxicity increased from ${currentToxicity} to ${newToxicity}`);
  }

  /**
   * Remove the effect from an actor
   * Note: Toxicity points remain even after the effect is removed
   * They must be manually reset or reduced through rest/treatment
   * @param {Actor} actor - The actor to remove the effect from
   * @returns {Promise<void>}
   */
  async remove(actor) {
    // Toxicity persists after effect removal
    // It can only be reduced through:
    // - Manual reset (Reset Toxicity button)
    // - Long rest
    // - Consuming antidotes/treatments
    console.log(`[Envenenado] Effect removed from ${actor.name}, but toxicity persists and must be manually reduced`);
  }

  /**
   * Register hooks for Envenenado effect (currently none needed)
   * The apply/remove methods are called automatically by the EffectManager
   */
  static registerHooks() {
    console.log(`[${this.effectName}] Effect registered - toxicity managed via apply/remove methods`);
  }
}
