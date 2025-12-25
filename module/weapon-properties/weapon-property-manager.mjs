/**
 * Manages weapon properties registration and application
 */
export class WeaponPropertyManager {
  static #properties = new Map();

  /**
   * Register a weapon property class
   * @param {typeof BaseWeaponProperty} PropertyClass - The property class to register
   */
  static register(PropertyClass) {
    const id = PropertyClass.id;
    if (!id) {
      console.error('Cannot register property without ID:', PropertyClass);
      return;
    }
    this.#properties.set(id, PropertyClass);
    console.log(`[CARDIGAN] Registered weapon property: ${id}`);
  }

  /**
   * Get a property class by ID
   * @param {string} propertyId - The property ID
   * @returns {typeof BaseWeaponProperty|null}
   */
  static getProperty(propertyId) {
    return this.#properties.get(propertyId) || null;
  }

  /**
   * Get all registered property IDs
   * @returns {string[]}
   */
  static getAllPropertyIds() {
    return Array.from(this.#properties.keys());
  }

  /**
   * Create property instances for a weapon
   * @param {Item} weapon - The weapon item
   * @returns {BaseWeaponProperty[]}
   */
  static getPropertiesForWeapon(weapon) {
    if (!weapon.system.properties || !Array.isArray(weapon.system.properties)) {
      return [];
    }

    const instances = [];
    for (const propertyId of weapon.system.properties) {
      const PropertyClass = this.getProperty(propertyId);
      if (PropertyClass) {
        instances.push(new PropertyClass(weapon));
      }
    }
    return instances;
  }

  /**
   * Apply property hooks at a specific stage
   * @param {string} hook - Hook name (e.g., "onBeforeAttack")
   * @param {Item} weapon - The weapon item
   * @param {...any} args - Arguments to pass to the hook
   * @returns {Promise<void>}
   */
  static async applyPropertyHook(hook, weapon, ...args) {
    const properties = this.getPropertiesForWeapon(weapon);
    for (const property of properties) {
      if (typeof property[hook] === 'function') {
        await property[hook](...args);
      }
    }
  }
}
