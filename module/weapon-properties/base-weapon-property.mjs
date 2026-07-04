/**
 * Base class for weapon properties.
 * Each property hooks into the attack flow to modify behavior.
 *
 * Subclasses that apply a compendium effect on critical hit only need to declare
 * the six static getter fields below and keep backward-compat aliases — the shared
 * applyCompendiumEffect() and onCriticalHit() implementations handle the rest.
 */
export class BaseWeaponProperty {
  /**
   * @param {Item} weapon - The weapon item that has this property
   */
  constructor(weapon) {
    this.weapon = weapon;
  }

  /**
   * Unique property ID (e.g., "ferir", "vorpal"). Must be defined in subclass.
   * @returns {string}
   */
  static get id() {
    throw new Error('Property ID must be defined in subclass');
  }

  // --- Template method fields for compendium-effect properties ---
  // Override these in subclasses that apply a compendium effect on critical hit.

  /** Name of the compendium effect to apply (e.g., 'Sangramento'). */
  static get effectName() { return null; }

  /** Socket message type requesting GM to apply the effect (e.g., 'applyBleeding'). */
  static get socketApplyType() { return null; }

  /** Socket message type notifying the defender's owner (e.g., 'notifyBleeding'). */
  static get socketNotifyType() { return null; }

  /** Emoji shown in the GM notification message (e.g., '💉'). */
  static get effectEmoji() { return ''; }

  /** Console log prefix (e.g., '[FERIR]'). */
  static get logTag() { return '[PROPERTY]'; }

  /** Fallback weapon name used when this.weapon has no name. */
  static get defaultWeaponName() { return 'arma'; }

  // --- Attack lifecycle hooks ---

  /**
   * Called before an attack roll is made.
   * @param {Actor} attacker
   * @param {Actor} defender
   * @param {object} attackData - Attack data that can be modified
   */
  async onBeforeAttack(attacker, defender, attackData) {}

  /**
   * Called after attack roll but before damage.
   * @param {Actor} attacker
   * @param {Actor} defender
   * @param {object} attackResult
   */
  async onAfterAttack(attacker, defender, attackResult) {}

  /**
   * Called when calculating damage.
   * @param {Actor} attacker
   * @param {Actor} defender
   * @param {object} damageData - Damage data that can be modified
   */
  async onCalculateDamage(attacker, defender, damageData) {}

  /**
   * Called when applying damage to defender.
   * @param {Actor} attacker
   * @param {Actor} defender
   * @param {object} damageData
   */
  async onApplyDamage(attacker, defender, damageData) {}

  /**
   * Called on critical hit.
   * Default implementation calls applyCompendiumEffect() when effectName is declared.
   * Subclasses with custom behaviour (e.g. Impacto) should override this method.
   * @param {Actor} attacker
   * @param {Actor} defender
   * @param {object} criticalData
   */
  async onCriticalHit(attacker, defender, criticalData) {
    if (!this.constructor.effectName) return;
    if (!defender) {
      console.warn(`${this.constructor.logTag} No defender provided for critical hit`);
      return;
    }
    await this.applyCompendiumEffect(defender, this.weapon?.name || this.constructor.defaultWeaponName);
  }

  // --- Shared compendium-effect application ---

  /**
   * Apply a named effect from the efeitos-cardigan compendium to a target actor.
   * Handles the GM check, duplicate guard, socket delegation to GM when needed,
   * and owner notification after the effect is applied.
   * Requires effectName, socketApplyType, socketNotifyType, effectEmoji and logTag
   * to be declared on the subclass.
   * @param {Actor} targetActor
   * @param {string} [weaponName]
   * @returns {Promise<boolean>} Whether the effect was applied (or queued for GM)
   */
  async applyCompendiumEffect(targetActor, weaponName = 'arma') {
    const { effectName, socketApplyType, socketNotifyType, effectEmoji, logTag } = this.constructor;

    if (!targetActor) {
      ui.notifications.error(`Erro: Nenhum alvo encontrado para aplicar ${effectName}`);
      return false;
    }

    const hasEffect = targetActor.items.some(
      item => item.type === 'efeito' && item.name === effectName
    );
    if (hasEffect) {
      if (game.user.isGM) ui.notifications.info(`${targetActor.name} já está com ${effectName}!`);
      return false;
    }

    if (!game.user.isGM) {
      game.socket.emit('system.cardigan', {
        type: socketApplyType,
        targetActorId: targetActor.id,
        weaponName
      });
      return true;
    }

    try {
      const pack = game.packs.get('cardigan.efeitos-cardigan');
      if (!pack) {
        console.error(`${logTag} Compendium "cardigan.efeitos-cardigan" not found`);
        ui.notifications.error('Erro: Compêndio de efeitos não encontrado');
        return false;
      }

      const index = await pack.getIndex();
      const entry = index.find(i => i.name === effectName);
      if (!entry) {
        console.error(`${logTag} ${effectName} effect not found in compendium`);
        ui.notifications.error(`Erro: Efeito ${effectName} não encontrado no compêndio`);
        return false;
      }

      const effect = await pack.getDocument(entry._id);
      await targetActor.createEmbeddedDocuments('Item', [effect.toObject()]);

      ui.notifications.info(`${effectEmoji} ${effectName} aplicado em ${targetActor.name} por ${weaponName}!`);

      const defenderOwner = game.users.find(u => targetActor.testUserPermission(u, "OWNER") && !u.isGM);
      if (defenderOwner) {
        game.socket.emit('system.cardigan', {
          type: socketNotifyType,
          userId: defenderOwner.id,
          actorName: targetActor.name,
          weaponName
        });
      }

      return true;
    } catch (error) {
      console.error(`${logTag} Error applying ${effectName} effect:`, error);
      ui.notifications.error(`Erro ao aplicar efeito ${effectName}: ${error.message}`);
      return false;
    }
  }

  /**
   * Apply the compendium effect without needing a weapon instance.
   * Delegates to applyCompendiumEffect() on a temporary instance.
   * @param {Actor} targetActor
   * @param {string} [weaponName]
   * @returns {Promise<boolean>}
   */
  static async applyCompendiumEffectStatic(targetActor, weaponName = 'arma') {
    return new this(null).applyCompendiumEffect(targetActor, weaponName);
  }
}
