/**
 * Effect Manager - Handles loading and managing custom effect implementations
 */
export default class EffectManager {
  /**
   * Registry of custom effect implementations
   * @type {Map<string, Class>}
   */
  static #registry = new Map();

  /**
   * Register a custom effect implementation
   * @param {string} effectName - The name of the effect
   * @param {Class} effectClass - The effect class implementation
   */
  static register(effectName, effectClass) {
    const key = effectName.toLowerCase();
    this.#registry.set(key, effectClass);
    console.log(`[EffectManager] Registered effect: "${key}"`);
  }

  /**
   * Get list of registered effect names (for debugging)
   * @returns {string[]}
   */
  static getRegisteredEffects() {
    return Array.from(this.#registry.keys());
  }

  /**
   * Get the implementation for an effect
   * @param {Item} effectItem - The effect item document
   * @returns {Promise<BaseEffect>}
   */
  static async getEffect(effectItem) {
    const effectName = effectItem.name.toLowerCase();
    console.log(`[EffectManager] Looking for effect: "${effectName}"`);
    console.log(`[EffectManager] Registry has:`, Array.from(this.#registry.keys()));
    
    const EffectClass = this.#registry.get(effectName);
    
    if (EffectClass) {
      console.log(`[EffectManager] Found custom effect for: ${effectName}`);
      return new EffectClass(effectItem);
    }

    console.log(`[EffectManager] No custom effect found for: ${effectName}, using BaseEffect`);
    // Return base implementation if no custom one exists
    const { default: BaseEffect } = await import('./base-effect.mjs');
    return new BaseEffect(effectItem);
  }

  /**
   * Load all custom effect implementations from the effects folder
   * @returns {Promise<void>}
   */
  static async loadEffects() {
    // Future: dynamically load effect files from module/effects/effects/
    console.log('Effect Manager: Ready for custom effect implementations');
  }

  /**
   * Apply an effect to an actor
   * @param {Item} effectItem - The effect item to apply
   * @param {Actor} actor - The actor to apply the effect to
   * @returns {Promise<void>}
   */
  static async applyEffect(effectItem, actor) {
    console.log(`[EffectManager] Applying effect "${effectItem.name}" to ${actor.name}`);
    const effect = await this.getEffect(effectItem);
    await effect.apply(actor);
  }

  /**
   * Remove an effect from an actor
   * @param {Item} effectItem - The effect item to remove
   * @param {Actor} actor - The actor to remove the effect from
   * @returns {Promise<void>}
   */
  static async removeEffect(effectItem, actor) {
    console.log(`[EffectManager] Removing effect "${effectItem.name}" from ${actor.name}`);
    const effect = await this.getEffect(effectItem);
    await effect.remove(actor);
  }
}

