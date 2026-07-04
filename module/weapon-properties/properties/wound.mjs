import { BaseWeaponProperty } from '../base-weapon-property.mjs';

/** Ferir - Causa Sangramento no defensor em acertos críticos. */
export class Ferir extends BaseWeaponProperty {
  static get id() { return 'wound'; }
  static get effectName() { return 'Sangramento'; }
  static get socketApplyType() { return 'applyBleeding'; }
  static get socketNotifyType() { return 'notifyBleeding'; }
  static get effectEmoji() { return '💉'; }
  static get logTag() { return '[WOUND]'; }
  static get defaultWeaponName() { return 'arma com ferir'; }

  /** @param {Actor} targetActor @param {string} [weaponName] @returns {Promise<boolean>} */
  static async applyBleedingEffect(targetActor, weaponName = 'arma') {
    return Ferir.applyCompendiumEffectStatic(targetActor, weaponName);
  }
}
