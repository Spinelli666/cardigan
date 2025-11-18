import BaseEffect from '../base-effect.mjs';

/**
 * Sangramento Effect
 * When active, removes 4 HP from the actor every time they roll Precisão, Evasão, Força, or Destreza
 */
export class SangramentoEffect extends BaseEffect {
  static effectName = 'Sangramento';
  static HP_DAMAGE = 4; // HP damage per ability roll
  static AFFECTED_ABILITIES = ['accuracy', 'evasion', 'strength', 'dexterity']; // Abilities that trigger bleeding

  /**
   * Check if the actor has the Sangramento effect active
   * @param {Actor} actor - The actor to check
   * @returns {boolean} True if actor has Sangramento effect
   */
  static hasEffect(actor) {
    return actor.items.some(item => 
      item.type === 'efeito' && item.name === this.effectName
    );
  }

  /**
   * Apply bleeding damage when an ability is rolled
   * Called from the ability roll handler
   * @param {Actor} actor - The actor rolling the ability
   * @param {string} abilityKey - The key of the ability (e.g., "precision", "evasion")
   */
  static async applyBleedingDamage(actor, abilityName, abilityKey) {
    // Check if this ability triggers bleeding
    if (!this.AFFECTED_ABILITIES.includes(abilityKey)) {
      return;
    }

    // Check if actor has bleeding effect
    if (!this.hasEffect(actor)) {
      return;
    }

    // Get current HP
    const currentHP = actor.system.health?.value ?? 0;
    const newHP = Math.max(0, currentHP - this.HP_DAMAGE);

    // Apply damage
    await actor.update({
      'system.health.value': newHP
    });

    // Create chat message
    const damageMessage = `
      <div class="cardigan-bleeding-damage">
        <h3>Sangramento</h3>
        <p><strong>${actor.name}</strong> sofreu <strong>${this.HP_DAMAGE} de dano</strong> devido ao efeito de Sangramento!</p>
      </div>
    `;

    await ChatMessage.create({
      content: damageMessage,
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      flags: {
        cardigan: {
          type: 'bleeding-damage',
          damage: this.HP_DAMAGE
        }
      }
    });

    console.log(`[${this.effectName}] Applied ${this.HP_DAMAGE} damage to ${actor.name} for rolling ${abilityName}`);

    // Show notification
    ui.notifications.warn(`${actor.name} sofreu ${this.HP_DAMAGE} de dano por Sangramento!`);
  }

  /**
   * Hook into ability rolls to apply bleeding damage
   * This should be registered during system initialization
   */
  static registerHooks() {
    // Hook será implementado no sistema de rolagem de habilidades
    console.log(`[${this.effectName}] Hooks registered for ability rolls`);
  }
}
