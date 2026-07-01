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

/**
 * Handle evasion button click
 */
async function handleEvasionClick(button) {
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
  const { AdvantageSelectionDialog } = await import('./applications/advantage-selection-dialog.mjs');
  
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
    const { CongeladoEffect } = await import('./effects/effects/congelado.mjs');
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
    const { SangramentoEffect } = await import('./effects/effects/sangramento.mjs');
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
async function handlePrecisionClick(button) {
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
    const { AdvantageSelectionDialog } = await import('./applications/advantage-selection-dialog.mjs');
    
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
    const { buildRollFormula } = await import('./helpers/config.mjs');
    
    // Build roll formula (including manual modifier)
    const formula = buildRollFormula(rollType, `@abilities.accuracy.total`, manualModifier);
    const rollData = actor.getRollData();

    // Check for Congelado effect and apply skill penalty
    const { CongeladoEffect } = await import('./effects/effects/congelado.mjs');
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
    const { SangramentoEffect } = await import('./effects/effects/sangramento.mjs');
    await SangramentoEffect.applyBleedingDamage(actor, 'Precisão', 'accuracy');

    // Detect critical results using actor's thresholds
    const { CardiganSystemActorSheet } = await import('./sheets/actor-sheet.mjs');
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
