/**
 * Base class for weapon properties
 * Each property can hook into the attack flow to modify behavior
 */
export class BaseWeaponProperty {
  /**
   * @param {Item} weapon - The weapon item that has this property
   */
  constructor(weapon) {
    this.weapon = weapon;
  }

  /**
   * Get the property ID (e.g., "perfurar", "vorpal")
   * @returns {string}
   */
  static get id() {
    throw new Error('Property ID must be defined in subclass');
  }

  /**
   * Called before an attack roll is made
   * @param {Actor} attacker - The attacking actor
   * @param {Actor} defender - The defending actor
   * @param {object} attackData - Attack data that can be modified
   * @returns {Promise<void>}
   */
  async onBeforeAttack(attacker, defender, attackData) {
    // Override in subclass if needed
  }

  /**
   * Called after attack roll but before damage
   * @param {Actor} attacker - The attacking actor
   * @param {Actor} defender - The defending actor
   * @param {object} attackResult - Attack result with roll data
   * @returns {Promise<void>}
   */
  async onAfterAttack(attacker, defender, attackResult) {
    // Override in subclass if needed
  }

  /**
   * Called when calculating damage
   * @param {Actor} attacker - The attacking actor
   * @param {Actor} defender - The defending actor
   * @param {object} damageData - Damage data that can be modified
   * @returns {Promise<void>}
   */
  async onCalculateDamage(attacker, defender, damageData) {
    // Override in subclass if needed
  }

  /**
   * Called when applying damage to defender
   * @param {Actor} attacker - The attacking actor
   * @param {Actor} defender - The defending actor
   * @param {object} damageData - Final damage data
   * @returns {Promise<void>}
   */
  async onApplyDamage(attacker, defender, damageData) {
    // Override in subclass if needed
  }

  /**
   * Called on critical hit
   * @param {Actor} attacker - The attacking actor
   * @param {Actor} defender - The defending actor
   * @param {object} criticalData - Critical hit data
   * @returns {Promise<void>}
   */
  async onCriticalHit(attacker, defender, criticalData) {
    // Override in subclass if needed
  }
}
