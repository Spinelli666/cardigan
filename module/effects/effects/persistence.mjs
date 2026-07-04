import BaseEffect from '../base-effect.mjs';

/**
 * Persistência Effect - Prevents HP from dropping below 1
 * The character cannot be reduced below 1 HP while this effect is active
 */
export default class PersistenciaEffect extends BaseEffect {
  /**
   * Minimum HP that can be maintained
   * @type {number}
   */
  static MIN_HP = 1;

  /**
   * Apply the Persistência effect to an actor
   * Sets up HP protection
   * @param {Actor} actor - The actor to apply the effect to
   * @returns {Promise<void>}
   */
  async apply(actor) {
    console.log(`Applying Persistência effect to ${actor.name}`);
    
    // Check if HP is already at or below 1 and restore it to 1
    const currentHP = actor.system.health?.value ?? 0;
    if (currentHP < PersistenciaEffect.MIN_HP) {
      await actor.update({
        'system.health.value': PersistenciaEffect.MIN_HP
      });
      ui.notifications.info(
        `${actor.name} ganhou Persistência e recuperou para ${PersistenciaEffect.MIN_HP} HP!`
      );
    } else {
      ui.notifications.info(`${actor.name} ganhou o efeito Persistência! Não cairá abaixo de ${PersistenciaEffect.MIN_HP} HP.`);
    }
  }

  /**
   * Remove the Persistência effect from an actor
   * @param {Actor} actor - The actor to remove the effect from
   * @returns {Promise<void>}
   */
  async remove(actor) {
    console.log(`Removing Persistência effect from ${actor.name}`);
    ui.notifications.info(`${actor.name} perdeu o efeito Persistência.`);
  }

  /**
   * Check if HP should be prevented from going below 1
   * This is called before updating actor HP
   * @param {Actor} actor - The actor being updated
   * @param {number} newHP - The new HP value being set
   * @returns {number} - The corrected HP value (minimum 1 if Persistência is active)
   */
  static protectHP(actor, newHP) {
    // Check if actor has Persistência effect
    const hasPersistencia = actor.items.some(item => 
      item.type === 'efeito' && item.name === 'Persistência'
    );
    
    if (!hasPersistencia) return newHP;
    
    // If trying to set HP below minimum, clamp it to minimum
    if (newHP < this.MIN_HP) {
      console.log(`Persistência protecting ${actor.name} from dropping to ${newHP} HP, clamping to ${this.MIN_HP}`);
      ui.notifications.warn(
        `${actor.name} tem Persistência ativa! HP não pode cair abaixo de ${this.MIN_HP}.`
      );
      return this.MIN_HP;
    }
    
    return newHP;
  }
}
