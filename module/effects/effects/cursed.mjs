import BaseEffect from '../base-effect.mjs';

/**
 * Amaldiçoado Effect
 * When active, deals 5 damage at the start of each turn
 */
export class AmaldicoadoEffect extends BaseEffect {
  static effectName = 'Amaldiçoado';
  static CURSE_DAMAGE = 5; // Curse damage per turn

  /**
   * Check if the actor has the Amaldiçoado effect active
   * @param {Actor} actor - The actor to check
   * @returns {boolean} True if actor has Amaldiçoado effect
   */
  static hasEffect(actor) {
    return actor.items.some(item => 
      item.type === 'efeito' && item.name === this.effectName
    );
  }

  /**
   * Apply curse damage at the start of the turn
   * @param {Actor} actor - The actor with the effect
   * @param {Combat} combat - The combat encounter
   * @param {Object} updateData - The combat update data
   */
  static async applyCurseDamage(actor, combat, updateData) {
    // Check if actor has the effect
    if (!this.hasEffect(actor)) {
      return;
    }

    // Get current HP
    const currentHP = actor.system.health?.value ?? 0;
    const newHP = Math.max(0, currentHP - this.CURSE_DAMAGE);

    // Apply damage
    await actor.update({
      'system.health.value': newHP
    });

    // Create chat message with curse emoji
    const damageMessage = `
      <div class="cardigan-curse-damage" style="
        border: 2px solid #9c27b0;
        border-radius: 8px;
        padding: 12px;
        background: linear-gradient(135deg, #1a0a2a 0%, #0a0518 100%);
        box-shadow: 0 0 15px rgba(156, 39, 176, 0.3);
      ">
        <h3 style="
          color: #ba68c8;
          margin: 0 0 8px 0;
          font-size: 18px;
          text-shadow: 0 0 10px rgba(186, 104, 200, 0.5);
        ">🔮 Amaldiçoado</h3>
        <p style="margin: 0; color: #e0e0e0;">
          <strong>${actor.name}</strong> sofreu <strong style="color: #ba68c8;">${this.CURSE_DAMAGE} de dano</strong> devido à maldição!
        </p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #9e9e9e;">
          HP: ${currentHP} → ${newHP}
        </p>
      </div>
    `;

    // Send message to chat
    await ChatMessage.create({
      content: damageMessage,
      speaker: ChatMessage.getSpeaker({ actor }),
      whisper: game.users.filter(u => u.isGM).map(u => u.id)
    });

    console.log(`Amaldiçoado: ${actor.name} took ${this.CURSE_DAMAGE} curse damage (${currentHP} → ${newHP} HP)`);
  }

  /**
   * Handle turn start for Amaldiçoado effect
   * @param {Combat} combat - The combat encounter
   * @param {Object} updateData - The combat update data
   */
  static async onTurnStart(combat, updateData) {
    const combatant = combat.combatant;
    if (!combatant?.actor) return;

    await this.applyCurseDamage(combatant.actor, combat, updateData);
  }

  /**
   * Handle combat round for Amaldiçoado effect
   * @param {Combat} combat - The combat encounter
   * @param {Object} updateData - The combat update data
   */
  static async onCombatRound(combat, updateData) {
    // Curse damage is applied on turn start, not round start
    return;
  }

  /**
   * Register hooks for the Amaldiçoado effect
   */
  static registerHooks() {
    Hooks.on('updateCombat', async (combat, updateData, options, userId) => {
      // Only process on the GM's client
      if (!game.user.isGM) return;

      // Check if this is a turn change
      if (updateData.turn !== undefined) {
        await this.onTurnStart(combat, updateData);
      }
    });

    console.log('Amaldiçoado effect hooks registered');
  }
}
