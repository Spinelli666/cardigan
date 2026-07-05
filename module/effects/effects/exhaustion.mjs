import BaseEffect from '../base-effect.mjs';

/**
 * Exaustão Effect
 * Automatically syncs the Exaustão effect item from compendium based on hunger or thirst levels
 * Effect appears when either hunger >= 3 OR thirst >= 3
 */
export class ExaustaoEffect extends BaseEffect {
  static effectName = 'Exaustão';
  static compendiumName = 'cardigan.effects-cardigan';
  static _syncInProgress = new Set(); // Track actors being synced to prevent concurrent operations

  /**
   * Synchronize the Exaustão effect item based on hunger and thirst status levels
   * Adds the effect from compendium when hunger >= 3 OR thirst >= 3
   * Removes it when both are < 3
   * @param {Actor} actor - The actor to sync the effect for
   * @param {number} hungerLevel - The current hunger level (0-3)
   * @param {number} thirstLevel - The current thirst level (0-3)
   */
  static async syncEffect(actor, hungerLevel, thirstLevel) {
    // Only for characters
    if (actor.type !== 'character') return;

    // Prevent concurrent sync operations on the same actor
    if (this._syncInProgress.has(actor.id)) {
      console.log(`[${this.effectName} Sync] Sync already in progress for ${actor.name}, skipping`);
      return;
    }

    try {
      this._syncInProgress.add(actor.id);

      // Find existing Exaustão effect on the actor
      const existingEffect = actor.items.find(item => 
        item.type === 'efeito' && item.name === this.effectName
      );

      // Check if should have the effect: hunger >= 3 OR thirst >= 3
      const shouldHaveEffect = hungerLevel >= 3 || thirstLevel >= 3;

      if (shouldHaveEffect) {
        // Should have the effect
        if (!existingEffect) {
          await this._addEffectToActor(actor);
        }
      } else {
        // Should not have the effect (both hunger < 3 AND thirst < 3)
        if (existingEffect) {
          await existingEffect.delete();
          console.log(`[${this.effectName} Sync] Removed ${this.effectName} effect from ${actor.name}`);
        }
      }
    } finally {
      // Always remove the lock, even if an error occurred
      this._syncInProgress.delete(actor.id);
    }
  }

  /**
   * Add the Exaustão effect from compendium to the actor
   * @param {Actor} actor - The actor to add the effect to
   * @private
   */
  static async _addEffectToActor(actor) {
    // Double-check: verify effect doesn't already exist before adding
    const existingEffect = actor.items.find(item => 
      item.type === 'efeito' && item.name === this.effectName
    );
    
    if (existingEffect) {
      console.log(`[${this.effectName} Sync] Effect already exists on ${actor.name}, skipping add`);
      return;
    }

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
    effectData.system.rounds = 'infinito';
    await actor.createEmbeddedDocuments('Item', [effectData]);
    console.log(`[${this.effectName} Sync] Added ${this.effectName} effect to ${actor.name} with infinite rounds`);
  }

  /**
   * Called when the actor is updated
   * Checks if hunger or thirst status changed and syncs the effect
   * @param {Actor} actor - The actor being updated
   * @param {object} changed - The changed data
   * @param {string} userId - The user who initiated the update
   */
  static async onActorUpdate(actor, changed, userId) {
    // Only run on the user who initiated the update
    if (game.user.id !== userId) return;

    // Check if hunger or thirst status changed
    const hungerChanged = changed.system?.status?.hunger !== undefined;
    const thirstChanged = changed.system?.status?.thirst !== undefined;

    if (hungerChanged || thirstChanged) {
      // Get current levels (use changed value if updated, otherwise use current value)
      const hungerLevel = changed.system?.status?.hunger ?? actor.system.status?.hunger ?? 0;
      const thirstLevel = changed.system?.status?.thirst ?? actor.system.status?.thirst ?? 0;

      await this.syncEffect(actor, hungerLevel, thirstLevel);
    }
  }
}
