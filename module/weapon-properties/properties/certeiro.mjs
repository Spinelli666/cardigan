import { BaseWeaponProperty } from '../base-weapon-property.mjs';

/**
 * Certeiro - Reduz o Acerto Crítico em 1
 * Quando equipada, a arma facilita acertos críticos
 */
export class Certeiro extends BaseWeaponProperty {
  static get id() {
    return 'certeiro';
  }

  /**
   * Apply critical hit reduction when weapon is equipped
   * This is called during actor's prepareDerivedData
   * @param {Actor} actor - The actor who has this weapon equipped
   * @returns {number} Critical hit reduction value
   */
  static getCriticalHitModifier(actor) {
    // Check if this weapon is equipped in either hand
    const weapon = this.weapon;
    if (!weapon) return 0;

    const rightHandWeapon = actor.items.get(actor.system.combat?.rightHand);
    const leftHandWeapon = actor.items.get(actor.system.combat?.leftHand);

    // If this weapon is equipped in either hand, reduce critical hit by 1
    if (rightHandWeapon?.id === weapon.id || leftHandWeapon?.id === weapon.id) {
      return -1;
    }

    return 0;
  }
}
