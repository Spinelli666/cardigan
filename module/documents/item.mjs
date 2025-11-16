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
   * Render a rich tooltip for this item.
   * @param {object} [enrichmentOptions={}]  Options for text enrichment.
   * @returns {Promise<{content: string, classes: string[]}>}
   */
  async richTooltip(enrichmentOptions = {}) {
    // Get the description from the item
    let description = '';
    if (this.system?.description) {
      // Enrich the description using the modern Foundry v13 API - keeps HTML formatting
      const TextEditor = foundry.applications.ux.TextEditor.implementation;
      description = await TextEditor.enrichHTML(this.system.description, {
        secrets: this.isOwner,
        relativeTo: this,
        ...enrichmentOptions
      });
    }

    // Build the tooltip content with rich HTML formatting
    const content = `
      <div class="item-tooltip">
        <div class="header">
          <h3>${this.name}</h3>
          ${this.system.type?.label ? `<div class="subtitle">${this.system.type.label}</div>` : ''}
        </div>
        ${description ? `<div class="content">${description}</div>` : ''}
      </div>
    `;

    return {
      content,
      classes: ['cardigan-tooltip', 'item-tooltip']
    };
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
}
