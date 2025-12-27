import { BaseWeaponProperty } from '../base-weapon-property.mjs';

/**
 * Eletrocutar - Eletrocuta o alvo em acertos críticos
 * Quando um ataque crítico é realizado com esta arma, o defensor recebe o efeito Eletrocutado
 */
export class Eletrocutar extends BaseWeaponProperty {
  static get id() {
    return 'eletrocutar';
  }

  /**
   * Apply shocked effect when critical hit occurs
   * Called when the attack hits critically (attacker rolls critical)
   * @param {Actor} attacker - The attacking actor
   * @param {Actor} defender - The defending actor
   * @param {object} criticalData - Critical hit data with weapon info
   * @returns {Promise<void>}
   */
  async onCriticalHit(attacker, defender, criticalData) {
    if (!defender) {
      console.warn('[ELETROCUTAR] No defender provided for critical hit');
      return;
    }

    await this.applyShocked(defender, this.weapon?.name || 'arma elétrica');
  }

  /**
   * Apply shocked effect to target actor
   * @param {Actor} targetActor - The actor to receive shocked effect
   * @param {string} weaponName - Name of the weapon that caused shocked
   * @returns {Promise<boolean>} Whether shocked was applied
   */
  async applyShocked(targetActor, weaponName = 'arma') {
    if (!targetActor) {
      ui.notifications.error('Erro: Nenhum alvo encontrado para aplicar Eletrocutado');
      return false;
    }

    // Check if target already has Eletrocutado effect
    const hasEletrocutado = targetActor.items.some(
      item => item.type === 'efeito' && item.name === 'Eletrocutado'
    );

    if (hasEletrocutado) {
      if (game.user.isGM) {
        ui.notifications.info(`${targetActor.name} já está Eletrocutado!`);
      }
      return false;
    }

    // If current user is not GM, send socket request to GM
    if (!game.user.isGM) {
      game.socket.emit('system.cardigan', {
        type: 'applyShocked',
        targetActorId: targetActor.id,
        weaponName: weaponName
      });
      return true; // Assume success, GM will handle it
    }

    // GM applies the effect directly
    try {
      // Get Eletrocutado effect from compendium
      const pack = game.packs.get('cardigan.efeitos-cardigan');
      if (!pack) {
        console.error('[ELETROCUTAR] Compendium "cardigan.efeitos-cardigan" not found');
        ui.notifications.error('Erro: Compêndio de efeitos não encontrado');
        return false;
      }

      // Search for Eletrocutado effect
      const index = await pack.getIndex();
      const eletrocutadoEntry = index.find(i => i.name === 'Eletrocutado');
      
      if (!eletrocutadoEntry) {
        console.error('[ELETROCUTAR] Eletrocutado effect not found in compendium');
        ui.notifications.error('Erro: Efeito Eletrocutado não encontrado no compêndio');
        return false;
      }

      // Get the full effect document
      const eletrocutadoEffect = await pack.getDocument(eletrocutadoEntry._id);
      
      // Create the effect on the target actor
      await targetActor.createEmbeddedDocuments('Item', [eletrocutadoEffect.toObject()]);
      
      // Notify GM
      ui.notifications.info(`⚡ Eletrocutado aplicado em ${targetActor.name} por ${weaponName}!`);
      
      // Notify the defender's owner (if not GM)
      const defenderOwner = game.users.find(u => targetActor.testUserPermission(u, "OWNER") && !u.isGM);
      if (defenderOwner) {
        game.socket.emit('system.cardigan', {
          type: 'notifyShocked',
          userId: defenderOwner.id,
          actorName: targetActor.name,
          weaponName: weaponName
        });
      }
      
      return true;
    } catch (error) {
      console.error('[ELETROCUTAR] Error applying shocked effect:', error);
      ui.notifications.error(`Erro ao aplicar efeito Eletrocutado: ${error.message}`);
      return false;
    }
  }

  /**
   * Static helper to apply shocked from outside the property instance
   * Used by dialog callbacks that need to apply shocked directly
   * @param {Actor} targetActor - The actor to receive shocked effect
   * @param {string} weaponName - Name of the weapon that caused shocked
   * @returns {Promise<boolean>} Whether shocked was applied
   */
  static async applyShockedEffect(targetActor, weaponName = 'arma') {
    // Create a temporary instance to use the instance method
    const tempProperty = new Eletrocutar(null);
    return await tempProperty.applyShocked(targetActor, weaponName);
  }
}
