import BaseEffect from '../base-effect.mjs';

/**
 * Lento Effect
 * Reduces the target's movement by 5 when applied
 */
export default class LentoEffect extends BaseEffect {
  static MOVEMENT_PENALTY = -5;

  static register() {
    const hooks = {
      onEffectAdded: this.onEffectAdded.bind(this),
      onEffectRemoved: this.onEffectRemoved.bind(this)
    };

    // Register hooks for when the effect is added/removed
    Hooks.on('createItem', (item, options, userId) => {
      if (item.type === 'efeito' && item.name === 'Lento' && item.parent) {
        hooks.onEffectAdded(item);
      }
    });

    Hooks.on('deleteItem', (item, options, userId) => {
      if (item.type === 'efeito' && item.name === 'Lento' && item.parent) {
        hooks.onEffectRemoved(item);
      }
    });

    return hooks;
  }

  /**
   * Apply movement penalty when Lento effect is added
   * @param {Item} item - The Lento effect item
   */
  static async onEffectAdded(item) {
    const actor = item.parent;
    if (!actor) return;

    const currentMovementManual = actor.system.details.movementManual || 0;
    const newMovementManual = currentMovementManual + this.MOVEMENT_PENALTY;

    await actor.update({
      'system.details.movementManual': newMovementManual
    });

    // Get the total movement after update (this is auto-calculated)
    const totalMovement = actor.system.details.movement;

    // Create a chat message
    ChatMessage.create({
      content: `
        <div class="cardigan-effect-message lento-effect">
          <p style="margin: 4px 0;">
            <strong>${actor.name}</strong> está <strong>Lento</strong>!
          </p>
          <p style="margin: 4px 0; color: #A0B0C0;">
            Movimento reduzido em <strong>${this.MOVEMENT_PENALTY}m</strong>
            (Total: ${totalMovement}m)
          </p>
        </div>
      `,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  /**
   * Remove movement penalty when Lento effect is removed
   * @param {Item} item - The Lento effect item
   */
  static async onEffectRemoved(item) {
    const actor = item.parent;
    if (!actor) return;

    const currentMovementManual = actor.system.details.movementManual || 0;
    const newMovementManual = currentMovementManual - this.MOVEMENT_PENALTY;

    await actor.update({
      'system.details.movementManual': newMovementManual
    });

    // Get the total movement after update (this is auto-calculated)
    const totalMovement = actor.system.details.movement;

    // Create a chat message
    ChatMessage.create({
      content: `
        <div class="cardigan-effect-message lento-removed">
          <p style="margin: 4px 0;">
            <strong>${actor.name}</strong> não está mais <strong>Lento</strong>!
          </p>
          <p style="margin: 4px 0; color: #A0B0C0;">
            Movimento restaurado em <strong>${-this.MOVEMENT_PENALTY}m</strong>
            (Total: ${totalMovement}m)
          </p>
        </div>
      `,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }
}
