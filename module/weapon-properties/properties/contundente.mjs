import { BaseWeaponProperty } from '../base-weapon-property.mjs';

/**
 * Contundente - Derruba o alvo em acertos críticos
 * Quando um ataque crítico é realizado com esta arma, o defensor recebe o efeito Caído
 */
export class Contundente extends BaseWeaponProperty {
  static get id() {
    return 'contundente';
  }

  /**
   * Apply prone effect when critical hit occurs
   * Called when the attack hits critically (attacker rolls critical)
   * @param {Actor} attacker - The attacking actor
   * @param {Actor} defender - The defending actor
   * @param {object} criticalData - Critical hit data with weapon info
   * @returns {Promise<void>}
   */
  async onCriticalHit(attacker, defender, criticalData) {
    if (!defender) {
      console.warn('[CONTUNDENTE] No defender provided for critical hit');
      return;
    }

    await this.applyProne(defender, this.weapon?.name || 'arma contundente');
  }

  /**
   * Apply prone effect to target actor
   * @param {Actor} targetActor - The actor to receive prone effect
   * @param {string} weaponName - Name of the weapon that caused prone
   * @returns {Promise<boolean>} Whether prone was applied
   */
  async applyProne(targetActor, weaponName = 'arma') {
    if (!targetActor) {
      ui.notifications.error('Erro: Nenhum alvo encontrado para aplicar Caído');
      return false;
    }

    // Check if target already has Caído effect
    const hasCaido = targetActor.items.some(
      item => item.type === 'efeito' && item.name === 'Caído'
    );

    if (hasCaido) {
      if (game.user.isGM) {
        ui.notifications.info(`${targetActor.name} já está Caído!`);
      }
      return false;
    }

    // If current user is not GM, send socket request to GM
    if (!game.user.isGM) {
      game.socket.emit('system.cardigan', {
        type: 'applyProne',
        targetActorId: targetActor.id,
        weaponName: weaponName
      });
      return true; // Assume success, GM will handle it
    }

    // GM applies the effect directly
    try {
      // Get Caído effect from compendium
      const pack = game.packs.get('cardigan.efeitos-cardigan');
      if (!pack) {
        console.error('[CONTUNDENTE] Compendium "cardigan.efeitos-cardigan" not found');
        ui.notifications.error('Erro: Compêndio de efeitos não encontrado');
        return false;
      }

      // Search for Caído effect
      const index = await pack.getIndex();
      const caidoEntry = index.find(i => i.name === 'Caído');
      
      if (!caidoEntry) {
        console.error('[CONTUNDENTE] Caído effect not found in compendium');
        ui.notifications.error('Erro: Efeito Caído não encontrado no compêndio');
        return false;
      }

      // Get the full effect document
      const caidoEffect = await pack.getDocument(caidoEntry._id);
      
      // Create the effect on the target actor
      await targetActor.createEmbeddedDocuments('Item', [caidoEffect.toObject()]);
      
      // Notify GM
      ui.notifications.info(`🔽 Caído aplicado em ${targetActor.name} por ${weaponName}!`);
      
      // Notify the defender's owner (if not GM)
      const defenderOwner = game.users.find(u => targetActor.testUserPermission(u, "OWNER") && !u.isGM);
      if (defenderOwner) {
        game.socket.emit('system.cardigan', {
          type: 'notifyProne',
          userId: defenderOwner.id,
          actorName: targetActor.name,
          weaponName: weaponName
        });
      }
      
      return true;
    } catch (error) {
      console.error('[CONTUNDENTE] Error applying prone effect:', error);
      ui.notifications.error(`Erro ao aplicar efeito Caído: ${error.message}`);
      return false;
    }
  }

  /**
   * Static helper to apply prone from outside the property instance
   * Used by dialog callbacks that need to apply prone directly
   * @param {Actor} targetActor - The actor to receive prone effect
   * @param {string} weaponName - Name of the weapon that caused prone
   * @returns {Promise<boolean>} Whether prone was applied
   */
  static async applyProneEffect(targetActor, weaponName = 'arma') {
    // Create a temporary instance to use the instance method
    const tempProperty = new Contundente(null);
    return await tempProperty.applyProne(targetActor, weaponName);
  }
}
