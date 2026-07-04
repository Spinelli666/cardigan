import { BaseWeaponProperty } from '../base-weapon-property.mjs';

/** Contundente - Causa Caído no defensor em acertos críticos. */
export class Contundente extends BaseWeaponProperty {
  static get id() { return 'contundente'; }
  static get effectName() { return 'Caído'; }
  static get socketApplyType() { return 'applyProne'; }
  static get socketNotifyType() { return 'notifyProne'; }
  static get effectEmoji() { return '🔽'; }
  static get logTag() { return '[CONTUNDENTE]'; }
  static get defaultWeaponName() { return 'arma contundente'; }

  /** @param {Actor} targetActor @param {string} [weaponName] @returns {Promise<boolean>} */
  static async applyProneEffect(targetActor, weaponName = 'arma') {
    return Contundente.applyCompendiumEffectStatic(targetActor, weaponName);
  }
}
