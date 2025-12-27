import { BaseWeaponProperty } from '../base-weapon-property.mjs';

/**
 * Incendiar - Incendeia o alvo em acertos críticos
 * Quando um ataque crítico é realizado com esta arma, o defensor recebe o efeito Incendiado
 */
export class Incendiar extends BaseWeaponProperty {
  static get id() {
    return 'incendiar';
  }

  /**
   * Apply burning effect when critical hit occurs
   * Called when the attack hits critically (attacker rolls critical)
   * @param {Actor} attacker - The attacking actor
   * @param {Actor} defender - The defending actor
   * @param {object} criticalData - Critical hit data with weapon info
   * @returns {Promise<void>}
   */
  async onCriticalHit(attacker, defender, criticalData) {
    if (!defender) {
      console.warn('[INCENDIAR] No defender provided for critical hit');
      return;
    }

    await this.applyBurning(defender, this.weapon?.name || 'arma incendiária');
  }

  /**
   * Apply burning effect to target actor
   * @param {Actor} targetActor - The actor to receive burning effect
   * @param {string} weaponName - Name of the weapon that caused burning
   * @returns {Promise<boolean>} Whether burning was applied
   */
  async applyBurning(targetActor, weaponName = 'arma') {
    if (!targetActor) {
      ui.notifications.error('Erro: Nenhum alvo encontrado para aplicar Incendiado');
      return false;
    }

    // Check if target already has Incendiado effect
    const hasIncendiado = targetActor.items.some(
      item => item.type === 'efeito' && item.name === 'Incendiado'
    );

    if (hasIncendiado) {
      if (game.user.isGM) {
        ui.notifications.info(`${targetActor.name} já está Incendiado!`);
      }
      return false;
    }

    // If current user is not GM, send socket request to GM
    if (!game.user.isGM) {
      game.socket.emit('system.cardigan', {
        type: 'applyBurning',
        targetActorId: targetActor.id,
        weaponName: weaponName
      });
      return true; // Assume success, GM will handle it
    }

    // GM applies the effect directly
    try {
      // Get Incendiado effect from compendium
      const pack = game.packs.get('cardigan.efeitos-cardigan');
      if (!pack) {
        console.error('[INCENDIAR] Compendium "cardigan.efeitos-cardigan" not found');
        ui.notifications.error('Erro: Compêndio de efeitos não encontrado');
        return false;
      }

      // Search for Incendiado effect
      const index = await pack.getIndex();
      const incendiadoEntry = index.find(i => i.name === 'Incendiado');
      
      if (!incendiadoEntry) {
        console.error('[INCENDIAR] Incendiado effect not found in compendium');
        ui.notifications.error('Erro: Efeito Incendiado não encontrado no compêndio');
        return false;
      }

      // Get the full effect document
      const incendiadoEffect = await pack.getDocument(incendiadoEntry._id);
      
      // Create the effect on the target actor
      await targetActor.createEmbeddedDocuments('Item', [incendiadoEffect.toObject()]);
      
      // Notify GM
      ui.notifications.info(`🔥 Incendiado aplicado em ${targetActor.name} por ${weaponName}!`);
      
      // Notify the defender's owner (if not GM)
      const defenderOwner = game.users.find(u => targetActor.testUserPermission(u, "OWNER") && !u.isGM);
      if (defenderOwner) {
        game.socket.emit('system.cardigan', {
          type: 'notifyBurning',
          userId: defenderOwner.id,
          actorName: targetActor.name,
          weaponName: weaponName
        });
      }
      
      return true;
    } catch (error) {
      console.error('[INCENDIAR] Error applying burning effect:', error);
      ui.notifications.error(`Erro ao aplicar efeito Incendiado: ${error.message}`);
      return false;
    }
  }

  /**
   * Static helper to apply burning from outside the property instance
   * Used by dialog callbacks that need to apply burning directly
   * @param {Actor} targetActor - The actor to receive burning effect
   * @param {string} weaponName - Name of the weapon that caused burning
   * @returns {Promise<boolean>} Whether burning was applied
   */
  static async applyBurningEffect(targetActor, weaponName = 'arma') {
    // Create a temporary instance to use the instance method
    const tempProperty = new Incendiar(null);
    return await tempProperty.applyBurning(targetActor, weaponName);
  }
}
