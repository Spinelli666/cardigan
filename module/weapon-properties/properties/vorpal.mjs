import { BaseWeaponProperty } from '../base-weapon-property.mjs';

/**
 * Vorpal - Ao ser empunhado em duas mãos causa +4 de dano físico adicional
 * Quando equipada com ambas as mãos (rightHand && leftHand), adiciona +4 ao dano
 */
export class Vorpal extends BaseWeaponProperty {
  static get id() {
    return 'vorpal';
  }

  /**
   * Check if weapon is wielded in both hands
   * @param {Item} weapon - The weapon item
   * @returns {boolean} True if weapon is in both hands
   */
  static isWieldedInBothHands(weapon) {
    return weapon.system.rightHand && weapon.system.leftHand;
  }

  /**
   * Get damage bonus from Vorpal when wielded in both hands
   * @param {Item} weapon - The weapon item
   * @returns {number} Damage bonus (+4 if both hands, 0 otherwise)
   */
  static getDamageBonus(weapon) {
    if (!weapon) return 0;
    
    // Check if weapon has vorpal property
    const hasVorpal = weapon.system.properties?.includes('vorpal');
    if (!hasVorpal) return 0;
    
    // Check if wielded in both hands
    if (this.isWieldedInBothHands(weapon)) {
      return 4;
    }
    
    return 0;
  }
}
