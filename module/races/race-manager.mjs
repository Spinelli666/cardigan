/**
 * Race Manager - Handles loading and managing custom race implementations
 */
export default class RaceManager {
  /**
   * Registry of custom race implementations
   * @type {Map<string, Class>}
   */
  static #registry = new Map();

  /**
   * Register a custom race implementation
   * @param {string} raceName - The name of the race
   * @param {Class} raceClass - The race class implementation
   */
  static register(raceName, raceClass) {
    const key = raceName.toLowerCase();
    this.#registry.set(key, raceClass);
    console.log(`[RaceManager] Registered race: "${raceName}"`);
  }

  /**
   * Get list of registered race names (for debugging)
   * @returns {string[]}
   */
  static getRegisteredRaces() {
    return Array.from(this.#registry.keys());
  }

  /**
   * Get the implementation for a race
   * @param {Item} raceItem - The race item document
   * @returns {Promise<BaseRace>}
   */
  static async getRace(raceItem) {
    const raceName = raceItem.name.toLowerCase();
    console.log(`[RaceManager] Looking for race: "${raceName}"`);
    
    const RaceClass = this.#registry.get(raceName);
    
    if (RaceClass) {
      console.log(`[RaceManager] Found custom race for: ${raceName}`);
      return new RaceClass(raceItem);
    }

    console.log(`[RaceManager] No custom race found for: ${raceName}, using BaseRace`);
    // Return base implementation if no custom one exists
    const { default: BaseRace } = await import('./base-race.mjs');
    return new BaseRace(raceItem);
  }

  /**
   * Apply race bonuses when a race is added to an actor
   * @param {Item} raceItem - The race item to apply
   * @param {Actor} actor - The actor to apply the race to
   * @returns {Promise<void>}
   */
  static async applyRace(raceItem, actor) {
    console.log(`[RaceManager] Applying race "${raceItem.name}" to ${actor.name}`);
    const race = await this.getRace(raceItem);
    await race.onAdd(actor);
  }

  /**
   * Remove race bonuses when a race is removed from an actor
   * @param {Item} raceItem - The race item to remove
   * @param {Actor} actor - The actor to remove the race from
   * @returns {Promise<void>}
   */
  static async removeRace(raceItem, actor) {
    console.log(`[RaceManager] Removing race "${raceItem.name}" from ${actor.name}`);
    const race = await this.getRace(raceItem);
    await race.onRemove(actor);
  }

  /**
   * Prepare derived data for an actor with a race
   * @param {Item} raceItem - The race item
   * @param {Actor} actor - The actor with this race
   * @returns {Promise<void>}
   */
  static async prepareDerivedData(raceItem, actor) {
    const race = await this.getRace(raceItem);
    await race.prepareDerivedData(actor);
  }
}
