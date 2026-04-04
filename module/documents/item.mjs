/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class CardiganSystemItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  /**
   * Perform preliminary operations after an Item document is created.
   * @param {object} data     - The initial data object provided to the document creation request
   * @param {object} options  - Additional options which modify the creation request
   * @param {string} userId   - The id of the User requesting the document creation
   * @override
   */
  async _onCreate(data, options, userId) {
    await super._onCreate(data, options, userId);
    
    console.log(`[Item._onCreate] Item created: ${this.name}, type: ${this.type}, hasActor: ${!!this.actor}, userId: ${userId}, game.user.id: ${game.user.id}`);
    
    // Only run on the client that initiated the action (avoid duplicate application)
    if (userId !== game.user.id) return;
    
    // Check if this effect should be blocked (e.g., by Imparável)
    if (this.type === 'efeito' && this.actor) {
      const shouldBlock = await this._checkIfEffectBlocked();
      if (shouldBlock) {
        console.log(`[Item._onCreate] Effect ${this.name} was blocked, deleting...`);
        // Delete this item immediately as it was blocked
        await this.delete();
        return;
      }
    }
    
    // Apply custom effect logic when an effect item is added to an actor
    if (this.type === 'efeito' && this.actor) {
      console.log(`[Item._onCreate] Applying custom effect for: ${this.name}`);
      await this._applyCustomEffect();
    }

    // Add linked skills when a skill is added to an actor
    if (this.type === 'skill' && this.actor) {
      await this._addLinkedSkills();
      // Increment class counter for this skill
      await this._incrementClassCounter();
    }

    // Add racial skills when a race is added to an actor
    if (this.type === 'race' && this.actor) {
      await this._addRacialSkills();
      // Apply custom race bonuses (e.g., Norsca natural armor)
      await this._applyCustomRaceBonuses();
    }
  }

  /**
   * Perform preliminary operations after an Item document is deleted.
   * @param {object} options  - Additional options which modify the deletion request
   * @param {string} userId   - The id of the User requesting the document deletion
   * @override
   */
  async _onDelete(options, userId) {
    await super._onDelete(options, userId);
    
    console.log(`[Item._onDelete] Item deleted: ${this.name}, type: ${this.type}, hasActor: ${!!this.actor}, userId: ${userId}, game.user.id: ${game.user.id}`);
    
    // Only run on the client that initiated the action (avoid duplicate application)
    if (userId !== game.user.id) return;
    
    // Decrement class counter when a skill is deleted
    if (this.type === 'skill' && this.actor) {
      await this._decrementClassCounter();
    }
  }

  /**
   * Add racial skills to the actor when this race is created
   * @private
   */
  async _addRacialSkills() {
    // Check if this race has racial skills
    if (!this.system.racialSkills || this.system.racialSkills.length === 0) {
      console.log(`[Item._addRacialSkills] Race ${this.name} has no racial skills`);
      return;
    }

    console.log(`[Item._addRacialSkills] Adding ${this.system.racialSkills.length} racial skill(s) for: ${this.name}`);

    try {
      const skillsToAdd = [];

      // Fetch each racial skill from the compendium
      for (const racialSkill of this.system.racialSkills) {
        try {
          console.log(`[Item._addRacialSkills] Fetching skill: ${racialSkill.name} (ID: ${racialSkill.id})`);
          
          // Get the skill document from the compendium using UUID or ID
          let skillDoc = null;
          
          // Try UUID first if it exists
          if (racialSkill.uuid) {
            console.log(`[Item._addRacialSkills] Trying UUID: ${racialSkill.uuid}`);
            skillDoc = await fromUuid(racialSkill.uuid);
          }
          
          // If UUID didn't work, try to find by ID in the compendium
          if (!skillDoc && racialSkill.id) {
            console.log(`[Item._addRacialSkills] UUID not found, trying ID in compendium: ${racialSkill.id}`);
            const pack = game.packs.get("cardigan.skills-cardigan");
            if (pack) {
              skillDoc = await pack.getDocument(racialSkill.id);
            }
          }
          
          if (!skillDoc) {
            console.warn(`[Item._addRacialSkills] Could not find skill: ${racialSkill.name} (ID: ${racialSkill.id})`);
            ui.notifications.warn(`Skill racial "${racialSkill.name}" não encontrada no compêndio`);
            continue;
          }

          // Check if the actor already has this skill
          const existingSkill = this.actor.items.find(i => 
            i.type === 'skill' && i.name === skillDoc.name
          );

          if (existingSkill) {
            console.log(`[Item._addRacialSkills] Actor already has skill: ${skillDoc.name}, skipping`);
            continue;
          }

          // Prepare the skill data for creation
          const skillData = skillDoc.toObject();
          
          // Mark this skill as a racial skill
          skillData.system.isRacialSkill = true;
          
          skillsToAdd.push(skillData);
          
          console.log(`[Item._addRacialSkills] Prepared skill for adding: ${skillDoc.name}`);
        } catch (error) {
          console.error(`[Item._addRacialSkills] Error processing racial skill ${racialSkill.name}:`, error);
        }
      }

      // Create all racial skills at once
      if (skillsToAdd.length > 0) {
        await this.actor.createEmbeddedDocuments('Item', skillsToAdd);
        console.log(`[Item._addRacialSkills] Successfully added ${skillsToAdd.length} racial skill(s)`);
        
        ui.notifications.info(
          `Raça "${this.name}" adicionada com ${skillsToAdd.length} skill(s) racial(is): ${skillsToAdd.map(s => s.name).join(', ')}`
        );
      } else {
        console.log(`[Item._addRacialSkills] No new skills to add`);
      }
    } catch (error) {
      console.error('[Item._addRacialSkills] Error adding racial skills:', error);
      ui.notifications.warn('Erro ao adicionar skills raciais');
    }
  }

  /**
   * Add linked skills to the actor when this skill is created
   * @private
   */
  async _addLinkedSkills() {
    // Check if this skill has linked skills enabled
    if (!this.system.hasLinkedSkills || !this.system.linkedSkills || this.system.linkedSkills.length === 0) {
      console.log(`[Item._addLinkedSkills] Skill ${this.name} has no linked skills`);
      return;
    }

    console.log(`[Item._addLinkedSkills] Adding ${this.system.linkedSkills.length} linked skill(s) for: ${this.name}`);

    try {
      const skillsToAdd = [];

      // Fetch each linked skill from the compendium
      for (const linkedSkill of this.system.linkedSkills) {
        try {
          console.log(`[Item._addLinkedSkills] Fetching skill from UUID: ${linkedSkill.uuid}`);
          
          // Get the skill document from UUID
          const skillDoc = await fromUuid(linkedSkill.uuid);
          
          if (!skillDoc) {
            console.warn(`[Item._addLinkedSkills] Could not find skill with UUID: ${linkedSkill.uuid}`);
            continue;
          }

          // Check if the actor already has this skill
          const existingSkill = this.actor.items.find(i => 
            i.type === 'skill' && i.name === skillDoc.name
          );

          if (existingSkill) {
            console.log(`[Item._addLinkedSkills] Actor already has skill: ${skillDoc.name}, skipping`);
            continue;
          }

          // Prepare the skill data for creation
          const skillData = skillDoc.toObject();
          
          // Mark this skill as a linked skill
          skillData.system.isLinkedSkill = true;
          
          skillsToAdd.push(skillData);
          
          console.log(`[Item._addLinkedSkills] Prepared skill for adding: ${skillDoc.name}`);
        } catch (error) {
          console.error(`[Item._addLinkedSkills] Error processing linked skill ${linkedSkill.name}:`, error);
        }
      }

      // Create all linked skills at once
      if (skillsToAdd.length > 0) {
        await this.actor.createEmbeddedDocuments('Item', skillsToAdd);
        console.log(`[Item._addLinkedSkills] Successfully added ${skillsToAdd.length} linked skill(s)`);
        
        ui.notifications.info(
          `Skill "${this.name}" adicionada com ${skillsToAdd.length} skill(s) vinculada(s): ${skillsToAdd.map(s => s.name).join(', ')}`
        );
      } else {
        console.log(`[Item._addLinkedSkills] No new skills to add`);
      }
    } catch (error) {
      console.log('[Item._addLinkedSkills] Error adding linked skills:', error);
      ui.notifications.warn('Erro ao adicionar skills vinculadas');
    }
  }

  /**
   * Remove linked skills from the actor when this skill is deleted
   * @private
   */
  async _removeLinkedSkills() {
    // Check if this skill has linked skills enabled
    if (!this.system.hasLinkedSkills || !this.system.linkedSkills || this.system.linkedSkills.length === 0) {
      console.log(`[Item._removeLinkedSkills] Skill ${this.name} has no linked skills to remove`);
      return;
    }

    console.log(`[Item._removeLinkedSkills] Removing ${this.system.linkedSkills.length} linked skill(s) for: ${this.name}`);

    try {
      const skillIdsToRemove = [];
      const skillNamesToRemove = [];

      // Find linked skills in the actor's items
      for (const linkedSkill of this.system.linkedSkills) {
        // Find the skill in the actor by name (more reliable than ID since it came from compendium)
        const skillInActor = this.actor.items.find(i => 
          i.type === 'skill' && i.name === linkedSkill.name
        );

        if (skillInActor) {
          skillIdsToRemove.push(skillInActor.id);
          skillNamesToRemove.push(skillInActor.name);
          console.log(`[Item._removeLinkedSkills] Found linked skill to remove: ${skillInActor.name}`);
        } else {
          console.log(`[Item._removeLinkedSkills] Linked skill not found in actor: ${linkedSkill.name}`);
        }
      }

      // Delete all linked skills at once
      if (skillIdsToRemove.length > 0) {
        await this.actor.deleteEmbeddedDocuments('Item', skillIdsToRemove);
        console.log(`[Item._removeLinkedSkills] Successfully removed ${skillIdsToRemove.length} linked skill(s)`);
        
        ui.notifications.info(
          `Skill "${this.name}" removida junto com ${skillIdsToRemove.length} skill(s) vinculada(s): ${skillNamesToRemove.join(', ')}`
        );
      } else {
        console.log(`[Item._removeLinkedSkills] No linked skills found to remove`);
      }
    } catch (error) {
      console.error('[Item._removeLinkedSkills] Error removing linked skills:', error);
      ui.notifications.warn('Erro ao remover skills vinculadas');
    }
  }

  /**
   * Apply custom race bonuses when race is added to actor
   * Uses RaceManager to apply race-specific logic (e.g., Norsca natural armor)
   * @private
   */
  async _applyCustomRaceBonuses() {
    try {
      console.log(`[Item._applyCustomRaceBonuses] Applying race bonuses for: ${this.name}`);
      const { RaceManager } = await import('../races/index.mjs');
      await RaceManager.applyRace(this, this.actor);
    } catch (error) {
      console.error('[Item._applyCustomRaceBonuses] Error applying race bonuses:', error);
    }
  }

  /**
   * Remove custom race bonuses when race is removed from actor
   * Uses RaceManager to remove race-specific logic
   * @private
   */
  async _removeCustomRaceBonuses() {
    try {
      console.log(`[Item._removeCustomRaceBonuses] Removing race bonuses for: ${this.name}`);
      const { RaceManager } = await import('../races/index.mjs');
      await RaceManager.removeRace(this, this.actor);
    } catch (error) {
      console.error('[Item._removeCustomRaceBonuses] Error removing race bonuses:', error);
    }
  }

  /**
   * Check if this effect should be blocked by another effect (like Imparável)
   * @private
   * @returns {Promise<boolean>}
   */
  async _checkIfEffectBlocked() {
    try {
      const { ImparavelEffect } = await import('../effects/index.mjs');
      return ImparavelEffect.shouldBlockEffect(this.actor, this.name);
    } catch (error) {
      console.error('[Item._checkIfEffectBlocked] Error checking if effect blocked:', error);
      return false;
    }
  }

  /**
   * Apply custom effect logic using the EffectManager
   * @private
   */
  async _applyCustomEffect() {
    console.log(`[Item._applyCustomEffect] Trying to apply effect: ${this.name}`);
    try {
      const { EffectManager } = await import('../effects/index.mjs');
      console.log(`[Item._applyCustomEffect] EffectManager imported successfully`);
      await EffectManager.applyEffect(this, this.actor);
      console.log(`[Item._applyCustomEffect] Effect applied successfully`);
    } catch (error) {
      // If there's no custom effect registered for this item, that's okay
      // It just means this effect doesn't have custom logic
      if (error.message && error.message.includes('No custom effect registered')) {
        console.log(`[Item._applyCustomEffect] No custom effect logic for: ${this.name}`);
      } else {
        console.error('[Item._applyCustomEffect] Error applying custom effect:', error);
      }
    }
  }

  /**
   * Perform preliminary operations before an Item document is deleted.
   * @param {object} options - Additional options which modify the deletion request
   * @param {User} user      - The User requesting the document deletion
   * @returns {boolean|void} - Explicitly return false to prevent the deletion
   * @override
   */
  async _preDelete(options, user) {
    await super._preDelete(options, user);
    
    console.log(`[Item._preDelete] Item deleting: ${this.name}, type: ${this.type}, hasActor: ${!!this.actor}, userId: ${user.id}, game.user.id: ${game.user.id}`);
    
    // Only run on the client that initiated the action
    if (user.id !== game.user.id) return;
    
    // Remove custom effect logic when an effect item is removed from an actor
    if (this.type === 'efeito' && this.actor) {
      console.log(`[Item._preDelete] Removing custom effect for: ${this.name}`);
      await this._removeCustomEffect();
    }
    
    // If this is a tracking effect item, revert its effects
    if (this.type === 'efeito' && this.system.consumableTracking?.isTrackingEffect) {
      await this._revertTrackingEffects();
    }

    // Remove linked skills when a skill with linked skills is deleted
    if (this.type === 'skill' && this.actor) {
      await this._removeLinkedSkills();
    }

    // Remove custom race bonuses when race is removed from actor
    if (this.type === 'race' && this.actor) {
      await this._removeCustomRaceBonuses();
    }
  }

  /**
   * Remove custom effect logic using the EffectManager
   * @private
   */
  async _removeCustomEffect() {
    try {
      const { EffectManager } = await import('../effects/index.mjs');
      await EffectManager.removeEffect(this, this.actor);
    } catch (error) {
      // If there's no custom effect registered for this item, that's okay
      if (error.message && error.message.includes('No custom effect registered')) {
        console.log(`No custom effect logic for: ${this.name}`);
      } else {
        console.error('Error removing custom effect:', error);
      }
    }
  }

  /**
   * Revert all effects applied by a tracking effect item
   * @private
   */
  async _revertTrackingEffects() {
    try {
      if (!this.actor) {
        console.warn("Cannot revert tracking effects: item has no parent actor");
        return;
      }

      const tracking = this.system.consumableTracking;
      const revertMessages = [];

      // Revert applied effects (remove them from actor)
      if (tracking.appliedEffects && tracking.appliedEffects.length > 0) {
        for (const effectId of tracking.appliedEffects) {
          // Find and remove effect from actor
          const pack = game.packs.get("cardigan.efeitos-cardigan");
          if (pack) {
            const effectDoc = await pack.getDocument(effectId);
            if (effectDoc) {
              const existingEffect = this.actor.items.find(i => 
                i.type === 'efeito' && 
                i.name === effectDoc.name && 
                i.id !== this.id // Don't remove the tracking item itself
              );
              
              if (existingEffect) {
                await existingEffect.delete();
                revertMessages.push(`Removed effect: <strong>${effectDoc.name}</strong>`);
              }
            }
          }
        }
      }

      // Revert applied skill bonuses/penalties
      if (tracking.appliedSkillBonuses && tracking.appliedSkillBonuses.length > 0) {
        const updateData = {};
        
        for (const bonus of tracking.appliedSkillBonuses) {
          const abilityData = this.actor.system.abilities[bonus.ability];
          if (abilityData) {
            const bonusValue = bonus.bonus || bonus.value || 0; // Support both fields
            
            // Determine if this is a penalty (negative) or bonus (positive)
            if (bonusValue < 0) {
              // This is a penalty (Critical Failure Skill Loss)
              // Revert by subtracting from manualValue (double negative = positive)
              const currentManualValue = abilityData.manualValue || 0;
              const newManualValue = currentManualValue - bonusValue; // Double negative = positive
              updateData[`system.abilities.${bonus.ability}.manualValue`] = newManualValue;
            } else {
              // This is a bonus (Critical Hit Skill Bonus or Temporary Skill Bonus)
              // Revert by subtracting from manualBonus
              const currentManualBonus = abilityData.manualBonus || 0;
              const newManualBonus = currentManualBonus - bonusValue;
              updateData[`system.abilities.${bonus.ability}.manualBonus`] = newManualBonus;
            }
            
            const abilityName = game.i18n.localize(`CARDIGAN.Ability.${bonus.ability.charAt(0).toUpperCase() + bonus.ability.slice(1)}.long`);
            const sign = bonusValue >= 0 ? '' : '+';
            const revertValue = -bonusValue;
            revertMessages.push(`${abilityName}: ${sign}${revertValue}`);
          }
        }
        
        if (Object.keys(updateData).length > 0) {
          await this.actor.update(updateData);
        }
      }

      // Send revert message to chat
      if (revertMessages.length > 0) {
        const messageContent = `
          <div style="background: rgba(156, 39, 176, 0.1); border: 1px solid #9C27B0; border-radius: 4px; padding: 8px; margin-top: 8px;">
            <div style="color: #9C27B0; font-weight: bold; margin-bottom: 4px;">
              <i class="fas fa-undo"></i> Effects Reverted from ${tracking.originalItemName}:
            </div>
            <ul style="margin: 0; padding-left: 16px;">
              ${revertMessages.map(msg => `<li>${msg}</li>`).join('')}
            </ul>
          </div>
        `;
        
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: messageContent,
          rollMode: game.settings.get("core", "rollMode")
        });
      }

    } catch (error) {
      console.error("Error reverting tracking effects:", error);
      ui.notifications.warn(`Erro ao reverter efeitos: ${error.message}`);
    }
  }

  /**
   * Perform preliminary operations before an Item document is updated.
   * @param {object} changed - The differential data that is changed relative to the documents prior values
   * @param {object} options - Additional options which modify the update request
   * @param {User} user      - The User requesting the document update
   * @returns {boolean|void} - Explicitly return false to prevent the update
   * @override
   */
  async _preUpdate(changed, options, user) {
    await super._preUpdate(changed, options, user);

    // Enforce durability consistency for equipment items
    if (this.type === 'arma' || this.type === 'armadura') {
      const incomingCurrent = foundry.utils.getProperty(changed, 'system.durability.current');
      const incomingMax = foundry.utils.getProperty(changed, 'system.durability.max');

      if (incomingCurrent !== undefined || incomingMax !== undefined) {
        const existingCurrent = this.system?.durability?.current ?? 0;
        const existingMax = this.system?.durability?.max ?? 1;

        let nextMax = incomingMax !== undefined ? Number(incomingMax) : Number(existingMax);
        if (!Number.isFinite(nextMax)) nextMax = Number(existingMax) || 1;
        nextMax = Math.max(1, Math.floor(nextMax));

        let nextCurrent = incomingCurrent !== undefined ? Number(incomingCurrent) : Number(existingCurrent);
        if (!Number.isFinite(nextCurrent)) nextCurrent = Number(existingCurrent) || 0;
        nextCurrent = Math.max(0, Math.floor(nextCurrent));

        // current can never exceed max (prevents states like 4/3)
        if (nextCurrent > nextMax) nextCurrent = nextMax;

        foundry.utils.setProperty(changed, 'system.durability.max', nextMax);
        foundry.utils.setProperty(changed, 'system.durability.current', nextCurrent);
      }
    }
    
    // If this is a weapon (arma) and skillBonuses are being changed
    if (this.type === 'arma' && changed.system?.skillBonuses !== undefined) {
      this._weaponSkillBonusesChanged = true;
    }
  }

  /**
   * Perform follow-up operations after an Item document is updated.
   * @param {object} changed - The differential data that is changed relative to the documents prior values
   * @param {object} options - Additional options which modify the update request
   * @param {string} userId  - The id of the User requesting the document update
   * @override
   */
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);
    
    // If weapon skill bonuses changed and this item has a parent actor
    if (this._weaponSkillBonusesChanged && this.actor) {
      // Trigger recalculation of weapon skill bonuses on the actor
      if (this.actor.system._calculateWeaponSkillBonuses) {
        this.actor.system._calculateWeaponSkillBonuses();
      }
      
      // If the actor sheet is open, trigger derived stats update
      const sheet = this.actor.sheet;
      if (sheet && sheet.rendered) {
        // Check which abilities were affected and update derived stats
        const weaponBonuses = {};
        const weapons = this.actor.items.filter(item => item.type === 'arma');
        
        // Calculate which abilities have weapon bonuses
        for (const weapon of weapons) {
          const skillBonuses = weapon.system.skillBonuses || [];
          for (const skillBonus of skillBonuses) {
            if (skillBonus.skill && skillBonus.bonus) {
              weaponBonuses[skillBonus.skill] = true;
            }
          }
        }
        
        // Update derived stats for affected abilities
        if (weaponBonuses.dexterity && sheet._updateDerivedStats) {
          sheet._updateDerivedStats('dexterity');
        }
        if (weaponBonuses.stamina && sheet._updateDerivedStats) {
          sheet._updateDerivedStats('stamina');
        }
        
        // Force update of ability display values
        setTimeout(() => {
          Object.keys(this.actor.system.abilities).forEach(abilityKey => {
            const totalBonusInput = sheet.element?.querySelector(`input[name="system.abilities.${abilityKey}.totalBonus"]`);
            if (totalBonusInput) {
              totalBonusInput.value = this.actor.system.abilities[abilityKey].totalBonus || 0;
            }
          });
        }, 100);
      }
      
      // Clean up the flag
      delete this._weaponSkillBonusesChanged;
    }
  }

  /**
   * Prepare a data object which defines the data schema used by dice roll commands against this Item
   * @override
   */
  getRollData() {
    // Starts off by populating the roll data with a shallow copy of `this.system`
    const rollData = { ...this.system };

    // Quit early if there's no parent actor
    if (!this.actor) return rollData;

    // If present, add the actor's roll data
    rollData.actor = this.actor.getRollData();

    return rollData;
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll(event) {
    const item = this;

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const label = `[${item.type}] ${item.name}`;

    // If there's no roll data, send a chat message.
    if (!this.system.formula) {
      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: item.system.description ?? '',
      });
    }
    // Otherwise, create a roll and send a chat message from it.
    else {
      // Retrieve roll data.
      const rollData = this.getRollData();

      // Invoke the roll and submit it to chat.
      const roll = new Roll(rollData.formula, rollData.actor);
      
      // Evaluate the roll to get the result
      await roll.evaluate();
      
      // Detect critical results manually (same logic as in actor-sheet)
      const flags = this._detectCriticalResults(roll, this.actor, null);
      
      roll.toMessage({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        flags: flags
      });
      return roll;
    }
  }

  /**
   * Detect critical results from a roll and return appropriate flags
   * @param {Roll} roll - The roll to analyze
   * @param {Object} actor - The actor who made the roll (optional, used for critical hit threshold)
   * @param {string} abilityKey - The ability key being rolled (optional, used for accuracy-specific logic)
   * @returns {Object} - Flags object for critical hit/failure, empty if no critical
   */
  _detectCriticalResults(roll, actor = null, abilityKey = null) {
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
      const d20Die = roll.dice.find(die => die.faces === 20);
      if (d20Die && d20Die.results && d20Die.results.length > 0) {
        const hasNaturalOne = d20Die.results.some(result => result?.result === 1);
        if (hasNaturalOne) {
          flags.criticalFailure = true;
          return { cardigan: flags };
        }
      }

      // Check for critical hit - different logic for accuracy vs other rolls
      if (d20Die && d20Die.results && d20Die.results.length > 0) {
        // For accuracy rolls, use actor's criticalHit threshold
        if (abilityKey === 'accuracy' && actor && actor.system?.details?.criticalHit) {
          const criticalThreshold = actor.system.details.criticalHit;
          if (roll.total >= criticalThreshold) {
            flags.criticalHit = true;
            return { cardigan: flags };
          }
        }
        // For all other rolls, critical hit when total is 20 or higher
        else if (roll.total >= 20) {
          flags.criticalHit = true;
          return { cardigan: flags };
        }
      }

      return {};

    } catch (error) {
      console.warn("Error detecting critical results:", error);
      return {};
    }
  }

  /**
   * Increment the appropriate class counter when a skill is added
   * @private
   */
  async _incrementClassCounter() {
    // Skip if this is not a skill or has no actor
    if (this.type !== 'skill' || !this.actor) return;
    
    // Get the skill class
    const skillClass = this.system.skillClass;
    
    // Skip racial skills and auto-added skills
    if (skillClass === 'raciais' || skillClass === 'unicas') {
      console.log(`[Item._incrementClassCounter] Skipping counter increment for: ${this.name} (${skillClass})`);
      return;
    }
    
    // Skip Componentes and Despertar Psiônico (auto-added skills)
    if (this.name === 'Componentes' || this.name === 'Despertar Psiônico') {
      console.log(`[Item._incrementClassCounter] Skipping auto-added skill: ${this.name}`);
      return;
    }
    
    // Valid class types that have counters
    const validClasses = ['andarilho', 'guerreiro', 'ladino', 'feiticeiro'];
    
    if (!validClasses.includes(skillClass)) {
      console.log(`[Item._incrementClassCounter] Skill ${this.name} has invalid skillClass: ${skillClass}`);
      return;
    }
    
    // Get current counter value
    const currentValue = this.actor.system.classes[skillClass] || 0;
    const newValue = currentValue + 1;
    
    // Update the counter
    await this.actor.update({
      [`system.classes.${skillClass}`]: newValue
    });
    
    console.log(`[Item._incrementClassCounter] Incremented ${skillClass} counter from ${currentValue} to ${newValue} for skill: ${this.name}`);
  }

  /**
   * Decrement the appropriate class counter when a skill is deleted
   * @private
   */
  async _decrementClassCounter() {
    // Skip if this is not a skill or has no actor
    if (this.type !== 'skill' || !this.actor) return;
    
    // Get the skill class
    const skillClass = this.system.skillClass;
    
    // Skip racial skills and auto-added skills
    if (skillClass === 'raciais' || skillClass === 'unicas') {
      console.log(`[Item._decrementClassCounter] Skipping counter decrement for: ${this.name} (${skillClass})`);
      return;
    }
    
    // Skip Componentes and Despertar Psiônico (auto-added skills)
    if (this.name === 'Componentes' || this.name === 'Despertar Psiônico') {
      console.log(`[Item._decrementClassCounter] Skipping auto-added skill: ${this.name}`);
      return;
    }
    
    // Valid class types that have counters
    const validClasses = ['andarilho', 'guerreiro', 'ladino', 'feiticeiro'];
    
    if (!validClasses.includes(skillClass)) {
      console.log(`[Item._decrementClassCounter] Skill ${this.name} has invalid skillClass: ${skillClass}`);
      return;
    }
    
    // Get current counter value
    const currentValue = this.actor.system.classes[skillClass] || 0;
    const newValue = Math.max(0, currentValue - 1); // Never go below 0
    
    // Update the counter
    await this.actor.update({
      [`system.classes.${skillClass}`]: newValue
    });
    
    console.log(`[Item._decrementClassCounter] Decremented ${skillClass} counter from ${currentValue} to ${newValue} for skill: ${this.name}`);
  }

  /* -------------------------------------------- */
  /*  Item Creation                               */
  /* -------------------------------------------- */

  /**
   * Display a dialog for creating a new Item with type selection (D&D5e style)
   * @param {object} data           Initial data with which to populate the creation form
   * @param {object} [options={}]   Options which configure Item creation
   * @param {Folder} [options.folder]  A folder in which to create the item
   * @param {string[]} [options.types] An array of item types to allow. If undefined, all types are allowed
   * @returns {Promise<Item|null>}   A Promise which resolves to the created Item or null
   */
  static async createDialog(data = {}, { folder, types, ...options } = {}) {
    // Import the dialog class
    const { ItemCreateDialog } = await import("../applications/item-create-dialog.mjs");
    
    // Show the custom creation dialog
    return ItemCreateDialog.createDialog({ folder, types, ...options });
  }
}
