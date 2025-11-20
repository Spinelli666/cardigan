import BaseEffect from '../base-effect.mjs';

/**
 * Congelado Effect
 * When active, deals 5 cold damage at the start of each turn
 */
export class CongeladoEffect extends BaseEffect {
  static effectName = 'Congelado';
  static COLD_DAMAGE = 5; // Cold damage per turn

  /**
   * Check if the actor has the Congelado effect active
   * @param {Actor} actor - The actor to check
   * @returns {boolean} True if actor has Congelado effect
   */
  static hasEffect(actor) {
    return actor.items.some(item => 
      item.type === 'efeito' && item.name === this.effectName
    );
  }

  /**
   * Apply cold damage at the start of the turn
   * @param {Actor} actor - The actor with the effect
   * @param {Combat} combat - The combat encounter
   * @param {Object} updateData - The combat update data
   */
  static async applyColdDamage(actor, combat, updateData) {
    // Check if actor has the effect
    if (!this.hasEffect(actor)) {
      return;
    }

    // Get current HP
    const currentHP = actor.system.health?.value ?? 0;
    const newHP = Math.max(0, currentHP - this.COLD_DAMAGE);

    // Apply damage
    await actor.update({
      'system.health.value': newHP
    });

    // Create chat message with ice emoji
    const damageMessage = `
      <div class="cardigan-cold-damage" style="
        border: 2px solid #4dd0e1;
        border-radius: 8px;
        padding: 12px;
        background: linear-gradient(135deg, #0a1a2a 0%, #051018 100%);
        box-shadow: 0 0 15px rgba(77, 208, 225, 0.3);
      ">
        <h3 style="
          color: #4dd0e1;
          margin: 0 0 8px 0;
          font-size: 18px;
          text-shadow: 0 0 10px rgba(77, 208, 225, 0.5);
        ">❄️ Congelado</h3>
        <p style="margin: 0; color: #e0e0e0;">
          <strong>${actor.name}</strong> sofreu <strong style="color: #4dd0e1;">${this.COLD_DAMAGE} de dano de Gelo</strong> devido ao efeito de Congelado!
        </p>
      </div>
    `;

    await ChatMessage.create({
      content: damageMessage,
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      flags: {
        cardigan: {
          type: 'cold-damage',
          damage: this.COLD_DAMAGE,
          damageType: 'cold'
        }
      }
    });

    console.log(`[${this.effectName}] Applied ${this.COLD_DAMAGE} cold damage to ${actor.name}`);

    // Show notification
    ui.notifications.info(`${actor.name} sofreu ${this.COLD_DAMAGE} de dano de Gelo por Congelado!`);
  }

  /**
   * Register hooks for combat turn tracking
   */
  static registerHooks() {
    console.log(`[${this.effectName}] Registering combat turn hooks...`);

    /**
     * Hook: Combat Turn Update
     * Triggers when a combatant's turn starts
     */
    Hooks.on('updateCombat', async (combat, updateData, options, userId) => {
      // Only run for the GM or the user who owns the combatant
      if (!game.user.isGM && game.userId !== userId) return;

      // Check if the turn changed
      if (!('turn' in updateData)) return;

      // Get the current combatant
      const combatant = combat.combatant;
      if (!combatant || !combatant.actor) return;

      const actor = combatant.actor;

      console.log(`[${this.effectName}] Turn started for: ${actor.name}`);

      // Apply cold damage
      await this.applyColdDamage(actor, combat, updateData);
    });

    /**
     * Hook: Combat Round Update
     * Triggers at the start of each new round
     */
    Hooks.on('combatRound', async (combat, updateData, options) => {
      console.log(`[${this.effectName}] New round started: Round ${combat.round}`);
    });

    console.log(`[${this.effectName}] Hooks registered successfully`);
  }
}

export default CongeladoEffect;
