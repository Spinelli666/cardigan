import { BaseWeaponProperty } from '../base-weapon-property.mjs';

/**
 * Impacto - Aumenta fratura em acertos críticos
 * Quando um ataque crítico é realizado com esta arma, incrementa o nível de Fratura do defensor
 */
export class Impacto extends BaseWeaponProperty {
  static get id() {
    return 'impact';
  }

  /**
   * Apply fracture when critical hit occurs
   * Called when the attack hits critically (attacker rolls critical)
   * @param {Actor} attacker - The attacking actor
   * @param {Actor} defender - The defending actor
   * @param {object} criticalData - Critical hit data with weapon info
   * @returns {Promise<void>}
   */
  async onCriticalHit(attacker, defender, criticalData) {
    if (!defender) {
      console.warn('[IMPACT] No defender provided for critical hit');
      return;
    }

    await this.applyFracture(defender, this.weapon?.name || 'arma de impacto');
  }

  /**
   * Increment fracture level on target actor
   * @param {Actor} targetActor - The actor to receive fracture increment
   * @param {string} weaponName - Name of the weapon that caused fracture
   * @returns {Promise<boolean>} Whether fracture was applied
   */
  async applyFracture(targetActor, weaponName = 'arma') {
    if (!targetActor) {
      ui.notifications.error('Erro: Nenhum alvo encontrado para aplicar Fratura');
      return false;
    }

    // Get current fracture level
    const currentFracture = targetActor.system.status?.fracture ?? 0;
    const maxFracture = 5;

    // Check if already at max
    if (currentFracture >= maxFracture) {
      if (game.user.isGM) {
        ui.notifications.warn(`${targetActor.name} já está no nível máximo de Fratura (${maxFracture})!`);
      }
      return false;
    }

    // If current user is not GM, send socket request to GM
    if (!game.user.isGM) {
      game.socket.emit('system.cardigan', {
        type: 'applyFracture',
        targetActorId: targetActor.id,
        weaponName: weaponName
      });
      return true; // Assume success, GM will handle it
    }

    // GM applies the fracture increment directly
    try {
      const newFracture = Math.min(currentFracture + 1, maxFracture);
      
      await targetActor.update({
        'system.status.fracture': newFracture
      });
      
      // Notify GM
      ui.notifications.info(`🦴 Fratura aplicada em ${targetActor.name} por ${weaponName}! (${currentFracture} → ${newFracture})`);
      
      // Notify the defender's owner (if not GM)
      const defenderOwner = game.users.find(u => targetActor.testUserPermission(u, "OWNER") && !u.isGM);
      if (defenderOwner) {
        game.socket.emit('system.cardigan', {
          type: 'notifyFracture',
          userId: defenderOwner.id,
          actorName: targetActor.name,
          weaponName: weaponName,
          oldFracture: currentFracture,
          newFracture: newFracture
        });
      }
      
      return true;
    } catch (error) {
      console.error('[IMPACT] Error applying fracture:', error);
      ui.notifications.error(`Erro ao aplicar Fratura: ${error.message}`);
      return false;
    }
  }

  /**
   * Static helper to apply fracture from outside the property instance
   * Used by dialog callbacks that need to apply fracture directly
   * @param {Actor} targetActor - The actor to receive fracture increment
   * @param {string} weaponName - Name of the weapon that caused fracture
   * @returns {Promise<boolean>} Whether fracture was applied
   */
  static async applyFractureEffect(targetActor, weaponName = 'arma') {
    // Create a temporary instance to use the instance method
    const tempProperty = new Impacto(null);
    return await tempProperty.applyFracture(targetActor, weaponName);
  }
}
