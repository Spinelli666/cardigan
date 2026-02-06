import BaseEffect from '../base-effect.mjs';

/**
 * Fratura Effect
 * Automatically syncs the Fratura effect item from compendium based on fracture status level
 */
export class FraturaEffect extends BaseEffect {
  static effectName = 'Fratura';
  static compendiumName = 'cardigan.efeitos-cardigan';

  /**
   * Synchronize the Fratura effect item based on fracture status level
   * Adds the effect from compendium when fracture > 0, removes it when fracture = 0
   * @param {Actor} actor - The actor to sync the effect for
   * @param {number} fractureLevel - The current fracture level (0-5)
   */
  static async syncEffect(actor, fractureLevel) {
    // Only for characters
    if (actor.type !== 'character') return;

    // Find existing Fratura effect on the actor
    const existingEffect = actor.items.find(item => 
      item.type === 'efeito' && item.name === this.effectName
    );

    if (fractureLevel > 0) {
      // Should have the effect
      if (!existingEffect) {
        await this._addEffectToActor(actor);
      }
    } else {
      // Should not have the effect (fracture = 0)
      if (existingEffect) {
        await existingEffect.delete();
        console.log(`[${this.effectName} Sync] Removed ${this.effectName} effect from ${actor.name}`);
      }
    }
  }

  /**
   * Add the Fratura effect from compendium to the actor
   * @param {Actor} actor - The actor to add the effect to
   * @private
   */
  static async _addEffectToActor(actor) {
    // Get effect from compendium
    const pack = game.packs.get(this.compendiumName);
    if (!pack) {
      console.error(`[${this.effectName} Sync] Could not find ${this.compendiumName} compendium`);
      return;
    }

    const effectIndex = pack.index.find(e => e.name === this.effectName);
    if (!effectIndex) {
      console.error(`[${this.effectName} Sync] Could not find ${this.effectName} effect in compendium`);
      return;
    }

    // Load the full document
    const effectDoc = await pack.getDocument(effectIndex._id);
    if (!effectDoc) {
      console.error(`[${this.effectName} Sync] Could not load ${this.effectName} effect document`);
      return;
    }

    // Add to actor with infinite rounds (since it's from checkbox)
    const effectData = effectDoc.toObject();
    effectData.system.rodadas = 'infinito';
    await actor.createEmbeddedDocuments('Item', [effectData]);
    console.log(`[${this.effectName} Sync] Added ${this.effectName} effect to ${actor.name} with infinite rounds`);
  }

  /**
   * Called when the actor is updated
   * Checks if fracture status changed and syncs the effect
   * @param {Actor} actor - The actor being updated
   * @param {object} changed - The changed data
   * @param {string} userId - The user who initiated the update
   */
  static async onActorUpdate(actor, changed, userId) {
    // Only run on the user who initiated the update
    if (game.user.id !== userId) return;

    // Check if fracture status changed
    if (changed.system?.status?.fracture !== undefined) {
      await this.syncEffect(actor, changed.system.status.fracture);
    }
  }
}
