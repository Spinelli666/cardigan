import { BaseWeaponProperty } from '../base-weapon-property.mjs';

/**
 * Ferir - Causa sangramento em acertos críticos
 * Quando um ataque crítico é realizado com esta arma, o defensor recebe o efeito Sangramento
 */
export class Ferir extends BaseWeaponProperty {
  static get id() {
    return 'ferir';
  }

  /**
   * Apply bleeding effect when critical hit occurs
   * Called when the attack hits critically (attacker rolls critical)
   * @param {Actor} attacker - The attacking actor
   * @param {Actor} defender - The defending actor
   * @param {object} criticalData - Critical hit data with weapon info
   * @returns {Promise<void>}
   */
  async onCriticalHit(attacker, defender, criticalData) {
    if (!defender) {
      console.warn('[FERIR] No defender provided for critical hit');
      return;
    }

    await this.applyBleeding(defender, this.weapon?.name || 'arma com ferir');
  }

  /**
   * Apply bleeding effect to target actor
   * @param {Actor} targetActor - The actor to receive bleeding effect
   * @param {string} weaponName - Name of the weapon that caused bleeding
   * @returns {Promise<boolean>} Whether bleeding was applied
   */
  async applyBleeding(targetActor, weaponName = 'arma') {
    if (!targetActor) {
      ui.notifications.error('Erro: Nenhum alvo encontrado para aplicar Sangramento');
      return false;
    }

    // Check if target already has Sangramento effect
    const hasSangramento = targetActor.items.some(
      item => item.type === 'efeito' && item.name === 'Sangramento'
    );

    if (hasSangramento) {
      if (game.user.isGM) {
        ui.notifications.info(`${targetActor.name} já está com Sangramento!`);
      }
      return false;
    }

    // If current user is not GM, send socket request to GM
    if (!game.user.isGM) {
      game.socket.emit('system.cardigan', {
        type: 'applyBleeding',
        targetActorId: targetActor.id,
        weaponName: weaponName
      });
      return true; // Assume success, GM will handle it
    }

    // GM applies the effect directly
    try {
      // Get Sangramento effect from compendium
      const pack = game.packs.get('cardigan.efeitos-cardigan');
      if (!pack) {
        console.error('[FERIR] Compendium "cardigan.efeitos-cardigan" not found');
        ui.notifications.error('Erro: Compêndio de efeitos não encontrado');
        return false;
      }

      // Search for Sangramento effect
      const index = await pack.getIndex();
      const sangramentoEntry = index.find(i => i.name === 'Sangramento');
      
      if (!sangramentoEntry) {
        console.error('[FERIR] Sangramento effect not found in compendium');
        ui.notifications.error('Erro: Efeito Sangramento não encontrado no compêndio');
        return false;
      }

      // Get the full effect document
      const sangramentoEffect = await pack.getDocument(sangramentoEntry._id);
      
      // Create the effect on the target actor
      await targetActor.createEmbeddedDocuments('Item', [sangramentoEffect.toObject()]);
      
      // Notify GM
      ui.notifications.info(`💉 Sangramento aplicado em ${targetActor.name} por ${weaponName}!`);
      
      // Notify the defender's owner (if not GM)
      const defenderOwner = game.users.find(u => targetActor.testUserPermission(u, "OWNER") && !u.isGM);
      if (defenderOwner) {
        game.socket.emit('system.cardigan', {
          type: 'notifyBleeding',
          userId: defenderOwner.id,
          actorName: targetActor.name,
          weaponName: weaponName
        });
      }
      
      return true;
    } catch (error) {
      console.error('[FERIR] Error applying bleeding effect:', error);
      ui.notifications.error(`Erro ao aplicar efeito Sangramento: ${error.message}`);
      return false;
    }
  }

  /**
   * Static helper to apply bleeding from outside the property instance
   * Used by dialog callbacks that need to apply bleeding directly
   * @param {Actor} targetActor - The actor to receive bleeding effect
   * @param {string} weaponName - Name of the weapon that caused bleeding
   * @returns {Promise<boolean>} Whether bleeding was applied
   */
  static async applyBleedingEffect(targetActor, weaponName = 'arma') {
    // Create a temporary instance to use the instance method
    const tempProperty = new Ferir(null);
    return await tempProperty.applyBleeding(targetActor, weaponName);
  }
}
