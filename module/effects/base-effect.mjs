/**
 * Base class for all effects in the Cardigan system.
 * Provides common functionality that can be extended by specific effect implementations.
 */
export default class BaseEffect {
  /**
   * @param {Item} item - The effect item document
   */
  constructor(item) {
    this.item = item;
  }

  /**
   * Get the effect's configuration
   * @returns {Object}
   */
  get config() {
    return this.item.system;
  }

  /**
   * Check if the effect is active
   * @returns {boolean}
   */
  get isActive() {
    // Future: implement active state tracking
    return true;
  }

  /**
   * Apply the effect to an actor
   * @param {Actor} actor - The actor to apply the effect to
   * @returns {Promise<void>}
   */
  async apply(actor) {
    // Future: implement effect application logic
    console.log(`Applying effect ${this.item.name} to ${actor.name}`);
  }

  /**
   * Remove the effect from an actor
   * @param {Actor} actor - The actor to remove the effect from
   * @returns {Promise<void>}
   */
  async remove(actor) {
    // Future: implement effect removal logic
    console.log(`Removing effect ${this.item.name} from ${actor.name}`);
  }

  /**
   * Update the effect each turn
   * @param {Actor} actor - The actor with this effect
   * @returns {Promise<void>}
   */
  async onTurnStart(actor) {
    // Future: implement turn-based effect updates
  }

  /**
   * Handle effect duration expiration
   * @param {Actor} actor - The actor with this effect
   * @returns {Promise<void>}
   */
  async onExpire(actor) {
    // Future: implement expiration logic
    await this.remove(actor);
  }
}
