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
