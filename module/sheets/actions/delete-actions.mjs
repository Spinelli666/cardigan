export class DeleteActions {

  /**
   * Handle deleting an embedded document (item or effect) from the actor.
   * Includes guards for auto-managed effects and cleanup logic for consumable
   * tracking effects, race deletion, and temporary health/energy/armor effects.
   * @param {CardiganSystemActorSheet} sheet
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async deleteDoc(sheet, event, target) {
    const doc = sheet._getEmbeddedDocument(target);

    // Check if this is an auto-managed effect (Fratura, Exaustão, Toxicidade, Intoxicado, Inconsciente・Sono)
    if (doc.type === "efeito") {
      const actor = doc.parent;
      const effectName = doc.name.trim();

      console.log("[DELETE DOC CHECK] Effect details:", {
        name: effectName,
        nameLength: effectName.length,
        nameBytes: Array.from(effectName).map(c => c.charCodeAt(0)),
        type: doc.type,
        toxicity: actor?.system?.status?.toxicity,
        hunger: actor?.system?.status?.hunger,
        thirst: actor?.system?.status?.thirst,
        fracture: actor?.system?.status?.fracture
      });

      // Map of effect names to their status conditions
      const autoManagedEffects = {
        'Fratura': ['fracture'],
        'Exaustão': ['hunger', 'thirst'],
        'Intoxicado': ['toxicity'],
        'Inconsciente・Sono': ['toxicity']
      };

      let statusKeys = null;
      for (const [effectKey, keys] of Object.entries(autoManagedEffects)) {
        if (effectKey.trim().toLowerCase() === effectName.toLowerCase()) {
          statusKeys = keys;
          console.log("[DELETE DOC CHECK] Matched effect:", effectKey);
          break;
        }
      }

      console.log("[DELETE DOC CHECK] Status keys for", effectName, ":", statusKeys);

      if (statusKeys) {
        const activeStatuses = [];
        for (const statusKey of statusKeys) {
          const statusValue = actor?.system?.status?.[statusKey] || 0;
          if (statusValue > 0) {
            activeStatuses.push({ key: statusKey, value: statusValue });
          }
        }

        console.log("[DELETE DOC CHECK] Active statuses:", activeStatuses);

        if (activeStatuses.length > 0) {
          const statusInfo = activeStatuses.map(s => `${s.key}: ${s.value}`).join(', ');
          ui.notifications.warn(`Não é possível excluir o efeito "${effectName}" enquanto houver checkboxes marcadas (${statusInfo}). Desmarque as checkboxes primeiro.`);
          return;
        }
      }
    }

    const performDeletion = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.format('DOCUMENT.Delete', { type: doc.documentName }) },
      content: game.i18n.format('DOCUMENT.DeleteWarning', { name: doc.name }),
    });
    if (!performDeletion) return;

    // Check if it's a Race item and delete associated racial skills
    if (doc.type === "race" && doc.system.racialSkills?.length > 0) {
      console.log("[RACIAL SKILLS] Removing racial skills on race deletion:", {
        raceName: doc.name,
        skillsCount: doc.system.racialSkills.length
      });

      const actor = doc.parent;
      const skillsToDelete = [];

      // Match by name and skillClass instead of UUID (UUIDs change when skills become owned items)
      for (const racialSkill of doc.system.racialSkills) {
        const skillItem = actor.items.find(item =>
          item.type === 'skill' &&
          item.name === racialSkill.name &&
          item.system.skillClass === 'racial'
        );
        if (skillItem) skillsToDelete.push(skillItem);
      }

      if (skillsToDelete.length > 0) {
        console.log("[RACIAL SKILLS] Deleting racial skills:", {
          count: skillsToDelete.length,
          skills: skillsToDelete.map(s => s.name)
        });

        for (const skill of skillsToDelete) {
          await skill.delete();
        }

        ui.notifications.info(`Raça removida junto com ${skillsToDelete.length} skill(s) racial(is)`);
      }

      // Reset all ability baseValues to 0 (remove wizard points)
      console.log("[RACIAL DELETION] Resetting ability baseValues to 0");
      const abilityKeys = ['accuracy', 'evasion', 'strength', 'dexterity', 'stamina', 'stealth', 'persuasion', 'intelligence', 'psionics'];
      const abilityUpdates = {};
      for (const abilityKey of abilityKeys) {
        abilityUpdates[`system.abilities.${abilityKey}.baseValue`] = 0;
      }
      await actor.update(abilityUpdates);
      console.log("[RACIAL DELETION] Ability points reset to 0");
    }

    // If deleting a consumable tracking effect, also remove sibling temporary effects
    // created from the same consumable source to avoid double deletion in the effects table.
    if (doc.type === "efeito" && doc.system.consumableTracking?.isTrackingEffect) {
      const actor = doc.parent;
      const sourceItemId = doc.system.consumableTracking?.originalItemId;

      if (actor && sourceItemId) {
        const siblingTemporaryEffects = actor.items.filter((item) =>
          item.type === "efeito" &&
          item.id !== doc.id &&
          item.system?.sourceItemId === sourceItemId &&
          (item.system?.isTemporaryHealth || item.system?.isTemporaryEnergy || item.system?.isTemporaryArmor)
        );

        if (siblingTemporaryEffects.length > 0) {
          console.log("[TRACKING DELETE] Removing sibling temporary effects:", {
            trackingEffect: doc.name,
            sourceItemId,
            siblings: siblingTemporaryEffects.map((item) => ({
              id: item.id,
              name: item.name,
              isTemporaryHealth: !!item.system?.isTemporaryHealth,
              isTemporaryEnergy: !!item.system?.isTemporaryEnergy,
              isTemporaryArmor: !!item.system?.isTemporaryArmor
            }))
          });

          const updateData = {};

          for (const sibling of siblingTemporaryEffects) {
            if (sibling.system?.isTemporaryHealth && sibling.system?.healthBonusValue) {
              const currentHealthBonus = updateData['system.status.healthBonus'] ?? actor.system.status.healthBonus ?? 0;
              const calculatedHealthBonus = currentHealthBonus - sibling.system.healthBonusValue;
              updateData['system.status.healthBonus'] = Math.max(0, calculatedHealthBonus);
            }

            if (sibling.system?.isTemporaryEnergy && sibling.system?.energyBonusValue) {
              const currentEnergyBonus = updateData['system.status.energyBonus'] ?? actor.system.status.energyBonus ?? 0;
              const calculatedEnergyBonus = currentEnergyBonus - sibling.system.energyBonusValue;
              updateData['system.status.energyBonus'] = Math.max(0, calculatedEnergyBonus);
            }

            if (sibling.system?.isTemporaryArmor && sibling.system?.armorBonusValue) {
              const currentArmorBonus = updateData['system.status.armorBonus'] ?? actor.system.status.armorBonus ?? 0;
              const calculatedArmorBonus = currentArmorBonus - sibling.system.armorBonusValue;
              updateData['system.status.armorBonus'] = Math.max(0, calculatedArmorBonus);
            }
          }

          if (Object.keys(updateData).length > 0) {
            await actor.update(updateData);
          }

          await actor.deleteEmbeddedDocuments('Item', siblingTemporaryEffects.map((item) => item.id));
        }
      }
    }

    // Revert temporary health/energy/armor bonus before deletion
    if (doc.type === "efeito" && doc.system.isTemporaryHealth && doc.system.healthBonusValue) {
      console.log("[TEMPORARY HEALTH] Removing health bonus on effect deletion via _deleteDoc:", {
        effectName: doc.name,
        bonusToRemove: doc.system.healthBonusValue
      });

      const actor = doc.parent;
      const currentHealthBonus = actor.system.status.healthBonus || 0;
      const calculatedHealthBonus = currentHealthBonus - doc.system.healthBonusValue;
      const newHealthBonus = Math.max(0, calculatedHealthBonus);

      console.log("[TEMPORARY HEALTH] Health bonus calculation details:", {
        currentBonus: currentHealthBonus,
        bonusToRemove: doc.system.healthBonusValue,
        calculated: calculatedHealthBonus,
        final: newHealthBonus
      });

      await actor.update({ 'system.status.healthBonus': newHealthBonus });

      console.log("[TEMPORARY HEALTH] Health bonus adjusted via _deleteDoc:", {
        previousBonus: currentHealthBonus,
        newBonus: newHealthBonus
      });
    } else if (doc.type === "efeito" && doc.system.isTemporaryEnergy && doc.system.energyBonusValue) {
      console.log("[TEMPORARY ENERGY] Removing energy bonus on effect deletion via _deleteDoc:", {
        effectName: doc.name,
        bonusToRemove: doc.system.energyBonusValue
      });

      const actor = doc.parent;
      const currentEnergyBonus = actor.system.status.energyBonus || 0;
      const calculatedEnergyBonus = currentEnergyBonus - doc.system.energyBonusValue;
      const newEnergyBonus = Math.max(0, calculatedEnergyBonus);

      console.log("[TEMPORARY ENERGY] Energy bonus calculation details:", {
        currentBonus: currentEnergyBonus,
        bonusToRemove: doc.system.energyBonusValue,
        calculated: calculatedEnergyBonus,
        final: newEnergyBonus
      });

      await actor.update({ 'system.status.energyBonus': newEnergyBonus });

      console.log("[TEMPORARY ENERGY] Energy bonus adjusted via _deleteDoc:", {
        previousBonus: currentEnergyBonus,
        newBonus: newEnergyBonus
      });
    } else if (doc.type === "efeito" && doc.system.isTemporaryArmor && doc.system.armorBonusValue) {
      console.log("[TEMPORARY ARMOR] Removing armor bonus on effect deletion via _deleteDoc:", {
        effectName: doc.name,
        bonusToRemove: doc.system.armorBonusValue
      });

      const actor = doc.parent;
      const currentArmorBonus = actor.system.status.armorBonus || 0;
      const calculatedArmorBonus = currentArmorBonus - doc.system.armorBonusValue;
      const newArmorBonus = Math.max(0, calculatedArmorBonus);

      console.log("[TEMPORARY ARMOR] Armor bonus calculation details:", {
        currentBonus: currentArmorBonus,
        bonusToRemove: doc.system.armorBonusValue,
        calculated: calculatedArmorBonus,
        final: newArmorBonus
      });

      await actor.update({ 'system.status.armorBonus': newArmorBonus });

      console.log("[TEMPORARY ARMOR] Armor bonus adjusted via _deleteDoc:", {
        previousBonus: currentArmorBonus,
        newBonus: newArmorBonus
      });
    } else if (doc.type === "efeito" && doc.system.consumableTracking?.isTrackingEffect && doc.system.consumableTracking?.appliedAttributeModifiers?.length > 0) {
      console.log("[ATTRIBUTE MODIFIERS] Reverting attribute modifiers on tracking effect deletion:", {
        effectName: doc.name,
        modifiers: doc.system.consumableTracking.appliedAttributeModifiers
      });

      const actor = doc.parent;
      const updateData = {};

      for (const modifier of doc.system.consumableTracking.appliedAttributeModifiers) {
        if (modifier.type === 'movement') {
          const currentMovementManual = actor.system.details.movementManual || 0;
          const newMovementManual = currentMovementManual - modifier.amount;
          updateData['system.details.movementManual'] = newMovementManual;

          console.log("[MOVEMENT] Reverting movement boost:", {
            currentManual: currentMovementManual,
            amountToRevert: modifier.amount,
            newManual: newMovementManual
          });
        } else if (modifier.type === 'criticalHit') {
          const currentCriticalHitManual = actor.system.details.criticalHitManual || 0;
          const newCriticalHitManual = currentCriticalHitManual + modifier.amount;
          updateData['system.details.criticalHitManual'] = newCriticalHitManual;

          console.log("[CRITICAL HIT] Reverting critical hit boost:", {
            currentManual: currentCriticalHitManual,
            amountToRevert: modifier.amount,
            newManual: newCriticalHitManual
          });
        } else if (modifier.type === 'armorBonus') {
          const currentArmorBonus = actor.system.status.armorBonus || 0;
          const calculatedArmorBonus = currentArmorBonus - modifier.amount;
          const newArmorBonus = Math.max(0, calculatedArmorBonus);
          updateData['system.status.armorBonus'] = newArmorBonus;

          console.log("[ARMOR BONUS] Reverting armor bonus from tracking effect:", {
            currentBonus: currentArmorBonus,
            amountToRevert: modifier.amount,
            newBonus: newArmorBonus
          });
        } else if (modifier.type === 'abilityBaseValue' && modifier.ability) {
          const currentAbilityBaseValue = actor.system.abilities?.[modifier.ability]?.baseValue || 0;
          const revertedAbilityBaseValue = currentAbilityBaseValue - Number(modifier.amount || 0);
          updateData[`system.abilities.${modifier.ability}.baseValue`] = revertedAbilityBaseValue;

          console.log("[ABILITY BASE VALUE] Reverting ability base value modifier from tracking effect:", {
            ability: modifier.ability,
            currentBaseValue: currentAbilityBaseValue,
            amountToRevert: modifier.amount,
            newBaseValue: revertedAbilityBaseValue
          });
        } else if (modifier.type === 'abilityManualBonus' && modifier.ability) {
          const currentAbilityManualBonus = actor.system.abilities?.[modifier.ability]?.manualBonus || 0;
          const revertedAbilityManualBonus = currentAbilityManualBonus - Number(modifier.amount || 0);
          updateData[`system.abilities.${modifier.ability}.manualBonus`] = revertedAbilityManualBonus;

          console.log("[ABILITY MANUAL BONUS] Reverting ability manual bonus modifier from tracking effect:", {
            ability: modifier.ability,
            currentManualBonus: currentAbilityManualBonus,
            amountToRevert: modifier.amount,
            newManualBonus: revertedAbilityManualBonus
          });
        } else if (modifier.type === 'abilityBaseBonus' && modifier.ability) {
          const currentAbilityBaseBonus = actor.system.abilities?.[modifier.ability]?.baseBonus || 0;
          const revertedAbilityBaseBonus = currentAbilityBaseBonus - Number(modifier.amount || 0);
          updateData[`system.abilities.${modifier.ability}.baseBonus`] = revertedAbilityBaseBonus;

          console.log("[ABILITY BASE BONUS] Reverting ability base bonus modifier from tracking effect:", {
            ability: modifier.ability,
            currentBaseBonus: currentAbilityBaseBonus,
            amountToRevert: modifier.amount,
            newBaseBonus: revertedAbilityBaseBonus
          });
        } else if (modifier.type === 'abilityValue' && modifier.ability) {
          const currentAbilityValue = actor.system.abilities?.[modifier.ability]?.value || 0;
          const revertedAbilityValue = currentAbilityValue - Number(modifier.amount || 0);
          updateData[`system.abilities.${modifier.ability}.value`] = revertedAbilityValue;

          console.log("[ABILITY VALUE] Reverting ability value modifier from tracking effect:", {
            ability: modifier.ability,
            currentValue: currentAbilityValue,
            amountToRevert: modifier.amount,
            newValue: revertedAbilityValue
          });
        }
      }

      if (Object.keys(updateData).length > 0) {
        await actor.update(updateData);
        console.log("[ATTRIBUTE MODIFIERS] Attribute modifiers reverted:", updateData);
      }
    } else if (doc.type === "efeito") {
      console.log("[DEBUG DELETE] Effect item does not match temporary health criteria in _deleteDoc:", {
        isEfeito: doc.type === "efeito",
        hasIsTemporaryHealth: !!doc.system.isTemporaryHealth,
        hasHealthBonusValue: !!doc.system.healthBonusValue,
        systemData: doc.system
      });
    }

    const deleted = await doc.delete();
    deleted.sheet.render(false);
  }

}
