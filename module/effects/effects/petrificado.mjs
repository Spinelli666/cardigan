import BaseEffect from '../base-effect.mjs';

/**
 * Petrificado Effect
 * When active, adds +20 to armor bonus
 * When removed, subtracts -20 from armor bonus
 */
export class PetrificadoEffect extends BaseEffect {
  static effectName = 'Petrificado';
  static ARMOR_BONUS = 20; // Armor bonus when petrified

  /**
   * Check if the actor has the Petrificado effect active
   * @param {Actor} actor - The actor to check
   * @returns {boolean} True if actor has Petrificado effect
   */
  static hasEffect(actor) {
    return actor.items.some(item => 
      item.type === 'efeito' && item.name === this.effectName
    );
  }

  /**
   * Apply armor bonus when effect is added
   * @param {Item} item - The effect item being created
   * @param {Object} options - Creation options
   * @param {string} userId - The user ID
   */
  static async onEffectAdded(item, options, userId) {
    // Check if this is the Petrificado effect
    if (item.type !== 'efeito' || item.name !== this.effectName) {
      return;
    }

    const actor = item.parent;
    if (!actor) {
      console.warn(`[${this.effectName}] Effect added but no parent actor found`);
      return;
    }

    // Get current armor bonus
    const currentBonus = actor.system.status?.armorBonus ?? 0;
    const newBonus = currentBonus + this.ARMOR_BONUS;

    // Update armor bonus
    await actor.update({
      'system.status.armorBonus': newBonus
    });

    console.log(`[${this.effectName}] Added +${this.ARMOR_BONUS} armor bonus to ${actor.name}. New total: ${newBonus}`);

    // Create chat message
    const message = `
      <div class="cardigan-petrificado-effect" style="
        border: 2px solid #808080;
        border-radius: 8px;
        padding: 12px;
        background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
        box-shadow: 0 0 15px rgba(128, 128, 128, 0.3);
      ">
        <h3 style="
          color: #a0a0a0;
          margin: 0 0 8px 0;
          font-size: 18px;
          text-shadow: 0 0 10px rgba(128, 128, 128, 0.5);
        ">🗿 Petrificado</h3>
        <p style="margin: 0; color: #e0e0e0;">
          <strong>${actor.name}</strong> foi petrificado e recebeu <strong style="color: #a0a0a0;">+${this.ARMOR_BONUS} de Bônus de Armadura</strong>!
        </p>
      </div>
    `;

    await ChatMessage.create({
      content: message,
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      flags: {
        cardigan: {
          type: 'petrificado-applied',
          armorBonus: this.ARMOR_BONUS
        }
      }
    });

    // Show notification
    ui.notifications.info(`${actor.name} foi petrificado! +${this.ARMOR_BONUS} Bônus de Armadura`);
  }

  /**
   * Remove armor bonus when effect is removed
   * @param {Item} item - The effect item being deleted
   * @param {Object} options - Deletion options
   * @param {string} userId - The user ID
   */
  static async onEffectRemoved(item, options, userId) {
    // Check if this is the Petrificado effect
    if (item.type !== 'efeito' || item.name !== this.effectName) {
      return;
    }

    const actor = item.parent;
    if (!actor) {
      console.warn(`[${this.effectName}] Effect removed but no parent actor found`);
      return;
    }

    // Get current armor bonus
    const currentBonus = actor.system.status?.armorBonus ?? 0;
    const newBonus = Math.max(0, currentBonus - this.ARMOR_BONUS); // Don't go below 0

    // Update armor bonus
    await actor.update({
      'system.status.armorBonus': newBonus
    });

    console.log(`[${this.effectName}] Removed -${this.ARMOR_BONUS} armor bonus from ${actor.name}. New total: ${newBonus}`);

    // Create chat message
    const message = `
      <div class="cardigan-petrificado-removed" style="
        border: 2px solid #808080;
        border-radius: 8px;
        padding: 12px;
        background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
        box-shadow: 0 0 15px rgba(128, 128, 128, 0.3);
      ">
        <h3 style="
          color: #a0a0a0;
          margin: 0 0 8px 0;
          font-size: 18px;
          text-shadow: 0 0 10px rgba(128, 128, 128, 0.5);
        ">🗿 Petrificado Removido</h3>
        <p style="margin: 0; color: #e0e0e0;">
          <strong>${actor.name}</strong> não está mais petrificado e perdeu <strong style="color: #a0a0a0;">-${this.ARMOR_BONUS} de Bônus de Armadura</strong>!
        </p>
      </div>
    `;

    await ChatMessage.create({
      content: message,
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      flags: {
        cardigan: {
          type: 'petrificado-removed',
          armorBonus: this.ARMOR_BONUS
        }
      }
    });

    // Show notification
    ui.notifications.info(`${actor.name} não está mais petrificado! -${this.ARMOR_BONUS} Bônus de Armadura`);
  }

  /**
   * Register hooks for effect application and removal
   */
  static registerHooks() {
    console.log(`[${this.effectName}] Registering effect hooks...`);

    /**
     * Hook: Item Created
     * Triggers when an item (including effects) is added to an actor
     */
    Hooks.on('createItem', async (item, options, userId) => {
      await this.onEffectAdded(item, options, userId);
    });

    /**
     * Hook: Item Deleted
     * Triggers when an item (including effects) is removed from an actor
     */
    Hooks.on('deleteItem', async (item, options, userId) => {
      await this.onEffectRemoved(item, options, userId);
    });

    console.log(`[${this.effectName}] Hooks registered successfully`);
  }
}

export default PetrificadoEffect;
