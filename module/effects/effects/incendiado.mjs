import BaseEffect from '../base-effect.mjs';

/**
 * Incendiado Effect
 * When active, deals 10 fire damage at the start of each turn
 */
export class IncendiadoEffect extends BaseEffect {
  static effectName = 'Incendiado';
  static FIRE_DAMAGE = 10; // Fire damage per turn

  /**
   * Check if the actor has the Incendiado effect active
   * @param {Actor} actor - The actor to check
   * @returns {boolean} True if actor has Incendiado effect
   */
  static hasEffect(actor) {
    return actor.items.some(item => 
      item.type === 'efeito' && item.name === this.effectName
    );
  }

  /**
   * Apply fire damage at the start of the turn
   * @param {Actor} actor - The actor with the effect
   * @param {Combat} combat - The combat encounter
   * @param {Object} updateData - The combat update data
   */
  static async applyBurnDamage(actor, combat, updateData) {
    // Check if actor has the effect
    if (!this.hasEffect(actor)) {
      return;
    }

    // Get current HP
    const currentHP = actor.system.health?.value ?? 0;
    const newHP = Math.max(0, currentHP - this.FIRE_DAMAGE);

    // Apply damage
    await actor.update({
      'system.health.value': newHP
    });

    // Create chat message with fire emoji
    const damageMessage = `
      <div class="cardigan-fire-damage" style="
        border: 2px solid #ff6b35;
        border-radius: 8px;
        padding: 12px;
        background: linear-gradient(135deg, #2a1810 0%, #1a0f0a 100%);
        box-shadow: 0 0 15px rgba(255, 107, 53, 0.3);
      ">
        <h3 style="
          color: #ff6b35;
          margin: 0 0 8px 0;
          font-size: 18px;
          text-shadow: 0 0 10px rgba(255, 107, 53, 0.5);
        ">🔥 Incendiado</h3>
        <p style="margin: 0; color: #e0e0e0;">
          <strong>${actor.name}</strong> sofreu <strong style="color: #ff6b35;">${this.FIRE_DAMAGE} de dano de Fogo</strong> devido ao efeito de Incendiado!
        </p>
      </div>
    `;

    await ChatMessage.create({
      content: damageMessage,
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      flags: {
        cardigan: {
          type: 'fire-damage',
          damage: this.FIRE_DAMAGE,
          damageType: 'fire'
        }
      }
    });

    console.log(`[${this.effectName}] Applied ${this.FIRE_DAMAGE} fire damage to ${actor.name}`);

    // Show notification
    ui.notifications.warn(`${actor.name} sofreu ${this.FIRE_DAMAGE} de dano de Fogo por Incendiado!`);
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

      // Apply burn damage
      await this.applyBurnDamage(actor, combat, updateData);
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

export default IncendiadoEffect;
