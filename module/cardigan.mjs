// Import document classes.
import { CardiganSystemActor } from './documents/actor.mjs';
import { CardiganSystemItem } from './documents/item.mjs';
// Import sheet classes.
import { CardiganSystemActorSheet } from './sheets/actor-sheet.mjs';
import { CardiganSystemItemSheet } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { CARDIGAN, registerHandlebarsHelpers } from './helpers/config.mjs';
import CardiganTooltips from './helpers/tooltips.mjs';
// Import DataModel classes
import * as models from './data/_module.mjs';
// Import Skills System
import { initializeSkillsSystem, getSkillManager } from './skills/index.mjs';
// Import Effects System
import { initializeEffects } from './effects/index.mjs';

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

// Add key classes to the global scope so they can be more easily used
// by downstream developers
globalThis.cardigan = {
  documents: {
    CardiganSystemActor,
    CardiganSystemItem,
  },
  applications: {
    CardiganSystemActorSheet,
    CardiganSystemItemSheet,
  },
  utils: {
    rollItemMacro,
  },
  models,
};

Hooks.once('init', function () {
  // Assign to game object
  game.cardigan = globalThis.cardigan;
  
  // Add custom constants for configuration.
  CONFIG.CARDIGAN = CARDIGAN;

  // Register Handlebars helpers
  registerHandlebarsHelpers();

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: '1d20 + @dexterity.value',
    decimals: 2,
  };

  // Define custom Document and DataModel classes
  CONFIG.Actor.documentClass = CardiganSystemActor;

  // Note that you don't need to declare a DataModel
  // for the base actor/item classes - they are included
  // with the Character/NPC as part of super.defineSchema()
  CONFIG.Actor.dataModels = {
    character: models.CardiganSystemCharacter,
    npc: models.CardiganSystemNPC,
  };
  CONFIG.Item.documentClass = CardiganSystemItem;
  CONFIG.Item.dataModels = {
    "item-comum": models.CardiganSystemItemComum,
    "item-municao": models.CardiganSystemItemMunicao,
    "item-consumivel": models.CardiganSystemItemConsumivel,
    "item-ingredient": models.CardiganSystemItemIngredient,
    "item-recipe": models.CardiganSystemItemRecipe,
    feature: models.CardiganSystemFeature,
    race: models.CardiganSystemRace,
    skill: models.CardiganSystemSkill,
    spell: models.CardiganSystemSpell,
    efeito: models.CardiganSystemEfeito,
    arma: models.CardiganSystemArma,
    armadura: models.CardiganSystemArmadura,
  };

  // Debug logging
  
  // Verify document types (using modern documentTypes instead of deprecated template)
  
  // Verify that CONFIG recognizes the backpack and skill types

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;

    // Register sheet application classes
  foundry.documents.collections.Actors.unregisterSheet('core', foundry.appv1.sheets.ActorSheet);
  foundry.documents.collections.Actors.registerSheet('cardigan', CardiganSystemActorSheet, {
    makeDefault: true,
    label: 'CARDIGAN.SheetLabels.Actor',
  });
  foundry.documents.collections.Items.unregisterSheet('core', foundry.appv1.sheets.ItemSheet);
  foundry.documents.collections.Items.registerSheet('cardigan', CardiganSystemItemSheet, {
    makeDefault: true,
    label: 'CARDIGAN.SheetLabels.Item',
  });

  // If you need to add Handlebars helpers, here is a useful example:
  Handlebars.registerHelper('concat', function () {
    var outStr = '';
    for (var arg in arguments) {
      if (typeof arguments[arg] != 'object') {
        outStr += arguments[arg];
      }
    }
    return outStr;
  });

  Handlebars.registerHelper('toLowerCase', function (str) {
    return str.toLowerCase();
  });

  // Socket listener para notificações de evasão e dano (registrado no init)
  game.socket.on("system.cardigan", (data) => {
    if (data.action === "notifyGMEvasion" && game.user.isGM) {
      createGMEvasionNotification(data.payload);
    } else if (data.action === "notifyDamage") {
      showDamageNotification(data.payload);
    }
  });

  // Register helper for "lt" (less than) comparison
  Handlebars.registerHelper('lt', function (a, b) {
    return a < b;
  });

  // Register helper for "selected" attribute
  Handlebars.registerHelper('selected', function (value, expectedValue) {
    return value === expectedValue ? 'selected' : '';
  });

  // Configure tooltips
  game.cardigan.tooltips = new CardiganTooltips();

  // Initialize Skills System
  initializeSkillsSystem().catch(error => {
    console.error('[CARDIGAN] Failed to initialize Skills System:', error);
  });

  // Initialize Effects System
  initializeEffects().catch(error => {
    console.error('[CARDIGAN] Failed to initialize Effects System:', error);
  });
});

/* -------------------------------------------- */
/*  Setup Hook - Text Enrichers                 */
/* -------------------------------------------- */

Hooks.once('setup', () => {
  // Enricher para imagens inline no ProseMirror
  // Uso: ::systems/cardigan/assets/images/exemplo.png::
  CONFIG.TextEditor.enrichers.push({
    pattern: /::([^:]+)::/gim,
    enricher: async (match, options) => {
      const imagePath = match[1].trim();
      
      // Cria elemento img com display inline
      const img = document.createElement("img");
      img.src = imagePath;
      img.style.display = "inline";
      img.style.verticalAlign = "middle";
      img.style.maxHeight = "1.5em"; // Altura padrão do texto
      img.style.maxWidth = "100px";  // Largura máxima razoável
      img.alt = imagePath.split('/').pop(); // Nome do arquivo como alt
      
      return img;
    }
  });
});

/* -------------------------------------------- */
/*  Item Update Hook for Bidirectional Sync    */
/* -------------------------------------------- */

Hooks.on('updateItem', function (item, updates, options, userId) {
  
  // Update actor sheets if item belongs to an actor
  if (item.parent && item.parent.documentName === 'Actor') {
    const actorSheets = Object.values(ui.windows).filter(app => 
      app instanceof CardiganSystemActorSheet && 
      app.document.id === item.parent.id
    );
    
    actorSheets.forEach(sheet => {
      // Force immediate re-render
      sheet.render(false);
    });
  }
  
  // Update item sheets for this specific item - INSTANTANEOUS
  const itemSheets = Object.values(ui.windows).filter(app => 
    app instanceof CardiganSystemItemSheet && 
    app.document.id === item.id
  );
  
  itemSheets.forEach(sheet => {
    // Force immediate re-render with fresh data
    sheet.render(true); // true forces full re-render
  });
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here is a useful example:
Handlebars.registerHelper('toLowerCase', function (str) {
  return str.toLowerCase();
});

// Helper para comparação greater than or equal
Handlebars.registerHelper('gte', function (a, b) {
  return a >= b;
});

// Helper para comparação de igualdade
Handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});

// Helper para selecionar opções em elementos select
Handlebars.registerHelper('selected', function (current, expected) {
  return current === expected ? 'selected' : '';
});

// Helper para marcar checkboxes
Handlebars.registerHelper('checked', function (value) {
  return value ? 'checked' : '';
});

// Helper para adição matemática
Handlebars.registerHelper('add', function (a, b) {
  return (a || 0) + (b || 0);
});

// Helper para verificar se há armas ranged na lista
Handlebars.registerHelper('hasRangedWeapons', function(weapons) {
  if (!weapons || !Array.isArray(weapons)) return false;
  return weapons.some(weapon => weapon.system?.ranged === true);
});

// Helper para calcular espaços ocupados por um item individual
Handlebars.registerHelper('calculateItemSpaces', function(weight, quantity) {
  if (!weight || quantity <= 0) return 0;

  switch (weight) {
    case 'leve':
      // 0 spaces, but +1 space per 10 items
      return Math.floor(quantity / 10);
    
    case 'medio':
      // 1 space each
      return quantity;
    
    case 'pesado':
      // 2 spaces each
      return quantity * 2;
    
    case 'muito-pesado':
      // 4 spaces each
      return quantity * 4;
    
    default:
      return 0;
  }
});

// Helper para abreviar categorias de peso
Handlebars.registerHelper('abbreviateWeight', function(weight) {
  if (!weight) return '';

  switch (weight) {
    case 'leve':
      return 'L';
    case 'medio':
      return 'M';
    case 'pesado':
      return 'P';
    case 'muito-pesado':
      return 'MP';
    default:
      return weight.toUpperCase();
  }
});

// Helper para truncar texto
Handlebars.registerHelper('truncate', function(str, length) {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
});

// Helper para verificar se um array inclui um valor
Handlebars.registerHelper('includes', function(array, value) {
  if (!array || !Array.isArray(array)) return false;
  return array.includes(value);
});

// Helper para formatar skill action types com separador |
Handlebars.registerHelper('formatSkillActionTypes', function(actionTypes) {
  if (!actionTypes || !Array.isArray(actionTypes) || actionTypes.length === 0) {
    return '';
  }
  
  // Se tiver apenas um, retorna sem separador
  if (actionTypes.length === 1) {
    const type = actionTypes[0];
    const localizationKey = CONFIG.CARDIGAN?.skillTypes?.[type] || type;
    return game.i18n.localize(localizationKey);
  }
  
  // Se tiver dois ou mais, junta com " | "
  return actionTypes
    .map(type => {
      const localizationKey = CONFIG.CARDIGAN?.skillTypes?.[type] || type;
      return game.i18n.localize(localizationKey);
    })
    .join(' | ');
});

/**
 * Show damage notification to the actor's owner only
 * @param {Object} data - Damage notification data
 */
function showDamageNotification(data) {
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
 * Create GM-only evasion notification dialog
 * @param {Object} data - Evasion data
 */
async function createGMEvasionNotification(data) {
  const { actorId, playerName, characterName, evasionTotal, attackTotal, success, 
          currentHP, maxHP, armor, attackDamage, damageTaken, remainingHP } = data;
  
  // Helper function to update remaining HP based on damage input
  const updateRemainingHP = (dialogElement) => {
    const damageInput = dialogElement.querySelector('.damage-taken-input');
    const remainingHPElement = dialogElement.querySelector('.remaining-hp');
    
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
    }
  };
  
  // Render template using V13+ namespaced API
  const template = await foundry.applications.handlebars.getTemplate(
    'systems/cardigan/templates/dialogs/evasion-result.hbs'
  );
  const content = template({
    playerName,
    characterName,
    evasionTotal,
    attackTotal,
    success,
    currentHP,
    maxHP,
    armor,
    attackDamage,
    damageTaken,
    remainingHP
  });
  
  // Use DialogV2 for modern API
  const dialog = new foundry.applications.api.DialogV2({
    window: {
      title: `🛡️ Resultado de Evasão - ${characterName}`,
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
          const rawDamage = parseInt(damageInput?.value) || 0;
          
          // Apply armor reduction
          const finalDamage = Math.max(0, rawDamage - armor);
          
          // Get actor and apply damage
          const actor = game.actors.get(actorId);
          if (actor) {
            const newHP = Math.max(0, currentHP - finalDamage);
            await actor.update({ 'system.health.value': newHP });
            
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
            
            // Create detailed chat message
            const messageContent = `
              <div style="text-align: center; padding: 8px; background: rgba(76, 175, 80, 0.1); border: 2px solid #4CAF50; border-radius: 4px;">
                <h3 style="margin: 0 0 4px 0; color: #4CAF50;">
                  <i class="fas fa-bullseye"></i> Acertou!
                </h3>
                <p style="margin: 0;"><strong>${characterName}</strong> foi atingido pelo ataque!</p>
                <p style="margin: 4px 0 0 0; font-size: 0.9em;">
                  💥 Dano Bruto: ${rawDamage} | 🛡️ Armor: ${armor} | 💔 Dano Final: ${finalDamage}
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
        action: "ok",
        icon: "fa-solid fa-check",
        label: "Fechar",
        default: true
      }
    ],
    position: {
      width: 450,
      height: "auto"
    },
    classes: ['cardigan-evasion-dialog']
  });
  
  // Wait for dialog to render, then attach event listener
  dialog.addEventListener('render', () => {
    updateRemainingHP(dialog.element);
  });
  
  dialog.render(true);
}

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => createDocMacro(data, slot));
  
  // Initialize tooltips observer
  game.cardigan.tooltips.observe();
  
  // Hook to color roll totals based on critical success/failure
  Hooks.on('renderChatMessageHTML', (chatMessage, html) => {
    // Only process roll messages with our flags
    const flags = chatMessage.flags?.cardigan;
    if (!flags || (!flags.criticalHit && !flags.criticalFailure && !flags.isCriticalHit && !flags.isCriticalFailure)) return;
    
    // Find the roll total element (html is now HTMLElement, not jQuery)
    const rollTotal = html.querySelector('.dice-total');
    if (!rollTotal) return;
    
    // Apply colors based on critical type (checking both old and new flag formats)
    if (flags.criticalHit || flags.isCriticalHit) {
      rollTotal.style.color = '#4CAF50'; // Green for critical hit
    } else if (flags.criticalFailure || flags.isCriticalFailure) {
      rollTotal.style.color = '#f44336'; // Red for critical failure
    }
  });
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createDocMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== 'Item') return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn(
      'You can only create macro buttons for owned Items'
    );
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.cardigan.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'cardigan.itemMacro': true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: 'Item',
    uuid: itemUuid,
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then((item) => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(
        `Could not find item ${itemName}. You may need to delete and recreate this macro.`
      );
    }

    // Trigger the item roll
    item.roll();
  });
}

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', function () {
  // Verify system is properly loaded
  
  // Test if we can create a backpack item
  try {
    const itemClass = getDocumentClass("Item");
  } catch (error) {
    console.error('[CARDIGAN] Error testing item creation:', error);
  }
});

/* -------------------------------------------- */
/*  Chat Message Hooks                          */
/* -------------------------------------------- */

// Modern Skills System - Chat button interactions are now handled
// directly by the SkillManager using the renderChatMessageHTML hook

// Skills functions have been moved to module/skills/ for better organization
// All skill-related functionality is now handled by the SkillManager system

/* -------------------------------------------- */
/*  Evasion System Hooks                        */
/* -------------------------------------------- */

/**
 * Add evasion buttons to attack chat messages
 */
Hooks.on('renderChatMessageHTML', (message, html) => {
  // Check if this is an attack message with target data
  const attackData = message.flags?.cardigan?.attackTargets;
  if (!attackData || !attackData.targets || attackData.targets.length === 0) return;

  // Get the roll total from the message
  const attackTotal = message.rolls?.[0]?.total;
  if (!attackTotal) return;

  // Get damage from attack data
  const attackDamage = attackData.damage || 0;

  // Create evasion buttons container
  const evasionSection = document.createElement('div');
  evasionSection.className = 'cardigan-evasion-section';
  evasionSection.style.cssText = 'margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1);';

  // Check if current user can defend (owns any of the targets)
  let canDefend = false;
  let userTarget = null;

  for (const targetData of attackData.targets) {
    const target = game.scenes.current?.tokens.get(targetData.tokenId);
    if (!target) continue;
    
    // Check if user owns the token OR the actor
    const ownsToken = target.isOwner || game.user.isGM;
    const ownsActor = target.actor && (target.actor.isOwner || game.user.isGM);
    
    if (ownsToken || ownsActor) {
      canDefend = true;
      userTarget = { target, data: targetData };
      break;
    }
  }

  if (!canDefend) return;

  // Create single evasion button
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'margin-top: 4px; text-align: center;';

  const button = document.createElement('button');
  button.className = 'cardigan-evasion-button';
  button.dataset.messageId = message.id;
  button.dataset.tokenId = userTarget.data.tokenId;
  button.dataset.actorId = userTarget.data.actorId;
  button.dataset.attackTotal = attackTotal;
  button.dataset.attackDamage = attackDamage;
  button.style.cssText = 'padding: 4px 12px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;';
  button.textContent = 'Rolar Evasão';
  
  button.addEventListener('click', () => handleEvasionClick(button));
  buttonContainer.appendChild(button);
  evasionSection.appendChild(buttonContainer);

  // Add evasion section to message - html is now HTMLElement, not jQuery
  const messageContent = html.querySelector('.message-content');
  if (messageContent) {
    messageContent.appendChild(evasionSection);
  }
});

/**
 * Handle evasion button click
 */
async function handleEvasionClick(button) {
  const messageId = button.dataset.messageId;
  const tokenId = button.dataset.tokenId;
  const actorId = button.dataset.actorId;
  const attackTotal = parseInt(button.dataset.attackTotal);

  // Get the attack message to extract damage from flags
  const message = game.messages.get(messageId);
  const attackDamage = message?.flags?.cardigan?.attackTargets?.damage || 0;
  const attackerId = message?.flags?.cardigan?.attackTargets?.attackerId;

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
  const { AdvantageSelectionDialog } = await import('./applications/advantage-selection-dialog.mjs');
  
  // Show advantage selection dialog (without attack mode checkboxes for evasion)
  const result = await AdvantageSelectionDialog.show({ hideAttackMode: true });
  if (!result) return; // User cancelled

  const { rollType } = result;

  // Disable button to prevent double-clicks
  button.disabled = true;
  button.style.opacity = '0.5';
  button.style.cursor = 'not-allowed';

  try {
    // Get roll data from actor (includes all bonuses and modifiers)
    const rollData = actor.getRollData();

    // Determine formula based on roll type
    let formula;
    let rollDescription = "";
    
    switch (rollType) {
      case 'normal':
        formula = "1d20 + @evasion.total";
        rollDescription = "Rolagem Normal";
        break;
      case 'advantage':
        formula = "2d20kh + @evasion.total";
        rollDescription = "Rolagem com Vantagem";
        break;
      case 'disadvantage':
        formula = "2d20kl + @evasion.total";
        rollDescription = "Rolagem com Desvantagem";
        break;
      case 'enhanced-advantage':
        formula = "3d20kh + @evasion.total";
        rollDescription = "Rolagem com Vantagem Aprimorada";
        break;
      case 'enhanced-disadvantage':
        formula = "3d20kl + @evasion.total";
        rollDescription = "Rolagem com Desvantagem Aprimorada";
        break;
      default:
        formula = "1d20 + @evasion.total";
        rollDescription = "Rolagem Normal";
    }

    // Roll evasion using actor's roll data
    const roll = new Roll(formula, rollData);
    await roll.evaluate();

    const evasionTotal = roll.total;
    const success = evasionTotal >= attackTotal;

    // Calculate HP after damage (only if failed evasion)
    const damageTaken = success ? 0 : attackDamage;
    const remainingHP = Math.max(0, currentHP - damageTaken);

    // Create flavor text
    const flavor = `
      <div style="text-align: center;">
        <strong>Evasão de ${token.name}</strong> - ${rollDescription}<br>
      </div>
    `;

    // Use player's roll mode setting (GM can choose blind manually)
    const rollMode = game.settings.get('core', 'rollMode');

    // Create message data
    const messageData = {
      speaker: { alias: token.name },
      flavor: flavor,
      rolls: [roll]
    };

    // Apply roll mode using Foundry's official API method
    ChatMessage.applyRollMode(messageData, rollMode);
    
    // Create the chat message
    const chatMessage = await ChatMessage.create(messageData);

    // Wait for Dice So Nice animation to complete before notifying GM
    if (game.dice3d) {
      await game.dice3d.waitFor3DAnimationByMessageID(chatMessage.id);
    }

    // Send GM notification via socket (works for both players and GM)
    const socketPayload = {
      action: "notifyGMEvasion",
      payload: {
        actorId: actorId,
        playerName: game.user.name,
        characterName: token.name,
        evasionTotal: evasionTotal,
        attackTotal: attackTotal,
        success: success,
        currentHP: currentHP,
        maxHP: maxHP,
        armor: armor,
        attackDamage: attackDamage,
        damageTaken: damageTaken,
        remainingHP: remainingHP
      }
    };
    
    console.log('[CARDIGAN SOCKET] Emitting:', socketPayload);
    game.socket.emit("system.cardigan", socketPayload);
    
    // Also create notification locally if current user is GM
    if (game.user.isGM) {
      createGMEvasionNotification(socketPayload.payload);
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
