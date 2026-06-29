import BaseEffect from '../base-effect.mjs';

/**
 * Toxicidade Effect
 * Automatically applies Inconsciente・Sono and Intoxicado effects when toxicity reaches level 5
 * Effects are removed automatically when toxicity drops below 5
 */
export class ToxicidadeEffect extends BaseEffect {
  static effectName = 'Toxicidade';
  static compendiumName = 'cardigan.efeitos-cardigan';
  static _syncInProgress = new Set(); // Track actors being synced to prevent concurrent operations

  /**
   * Synchronize toxicity effects based on toxicity level
   * Adds Inconsciente・Sono and Intoxicado effects when toxicity === 5
   * Removes them when toxicity < 5
   * @param {Actor} actor - The actor to sync effects for
   * @param {number} toxicityLevel - The current toxicity level (0-5)
   */
  static async syncEffect(actor, toxicityLevel) {
    // Only for characters
    if (actor.type !== 'character') return;

    // Prevent concurrent sync operations on the same actor
    if (this._syncInProgress.has(actor.id)) {
      console.log(`[${this.effectName} Sync] Sync already in progress for ${actor.name}, skipping`);
      return;
    }

    try {
      this._syncInProgress.add(actor.id);

      // Check if should have toxicity effects (level 5 = fatal poisoning)
      const shouldHaveEffects = toxicityLevel === 5;

      // Find existing toxicity effect items on actor
      const inconscienteEffect = actor.items.find(item => 
        item.type === 'efeito' && item.name === 'Inconsciente・Sono'
      );
      const intoxicadoEffect = actor.items.find(item => 
        item.type === 'efeito' && item.name === 'Intoxicado'
      );

      if (shouldHaveEffects) {
        // Should have effects - add if not present
        if (!inconscienteEffect) {
          await this._addEffectToActor(actor, 'Inconsciente・Sono');
        }
        if (!intoxicadoEffect) {
          await this._addEffectToActor(actor, 'Intoxicado');
        }
      } else {
        // Should not have effects - remove if present
        if (inconscienteEffect) {
          await inconscienteEffect.delete();
          console.log(`[${this.effectName} Sync] Removed Inconsciente・Sono from ${actor.name}`);
        }
        if (intoxicadoEffect) {
          await intoxicadoEffect.delete();
          console.log(`[${this.effectName} Sync] Removed Intoxicado from ${actor.name}`);
        }
      }
    } catch (error) {
      console.error(`[${this.effectName} Sync] Error syncing toxicity effects:`, error);
    } finally {
      // Always remove the lock, even if an error occurred
      this._syncInProgress.delete(actor.id);
    }
  }

  /**
   * Add a toxicity effect item from compendium to the actor
   * @param {Actor} actor - The actor to add the effect to
   * @param {string} effectName - Name of the effect to add
   * @private
   */
  static async _addEffectToActor(actor, effectName) {
    // Get effect from compendium
    const pack = game.packs.get(this.compendiumName);
    if (!pack) {
      console.error(`[${this.effectName} Sync] Could not find ${this.compendiumName} compendium`);
      return;
    }

    const effectIndex = pack.index.find(e => e.name === effectName);
    if (!effectIndex) {
      console.error(`[${this.effectName} Sync] Could not find ${effectName} effect in compendium`);
      return;
    }

    // Load the full document
    const effectDoc = await pack.getDocument(effectIndex._id);
    if (!effectDoc) {
      console.error(`[${this.effectName} Sync] Could not load ${effectName} effect document`);
      return;
    }

    // Add to actor as Item with infinite rounds (since it's from checkbox)
    const effectData = effectDoc.toObject();
    effectData.system.rodadas = 'infinito';
    await actor.createEmbeddedDocuments('Item', [effectData]);
    console.log(`[${this.effectName} Sync] Added ${effectName} effect to ${actor.name} with infinite rounds`);
  }

  /**
   * Called when the actor is updated
   * Checks if toxicity status changed and syncs effects accordingly
   * @param {Actor} actor - The actor being updated
   * @param {object} changed - The changed data
   * @param {string} userId - The user who initiated the update
   */
  static async onActorUpdate(actor, changed, userId) {
    // Only run on the user who initiated the update
    if (game.user.id !== userId) return;

    // Check if toxicity status changed
    if (changed.system?.status?.toxicity !== undefined) {
      await this.syncEffect(actor, changed.system.status.toxicity);
    }
  }
}
