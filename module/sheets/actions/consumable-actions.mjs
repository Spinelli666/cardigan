/**
 * Consumable Actions Module
 * Handles consumable item consumption, skill checks, critical effects and temporary modifiers.
 */
export class ConsumableActions {

  /**
   * Handle consuming a consumable item
   * @param {Event} event
   * @param {HTMLElement} target
   * @param {CardiganSystemActorSheet} sheet
   */
  static async onConsumeItem(event, target, sheet) {
    event.preventDefault();

    const itemId = target.dataset.itemId;
    const item = sheet.document.items.get(itemId);

    if (!item || item.type !== 'item-consumivel') {
      ui.notifications.warn("Item não encontrado ou não é um consumível.");
      return;
    }

    const currentQuantity = item.system.quantity || 0;
    if (currentQuantity <= 0) {
      ui.notifications.warn(`${item.name} não possui unidades disponíveis para consumo.`);
      return;
    }

    const quantityToConsume = await ConsumableActions.showQuantityDialog(item.name, currentQuantity);
    if (!quantityToConsume) return;

    await sheet._processItemConsumption(item, quantityToConsume);
  }

  /**
   * Show dialog to select quantity to consume
   * @param {string} itemName
   * @param {number} maxQuantity
   * @returns {Promise<number|null>}
   */
  static async showQuantityDialog(itemName, maxQuantity) {
    return new Promise(resolve => {
      new foundry.applications.api.DialogV2({
        window: {
          title: `Consumir ${itemName}`,
          contentClasses: ["cardigan-dialog"]
        },
        content: `
          <div class="form-group">
            <label>Quantidade a consumir:</label>
            <input type="number" name="quantity" value="1" min="1" max="${maxQuantity}" style="width: 100%; margin-top: 5px;">
            <small>Disponível: ${maxQuantity} unidade(s)</small>
          </div>
        `,
        buttons: [
          {
            action: "consume",
            icon: "fas fa-flask",
            label: "Consumir",
            default: true,
            callback: (event, button, dialog) => {
              const quantity = parseInt(dialog.element.querySelector('[name="quantity"]').value) || 1;
              if (quantity > maxQuantity || quantity < 1) {
                ui.notifications.warn("Quantidade inválida.");
                resolve(null);
              } else {
                resolve(quantity);
              }
            }
          },
          {
            action: "cancel",
            icon: "fas fa-times",
            label: "Cancelar",
            callback: () => resolve(null)
          }
        ],
        render: (event, dialog) => {
          const input = dialog.element.querySelector('[name="quantity"]');
          if (input) {
            input.focus();
            input.select();
          }
        }
      }).render(true);
    });
  }

  /**
   * Process the consumption of an item and apply effects using tracking system
   * @param {Item} item
   * @param {number} quantity
   * @param {CardiganSystemActorSheet} sheet
   */
  static async processItemConsumption(item, quantity, sheet) {
    try {
      let rollResult = null;
      if (item.system.hasSkillCheck && item.system.skillCheckAbility) {
        rollResult = await ConsumableActions.processSkillCheck(item, sheet);
      }

      const configuredSkillTestEffects = await ConsumableActions.getConfiguredSkillTestEffects(item);
      if (rollResult && configuredSkillTestEffects.length > 0) {
        await ConsumableActions.applyConfiguredSkillTestEffects(configuredSkillTestEffects, rollResult, sheet);
      }

      const configuredSkillTestSkills = await ConsumableActions.getConfiguredSkillTestSkills(item);

      let rollType = 'normal';
      if (rollResult) {
        if (rollResult.isCriticalFailure) {
          rollType = 'critical-failure';
        } else if (rollResult.isCriticalHit) {
          rollType = 'critical-hit';
        }
      }

      const appliedEffects = [];
      const appliedSkillBonuses = [];
      const messages = [];
      const appliedAttributeModifiers = [];

      if (rollResult && configuredSkillTestSkills.length > 0) {
        const configuredSkillsResult = await ConsumableActions.applyConfiguredSkillTestSkills(
          configuredSkillTestSkills,
          rollResult,
          sheet
        );

        if (configuredSkillsResult.appliedModifiers.length > 0) {
          appliedAttributeModifiers.push(...configuredSkillsResult.appliedModifiers);
        }

        if (configuredSkillsResult.messages.length > 0) {
          messages.push(...configuredSkillsResult.messages);
        }
      }

      const configuredConsumableSkillBonuses = await ConsumableActions.getConfiguredConsumableSkillBonuses(item);
      if (configuredConsumableSkillBonuses.length > 0) {
        const consumableSkillBonusesResult = await ConsumableActions.applyConfiguredConsumableSkillBonuses(
          configuredConsumableSkillBonuses,
          sheet,
          quantity
        );

        if (consumableSkillBonusesResult.appliedModifiers.length > 0) {
          appliedAttributeModifiers.push(...consumableSkillBonusesResult.appliedModifiers);
        }

        if (consumableSkillBonusesResult.messages.length > 0) {
          messages.push(...consumableSkillBonusesResult.messages);
        }
      }

      const effects = item.system.effects || [];
      for (const effect of effects) {
        if (!effect.effectId || (!effect.apply && !effect.remove)) continue;

        const pack = game.packs.get("cardigan.efeitos-cardigan");
        const effectDocument = await pack.getDocument(effect.effectId);

        if (!effectDocument) {
          console.warn(`Effect ${effect.effectId} not found in compendium`);
          continue;
        }

        const effectName = effectDocument.name;

        if (effect.apply) {
          const existingEffect = sheet.document.items.find(i =>
            i.type === 'efeito' &&
            i.name === effectName &&
            !i.system.consumableTracking?.isTrackingEffect
          );

          if (existingEffect) {
            messages.push(`Effect ${effectName} was already active`);
          } else {
            const effectData = foundry.utils.deepClone(effectDocument.toObject());
            effectData._id = foundry.utils.randomID();

            await sheet.document.createEmbeddedDocuments("Item", [effectData]);
            appliedEffects.push(effect.effectId);
            messages.push(`Applied effect: ${effectName}`);
          }
        } else if (effect.remove) {
          const existingEffect = sheet.document.items.find(i =>
            i.type === 'efeito' &&
            i.name === effectName &&
            !i.system.consumableTracking?.isTrackingEffect
          );

          if (existingEffect) {
            await existingEffect.delete();
            messages.push(`Removed effect: ${effectName}`);
          } else {
            messages.push(`Effect ${effectName} was not active`);
          }
        }
      }

      if (item.system.hasTemporarySkillBonus && item.system.temporarySkillBonus?.length > 0) {
        const validBonuses = item.system.temporarySkillBonus.filter(bonus =>
          bonus.ability && bonus.ability.trim() !== "" && bonus.value && bonus.value !== 0
        );

        if (validBonuses.length > 0) {
          appliedSkillBonuses.push(...validBonuses);
          const bonusMessages = validBonuses.map(bonus =>
            `${bonus.ability}: +${bonus.value}`
          );
          messages.push(`Applied temporary skill bonuses: ${bonusMessages.join(', ')}`);
        }
      }

      console.log("[CONSUME] Checking health modifier:", {
        hasHealthModifier: item.system.hasHealthModifier,
        healthModifierDice: item.system.healthModifierDice,
        healthModifierType: item.system.healthModifierType
      });

      if (item.system.hasHealthModifier && item.system.healthModifierDice) {
        console.log("[CONSUME] Processing health modifier for item:", item.name);
        const healthModifierResult = await ConsumableActions.processHealthModifier(item, sheet);
        if (healthModifierResult) {
          messages.push(healthModifierResult.message);
          console.log("[CONSUME] Health modifier processed, message added:", healthModifierResult.message);
        } else {
          console.log("[CONSUME] Health modifier processing returned null");
        }
      } else {
        console.log("[CONSUME] Health modifier not configured or not enabled");
      }

      console.log("[CONSUME] Checking energy modifier:", {
        hasEnergyModifier: item.system.hasEnergyModifier,
        energyModifierDice: item.system.energyModifierDice,
        energyModifierType: item.system.energyModifierType
      });

      if (item.system.hasEnergyModifier && item.system.energyModifierDice) {
        console.log("[CONSUME] Processing energy modifier for item:", item.name);
        const energyModifierResult = await ConsumableActions.processEnergyModifier(item, sheet);
        if (energyModifierResult) {
          messages.push(energyModifierResult.message);
          console.log("[CONSUME] Energy modifier processed, message added:", energyModifierResult.message);
        } else {
          console.log("[CONSUME] Energy modifier processing returned null");
        }
      } else {
        console.log("[CONSUME] Energy modifier not configured or not enabled");
      }

      console.log("[CONSUME] Checking armor bonus:", {
        hasArmorBonus: item.system.hasArmorBonus,
        armorBonusAmount: item.system.armorBonusAmount
      });

      const armorAmount = Number(item.system?.armorBonusAmount ?? 0);
      const armorEnabled = item.system?.hasArmorBonus ?? (armorAmount > 0);

      if (armorEnabled && armorAmount > 0) {
        console.log("[CONSUME] Processing armor bonus for item:", item.name);
        const armorBonusResult = await ConsumableActions.processArmorBonus(item, sheet, quantity);
        if (armorBonusResult) {
          messages.push(armorBonusResult.message);
          appliedAttributeModifiers.push({
            type: 'armorBonus',
            amount: armorBonusResult.amount,
            label: `Armor Bonus +${armorBonusResult.amount}`
          });
          console.log("[CONSUME] Armor bonus processed, message added:", armorBonusResult.message);
        } else {
          console.log("[CONSUME] Armor bonus processing returned null");
        }
      } else {
        console.log("[CONSUME] Armor bonus not configured or not enabled");
      }

      console.log("[CONSUME] Checking status ailments:", {
        hasStatusAilments: item.system.hasStatusAilments,
        hasSanityModifier: item.system.hasSanityModifier,
        sanityModifierType: item.system.sanityModifierType,
        sanityModifierAmount: item.system.sanityModifierAmount
      });

      const sanityAmount = Number(item.system?.sanityModifierAmount ?? 0);
      const sanityType = item.system?.sanityModifierType;
      const sanityHasValidType = sanityType === 'increase' || sanityType === 'decrease';
      const sanityEnabled =
        Boolean(item.system?.hasStatusAilments) &&
        Boolean(item.system?.hasSanityModifier) &&
        sanityAmount > 0 &&
        sanityHasValidType;

      if (sanityEnabled) {
        console.log("[CONSUME] Processing status ailments for item:", item.name);
        const statusAilmentsResult = await ConsumableActions.processStatusAilments(item, sheet, quantity);
        if (statusAilmentsResult) {
          messages.push(statusAilmentsResult.message);
          console.log("[CONSUME] Status ailments processed, message added:", statusAilmentsResult.message);
        } else {
          console.log("[CONSUME] Status ailments processing returned null");
        }
      } else {
        console.log("[CONSUME] Status ailments not configured or not enabled");
      }

      console.log("[CONSUME] Checking toxicity:", {
        hasToxicityModifier: item.system.hasToxicityModifier,
        toxicityModifierType: item.system.toxicityModifierType,
        toxicityModifierAmount: item.system.toxicityModifierAmount
      });

      if (item.system.hasToxicityModifier && item.system.toxicityModifierAmount > 0) {
        console.log("[CONSUME] Processing toxicity for item:", item.name);
        const toxicityResult = await ConsumableActions.processToxicity(item, sheet, quantity);
        if (toxicityResult) {
          messages.push(toxicityResult.message);
          console.log("[CONSUME] Toxicity processed, message added:", toxicityResult.message);
        } else {
          console.log("[CONSUME] Toxicity processing returned null");
        }
      } else {
        console.log("[CONSUME] Toxicity not configured or not enabled");
      }

      console.log("[CONSUME] Checking fracture:", {
        hasFractureModifier: item.system.hasFractureModifier,
        fractureModifierType: item.system.fractureModifierType,
        fractureModifierAmount: item.system.fractureModifierAmount
      });

      if (item.system.hasFractureModifier && item.system.fractureModifierAmount > 0) {
        console.log("[CONSUME] Processing fracture for item:", item.name);
        const fractureResult = await ConsumableActions.processFracture(item, sheet, quantity);
        if (fractureResult) {
          messages.push(fractureResult.message);
          console.log("[CONSUME] Fracture processed, message added:", fractureResult.message);
        } else {
          console.log("[CONSUME] Fracture processing returned null");
        }
      } else {
        console.log("[CONSUME] Fracture not configured or not enabled");
      }

      console.log("[CONSUME] Checking food:", {
        hasFoodAndWater: item.system.hasFoodAndWater,
        hasFoodModifier: item.system.hasFoodModifier,
        foodModifierType: item.system.foodModifierType,
        foodModifierAmount: item.system.foodModifierAmount
      });

      const foodAmount = Number(item.system?.foodModifierAmount ?? 0);
      const foodType = item.system?.foodModifierType;
      const foodHasValidType = foodType === 'increase' || foodType === 'decrease';
      const foodEnabled =
        Boolean(item.system?.hasFoodAndWater) &&
        Boolean(item.system?.hasFoodModifier) &&
        foodAmount > 0 &&
        foodHasValidType;

      if (foodEnabled) {
        console.log("[CONSUME] Processing food for item:", item.name);
        const foodResult = await ConsumableActions.processFood(item, sheet, quantity);
        if (foodResult) {
          messages.push(foodResult.message);
          console.log("[CONSUME] Food processed, message added:", foodResult.message);
        } else {
          console.log("[CONSUME] Food processing returned null");
        }
      } else {
        console.log("[CONSUME] Food not configured or not enabled");
      }

      console.log("[CONSUME] Checking water:", {
        hasFoodAndWater: item.system.hasFoodAndWater,
        hasWaterModifier: item.system.hasWaterModifier,
        waterModifierType: item.system.waterModifierType,
        waterModifierAmount: item.system.waterModifierAmount
      });

      const waterAmount = Number(item.system?.waterModifierAmount ?? 0);
      const waterType = item.system?.waterModifierType;
      const waterHasValidType = waterType === 'increase' || waterType === 'decrease';
      const waterEnabled =
        Boolean(item.system?.hasFoodAndWater) &&
        Boolean(item.system?.hasWaterModifier) &&
        waterAmount > 0 &&
        waterHasValidType;

      if (waterEnabled) {
        console.log("[CONSUME] Processing water for item:", item.name);
        const waterResult = await ConsumableActions.processWater(item, sheet, quantity);
        if (waterResult) {
          messages.push(waterResult.message);
          console.log("[CONSUME] Water processed, message added:", waterResult.message);
        } else {
          console.log("[CONSUME] Water processing returned null");
        }
      } else {
        console.log("[CONSUME] Water not configured or not enabled");
      }

      console.log("[CONSUME] Checking movement boost:", {
        hasMovementBoost: item.system.hasMovementBoost,
        movementBoostAmount: item.system.movementBoostAmount,
        bonusDeslocamento: item.system.bonusDeslocamento
      });

      const movementEnabled =
        item.system?.bonusDeslocamento?.enabled ?? item.system?.hasMovementBoost ?? false;
      const movementAmount = Number(
        item.system?.bonusDeslocamento?.bonus ?? item.system?.movementBoostAmount ?? 0
      );

      if (movementEnabled && movementAmount > 0) {
        console.log("[CONSUME] Processing movement boost for item:", item.name);
        const movementResult = await ConsumableActions.processMovementBoost(item, sheet, quantity);
        if (movementResult) {
          messages.push(movementResult.message);
          appliedAttributeModifiers.push({
            type: 'movement',
            amount: movementResult.amount,
            label: `Movement +${movementResult.amount}`
          });
          console.log("[CONSUME] Movement boost processed, message added:", movementResult.message);
        } else {
          console.log("[CONSUME] Movement boost processing returned null");
        }
      } else {
        console.log("[CONSUME] Movement boost not configured or not enabled");
      }

      console.log("[CONSUME] Checking critical hit boost:", {
        hasCriticalHitBoost: item.system.hasCriticalHitBoost,
        criticalHitBoostAmount: item.system.criticalHitBoostAmount
      });

      const criticalHitEnabled =
        item.system?.hasCriticalHitBoost ?? Number(item.system?.criticalHitBoostAmount ?? 0) > 0;
      const criticalHitAmount = Number(item.system?.criticalHitBoostAmount ?? 0);

      if (criticalHitEnabled && criticalHitAmount > 0) {
        console.log("[CONSUME] Processing critical hit boost for item:", item.name);
        const criticalHitResult = await ConsumableActions.processCriticalHitBoost(item, sheet, quantity);
        if (criticalHitResult) {
          messages.push(criticalHitResult.message);
          appliedAttributeModifiers.push({
            type: 'criticalHit',
            amount: criticalHitResult.amount,
            label: `Critical Hit -${criticalHitResult.amount}`
          });
          console.log("[CONSUME] Critical hit boost processed, message added:", criticalHitResult.message);
        } else {
          console.log("[CONSUME] Critical hit boost processing returned null");
        }
      } else {
        console.log("[CONSUME] Critical hit boost not configured or not enabled");
      }

      if (rollResult && rollResult.isCriticalFailure) {
        if (item.system.hasCriticalFailureEffects && item.system.criticalFailureEffects?.length > 0) {
          appliedEffects.push(...item.system.criticalFailureEffects.filter(id => id && id.trim() !== ""));
        }
        if (item.system.hasCriticalFailureSkillLoss && item.system.criticalFailureSkillLoss?.length > 0) {
          const skillLosses = item.system.criticalFailureSkillLoss.map(loss => ({
            ability: loss.ability,
            value: -loss.value
          }));
          appliedSkillBonuses.push(...skillLosses);
        }
      }

      if (rollResult && rollResult.isCriticalHit) {
        if (item.system.hasCriticalHitEffects && item.system.criticalHitEffects?.length > 0) {
          appliedEffects.push(...item.system.criticalHitEffects.filter(id => id && id.trim() !== ""));
        }
        if (item.system.hasCriticalHitSkillBonus && item.system.criticalHitSkillBonus?.length > 0) {
          appliedSkillBonuses.push(...item.system.criticalHitSkillBonus);
        }
      }

      if (appliedSkillBonuses.length > 0) {
        await ConsumableActions.applySkillBonuses(appliedSkillBonuses, sheet);
      }

      if (appliedEffects.length > 0 || appliedSkillBonuses.length > 0 || appliedAttributeModifiers.length > 0) {
        await ConsumableActions.createTrackingEffectItem(item, rollType, appliedEffects, appliedSkillBonuses, appliedAttributeModifiers, sheet, quantity);
      }

      const newQuantity = Math.max(0, (item.system.quantity || 0) - quantity);

      if (newQuantity <= 0) {
        await item.delete();
      } else {
        await item.update({ "system.quantity": newQuantity });
      }

      const consumeMessage = newQuantity <= 0
        ? `${item.name} foi consumido completamente (${quantity} unidade(s))`
        : `${item.name} foi consumido (${quantity} unidade(s))`;

      if (messages.length > 0) {
        ui.notifications.info(`${consumeMessage}. ${messages.join('. ')}.`);
      } else {
        ui.notifications.info(`${consumeMessage}.`);
      }

      await sheet.render(false);

    } catch (error) {
      console.error("Error consuming item:", error);
      ui.notifications.error("Erro ao consumir o item.");
    }
  }

  /**
   * Process a skill check for item consumption
   * @param {Item} item
   * @param {CardiganSystemActorSheet} sheet
   * @returns {Promise<Object|null>}
   */
  static async processSkillCheck(item, sheet) {
    try {
      const ability = item.system.skillCheckAbility;
      const hasAdvantage = item.system.skillCheckAdvantage;
      const hasDisadvantage = item.system.skillCheckDisadvantage;
      const hasEnhancedAdvantage = item.system.skillCheckEnhancedAdvantage;
      const hasEnhancedDisadvantage = item.system.skillCheckEnhancedDisadvantage;

      const abilityData = sheet.document.system.abilities[ability];
      const abilityValue = abilityData.value || 0;
      const abilityBonus = abilityData.totalBonus || 0;
      const totalModifier = abilityValue + abilityBonus;

      const { CongeladoEffect } = await import('../../effects/effects/congelado.mjs');
      const congeladoPenalty = CongeladoEffect.getSkillPenalty(sheet.document);
      const finalModifier = totalModifier + congeladoPenalty;

      let rollFormula;
      let flavorText;
      const localizedAbility = game.i18n.localize(`CARDIGAN.Ability.${ability.charAt(0).toUpperCase() + ability.slice(1)}.long`);
      const advantageLevel = hasEnhancedAdvantage ? 2 : (hasAdvantage ? 1 : 0);
      const disadvantageLevel = hasEnhancedDisadvantage ? 2 : (hasDisadvantage ? 1 : 0);

      if (advantageLevel > disadvantageLevel) {
        if (advantageLevel === 2) {
          rollFormula = `3d20kh1 + ${finalModifier}`;
          flavorText = `${item.name} - ${localizedAbility} Check (Vantagem Aprimorada)`;
        } else {
          rollFormula = `2d20kh1 + ${finalModifier}`;
          flavorText = `${item.name} - ${localizedAbility} Check (Vantagem)`;
        }
      } else if (disadvantageLevel > advantageLevel) {
        if (disadvantageLevel === 2) {
          rollFormula = `3d20kl1 + ${finalModifier}`;
          flavorText = `${item.name} - ${localizedAbility} Check (Desvantagem Aprimorada)`;
        } else {
          rollFormula = `2d20kl1 + ${finalModifier}`;
          flavorText = `${item.name} - ${localizedAbility} Check (Desvantagem)`;
        }
      } else {
        rollFormula = `1d20 + ${finalModifier}`;
        flavorText = `${item.name} - ${localizedAbility} Check`;
      }

      if (congeladoPenalty !== 0) {
        flavorText += ` [Congelado ${congeladoPenalty}]`;
      }

      const roll = await Roll.create(rollFormula, sheet.document.getRollData());
      await roll.evaluate();

      const isCriticalFailure = ConsumableActions.checkCriticalFailure(roll);
      const isCriticalHit = ConsumableActions.checkCriticalHit(roll);

      const rollData = {
        speaker: ChatMessage.getSpeaker({ actor: sheet.document }),
        flavor: `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                   <i class="fas fa-dice-d20" style="color: #2196F3;"></i>
                   <strong>${flavorText}</strong>
                   ${isCriticalHit ? '<span style="color: #4CAF50; font-weight: bold; margin-left: 8px;">[CRITICAL HIT]</span>' : ''}
                   ${isCriticalFailure ? '<span style="color: #FF5722; font-weight: bold; margin-left: 8px;">[CRITICAL FAILURE]</span>' : ''}
                 </div>`,
        rollMode: game.settings.get("core", "rollMode"),
        flags: {
          cardigan: {
            isCriticalHit: isCriticalHit,
            isCriticalFailure: isCriticalFailure
          }
        }
      };

      await roll.toMessage(rollData);

      return {
        roll: roll,
        total: roll.total,
        formula: rollFormula,
        ability: ability,
        hasAdvantage: advantageLevel > disadvantageLevel,
        isCriticalFailure: isCriticalFailure,
        isCriticalHit: isCriticalHit
      };

    } catch (error) {
      console.error("Error processing skill check:", error);
      ui.notifications.warn(`Erro no teste de perícia: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if a roll resulted in a critical failure
   * @param {Roll} roll
   * @returns {boolean}
   */
  static checkCriticalFailure(roll) {
    try {
      if (!roll) return false;

      const totalResult = roll.total;
      if (totalResult <= 1) return true;

      if (!roll.dice || roll.dice.length === 0) return false;

      const d20Die = roll.dice.find(die => die.faces === 20);
      if (!d20Die || !d20Die.results || d20Die.results.length === 0) return false;

      const results = d20Die.results.map(r => r?.result).filter(r => r !== undefined);
      if (results.length <= 1) {
        const firstResult = d20Die.results[0];
        return firstResult && firstResult.result === 1;
      }

      return results.every(result => result === 1);
    } catch (error) {
      console.warn("Error checking critical failure:", error);
      return false;
    }
  }

  /**
   * Load configured effects from skill test add dialog.
   * @param {Item} item
   * @returns {Promise<Array>}
   */
  static async getConfiguredSkillTestEffects(item) {
    const effectsFromSystem = item.system?.skillTestAddedEffects;
    if (Array.isArray(effectsFromSystem)) return effectsFromSystem;

    const effectsFromFlag = await item.getFlag('cardigan', 'skillTestAddedEffects');
    return Array.isArray(effectsFromFlag) ? effectsFromFlag : [];
  }

  /**
   * Load configured skill modifiers from skill test add dialog.
   * @param {Item} item
   * @returns {Promise<Array>}
   */
  static async getConfiguredSkillTestSkills(item) {
    const skillsFromFlag = await item.getFlag('cardigan', 'skillTestAddedSkills');
    return Array.isArray(skillsFromFlag) ? skillsFromFlag : [];
  }

  /**
   * Load configured consumable skill bonuses from the consumable bonuses table.
   * @param {Item} item
   * @returns {Promise<Array>}
   */
  static async getConfiguredConsumableSkillBonuses(item) {
    const bonusesFromFlag = await item.getFlag('cardigan', 'consumableSkillBonuses');
    if (Array.isArray(bonusesFromFlag)) return bonusesFromFlag;
    if (bonusesFromFlag && typeof bonusesFromFlag === 'object') return Object.values(bonusesFromFlag);
    return [];
  }

  /**
   * Apply configured effects only when critical condition matches the checked flag.
   * @param {Array} configuredEffects
   * @param {Object} rollResult
   * @param {CardiganSystemActorSheet} sheet
   */
  static async applyConfiguredSkillTestEffects(configuredEffects, rollResult, sheet) {
    if (!rollResult?.isCriticalHit && !rollResult?.isCriticalFailure) return;

    const normalizeRoundsValue = (rounds) => {
      if (rounds === '∞' || rounds === 'infinito') return 'infinito';

      const parsedRounds = Number.parseInt(rounds, 10);
      if (Number.isNaN(parsedRounds)) return '0';

      const clampedRounds = Math.max(0, Math.min(5, parsedRounds));
      return String(clampedRounds);
    };

    for (const configuredEffect of configuredEffects) {
      if (!configuredEffect?.uuid) continue;

      const applyByCriticalHit = rollResult.isCriticalHit && configuredEffect.criticalHit;
      const applyByCriticalFailure = rollResult.isCriticalFailure && configuredEffect.criticalFailure;
      if (!applyByCriticalHit && !applyByCriticalFailure) continue;

      const sourceDocument = await fromUuid(configuredEffect.uuid);
      if (!sourceDocument) continue;

      const effectName = sourceDocument.name || configuredEffect.name;
      const alreadyActive = sheet.document.items.find((ownedItem) =>
        ownedItem.type === 'efeito' &&
        ownedItem.name === effectName &&
        !ownedItem.system?.consumableTracking?.isTrackingEffect
      );
      if (alreadyActive) continue;

      const itemData = foundry.utils.deepClone(sourceDocument.toObject());
      if (!itemData.system) itemData.system = {};
      itemData.system.rounds = normalizeRoundsValue(configuredEffect.rounds);

      await sheet.document.createEmbeddedDocuments('Item', [itemData]);
    }
  }

  /**
  * Apply configured skill modifiers when critical condition matches checked flags.
  * Modifies system.abilities.<key>.baseValue and returns tracking modifiers for rollback.
   * @param {Array} configuredSkills
   * @param {Object} rollResult
   * @param {CardiganSystemActorSheet} sheet
   * @returns {Promise<{appliedModifiers: Array, messages: Array}>}
   */
  static async applyConfiguredSkillTestSkills(configuredSkills, rollResult, sheet) {
    if (!rollResult?.isCriticalHit && !rollResult?.isCriticalFailure) {
      return { appliedModifiers: [], messages: [] };
    }

    const actor = sheet.document;
    const updateData = {};
    const appliedModifiers = [];
    const messages = [];

    const abilityLongKeys = {
      accuracy: 'CARDIGAN.Ability.Accuracy.long',
      evasion: 'CARDIGAN.Ability.Evasion.long',
      strength: 'CARDIGAN.Ability.Strength.long',
      dexterity: 'CARDIGAN.Ability.Dexterity.long',
      stamina: 'CARDIGAN.Ability.Stamina.long',
      stealth: 'CARDIGAN.Ability.Stealth.long',
      persuasion: 'CARDIGAN.Ability.Persuasion.long',
      intelligence: 'CARDIGAN.Ability.Intelligence.long',
      psionics: 'CARDIGAN.Ability.Psionics.long'
    };

    for (const configuredSkill of configuredSkills) {
      if (!configuredSkill || typeof configuredSkill.key !== 'string') continue;

      const applyByCriticalHit = rollResult.isCriticalHit && configuredSkill.criticalHit;
      const applyByCriticalFailure = rollResult.isCriticalFailure && configuredSkill.criticalFailure;
      if (!applyByCriticalHit && !applyByCriticalFailure) continue;

      const parsedValue = Number.parseInt(configuredSkill.skillValue ?? configuredSkill.value, 10);
      if (Number.isNaN(parsedValue) || parsedValue === 0) continue;

      const abilityKey = configuredSkill.key;
      const abilityData = actor.system?.abilities?.[abilityKey];
      if (!abilityData) continue;

      const delta = parsedValue;
      const currentValue = updateData[`system.abilities.${abilityKey}.baseBonus`] ?? abilityData.baseBonus ?? 0;
      const newValue = currentValue + delta;
      const appliedAmount = newValue - currentValue;
      if (appliedAmount === 0) continue;

      updateData[`system.abilities.${abilityKey}.baseBonus`] = newValue;

      const localizedAbility = game.i18n.localize(abilityLongKeys[abilityKey] || abilityKey);
      const sign = appliedAmount >= 0 ? '+' : '';
      messages.push(`${localizedAbility}: ${sign}${appliedAmount}`);

      appliedModifiers.push({
        type: 'abilityBaseBonus',
        ability: abilityKey,
        amount: appliedAmount,
        label: `${localizedAbility} ${sign}${appliedAmount}`
      });
    }

    if (Object.keys(updateData).length > 0) {
      await actor.update(updateData);
    }

    return { appliedModifiers, messages };
  }

  /**
   * Apply configured consumable skill bonuses from table rows.
    * Modifies system.abilities.<key>.baseBonus so the proficiency bonus-container reflects changes.
   * @param {Array} configuredBonuses
   * @param {CardiganSystemActorSheet} sheet
   * @param {number} quantity
   * @returns {Promise<{appliedModifiers: Array, messages: Array}>}
   */
  static async applyConfiguredConsumableSkillBonuses(configuredBonuses, sheet, quantity = 1) {
    if (!Array.isArray(configuredBonuses) || configuredBonuses.length === 0) {
      return { appliedModifiers: [], messages: [] };
    }

    const actor = sheet.document;
    const updateData = {};
    const appliedModifiers = [];
    const messages = [];
    const consumedQuantity = Math.max(1, Number(quantity) || 1);

    const abilityLongKeys = {
      accuracy: 'CARDIGAN.Ability.Accuracy.long',
      evasion: 'CARDIGAN.Ability.Evasion.long',
      strength: 'CARDIGAN.Ability.Strength.long',
      dexterity: 'CARDIGAN.Ability.Dexterity.long',
      stamina: 'CARDIGAN.Ability.Stamina.long',
      stealth: 'CARDIGAN.Ability.Stealth.long',
      persuasion: 'CARDIGAN.Ability.Persuasion.long',
      intelligence: 'CARDIGAN.Ability.Intelligence.long',
      psionics: 'CARDIGAN.Ability.Psionics.long'
    };

    for (const configuredBonus of configuredBonuses) {
      if (!configuredBonus || typeof configuredBonus.skill !== 'string') continue;

      const abilityKey = configuredBonus.skill.trim();
      if (!abilityKey) continue;

      const parsedBonus = Number.parseInt(configuredBonus.bonus, 10);
      if (Number.isNaN(parsedBonus) || parsedBonus === 0) continue;

      const abilityData = actor.system?.abilities?.[abilityKey];
      if (!abilityData) continue;

      const delta = parsedBonus * consumedQuantity;
      const currentValue = updateData[`system.abilities.${abilityKey}.baseBonus`] ?? abilityData.baseBonus ?? 0;
      const newValue = currentValue + delta;
      const appliedAmount = newValue - currentValue;
      if (appliedAmount === 0) continue;

      updateData[`system.abilities.${abilityKey}.baseBonus`] = newValue;

      const localizedAbility = game.i18n.localize(abilityLongKeys[abilityKey] || abilityKey);
      const sign = appliedAmount >= 0 ? '+' : '';
      messages.push(`${localizedAbility}: ${sign}${appliedAmount}`);

      appliedModifiers.push({
        type: 'abilityBaseBonus',
        ability: abilityKey,
        amount: appliedAmount,
        label: `${localizedAbility} ${sign}${appliedAmount}`
      });
    }

    if (Object.keys(updateData).length > 0) {
      await actor.update(updateData);
    }

    return { appliedModifiers, messages };
  }

  /**
   * Check if a roll resulted in a critical hit
   * @param {Roll} roll
   * @returns {boolean}
   */
  static checkCriticalHit(roll) {
    try {
      if (!roll || !roll.dice || roll.dice.length === 0) return false;

      const d20Die = roll.dice.find(die => die.faces === 20);
      if (!d20Die || !d20Die.results || d20Die.results.length === 0) return false;

      return roll.total >= 20;
    } catch (error) {
      console.warn("Error checking critical hit:", error);
      return false;
    }
  }

  /**
   * Process critical failure effects and skill losses
   * @param {Item} item
   * @param {Roll} roll
   * @param {CardiganSystemActorSheet} sheet
   */
  static async processCriticalFailure(item, roll, sheet) {
    try {
      const criticalFailureMessages = [];

      if (item.system.hasCriticalFailureEffects && item.system.criticalFailureEffects?.length > 0) {
        for (const effectId of item.system.criticalFailureEffects) {
          if (effectId && effectId.trim() !== "") {
            await ConsumableActions.applyCriticalFailureEffect(effectId, sheet);

            const effect = game.packs.find(p => p.metadata.id === "cardigan.efeitos-cardigan")?.index.get(effectId);
            const effectName = effect?.name || effectId;
            criticalFailureMessages.push(`Applied effect: <strong>${effectName}</strong>`);
          }
        }
      }

      if (item.system.hasCriticalFailureSkillLoss && item.system.criticalFailureSkillLoss?.length > 0) {
        for (const skillLoss of item.system.criticalFailureSkillLoss) {
          if (skillLoss.ability && skillLoss.value > 0) {
            const abilityName = game.i18n.localize(`CARDIGAN.Ability.${skillLoss.ability.charAt(0).toUpperCase() + skillLoss.ability.slice(1)}.long`);
            criticalFailureMessages.push(`Lost <strong>${skillLoss.value}</strong> points from <strong>${abilityName}</strong>`);
          }
        }
      }

      if (criticalFailureMessages.length > 0) {
        const messageContent = `
          <div style="background: rgba(255, 87, 34, 0.1); border: 1px solid #FF5722; border-radius: 4px; padding: 8px; margin-top: 8px;">
            <div style="color: #FF5722; font-weight: bold; margin-bottom: 4px;">
              <i class="fas fa-exclamation-triangle"></i> Critical Failure Effects:
            </div>
            <ul style="margin: 0; padding-left: 16px;">
              ${criticalFailureMessages.map(msg => `<li>${msg}</li>`).join('')}
            </ul>
          </div>
        `;

        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: sheet.document }),
          content: messageContent,
          rollMode: game.settings.get("core", "rollMode")
        });
      }

    } catch (error) {
      console.error("Error processing critical failure:", error);
      ui.notifications.warn(`Erro ao processar falha crítica: ${error.message}`);
    }
  }

  /**
   * Apply a critical failure effect to the actor
   * @param {string} effectId
   * @param {CardiganSystemActorSheet} sheet
   */
  static async applyCriticalFailureEffect(effectId, sheet) {
    try {
      const pack = game.packs.get("cardigan.efeitos-cardigan");
      if (!pack) {
        console.warn("Could not find effects compendium");
        return;
      }

      const effectDocument = await pack.getDocument(effectId);
      if (!effectDocument) {
        console.warn(`Could not find effect with ID: ${effectId}`);
        return;
      }

      const effectData = effectDocument.toObject();
      effectData.origin = `Actor.${sheet.document.id}`;

      await sheet.document.createEmbeddedDocuments("Item", [effectData]);

    } catch (error) {
      console.error(`Error applying critical failure effect ${effectId}:`, error);
    }
  }

  /**
   * Apply skill loss from critical failure
   * @param {string} ability
   * @param {number} lossValue
   * @param {CardiganSystemActorSheet} sheet
   */
  static async applyCriticalFailureSkillLoss(ability, lossValue, sheet) {
    try {
      const abilityData = sheet.document.system.abilities[ability];
      const currentManualValue = abilityData?.manualValue || 0;
      const newManualValue = currentManualValue - lossValue;

      const updateData = {};
      updateData[`system.abilities.${ability}.manualValue`] = newManualValue;

      await sheet.document.update(updateData);

    } catch (error) {
      console.error(`Error applying skill loss for ${ability}:`, error);
    }
  }

  /**
   * Process critical hit effects and skill bonuses
   * @param {Item} item
   * @param {Roll} roll
   * @param {CardiganSystemActorSheet} sheet
   */
  static async processCriticalHit(item, roll, sheet) {
    try {
      const criticalHitMessages = [];

      if (item.system.hasCriticalHitEffects && item.system.criticalHitEffects?.length > 0) {
        for (const effectId of item.system.criticalHitEffects) {
          if (effectId && effectId.trim() !== "") {
            await ConsumableActions.applyCriticalHitEffect(effectId, sheet);

            const effect = game.packs.find(p => p.metadata.id === "cardigan.efeitos-cardigan")?.index.get(effectId);
            const effectName = effect?.name || effectId;
            criticalHitMessages.push(`Applied effect: <strong>${effectName}</strong>`);
          }
        }
      }

      if (item.system.hasCriticalHitSkillBonus && item.system.criticalHitSkillBonus?.length > 0) {
        for (const skillBonus of item.system.criticalHitSkillBonus) {
          if (skillBonus.ability && skillBonus.value > 0) {
            const abilityName = game.i18n.localize(`CARDIGAN.Ability.${skillBonus.ability.charAt(0).toUpperCase() + skillBonus.ability.slice(1)}.long`);
            criticalHitMessages.push(`Gained <strong>${skillBonus.value}</strong> bonus to <strong>${abilityName}</strong>`);
          }
        }
      }

      if (criticalHitMessages.length > 0) {
        const messageContent = `
          <div style="background: rgba(76, 175, 80, 0.1); border: 1px solid #4CAF50; border-radius: 4px; padding: 8px; margin-top: 8px;">
            <div style="color: #4CAF50; font-weight: bold; margin-bottom: 4px;">
              <i class="fas fa-star"></i> Critical Hit Effects:
            </div>
            <ul style="margin: 0; padding-left: 16px;">
              ${criticalHitMessages.map(msg => `<li>${msg}</li>`).join('')}
            </ul>
          </div>
        `;

        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: sheet.document }),
          content: messageContent,
          rollMode: game.settings.get("core", "rollMode")
        });
      }

    } catch (error) {
      console.error("Error processing critical hit:", error);
      ui.notifications.warn(`Erro ao processar acerto crítico: ${error.message}`);
    }
  }

  /**
   * Apply a critical hit effect to the actor
   * @param {string} effectId
   * @param {CardiganSystemActorSheet} sheet
   */
  static async applyCriticalHitEffect(effectId, sheet) {
    try {
      const pack = game.packs.get("cardigan.efeitos-cardigan");
      if (!pack) {
        console.warn("Could not find effects compendium");
        return;
      }

      const effectDocument = await pack.getDocument(effectId);
      if (!effectDocument) {
        console.warn(`Could not find effect with ID: ${effectId}`);
        return;
      }

      const effectData = effectDocument.toObject();
      effectData.origin = `Actor.${sheet.document.id}`;

      await sheet.document.createEmbeddedDocuments("Item", [effectData]);

    } catch (error) {
      console.error(`Error applying critical hit effect ${effectId}:`, error);
    }
  }

  /**
   * Apply skill bonus from critical hit
   * @param {string} ability
   * @param {number} bonusValue
   * @param {CardiganSystemActorSheet} sheet
   */
  static async applyCriticalHitSkillBonus(ability, bonusValue, sheet) {
    try {
      const abilityData = sheet.document.system.abilities[ability];
      const currentManualBonus = abilityData?.manualBonus || 0;
      const newManualBonus = currentManualBonus + bonusValue;

      const updateData = {};
      updateData[`system.abilities.${ability}.manualBonus`] = newManualBonus;

      await sheet.document.update(updateData);

    } catch (error) {
      console.error(`Error applying skill bonus for ${ability}:`, error);
    }
  }

  /**
   * Apply skill bonuses directly to actor abilities
   * @param {Array} appliedSkillBonuses
   * @param {CardiganSystemActorSheet} sheet
   */
  static async applySkillBonuses(appliedSkillBonuses, sheet) {
    const updateData = {};

    for (const bonus of appliedSkillBonuses) {
      const ability = bonus.ability;
      const bonusValue = bonus.bonus || bonus.value || 0;

      if (ability && bonusValue !== 0) {
        const abilityData = sheet.document.system.abilities[ability];

        if (bonusValue < 0) {
          const currentManualValue = abilityData?.manualValue || 0;
          const newManualValue = currentManualValue + bonusValue;
          updateData[`system.abilities.${ability}.manualValue`] = newManualValue;

          console.log(`[CARDIGAN] Applied ${bonusValue} penalty to ${ability}.manualValue: ${currentManualValue} -> ${newManualValue}`);
        } else {
          const currentManualBonus = abilityData?.manualBonus || 0;
          const newManualBonus = currentManualBonus + bonusValue;
          updateData[`system.abilities.${ability}.manualBonus`] = newManualBonus;

          console.log(`[CARDIGAN] Applied ${bonusValue} bonus to ${ability}.manualBonus: ${currentManualBonus} -> ${newManualBonus}`);
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await sheet.document.update(updateData);
    }
  }

  /**
   * Create a tracking effect item for consumed items
   * @param {Item} originalItem
   * @param {string} rollType
   * @param {Array} appliedEffects
   * @param {Array} appliedSkillBonuses
   * @param {Array} appliedAttributeModifiers
   * @param {CardiganSystemActorSheet} sheet
   * @param {number} quantity
   */
  static async createTrackingEffectItem(originalItem, rollType, appliedEffects = [], appliedSkillBonuses = [], appliedAttributeModifiers = [], sheet, quantity = 1) {
    try {
      const consumedQuantity = Math.max(1, Number(quantity) || 1);
      const itemName = originalItem.name;
      let description = `Effects from consuming ${originalItem.name}`;

      switch (rollType) {
        case 'critical-failure':
          description = `Critical failure effects from consuming ${originalItem.name}`;
          break;
        case 'critical-hit':
          description = `Critical hit effects from consuming ${originalItem.name}`;
          break;
        default:
          break;
      }

      const effectDescriptions = [];

      if (appliedEffects.length > 0) {
        effectDescriptions.push('<strong>Applied Effects:</strong>');
        for (const effectId of appliedEffects) {
          const pack = game.packs.get("cardigan.efeitos-cardigan");
          if (pack) {
            const effectDoc = await pack.getDocument(effectId);
            const effectName = effectDoc?.name || effectId;
            effectDescriptions.push(`• ${effectName}`);
          }
        }
      }

      if (appliedSkillBonuses.length > 0) {
        effectDescriptions.push('<strong>Applied Skill Bonuses:</strong>');
        for (const bonus of appliedSkillBonuses) {
          const abilityName = game.i18n.localize(`CARDIGAN.Ability.${bonus.ability.charAt(0).toUpperCase() + bonus.ability.slice(1)}.long`);
          const bonusValue = bonus.value || bonus.bonus || 0;
          const sign = bonusValue >= 0 ? '+' : '';
          effectDescriptions.push(`• ${abilityName}: ${sign}${bonusValue}`);
        }
      }

      if (appliedAttributeModifiers.length > 0) {
        effectDescriptions.push('<strong>Applied Attribute Modifiers:</strong>');
        for (const modifier of appliedAttributeModifiers) {
          if (modifier.type === 'movement') {
            effectDescriptions.push(`• Movement: +${modifier.amount}`);
          } else if (modifier.type === 'criticalHit') {
            effectDescriptions.push(`• Critical Hit: -${modifier.amount} (improved)`);
          } else if (modifier.type === 'armorBonus') {
            effectDescriptions.push(`• Armor Bonus: +${modifier.amount}`);
          }
        }
      }

      if (effectDescriptions.length > 0) {
        description += '<br><br>' + effectDescriptions.join('<br>');
      }

      const existingTrackingCandidates = sheet.document.items
        .filter((i) => {
          if (i.type !== 'efeito') return false;

          const tracking = i.system?.consumableTracking;
          if (!tracking?.isTrackingEffect) return false;
          if (tracking.originalItemId !== originalItem.id) return false;

          const existingRollType = tracking.rollType || 'normal';
          return existingRollType === rollType;
        })
        .sort((a, b) => (a.sort || 0) - (b.sort || 0));

      const existingTrackingItem = existingTrackingCandidates[0];

      if (existingTrackingItem) {
        const currentConsumedQuantity = Number(existingTrackingItem.system?.consumableTracking?.consumedQuantity || 0);
        const existingAttributeModifiers = Array.isArray(existingTrackingItem.system?.consumableTracking?.appliedAttributeModifiers)
          ? existingTrackingItem.system.consumableTracking.appliedAttributeModifiers
          : [];
        const mergedAttributeModifiersMap = new Map();

        for (const modifier of existingAttributeModifiers) {
          const key = `${modifier.type || ''}:${modifier.ability || ''}`;
          mergedAttributeModifiersMap.set(key, {
            ...modifier,
            amount: Number(modifier.amount || 0)
          });
        }

        for (const modifier of appliedAttributeModifiers) {
          const key = `${modifier.type || ''}:${modifier.ability || ''}`;
          const current = mergedAttributeModifiersMap.get(key);
          if (current) {
            current.amount += Number(modifier.amount || 0);
            if (modifier.label) current.label = modifier.label;
            mergedAttributeModifiersMap.set(key, current);
          } else {
            mergedAttributeModifiersMap.set(key, {
              ...modifier,
              amount: Number(modifier.amount || 0)
            });
          }
        }

        const mergedAttributeModifiers = Array.from(mergedAttributeModifiersMap.values())
          .filter((modifier) => Number(modifier.amount || 0) !== 0);

        const existingSkillBonuses = Array.isArray(existingTrackingItem.system?.consumableTracking?.appliedSkillBonuses)
          ? existingTrackingItem.system.consumableTracking.appliedSkillBonuses
          : [];
        const mergedSkillBonusesMap = new Map();

        for (const bonus of existingSkillBonuses) {
          const key = `${bonus.ability || ''}`;
          mergedSkillBonusesMap.set(key, {
            ...bonus,
            value: Number(bonus.value || bonus.bonus || 0)
          });
        }

        for (const bonus of appliedSkillBonuses) {
          const key = `${bonus.ability || ''}`;
          const current = mergedSkillBonusesMap.get(key);
          if (current) {
            current.value += Number(bonus.value || bonus.bonus || 0);
            mergedSkillBonusesMap.set(key, current);
          } else {
            mergedSkillBonusesMap.set(key, {
              ...bonus,
              value: Number(bonus.value || bonus.bonus || 0)
            });
          }
        }

        const mergedSkillBonuses = Array.from(mergedSkillBonusesMap.values())
          .filter((bonus) => Number(bonus.value || bonus.bonus || 0) !== 0);

        await existingTrackingItem.update({
          name: itemName,
          img: originalItem.img,
          'system.description': description,
          'system.consumableTracking.originalItemName': originalItem.name,
          'system.consumableTracking.consumedQuantity': currentConsumedQuantity + consumedQuantity,
          'system.consumableTracking.appliedEffects': appliedEffects,
          'system.consumableTracking.appliedSkillBonuses': mergedSkillBonuses,
          'system.consumableTracking.appliedAttributeModifiers': mergedAttributeModifiers,
        });

        return existingTrackingItem;
      }

      const trackingItemData = {
        name: itemName,
        type: 'efeito',
        img: originalItem.img,
        system: {
          description: description,
          rounds: 'infinito',
          effectType: 'positive',
          consumableTracking: {
            isTrackingEffect: true,
            originalItemName: originalItem.name,
            originalItemId: originalItem.id,
            consumedQuantity: consumedQuantity,
            rollType: rollType,
            appliedEffects: appliedEffects,
            appliedSkillBonuses: appliedSkillBonuses,
            appliedAttributeModifiers: appliedAttributeModifiers,
          }
        }
      };

      const createdItems = await sheet.document.createEmbeddedDocuments("Item", [trackingItemData]);
      return createdItems[0];

    } catch (error) {
      console.error("Error creating tracking effect item:", error);
      throw error;
    }
  }

  /**
   * Process health modifier from consumable items
   * @param {Item} item
   * @param {CardiganSystemActorSheet} sheet
   */
  static async processHealthModifier(item, sheet) {
    try {
      console.log("[HEALTH MODIFIER] Processing health modifier for item:", item.name);

      const baseDice = item.system.healthModifierDice;
      const quantity = item.system.healthModifierQuantity || 1;
      const modifierType = item.system.healthModifierType;

      console.log("[HEALTH MODIFIER] Base dice:", baseDice);
      console.log("[HEALTH MODIFIER] Quantity:", quantity);
      console.log("[HEALTH MODIFIER] Modifier type:", modifierType);

      if (!baseDice || !modifierType) {
        console.log("[HEALTH MODIFIER] Missing dice formula or modifier type");
        return null;
      }

      const diceFormula = `${quantity}${baseDice.substring(1)}`;
      console.log("[HEALTH MODIFIER] Final dice formula:", diceFormula);

      const roll = new Roll(diceFormula);
      await roll.evaluate();

      let rollTotal = roll.total;
      const currentHealth = sheet.document.system.health.value;
      const maxHealth = sheet.document.system.health.max;

      console.log("[HEALTH MODIFIER] Base roll total:", rollTotal);

      let skillBonus = 0;
      let skillName = "";
      if (item.system.healthModifierAddSkill && item.system.healthModifierSkill) {
        const skillKey = item.system.healthModifierSkill;
        const abilityData = sheet.document.system.abilities[skillKey];
        const skillValue = (abilityData?.value || 0) + (abilityData?.totalBonus || 0);

        skillBonus = item.system.healthModifierDoubleSkill ? skillValue * 2 : skillValue;
        skillName = game.i18n.localize(`CARDIGAN.Ability.${skillKey.charAt(0).toUpperCase() + skillKey.slice(1)}.long`);

        rollTotal += skillBonus;

        console.log("[HEALTH MODIFIER] Skill bonus:", {
          skill: skillName,
          baseValue: skillValue,
          doubled: item.system.healthModifierDoubleSkill,
          finalBonus: skillBonus,
          totalWithSkill: rollTotal
        });
      }

      let additionalBonus = 0;
      if (item.system.healthModifierAdditionalBonus && item.system.healthModifierAdditionalBonus > 0) {
        additionalBonus = item.system.healthModifierAdditionalBonus;
        rollTotal += additionalBonus;

        console.log("[HEALTH MODIFIER] Additional bonus:", {
          bonus: additionalBonus,
          totalWithBonus: rollTotal
        });
      }

      console.log("[HEALTH MODIFIER] Final total (dice + skill + bonus):", rollTotal);
      console.log("[HEALTH MODIFIER] Current health:", currentHealth);
      console.log("[HEALTH MODIFIER] Max health:", maxHealth);
      console.log("[HEALTH MODIFIER] Is temporary:", item.system.healthModifierIsTemporary);

      let formula = `${diceFormula}: ${roll.total}`;
      if (skillBonus > 0) {
        formula += ` + ${skillName} ${skillBonus}`;
      }
      if (additionalBonus > 0) {
        formula += ` + Bônus ${additionalBonus}`;
      }

      let message;
      let updateResult;

      if (item.system.healthModifierIsTemporary) {
        console.log("[HEALTH MODIFIER] Creating temporary health effect for tracking table");

        const healthBonus = modifierType === 'add' ? rollTotal : -rollTotal;
        const currentHealthBonus = sheet.document.system.status.healthBonus || 0;
        const newHealthBonus = currentHealthBonus + healthBonus;

        updateResult = await sheet.document.update({
          'system.status.healthBonus': newHealthBonus
        });

        const trackingEffectName = item.name;

        const trackingDescription = modifierType === 'add'
          ? `Health Bonus: +${rollTotal} (${formula})`
          : `Health Bonus: ${rollTotal} (${formula})`;

        const effectItemData = {
          name: trackingEffectName,
          type: "efeito",
          system: {
            rounds: 'infinito',
            description: trackingDescription,
            healthBonusValue: healthBonus,
            sourceItemId: item.id,
            sourceItemName: item.name,
            isTemporaryHealth: true
          }
        };

        console.log("[HEALTH MODIFIER] Creating effect item with data:", effectItemData);

        const createdItems = await sheet.document.createEmbeddedDocuments("Item", [effectItemData]);
        console.log("[HEALTH MODIFIER] Created effect item:", createdItems[0]);
        console.log("[HEALTH MODIFIER] Created item system data:", createdItems[0].system);

        if (modifierType === 'add') {
          message = `Temporary Health added: +${rollTotal} (${formula}) - Added to Health Bonus`;
        } else {
          message = `Temporary Health reduced: -${rollTotal} (${formula}) - Removed from Health Bonus`;
        }
        console.log("[HEALTH MODIFIER] Temporary health tracking effect created with healthBonusValue:", healthBonus);

      } else {
        let newHealth;

        if (modifierType === 'add') {
          newHealth = Math.min(currentHealth + rollTotal, maxHealth);
          message = `Health restored: +${rollTotal} (${formula}) - Health: ${currentHealth} → ${newHealth}`;
        } else if (modifierType === 'subtract') {
          newHealth = Math.max(currentHealth - rollTotal, 0);
          message = `Health lost: -${rollTotal} (${formula}) - Health: ${currentHealth} → ${newHealth}`;
        }

        console.log("[HEALTH MODIFIER] New health calculated:", newHealth);

        console.log("[HEALTH MODIFIER] Updating actor health to:", newHealth);
        updateResult = await sheet.document.update({
          'system.health.value': newHealth
        });
      }

      console.log("[HEALTH MODIFIER] Update result:", updateResult);

      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: sheet.document }),
        flavor: `Health Modifier (${modifierType === 'add' ? 'Healing' : 'Damage'})`,
        rollMode: game.settings.get('core', 'rollMode')
      });

      console.log("[HEALTH MODIFIER] Health modifier processed successfully");
      return { message };

    } catch (error) {
      console.error("[HEALTH MODIFIER] Error processing health modifier:", error);
      return null;
    }
  }

  /**
   * Process energy modifier from consumable items
   * @param {Item} item
   * @param {CardiganSystemActorSheet} sheet
   */
  static async processEnergyModifier(item, sheet) {
    try {
      console.log("[ENERGY MODIFIER] Processing energy modifier for item:", item.name);

      const baseDice = item.system.energyModifierDice;
      const quantity = item.system.energyModifierQuantity || 1;
      const modifierType = item.system.energyModifierType;

      console.log("[ENERGY MODIFIER] Base dice:", baseDice);
      console.log("[ENERGY MODIFIER] Quantity:", quantity);
      console.log("[ENERGY MODIFIER] Modifier type:", modifierType);

      if (!baseDice || !modifierType) {
        console.log("[ENERGY MODIFIER] Missing dice formula or modifier type");
        return null;
      }

      const diceFormula = `${quantity}${baseDice.substring(1)}`;
      console.log("[ENERGY MODIFIER] Final dice formula:", diceFormula);

      const roll = new Roll(diceFormula);
      await roll.evaluate();

      let rollTotal = roll.total;
      const currentEnergy = sheet.document.system.power.value;
      const maxEnergy = sheet.document.system.power.max;

      console.log("[ENERGY MODIFIER] Base roll total:", rollTotal);

      let skillBonus = 0;
      let skillName = "";
      if (item.system.energyModifierAddSkill && item.system.energyModifierSkill) {
        const skillKey = item.system.energyModifierSkill;

        console.log("[ENERGY MODIFIER] Debug - Skill check:", {
          skillKey: skillKey,
          abilities: sheet.document.system.abilities,
          hasAbilities: !!sheet.document.system.abilities,
          specificAbility: sheet.document.system.abilities?.[skillKey]
        });

        const abilityData = sheet.document.system.abilities?.[skillKey];
        if (!abilityData) {
          console.warn("[ENERGY MODIFIER] Ability data not found for skill:", skillKey);
        } else {
          const skillValue = (abilityData?.value || 0) + (abilityData?.totalBonus || 0);

          skillBonus = item.system.energyModifierDoubleSkill ? skillValue * 2 : skillValue;
          skillName = game.i18n.localize(`CARDIGAN.Ability.${skillKey.charAt(0).toUpperCase() + skillKey.slice(1)}.long`);

          rollTotal += skillBonus;

          console.log("[ENERGY MODIFIER] Skill bonus:", {
            skill: skillName,
            baseValue: skillValue,
            doubled: item.system.energyModifierDoubleSkill,
            finalBonus: skillBonus,
            totalWithSkill: rollTotal
          });
        }
      }

      let additionalBonus = 0;
      if (item.system.energyModifierAdditionalBonus && item.system.energyModifierAdditionalBonus > 0) {
        additionalBonus = item.system.energyModifierAdditionalBonus;
        rollTotal += additionalBonus;

        console.log("[ENERGY MODIFIER] Additional bonus:", {
          bonus: additionalBonus,
          totalWithBonus: rollTotal
        });
      }

      console.log("[ENERGY MODIFIER] Final total (dice + skill + bonus):", rollTotal);
      console.log("[ENERGY MODIFIER] Current energy:", currentEnergy);
      console.log("[ENERGY MODIFIER] Max energy:", maxEnergy);
      console.log("[ENERGY MODIFIER] Is temporary:", item.system.energyModifierIsTemporary);

      let formula = `${diceFormula}: ${roll.total}`;
      if (skillBonus > 0) {
        formula += ` + ${skillName} ${skillBonus}`;
      }
      if (additionalBonus > 0) {
        formula += ` + Bônus ${additionalBonus}`;
      }

      let message;
      let updateResult;

      if (item.system.energyModifierIsTemporary) {
        console.log("[ENERGY MODIFIER] Creating temporary energy effect for tracking table");

        const energyBonus = modifierType === 'add' ? rollTotal : -rollTotal;
        const currentEnergyBonus = sheet.document.system.status.energyBonus || 0;
        const newEnergyBonus = currentEnergyBonus + energyBonus;

        updateResult = await sheet.document.update({
          'system.status.energyBonus': newEnergyBonus
        });

        const trackingEffectName = item.name;

        const trackingDescription = modifierType === 'add'
          ? `Energy Bonus: +${rollTotal} (${formula})`
          : `Energy Bonus: ${rollTotal} (${formula})`;

        const effectItemData = {
          name: trackingEffectName,
          type: "efeito",
          system: {
            rounds: 'infinito',
            description: trackingDescription,
            energyBonusValue: energyBonus,
            sourceItemId: item.id,
            sourceItemName: item.name,
            isTemporaryEnergy: true
          }
        };

        console.log("[ENERGY MODIFIER] Creating effect item with data:", effectItemData);

        const createdItems = await sheet.document.createEmbeddedDocuments("Item", [effectItemData]);
        console.log("[ENERGY MODIFIER] Created effect item:", createdItems[0]);
        console.log("[ENERGY MODIFIER] Created item system data:", createdItems[0].system);

        if (modifierType === 'add') {
          message = `Temporary Energy added: +${rollTotal} (${formula}) - Added to Energy Bonus`;
        } else {
          message = `Temporary Energy reduced: -${rollTotal} (${formula}) - Removed from Energy Bonus`;
        }
        console.log("[ENERGY MODIFIER] Temporary energy tracking effect created with energyBonusValue:", energyBonus);

      } else {
        let newEnergy;

        if (modifierType === 'add') {
          newEnergy = Math.min(currentEnergy + rollTotal, maxEnergy);
          message = `Energy restored: +${rollTotal} (${formula}) - Energy: ${currentEnergy} → ${newEnergy}`;
        } else if (modifierType === 'subtract') {
          newEnergy = Math.max(currentEnergy - rollTotal, 0);
          message = `Energy lost: -${rollTotal} (${formula}) - Energy: ${currentEnergy} → ${newEnergy}`;
        }

        console.log("[ENERGY MODIFIER] New energy calculated:", newEnergy);

        console.log("[ENERGY MODIFIER] Updating actor energy to:", newEnergy);
        updateResult = await sheet.document.update({
          'system.power.value': newEnergy
        });
      }

      console.log("[ENERGY MODIFIER] Update result:", updateResult);

      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: sheet.document }),
        flavor: `Energy Modifier (${modifierType === 'add' ? 'Restoration' : 'Drain'})`,
        rollMode: game.settings.get('core', 'rollMode')
      });

      console.log("[ENERGY MODIFIER] Energy modifier processed successfully");
      return { message };

    } catch (error) {
      console.error("[ENERGY MODIFIER] Error processing energy modifier:", error);
      return null;
    }
  }

  /**
   * Process armor bonus effects when consuming an item
   * @param {Item} item
   * @param {CardiganSystemActorSheet} sheet
   * @param {number} quantity
   */
  static async processArmorBonus(item, sheet, quantity = 1) {
    try {
      console.log("[ARMOR BONUS] Processing armor bonus for item:", item.name);

      const baseAmount = Number(item.system?.armorBonusAmount ?? 0);
      const consumedQuantity = Math.max(1, Number(quantity) || 1);
      const bonusAmount = baseAmount * consumedQuantity;
      const armorEnabled = item.system?.hasArmorBonus ?? (bonusAmount > 0);

      if (!armorEnabled || bonusAmount <= 0) {
        console.log("[ARMOR BONUS] No armor bonus configured or amount is 0");
        return null;
      }

      let message = "";
      let updateResult = null;

      console.log("[ARMOR BONUS] Applying temporary armor bonus:", bonusAmount);

      const currentArmorBonus = sheet.document.system.status.armorBonus || 0;
      const newArmorBonus = currentArmorBonus + bonusAmount;

      updateResult = await sheet.document.update({
        'system.status.armorBonus': newArmorBonus
      });

      message = `Temporary Armor Bonus added: +${bonusAmount} (${baseAmount} x ${consumedQuantity}) - Added to Armor Bonus`;
      console.log("[ARMOR BONUS] Armor bonus applied to actor status (tracking handled by unified consumable effect):", bonusAmount);

      console.log("[ARMOR BONUS] Update result:", updateResult);

      console.log("[ARMOR BONUS] Armor bonus processed successfully");
      return { message, amount: bonusAmount };

    } catch (error) {
      console.error("[ARMOR BONUS] Error processing armor bonus:", error);
      return null;
    }
  }

  /**
   * Process status ailments effects when consuming an item
   * @param {Item} item
  * @param {CardiganSystemActorSheet} sheet
  * @param {number} quantity
   */
  static async processStatusAilments(item, sheet, quantity = 1) {
    try {
      console.log("[STATUS AILMENTS] Processing status ailments for item:", item.name);
      console.log("[STATUS AILMENTS] Item configuration:", {
        hasStatusAilments: item.system.hasStatusAilments,
        hasSanityModifier: item.system.hasSanityModifier,
        sanityModifierType: item.system.sanityModifierType,
        sanityModifierAmount: item.system.sanityModifierAmount
      });

      const modifierType = item.system.sanityModifierType;
      const baseAmount = Number(item.system.sanityModifierAmount ?? 0);
      const consumedQuantity = Math.max(1, Number(quantity) || 1);
      const amount = baseAmount * consumedQuantity;
      const hasValidType = modifierType === "increase" || modifierType === "decrease";

      if (!item.system.hasStatusAilments || !item.system.hasSanityModifier || amount <= 0 || !hasValidType) {
        console.log("[STATUS AILMENTS] No status ailments configured - missing requirements");
        return null;
      }
      let message = "";

      console.log("[STATUS AILMENTS] Processing sanity modifier:", {
        type: modifierType,
        amount: amount
      });

      const currentSanity = sheet.document.system.status.sanity || 0;
      let newSanity = currentSanity;
      let chatMessage = "";

      if (modifierType === "increase") {
        newSanity = Math.min(currentSanity + amount, 5);
        message = `Sanity increased by ${amount}: ${currentSanity} → ${newSanity}`;

        if (newSanity === 0) {
          chatMessage = `${sheet.document.name}: Estado mental estabilizado.`;
        } else if (newSanity > 0) {
          const sanityMessages = {
            1: "Ansioso, você está estressado, tenso e desconfiado.",
            2: "Paranoico, você está desesperado, neurótico e pessimista.",
            3: "Violento, você inconsequente, você está hostil e insensível.",
            4: "Vilanesco, você está completamente insano, todos são inimigos e odiáveis.",
            5: "Perdido, o narrador assume seu personagem para guiá-lo à auto-destruição."
          };
          chatMessage = `${sheet.document.name}: ${sanityMessages[newSanity]}`;
        }
      } else if (modifierType === "decrease") {
        if (currentSanity === 0) {
          message = `Sanity is already at 0 and cannot be decreased further`;
          console.log("[STATUS AILMENTS] Sanity already at minimum");
          return { message, changed: false, amount: 0, modifierType };
        }

        newSanity = Math.max(currentSanity - amount, 0);
        message = `Sanity decreased by ${amount}: ${currentSanity} → ${newSanity}`;

        if (newSanity > 0) {
          const sanityMessages = {
            1: "Ansioso, você está estressado, tenso e desconfiado.",
            2: "Paranoico, você está desesperado, neurótico e pessimista.",
            3: "Violento, você inconsequente, você está hostil e insensível.",
            4: "Vilanesco, você está completamente insano, todos são inimigos e odiáveis.",
            5: "Perdido, o narrador assume seu personagem para guiá-lo à auto-destruição."
          };
          chatMessage = `${sheet.document.name}: ${sanityMessages[newSanity]}`;
        } else {
          chatMessage = `${sheet.document.name}: Estado mental estabilizado.`;
        }
      }

      console.log("[STATUS AILMENTS] Sanity change:", {
        current: currentSanity,
        new: newSanity,
        change: newSanity - currentSanity
      });

      const updateResult = await sheet.document.update({
        'system.status.sanity': newSanity
      });

      console.log("[STATUS AILMENTS] Chat message debug:", {
        chatMessage,
        newSanity,
        currentSanity,
        hasChange: newSanity !== currentSanity,
        shouldSendMessage: chatMessage && newSanity !== currentSanity
      });

      if (chatMessage && newSanity !== currentSanity) {
        console.log("[STATUS AILMENTS] Sending chat message:", chatMessage);
        await ChatMessage.create({
          content: chatMessage,
          speaker: ChatMessage.getSpeaker({ actor: sheet.document })
        });
        console.log("[STATUS AILMENTS] Chat message sent successfully");
      } else {
        console.log("[STATUS AILMENTS] Chat message not sent - conditions not met");
      }

      console.log("[STATUS AILMENTS] Update result:", updateResult);
      console.log("[STATUS AILMENTS] Status ailments processed successfully");
      return {
        message,
        changed: newSanity !== currentSanity,
        amount: Math.abs(newSanity - currentSanity),
        modifierType,
      };

    } catch (error) {
      console.error("[STATUS AILMENTS] Error processing status ailments:", error);
      return null;
    }
  }

  /**
   * Process toxicity modifications for consumable items
   * @param {Item} item
  * @param {CardiganSystemActorSheet} sheet
  * @param {number} quantity
   */
  static async processToxicity(item, sheet, quantity = 1) {
    try {
      console.log("[TOXICITY] Processing toxicity for item:", item.name);
      console.log("[TOXICITY] Item configuration:", {
        hasToxicityModifier: item.system.hasToxicityModifier,
        toxicityModifierType: item.system.toxicityModifierType,
        toxicityModifierAmount: item.system.toxicityModifierAmount
      });

      if (!item.system.hasToxicityModifier || !item.system.toxicityModifierAmount) {
        console.log("[TOXICITY] No toxicity modifier configured - missing requirements");
        return null;
      }

      const modifierType = item.system.toxicityModifierType;
      const baseAmount = Number(item.system.toxicityModifierAmount ?? 0);
      const consumedQuantity = Math.max(1, Number(quantity) || 1);
      const amount = baseAmount * consumedQuantity;
      let message = "";
      let chatMessage = "";

      const currentToxicity = sheet.document.system.status.toxicity || 0;
      let newToxicity = currentToxicity;

      if (modifierType === "increase") {
        newToxicity = Math.min(currentToxicity + amount, 5);
        message = `Toxicity increased by ${amount}: ${currentToxicity} → ${newToxicity}`;

        if (newToxicity === 0) {
          chatMessage = `${sheet.document.name}: Toxinas eliminadas do organismo.`;
        } else if (newToxicity > 0) {
          const toxicityMessages = {
            1: "Levemente intoxicado, você sente náusea e tontura.",
            2: "Intoxicação moderada, você está enjoado e com visão turva.",
            3: "Severamente intoxicado, você está vomitando e com dores intensas.",
            4: "Intoxicação crítica, você está delirando e perdendo consciência.",
            5: "Envenenamento fatal, você está à beira da morte por toxinas."
          };
          chatMessage = `${sheet.document.name}: ${toxicityMessages[newToxicity]}`;
        }
      } else if (modifierType === "decrease") {
        if (currentToxicity === 0) {
          message = `Toxicity is already at 0 and cannot be decreased further`;
          console.log("[TOXICITY] Toxicity already at minimum");
          return { message };
        }

        newToxicity = Math.max(currentToxicity - amount, 0);
        message = `Toxicity decreased by ${amount}: ${currentToxicity} → ${newToxicity}`;

        if (newToxicity > 0) {
          const toxicityMessages = {
            1: "Levemente intoxicado, você sente náusea e tontura.",
            2: "Intoxicação moderada, você está enjoado e com visão turva.",
            3: "Severamente intoxicado, você está vomitando e com dores intensas.",
            4: "Intoxicação crítica, você está delirando e perdendo consciência.",
            5: "Envenenamento fatal, você está à beira da morte por toxinas."
          };
          chatMessage = `${sheet.document.name}: ${toxicityMessages[newToxicity]}`;
        } else {
          chatMessage = `${sheet.document.name}: Toxinas eliminadas do organismo.`;
        }
      }

      console.log("[TOXICITY] Toxicity change:", {
        current: currentToxicity,
        new: newToxicity,
        change: newToxicity - currentToxicity
      });

      const updateResult = await sheet.document.update({
        'system.status.toxicity': newToxicity
      });

      console.log("[TOXICITY] Chat message debug:", {
        chatMessage,
        newToxicity,
        currentToxicity,
        hasChange: newToxicity !== currentToxicity,
        shouldSendMessage: chatMessage && newToxicity !== currentToxicity
      });

      if (chatMessage && newToxicity !== currentToxicity) {
        console.log("[TOXICITY] Sending chat message:", chatMessage);
        await ChatMessage.create({
          content: chatMessage,
          speaker: ChatMessage.getSpeaker({ actor: sheet.document })
        });
        console.log("[TOXICITY] Chat message sent successfully");
      } else {
        console.log("[TOXICITY] Chat message not sent - conditions not met");
      }

      console.log("[TOXICITY] Update result:", updateResult);
      console.log("[TOXICITY] Toxicity processed successfully");
      return { message };

    } catch (error) {
      console.error("[TOXICITY] Error processing toxicity:", error);
      return null;
    }
  }

  /**
   * Process fracture modifications for consumable items
   * @param {Item} item
  * @param {CardiganSystemActorSheet} sheet
  * @param {number} quantity
   */
  static async processFracture(item, sheet, quantity = 1) {
    try {
      console.log("[FRACTURE] Processing fracture for item:", item.name);
      console.log("[FRACTURE] Item configuration:", {
        hasFractureModifier: item.system.hasFractureModifier,
        fractureModifierType: item.system.fractureModifierType,
        fractureModifierAmount: item.system.fractureModifierAmount
      });

      const modifierType = item.system.fractureModifierType;
      const baseAmount = Number(item.system.fractureModifierAmount ?? 0);
      const consumedQuantity = Math.max(1, Number(quantity) || 1);
      const amount = baseAmount * consumedQuantity;
      const hasValidType = modifierType === "increase" || modifierType === "decrease";

      if (!item.system.hasFractureModifier || amount <= 0 || !hasValidType) {
        console.log("[FRACTURE] No fracture modifier configured - missing requirements");
        return null;
      }

      let message = "";
      let chatMessage = "";

      const currentFracture = sheet.document.system.status.fracture || 0;
      let newFracture = currentFracture;

      if (modifierType === "increase") {
        newFracture = Math.min(currentFracture + amount, 5);
        message = `Fracture increased by ${amount}: ${currentFracture} → ${newFracture}`;

        if (newFracture === 0) {
          chatMessage = `${sheet.document.name}: Fraturas curadas completamente.`;
        } else if (newFracture > 0) {
          const fractureMessages = {
            1: "Fratura leve, você sente dor e desconforto nos movimentos.",
            2: "Fratura moderada, seus movimentos estão limitados e dolorosos.",
            3: "Fratura severa, você mal consegue se mover sem dor intensa.",
            4: "Fratura crítica, seus ossos estão severamente danificados.",
            5: "Fraturas múltiplas, você está completamente incapacitado."
          };
          chatMessage = `${sheet.document.name}: ${fractureMessages[newFracture]}`;
        }
      } else if (modifierType === "decrease") {
        if (currentFracture === 0) {
          message = `Fracture is already at 0 and cannot be decreased further`;
          console.log("[FRACTURE] Fracture already at minimum");
          return { message };
        }

        newFracture = Math.max(currentFracture - amount, 0);
        message = `Fracture decreased by ${amount}: ${currentFracture} → ${newFracture}`;

        if (newFracture > 0) {
          const fractureMessages = {
            1: "Fratura leve, você sente dor e desconforto nos movimentos.",
            2: "Fratura moderada, seus movimentos estão limitados e dolorosos.",
            3: "Fratura severa, você mal consegue se mover sem dor intensa.",
            4: "Fratura crítica, seus ossos estão severamente danificados.",
            5: "Fraturas múltiplas, você está completamente incapacitado."
          };
          chatMessage = `${sheet.document.name}: ${fractureMessages[newFracture]}`;
        } else {
          chatMessage = `${sheet.document.name}: Fraturas curadas completamente.`;
        }
      }

      console.log("[FRACTURE] Fracture change:", {
        current: currentFracture,
        new: newFracture,
        change: newFracture - currentFracture
      });

      const updateResult = await sheet.document.update({
        'system.status.fracture': newFracture
      });

      console.log("[FRACTURE] Chat message debug:", {
        chatMessage,
        newFracture,
        currentFracture,
        hasChange: newFracture !== currentFracture,
        shouldSendMessage: chatMessage && newFracture !== currentFracture
      });

      if (chatMessage && newFracture !== currentFracture) {
        console.log("[FRACTURE] Sending chat message:", chatMessage);
        await ChatMessage.create({
          content: chatMessage,
          speaker: ChatMessage.getSpeaker({ actor: sheet.document })
        });
        console.log("[FRACTURE] Chat message sent successfully");
      } else {
        console.log("[FRACTURE] Chat message not sent - conditions not met");
      }

      console.log("[FRACTURE] Update result:", updateResult);
      console.log("[FRACTURE] Fracture processed successfully");
      return { message };

    } catch (error) {
      console.error("[FRACTURE] Error processing fracture:", error);
      return null;
    }
  }

  /**
   * Process food modifications for consumable items
   * @param {Item} item
  * @param {CardiganSystemActorSheet} sheet
  * @param {number} quantity
   */
  static async processFood(item, sheet, quantity = 1) {
    try {
      console.log("[FOOD] Processing food for item:", item.name);
      console.log("[FOOD] Item configuration:", {
        hasFoodModifier: item.system.hasFoodModifier,
        foodModifierType: item.system.foodModifierType,
        foodModifierAmount: item.system.foodModifierAmount
      });

      const modifierType = item.system.foodModifierType;
      const baseAmount = Number(item.system.foodModifierAmount ?? 0);
      const consumedQuantity = Math.max(1, Number(quantity) || 1);
      const amount = baseAmount * consumedQuantity;
      const hasValidType = modifierType === "increase" || modifierType === "decrease";

      if (!item.system.hasFoodAndWater || !item.system.hasFoodModifier || amount <= 0 || !hasValidType) {
        console.log("[FOOD] No food modifier configured - missing requirements");
        return null;
      }
      let message = "";
      let chatMessage = "";

      const currentHunger = sheet.document.system.status.hunger || 0;
      let newHunger = currentHunger;

      if (modifierType === "increase") {
        newHunger = Math.min(currentHunger + amount, 5);
        message = `Hunger increased by ${amount}: ${currentHunger} → ${newHunger}`;

        if (newHunger === 0) {
          chatMessage = `${sheet.document.name}: Fome saciada completamente.`;
        } else if (newHunger > 0) {
          const hungerMessages = {
            1: "Levemente faminto, você sente um leve desconforto no estômago.",
            2: "Moderadamente faminto, seu estômago está roncando e você pensa em comida.",
            3: "Muito faminto, a fome está afetando sua concentração e energia.",
            4: "Extremamente faminto, você está fraco e desesperado por comida.",
            5: "Morrendo de fome, você está à beira do colapso por desnutrição."
          };
          chatMessage = `${sheet.document.name}: ${hungerMessages[newHunger]}`;
        }
      } else if (modifierType === "decrease") {
        if (currentHunger === 0) {
          message = `Hunger is already at 0 and cannot be decreased further`;
          console.log("[FOOD] Hunger already at minimum");
          return { message };
        }

        newHunger = Math.max(currentHunger - amount, 0);
        message = `Hunger decreased by ${amount}: ${currentHunger} → ${newHunger}`;

        if (newHunger > 0) {
          const hungerMessages = {
            1: "Levemente faminto, você sente um leve desconforto no estômago.",
            2: "Moderadamente faminto, seu estômago está roncando e você pensa em comida.",
            3: "Muito faminto, a fome está afetando sua concentração e energia.",
            4: "Extremamente faminto, você está fraco e desesperado por comida.",
            5: "Morrendo de fome, você está à beira do colapso por desnutrição."
          };
          chatMessage = `${sheet.document.name}: ${hungerMessages[newHunger]}`;
        } else {
          chatMessage = `${sheet.document.name}: Fome saciada completamente.`;
        }
      }

      console.log("[FOOD] Hunger change:", {
        current: currentHunger,
        new: newHunger,
        change: newHunger - currentHunger
      });

      const updateResult = await sheet.document.update({
        'system.status.hunger': newHunger
      });

      console.log("[FOOD] Chat message debug:", {
        chatMessage,
        newHunger,
        currentHunger,
        hasChange: newHunger !== currentHunger,
        shouldSendMessage: chatMessage && newHunger !== currentHunger
      });

      if (chatMessage && newHunger !== currentHunger) {
        console.log("[FOOD] Sending chat message:", chatMessage);
        await ChatMessage.create({
          content: chatMessage,
          speaker: ChatMessage.getSpeaker({ actor: sheet.document })
        });
        console.log("[FOOD] Chat message sent successfully");
      } else {
        console.log("[FOOD] Chat message not sent - conditions not met");
      }

      console.log("[FOOD] Update result:", updateResult);
      console.log("[FOOD] Food processed successfully");
      return { message };

    } catch (error) {
      console.error("[FOOD] Error processing food:", error);
      return null;
    }
  }

  /**
   * Process water modifications for consumable items
   * @param {Item} item
  * @param {CardiganSystemActorSheet} sheet
  * @param {number} quantity
   */
  static async processWater(item, sheet, quantity = 1) {
    try {
      console.log("[WATER] Processing water for item:", item.name);
      console.log("[WATER] Item configuration:", {
        hasWaterModifier: item.system.hasWaterModifier,
        waterModifierType: item.system.waterModifierType,
        waterModifierAmount: item.system.waterModifierAmount
      });

      const modifierType = item.system.waterModifierType;
      const baseAmount = Number(item.system.waterModifierAmount ?? 0);
      const consumedQuantity = Math.max(1, Number(quantity) || 1);
      const amount = baseAmount * consumedQuantity;
      const hasValidType = modifierType === "increase" || modifierType === "decrease";

      if (!item.system.hasFoodAndWater || !item.system.hasWaterModifier || amount <= 0 || !hasValidType) {
        console.log("[WATER] No water modifier configured - missing requirements");
        return null;
      }
      let message = "";
      let chatMessage = "";

      const currentThirst = sheet.document.system.status.thirst || 0;
      let newThirst = currentThirst;

      if (modifierType === "increase") {
        newThirst = Math.min(currentThirst + amount, 5);
        message = `Thirst increased by ${amount}: ${currentThirst} → ${newThirst}`;

        if (newThirst === 0) {
          chatMessage = `${sheet.document.name}: Sede saciada completamente.`;
        } else if (newThirst > 0) {
          const thirstMessages = {
            1: "Levemente sedento, você sente a boca um pouco seca.",
            2: "Moderadamente sedento, você precisa de água e pensa em beber algo.",
            3: "Muito sedento, a sede está afetando sua capacidade de concentração.",
            4: "Extremamente sedento, você está desesperado por água e se sente fraco.",
            5: "Morrendo de sede, você está à beira do colapso por desidratação."
          };
          chatMessage = `${sheet.document.name}: ${thirstMessages[newThirst]}`;
        }
      } else if (modifierType === "decrease") {
        if (currentThirst === 0) {
          message = `Thirst is already at 0 and cannot be decreased further`;
          console.log("[WATER] Thirst already at minimum");
          return { message };
        }

        newThirst = Math.max(currentThirst - amount, 0);
        message = `Thirst decreased by ${amount}: ${currentThirst} → ${newThirst}`;

        if (newThirst > 0) {
          const thirstMessages = {
            1: "Levemente sedento, você sente a boca um pouco seca.",
            2: "Moderadamente sedento, você precisa de água e pensa em beber algo.",
            3: "Muito sedento, a sede está afetando sua capacidade de concentração.",
            4: "Extremamente sedento, você está desesperado por água e se sente fraco.",
            5: "Morrendo de sede, você está à beira do colapso por desidratação."
          };
          chatMessage = `${sheet.document.name}: ${thirstMessages[newThirst]}`;
        } else {
          chatMessage = `${sheet.document.name}: Sede saciada completamente.`;
        }
      }

      console.log("[WATER] Thirst change:", {
        current: currentThirst,
        new: newThirst,
        change: newThirst - currentThirst
      });

      const updateResult = await sheet.document.update({
        'system.status.thirst': newThirst
      });

      console.log("[WATER] Chat message debug:", {
        chatMessage,
        newThirst,
        currentThirst,
        hasChange: newThirst !== currentThirst,
        shouldSendMessage: chatMessage && newThirst !== currentThirst
      });

      if (chatMessage && newThirst !== currentThirst) {
        console.log("[WATER] Sending chat message:", chatMessage);
        await ChatMessage.create({
          content: chatMessage,
          speaker: ChatMessage.getSpeaker({ actor: sheet.document })
        });
        console.log("[WATER] Chat message sent successfully");
      } else {
        console.log("[WATER] Chat message not sent - conditions not met");
      }

      console.log("[WATER] Update result:", updateResult);
      console.log("[WATER] Water processed successfully");
      return { message };

    } catch (error) {
      console.error("[WATER] Error processing water:", error);
      return null;
    }
  }

  /**
   * Process movement boost for consumable items
   * @param {Item} item
  * @param {CardiganSystemActorSheet} sheet
  * @param {number} quantity
   */
  static async processMovementBoost(item, sheet, quantity = 1) {
    try {
      console.log("[MOVEMENT] Processing movement boost for item:", item.name);
      console.log("[MOVEMENT] Actor system structure:", sheet.document.system);
      console.log("[MOVEMENT] Actor details:", sheet.document.system.details);

      const movementEnabled =
        item.system?.bonusDeslocamento?.enabled ?? item.system?.hasMovementBoost ?? false;
      const baseAmount = Number(
        item.system?.bonusDeslocamento?.bonus ?? item.system?.movementBoostAmount ?? 0
      );
      const consumedQuantity = Math.max(1, Number(quantity) || 1);
      const amount = baseAmount * consumedQuantity;

      if (!movementEnabled || !amount) {
        console.log("[MOVEMENT] No movement boost configured");
        return null;
      }

      const currentMovementManual = sheet.document.system.details.movementManual || 0;
      const newMovementManual = currentMovementManual + amount;

      console.log("[MOVEMENT] Current movementManual value:", currentMovementManual);
      console.log("[MOVEMENT] Amount to add:", amount);
      console.log("[MOVEMENT] New movementManual value:", newMovementManual);

      console.log("[MOVEMENT] About to update actor with:", {
        'system.details.movementManual': newMovementManual
      });

      const updateResult = await sheet.document.update({
        'system.details.movementManual': newMovementManual
      });

      console.log("[MOVEMENT] Update result:", updateResult);
      console.log("[MOVEMENT] Actor movementManual after update:", sheet.document.system.details.movementManual);

      console.log("[MOVEMENT] Movement boost applied:", {
        currentManual: currentMovementManual,
        amount: amount,
        newManual: newMovementManual
      });

      return {
        message: `Movement increased by ${amount} (${baseAmount} x ${consumedQuantity})`,
        type: 'movement',
        amount: amount
      };

    } catch (error) {
      console.error("[MOVEMENT] Error processing movement boost:", error);
      return null;
    }
  }

  /**
   * Process critical hit boost for consumable items
   * @param {Item} item
  * @param {CardiganSystemActorSheet} sheet
  * @param {number} quantity
   */
  static async processCriticalHitBoost(item, sheet, quantity = 1) {
    try {
      console.log("[CRITICAL HIT] Processing critical hit boost for item:", item.name);
      console.log("[CRITICAL HIT] Actor system structure:", sheet.document.system);
      console.log("[CRITICAL HIT] Actor details:", sheet.document.system.details);

      const criticalHitEnabled =
        item.system?.hasCriticalHitBoost ?? Number(item.system?.criticalHitBoostAmount ?? 0) > 0;
      const baseAmount = Number(item.system?.criticalHitBoostAmount ?? 0);
      const consumedQuantity = Math.max(1, Number(quantity) || 1);
      const amount = baseAmount * consumedQuantity;

      if (!criticalHitEnabled || !amount) {
        console.log("[CRITICAL HIT] No critical hit boost configured");
        return null;
      }

      const currentCriticalHitManual = sheet.document.system.details.criticalHitManual || 0;
      const newCriticalHitManual = currentCriticalHitManual - amount;

      console.log("[CRITICAL HIT] Current criticalHitManual value:", currentCriticalHitManual);
      console.log("[CRITICAL HIT] Amount to subtract:", amount);
      console.log("[CRITICAL HIT] New criticalHitManual value:", newCriticalHitManual);

      console.log("[CRITICAL HIT] About to update actor with:", {
        'system.details.criticalHitManual': newCriticalHitManual
      });

      const updateResult = await sheet.document.update({
        'system.details.criticalHitManual': newCriticalHitManual
      });

      console.log("[CRITICAL HIT] Update result:", updateResult);
      console.log("[CRITICAL HIT] Actor criticalHitManual after update:", sheet.document.system.details.criticalHitManual);

      console.log("[CRITICAL HIT] Critical hit boost applied:", {
        currentManual: currentCriticalHitManual,
        amount: amount,
        newManual: newCriticalHitManual
      });

      return {
        message: `Critical Hit improved by ${amount} (${baseAmount} x ${consumedQuantity})`,
        type: 'criticalHit',
        amount: amount
      };

    } catch (error) {
      console.error("[CRITICAL HIT] Error processing critical hit boost:", error);
      return null;
    }
  }
}
