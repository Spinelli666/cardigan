import BaseEffect from '../base-effect.mjs';

/**
 * Veloz Effect - Increases movement speed by 4m
 */
export default class VelozEffect extends BaseEffect {
  /**
   * Movement bonus granted by this effect
   * @type {number}
   */
  static MOVEMENT_BONUS = 4;

  /**
   * Apply the Veloz effect to an actor
   * Increases movement speed by 4m
   * @param {Actor} actor - The actor to apply the effect to
   * @returns {Promise<void>}
   */
  async apply(actor) {
    console.log(`Applying Veloz effect to ${actor.name}: +${VelozEffect.MOVEMENT_BONUS}m movement`);
    
    // Get current manual movement value
    const currentMovementManual = actor.system.details.movementManual || 0;
    const newMovementManual = currentMovementManual + VelozEffect.MOVEMENT_BONUS;
    
    // Update actor's manual movement (which will automatically update total movement in prepareDerivedData)
    await actor.update({
      'system.details.movementManual': newMovementManual
    });
    
    ui.notifications.info(`${actor.name} ganhou +${VelozEffect.MOVEMENT_BONUS}m de movimento do efeito Veloz!`);
  }

  /**
   * Remove the Veloz effect from an actor
   * Decreases movement speed by 4m
   * @param {Actor} actor - The actor to remove the effect from
   * @returns {Promise<void>}
   */
  async remove(actor) {
    console.log(`Removing Veloz effect from ${actor.name}: -${VelozEffect.MOVEMENT_BONUS}m movement`);
    
    // Get current manual movement value
    const currentMovementManual = actor.system.details.movementManual || 0;
    const newMovementManual = currentMovementManual - VelozEffect.MOVEMENT_BONUS;
    
    // Update actor's manual movement (which will automatically update total movement in prepareDerivedData)
    await actor.update({
      'system.details.movementManual': newMovementManual
    });
    
    ui.notifications.info(`${actor.name} perdeu ${VelozEffect.MOVEMENT_BONUS}m de movimento do efeito Veloz.`);
  }

  /**
   * Handle turn start - Veloz is a passive effect, no turn-based logic needed
   * @param {Actor} actor - The actor with this effect
   * @returns {Promise<void>}
   */
  async onTurnStart(actor) {
    // Veloz is passive, no turn-based updates needed
  }
}
