import { BaseWeaponProperty } from '../base-weapon-property.mjs';

/** Incendiar - Causa Incendiado no defensor em acertos críticos. */
export class Incendiar extends BaseWeaponProperty {
  static get id() { return 'ignite'; }
  static get effectName() { return 'Incendiado'; }
  static get socketApplyType() { return 'applyBurning'; }
  static get socketNotifyType() { return 'notifyBurning'; }
  static get effectEmoji() { return '🔥'; }
  static get logTag() { return '[IGNITE]'; }
  static get defaultWeaponName() { return 'arma incendiária'; }

  /** @param {Actor} targetActor @param {string} [weaponName] @returns {Promise<boolean>} */
  static async applyBurningEffect(targetActor, weaponName = 'arma') {
    return Incendiar.applyCompendiumEffectStatic(targetActor, weaponName);
  }
}
