import { buildRollFormula } from '../helpers/config.mjs';
import { ChatMessageHelper } from '../helpers/chat-messages.mjs';
// Import weapon property classes for combat effects
import { Ferir } from '../weapon-properties/properties/ferir.mjs';
import { Traspassar } from '../weapon-properties/properties/traspassar.mjs';
import { Contundente } from '../weapon-properties/properties/contundente.mjs';
import { Incendiar } from '../weapon-properties/properties/incendiar.mjs';
import { Eletrocutar } from '../weapon-properties/properties/eletrocutar.mjs';
import { Impacto } from '../weapon-properties/properties/impacto.mjs';
// Global Map to track active attack dialogs
const activeAttackDialogs = new Map();

/**
 * Close attack dialog for attacker
 * @param {Object} data - Data containing dialogId
 */
export function closeAttackDialogForAttacker(data) {
  const { dialogId } = data;
  const dialogInfo = activeAttackDialogs.get(dialogId);
  if (dialogInfo?.dialog) {
    dialogInfo.dialog.close();
    activeAttackDialogs.delete(dialogId);
  }
}

/**
 * Show damage notification to the actor's owner only
 * @param {Object} data - Damage notification data
 */
export function showDamageNotification(data) {
  const { actorId, characterName, finalDamage, newHP, maxHP } = data;
  
  // Get the actor to check ownership
  const actor = game.actors.get(actorId);
  
  // Only show notification to users who own this character
  if (!actor || !actor.testUserPermission(game.user, "OWNER")) {
    return;
  }
  
  // Create notification message (always blue/info)
  const message = `<strong>${characterName}</strong> recebeu <strong>${finalDamage}</strong> de dano! HP atual: <strong>${newHP}/${maxHP}</strong>`;
  
  // Show notification (always info/blue)
  ui.notifications.info(message, { permanent: false });
}

/**
 * Show armor durability notification to the actor's owner only
 * @param {Object} data - Armor durability notification data
 */
export function showArmorDurabilityNotification(data) {
  const { actorId, armorName, isBroken, currentDurability, newDurability } = data;
  
  // Get the actor to check ownership
  const actor = game.actors.get(actorId);
  
  // Only show notification to users who own this character
  if (!actor || !actor.testUserPermission(game.user, "OWNER")) {
    return;
  }
  
  // Create appropriate notification message
  const message = isBroken
    ? `🔴 ${armorName} quebrou!`
    : `⚠️ ${armorName} perdeu durabilidade (${currentDurability} → ${newDurability})`;
  
  ui.notifications.warn(message, { permanent: false });
}

/**
 * Create attacker notification dialog for PvP combat
 * @param {Object} data - Attack result data
 */
export async function createAttackerResultDialog(data) {
  const { attackerName, defenderName, attackTotal, evasionTotal, success, attackDamage, armor, actorId, currentHP, maxHP, attackerOwnerId, defenderCriticalFailure, attackerCriticalHit, weaponName, weaponProperties } = data;
  
  // Check if there's any critical (attacker critical hit OR defender critical failure)
  const hasCritical = attackerCriticalHit || defenderCriticalFailure;
  
  // Apply 2x damage if there's any critical (doesn't stack to 4x)
  const effectiveDamage = hasCritical ? attackDamage * 2 : attackDamage;
  
  // Generate unique dialog ID (or use existing one from reroll)
  const dialogId = data.dialogId || `attack-dialog-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Initial damage taken uses effective damage (doubled if critical)
  const damageTaken = effectiveDamage;
  const remainingHP = Math.max(0, currentHP - damageTaken);
  
  // Helper function to roll dice for ignore armor
  const rollIgnoreArmorDice = async (ignoreArmorInput) => {
    const diceDialog = new foundry.applications.api.DialogV2({
      window: {
        title: "🎲 Rolar para Ignore Armor",
        icon: "fa-solid fa-dice"
      },
      content: `
        <div style="text-align: center; padding: 20px;">
          <div style="margin-bottom: 16px;">
            <label for="dice-quantity" style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: bold;">Quantidade de dados:</label>
            <input 
              type="number" 
              id="dice-quantity" 
              class="dice-quantity-input" 
              value="1" 
              min="1" 
              max="20" 
              style="width: 80px; padding: 8px; font-size: 16px; text-align: center; border: 2px solid #ccc; border-radius: 4px;"
            />
          </div>
          <p style="margin-bottom: 16px; font-size: 14px;">Escolha o tipo de dado:</p>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button type="button" class="dice-option" data-dice="d4" style="padding: 10px; font-size: 16px; cursor: pointer;">d4</button>
            <button type="button" class="dice-option" data-dice="d6" style="padding: 10px; font-size: 16px; cursor: pointer;">d6</button>
            <button type="button" class="dice-option" data-dice="d8" style="padding: 10px; font-size: 16px; cursor: pointer;">d8</button>
            <button type="button" class="dice-option" data-dice="d12" style="padding: 10px; font-size: 16px; cursor: pointer;">d12</button>
            <button type="button" class="dice-option" data-dice="d20" style="padding: 10px; font-size: 16px; cursor: pointer;">d20</button>
          </div>
        </div>
      `,
      buttons: [
        {
          action: "cancel",
          icon: "fa-solid fa-times",
          label: "Cancelar"
        }
      ],
      position: {
        width: 320,
        height: "auto"
      }
    });
    
    // Add click handlers to dice options
    diceDialog.addEventListener('render', () => {
      const diceQuantityInput = diceDialog.element.querySelector('.dice-quantity-input');
      const diceOptions = diceDialog.element.querySelectorAll('.dice-option');
      
      diceOptions.forEach(option => {
        option.addEventListener('click', async (e) => {
          const diceType = e.target.dataset.dice;
          const quantity = parseInt(diceQuantityInput?.value) || 1;
          const diceFormula = `${quantity}${diceType}`;
          
          // Roll the dice
          const roll = await new Roll(diceFormula).evaluate();
          const result = roll.total;
          
          // Wait for Dice So Nice animation if available
          if (game.dice3d) {
            await game.dice3d.showForRoll(roll);
          }
          
          // Show result in chat
          const chatContent = `
            <div style="text-align: center; padding: 8px; background: rgba(255, 193, 7, 0.1); border: 2px solid #ffc107; border-radius: 4px;">
              <h3 style="margin: 0 0 4px 0;">
                <i class="fas fa-dice"></i> Ignore Armor Roll
              </h3>
              <p style="margin: 0;"><strong>${attackerName}</strong> rolou <strong>${diceFormula}</strong> para ignorar armadura!</p>
              <p style="margin: 4px 0 0 0; font-size: 1.2em; font-weight: bold;">
                Resultado: ${result}
              </p>
            </div>
          `;
          
          await ChatMessage.create({
            content: chatContent,
            speaker: { alias: "Sistema" },
            sound: CONFIG.sounds.dice
          });
          
          // Update the ignore armor input
          if (ignoreArmorInput) {
            ignoreArmorInput.value = result;
            // Trigger input event to recalculate damage
            ignoreArmorInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          // Close the dialog
          diceDialog.close();
        });
      });
    });
    
    await diceDialog.render(true);
  };
  
  // Helper function to update damage and HP calculations
  const updateDamageCalculations = (dialogElement) => {
    const ignoreArmorInput = dialogElement.querySelector('.ignore-armor-input');
    const damageTakenInput = dialogElement.querySelector('.damage-taken-input');
    const halfDamageBtn = dialogElement.querySelector('.half-damage-btn');
    const rollIgnoreArmorBtn = dialogElement.querySelector('.roll-ignore-armor-btn');
    const ignoreAllArmorCheckbox = dialogElement.querySelector('.ignore-all-armor-checkbox');
    
    // No automatic recalculation - damage will be calculated when clicking "Acertou"
    // Add event listeners
    
    if (halfDamageBtn) {
      halfDamageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const currentDamage = parseInt(damageTakenInput?.value) || 0;
        const halfDamage = Math.floor(currentDamage / 2);
        if (damageTakenInput) {
          damageTakenInput.value = halfDamage;
        }
      });
    }
    
    if (rollIgnoreArmorBtn) {
      rollIgnoreArmorBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await rollIgnoreArmorDice(ignoreArmorInput);
      });
    }
    
    // Handle Ignore All Armor checkbox
    if (ignoreAllArmorCheckbox && ignoreArmorInput) {
      ignoreAllArmorCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          // Checkbox marcada: desabilita input e mantém valor 0 visível
          ignoreArmorInput.disabled = true;
          ignoreArmorInput.value = 0;
          // Armazena o valor real da armadura no atributo data
          const armorValue = ignoreArmorInput.dataset.armor || 0;
          ignoreArmorInput.dataset.ignoreAll = armorValue;
        } else {
          // Checkbox desmarcada: habilita input e remove data-ignore-all
          ignoreArmorInput.disabled = false;
          delete ignoreArmorInput.dataset.ignoreAll;
        }
      });
    }
  };
  
  // Render template
  const template = await foundry.applications.handlebars.getTemplate(
    'systems/cardigan/templates/dialogs/player-dialog-combat.hbs'
  );
  
  // Track selected armor IDs
  let selectedArmorIds = [];
  
  const content = template({
    attackerName,
    defenderName,
    attackTotal,
    evasionTotal,
    success,
    attackDamage: effectiveDamage,
    baseDamage: attackDamage,
    armor,
    damageTaken,
    currentHP,
    maxHP,
    remainingHP,
    hasCritical,
    attackerCriticalHit,
    defenderCriticalFailure,
    defenderId: actorId
  });
  
  // Use DialogV2 for modern API
  const dialog = new foundry.applications.api.DialogV2({
    window: {
      title: `Resultado de Ataque`,
      icon: "fa-solid fa-sword"
    },
    content: content,
    buttons: [
      {
        action: "reroll",
        icon: "fa-solid fa-redo",
        label: "Rolar Novamente",
        callback: async (event, button) => {
          // Get attacker actor
          const attackerActor = game.actors.find(a => a.name === attackerName);
          if (!attackerActor) {
            ui.notifications.error("Atacante não encontrado.");
            return false;
          }
          
          // Import and show advantage selection dialog
          const { AdvantageSelectionDialog } = await import('../applications/advantage-selection-dialog.mjs');
          const result = await AdvantageSelectionDialog.show({ 
            hideHandSelection: true,
            hideJointRoll: true,  // Hide joint roll for evasion tests
            hideAttackModeBorder: true  // Hide border for evasion tests
          });
          if (!result) return false; // User cancelled
          
          const { rollType, manualModifier = 0 } = result;
          
          // Get roll data from attacker
          const rollData = attackerActor.getRollData();
          
          // Determine formula based on roll type (including manual modifier)
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
            default:
              rollDescription = "Rolagem Normal";
          }
          
          // Roll new attack
          const roll = new Roll(formula, rollData);
          await roll.evaluate();
          const newAttackTotal = roll.total;
          
          // Detect critical results using actor's thresholds
          const { CardiganSystemActorSheet } = await import('../sheets/actor-sheet.mjs');
          const criticalFlags = CardiganSystemActorSheet._detectCriticalResults(roll, attackerActor, 'accuracy');
          const criticalSuccess = criticalFlags?.cardigan?.criticalHit || false;
          const criticalFailure = criticalFlags?.cardigan?.criticalFailure || false;
          
          // Handle critical failure - reduce durability of equipped weapon
          if (criticalFailure) {
            // Find equipped weapon
            const equippedWeapons = attackerActor.items.filter(i => 
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
          } else if (criticalSuccess) {
            const critThreshold = attackerActor.system?.details?.criticalHit;
            if (critThreshold) {
              ui.notifications.info(`Acerto Crítico na re-rolagem! (${newAttackTotal} >= ${critThreshold})`);
            } else {
              ui.notifications.info(`Acerto Crítico na re-rolagem!`);
            }
          }
          
          // Get defender token for flags
          const defenderActor = game.actors.get(actorId);
          const defenderToken = game.scenes.current?.tokens.find(t => t.actorId === actorId);

          // Create chat message using custom template
          await ChatMessageHelper.createRollMessage({
            actor: attackerActor,
            roll: roll,
            label: 'PRECISÃO',
            rollType: rollType,
            rollDescription: rollDescription,
            rollMode: game.settings.get('core', 'rollMode'),
            flags: {
              cardigan: {
                criticalSuccess: criticalSuccess,
                criticalFailure: criticalFailure,
                attackTargets: {
                  targets: [{ tokenId: defenderToken?.id, actorId: actorId }],
                  damage: attackDamage,
                  attackerId: attackerActor.id,
                  attackerCriticalHit: criticalSuccess,
                  isReroll: true,
                  dialogId: dialogId,
                  oldDialogId: dialogId,
                  attackerName: attackerName,
                  defenderName: defenderName,
                  attackerOwnerId: attackerOwnerId,
                  armor: armor,
                  currentHP: currentHP,
                  maxHP: maxHP
                }
              }
            }
          });
          
          // Keep dialog open
          return false;
        }
      },
      {
        action: "hit",
        icon: "fa-solid fa-check-circle",
        label: "Aplicar",
        callback: async (event, button) => {
          // Get current damage value from input
          const dialogElement = button.closest('.dialog-content') || button.closest('form');
          const damageTakenInput = dialogElement?.querySelector('.damage-taken-input');
          const ignoreArmorInput = dialogElement?.querySelector('.ignore-armor-input');
          
          const rawDamage = parseInt(damageTakenInput?.value) || attackDamage;
          // Use data-ignore-all if checkbox is checked, otherwise use input value
          const ignoreArmor = ignoreArmorInput?.dataset.ignoreAll 
            ? parseInt(ignoreArmorInput.dataset.ignoreAll) 
            : (parseInt(ignoreArmorInput?.value) || 0);
          
          // Get defender actor
          const defenderActor = game.actors.get(actorId);
          
          // Check if defender has Envenenado effect and add +5 poison damage
          // In Cardigan, effects are stored as items of type 'efeito', not ActiveEffects
          let poisonDamage = 0;
          if (defenderActor) {
            const envenenadoItem = defenderActor.items.find(item => 
              item.type === 'efeito' && (item.name === "Envenenado" || item.name.toLowerCase().includes('envenenado'))
            );
            
            if (envenenadoItem) {
              poisonDamage = 5;
              // Mark that poison damage was dealt
              await envenenadoItem.setFlag('cardigan', 'poisonDamageDealt', true);
            }
          }
          
          // Calculate effective armor and final damage
          // Poison damage ignores armor, normal damage is reduced by armor
          const effectiveArmor = Math.max(0, armor - ignoreArmor);
          const damageAfterArmor = Math.max(0, rawDamage - effectiveArmor);
          const finalDamage = damageAfterArmor + poisonDamage;
          
          // Calculate new HP
          const newHP = Math.max(0, currentHP - finalDamage);
          
          // Reduce durability of selected armors
          if (defenderActor && selectedArmorIds.length > 0) {
            for (const armorId of selectedArmorIds) {
              const armor = defenderActor.items.get(armorId);
              if (armor && armor.type === 'armadura') {
                const currentDurability = armor.system.durability?.current ?? 0;
                if (currentDurability > 0) {
                  const newDurability = Math.max(0, currentDurability - 1);
                  await armor.update({
                    'system.durability.current': newDurability
                  });
                  
                  // Send durability notification via socket to defender only
                  const durabilityNotificationData = {
                    actorId: actorId,
                    armorName: armor.name,
                    isBroken: newDurability === 0,
                    currentDurability: currentDurability,
                    newDurability: newDurability
                  };
                  
                  game.socket.emit("system.cardigan", {
                    action: "notifyArmorDurability",
                    payload: durabilityNotificationData
                  });
                }
              }
            }
          }
          
          // Send damage application via socket (so the actor's owner applies it)
          game.socket.emit("system.cardigan", {
            action: "applyDamage",
            payload: {
              actorId: actorId,
              newHP: newHP
            }
          });
          
          // Also apply locally if current user owns the actor or is GM
          const actor = game.actors.get(actorId);
          if (actor && (actor.isOwner || game.user.isGM)) {
            await actor.update({ 'system.health.value': newHP });
          }
          
          // Create notification message for the character owner
          const notificationData = {
            actorId: actorId,
            characterName: defenderName,
            finalDamage: finalDamage,
            newHP: newHP,
            maxHP: maxHP
          };
          
          // Send notification via socket to all users
          game.socket.emit("system.cardigan", {
            action: "notifyDamage",
            payload: notificationData
          });
          
          // Also show locally
          showDamageNotification(notificationData);
          
          // Apply bleeding effect if weapon has "wound" property and attacker scored critical hit
          if (attackerCriticalHit && weaponProperties && weaponProperties.includes("wound")) {
            console.log('[FERIR] Player Dialog - Conditions met: critical hit + ferir property');
            const defenderActor = game.actors.get(actorId);
            if (defenderActor) {
              await Ferir.applyBleedingEffect(defenderActor, weaponName || "arma com ferir");
            }
          }
          
          // Apply weakened effect if weapon has "pierce" property and attacker scored critical hit
          if (attackerCriticalHit && weaponProperties && weaponProperties.includes("pierce")) {
            const defenderActor = game.actors.get(actorId);
            if (defenderActor) {
              await Traspassar.applyWeakenedEffect(defenderActor, weaponName || "arma com traspassar");
            }
          }
          
          // Apply prone effect if weapon has "blunt" property and attacker scored critical hit
          if (attackerCriticalHit && weaponProperties && weaponProperties.includes("blunt")) {
            const defenderActor = game.actors.get(actorId);
            if (defenderActor) {
              await Contundente.applyProneEffect(defenderActor, weaponName || "arma contundente");
            }
          }
          
          // Apply burning effect if weapon has "ignite" property and attacker scored critical hit
          if (attackerCriticalHit && weaponProperties && weaponProperties.includes("ignite")) {
            const defenderActor = game.actors.get(actorId);
            if (defenderActor) {
              await Incendiar.applyBurningEffect(defenderActor, weaponName || "arma incendiária");
            }
          }
          
          // Apply shocked effect if weapon has "electrify" property and attacker scored critical hit
          if (attackerCriticalHit && weaponProperties && weaponProperties.includes("electrify")) {
            const defenderActor = game.actors.get(actorId);
            if (defenderActor) {
              await Eletrocutar.applyShockedEffect(defenderActor, weaponName || "arma elétrica");
            }
          }
          
          // Apply fracture if weapon has "impact" property and attacker scored critical hit
          if (attackerCriticalHit && weaponProperties && weaponProperties.includes("impact")) {
            const defenderActor = game.actors.get(actorId);
            if (defenderActor) {
              await Impacto.applyFractureEffect(defenderActor, weaponName || "arma de impacto");
            }
          }
          
          // Create detailed chat message
          // Check if defender is GM-controlled (no player owner) to simplify message
          const isGMControlled = defenderActor && !defenderActor.hasPlayerOwner;
          
          let damageDetails;
          if (isGMControlled) {
            // Simplified message for GM-controlled actors - only show raw damage
            damageDetails = `💥 Dano: ${rawDamage}${poisonDamage > 0 ? ` | 🧪 Veneno: +${poisonDamage}` : ''}`;
          } else {
            // Detailed message for player-owned characters - show armor calculations
            damageDetails = `💥 Dano Bruto: ${rawDamage}${poisonDamage > 0 ? ` | 🧪 Veneno: +${poisonDamage}` : ''} | 🛡️ Armor: ${armor}${ignoreArmor > 0 ? ` | 🚫 Ignorado: ${ignoreArmor} | 🛡️ Efetivo: ${effectiveArmor}` : ''} | 💔 Dano Final: ${finalDamage}`;
          }
          
          const messageContent = `
            <div style="text-align: center; padding: 8px; background: rgba(76, 175, 80, 0.1); border: 2px solid #4CAF50; border-radius: 4px;">
              <h3 style="margin: 0 0 4px 0; color: #4CAF50;">
                <i class="fas fa-bullseye"></i> Acertou!
              </h3>
              <p style="margin: 0;"><strong>${defenderName}</strong> foi atingido pelo ataque!</p>
              <p style="margin: 4px 0 0 0; font-size: 0.9em;">
                ${damageDetails}
              </p>
            </div>
          `;
          await ChatMessage.create({
            content: messageContent,
            speaker: { alias: "Sistema" }
          });
        }
      }
    ],
    position: {
      width: 450,
      height: "auto"
    },
    classes: ['cardigan-attack-dialog', success ? 'success' : 'failure']
  });
  
  // Store dialog reference in global Map
  activeAttackDialogs.set(dialogId, {
    dialog: dialog,
    attackTotal: attackTotal,
    evasionTotal: evasionTotal,
    attackerName: attackerName,
    defenderName: defenderName
  });
  
  // Wait for dialog to render, then attach event listeners
  dialog.addEventListener('render', () => {
    updateDamageCalculations(dialog.element);
    
    // Add armor selection button listener
    const armorSelectBtn = dialog.element.querySelector('.select-armor-durability-btn');
    const selectedArmorsDisplay = dialog.element.querySelector('.selected-armors-display');
    
    if (armorSelectBtn) {
      armorSelectBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const defenderId = armorSelectBtn.dataset.defenderId;
        const defenderActor = game.actors.get(defenderId);
        
        if (!defenderActor) {
          ui.notifications.error("Defensor não encontrado.");
          return;
        }
        
        // Get equipped armors with durability > 0
        const equippedArmors = defenderActor.items.filter(i => 
          i.type === 'armadura' && 
          i.system.equipped === true &&
          (i.system.durability?.current ?? 0) > 0
        );
        
        if (equippedArmors.length === 0) {
          ui.notifications.warn("O defensor não possui armaduras equipadas com durabilidade.");
          return;
        }
        
        // Show armor selection dialog
        const selected = await showArmorDurabilityDialog(equippedArmors, selectedArmorIds);
        selectedArmorIds = selected;
        
        // Update display
        if (selectedArmorIds.length > 0) {
          const selectedNames = selectedArmorIds
            .map(id => defenderActor.items.get(id)?.name)
            .filter(name => name)
            .join(', ');
          selectedArmorsDisplay.innerHTML = `<strong>${selectedArmorIds.length}</strong> selecionada(s): ${selectedNames}`;
        } else {
          selectedArmorsDisplay.innerHTML = '<em>Nenhuma armadura selecionada</em>';
        }
      });
    }
  });
  
  // Remove from Map when dialog closes
  dialog.addEventListener('close', () => {
    activeAttackDialogs.delete(dialogId);
  });
  
  dialog.render(true);
}

/**
 * Show armor durability selection dialog
 * @param {Array} armors - Array of equipped armor items
 * @param {Array} previouslySelected - Previously selected armor IDs
 * @returns {Promise<Array>} Array of selected armor IDs
 */
export async function showArmorDurabilityDialog(armors, previouslySelected = []) {
  return new Promise(async (resolve) => {
    // Map armor types to localization keys
    const armorTypeKeys = {
      'cabeca': 'CARDIGAN.ArmorType.Cabeca',
      'acessorios': 'CARDIGAN.ArmorType.Acessorios',
      'torso': 'CARDIGAN.ArmorType.Torso',
      'bracos': 'CARDIGAN.ArmorType.Bracos',
      'pernas': 'CARDIGAN.ArmorType.Pernas',
      'pes': 'CARDIGAN.ArmorType.Pes'
    };
    
    // Prepare armor data for template
    const armorData = armors.map(armor => {
      const armorTypeKey = armor.system.armorType || 'torso';
      return {
        id: armor.id,
        name: armor.name,
        armorType: armorTypeKeys[armorTypeKey] || 'CARDIGAN.ArmorType.Torso',
        isSelected: previouslySelected.includes(armor.id)
      };
    });
    
    // Render template
    const template = await foundry.applications.handlebars.getTemplate(
      'systems/cardigan/templates/dialogs/armor-durability-selection.hbs'
    );
    const content = template({ armors: armorData });
    
    const dialog = new foundry.applications.api.DialogV2({
      window: {
        title: "🛡️ Selecionar Armaduras para Danificar",
        icon: "fa-solid fa-shield-halved"
      },
      content: content,
      buttons: [
        {
          action: "confirm",
          icon: "fa-solid fa-check",
          label: "Confirmar",
          default: true,
          callback: (event, button) => {
            const dialogElement = button.closest('.dialog-content') || button.closest('form');
            const checkboxes = dialogElement?.querySelectorAll('.armor-checkbox:checked');
            const selected = Array.from(checkboxes || []).map(cb => cb.dataset.armorId);
            resolve(selected);
          }
        },
        {
          action: "cancel",
          icon: "fa-solid fa-times",
          label: "Cancelar",
          callback: () => {
            resolve(previouslySelected);
          }
        }
      ],
      position: {
        width: 500,
        height: "auto"
      },
      classes: ['armor-durability-selection-dialog']
    });
    
    dialog.render(true);
  });
}

/**
 * Create GM-only evasion notification dialog
 * @param {Object} data - Evasion data
 */
export async function createGMEvasionNotification(data) {
  const { actorId, playerName, characterName, attackerName, attackerId, evasionTotal, attackTotal, success, 
          currentHP, maxHP, armor, attackDamage, damageTaken, remainingHP, defenderCriticalFailure, attackerCriticalHit, weaponName, weaponProperties } = data;
  
  console.log('[CARDIGAN GM DIALOG] Received data:', { attackDamage, attackerCriticalHit, defenderCriticalFailure });
  
  // Check if there's any critical (attacker critical hit OR defender critical failure)
  const hasCritical = attackerCriticalHit || defenderCriticalFailure;
  
  // Apply 2x damage if there's any critical (doesn't stack to 4x)
  const effectiveDamage = hasCritical ? attackDamage * 2 : attackDamage;
  
  console.log('[CARDIGAN GM DIALOG] Damage calculation:', { attackDamage, hasCritical, effectiveDamage });
  
  // Recalculate remaining HP with effective damage
  const effectiveRemainingHP = success ? currentHP : Math.max(0, currentHP - effectiveDamage);
  
  // Helper function to roll dice for ignore armor
  const rollIgnoreArmorDice = async (ignoreArmorInput, attackerName) => {
    const diceDialog = new foundry.applications.api.DialogV2({
      window: {
        title: "🎲 Rolar para Ignore Armor",
        icon: "fa-solid fa-dice"
      },
      content: `
        <div style="text-align: center; padding: 20px;">
          <div style="margin-bottom: 16px;">
            <label for="dice-quantity-gm" style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: bold;">Quantidade de dados:</label>
            <input 
              type="number" 
              id="dice-quantity-gm" 
              class="dice-quantity-input" 
              value="1" 
              min="1" 
              max="20" 
              style="width: 80px; padding: 8px; font-size: 16px; text-align: center; border: 2px solid #ccc; border-radius: 4px;"
            />
          </div>
          <p style="margin-bottom: 16px; font-size: 14px;">Escolha o tipo de dado:</p>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button type="button" class="dice-option" data-dice="d4" style="padding: 10px; font-size: 16px; cursor: pointer;">🎲 d4</button>
            <button type="button" class="dice-option" data-dice="d6" style="padding: 10px; font-size: 16px; cursor: pointer;">🎲 d6</button>
            <button type="button" class="dice-option" data-dice="d8" style="padding: 10px; font-size: 16px; cursor: pointer;">🎲 d8</button>
            <button type="button" class="dice-option" data-dice="d12" style="padding: 10px; font-size: 16px; cursor: pointer;">🎲 d12</button>
            <button type="button" class="dice-option" data-dice="d20" style="padding: 10px; font-size: 16px; cursor: pointer;">🎲 d20</button>
          </div>
        </div>
      `,
      buttons: [
        {
          action: "cancel",
          icon: "fa-solid fa-times",
          label: "Cancelar"
        }
      ],
      position: {
        width: 320,
        height: "auto"
      }
    });
    
    // Add click handlers to dice options
    diceDialog.addEventListener('render', () => {
      const diceQuantityInput = diceDialog.element.querySelector('.dice-quantity-input');
      const diceOptions = diceDialog.element.querySelectorAll('.dice-option');
      
      diceOptions.forEach(option => {
        option.addEventListener('click', async (e) => {
          const diceType = e.target.dataset.dice;
          const quantity = parseInt(diceQuantityInput?.value) || 1;
          const diceFormula = `${quantity}${diceType}`;
          
          // Roll the dice
          const roll = await new Roll(diceFormula).evaluate();
          const result = roll.total;
          
          // Wait for Dice So Nice animation if available
          if (game.dice3d) {
            await game.dice3d.showForRoll(roll);
          }
          
          // Show result in chat
          const chatContent = `
            <div style="text-align: center; padding: 8px; background: rgba(255, 193, 7, 0.1); border: 2px solid #ffc107; border-radius: 4px;">
              <h3 style="margin: 0 0 4px 0;">
                <i class="fas fa-dice"></i> Ignore Armor Roll
              </h3>
              <p style="margin: 0;"><strong>${attackerName}</strong> rolou <strong>${diceFormula}</strong> para ignorar armadura!</p>
              <p style="margin: 4px 0 0 0; font-size: 1.2em; font-weight: bold;">
                Resultado: ${result}
              </p>
            </div>
          `;
          
          await ChatMessage.create({
            content: chatContent,
            speaker: { alias: "Sistema" },
            sound: CONFIG.sounds.dice
          });
          
          // Update the ignore armor input
          if (ignoreArmorInput) {
            ignoreArmorInput.value = result;
          }
          
          // Close the dialog
          diceDialog.close();
        });
      });
    });
    
    await diceDialog.render(true);
  };
  
  // Helper function to update remaining HP based on damage input
  const updateRemainingHP = (dialogElement) => {
    const damageInput = dialogElement.querySelector('.damage-taken-input');
    const remainingHPElement = dialogElement.querySelector('.remaining-hp');
    const halfDamageBtn = dialogElement.querySelector('.half-damage-btn');
    
    if (damageInput && remainingHPElement) {
      damageInput.addEventListener('input', (e) => {
        const damage = Math.max(0, parseInt(e.target.value) || 0);
        const newRemainingHP = Math.max(0, currentHP - damage);
        const percentage = newRemainingHP / maxHP;
        
        // Update value
        remainingHPElement.textContent = `${newRemainingHP} / ${maxHP}`;
        
        // Update color class
        remainingHPElement.classList.remove('success', 'warning', 'danger');
        if (percentage >= 0.5) {
          remainingHPElement.classList.add('success');
        } else if (percentage >= 0.25) {
          remainingHPElement.classList.add('warning');
        } else {
          remainingHPElement.classList.add('danger');
        }
      });
      
      // Add half damage button functionality
      if (halfDamageBtn) {
        halfDamageBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const currentDamage = parseInt(damageInput.value) || 0;
          const halfDamage = Math.floor(currentDamage / 2);
          damageInput.value = halfDamage;
          
          // Trigger input event to update HP display
          damageInput.dispatchEvent(new Event('input'));
        });
      }
    }
    
    // Add ignore armor roll button functionality
    const ignoreArmorInput = dialogElement.querySelector('.ignore-armor-input');
    const rollIgnoreArmorBtn = dialogElement.querySelector('.roll-ignore-armor-btn');
    const ignoreAllArmorCheckbox = dialogElement.querySelector('.ignore-all-armor-checkbox');
    
    if (rollIgnoreArmorBtn && ignoreArmorInput) {
      rollIgnoreArmorBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await rollIgnoreArmorDice(ignoreArmorInput, attackerName);
      });
    }
    
    // Handle Ignore All Armor checkbox
    if (ignoreAllArmorCheckbox && ignoreArmorInput) {
      ignoreAllArmorCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          // Checkbox marcada: desabilita input e mantém valor 0 visível
          ignoreArmorInput.disabled = true;
          ignoreArmorInput.value = 0;
          // Armazena o valor real da armadura no atributo data
          const armorValue = ignoreArmorInput.dataset.armor || 0;
          ignoreArmorInput.dataset.ignoreAll = armorValue;
        } else {
          // Checkbox desmarcada: habilita input e remove data-ignore-all
          ignoreArmorInput.disabled = false;
          delete ignoreArmorInput.dataset.ignoreAll;
        }
      });
    }
  };
  
  // Render template using V13+ namespaced API
  const template = await foundry.applications.handlebars.getTemplate(
    'systems/cardigan/templates/dialogs/gm-dialog-combat.hbs'
  );
  const content = template({
    playerName,
    characterName,
    defenderId: actorId,
    evasionTotal,
    attackTotal,
    success,
    currentHP,
    maxHP,
    armor,
    attackDamage: effectiveDamage,
    baseDamage: attackDamage,
    damageTaken: hasCritical ? effectiveDamage : damageTaken,
    remainingHP: effectiveRemainingHP,
    hasCritical,
    attackerCriticalHit,
    defenderCriticalFailure
  });
  
  // Use DialogV2 for modern API
  const dialog = new foundry.applications.api.DialogV2({
    window: {
      title: `Resultado do Combate (GM) - ${characterName}`,
      icon: "fa-solid fa-shield"
    },
    content: content,
    buttons: [
      {
        action: "hit",
        icon: "fa-solid fa-check-circle",
        label: "Acertou",
        callback: async (event, button) => {
          // Get current damage value from input (button is the clicked element)
          const dialogElement = button.closest('.dialog-content') || button.closest('form');
          const damageInput = dialogElement?.querySelector('.damage-taken-input');
          const ignoreArmorInput = dialogElement?.querySelector('.ignore-armor-input');
          
          const rawDamage = parseInt(damageInput?.value) || 0;
          // Use data-ignore-all if checkbox is checked, otherwise use input value
          const ignoreArmor = ignoreArmorInput?.dataset.ignoreAll 
            ? parseInt(ignoreArmorInput.dataset.ignoreAll) 
            : (parseInt(ignoreArmorInput?.value) || 0);
          
          // Get actor
          const actor = game.actors.get(actorId);
          
          // Check if defender has Envenenado effect and add +5 poison damage
          // In Cardigan, effects are stored as items of type 'efeito', not ActiveEffects
          let poisonDamage = 0;
          if (actor) {
            const envenenadoItem = actor.items.find(item => 
              item.type === 'efeito' && (item.name === "Envenenado" || item.name.toLowerCase().includes('envenenado'))
            );
            
            if (envenenadoItem) {
              poisonDamage = 5;
              // Mark that poison damage was dealt
              await envenenadoItem.setFlag('cardigan', 'poisonDamageDealt', true);
            }
          }
          
          // Calculate effective armor (armor - ignore armor)
          const effectiveArmor = Math.max(0, armor - ignoreArmor);
          
          // Apply armor reduction to normal damage only
          // Poison damage ignores armor completely
          const damageAfterArmor = Math.max(0, rawDamage - effectiveArmor);
          const finalDamage = damageAfterArmor + poisonDamage;
          if (actor) {
            const newHP = Math.max(0, currentHP - finalDamage);
            await actor.update({ 'system.health.value': newHP });
            
            // Reduce durability of selected armors
            if (selectedArmorIds.length > 0) {
              for (const armorId of selectedArmorIds) {
                const armor = actor.items.get(armorId);
                if (armor && armor.type === 'armadura') {
                  const currentDurability = armor.system.durability?.current ?? 0;
                  if (currentDurability > 0) {
                    const newDurability = Math.max(0, currentDurability - 1);
                    await armor.update({
                      'system.durability.current': newDurability
                    });
                    
                    // Send durability notification via socket to defender only
                    const durabilityNotificationData = {
                      actorId: actorId,
                      armorName: armor.name,
                      isBroken: newDurability === 0,
                      currentDurability: currentDurability,
                      newDurability: newDurability
                    };
                    
                    game.socket.emit("system.cardigan", {
                      action: "notifyArmorDurability",
                      payload: durabilityNotificationData
                    });
                  }
                }
              }
            }
            
            // Create notification message for the character owner
            const notificationData = {
              actorId: actorId,
              characterName: characterName,
              finalDamage: finalDamage,
              newHP: newHP,
              maxHP: maxHP
            };
            
            // Send notification via socket to all users
            game.socket.emit("system.cardigan", {
              action: "notifyDamage",
              payload: notificationData
            });
            
            // Also show locally
            showDamageNotification(notificationData);
            
            // Apply bleeding effect if weapon has "wound" property and attacker scored critical hit
            if (attackerCriticalHit && weaponProperties && weaponProperties.includes("wound")) {
              await Ferir.applyBleedingEffect(actor, weaponName || "arma com ferir");
            }
            
            // Apply weakened effect if weapon has "pierce" property and attacker scored critical hit
            if (attackerCriticalHit && weaponProperties && weaponProperties.includes("pierce")) {
              await Traspassar.applyWeakenedEffect(actor, weaponName || "arma com traspassar");
            }
            
            // Apply prone effect if weapon has "blunt" property and attacker scored critical hit
            if (attackerCriticalHit && weaponProperties && weaponProperties.includes("blunt")) {
              await Contundente.applyProneEffect(actor, weaponName || "arma contundente");
            }
            
            // Apply burning effect if weapon has "ignite" property and attacker scored critical hit
            if (attackerCriticalHit && weaponProperties && weaponProperties.includes("ignite")) {
              await Incendiar.applyBurningEffect(actor, weaponName || "arma incendiária");
            }
            
            // Apply shocked effect if weapon has "electrify" property and attacker scored critical hit
            if (attackerCriticalHit && weaponProperties && weaponProperties.includes("electrify")) {
              await Eletrocutar.applyShockedEffect(actor, weaponName || "arma elétrica");
            }
            
            // Apply fracture if weapon has "impact" property and attacker scored critical hit
            if (attackerCriticalHit && weaponProperties && weaponProperties.includes("impact")) {
              await Impacto.applyFractureEffect(actor, weaponName || "arma de impacto");
            }
            
            // Create detailed chat message
            // Check if defender is GM-controlled (no player owner) to simplify message
            const isGMControlled = actor && !actor.hasPlayerOwner;
            
            let damageDetails;
            if (isGMControlled) {
              // Simplified message for GM-controlled actors - only show raw damage
              damageDetails = `💥 Dano: ${rawDamage}${poisonDamage > 0 ? ` | 🧪 Veneno: +${poisonDamage}` : ''}`;
            } else {
              // Detailed message for player-owned characters - show armor calculations
              damageDetails = `💥 Dano Bruto: ${rawDamage}${poisonDamage > 0 ? ` | 🧪 Veneno: +${poisonDamage}` : ''} | 🛡️ Armor: ${armor}${ignoreArmor > 0 ? ` | 🚫 Ignorado: ${ignoreArmor} | 🛡️ Efetivo: ${effectiveArmor}` : ''} | 💔 Dano Final: ${finalDamage}`;
            }
            
            const messageContent = `
              <div style="text-align: center; padding: 8px; background: rgba(76, 175, 80, 0.1); border: 2px solid #4CAF50; border-radius: 4px;">
                <h3 style="margin: 0 0 4px 0; color: #4CAF50;">
                  <i class="fas fa-bullseye"></i> Acertou!
                </h3>
                <p style="margin: 0;"><strong>${characterName}</strong> foi atingido pelo ataque!</p>
                <p style="margin: 4px 0 0 0; font-size: 0.9em;">
                  ${damageDetails}
                </p>
              </div>
            `;
            await ChatMessage.create({
              content: messageContent,
              speaker: { alias: "Sistema" }
            });
          }
        }
      },
      {
        action: "miss",
        icon: "fa-solid fa-times-circle",
        label: "Errou",
        callback: async () => {
          const messageContent = `
            <div style="text-align: center; padding: 8px; background: rgba(244, 67, 54, 0.1); border: 2px solid #f44336; border-radius: 4px;">
              <h3 style="margin: 0 0 4px 0; color: #f44336;">
                <i class="fas fa-shield-alt"></i> Errou!
              </h3>
              <p style="margin: 0;"><strong>${characterName}</strong> desviou do ataque!</p>
            </div>
          `;
          await ChatMessage.create({
            content: messageContent,
            speaker: { alias: "Sistema" }
          });
        }
      },
      {
        action: "reroll",
        icon: "fa-solid fa-redo",
        label: "",
        default: false,
        callback: async (event, button) => {
          // First, ask GM to choose between Evasion or Precision using custom dialog
          const rollChoice = await new Promise((resolve) => {
            const dialog = new foundry.applications.api.DialogV2({
              window: {
                title: "Escolha o Tipo de Rolagem"
              },
              content: `
                <div style="text-align: center; padding: 24px;">
                  <div style="margin-bottom: 24px;">
                    <i class="fas fa-dice" style="font-size: 48px; color: #4b4a44;"></i>
                  </div>
                  <h2 style="margin: 0 0 12px 0; color: #f0f0f0; font-size: 18px; font-weight: bold;">O que deseja rolar novamente?</h2>
                  <p style="margin: 0; color: #cccccc; font-size: 14px;">Escolha o atributo para fazer uma nova rolagem</p>
                </div>
              `,
              buttons: [
                {
                  action: "evasion",
                  icon: "fa-solid fa-shield",
                  label: "Evasão",
                  callback: () => resolve("evasion")
                },
                {
                  action: "precision",
                  icon: "fa-solid fa-crosshairs",
                  label: "Precisão",
                  callback: () => resolve("precision")
                }
              ],
              position: {
                width: 400
              },
              close: () => resolve(null)
            });
            dialog.render(true);
          });
          
          if (!rollChoice) return false; // User cancelled
          
          // Import advantage selection dialog
          const { AdvantageSelectionDialog } = await import('../applications/advantage-selection-dialog.mjs');
          const result = await AdvantageSelectionDialog.show({ 
            hideHandSelection: rollChoice === "evasion" 
          });
          if (!result) return false; // User cancelled
          
          const { rollType, manualModifier = 0 } = result;
          
          // Determine which actor to use based on roll choice
          let rollingActorId, rollingActorName;
          if (rollChoice === "evasion") {
            // Rolling evasion = defender (characterName/actorId)
            rollingActorId = actorId;
            rollingActorName = characterName;
          } else {
            // Rolling precision = attacker (use attackerId from data)
            if (!attackerId) {
              ui.notifications.error("ID do atacante não encontrado.");
              return false;
            }
            rollingActorId = attackerId;
            rollingActorName = attackerName;
          }
          
          // Get the actor
          const actor = game.actors.get(rollingActorId);
          if (!actor) {
            ui.notifications.error("Ator não encontrado.");
            return false;
          }
          
          // Get roll data
          const rollData = actor.getRollData();
          
          // Determine formula based on roll type and choice
          const attribute = rollChoice === "evasion" ? "@abilities.evasion.total" : "@abilities.accuracy.total";
          const attributeName = rollChoice === "evasion" ? "Evasão" : "Precisão";
          const formula = buildRollFormula(rollType, attribute, manualModifier);
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
          
          // Roll
          const roll = new Roll(formula, rollData);
          await roll.evaluate();
          const newTotal = roll.total;
          
          // Detect critical results using actor's thresholds
          const { CardiganSystemActorSheet } = await import('../sheets/actor-sheet.mjs');
          const criticalType = rollChoice === "evasion" ? 'evasion' : 'accuracy';
          const criticalFlags = CardiganSystemActorSheet._detectCriticalResults(roll, actor, criticalType);
          const criticalSuccess = criticalFlags?.cardigan?.criticalHit || false;
          const criticalFailure = criticalFlags?.cardigan?.criticalFailure || false;
          
          // Handle critical failure for Precision rerolls - reduce durability of equipped weapon
          if (criticalFailure && rollChoice === "precision") {
            // Find equipped weapon using the correct structure
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
                  `Erro Crítico na re-rolagem de Precisão! ${weapon.name} perdeu durabilidade (${currentDurability} → ${newDurability})`
                );
              } else {
                ui.notifications.warn(`Erro Crítico na re-rolagem de Precisão!`);
              }
            }
          } else if (criticalSuccess && rollChoice === "precision") {
            const critThreshold = actor.system?.details?.criticalHit;
            if (critThreshold) {
              ui.notifications.info(`Acerto Crítico na re-rolagem de Precisão! (${newTotal} >= ${critThreshold})`);
            } else {
              ui.notifications.info(`Acerto Crítico na re-rolagem de Precisão!`);
            }
          }
          
          // Create message flags
          const messageFlags = {
            cardigan: {
              criticalSuccess: criticalSuccess,
              criticalFailure: criticalFailure
            }
          };
          
          // If this is a Precision reroll, add attackTargets flags so the evasion button appears
          if (rollChoice === "precision") {
            // Get defender data from the original notification
            const defenderActor = game.actors.get(actorId);
            const defenderToken = game.scenes.current?.tokens.find(t => t.actorId === actorId);
            
            if (defenderActor && defenderToken) {
              messageFlags.cardigan.attackTargets = {
                targets: [{
                  tokenId: defenderToken.id,
                  actorId: defenderActor.id,
                  name: defenderActor.name
                }],
                attackerId: rollingActorId,
                attackerName: rollingActorName,
                weaponName: "Re-rolagem de Precisão",
                damage: attackDamage,  // Preserve original damage for critical calculation
                isReroll: true,  // Mark as reroll to trigger GM notification
                defenderName: defenderActor.name,
                attackerCriticalHit: criticalSuccess  // Preserve new precision critical
              };
            }
          }
          
          // If this is an Evasion reroll, add precisionTarget flags so the precision button appears
          if (rollChoice === "evasion") {
            // Get attacker data from the original notification
            const attackerActor = game.actors.find(a => a.name === attackerName);
            const attackerToken = game.scenes.current?.tokens.find(t => t.actorId === attackerActor?.id);
            
            if (attackerActor && attackerToken) {
              messageFlags.cardigan.precisionTarget = {
                tokenId: attackerToken.id,
                actorId: attackerActor.id,
                name: attackerActor.name,
                evasionTotal: newTotal,  // Store the new evasion roll total
                attackDamage: attackDamage,  // Preserve damage for precision reroll
                attackerCriticalHit: attackerCriticalHit,  // Preserve attacker's critical
                defenderCriticalFailure: criticalFailure  // Store defender's new critical result
              };
            }
          }
          
          // Create chat message using custom template
          await ChatMessageHelper.createRollMessage({
            actor: actor,
            roll: roll,
            label: attributeName.toUpperCase(),
            rollType: rollType,
            rollDescription: rollDescription,
            rollMode: "gmroll",
            flags: messageFlags
          });
          
          // Keep dialog open
          return false;
        }
      }
    ],
    position: {
      width: 450,
      height: "auto"
    },
    classes: ['cardigan-evasion-dialog']
  });
  
  // Store selected armor IDs for durability reduction
  let selectedArmorIds = [];
  
  // Wait for dialog to render, then attach event listeners
  dialog.addEventListener('render', () => {
    updateRemainingHP(dialog.element);
    
    // Add armor durability selection button handler
    const armorSelectBtn = dialog.element.querySelector('.select-armor-durability-btn');
    if (armorSelectBtn) {
      armorSelectBtn.addEventListener('click', async () => {
        const defenderId = armorSelectBtn.dataset.defenderId;
        const defenderActor = game.actors.get(defenderId);
        
        if (!defenderActor) {
          ui.notifications.warn("Defensor não encontrado!");
          return;
        }
        
        // Get equipped armors with durability > 0
        const equippedArmors = defenderActor.items.filter(item => 
          item.type === 'armadura' && 
          item.system.equipped && 
          (item.system.durability?.current ?? 0) > 0
        );
        
        if (equippedArmors.length === 0) {
          ui.notifications.info("Nenhuma armadura equipada disponível para danificar!");
          return;
        }
        
        // Show armor selection dialog
        selectedArmorIds = await showArmorDurabilityDialog(equippedArmors, selectedArmorIds);
        
        // Update display
        const displaySpan = dialog.element.querySelector('.selected-armors-display');
        if (displaySpan) {
          if (selectedArmorIds.length === 0) {
            displaySpan.textContent = '';
          } else {
            const selectedNames = selectedArmorIds.map(id => {
              const armor = equippedArmors.find(a => a.id === id);
              return armor ? armor.name : '';
            }).filter(n => n).join(', ');
            displaySpan.textContent = `(${selectedArmorIds.length}): ${selectedNames}`;
            displaySpan.style.color = '#4CAF50';
            displaySpan.style.fontSize = '0.9em';
            displaySpan.style.marginLeft = '8px';
          }
        }
      });
    }
    
    // Add custom tooltip to reroll button
    const rerollButton = dialog.element.querySelector('button[data-action="reroll"]');
    if (rerollButton) {
      rerollButton.setAttribute('data-custom-tooltip', 'Rolar Novamente');
      rerollButton.classList.add('icon-only-button');
      
      // Create external tooltip element
      let tooltipElement = null;
      
      rerollButton.addEventListener('mouseenter', () => {
        // Create tooltip
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'cardigan-external-tooltip';
        tooltipElement.textContent = 'Rolar Novamente';
        document.body.appendChild(tooltipElement);
        
        // Position tooltip
        const rect = rerollButton.getBoundingClientRect();
        tooltipElement.style.left = `${rect.left + rect.width / 2}px`;
        tooltipElement.style.top = `${rect.top - 8}px`;
        tooltipElement.style.transform = 'translate(-50%, -100%)';
        
        // Show tooltip
        requestAnimationFrame(() => {
          if (tooltipElement) {
            tooltipElement.classList.add('visible');
          }
        });
      });
      
      rerollButton.addEventListener('mouseleave', () => {
        if (tooltipElement) {
          tooltipElement.classList.remove('visible');
          setTimeout(() => {
            tooltipElement?.remove();
            tooltipElement = null;
          }, 200);
        }
      });
    }
  });
  
  dialog.render(true);
}