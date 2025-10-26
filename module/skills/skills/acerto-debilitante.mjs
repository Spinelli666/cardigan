import { BaseSkill } from '../base-skill.mjs';
import { AdvantageSelectionDialog } from '../../applications/advantage-selection-dialog.mjs';

/**
 * Acerto Debilitante - Combat skill with interactive buttons
 * A precise attack with energy consumption
 */
export class AcertoDebilitanteSkill extends BaseSkill {
  
  /**
   * The name of this skill
   * @type {string}
   */
  static get skillName() {
    return "Acerto Debilitante";
  }

  /**
   * This skill has interactive buttons in chat
   * @type {boolean}
   */
  static get hasInteractiveButtons() {
    return true;
  }

  /**
   * Initialize the Acerto Debilitante skill
   * @returns {Promise<void>}
   */
  static async initialize() {
    await super.initialize();
    console.log('[CARDIGAN] Acerto Debilitante skill initialized with 2 buttons: Attack, Energy');
  }

  /**
   * Generate interactive buttons HTML for chat
   * @param {string} actorId - The actor ID
   * @returns {string} HTML string for buttons
   */
  static generateChatButtons(actorId) {
    return `<div style="margin-top: 8px; text-align: center; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
      <button class="cardigan-skill-attack-secondary-btn cardigan-dynamic-tooltip" data-actor-id="${actorId}" data-skill="${this.skillName}"
              style="padding: 6px 12px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
        <i class="fas fa-dice-d20" style="margin-right: 4px;"></i>Ataque S
      </button>
      <button class="cardigan-skill-attack-btn cardigan-dynamic-tooltip" data-actor-id="${actorId}" data-skill="${this.skillName}"
              style="padding: 6px 12px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
        <i class="fas fa-dice-d20" style="margin-right: 4px;"></i>Ataque
      </button>
    </div>`;
  }

  /**
   * Generate energy button HTML for chat (to be placed separately)
   * @param {string} actorId - The actor ID
   * @returns {string} HTML string for energy button
   */
  static generateEnergyButton(actorId) {
    return `<div style="margin: 8px 0; text-align: center;">
      <button class="cardigan-skill-energy-btn" data-actor-id="${actorId}" data-skill="${this.skillName}"
              style="padding: 6px 12px; background: #2196f3; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
        <i class="fas fa-bolt" style="margin-right: 4px;"></i>Gastar Energia (-10)
      </button>
    </div>`;
  }

  /**
   * Generate weapon tooltip for attack button (public method for dynamic tooltips)
   * @param {string} actorId - The actor ID
   * @returns {string} Tooltip text with weapon information
   */
  static _generateWeaponTooltip(actorId) {
    try {
      const actor = this.getActor(actorId);
      if (!actor) return "Nenhuma arma encontrada";

      // Find primary hand weapon (rightHand first, then ambidextrous weapons)
      const primaryWeapon = this.#getPrimaryWeapon(actor);
      if (!primaryWeapon) {
        // No weapon equipped - show unarmed attack
        return this.#formatUnarmedTooltip(actor);
      }

      return this.#formatWeaponTooltip(primaryWeapon, actor);
    } catch (error) {
      console.error("Error generating weapon tooltip:", error);
      return "Erro ao carregar informações da arma";
    }
  }

  /**
   * Generate secondary weapon tooltip for attack secondary button (public method for dynamic tooltips)
   * @param {string} actorId - The actor ID
   * @returns {string} Tooltip text with secondary weapon information
   */
  static _generateSecondaryWeaponTooltip(actorId) {
    try {
      const actor = this.getActor(actorId);
      if (!actor) return "Nenhuma arma encontrada";

      // Find secondary hand weapon (leftHand only, excluding ambidextrous)
      const secondaryWeapon = this.#getSecondaryWeapon(actor);
      if (!secondaryWeapon) {
        // No secondary weapon equipped - show unarmed attack
        return this.#formatUnarmedTooltip(actor);
      }

      return this.#formatWeaponTooltip(secondaryWeapon, actor);
    } catch (error) {
      console.error("Error generating secondary weapon tooltip:", error);
      return "Erro ao carregar informações da arma";
    }
  }

  /**
   * Get the primary weapon for attack (rightHand priority, then ambidextrous)
   * @param {Actor} actor - The actor
   * @returns {Item|null} Primary weapon or null
   * @private
   */
  static #getPrimaryWeapon(actor) {
    // Get all REAL weapons (not virtual unarmed attacks) that are equipped
    const realWeapons = actor.items.filter(item => 
      item.type === 'arma' && 
      item.system.equipped && 
      !item.system.isUnarmed && // Exclude virtual unarmed attacks
      (item.system.rightHand || item.system.leftHand)
    );

    // Check if right hand is occupied by a REAL weapon
    const rightHandWeapon = realWeapons.find(weapon => weapon.system.rightHand);
    
    // If right hand has a real weapon, return it (priority over secondary hand)
    if (rightHandWeapon) {
      return rightHandWeapon;
    }
    
    // If right hand is empty (unarmed), do NOT show secondary hand weapons
    // Return null to show unarmed attack instead
    return null;
  }

  /**
   * Get the secondary weapon for attack (leftHand only, excluding ambidextrous)
   * @param {Actor} actor - The actor
   * @returns {Item|null} Secondary weapon or null
   * @private
   */
  static #getSecondaryWeapon(actor) {
    // Get all REAL weapons (not virtual unarmed attacks) that are equipped
    const realWeapons = actor.items.filter(item => 
      item.type === 'arma' && 
      item.system.equipped && 
      !item.system.isUnarmed && // Exclude virtual unarmed attacks
      (item.system.rightHand || item.system.leftHand)
    );

    // Find secondary hand weapon (leftHand only, NOT ambidextrous)
    const secondaryWeapon = realWeapons.find(weapon => 
      weapon.system.leftHand && !weapon.system.rightHand
    );
    
    return secondaryWeapon || null;
  }

  /**
   * Format weapon tooltip based on weapon type
   * @param {Item} weapon - The weapon item
   * @param {Actor} actor - The actor
   * @returns {string} Formatted tooltip
   * @private
   */
  static #formatWeaponTooltip(weapon, actor) {
    const weaponName = weapon.name;
    const damageTotal = weapon.system.damage.total || "0";
    
    // Calculate damage breakdown
    const damageBreakdown = this.#calculateDamageBreakdown(weapon, actor);
    
    // Determine weapon type and format accordingly
    if (weapon.system.isFirearm && weapon.system.ranged) {
      // Firearm: Nome - [current/max]
      const currentAmmo = weapon.system.loadedAmmo || 0;
      const maxAmmo = weapon.system.magazine || 0;
      return `${weaponName} - [${currentAmmo}/${maxAmmo}]\n${damageTotal}\n(${damageBreakdown})`;
    } else if (weapon.system.ranged && !weapon.system.melee) {
      // Ranged (non-firearm): Nome - [current]
      const currentAmmo = weapon.system.loadedAmmo || 0;
      return `${weaponName} - [${currentAmmo}]\n${damageTotal}\n(${damageBreakdown})`;
    } else {
      // Melee: Nome
      return `${weaponName}\n${damageTotal}\n(${damageBreakdown})`;
    }
  }

  /**
   * Format unarmed attack tooltip
   * @param {Actor} actor - The actor
   * @returns {string} Formatted unarmed tooltip
   * @private
   */
  static #formatUnarmedTooltip(actor) {
    // Calculate unarmed damage based on Strength (same logic as system's _createUnarmedAttack)
    const strengthValue = actor.system.abilities?.strength?.value || 0;
    const strengthTotalBonus = actor.system.abilities?.strength?.totalBonus || 0;
    const totalStrength = strengthValue + strengthTotalBonus;
    
    // Apply same minimum damage rule as the general unarmed attack system
    const unarmedDamage = totalStrength > 0 ? totalStrength : 1;
    
    // Format breakdown
    let damageBreakdown;
    if (totalStrength > 0) {
      if (strengthTotalBonus > 0) {
        damageBreakdown = `${strengthValue} + ${strengthTotalBonus}(Força)`;
      } else {
        damageBreakdown = `${strengthValue}(Força)`;
      }
    } else {
      damageBreakdown = "1 (mínimo)";
    }
    
    return `Ataque Desarmado\n${unarmedDamage}\n(${damageBreakdown})`;
  }

  /**
   * Calculate damage breakdown showing base + ability modifier
   * @param {Item} weapon - The weapon item
   * @param {Actor} actor - The actor
   * @returns {string} Damage breakdown text
   * @private
   */
  static #calculateDamageBreakdown(weapon, actor) {
    const baseDamage = weapon.system.damage.value || "0";
    
    // Get ability modifier
    let abilityModifier = 0;
    let abilityName = "";
    
    if (weapon.system.damage.useStrength && actor.system.abilities?.strength) {
      abilityModifier = actor.system.abilities.strength.value || 0;
      abilityName = "Força";
    } else if (weapon.system.damage.useDexterity && actor.system.abilities?.dexterity) {
      abilityModifier = actor.system.abilities.dexterity.value || 0;  
      abilityName = "Destreza";
    }

    // Format breakdown
    if (abilityModifier > 0) {
      return `${baseDamage} + ${abilityModifier}(${abilityName})`;
    } else {
      return baseDamage;
    }
  }

  /**
   * Handle button clicks for this skill
   * @param {string} buttonType - Type of button clicked
   * @param {string} actorId - The actor ID
   * @returns {Promise<void>}
   */
  static async handleButtonClick(buttonType, actorId) {
    console.log(`Acerto Debilitante: Handling ${buttonType} button click for actor ${actorId}`);
    
    switch (buttonType) {
      case 'attack':
        await this.rollAttack(actorId);
        break;
      case 'attack-secondary':
        await this.rollAttack(actorId); // Same attack roll, just different tooltip
        break;
      case 'energy':
        await this.spendEnergy(actorId);
        break;
      case 'd6':
        await this.rollD6(actorId);
        break;
      default:
        console.warn(`Acerto Debilitante: Unknown button type: ${buttonType}`);
    }
  }

  /**
   * Handle skill-to-chat functionality
   * @param {string} actorId - The actor ID
   * @returns {Promise<void>}
   */
  static async handleSkillToChat(actorId) {
    const actor = this.getActor(actorId);
    if (!actor) return;

    const skill = actor.items.find(item => item.type === 'skill' && item.name === this.skillName);
    if (!skill) {
      ui.notifications.error("Skill não encontrada");
      return;
    }

    let content = `<div class="cardigan-skill-message" style="text-align: center; padding: 8px; background: rgba(76,175,80,0.1); border: 1px solid #4caf50; border-radius: 3px;">
      <h4 style="margin: 0 0 8px 0; color: #4caf50;">
        <i class="fas fa-crosshairs" style="margin-right: 6px;"></i>${skill.name}
      </h4>`;

    // Add skill type if available
    if (skill.system.skillType) {
      // Directly map the known skill types
      let skillTypeText = skill.system.skillType;
      
      // Convert known types to display names
      if (skillTypeText === 'extra') {
        skillTypeText = 'EXTRA';
      } else {
        skillTypeText = skillTypeText.toUpperCase();
      }
      
      content += `<div style="margin: 4px 0; color: #666; font-style: italic; font-size: 0.9em; text-align: center;">
        ${skillTypeText}
      </div>`;
    }

    // Add energy button
    content += this.generateEnergyButton(actorId);

    content += `<div style="text-align: left; margin: 8px 0; color: #333;">
        ${skill.system.skillDescription || 'Ataque preciso com gasto de energia.'}
      </div>`;

    // Add attack buttons (bottom)
    content += this.generateChatButtons(actorId);
    content += `</div>`;

    await this.createChatMessage({ content, actor });
  }

  /**
   * Roll attack for Acerto Debilitante (d20 + Precision)
   * @param {string} actorId - The actor ID
   * @returns {Promise<void>}
   */
  static async rollAttack(actorId) {
    try {
      const actor = this.getActor(actorId);
      if (!actor) return;

      // Show advantage selection dialog
      const advantageType = await AdvantageSelectionDialog.show();
      if (!advantageType) return; // User cancelled

      // Get roll data
      const rollData = actor.getRollData();
      
      let roll;
      let rollDescription = "";
      
      switch (advantageType) {
        case 'normal':
          // Normal roll - 1d20
          roll = new Roll("1d20 + @accuracy.total", rollData);
          rollDescription = "Rolagem Normal";
          break;
          
        case 'advantage':
          // Advantage - roll 2d20, keep highest
          roll = new Roll("2d20kh + @accuracy.total", rollData);
          rollDescription = "Rolagem com Vantagem";
          break;
          
        case 'disadvantage':
          // Disadvantage - roll 2d20, keep lowest
          roll = new Roll("2d20kl + @accuracy.total", rollData);
          rollDescription = "Rolagem com Desvantagem";
          break;
          
        default:
          return;
      }

      await roll.evaluate();

      // Create custom flavor text showing the advantage type
      const flavorText = `<div style="text-align: center; margin-bottom: 4px;">
        <strong>${this.skillName}</strong> - ${rollDescription}
      </div>`;

      // Create enhanced flavor text with 1d6 button included
      const enhancedFlavorText = `${flavorText}
      <div style="text-align: center; margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 3px;">
        <button class="cardigan-skill-d6-btn" data-actor-id="${actorId}" data-skill="${this.skillName}"
                style="padding: 6px 12px; background: #ff9800; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
          <i class="fas fa-dice-six" style="margin-right: 4px;"></i>Rolar 1d6
        </button>
      </div>`;

      // Send roll to chat with enhanced flavor that includes the 1d6 button
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: enhancedFlavorText,
        rollMode: game.settings.get('core', 'rollMode')
      });

    } catch (error) {
      console.error("Error rolling skill attack:", error);
      ui.notifications.error(`Erro ao rolar ataque: ${error.message}`);
    }
  }

  /**
   * Roll 1d6 for Acerto Debilitante
   * @param {string} actorId - The actor ID
   * @returns {Promise<void>}
   */
  static async rollD6(actorId) {
    try {
      const actor = this.getActor(actorId);
      if (!actor) return;

      // Show advantage selection dialog for 1d6 as well
      const advantageType = await AdvantageSelectionDialog.show();
      if (!advantageType) return; // User cancelled

      let rollFormula;
      let rollDescription = "";
      
      switch (advantageType) {
        case 'normal':
          // Normal roll - 1d6
          rollFormula = "1d6";
          rollDescription = "Rolagem Normal";
          break;
          
        case 'advantage':
          // Advantage - roll 2d6, keep highest
          rollFormula = "2d6kh";
          rollDescription = "Rolagem com Vantagem";
          break;
          
        case 'disadvantage':
          // Disadvantage - roll 2d6, keep lowest
          rollFormula = "2d6kl";
          rollDescription = "Rolagem com Desvantagem";
          break;
          
        default:
          return;
      }

      // Create and evaluate the roll
      const roll = new Roll(rollFormula);
      await roll.evaluate();

      // Create custom flavor text
      const flavorText = `<div style="text-align: center; margin-bottom: 4px;">
        <strong>${this.skillName}</strong> - 1d6 ${rollDescription}
      </div>`;

      // Send roll to chat
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: flavorText,
        rollMode: game.settings.get('core', 'rollMode')
      });

    } catch (error) {
      console.error("Error rolling 1d6:", error);
      ui.notifications.error(`Erro ao rolar 1d6: ${error.message}`);
    }
  }

  /**
   * Spend energy for Acerto Debilitante (10 power cost)
   * @param {string} actorId - The actor ID
   * @returns {Promise<void>}
   */
  static async spendEnergy(actorId) {
    try {
      const actor = this.getActor(actorId);
      if (!actor) return;

      const energyCost = 10;
      const currentEnergy = actor.system.power.value || 0;
      const maxEnergy = actor.system.power.max || 0;

      console.log("Energy check:", {
        currentEnergy,
        maxEnergy,
        energyCost,
        hasEnough: currentEnergy >= energyCost
      });

      // Check if has enough energy
      if (currentEnergy < energyCost) {
        ui.notifications.warn(`${actor.name} não tem energia suficiente! (Atual: ${currentEnergy}, Necessário: ${energyCost})`);
        
        // Still show message in chat informing about the attempt
        await this.createSkillChatMessage(
          actor,
          this.skillName,
          `tentou usar <strong>${this.skillName}</strong> mas não tem energia suficiente!`,
          `Energia atual: <strong>${currentEnergy}</strong> | Necessário: <strong>${energyCost}</strong>`,
          "rgba(255,193,7,0.1)",
          "#ffc107",
          "fas fa-exclamation-triangle"
        );
        return;
      }

      // Spend energy using the base class method
      const success = await this.spendResource(actor, 'power', energyCost);
      if (!success) return;

      const newEnergy = Math.max(0, currentEnergy - energyCost);

      // Create success message in chat
      await this.createSkillChatMessage(
        actor,
        this.skillName,
        `gastou <strong>${energyCost}</strong> de energia para potencializar <strong>${this.skillName}</strong>!`,
        `Energia: <strong>${currentEnergy}</strong> → <strong>${newEnergy}</strong> (-${energyCost})`,
        "rgba(33,150,243,0.1)",
        "#2196f3",
        "fas fa-bolt"
      );

      // Show notification as well
      ui.notifications.info(`${actor.name} gastou ${energyCost} de energia! (${currentEnergy} → ${newEnergy})`);

    } catch (error) {
      console.error("Error spending skill energy:", error);
      ui.notifications.error(`Erro ao gastar energia: ${error.message}`);
    }
  }
}