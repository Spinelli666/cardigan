import { buildRollFormula } from '../../helpers/config.mjs';
import { ChatMessageHelper } from '../../helpers/chat-messages.mjs';
import { AdvantageSelectionDialog } from '../../applications/advantage-selection-dialog.mjs';

/**
 * Weapon Actions Module
 * Handles weapon attack flow and critical result detection
 */
export class WeaponActions {

  /**
   * Handle attacking with a weapon
   * @param {PointerEvent|Item} eventOrItem   The originating click event or weapon item
   * @param {HTMLElement|string} targetOrAmmoId   The capturing HTML element or specific ammunition ID
   * @param {CardiganSystemActorSheet} sheet
   */
  static async onAttackWithWeapon(eventOrItem, targetOrAmmoId, sheet) {
    // Validate target selection
    const targets = game.user.targets;
    if (targets.size === 0) {
      ui.notifications.warn("Por favor, selecione um ou mais alvos para atacar.");
      return;
    }

    let event, target, item, specificAmmoId;

    // Determine if this is a normal attack or specific ammunition attack
    if (eventOrItem instanceof Event) {
      // Normal attack from weapon table
      event = eventOrItem;
      target = targetOrAmmoId;
      event.preventDefault();

      const itemId = target.dataset.itemId;

      // Handle unarmed attacks (virtual items)
      if (itemId.startsWith('unarmed-')) {
        // Create virtual unarmed attack item on the fly
        const isRightHand = itemId === 'unarmed-right';
        const strengthValue = sheet.document.system.abilities.strength.value || 0;
        const strengthBonus = sheet.document.system.abilities.strength.totalBonus || 0;
        const actorStrength = strengthValue + strengthBonus;

        item = sheet.constructor._createUnarmedAttack(null, actorStrength, isRightHand, !isRightHand);
      } else {
        item = sheet.document.items.get(itemId);
      }
      specificAmmoId = null; // Use priority order
    } else {
      // Specific ammunition attack from dialog
      item = eventOrItem;
      specificAmmoId = targetOrAmmoId;
      event = null;
      target = null;
    }

    console.log("Attack with weapon triggered", {
      isSpecificAmmo: !!specificAmmoId,
      specificAmmoId,
      item: item?.name,
      isUnarmed: item?.system?.isUnarmed
    });

    // Skip equipment check for unarmed attacks
    if (!item || (!item.system.isUnarmed && !item.system.rightHand && !item.system.leftHand)) {
      ui.notifications.warn(game.i18n.localize("CARDIGAN.WeaponNotEquipped"));
      return;
    }

    // Verificar durabilidade da arma (pular para ataques desarmados)
    if (!item.system.isUnarmed && item.system.durability.current <= 0) {
      ui.notifications.warn(game.i18n.localize("CARDIGAN.WeaponBroken"));
      return;
    }

    // Verificar munição para armas à distância antes do ataque
    if (item.system.ranged) {
      const loadedAmmoTypes = item.system.loadedAmmoTypes || {};
      const hasAnyAmmunition = Object.values(loadedAmmoTypes).some(amount => amount > 0);

      if (!hasAnyAmmunition) {
        ui.notifications.warn(game.i18n.localize("CARDIGAN.NoAmmunition"));
        return;
      }
    }

    const actor = sheet.document;

    // Show advantage selection dialog (hide hand selection for weapon attacks)
    const result = await AdvantageSelectionDialog.show({ hideHandSelection: true });
    if (!result) return; // User cancelled

    const { rollType, attackMode, manualModifier = 0 } = result;

    // JOINT ROLL: Require multiple targets
    if (attackMode === 'conjunto') {
      if (!game.user.targets || game.user.targets.size < 2) {
        ui.notifications.warn('Por favor, selecione dois ou mais alvos antes de fazer uma Rolagem em Conjunto.');
        return;
      }
    }

    // Check if we need to make individual attacks for each target
    const shouldRollIndividually = attackMode === 'individual' && targets.size > 1;

    if (shouldRollIndividually) {
      // Make individual attack for each target
      const targetArray = Array.from(targets);

      // Show notification about multiple attacks
      ui.notifications.info(`Realizando ${targetArray.length} ataques individuais...`);

      for (let i = 0; i < targetArray.length; i++) {
        const targetToken = targetArray[i];

        // Add small delay between attacks for visual clarity
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        await WeaponActions.performSingleAttack(
          item,
          actor,
          rollType,
          attackMode,
          [targetToken],
          specificAmmoId,
          sheet,
          manualModifier
        );
      }

      return; // Exit after processing all individual attacks
    }

    // Single attack for all targets (conjunto mode or single target)
    await WeaponActions.performSingleAttack(item, actor, rollType, attackMode, Array.from(targets), specificAmmoId, sheet, manualModifier);
  }

  /**
   * Perform a single attack roll with damage calculation
   * @param {Item} item - The weapon item being used
   * @param {Actor} actor - The actor performing the attack
   * @param {string} rollType - Type of roll (normal, advantage, etc.)
   * @param {string} attackMode - Attack mode (individual or conjunto)
   * @param {Array} targetTokens - Array of target tokens for this attack
   * @param {string|null} specificAmmoId - Specific ammunition ID if selected
   * @param {CardiganSystemActorSheet} sheet
   * @param {number} manualModifier - Manual modifier to add to the roll
   * @returns {Promise<Roll|void>}
   */
  static async performSingleAttack(item, actor, rollType, attackMode, targetTokens, specificAmmoId, sheet, manualModifier = 0) {
    // Use getRollData() method for consistent roll data like in skills
    const rollData = actor.getRollData();

    let rollFormula = buildRollFormula(rollType, "@accuracy.total", manualModifier);
    let rollDescription = "";

    switch (rollType) {
      case 'advantage':
        rollDescription = "Rolagem com Vantagem";
        break;
      case 'disadvantage':
        rollDescription = "Rolagem com Desvantagem";
        break;
      case 'enhanced-advantage':
        rollDescription = "Rolagem com Vantagem Aprimorada";
        break;
      case 'enhanced-disadvantage':
        rollDescription = "Rolagem com Desvantagem Aprimorada";
        break;
      case 'normal':
        rollDescription = "Rolagem Normal";
        break;
      default:
        return;
    }

    // Add attack mode to description
    const modeText = attackMode === 'conjunto' ? ' (Conjunto)' : ' (Individual)';
    rollDescription += modeText;

    // Add target name(s) to description for individual attacks
    if (attackMode === 'individual' && targetTokens.length === 1) {
      rollDescription += ` → ${targetTokens[0].name}`;
    }

    // Check for Congelado effect and apply skill penalty
    const { CongeladoEffect } = await import('../../effects/effects/congelado.mjs');
    const congeladoPenalty = CongeladoEffect.getSkillPenalty(actor);

    // Apply Congelado penalty to formula if present
    if (congeladoPenalty !== 0) {
      rollFormula += ` ${congeladoPenalty}`;
      rollDescription += ` [Congelado ${congeladoPenalty}]`;
    }

    // Fazer a rolagem de ataque com a fórmula escolhida
    const roll = new Roll(rollFormula, rollData);
    await roll.evaluate();

    // Apply Sangramento effect for accuracy rolls
    const { SangramentoEffect } = await import('../../effects/effects/sangramento.mjs');
    await SangramentoEffect.applyBleedingDamage(actor, 'Precisão', 'accuracy');

    // Calcular dano total da arma
    let totalDamage = 0;
    let damageFormula = item.system.damage.value || "0";

    // Calcular dano base
    if (damageFormula && damageFormula !== "0" && !isNaN(parseInt(damageFormula))) {
      totalDamage = parseInt(damageFormula);
    }

    // Adicionar modificadores de atributos ao dano
    if (item.system.damage.useStrength) {
      totalDamage += actor.system.abilities.strength.value || 0;
    }

    if (item.system.damage.useDexterity) {
      totalDamage += actor.system.abilities.dexterity.value || 0;
    }

    // Adicionar bônus de Vorpal (+4 se empunhado com ambas as mãos)
    if (item.system.properties?.includes('vorpal')) {
      if (item.system.rightHand && item.system.leftHand) {
        totalDamage += 4;
      }
    }

    // Detect critical results - use accuracy logic for weapon attacks
    const flags = WeaponActions.detectCriticalResults(roll, actor, 'accuracy');

    // Check for critical results
    const isCriticalHit = flags.cardigan?.criticalHit || false;
    const isCriticalFailure = flags.cardigan?.criticalFailure || false;
    let finalDamage = totalDamage;
    let criticalMessage = '';

    // Show notification for critical results (only for the user who rolled)
    if (isCriticalHit) {
      const critThreshold = actor.system?.details?.criticalHit;
      if (critThreshold) {
        ui.notifications.info(`Acerto Crítico! (${roll.total} >= ${critThreshold})`);
      } else {
        ui.notifications.info(`Acerto Crítico!`);
      }
    } else if (isCriticalFailure) {
      // Check if weapon will lose durability (only for real weapons, not virtual unarmed attacks)
      if (item && item._id && item.system.durability) {
        const currentDurability = item.system.durability.current;
        if (currentDurability > 0) {
          const newDurability = Math.max(0, currentDurability - 1);
          ui.notifications.warn(`Erro Crítico! ${item.name} perdeu durabilidade (${currentDurability} → ${newDurability})`);
        } else {
          ui.notifications.warn(`Erro Crítico!`);
        }
      } else {
        ui.notifications.warn(`Erro Crítico!`);
      }
    }

    // Handle critical hit - double damage
    if (isCriticalHit) {
      finalDamage = totalDamage * 2;
      criticalMessage = `<div style="text-align: center; margin-top: 4px; color: #4CAF50; font-weight: bold;">
        <i class="fas fa-star"></i> ${game.i18n.localize("CARDIGAN.CriticalHitDamageDoubled") || "CRITICAL HIT! Damage doubled!"}
      </div>`;
    }

    // Handle critical failure - reduce durability (only for real weapons, not virtual unarmed attacks)
    if (isCriticalFailure && item && item._id && item.system.durability) {
      const currentDurability = item.system.durability.current;
      if (currentDurability > 0) {
        const newDurability = Math.max(0, currentDurability - 1);
        await item.update({
          'system.durability.current': newDurability
        });

        criticalMessage = `<div style="text-align: center; margin-top: 4px; color: #f44336; font-weight: bold;">
          <i class="fas fa-exclamation-triangle"></i> ${game.i18n.localize("CARDIGAN.CriticalFailureDurabilityLoss") || "CRITICAL FAILURE! Weapon durability reduced!"}
        </div>
        <div style="text-align: center; margin-top: 2px; font-size: 12px; color: #666;">
          ${game.i18n.localize("CARDIGAN.DurabilityReduced") || "Durability:"} ${currentDurability} → ${newDurability}
        </div>`;
      }
    }

    // Handle ammunition consumption for ranged weapons
    let ammunitionMessage = '';
    if (item.system.ranged && !isCriticalFailure) {
      const loadedAmmoTypes = item.system.loadedAmmoTypes || {};
      const currentLoaded = item.system.loadedAmmo || 0;

      // Find first ammunition type with loaded ammo following display order
      let consumedAmmoType = null;
      const sheetActor = sheet.document;

      // Get ammunition items in the same order as displayed in the dialog
      const allAmmunitionItems = sheetActor.items.filter(i => i.type === "item-municao");
      const filteredAmmunitionItems = allAmmunitionItems.filter(ammoItem => {
        if (item.system.isFirearm) {
          return ammoItem.system.isFirearmAmmo === true;
        } else {
          return ammoItem.system.isFirearmAmmo === false;
        }
      });

      // Find ammunition to consume with prioritization or use specific ammunition
      console.log("Searching for ammo to consume:", {
        specificAmmoId,
        filteredAmmunitionItems: filteredAmmunitionItems.map(i => ({ id: i.id, name: i.name, isSpecial: i.system.isSpecialAmmo })),
        loadedAmmoTypes
      });

      let consumedAmmoItem = null;

      if (specificAmmoId) {
        // Use specific ammunition if provided
        console.log("Using specific ammunition:", specificAmmoId);
        const specificAmmoAmount = loadedAmmoTypes[specificAmmoId] || 0;

        if (specificAmmoAmount > 0) {
          consumedAmmoType = specificAmmoId;
          consumedAmmoItem = sheetActor.items.get(specificAmmoId);
          console.log(`Selected SPECIFIC ammo for consumption: ${consumedAmmoItem?.name} (${specificAmmoId})`);
        } else {
          console.warn("Specific ammunition has no loaded rounds:", specificAmmoId);
          ui.notifications.warn("Selected ammunition has no loaded rounds.");
          return;
        }
      } else {
        // Use priority order: normal first, then special

        // Phase 1: Look for normal ammunition (isSpecialAmmo: false) first
        console.log("Phase 1: Searching for normal ammunition...");
        for (const ammoItem of filteredAmmunitionItems) {
          const ammoId = ammoItem.id;
          const ammoAmount = loadedAmmoTypes[ammoId] || 0;
          const isSpecial = ammoItem.system.isSpecialAmmo || false;
          console.log(`Checking ammo ${ammoItem.name} (${ammoId}): ${ammoAmount}, special: ${isSpecial}`);

          if (!isSpecial && ammoAmount > 0) {
            consumedAmmoType = ammoId;
            consumedAmmoItem = ammoItem;
            console.log(`Selected NORMAL ammo for consumption: ${ammoItem.name} (${ammoId})`);
            break;
          }
        }

        // Phase 2: If no normal ammunition available, look for special ammunition
        if (!consumedAmmoType) {
          console.log("Phase 2: No normal ammo available, searching for special ammunition...");
          for (const ammoItem of filteredAmmunitionItems) {
            const ammoId = ammoItem.id;
            const ammoAmount = loadedAmmoTypes[ammoId] || 0;
            const isSpecial = ammoItem.system.isSpecialAmmo || false;
            console.log(`Checking special ammo ${ammoItem.name} (${ammoId}): ${ammoAmount}, special: ${isSpecial}`);

            if (isSpecial && ammoAmount > 0) {
              consumedAmmoType = ammoId;
              consumedAmmoItem = ammoItem;
              console.log(`Selected SPECIAL ammo for consumption: ${ammoItem.name} (${ammoId})`);
              break;
            }
          }
        }
      }

      if (consumedAmmoType) {
        // Reduce the specific ammunition type by 1
        const updatedLoadedAmmoTypes = { ...loadedAmmoTypes };
        updatedLoadedAmmoTypes[consumedAmmoType] = Math.max(0, updatedLoadedAmmoTypes[consumedAmmoType] - 1);

        // Keep entry even if it becomes 0 to maintain ammunition order consistency
        // Do not delete entries - just set to 0
        console.log(`Reduced ${consumedAmmoType} from ${loadedAmmoTypes[consumedAmmoType]} to ${updatedLoadedAmmoTypes[consumedAmmoType]}`);
        console.log("Updated loadedAmmoTypes:", updatedLoadedAmmoTypes);

        // Calculate new total
        const newLoaded = Object.values(updatedLoadedAmmoTypes).reduce((sum, amount) => sum + amount, 0);

        await item.update({
          'system.loadedAmmo': newLoaded,
          'system.loadedAmmoTypes': updatedLoadedAmmoTypes
        });

        // Note: UI updates (weapon table and ammo dialog) will happen on next render

        const magazine = item.system.magazine || 0;
        const ammunitionDisplay = item.system.isFirearm ? `${newLoaded}/${magazine}` : newLoaded.toString();

        // Check if consumed ammunition is special
        const isSpecialAmmo = consumedAmmoItem && (consumedAmmoItem.system.isSpecialAmmo || false);
        const ammoTypeText = isSpecialAmmo ?
          (game.i18n.localize("CARDIGAN.SpecialAmmunitionUsed") || "Special Ammunition Used") :
          (game.i18n.localize("CARDIGAN.AmmunitionUsed") || "Ammunition Used");

        const ammoIcon = isSpecialAmmo ? "fas fa-star" : "fas fa-crosshairs";
        const ammoColor = isSpecialAmmo ? "#FFD700" : "#2196F3";  // Gold for special, blue for normal

        ammunitionMessage = `<div style="text-align: center; margin-top: 4px; color: ${ammoColor}; font-size: 12px;">
          <i class="${ammoIcon}"></i> ${ammoTypeText}
          ${isSpecialAmmo ? `<span style="margin-left: 4px; font-size: 10px;">(${consumedAmmoItem.name})</span>` : ''}
        </div>
        <div style="text-align: center; margin-top: 2px; font-size: 12px; color: #666;">
          ${game.i18n.localize("CARDIGAN.RemainingAmmo") || "Remaining:"} ${ammunitionDisplay}
        </div>`;
      }
    }

    // Collect target data for evasion buttons
    const targetData = [];
    targetTokens.forEach(target => {
      if (target.actor) {
        targetData.push({
          tokenId: target.id,
          actorId: target.actor.id,
          name: target.name
        });
      }
    });

    // Add target data to flags
    if (targetData.length > 0) {
      flags.cardigan = flags.cardigan || {};
      flags.cardigan.attackTargets = {
        targets: targetData,
        attackerId: actor.id,
        attackerName: actor.name,
        weaponName: item.name,
        weaponId: item._id || item.id,  // Weapon ID for property checks
        weaponProperties: item.system.properties || [],  // Weapon properties (ferir, vorpal, etc)
        damage: totalDamage,  // ALWAYS use BASE damage (not doubled) in flags
        attackerCriticalHit: isCriticalHit  // Add critical hit flag
      };
    }

    // Use player's roll mode setting (GM can choose blind manually)
    const rollMode = game.settings.get('core', 'rollMode');

    // Build modifiers array with critical and ammunition messages
    const modifiers = [];

    if (criticalMessage) {
      modifiers.push(criticalMessage);
    }

    if (ammunitionMessage) {
      modifiers.push(ammunitionMessage);
    }

    // Create chat message using helper
    await ChatMessageHelper.createRollMessage({
      actor: actor,
      roll: roll,
      label: 'PRECISÃO',
      rollType: rollType,
      rollDescription: rollDescription,
      handIndicator: null,  // Weapon attacks don't show hand indicators
      modifiers: modifiers,
      flags: flags,
      rollMode: rollMode,
      isJointRoll: attackMode === 'conjunto',
      primaryHand: false,  // Weapon attacks don't have hand selection
      secondaryHand: false
    });

    return roll;
  }

  /**
   * Detect critical results from a roll and return appropriate flags
   * @param {Roll} roll - The roll to analyze
   * @param {Object} actor - The actor who made the roll (optional, used for critical hit threshold)
   * @param {string} abilityKey - The ability key being rolled (optional, used for accuracy-specific logic)
   * @returns {Object} - Flags object for critical hit/failure, empty if no critical
   */
  static detectCriticalResults(roll, actor = null, abilityKey = null) {
    if (!roll || !roll.dice || roll.dice.length === 0) return {};

    try {
      // Evaluate the roll if not already evaluated
      if (!roll._evaluated) {
        roll.evaluate({ async: false });
      }

      const flags = {};

      // Check for critical failure (total ≤ 1 or natural 1)
      if (roll.total <= 1) {
        flags.criticalFailure = true;
        return { cardigan: flags };
      }

      // Check for natural 1 on d20
      // Only check ACTIVE dice (not discarded by advantage/disadvantage)
      const d20Die = roll.dice.find(die => die.faces === 20);
      if (d20Die && d20Die.results && d20Die.results.length > 0) {
        const hasNaturalOne = d20Die.results.some(result =>
          result?.active !== false && result?.result === 1
        );
        if (hasNaturalOne) {
          flags.criticalFailure = true;
          return { cardigan: flags };
        }
      }

      // Check for critical hit - different logic for accuracy vs other rolls
      // Only check ACTIVE dice (not discarded by advantage/disadvantage)
      if (d20Die && d20Die.results && d20Die.results.length > 0) {
        // For accuracy rolls, use actor's criticalHit threshold
        if (abilityKey === 'accuracy' && actor && actor.system?.details?.criticalHit) {
          const criticalThreshold = actor.system.details.criticalHit;
          // Check if any active die result is 20 or higher for natural critical
          const hasNaturalCritical = d20Die.results.some(result =>
            result?.active !== false && result?.result === 20
          );
          if (roll.total >= criticalThreshold || hasNaturalCritical) {
            flags.criticalHit = true;
            return { cardigan: flags };
          }
        }
        // For all other rolls, critical hit when total is 20 or higher OR natural 20
        else {
          const hasNaturalTwenty = d20Die.results.some(result =>
            result?.active !== false && result?.result === 20
          );
          if (roll.total >= 20 || hasNaturalTwenty) {
            flags.criticalHit = true;
            return { cardigan: flags };
          }
        }
      }

      return {};

    } catch (error) {
      console.warn("Error detecting critical results:", error);
      return {};
    }
  }
}