import BaseEffect from '../base-effect.mjs';

/**
 * Sangramento Effect
 * When active, removes 5 HP from the actor every time they roll Precisão, Evasão, Força, or Destreza
 */
export class SangramentoEffect extends BaseEffect {
  static effectName = 'Sangramento';
  static HP_DAMAGE = 5; // HP damage per ability roll
  static AFFECTED_ABILITIES = ['accuracy', 'evasion', 'strength', 'dexterity']; // Abilities that trigger bleeding

  /**
   * Check if the actor has the Sangramento effect active
   * @param {Actor} actor - The actor to check
   * @returns {boolean} True if actor has Sangramento effect
   */
  static hasEffect(actor) {
    if (!actor || !actor.items) {
      return false;
    }
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
    // Validate actor
    if (!actor) {
      console.warn('[Sangramento] No actor provided to applyBleedingDamage');
      return;
    }

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
   * Register hooks for ability rolls to apply bleeding damage
   * 
   * Integration points where applyBleedingDamage() is called:
   * 1. actor-sheet.mjs _onRoll() - Ability buttons in Features tab
   * 2. actor-sheet.mjs _performSingleAttack() - Weapon attacks from character sheet
   * 3. skill-manager.mjs #performDefaultPrimaryAttack() - Skill "Ataque" button in chat
   * 4. skill-manager.mjs #performUnifiedSkillAttack() - Skill unified attack button in chat
   * 5. cardigan.mjs handleEvasionClick() - "Rolar Evasão" button in attack results
   * 6. cardigan.mjs handlePrecisionClick() - "Rolar Precisão" button in evasion rerolls
   * 
   * All precision, evasion, strength, and dexterity rolls trigger bleeding damage.
   */
  static registerHooks() {
    console.log(`[${this.effectName}] Effect registered - bleeding damage applied in all accuracy/evasion/strength/dexterity rolls`);
  }
}
