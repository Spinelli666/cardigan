import { BaseWeaponProperty } from '../base-weapon-property.mjs';

/**
 * Traspassar - Causa enfraquecimento em acertos críticos
 * Quando um ataque crítico é realizado com esta arma, o defensor recebe o efeito Enfraquecido
 */
export class Traspassar extends BaseWeaponProperty {
  static get id() {
    return 'traspassar';
  }

  /**
   * Apply weakened effect when critical hit occurs
   * Called when the attack hits critically (attacker rolls critical)
   * @param {Actor} attacker - The attacking actor
   * @param {Actor} defender - The defending actor
   * @param {object} criticalData - Critical hit data with weapon info
   * @returns {Promise<void>}
   */
  async onCriticalHit(attacker, defender, criticalData) {
    if (!defender) {
      console.warn('[TRASPASSAR] No defender provided for critical hit');
      return;
    }

    await this.applyWeakened(defender, this.weapon?.name || 'arma com traspassar');
  }

  /**
   * Apply weakened effect to target actor
   * @param {Actor} targetActor - The actor to receive weakened effect
   * @param {string} weaponName - Name of the weapon that caused weakened
   * @returns {Promise<boolean>} Whether weakened was applied
   */
  async applyWeakened(targetActor, weaponName = 'arma') {
    if (!targetActor) {
      ui.notifications.error('Erro: Nenhum alvo encontrado para aplicar Enfraquecido');
      return false;
    }

    // Check if target already has Enfraquecido effect
    const hasEnfraquecido = targetActor.items.some(
      item => item.type === 'efeito' && item.name === 'Enfraquecido'
    );

    if (hasEnfraquecido) {
      if (game.user.isGM) {
        ui.notifications.info(`${targetActor.name} já está Enfraquecido!`);
      }
      return false;
    }

    // If current user is not GM, send socket request to GM
    if (!game.user.isGM) {
      game.socket.emit('system.cardigan', {
        type: 'applyWeakened',
        targetActorId: targetActor.id,
        weaponName: weaponName
      });
      return true; // Assume success, GM will handle it
    }

    // GM applies the effect directly
    try {
      // Get Enfraquecido effect from compendium
      const pack = game.packs.get('cardigan.efeitos-cardigan');
      if (!pack) {
        console.error('[TRASPASSAR] Compendium "cardigan.efeitos-cardigan" not found');
        ui.notifications.error('Erro: Compêndio de efeitos não encontrado');
        return false;
      }

      // Search for Enfraquecido effect
      const index = await pack.getIndex();
      const enfraquecidoEntry = index.find(i => i.name === 'Enfraquecido');
      
      if (!enfraquecidoEntry) {
        console.error('[TRASPASSAR] Enfraquecido effect not found in compendium');
        ui.notifications.error('Erro: Efeito Enfraquecido não encontrado no compêndio');
        return false;
      }

      // Get the full effect document
      const enfraquecidoEffect = await pack.getDocument(enfraquecidoEntry._id);
      
      // Create the effect on the target actor
      await targetActor.createEmbeddedDocuments('Item', [enfraquecidoEffect.toObject()]);
      
      // Notify GM
      ui.notifications.info(`💪 Enfraquecido aplicado em ${targetActor.name} por ${weaponName}!`);
      
      // Notify the defender's owner (if not GM)
      const defenderOwner = game.users.find(u => targetActor.testUserPermission(u, "OWNER") && !u.isGM);
      if (defenderOwner) {
        game.socket.emit('system.cardigan', {
          type: 'notifyWeakened',
          userId: defenderOwner.id,
          actorName: targetActor.name,
          weaponName: weaponName
        });
      }
      
      return true;
    } catch (error) {
      console.error('[TRASPASSAR] Error applying weakened effect:', error);
      ui.notifications.error(`Erro ao aplicar efeito Enfraquecido: ${error.message}`);
      return false;
    }
  }

  /**
   * Static helper to apply weakened from outside the property instance
   * Used by dialog callbacks that need to apply weakened directly
   * @param {Actor} targetActor - The actor to receive weakened effect
   * @param {string} weaponName - Name of the weapon that caused weakened
   * @returns {Promise<boolean>} Whether weakened was applied
   */
  static async applyWeakenedEffect(targetActor, weaponName = 'arma') {
    // Create a temporary instance to use the instance method
    const tempProperty = new Traspassar(null);
    return await tempProperty.applyWeakened(targetActor, weaponName);
  }
}
