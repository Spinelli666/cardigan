import { buildRollFormula } from '../helpers/config.mjs';
import { ChatMessageHelper } from '../helpers/chat-messages.mjs';
import { createGMEvasionNotification, closeAttackDialogForAttacker, createAttackerResultDialog } from './combat-dialogs.mjs';

/**
 * Handle evasion button click
 */
export async function handleEvasionClick(button) {
  const messageId = button.dataset.messageId;
  const tokenId = button.dataset.tokenId;
  const actorId = button.dataset.actorId;
  const attackTotal = parseInt(button.dataset.attackTotal);

  // Get the attack message to extract damage and reroll context from flags
  const message = game.messages.get(messageId);
  const attackData = message?.flags?.cardigan?.attackTargets;
  const attackDamage = attackData?.damage || 0;
  
  const attackerId = attackData?.attackerId;
  const isReroll = attackData?.isReroll || false;
  const dialogId = attackData?.dialogId;
  const oldDialogId = attackData?.oldDialogId;
  const attackerName = attackData?.attackerName;
  const defenderName = attackData?.defenderName;
  const attackerOwnerId = attackData?.attackerOwnerId;
  const storedArmor = attackData?.armor;
  const storedCurrentHP = attackData?.currentHP;
  const storedMaxHP = attackData?.maxHP;
  const attackerCriticalHit = attackData?.attackerCriticalHit || false;
  const weaponName = attackData?.weaponName;
  const weaponProperties = attackData?.weaponProperties || [];

  // Get token and actor (defender)
  const token = game.scenes.current?.tokens.get(tokenId);
  const actor = game.actors.get(actorId);

  if (!token || !actor) {
    ui.notifications.error("Alvo não encontrado.");
    return;
  }

  // Check if this is a GM-involved combat (attacker or defender is GM)
  const attackerActor = game.actors.get(attackerId);
  const attackerIsGM = attackerActor?.hasPlayerOwner === false; // GM-owned NPC
  const defenderIsGM = actor?.hasPlayerOwner === false; // GM-owned NPC
  const shouldNotifyGM = attackerIsGM || defenderIsGM; // Only notify if GM is involved

  // Get current HP and armor from defender
  const currentHP = actor.system.health?.value || 0;
  const maxHP = actor.system.health?.max || 0;
  const armor = actor.system.armor?.value || 0;

  // Import the advantage selection dialog
  const { AdvantageSelectionDialog } = await import('../applications/advantage-selection-dialog.mjs');
  
  // Show advantage selection dialog (without hand selection checkboxes for evasion)
  const result = await AdvantageSelectionDialog.show({ 
    hideHandSelection: true,
    hideJointRoll: true,  // Hide joint roll for evasion tests
    hideAttackModeBorder: true  // Hide border for evasion tests
  });
  if (!result) return; // User cancelled

  const { rollType, manualModifier = 0 } = result;

  // Disable button to prevent double-clicks
  button.disabled = true;
  button.style.opacity = '0.5';
  button.style.cursor = 'not-allowed';

  try {
    // Get roll data from actor (includes all bonuses and modifiers)
    const rollData = actor.getRollData();

    // Determine formula based on roll type (including manual modifier)
    const formula = buildRollFormula(rollType, "@evasion.total", manualModifier);
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
      default:
        rollDescription = "Rolagem Normal";
    }

    // Check for Congelado effect and apply skill penalty
    const { CongeladoEffect } = await import('../effects/effects/congelado.mjs');
    const congeladoPenalty = CongeladoEffect.getSkillPenalty(actor);
    
    // Apply Congelado penalty to formula if present
    if (congeladoPenalty !== 0) {
      formula += ` ${congeladoPenalty}`;
      rollDescription += ` [Congelado ${congeladoPenalty}]`;
    }
    
    // Roll evasion using actor's roll data
    const roll = new Roll(formula, rollData);
    await roll.evaluate();

    // Apply Sangramento effect for evasion rolls
    const { SangramentoEffect } = await import('../effects/effects/sangramento.mjs');
    await SangramentoEffect.applyBleedingDamage(actor, 'Evasão', 'evasion');

    const evasionTotal = roll.total;
    // Em caso de empate, o atacante vence (evasão falha)
    const success = evasionTotal > attackTotal;

    // Detect critical results - checking both natural dice AND total value
    let criticalSuccess = false;
    let criticalFailure = false;
    
    // Check all d20 dice in the roll for natural 1 or 20
    // Only check ACTIVE dice (not discarded by advantage/disadvantage)
    for (const term of roll.terms) {
      if (term instanceof foundry.dice.terms.Die && term.faces === 20) {
        for (const result of term.results) {
          // Only check active dice results (discarded dice have active: false)
          if (result.active !== false) {
            if (result.result === 20) criticalSuccess = true;
            if (result.result === 1) criticalFailure = true;
          }
        }
      }
    }
    
    // Also check total value (≥20 = success, ≤1 = failure)
    if (evasionTotal >= 20) criticalSuccess = true;
    if (evasionTotal <= 1) criticalFailure = true;

    // Calculate HP after damage (only if failed evasion)
    const damageTaken = success ? 0 : attackDamage;
    const remainingHP = Math.max(0, currentHP - damageTaken);

    // Send to chat using helper
    const chatMessage = await ChatMessageHelper.createRollMessage({
      actor: token.actor,
      roll: roll,
      label: 'EVASÃO',
      rollType: rollType,
      rollDescription: ChatMessageHelper.getRollTypeDescription(rollType),
      handIndicator: null,
      modifiers: [],
      primaryHand: false,
      secondaryHand: false,
      flags: {
        cardigan: {
          criticalSuccess: criticalSuccess,
          criticalFailure: criticalFailure
        }
      }
    });

    // Wait for Dice So Nice animation to complete before notifying GM
    if (game.dice3d) {
      await game.dice3d.waitFor3DAnimationByMessageID(chatMessage.id);
    }

    // Send GM notification via socket ONLY if GM is involved (attacker or defender is GM-owned)
    if (shouldNotifyGM) {
      const socketPayload = {
        action: "notifyGMEvasion",
        payload: {
          actorId: actorId,
          playerName: game.user.name,
          characterName: token.name,
          attackerName: attackerActor?.name || "Atacante",
          attackerId: attackerId,
          evasionTotal: evasionTotal,
          attackTotal: attackTotal,
          success: success,
          currentHP: currentHP,
          maxHP: maxHP,
          armor: armor,
          attackDamage: attackDamage,
          damageTaken: damageTaken,
          remainingHP: remainingHP,
          defenderCriticalFailure: criticalFailure,
          attackerCriticalHit: attackerCriticalHit,
          weaponName: weaponName,
          weaponProperties: weaponProperties
        }
      };
      
      console.log('[CARDIGAN SOCKET] Emitting GM notification:', socketPayload);
      game.socket.emit("system.cardigan", socketPayload);
      
      // Also create notification locally if current user is GM
      if (game.user.isGM) {
        createGMEvasionNotification(socketPayload.payload);
      }
    } else {
      // PvP scenario or precision reroll: Only notify GM if GM is involved in combat
      if (isReroll && shouldNotifyGM) {
        // This is a reroll with GM involvement - notify GM with new results
        const gmNotificationPayload = {
          actorId: actorId,
          playerName: game.user.name,
          characterName: token.name,
          attackerName: attackerName || attackerActor?.name || "Atacante",
          attackerId: attackerId,
          evasionTotal: evasionTotal,
          attackTotal: attackTotal,
          success: success,
          currentHP: currentHP,
          maxHP: maxHP,
          armor: armor,
          attackDamage: attackDamage,
          damageTaken: damageTaken,
          remainingHP: remainingHP,
          defenderCriticalFailure: criticalFailure,
          attackerCriticalHit: attackerCriticalHit,
          weaponName: weaponName,
          weaponProperties: weaponProperties
        };

        console.log('[CARDIGAN] Notifying GM of reroll results:', gmNotificationPayload);
        
        // Notify GM via socket
        game.socket.emit("system.cardigan", {
          action: "notifyGMEvasion",
          payload: gmNotificationPayload
        });

        // Also create notification locally if current user is GM
        if (game.user.isGM) {
          createGMEvasionNotification(gmNotificationPayload);
        }
      }
      
      // Check if this is a reroll with old dialog
      if (isReroll && oldDialogId) {
        // This is a reroll from "Rolar Novamente" button
        if (success) {
          // Defender won - close dialog and show success message
          const successMessage = `
            <div style="text-align: center; padding: 8px; background: rgba(76, 175, 80, 0.1); border: 2px solid #4CAF50; border-radius: 4px;">
              <h3 style="margin: 0 0 4px 0; color: #4CAF50;">
                <i class="fas fa-shield-alt"></i> Evasão Bem-Sucedida!
              </h3>
              <p style="margin: 0;"><strong>${token.name}</strong> desviou do ataque na re-rolagem!</p>
              <p style="margin: 4px 0 0 0; font-size: 0.9em;">
                🎯 Ataque: ${attackTotal} | 🛡️ Evasão: ${evasionTotal}
              </p>
            </div>
          `;
          
          await ChatMessage.create({
            content: successMessage,
            speaker: { alias: "Sistema" }
          });
          
          // Close dialog for attacker via socket
          game.socket.emit("system.cardigan", {
            action: "closeAttackDialog",
            payload: { dialogId: oldDialogId }
          });
          
          // Also close locally
          closeAttackDialogForAttacker({ dialogId: oldDialogId });
        } else {
          // Attacker still wins - close old dialog and open new one with updated values
          const newDialogPayload = {
            action: "openNewAttackDialog",
            payload: {
              oldDialogId: oldDialogId,
              attackerName: attackerName || attackerActor?.name || "Atacante",
              defenderName: defenderName || token.name,
              attackTotal: attackTotal,
              evasionTotal: evasionTotal,
              success: true, // Attack succeeded (evasion failed)
              attackDamage: attackDamage,
              armor: storedArmor || armor,
              attackerOwnerId: attackerOwnerId,
              actorId: actorId,
              currentHP: storedCurrentHP || currentHP,
              maxHP: storedMaxHP || maxHP,
              defenderCriticalFailure: criticalFailure,  // Add defender critical flag from reroll
              attackerCriticalHit: attackerCriticalHit,  // Preserve attacker critical from original attack
              weaponName: weaponName,
              weaponProperties: weaponProperties
            }
          };
          
          console.log('[CARDIGAN SOCKET] Emitting new attack dialog (reroll):', newDialogPayload);
          game.socket.emit("system.cardigan", newDialogPayload);
          
          // Also handle locally if current user is the attacker
          if (attackerOwnerId === game.user.id) {
            closeAttackDialogForAttacker({ dialogId: oldDialogId });
            createAttackerResultDialog(newDialogPayload.payload);
          }
        }
      } else {
        // Normal PvP attack (not a reroll): Only show dialog if attack succeeded (evasion failed)
        if (!success) {
          // Attack hit - show dialog to attacker
          // Get the attacker's primary owner (first player who owns the character)
          const attackerOwners = game.users.filter(u => !u.isGM && attackerActor?.testUserPermission(u, "OWNER"));
          const attackerOwnerId = attackerOwners.length > 0 ? attackerOwners[0].id : null;
          
          // Send attacker notification with all needed data
          const attackerPayload = {
            action: "notifyAttacker",
            payload: {
              attackerName: attackerActor?.name || "Atacante",
              defenderName: token.name,
              attackTotal: attackTotal,
              evasionTotal: evasionTotal,
              success: !success, // Inverted because success means evasion succeeded (attack failed)
              attackDamage: attackDamage,
              armor: armor,
              attackerOwnerId: attackerOwnerId,
              actorId: actorId,
              currentHP: currentHP,
              maxHP: maxHP,
              defenderCriticalFailure: criticalFailure,
              attackerCriticalHit: attackerCriticalHit,
              weaponName: weaponName,
              weaponProperties: weaponProperties
            }
          };
          
          console.log('[CARDIGAN SOCKET] Emitting attacker notification (PvP):', attackerPayload);
          game.socket.emit("system.cardigan", attackerPayload);
          
          // Also create notification locally if current user is the attacker
          if (attackerOwnerId === game.user.id) {
            createAttackerResultDialog(attackerPayload.payload);
          }
        } else {
          // Attack missed - just create a chat message
          const missMessage = `
            <div style="text-align: center; padding: 8px; background: rgba(244, 67, 54, 0.1); border: 2px solid #f44336; border-radius: 4px;">
              <h3 style="margin: 0 0 4px 0; color: #f44336;">
                <i class="fas fa-shield-alt"></i> Errou!
              </h3>
              <p style="margin: 0;"><strong>${token.name}</strong> desviou do ataque!</p>
              <p style="margin: 4px 0 0 0; font-size: 0.9em;">
                🎯 Ataque: ${attackTotal} | 🛡️ Evasão: ${evasionTotal}
              </p>
            </div>
          `;
          await ChatMessage.create({
            content: missMessage,
            speaker: { alias: "Sistema" }
          });
        }
      }
    }

  } catch (error) {
    console.error("Error rolling evasion:", error);
    ui.notifications.error("Erro ao rolar evasão.");
    // Re-enable button on error
    button.disabled = false;
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
  }
}

/**
 * Handle precision button click (for evasion rerolls)
 */
export async function handlePrecisionClick(button) {
  const messageId = button.dataset.messageId;
  const tokenId = button.dataset.tokenId;
  const actorId = button.dataset.actorId;
  const evasionTotal = parseInt(button.dataset.evasionTotal);

  // Get the evasion message to extract defender data from flags
  const message = game.messages.get(messageId);
  const precisionData = message?.flags?.cardigan?.precisionTarget;

  // Get token and actor (attacker)
  const token = game.scenes.current?.tokens.get(tokenId);
  const actor = game.actors.get(actorId);

  if (!token || !actor) {
    ui.notifications.error("Atacante não encontrado.");
    return;
  }

  // Get defender data from the evasion message or original attack
  // We need to find the defender - look for recent evasion rolls or attack data
  let defenderActor, defenderToken, defenderName;
  
  // Try to find defender from recent messages (the one who rolled evasion)
  const recentMessages = Array.from(game.messages).reverse().slice(0, 10);
  for (const msg of recentMessages) {
    const evasionData = msg.flags?.cardigan?.attackTargets;
    if (evasionData && evasionData.attackerId === actorId) {
      // Found the original attack - get defender
      if (evasionData.targets && evasionData.targets.length > 0) {
        const defenderData = evasionData.targets[0];
        defenderToken = game.scenes.current?.tokens.get(defenderData.tokenId);
        defenderActor = game.actors.get(defenderData.actorId);
        defenderName = defenderData.name;
        break;
      }
    }
  }

  if (!defenderActor || !defenderToken) {
    ui.notifications.warn("Não foi possível encontrar o defensor.");
    button.disabled = false;
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
    return;
  }

  // Disable button to prevent double-clicks
  button.disabled = true;
  button.style.opacity = '0.5';
  button.style.cursor = 'not-allowed';

  try {
    // Import the AdvantageSelectionDialog
    const { AdvantageSelectionDialog } = await import('../applications/advantage-selection-dialog.mjs');
    
    // Open advantage selection dialog
    const result = await AdvantageSelectionDialog.show();
    
    if (!result) {
      // User cancelled
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
      return;
    }

    const { rollType, manualModifier = 0 } = result;

    // Import buildRollFormula helper
    const { buildRollFormula } = await import('../helpers/config.mjs');
    
    // Build roll formula (including manual modifier)
    const formula = buildRollFormula(rollType, `@abilities.accuracy.total`, manualModifier);
    const rollData = actor.getRollData();

    // Check for Congelado effect and apply skill penalty
    const { CongeladoEffect } = await import('../effects/effects/congelado.mjs');
    const congeladoPenalty = CongeladoEffect.getSkillPenalty(actor);
    
    // Apply Congelado penalty to formula if present
    if (congeladoPenalty !== 0) {
      formula += ` ${congeladoPenalty}`;
    }
    
    // Roll precision
    const roll = new Roll(formula, rollData);
    await roll.evaluate();
    const precisionTotal = roll.total;

    // Apply Sangramento effect for accuracy rolls
    const { SangramentoEffect } = await import('../effects/effects/sangramento.mjs');
    await SangramentoEffect.applyBleedingDamage(actor, 'Precisão', 'accuracy');

    // Detect critical results using actor's thresholds
    const { CardiganSystemActorSheet } = await import('../sheets/actor-sheet.mjs');
    const criticalFlags = CardiganSystemActorSheet._detectCriticalResults(roll, actor, 'accuracy');
    const precisionCriticalHit = criticalFlags?.cardigan?.criticalHit || false;
    const precisionCriticalFailure = criticalFlags?.cardigan?.criticalFailure || false;
    
    // Handle critical failure - reduce durability of equipped weapon
    if (precisionCriticalFailure) {
      // Find equipped weapon
      const equippedWeapons = actor.items.filter(i => 
        i.type === 'arma' && i.system.equipped === true
      );
      
      if (equippedWeapons.length > 0) {
        const weapon = equippedWeapons[0];
        const currentDurability = weapon.system.durability?.current || 0;
        
        if (currentDurability > 0) {
          const newDurability = Math.max(0, currentDurability - 1);
          await weapon.update({
            'system.durability.current': newDurability
          });
          
          ui.notifications.warn(
            `Erro Crítico na re-rolagem! ${weapon.name} perdeu durabilidade (${currentDurability} → ${newDurability})`
          );
        } else {
          ui.notifications.warn(`Erro Crítico na re-rolagem!`);
        }
      }
    } else if (precisionCriticalHit) {
      const critThreshold = actor.system?.details?.criticalHit;
      if (critThreshold) {
        ui.notifications.info(`Acerto Crítico na re-rolagem! (${precisionTotal} >= ${critThreshold})`);
      } else {
        ui.notifications.info(`Acerto Crítico na re-rolagem!`);
      }
    }

    // Create chat message using custom template
    const rollDescriptionMap = {
      'advantage': 'Rolagem com Vantagem',
      'disadvantage': 'Rolagem com Desvantagem',
      'enhanced-advantage': 'Rolagem com Vantagem Aprimorada',
      'enhanced-disadvantage': 'Rolagem com Desvantagem Aprimorada',
      'normal': 'Rolagem Normal'
    };
    await ChatMessageHelper.createRollMessage({
      actor: actor,
      roll: roll,
      label: 'PRECISÃO',
      rollType: rollType,
      rollDescription: rollDescriptionMap[rollType] || 'Rolagem Normal',
      flags: {
        cardigan: {
          criticalSuccess: precisionCriticalHit,
          criticalFailure: precisionCriticalFailure
        }
      }
    });
    
    // Get preserved damage and defender critical from precisionData
    const preservedDamage = precisionData?.attackDamage || 0;
    const defenderCriticalFailure = precisionData?.defenderCriticalFailure || false;
    
    // Notify GM with the new results
    const gmNotificationPayload = {
      actorId: defenderActor.id,
      playerName: defenderActor.name,
      characterName: defenderActor.name,
      attackerName: actor.name,
      evasionTotal: evasionTotal,
      attackTotal: precisionTotal,
      attackDamage: preservedDamage,  // Use preserved damage
      armor: defenderActor.system.armor?.value || 0,
      currentHP: defenderActor.system.health?.value || 0,
      maxHP: defenderActor.system.health?.max || 0,
      attackerCriticalHit: precisionCriticalHit,  // New precision critical
      defenderCriticalFailure: defenderCriticalFailure  // Preserved defender critical
    };

    console.log('[CARDIGAN] Notifying GM of precision reroll:', gmNotificationPayload);
    
    // Notify GM via socket
    game.socket.emit("system.cardigan", {
      action: "notifyGMEvasion",
      payload: gmNotificationPayload
    });

    // Also create notification locally if current user is GM
    if (game.user.isGM) {
      createGMEvasionNotification(gmNotificationPayload);
    }

    // Remove button after use
    button.remove();

  } catch (error) {
    console.error("Error rolling precision:", error);
    ui.notifications.error("Erro ao rolar precisão.");
    // Re-enable button on error
    button.disabled = false;
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
  }
}
