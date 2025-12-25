/**
 * Base class for all race implementations in the Cardigan system.
 * Provides common functionality that can be extended by specific race implementations.
 */
export default class BaseRace {
  /**
   * @param {Item} item - The race item document
   */
  constructor(item) {
    this.item = item;
  }

  /**
   * Get the race's configuration
   * @returns {Object}
   */
  get config() {
    return this.item.system;
  }

  /**
   * Apply the race bonuses to an actor
   * Called when the race item is added to an actor
   * @param {Actor} actor - The actor to apply the race to
   * @returns {Promise<void>}
   */
  async onAdd(actor) {
    console.log(`[BaseRace] Adding race ${this.item.name} to ${actor.name}`);
    // Base implementation - subclasses can override
  }

  /**
   * Remove the race bonuses from an actor
   * Called when the race item is removed from an actor
   * @param {Actor} actor - The actor to remove the race from
   * @returns {Promise<void>}
   */
  async onRemove(actor) {
    console.log(`[BaseRace] Removing race ${this.item.name} from ${actor.name}`);
    // Base implementation - subclasses can override
  }

  /**
   * Update actor data when race is present
   * Called during actor data preparation
   * @param {Actor} actor - The actor with this race
   * @returns {Promise<void>}
   */
  async prepareDerivedData(actor) {
    // Base implementation - subclasses can override
  }
}
