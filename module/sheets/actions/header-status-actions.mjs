import { AdvantageSelectionDialog } from '../../applications/advantage-selection-dialog.mjs';

/**
 * Header Status Actions Module
 * Handles all status-related event handlers and rolls for the actor sheet header
 */
export class HeaderStatusActions {
  
  /**
   * Handle generic roll with advantage/disadvantage system
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   */
  static async onRoll(event, target, sheet) {
    event.preventDefault();
    
    const element = target;
    const dataset = element.dataset;

    // Handle item rolls.
    switch (dataset.rollType) {
      case 'item':
        const itemId = element.closest('[data-item-id]')?.dataset.itemId;
        const item = sheet.document.items.get(itemId);
        if (item) return item.roll();
        break;
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      const label = dataset.label || 'Roll';
      
      try {
        // Show advantage selection dialog
        const result = await AdvantageSelectionDialog.show();
        if (!result) return; // User cancelled

        const { rollType, attackMode } = result;

        let rollFormula = dataset.roll;
        let rollDescription = "Rolagem Normal";
        
        // Modify the formula based on advantage type
        switch (rollType) {
          case 'normal':
            // Keep original formula
            rollDescription = "Rolagem Normal";
            break;
            
          case 'advantage':
            // Replace d20 with 2d20kh (keep highest)
            rollFormula = rollFormula.replace(/1?d20/g, '2d20kh');
            rollDescription = "Rolagem com Vantagem";
            break;
            
          case 'disadvantage':
            // Replace d20 with 2d20kl (keep lowest)
            rollFormula = rollFormula.replace(/1?d20/g, '2d20kl');
            rollDescription = "Rolagem com Desvantagem";
            break;
            
          case 'enhanced-advantage':
            // Replace d20 with 3d20kh (keep highest of 3)
            rollFormula = rollFormula.replace(/1?d20/g, '3d20kh');
            rollDescription = "Rolagem com Vantagem Aprimorada";
            break;
            
          case 'enhanced-disadvantage':
            // Replace d20 with 3d20kl (keep lowest of 3)
            rollFormula = rollFormula.replace(/1?d20/g, '3d20kl');
            rollDescription = "Rolagem com Desvantagem Aprimorada";
            break;
            
          default:
            return;
        }
        
        // Add attack mode to description
        const modeText = attackMode === 'conjunto' ? ' (Conjunto)' : ' (Individual)';
        rollDescription += modeText;
        
        // Check for Congelado effect and apply skill penalty
        const { CongeladoEffect } = await import('../../effects/effects/congelado.mjs');
        const congeladoPenalty = CongeladoEffect.getSkillPenalty(sheet.document);
        
        // Apply Congelado penalty to formula if present
        if (congeladoPenalty !== 0) {
          rollFormula += ` ${congeladoPenalty}`;
          rollDescription += ` [Congelado ${congeladoPenalty}]`;
        }
        
        // Create the roll with modified formula
        const roll = new Roll(rollFormula, sheet.document.getRollData());
        
        // Evaluate the roll
        await roll.evaluate();
        
        // Check for Sangramento effect and apply damage if rolling an ability
        const abilityKey = dataset.key || null;
        if (abilityKey) {
          const abilityLabel = label || dataset.label || '';
          const { SangramentoEffect } = await import('../../effects/index.mjs');
          await SangramentoEffect.applyBleedingDamage(sheet.document, abilityLabel, abilityKey);
        }
        
        // Detect critical results, passing the ability key if available
        const flags = HeaderStatusActions.detectCriticalResults(roll, sheet.document, abilityKey);
        
        // Show notification for critical results (only for the user who rolled)
        if (flags?.cardigan?.criticalHit) {
          const critThreshold = sheet.document.system?.details?.criticalHit;
          if (abilityKey === 'accuracy' && critThreshold) {
            ui.notifications.info(`Acerto Crítico! (${roll.total} >= ${critThreshold})`);
          } else {
            ui.notifications.info(`Sucesso Crítico!`);
          }
        } else if (flags?.cardigan?.criticalFailure) {
          ui.notifications.warn(`Erro Crítico!`);
        }
        
        // Create custom flavor text showing the advantage type
        const flavorText = `<div style="text-align: center; margin-bottom: 4px;">
          <strong>${label}</strong> - ${rollDescription}
        </div>`;
        
        // Send to chat
        const message = await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: sheet.document }),
          flavor: flavorText,
          rollMode: game.settings.get('core', 'rollMode'),
          flags: flags
        });
        
        return roll;
      } catch (error) {
        console.error("Error during roll:", error);
        ui.notifications.error(`Erro ao rolar ${label}: ${error.message}`);
      }
    }
  }

  /**
   * Handle rolling the Death Die (1d20)
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   */
  static async onRollDeathDie(event, target, sheet) {
    event.preventDefault();
    
    try {
      // Create the death die roll (1d20)
      const roll = new Roll('1d20');
      
      // Evaluate the roll
      await roll.evaluate();
      
      // Create custom flavor message based on result and apply automatic effects
      let flavorMessage = "Death Die";
      const result = roll.total;
      let updateData = {};
      
      // Apply automatic effects based on result
      if (result >= 1 && result <= 10) {
        // 1-10: Death Sentence
        const currentDeathSentence = sheet.document.system.status?.deathSentence ?? null;
        
        if (currentDeathSentence === 3) {
          // Já está no máximo
          flavorMessage += `\n Sentença de Morte! (${result})`;
          flavorMessage += `\n→ Já possui 3 Sentenças de Morte - PERSONAGEM MORREU!!`;
        } else if (currentDeathSentence === null) {
          // Começar do 1 (contagem zerada ou nunca marcada)
          updateData['system.status.deathSentence'] = 1;
          flavorMessage += `\n Sentença de Morte! (${result})`;
          flavorMessage += `\n→ Sentença de Morte nível 1 automaticamente marcada`;
        } else {
          // Incrementar (de 1 para 2, ou de 2 para 3)
          const newLevel = currentDeathSentence + 1;
          updateData['system.status.deathSentence'] = newLevel;
          flavorMessage += `\n Sentença de Morte! (${result})`;
          flavorMessage += `\n→ Sentença de Morte nível ${newLevel} automaticamente marcada`;

          if (newLevel === 3) {
            flavorMessage += `\n PERSONAGEM MORREU! (3 Sentenças de Morte)`;
          }
        }
      } else if (result >= 11 && result <= 20) {
        // 11-20: Dádiva da Vida
        const currentLifeGift = sheet.document.system.status?.giftOfLife ?? null;
        
        if (currentLifeGift === 3) {
          // Já está no máximo
          flavorMessage += `\n Dádiva da Vida! (${result})`;
          flavorMessage += `\n→ Já possui 3 Dádivas da Vida - ESTABILIZADO!`;
        } else if (currentLifeGift === null) {
          // Começar do 1 (contagem zerada ou nunca marcada)
          updateData['system.status.giftOfLife'] = 1;
          flavorMessage += `\n Dádiva da Vida! (${result})`;
          flavorMessage += `\n→ Dádiva da Vida nível 1 automaticamente marcada`;
        } else {
          // Incrementar (de 1 para 2, ou de 2 para 3)
          const newLevel = currentLifeGift + 1;
          updateData['system.status.giftOfLife'] = newLevel;
          flavorMessage += `\n Dádiva da Vida! (${result})`;
          flavorMessage += `\n→ Dádiva da Vida nível ${newLevel} automaticamente marcada`;

          if (newLevel === 3) {
            flavorMessage += `\n ESTABILIZADO! (3 Dádivas da Vida)`;
          }
        }
      }
      
      // Detect critical results
      const flags = HeaderStatusActions.detectCriticalResults(roll, sheet.document, null);
      
      // Send to chat FIRST - so result appears before checkbox is marked
      const chatMessage = await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: sheet.document }),
        flavor: flavorMessage,
        rollMode: game.settings.get('core', 'rollMode'),
        flags: flags
      });
      
      // Wait for Dice So Nice! animation to complete (if module is active)
      if (game.dice3d) {
        await game.dice3d.waitFor3DAnimationByMessageID(chatMessage.id);
      }
      
      // Update the actor AFTER chat message AND dice animation
      if (Object.keys(updateData).length > 0) {
        await sheet.document.update(updateData);
      }
      
      return roll;
    } catch (error) {
      console.error("Error during death die roll:", error);
      ui.notifications.error(`Erro ao rolar Dado de Morte: ${error.message}`);
    }
  }

  /**
   * Handle resetting Gift of Life checkboxes
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   */
  static async onResetGiftOfLife(event, target, sheet) {
    event.preventDefault();
    
    try {
      // Reset Dádiva da Vida to null (unchecked)
      await sheet.document.update({
        'system.status.giftOfLife': null
      });
      
      ui.notifications.info("Dádiva da Vida zerada.");
    } catch (error) {
      console.error("Error resetting Gift of Life:", error);
      ui.notifications.error(`Erro ao zerar Dádiva da Vida: ${error.message}`);
    }
  }

  /**
   * Handle resetting Death Sentence checkboxes
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   */
  static async onResetDeathSentence(event, target, sheet) {
    event.preventDefault();
    
    try {
      // Reset Death Sentence to null (unchecked)
      await sheet.document.update({
        'system.status.deathSentence': null
      });
      
      ui.notifications.info("Sentença de Morte zerada.");
    } catch (error) {
      console.error("Error resetting Death Sentence:", error);
      ui.notifications.error(`Erro ao zerar Sentença de Morte: ${error.message}`);
    }
  }

  /**
   * Handle resetting Sanity checkboxes
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   */
  static async onResetSanity(event, target, sheet) {
    event.preventDefault();
    
    try {
      // Reset Sanity to null (unchecked)
      await sheet.document.update({
        'system.status.sanity': null
      });
      
      ChatMessage.create({ 
        content: `${sheet.document.name}: Estado mental estabilizado.`,
        speaker: ChatMessage.getSpeaker({ actor: sheet.document })
      });
      
      ui.notifications.info("Sanidade zerada.");
    } catch (error) {
      console.error("Error resetting Sanity:", error);
      ui.notifications.error(`Erro ao zerar Sanidade: ${error.message}`);
    }
  }

  /**
   * Handle resetting Toxicity checkboxes
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   */
  static async onResetToxicity(event, target, sheet) {
    event.preventDefault();
    
    try {
      // Reset Toxicity to null (unchecked)
      await sheet.document.update({
        'system.status.toxicity': null
      });
      
      ChatMessage.create({ 
        content: `${sheet.document.name}: Toxinas eliminadas do organismo.`,
        speaker: ChatMessage.getSpeaker({ actor: sheet.document })
      });
      
      ui.notifications.info("Toxicidade zerada.");
    } catch (error) {
      console.error("Error resetting Toxicity:", error);
      ui.notifications.error(`Erro ao zerar Toxicidade: ${error.message}`);
    }
  }

  /**
   * Handle resetting Fracture checkboxes
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   */
  static async onResetFracture(event, target, sheet) {
    event.preventDefault();
    
    try {
      // Reset Fracture to 0 (unchecked)
      await sheet.document.update({
        'system.status.fracture': 0
      });
      
      ChatMessage.create({ 
        content: `${sheet.document.name}: Fraturas completamente curadas.`,
        speaker: ChatMessage.getSpeaker({ actor: sheet.document })
      });
      
      ui.notifications.info("Fratura zerada.");
    } catch (error) {
      console.error("Error resetting Fracture:", error);
      ui.notifications.error(`Erro ao zerar Fratura: ${error.message}`);
    }
  }

  /**
   * Handle resetting Hunger to normal (0)
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   */
  static async onResetHunger(event, target, sheet) {
    event.preventDefault();
    
    try {
      // Resetar hunger para 0 (sem fome)
      await sheet.document.update({
        'system.status.hunger': 0
      });
      
      ChatMessage.create({ 
        content: `${sheet.document.name}: Fome resetada (sem fome).`,
        speaker: ChatMessage.getSpeaker({ actor: sheet.document })
      });
      
      ui.notifications.info("Fome resetada.");
      
      // Efeito de exaustão será gerenciado automaticamente pelo ExaustaoEffect
    } catch (error) {
      console.error("Error resetting Hunger:", error);
      ui.notifications.error(`Erro ao resetar Fome: ${error.message}`);
    }
  }

  /**
   * Handle resetting Thirst to normal (0)
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The clicked element
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   */
  static async onResetThirst(event, target, sheet) {
    event.preventDefault();
    
    try {
      // Resetar thirst para 0 (sem sede)
      await sheet.document.update({
        'system.status.thirst': 0
      });
      
      ChatMessage.create({ 
        content: `${sheet.document.name}: Sede resetada (sem sede).`,
        speaker: ChatMessage.getSpeaker({ actor: sheet.document })
      });
      
      ui.notifications.info("Sede resetada.");
      
      // Efeito de exaustão será gerenciado automaticamente pelo ExaustaoEffect
    } catch (error) {
      console.error("Error resetting Thirst:", error);
      ui.notifications.error(`Erro ao resetar Sede: ${error.message}`);
    }
  }

  /**
   * Detect critical results in a roll
   * @param {Roll} roll - The roll to check
   * @param {Actor} actor - The actor document
   * @param {string|null} abilityKey - Optional ability key for accuracy checks
   * @returns {Object} Flags object with critical information
   */
  static detectCriticalResults(roll, actor, abilityKey = null) {
    const flags = { cardigan: {} };
    
    // Check for natural 20 (critical hit)
    const hasNatural20 = roll.dice.some(d => 
      d.faces === 20 && d.results.some(r => r.result === 20)
    );
    
    // Check for natural 1 (critical failure)
    const hasNatural1 = roll.dice.some(d => 
      d.faces === 20 && d.results.some(r => r.result === 1)
    );
    
    if (hasNatural20) {
      flags.cardigan.criticalHit = true;
    }
    
    if (hasNatural1) {
      flags.cardigan.criticalFailure = true;
    }
    
    // For accuracy rolls, also check against critical hit threshold
    if (abilityKey === 'accuracy' && actor.system?.details?.criticalHit) {
      const critThreshold = actor.system.details.criticalHit;
      if (roll.total >= critThreshold) {
        flags.cardigan.criticalHit = true;
      }
    }
    
    return flags;
  }
}
