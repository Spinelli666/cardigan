import { BaseWeaponProperty } from '../base-weapon-property.mjs';

/** Eletrocutar - Causa Eletrocutado no defensor em acertos críticos. */
export class Eletrocutar extends BaseWeaponProperty {
  static get id() { return 'eletrocutar'; }
  static get effectName() { return 'Eletrocutado'; }
  static get socketApplyType() { return 'applyShocked'; }
  static get socketNotifyType() { return 'notifyShocked'; }
  static get effectEmoji() { return '⚡'; }
  static get logTag() { return '[ELETROCUTAR]'; }
  static get defaultWeaponName() { return 'arma elétrica'; }

  /** @param {Actor} targetActor @param {string} [weaponName] @returns {Promise<boolean>} */
  static async applyShockedEffect(targetActor, weaponName = 'arma') {
    return Eletrocutar.applyCompendiumEffectStatic(targetActor, weaponName);
  }
}
