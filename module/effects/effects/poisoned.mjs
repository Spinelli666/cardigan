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
    
    // Find the Envenenado effect item and mark it with tracking flag
    const envenenadoItem = actor.items.find(item => 
      item.type === 'efeito' && (item.name === "Envenenado" || item.name.toLowerCase().includes('envenenado'))
    );
    
    if (envenenadoItem) {
      // Set flag to track if poison damage was dealt
      await envenenadoItem.setFlag('cardigan', 'poisonDamageDealt', false);
    }
    
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
  }

  /**
   * Remove the effect from an actor
   * Note: Toxicity points remain even after the effect is removed
   * They must be manually reset or reduced through rest/treatment
   * @param {Actor} actor - The actor to remove the effect from
   * @returns {Promise<void>}
   */
  async remove(actor) {
    if (!actor) return;
    
    // Find the Envenenado effect item being removed
    const envenenadoItem = actor.items.find(item => 
      item.type === 'efeito' && (item.name === "Envenenado" || item.name.toLowerCase().includes('envenenado'))
    );
    
    if (envenenadoItem) {
      // Check if poison damage was dealt during the effect
      const poisonDamageDealt = envenenadoItem.getFlag('cardigan', 'poisonDamageDealt');
      
      if (poisonDamageDealt === false) {
        // No poison damage was dealt - apply 20 damage penalty
        const currentHP = actor.system.health?.value ?? 0;
        const newHP = Math.max(0, currentHP - 20);
        
        await actor.update({
          'system.health.value': newHP
        });
        
        // Notification
        ui.notifications.warn(`${actor.name} não recebeu dano de veneno enquanto Envenenado e sofreu 20 de dano ao remover o efeito!`);
        
        // Chat message
        const messageContent = `
          <div style="text-align: center; padding: 8px; background: rgba(156, 39, 176, 0.1); border: 2px solid #9C27B0; border-radius: 4px;">
            <h3 style="margin: 0 0 4px 0; color: #9C27B0;">
              <i class="fas fa-skull-crossbones"></i> Veneno Agravado!
            </h3>
            <p style="margin: 0;"><strong>${actor.name}</strong> não foi atingido em combate enquanto envenenado!</p>
            <p style="margin: 4px 0 0 0; font-size: 0.9em;">
              🧪 O veneno se espalhou pelo corpo causando <strong>20 de dano</strong>!
            </p>
            <p style="margin: 4px 0 0 0; font-size: 0.85em; color: #666;">
              HP: ${currentHP} → ${newHP}
            </p>
          </div>
        `;
        
        await ChatMessage.create({
          content: messageContent,
          speaker: { alias: "Sistema" }
        });
      }
    }
    
    // Toxicity persists after effect removal
    // It can only be reduced through:
    // - Manual reset (Reset Toxicity button)
    // - Long rest
    // - Consuming antidotes/treatments
  }

  /**
   * Register hooks for Envenenado effect (currently none needed)
   * The apply/remove methods are called automatically by the EffectManager
   */
  static registerHooks() {
    // No hooks needed - toxicity managed via apply/remove methods
  }
}
