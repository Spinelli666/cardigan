// Import document classes.
import { CardiganSystemActor } from './documents/actor.mjs';
import { CardiganSystemItem } from './documents/item.mjs';
import { CardiganChatMessage } from './documents/chat-message.mjs';
// Import sheet classes.
import { CardiganSystemActorSheet } from './sheets/actor-sheet.mjs';
import { CardiganSystemItemSheet } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { CARDIGAN, registerHandlebarsHelpers, buildRollFormula } from './helpers/config.mjs';
import { ChatMessageHelper } from './helpers/chat-messages.mjs';
import { createDocMacro, rollItemMacro } from './helpers/macro.mjs';
// Import DataModel classes
import * as models from './data/_module.mjs';
// Import Skills System
import { initializeSkillsSystem, getSkillManager } from './skills/index.mjs';
// Import Effects System
import { initializeEffects } from './effects/index.mjs';
// Import Races System
import { initializeRaces } from './races/index.mjs';
// Import Weapon Properties System
import { initializeWeaponProperties } from './weapon-properties/index.mjs';
// Import Tooltips System
import CardiganTooltipManager from './tooltips/tooltip-manager.mjs';
// Import Hooks
import { registerWhisperPlaceholderHook } from './hooks/whisper-placeholder.mjs';
// Import Socket listeners
import { registerInitSocketListeners, registerReadySocketListeners } from './socket.mjs';
// Import Trade Handlers
import { handleTradeRequest, handleTradeAccepted, handleTradeRejected, handleTradeUpdate, handleTradeConfirm, handleTradeUndo, handleTradeCancel, handleTradeComplete, handleExecuteTradeTransfer } from './trade/trade-handlers.mjs';
// Import Merchant Trade Handlers
import { handleMerchantTradeRequest, handleMerchantTradeAccepted, handleMerchantTradeRejected, handleMerchantTradeUpdate, handleMerchantTradeConfirm, handleMerchantTradeUndo, handleMerchantTradeCancel, handleMerchantTradeComplete, handleExecuteMerchantTradeTransfer } from './trade/merchant-trade-handlers.mjs';
// Import Combat Dialogs
import { closeAttackDialogForAttacker, showDamageNotification, showArmorDurabilityNotification, createAttackerResultDialog, showArmorDurabilityDialog, createGMEvasionNotification } from './combat/combat-dialogs.mjs';
// Import Evasion/Precision Handlers
import { handleEvasionClick, handlePrecisionClick } from './combat/evasion-precision.mjs';

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */
// Add key classes to the global scope so they can be more easily used
// by downstream developers
globalThis.cardigan = {
  documents: {
    CardiganSystemActor,
    CardiganSystemItem,
    CardiganChatMessage,
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
  CONFIG.ChatMessage.documentClass = CardiganChatMessage;

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
    race: models.CardiganSystemRace,
    skill: models.CardiganSystemSkill,
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

  // Socket listeners for combat notifications, evasion, damage, armor durability, weapon property effects
  registerInitSocketListeners({
    createGMEvasionNotification,
    showDamageNotification,
    showArmorDurabilityNotification,
    createAttackerResultDialog,
    closeAttackDialogForAttacker,
  });

  // Initialize Skills System
  initializeSkillsSystem().catch(error => {
    console.error('[CARDIGAN] Failed to initialize Skills System:', error);
  });

  // Initialize Effects System
  initializeEffects().catch(error => {
    console.error('[CARDIGAN] Failed to initialize Effects System:', error);
  });

  // Initialize Races System
  initializeRaces().catch(error => {
    console.error('[CARDIGAN] Failed to initialize Races System:', error);
  });

  // Initialize Weapon Properties System
  initializeWeaponProperties();
});

/* -------------------------------------------- */
/*  Status Effects Loader                       */
/* -------------------------------------------- */

/**
 * Load status effects from the efeitos-cardigan compendium
 * and populate CONFIG.statusEffects for token HUD
 */
async function loadStatusEffects() {
  try {
    console.log('[CARDIGAN] Loading status effects from compendium...');
    
    // Get the effects compendium
    const pack = game.packs.get('cardigan.efeitos-cardigan');
    if (!pack) {
      console.warn('[CARDIGAN] Effects compendium not found');
      return;
    }
    
    // Load all documents from the compendium
    const documents = await pack.getDocuments();
    
    // Initialize status effects array
    CONFIG.statusEffects = [];
    
    // Separate effects by type
    const positiveEffects = [];
    const negativeEffects = [];
    
    // Process each effect
    for (const doc of documents) {
      if (doc.type !== 'efeito') continue;
      
      const effectData = {
        id: doc.name.toLowerCase().replace(/\s+/g, '-'),
        name: doc.name,
        img: doc.img,
        // Store reference to the compendium item for later use
        _source: `Compendium.cardigan.efeitos-cardigan.Item.${doc.id}`
      };
      
      // Separate by type
      if (doc.system.efeitoType === 'positivo') {
        positiveEffects.push(effectData);
      } else {
        negativeEffects.push(effectData);
      }
    }
    
    // Sort alphabetically
    positiveEffects.sort((a, b) => a.name.localeCompare(b.name));
    negativeEffects.sort((a, b) => a.name.localeCompare(b.name));
    
    // Add to CONFIG in order: negative effects first, then positive
    // (this matches common RPG convention where debuffs are listed first)
    CONFIG.statusEffects = [...negativeEffects, ...positiveEffects];
    
    console.log(`[CARDIGAN] Loaded ${CONFIG.statusEffects.length} status effects (${negativeEffects.length} negative, ${positiveEffects.length} positive)`);
    
  } catch (error) {
    console.error('[CARDIGAN] Error loading status effects:', error);
  }
}

/* -------------------------------------------- */
/*  Setup Hook - Status Effects & Text Enrichers */
/* -------------------------------------------- */

Hooks.once('setup', async () => {
  // Load status effects from compendium
  await loadStatusEffects();

  console.log('[CARDIGAN] Status effects configured:', CONFIG.statusEffects);

  // Enricher para imagens inline no ProseMirror
  // Uso: ::systems/cardigan/assets/images/exemplo.png::
  CONFIG.TextEditor.enrichers.push({
    pattern: /::([^:]+)::/gim,
    enricher: async (match, options) => {
      const imagePath = match[1].trim();

      const img = document.createElement("img");
      img.src = imagePath;
      img.style.display = "inline";
      img.style.verticalAlign = "middle";
      img.style.maxHeight = "1.5em";
      img.style.maxWidth = "100px";
      img.alt = imagePath.split('/').pop();

      return img;
    }
  });
});

/* -------------------------------------------- */
/*  Prevent Duplicate Status Effects Display    */
/* -------------------------------------------- */

/**
 * Hook to prevent duplicate status effects when applied via Token HUD
 * If an effect with the same name already exists as an ActiveEffect, prevent creation
 * Items (efeitos) are allowed to coexist with their visual ActiveEffect representation on tokens
 */
Hooks.on('preCreateActiveEffect', (effect, data, options, userId) => {
  // Only process for actors
  if (!(effect.parent instanceof Actor)) return true;
  
  const actor = effect.parent;
  const effectName = effect.name;
  
  // Only check if this effect already exists as another ActiveEffect
  // We allow ActiveEffects even if an Item with the same name exists (for token display)
  const existingActiveEffect = actor.effects.find(e => 
    e.id !== effect.id && e.name === effectName
  );
  
  if (existingActiveEffect) {
    console.log(`[CARDIGAN] ActiveEffect "${effectName}" already exists, preventing duplicate`);
    
    // Show a notification to the user
    ui.notifications.warn(`O efeito "${effectName}" já está ativo no personagem.`);
    
    // Return false to prevent creation
    return false;
  }
  
  return true;
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
    sheet.render(false); // re-render with fresh data, without forcing bringToFront
  });
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', function () {
  // Initialize Cardigan tooltip system
  CardiganTooltipManager.initialize();
  
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => createDocMacro(data, slot));
  
  // Socket listeners for trade system and secondary combat events
  registerReadySocketListeners({
    handleTradeRequest,
    handleTradeAccepted,
    handleTradeRejected,
    handleTradeUpdate,
    handleTradeConfirm,
    handleTradeUndo,
    handleTradeCancel,
    handleTradeComplete,
    handleExecuteTradeTransfer,
    handleMerchantTradeRequest,
    handleMerchantTradeAccepted,
    handleMerchantTradeRejected,
    handleMerchantTradeUpdate,
    handleMerchantTradeConfirm,
    handleMerchantTradeUndo,
    handleMerchantTradeCancel,
    handleMerchantTradeComplete,
    handleExecuteMerchantTradeTransfer,
    createGMEvasionNotification,
    createAttackerResultDialog,
    closeAttackDialogForAttacker,
    showDamageNotification,
    showArmorDurabilityNotification,
  });
});

/* -------------------------------------------- */
/*  Chat Message Hooks                          */
/* -------------------------------------------- */

// Modern Skills System - Chat button interactions are now handled
// directly by the SkillManager using the renderChatMessageHTML hook

// Skills functions have been moved to module/skills/ for better organization
// All skill-related functionality is now handled by the SkillManager system

/* -------------------------------------------- */
/*  Critical Results Coloring Hook              */
/* -------------------------------------------- */

// Hook to color roll totals based on critical success/failure
// This needs to be registered globally (not inside ready hook) so it works for all clients
Hooks.on('renderChatMessageHTML', (chatMessage, html) => {
  // Only process roll messages with our flags
  const flags = chatMessage.flags?.cardigan;
  if (!flags || (!flags.criticalHit && !flags.criticalFailure && !flags.isCriticalHit && !flags.isCriticalFailure && !flags.criticalSuccess)) return;
  
  // Find the roll total element (html is now HTMLElement, not jQuery)
  const rollTotal = html.querySelector('.dice-total');
  if (!rollTotal) return;
  
  // Apply colors based on critical type (checking all flag formats)
  if (flags.criticalHit || flags.isCriticalHit || flags.criticalSuccess) {
    rollTotal.style.color = '#4CAF50'; // Green for critical hit/success
  } else if (flags.criticalFailure || flags.isCriticalFailure) {
    rollTotal.style.color = '#f44336'; // Red for critical failure
  }
});

/* -------------------------------------------- */
/*  Dice Formula Rich Tooltips Hook             */
/* -------------------------------------------- */

// Hook to attach rich tooltips to dice formula results
Hooks.on('renderChatMessageHTML', (chatMessage, html) => {
  // Import tooltip manager dynamically to avoid circular dependencies
  import('./tooltips/tooltip-manager.mjs').then(module => {
    const TooltipManager = module.default;
    TooltipManager.attachDiceFormulaTooltips(html);
  });
});

/**
 * Add toggle functionality to skill description buttons in chat
 */
Hooks.on('renderChatMessageHTML', (chatMessage, html) => {
  const toggleButtons = html.querySelectorAll('.toggle-skill-description');
  if (toggleButtons.length === 0) return;

  toggleButtons.forEach(button => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      
      const targetId = button.dataset.target;
      const descElement = html.querySelector(`#${targetId}`);
      
      if (!descElement) return;
      
      const isHidden = descElement.style.display === 'none';
      
      // Toggle visibility
      descElement.style.display = isHidden ? 'block' : 'none';
      
      // Update button text and icon
      if (isHidden) {
        button.innerHTML = '<i class="fas fa-eye-slash"></i> Esconder Descrição';
      } else {
        button.innerHTML = '<i class="fas fa-eye"></i> Mostrar Descrição';
      }
    });
  });
});

/**
 * Add toggle functionality to effect title buttons in chat
 */
Hooks.on('renderChatMessageHTML', (message, html) => {
  const toggleButtons = html.querySelectorAll('.toggle-effect-description');
  if (toggleButtons.length === 0) return;

  toggleButtons.forEach(button => {
    const effectId = button.dataset.effectId;
    const descElement = html.querySelector(`.effect-description[data-effect-id="${effectId}"]`);

    button.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();

      if (!descElement) return;

      const isHidden = descElement.style.display === 'none' || !descElement.style.display;

      // Toggle visibility
      descElement.style.display = isHidden ? 'block' : 'none';
    });
  });
});

/* -------------------------------------------- */
/*  Evasion System Hooks                        */
/* -------------------------------------------- */

// Register whisper placeholder hook (see module/hooks/whisper-placeholder.mjs)
registerWhisperPlaceholderHook();

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
  buttonContainer.className = 'cardigan-chat-action-section';

  const button = document.createElement('button');
  button.className = 'cardigan-evasion-button cardigan-chat-action-button';
  button.dataset.messageId = message.id;
  button.dataset.tokenId = userTarget.data.tokenId;
  button.dataset.actorId = userTarget.data.actorId;
  button.dataset.attackTotal = attackTotal;
  button.dataset.attackDamage = attackDamage;
  button.dataset.tooltip = 'Testar EVASÃO';
  button.dataset.tooltipClass = 'cardigan-chat-tooltip';
  button.textContent = '';
  const evasionIcon = document.createElement('img');
  evasionIcon.src = 'systems/cardigan/assets/images/decorative/icons/icon-d20-message.svg';
  evasionIcon.alt = '';
  evasionIcon.className = 'action-button-icon';
  button.appendChild(evasionIcon);
  
  button.addEventListener('click', () => handleEvasionClick(button));
  const evasionDividerLeft = document.createElement('img');
  evasionDividerLeft.src = 'systems/cardigan/assets/images/decorative/divider.webp';
  evasionDividerLeft.alt = '';
  evasionDividerLeft.className = 'action-button-divider action-button-divider--left';
  buttonContainer.appendChild(evasionDividerLeft);
  buttonContainer.appendChild(button);
  const evasionDivider = document.createElement('img');
  evasionDivider.src = 'systems/cardigan/assets/images/decorative/divider.webp';
  evasionDivider.alt = '';
  evasionDivider.className = 'action-button-divider';
  buttonContainer.appendChild(evasionDivider);
  evasionSection.appendChild(buttonContainer);

  // Add border decoration + evasion section to message
  const messageContent = html.querySelector('.message-content');
  if (messageContent) {
    const borderImg = document.createElement('img');
    borderImg.src = 'systems/cardigan/assets/images/decorative/border-chat-message.webp';
    borderImg.alt = '';
    borderImg.className = 'chat-border-decoration';
    messageContent.appendChild(borderImg);
    messageContent.appendChild(evasionSection);
  }
});

/**
 * Add toggle functionality to effect chat messages
 */
Hooks.on('renderChatMessageHTML', (message, html) => {
  // Validate html parameter
  if (!html || !html[0]) return;
  
  // Check if this is an effect message
  const effectMessage = html[0].querySelector('.cardigan-effect-chat-message');
  if (!effectMessage) return;

  const effectTitle = effectMessage.querySelector('.effect-title[data-action="toggle-description"]');
  const effectDescription = effectMessage.querySelector('.effect-description');
  
  if (!effectTitle || !effectDescription) return;

  // Add click event listener to toggle description
  effectTitle.addEventListener('click', (event) => {
    event.preventDefault();
    effectDescription.classList.toggle('collapsed');
  });
});

/**
 * Add precision buttons to evasion reroll chat messages
 */
Hooks.on('renderChatMessageHTML', (message, html) => {
  // Check if this is an evasion reroll message with precision target data
  const precisionData = message.flags?.cardigan?.precisionTarget;
  if (!precisionData) return;

  // Get the evasion total from the message
  const evasionTotal = message.rolls?.[0]?.total || precisionData.evasionTotal;
  if (!evasionTotal) return;

  // Create precision button container
  const precisionSection = document.createElement('div');
  precisionSection.className = 'cardigan-precision-section';

  // Check if current user can attack (owns the attacker)
  const attackerToken = game.scenes.current?.tokens.get(precisionData.tokenId);
  if (!attackerToken) return;
  
  const ownsToken = attackerToken.isOwner || game.user.isGM;
  const ownsActor = attackerToken.actor && (attackerToken.actor.isOwner || game.user.isGM);
  
  if (!ownsToken && !ownsActor) return;

  // Create precision button
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'cardigan-chat-action-section';

  const button = document.createElement('button');
  button.className = 'cardigan-precision-button cardigan-chat-action-button';
  button.dataset.messageId = message.id;
  button.dataset.tokenId = precisionData.tokenId;
  button.dataset.actorId = precisionData.actorId;
  button.dataset.evasionTotal = evasionTotal;
  button.dataset.tooltip = 'Testar PRECISÃO';
  button.dataset.tooltipClass = 'cardigan-chat-tooltip';
  button.textContent = '';
  const precisionIcon = document.createElement('img');
  precisionIcon.src = 'systems/cardigan/assets/images/decorative/icons/icon-d20-message.svg';
  precisionIcon.alt = '';
  precisionIcon.className = 'action-button-icon';
  button.appendChild(precisionIcon);
  
  button.addEventListener('click', () => handlePrecisionClick(button));
  const precisionDividerLeft = document.createElement('img');
  precisionDividerLeft.src = 'systems/cardigan/assets/images/decorative/divider.webp';
  precisionDividerLeft.alt = '';
  precisionDividerLeft.className = 'action-button-divider action-button-divider--left';
  buttonContainer.appendChild(precisionDividerLeft);
  buttonContainer.appendChild(button);
  const precisionDivider = document.createElement('img');
  precisionDivider.src = 'systems/cardigan/assets/images/decorative/divider.webp';
  precisionDivider.alt = '';
  precisionDivider.className = 'action-button-divider';
  buttonContainer.appendChild(precisionDivider);
  precisionSection.appendChild(buttonContainer);

  // Add border decoration + precision section to message
  const messageContent = html.querySelector('.message-content');
  if (messageContent) {
    const borderImg = document.createElement('img');
    borderImg.src = 'systems/cardigan/assets/images/decorative/border-chat-message.webp';
    borderImg.alt = '';
    borderImg.className = 'chat-border-decoration';
    messageContent.appendChild(borderImg);
    messageContent.appendChild(precisionSection);
  }
});
