import { buildRollFormula } from '../helpers/config.mjs';
import { ChatMessageHelper } from '../helpers/chat-messages.mjs';
import { getCoreRollMode, applyRollModeToMessageData } from '../helpers/roll-mode.mjs';

/**
 * Check ammunition and consume it for ranged weapons
 * @param {Actor} actor
 * @param {Item} weapon
 * @returns {Promise<boolean>} True if attack can proceed, false if no ammunition
 */
export async function checkAndConsumeAmmunition(actor, weapon) {
  if (!weapon || !weapon.system.ranged) {
    return true;
  }

  const loadedAmmoTypes = weapon.system.loadedAmmoTypes || {};
  const hasAnyAmmunition = Object.values(loadedAmmoTypes).some(amount => amount > 0);

  if (!hasAnyAmmunition) {
    ui.notifications.warn(`${weapon.name} não possui munição carregada!`);
    return false;
  }

  const firstAmmoType = Object.keys(loadedAmmoTypes).find(type => loadedAmmoTypes[type] > 0);
  if (firstAmmoType) {
    const newAmount = loadedAmmoTypes[firstAmmoType] - 1;
    await weapon.update({
      [`system.loadedAmmoTypes.${firstAmmoType}`]: newAmount
    });
  }

  return true;
}

/**
 * Detect critical results for skill rolls
 * @param {Roll} roll
 * @param {Actor} actor
 * @param {string} abilityKey
 * @returns {Object} Flags object with critical information
 */
export function detectCriticalResults(roll, actor = null, abilityKey = null) {
  if (!roll || !roll.dice || roll.dice.length === 0) return {};

  try {
    if (!roll._evaluated) {
      roll.evaluate({ async: false });
    }

    const flags = {};

    if (roll.total <= 1) {
      flags.criticalFailure = true;
      return { cardigan: flags };
    }

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

    if (d20Die && d20Die.results && d20Die.results.length > 0) {
      if (abilityKey === 'accuracy' && actor && actor.system?.details?.criticalHit) {
        const criticalThreshold = actor.system.details.criticalHit;
        const hasNaturalCritical = d20Die.results.some(result =>
          result?.active !== false && result?.result === 20
        );
        if (roll.total >= criticalThreshold || hasNaturalCritical) {
          flags.criticalHit = true;
          return { cardigan: flags };
        }
      } else {
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

/**
 * Perform a default primary attack for unregistered skills
 * @param {Actor} actor
 * @param {string} skillName
 */
export async function performDefaultPrimaryAttack(actor, skillName) {
  try {
    const selectedTargets = game.user.targets;
    if (selectedTargets.size === 0) {
      ui.notifications.warn("Por favor, selecione um ou mais alvos para atacar.");
      return;
    }

    const realWeapons = actor.items.filter(item =>
      item.type === 'arma' &&
      item.system.equipped &&
      !item.system.isUnarmed &&
      (item.system.rightHand || item.system.leftHand)
    );

    const primaryWeapon = realWeapons.find(weapon => weapon.system.rightHand);

    let weaponDamage = 0;
    if (primaryWeapon) {
      const baseDamage = parseInt(primaryWeapon.system.damage?.value) || 0;
      weaponDamage = baseDamage;

      if (primaryWeapon.system.damage?.useStrength) {
        weaponDamage += actor.system.abilities.strength.value || 0;
      }
      if (primaryWeapon.system.damage?.useDexterity) {
        weaponDamage += actor.system.abilities.dexterity.value || 0;
      }
    } else {
      const strengthValue = actor.system.abilities.strength.value || 0;
      const strengthBonus = actor.system.abilities.strength.totalBonus || 0;
      const totalStrength = strengthValue + strengthBonus;
      weaponDamage = totalStrength > 0 ? totalStrength : 1;
    }

    if (primaryWeapon && primaryWeapon.system.ranged) {
      const canAttack = await checkAndConsumeAmmunition(actor, primaryWeapon);
      if (!canAttack) return;
    }

    const { AdvantageSelectionDialog } = await import('../applications/advantage-selection-dialog.mjs');

    const result = await AdvantageSelectionDialog.show();
    if (!result) return;

    const { rollType, attackMode, manualModifier = 0, primaryHand, secondaryHand } = result;

    if (attackMode === 'conjunto') {
      if (!canvas.tokens.controlled || canvas.tokens.controlled.length === 0) {
        ui.notifications.warn('Por favor, selecione um ou mais tokens antes de fazer uma Rolagem em Conjunto.');
        return;
      }
      if (!primaryHand && !secondaryHand) {
        ui.notifications.warn('Por favor, selecione a Mão Primária ou a Mão Secundária para fazer uma Rolagem em Conjunto.');
        return;
      }
    }

    const rollData = actor.getRollData();

    const formula = buildRollFormula(rollType, "@accuracy.total", manualModifier);
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

    const shouldRollIndividually = attackMode === 'individual' && selectedTargets.size > 1;

    if (shouldRollIndividually) {
      const targetArray = Array.from(selectedTargets);

      ui.notifications.info(`Realizando ${targetArray.length} ataques individuais...`);

      for (let i = 0; i < targetArray.length; i++) {
        const targetToken = targetArray[i];

        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        let individualRollDescription = `${rollDescription} (Individual) → ${targetToken.name}`;

        const { CongeladoEffect } = await import('../effects/effects/frozen.mjs');
        const congeladoPenalty = CongeladoEffect.getSkillPenalty(actor);

        if (congeladoPenalty !== 0) {
          formula += ` ${congeladoPenalty}`;
          individualRollDescription += ` [Congelado ${congeladoPenalty}]`;
        }

        const flavorText = `<div style="text-align: center; margin-bottom: 4px;">
          <strong>${skillName}</strong> - ${individualRollDescription}
        </div>`;

        const roll = new Roll(formula, rollData);
        await roll.evaluate();

        const { SangramentoEffect } = await import('../effects/effects/bleeding.mjs');
        await SangramentoEffect.applyBleedingDamage(actor, 'Precisão', 'accuracy');

        const flags = detectCriticalResults(roll, actor, 'accuracy');

        const isCriticalHit = flags?.cardigan?.criticalHit || false;
        const finalDamage = isCriticalHit ? weaponDamage * 2 : weaponDamage;

        if (flags?.cardigan?.criticalHit) {
          const critThreshold = actor.system?.details?.criticalHit;
          if (critThreshold) {
            ui.notifications.info(`Acerto Crítico! (${roll.total} >= ${critThreshold})`);
          } else {
            ui.notifications.info(`Acerto Crítico!`);
          }
        } else if (flags?.cardigan?.criticalFailure) {
          if (primaryWeapon && primaryWeapon.system.durability) {
            const currentDurability = primaryWeapon.system.durability.current;
            if (currentDurability > 0) {
              const newDurability = Math.max(0, currentDurability - 1);
              ui.notifications.warn(`Erro Crítico! ${primaryWeapon.name} perdeu durabilidade (${currentDurability} → ${newDurability})`);
            } else {
              ui.notifications.warn(`Erro Crítico!`);
            }
          } else {
            ui.notifications.warn(`Erro Crítico!`);
          }
        }

        const isCriticalFailure = flags.cardigan?.criticalFailure || false;
        if (isCriticalFailure && primaryWeapon && primaryWeapon.system.durability) {
          const currentDurability = primaryWeapon.system.durability.current;
          if (currentDurability > 0) {
            const newDurability = Math.max(0, currentDurability - 1);
            await primaryWeapon.update({
              'system.durability.current': newDurability
            });
          }
        }

        if (targetToken.actor) {
          flags.cardigan = flags.cardigan || {};
          flags.cardigan.attackTargets = {
            targets: [{
              tokenId: targetToken.id,
              actorId: targetToken.actor.id,
              name: targetToken.name
            }],
            attackerId: actor.id,
            attackerName: actor.name,
            skillName: skillName,
            weaponId: primaryWeapon?._id || primaryWeapon?.id,
            weaponName: primaryWeapon?.name,
            weaponProperties: primaryWeapon?.system?.properties || [],
            damage: weaponDamage,
            attackerCriticalHit: isCriticalHit
          };
        }

        const rollMode = getCoreRollMode();

        const messageData = {
          speaker: { alias: actor.name },
          flavor: flavorText,
          rolls: [roll],
          flags: flags
        };

        applyRollModeToMessageData(messageData, rollMode);

        await ChatMessage.create(messageData);
      }

      return;
    }

    const modeText = attackMode === 'conjunto' ? ' (Conjunto)' : ' (Individual)';
    rollDescription += modeText;

    const { CongeladoEffect } = await import('../effects/effects/frozen.mjs');
    const congeladoPenalty = CongeladoEffect.getSkillPenalty(actor);

    if (congeladoPenalty !== 0) {
      formula += ` ${congeladoPenalty}`;
      rollDescription += ` [Congelado ${congeladoPenalty}]`;
    }

    const flavorText = `<div style="text-align: center; margin-bottom: 4px;">
      <strong>${skillName}</strong> - ${rollDescription}
    </div>`;

    const roll = new Roll(formula, rollData);
    await roll.evaluate();

    const { SangramentoEffect } = await import('../effects/effects/bleeding.mjs');
    await SangramentoEffect.applyBleedingDamage(actor, 'Precisão', 'accuracy');

    const flags = detectCriticalResults(roll, actor, 'accuracy');

    const isCriticalHit = flags?.cardigan?.criticalHit || false;
    const finalDamage = isCriticalHit ? weaponDamage * 2 : weaponDamage;

    if (flags?.cardigan?.criticalHit) {
      const critThreshold = actor.system?.details?.criticalHit;
      if (critThreshold) {
        ui.notifications.info(`Acerto Crítico! (${roll.total} >= ${critThreshold})`);
      } else {
        ui.notifications.info(`Acerto Crítico!`);
      }
    } else if (flags?.cardigan?.criticalFailure) {
      if (primaryWeapon && primaryWeapon.system.durability) {
        const currentDurability = primaryWeapon.system.durability.current;
        if (currentDurability > 0) {
          const newDurability = Math.max(0, currentDurability - 1);
          ui.notifications.warn(`Erro Crítico! ${primaryWeapon.name} perdeu durabilidade (${currentDurability} → ${newDurability})`);
        } else {
          ui.notifications.warn(`Erro Crítico!`);
        }
      } else {
        ui.notifications.warn(`Erro Crítico!`);
      }
    }

    const isCriticalFailure = flags.cardigan?.criticalFailure || false;
    if (isCriticalFailure && primaryWeapon && primaryWeapon.system.durability) {
      const currentDurability = primaryWeapon.system.durability.current;
      if (currentDurability > 0) {
        const newDurability = Math.max(0, currentDurability - 1);
        await primaryWeapon.update({
          'system.durability.current': newDurability
        });
      }
    }

    const attackTargets = game.user.targets;
    const targetData = [];
    attackTargets.forEach(target => {
      if (target.actor) {
        targetData.push({
          tokenId: target.id,
          actorId: target.actor.id,
          name: target.name
        });
      }
    });

    if (targetData.length > 0) {
      flags.cardigan = flags.cardigan || {};
      flags.cardigan.attackTargets = {
        targets: targetData,
        attackerId: actor.id,
        attackerName: actor.name,
        skillName: skillName,
        weaponId: primaryWeapon?._id || primaryWeapon?.id,
        weaponName: primaryWeapon?.name,
        weaponProperties: primaryWeapon?.system?.properties || [],
        damage: weaponDamage,
        attackerCriticalHit: isCriticalHit
      };
    }

    const rollMode = getCoreRollMode();

    const messageData = {
      speaker: { alias: actor.name },
      flavor: flavorText,
      rolls: [roll],
      flags: flags
    };

    applyRollModeToMessageData(messageData, rollMode);

    await ChatMessage.create(messageData);

  } catch (error) {
    console.error(`Error performing default primary attack for ${skillName}:`, error);
    ui.notifications.error(`Erro ao realizar ataque: ${error.message}`);
  }
}

/**
 * Perform a default secondary attack for unregistered skills
 * @param {Actor} actor
 * @param {string} skillName
 */
export async function performDefaultSecondaryAttack(actor, skillName) {
  try {
    const targets = game.user.targets;
    if (targets.size === 0) {
      ui.notifications.warn("Por favor, selecione um ou mais alvos para atacar.");
      return;
    }

    const realWeapons = actor.items.filter(item =>
      item.type === 'arma' &&
      item.system.equipped &&
      !item.system.isUnarmed &&
      (item.system.rightHand || item.system.leftHand)
    );

    const secondaryWeapon = realWeapons.find(weapon =>
      weapon.system.leftHand && !weapon.system.rightHand
    );

    let weaponDamage = 0;
    if (secondaryWeapon) {
      const baseDamage = parseInt(secondaryWeapon.system.damage?.value) || 0;
      weaponDamage = baseDamage;

      if (secondaryWeapon.system.damage?.useStrength) {
        weaponDamage += actor.system.abilities.strength.value || 0;
      }
      if (secondaryWeapon.system.damage?.useDexterity) {
        weaponDamage += actor.system.abilities.dexterity.value || 0;
      }
    } else {
      const strengthValue = actor.system.abilities.strength.value || 0;
      const strengthBonus = actor.system.abilities.strength.totalBonus || 0;
      const totalStrength = strengthValue + strengthBonus;
      weaponDamage = totalStrength > 0 ? totalStrength : 1;
    }

    if (secondaryWeapon && secondaryWeapon.system.ranged) {
      const canAttack = await checkAndConsumeAmmunition(actor, secondaryWeapon);
      if (!canAttack) return;
    }

    const { AdvantageSelectionDialog } = await import('../applications/advantage-selection-dialog.mjs');

    const result = await AdvantageSelectionDialog.show();
    if (!result) return;

    const { rollType, attackMode, manualModifier = 0, primaryHand, secondaryHand } = result;

    if (attackMode === 'conjunto') {
      if (!game.user.targets || game.user.targets.size < 2) {
        ui.notifications.warn('Por favor, selecione dois ou mais alvos antes de fazer uma Rolagem em Conjunto.');
        return;
      }
      if (!primaryHand && !secondaryHand) {
        ui.notifications.warn('Por favor, selecione a Mão Primária ou a Mão Secundária para fazer uma Rolagem em Conjunto.');
        return;
      }
    }

    const rollData = actor.getRollData();

    const formula = buildRollFormula(rollType, "@accuracy.total", manualModifier);
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

    const shouldRollIndividually = attackMode === 'individual' && targets.size > 1;

    if (shouldRollIndividually) {
      const targetArray = Array.from(targets);

      ui.notifications.info(`Realizando ${targetArray.length} ataques secundários individuais...`);

      for (let i = 0; i < targetArray.length; i++) {
        const targetToken = targetArray[i];

        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        const individualRollDescription = `${rollDescription} (Individual) → ${targetToken.name}`;

        const flavorText = `<div style="text-align: center; margin-bottom: 4px;">
          <strong>${skillName}</strong> (Secundário) - ${individualRollDescription}
        </div>`;

        const roll = new Roll(formula, rollData);
        await roll.evaluate();

        const { SangramentoEffect } = await import('../effects/effects/bleeding.mjs');
        await SangramentoEffect.applyBleedingDamage(actor, 'Precisão', 'accuracy');

        const flags = detectCriticalResults(roll, actor, 'accuracy');

        const isCriticalHit = flags?.cardigan?.criticalHit || false;
        const finalDamage = isCriticalHit ? weaponDamage * 2 : weaponDamage;

        if (flags?.cardigan?.criticalHit) {
          const critThreshold = actor.system?.details?.criticalHit;
          if (critThreshold) {
            ui.notifications.info(`Acerto Crítico! (${roll.total} >= ${critThreshold})`);
          } else {
            ui.notifications.info(`Acerto Crítico!`);
          }
        } else if (flags?.cardigan?.criticalFailure) {
          if (secondaryWeapon && secondaryWeapon.system.durability) {
            const currentDurability = secondaryWeapon.system.durability.current;
            if (currentDurability > 0) {
              const newDurability = Math.max(0, currentDurability - 1);
              ui.notifications.warn(`Erro Crítico! ${secondaryWeapon.name} perdeu durabilidade (${currentDurability} → ${newDurability})`);
            } else {
              ui.notifications.warn(`Erro Crítico!`);
            }
          } else {
            ui.notifications.warn(`Erro Crítico!`);
          }
        }

        const isCriticalFailure = flags.cardigan?.criticalFailure || false;
        if (isCriticalFailure && secondaryWeapon && secondaryWeapon.system.durability) {
          const currentDurability = secondaryWeapon.system.durability.current;
          if (currentDurability > 0) {
            const newDurability = Math.max(0, currentDurability - 1);
            await secondaryWeapon.update({
              'system.durability.current': newDurability
            });
          }
        }

        if (targetToken.actor) {
          flags.cardigan = flags.cardigan || {};
          flags.cardigan.attackTargets = {
            targets: [{
              tokenId: targetToken.id,
              actorId: targetToken.actor.id,
              name: targetToken.name
            }],
            attackerId: actor.id,
            attackerName: actor.name,
            skillName: skillName,
            weaponId: secondaryWeapon?._id || secondaryWeapon?.id,
            weaponName: secondaryWeapon?.name,
            weaponProperties: secondaryWeapon?.system?.properties || [],
            damage: weaponDamage,
            attackerCriticalHit: isCriticalHit
          };
        }

        const rollMode = getCoreRollMode();

        const messageData = {
          speaker: { alias: actor.name },
          flavor: flavorText,
          rolls: [roll],
          flags: flags
        };

        applyRollModeToMessageData(messageData, rollMode);

        await ChatMessage.create(messageData);
      }

      return;
    }

    const modeText = attackMode === 'conjunto' ? ' (Conjunto)' : ' (Individual)';
    rollDescription += modeText;

    const flavorText = `<div style="text-align: center; margin-bottom: 4px;">
      <strong>${skillName}</strong> (Secundário) - ${rollDescription}
    </div>`;

    const roll = new Roll(formula, rollData);
    await roll.evaluate();

    const { SangramentoEffect } = await import('../effects/effects/bleeding.mjs');
    await SangramentoEffect.applyBleedingDamage(actor, 'Precisão', 'accuracy');

    const flags = detectCriticalResults(roll, actor, 'accuracy');

    const isCriticalHit = flags?.cardigan?.criticalHit || false;
    const finalDamage = isCriticalHit ? weaponDamage * 2 : weaponDamage;

    if (flags?.cardigan?.criticalHit) {
      const critThreshold = actor.system?.details?.criticalHit;
      if (critThreshold) {
        ui.notifications.info(`Acerto Crítico! (${roll.total} >= ${critThreshold})`);
      } else {
        ui.notifications.info(`Acerto Crítico!`);
      }
    } else if (flags?.cardigan?.criticalFailure) {
      if (secondaryWeapon && secondaryWeapon.system.durability) {
        const currentDurability = secondaryWeapon.system.durability.current;
        if (currentDurability > 0) {
          const newDurability = Math.max(0, currentDurability - 1);
          ui.notifications.warn(`Erro Crítico! ${secondaryWeapon.name} perdeu durabilidade (${currentDurability} → ${newDurability})`);
        } else {
          ui.notifications.warn(`Erro Crítico!`);
        }
      } else {
        ui.notifications.warn(`Erro Crítico!`);
      }
    }

    const isCriticalFailure = flags.cardigan?.criticalFailure || false;
    if (isCriticalFailure && secondaryWeapon && secondaryWeapon.system.durability) {
      const currentDurability = secondaryWeapon.system.durability.current;
      if (currentDurability > 0) {
        const newDurability = Math.max(0, currentDurability - 1);
        await secondaryWeapon.update({
          'system.durability.current': newDurability
        });
      }
    }

    const attackTargets = game.user.targets;
    const targetData = [];
    attackTargets.forEach(target => {
      if (target.actor) {
        targetData.push({
          tokenId: target.id,
          actorId: target.actor.id,
          name: target.name
        });
      }
    });

    if (targetData.length > 0) {
      flags.cardigan = flags.cardigan || {};
      flags.cardigan.attackTargets = {
        targets: targetData,
        attackerId: actor.id,
        attackerName: actor.name,
        skillName: skillName,
        weaponId: secondaryWeapon?._id || secondaryWeapon?.id,
        weaponName: secondaryWeapon?.name,
        weaponProperties: secondaryWeapon?.system?.properties || [],
        damage: weaponDamage,
        attackerCriticalHit: isCriticalHit
      };
    }

    const rollMode = getCoreRollMode();

    const messageData = {
      speaker: { alias: actor.name },
      flavor: flavorText,
      rolls: [roll],
      flags: flags
    };

    applyRollModeToMessageData(messageData, rollMode);

    await ChatMessage.create(messageData);

  } catch (error) {
    console.error(`Error performing default secondary attack for ${skillName}:`, error);
    ui.notifications.error(`Erro ao realizar ataque: ${error.message}`);
  }
}

/**
 * Perform a unified attack for skills — weapon selection based on hand checkboxes
 * @param {Actor} actor
 * @param {string} skillName
 */
export async function performUnifiedSkillAttack(actor, skillName) {
  try {
    const selectedTargets = game.user.targets;
    if (selectedTargets.size === 0) {
      ui.notifications.warn("Por favor, selecione um ou mais alvos para atacar.");
      return;
    }

    const { AdvantageSelectionDialog } = await import('../applications/advantage-selection-dialog.mjs');

    const result = await AdvantageSelectionDialog.show();
    if (!result) return;

    const { rollType, attackMode, manualModifier = 0, primaryHand, secondaryHand } = result;

    if (attackMode === 'conjunto') {
      if (!game.user.targets || game.user.targets.size < 2) {
        ui.notifications.warn('Por favor, selecione dois ou mais alvos antes de fazer uma Rolagem em Conjunto.');
        return;
      }
      if (!primaryHand && !secondaryHand) {
        ui.notifications.warn('Por favor, selecione a Mão Primária ou a Mão Secundária para fazer uma Rolagem em Conjunto.');
        return;
      }
    }

    let selectedWeapon = null;
    let weaponSource = null;

    const realWeapons = actor.items.filter(item =>
      item.type === 'arma' &&
      item.system.equipped &&
      !item.system.isUnarmed &&
      (item.system.rightHand || item.system.leftHand)
    );

    if (primaryHand) {
      selectedWeapon = realWeapons.find(weapon => weapon.system.rightHand);
      weaponSource = 'primary';
    } else if (secondaryHand) {
      selectedWeapon = realWeapons.find(weapon => weapon.system.leftHand);
      weaponSource = 'secondary';
    } else {
      selectedWeapon = realWeapons.find(weapon => weapon.system.rightHand);
      weaponSource = selectedWeapon ? 'primary' : 'unarmed';
    }

    let weaponDamage = 0;
    if (selectedWeapon) {
      const baseDamage = parseInt(selectedWeapon.system.damage?.value) || 0;
      weaponDamage = baseDamage;

      if (selectedWeapon.system.damage?.useStrength) {
        weaponDamage += actor.system.abilities.strength.value || 0;
      }
      if (selectedWeapon.system.damage?.useDexterity) {
        weaponDamage += actor.system.abilities.dexterity.value || 0;
      }
    } else {
      const strengthValue = actor.system.abilities.strength.value || 0;
      const strengthBonus = actor.system.abilities.strength.totalBonus || 0;
      const totalStrength = strengthValue + strengthBonus;
      weaponDamage = totalStrength > 0 ? totalStrength : 1;
      weaponSource = 'unarmed';
    }

    if (selectedWeapon && selectedWeapon.system.ranged) {
      const canAttack = await checkAndConsumeAmmunition(actor, selectedWeapon);
      if (!canAttack) return;
    }

    const rollData = actor.getRollData();

    const formula = buildRollFormula(rollType, "@accuracy.total", manualModifier);
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

    const modeText = attackMode === 'conjunto' ? ' (Conjunto)' : ' (Individual)';
    rollDescription += modeText;

    let weaponIndicator = '';
    if (weaponSource === 'primary') {
      weaponIndicator = ' [Mão Primária]';
    } else if (weaponSource === 'secondary') {
      weaponIndicator = ' [Mão Secundária]';
    } else if (weaponSource === 'unarmed') {
      weaponIndicator = ' [Desarmado]';
    }
    rollDescription += weaponIndicator;

    const { CongeladoEffect } = await import('../effects/effects/frozen.mjs');
    const congeladoPenalty = CongeladoEffect.getSkillPenalty(actor);

    const modifiers = [];

    if (congeladoPenalty !== 0) {
      formula += ` ${congeladoPenalty}`;
      modifiers.push(`Congelado ${congeladoPenalty}`);
    }

    const roll = new Roll(formula, rollData);
    await roll.evaluate();

    const { SangramentoEffect } = await import('../effects/effects/bleeding.mjs');
    await SangramentoEffect.applyBleedingDamage(actor, 'Precisão', 'accuracy');

    const flags = detectCriticalResults(roll, actor, 'accuracy');

    const isCriticalHit = flags?.cardigan?.criticalHit || false;
    const isCriticalFailure = flags?.cardigan?.criticalFailure || false;
    const finalDamage = isCriticalHit ? weaponDamage * 2 : weaponDamage;

    if (isCriticalHit) {
      const critThreshold = actor.system?.details?.criticalHit;
      if (critThreshold) {
        ui.notifications.info(`Acerto Crítico! (${roll.total} >= ${critThreshold})`);
      } else {
        ui.notifications.info(`Acerto Crítico!`);
      }
    } else if (isCriticalFailure) {
      if (selectedWeapon && selectedWeapon.system.durability) {
        const currentDurability = selectedWeapon.system.durability.current;
        if (currentDurability > 0) {
          const newDurability = Math.max(0, currentDurability - 1);
          ui.notifications.warn(`Erro Crítico! ${selectedWeapon.name} perdeu durabilidade (${currentDurability} → ${newDurability})`);
        } else {
          ui.notifications.warn(`Erro Crítico!`);
        }
      } else {
        ui.notifications.warn(`Erro Crítico!`);
      }
    }

    if (isCriticalFailure && selectedWeapon && selectedWeapon.system.durability) {
      const currentDurability = selectedWeapon.system.durability.current;
      if (currentDurability > 0) {
        const newDurability = Math.max(0, currentDurability - 1);
        await selectedWeapon.update({
          'system.durability.current': newDurability
        });
      }
    }

    const targetData = [];
    selectedTargets.forEach(target => {
      if (target.actor) {
        targetData.push({
          tokenId: target.id,
          actorId: target.actor.id,
          name: target.name
        });
      }
    });

    if (targetData.length > 0) {
      flags.cardigan = flags.cardigan || {};
      flags.cardigan.attackTargets = {
        targets: targetData,
        attackerId: actor.id,
        attackerName: actor.name,
        skillName: skillName,
        weaponId: selectedWeapon?._id || selectedWeapon?.id,
        weaponName: selectedWeapon?.name,
        weaponProperties: selectedWeapon?.system?.properties || [],
        damage: weaponDamage,
        attackerCriticalHit: isCriticalHit
      };
    }

    const rollMode = getCoreRollMode();

    await ChatMessageHelper.createRollMessage({
      actor: actor,
      roll: roll,
      label: 'PRECISÃO',
      rollType: rollType,
      rollDescription: rollDescription,
      handIndicator: null,
      modifiers: modifiers,
      flags: flags,
      rollMode: rollMode,
      isJointRoll: attackMode === 'conjunto',
      primaryHand: primaryHand,
      secondaryHand: secondaryHand
    });

  } catch (error) {
    console.error(`Error performing unified skill attack for ${skillName}:`, error);
    ui.notifications.error(`Erro ao realizar ataque: ${error.message}`);
  }
}
