import { RestSelectionDialog } from '../../applications/rest-selection-dialog.mjs';
import { CharacterCreationWizard } from '../../applications/character-creation-wizard.mjs';
import { getCoreRollMode } from '../../helpers/roll-mode.mjs';

/**
 * Header Actions Module
 * Handles all event handlers for the actor sheet header
 */
export class HeaderActions {
  
  /**
   * Handle rest button click - shows dialog to select rest type
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   */
  static async onRest(event, target, sheet) {
    event.preventDefault();
    const actor = sheet.document;
    
    // Show rest selection dialog
    const restType = await RestSelectionDialog.show(actor);
    
    // If user cancelled, do nothing
    if (!restType) return;
    
    // Perform the selected rest type
    await HeaderActions.performRest(actor, restType);
  }

  /**
   * Handle short rest action
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   */
  static async onShortRest(event, target, sheet) {
    event.preventDefault();
    const actor = sheet.document;
    
    // Confirm rest action using DialogV2
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("CARDIGAN.Rest.ShortRest") || "Short Rest" },
      content: `<p>${game.i18n.localize("CARDIGAN.Rest.Confirmation.ShortRest") || "Take a short rest? This will restore some health and power based on your vigor."}</p>`
    });
    
    if (!confirmed) return;
    
    await HeaderActions.performRest(actor, "short");
  }

  /**
   * Handle long rest action
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   */
  static async onLongRest(event, target, sheet) {
    event.preventDefault();
    const actor = sheet.document;
    
    // Confirm rest action using DialogV2
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("CARDIGAN.Rest.LongRest") || "Long Rest" },
      content: `<p>${game.i18n.localize("CARDIGAN.Rest.Confirmation.LongRest") || "Take a long rest? This will restore more health and power, remove certain effects, and potentially remove exhaustion."}</p>`
    });
    
    if (!confirmed) return;
    
    await HeaderActions.performRest(actor, "long");
  }

  /**
   * Perform the rest mechanics
   * @param {Actor} actor - The actor taking the rest
   * @param {string} restType - "short" or "long"
   */
  static async performRest(actor, restType) {
    try {
      const actorData = actor.system;
      
      // Calculate total stamina (value + bonus) like in the character data model
      const staminaValue = actorData.abilities?.stamina?.value || 0;
      const staminaBonus = actorData.abilities?.stamina?.totalBonus || 0;
      const vigor = staminaValue + staminaBonus;
      
      let recoveryRoll;
      let results = [];
      
      if (restType === "short") {
        // Short rest: 1d20 + 2×vigor
        recoveryRoll = new Roll("1d20 + @vigor", { vigor: vigor * 2 });
      } else {
        // Long rest: 2d20 + 3×vigor
        recoveryRoll = new Roll("2d20 + @vigor", { vigor: vigor * 3 });
      }
      
      // Roll for recovery (same value for health and energy)
      await recoveryRoll.evaluate();
      
      const recoveredAmount = recoveryRoll.total;
      
      // Update health and energy
      const currentHealth = actorData.health?.value || 0;
      const maxHealth = actorData.health?.max || 0;
      const currentPower = actorData.power?.value || 0;
      const maxPower = actorData.power?.max || 0;
      
      const newHealth = Math.min(currentHealth + recoveredAmount, maxHealth);
      const newPower = Math.min(currentPower + recoveredAmount, maxPower);
      
      const updateData = {
        "system.health.value": newHealth,
        "system.power.value": newPower
      };
      
      results.push(`Vida Recuperada: ${recoveredAmount}`);
      results.push(`Energia Recuperada: ${recoveredAmount}`);
      
      // Long rest specific effects
      if (restType === "long") {
        // Remove certain effects (fracture, sanity, toxicity)
        const statusUpdates = {};
        let effectsRemoved = [];
        
        if (actorData.status?.fracture > 0) {
          statusUpdates["system.status.fracture"] = 0;
          effectsRemoved.push("Fratura");
        }
        
        if (actorData.status?.sanity !== null && actorData.status?.sanity > 0) {
          statusUpdates["system.status.sanity"] = 0;
          effectsRemoved.push("Sanidade");
        }
        
        if (actorData.status?.toxicity !== null && actorData.status?.toxicity > 0) {
          statusUpdates["system.status.toxicity"] = 0;
          effectsRemoved.push("Toxicidade");
        }
        
        Object.assign(updateData, statusUpdates);
        
        if (effectsRemoved.length > 0) {
          results.push("Efeitos Removidos: " + effectsRemoved.join(", "));
        }
      }
      
      // Check for exhaustion removal for both short and long rest (only if not wearing heavy armor)
      const isWearingHeavyArmor = await HeaderActions.checkHeavyArmor(actor);
      
      // Find exhaustion effect in actor items (Cardigan uses items for effects, not Active Effects)
      const exhaustionEffect = actor.items.find(item => {
        const name = item.name?.toLowerCase() || "";
        const type = item.type?.toLowerCase() || "";
        const isExhaustion = (type === "efeito") && 
                           (name.includes("exaustão") || 
                            name.includes("exhaustion") ||
                            name.includes("exaust"));
        
        console.log(`[REST] Checking item "${item.name}" (type: ${item.type}): isExhaustion = ${isExhaustion}`);
        return isExhaustion;
      });
      
      console.log(`[REST] Exhaustion effect found:`, exhaustionEffect ? exhaustionEffect.name : "None");
      console.log(`[REST] Available effect items:`, actor.items.filter(i => i.type === "efeito").map(e => e.name));
      
      if (exhaustionEffect) {
        if (isWearingHeavyArmor) {
          results.push("Não é possível remover exaustão enquanto usa armadura pesada");
        } else {
          console.log(`[REST] Removing exhaustion effect: ${exhaustionEffect.name}`);
          await exhaustionEffect.delete();
          results.push("Exaustão removida");
        }
      } else {
        console.log(`[REST] No exhaustion effect found in items.`);
      }
      
      // Apply all updates
      await actor.update(updateData);
      
      // Show results in chat
      await HeaderActions.showRestResults(actor, restType, recoveryRoll, results);
      
      ui.notifications.info("Descanso realizado com sucesso");
      
    } catch (error) {
      console.error("[REST] Error performing rest:", error);
      ui.notifications.error("Error performing rest: " + error.message);
    }
  }

  /**
   * Check if actor is wearing heavy armor
   * @param {Actor} actor - The actor to check
   * @returns {boolean} - True if wearing heavy armor
   */
  static checkHeavyArmor(actor) {
    const equippedArmor = actor.items.filter(item => 
      item.type === "armadura" && item.system.equipped
    );
    
    return equippedArmor.some(armor => armor.system.weight === "heavy");
  }

  /**
   * Show rest results in chat
   * @param {Actor} actor - The actor who rested
   * @param {string} restType - "short" or "long"
   * @param {Roll} recoveryRoll - The recovery roll
   * @param {Array} results - Array of result messages
   */
  static async showRestResults(actor, restType, recoveryRoll, results) {
    const restLabel = restType === "short" 
      ? (game.i18n.localize("CARDIGAN.Rest.ShortRest") || "Descanso Curto")
      : (game.i18n.localize("CARDIGAN.Rest.LongRest") || "Descanso Longo");
    
    // Create flavor text with additional effects
    let flavor = `<h3>${restLabel}</h3>`;
    if (results.length > 0) {
      flavor += `<div class="rest-effects">`;
      flavor += results.map(result => `<div>• ${result}</div>`).join("");
      flavor += `</div>`;
    }
    
    // Send roll to chat like skill tests
    await recoveryRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: flavor,
      rollMode: getCoreRollMode()
    });
  }

  /**
   * Handle opening the character creation wizard
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Clicked element
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   */
  static async onOpenCharacterWizard(event, target, sheet) {
    const actor = sheet.actor;
    
    // Verificar se o level é 0
    if (actor.system.attributes.level.value !== 0) {
      ui.notifications.warn("O wizard de criação só está disponível para personagens de nível 0!");
      return;
    }
    
    // Abrir o wizard
    const wizard = new CharacterCreationWizard(actor);
    await wizard.render(true);
  }

  /**
   * Handle opening the level up wizard
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   */
  static async onOpenLevelUpWizard(event, target, sheet) {
    const actor = sheet.actor;
    
    // Verificar se o personagem está pronto para upar
    const currentLevel = actor.system.attributes.level.value || 0;
    const currentXP = actor.system.experience.current || 0;
    const nextLevelXP = actor.system.experience.nextLevel || 100;
    
    if (currentLevel === 0) {
      ui.notifications.warn("Use o botão 'Criar Personagem' primeiro!");
      return;
    }
    
    if (currentXP < nextLevelXP) {
      ui.notifications.warn(`Você precisa de ${nextLevelXP - currentXP} XP para upar de nível!`);
      return;
    }
    
    // Abrir o wizard de level up
    const { LevelUpWizard } = await import('../../applications/level-up-wizard.mjs');
    const wizard = new LevelUpWizard(actor);
    await wizard.render(true);
  }
}
