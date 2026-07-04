import { BaseWeaponProperty } from '../base-weapon-property.mjs';

/** Traspassar - Causa Enfraquecido no defensor em acertos críticos. */
export class Traspassar extends BaseWeaponProperty {
  static get id() { return 'pierce'; }
  static get effectName() { return 'Enfraquecido'; }
  static get socketApplyType() { return 'applyWeakened'; }
  static get socketNotifyType() { return 'notifyWeakened'; }
  static get effectEmoji() { return '💪'; }
  static get logTag() { return '[PIERCE]'; }
  static get defaultWeaponName() { return 'arma com traspassar'; }

  /** @param {Actor} targetActor @param {string} [weaponName] @returns {Promise<boolean>} */
  static async applyWeakenedEffect(targetActor, weaponName = 'arma') {
    return Traspassar.applyCompendiumEffectStatic(targetActor, weaponName);
  }
}
