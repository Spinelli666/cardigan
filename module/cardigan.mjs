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
import './hooks/chat-hooks.mjs';
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

  // Register sheet application classes
  const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;
  DocumentSheetConfig.unregisterSheet(Actor, 'core', foundry.appv1.sheets.ActorSheet);
  DocumentSheetConfig.registerSheet(Actor, 'cardigan', CardiganSystemActorSheet, {
    makeDefault: true,
    label: 'CARDIGAN.SheetLabels.Actor',
  });
  DocumentSheetConfig.unregisterSheet(Item, 'core', foundry.appv1.sheets.ItemSheet);
  DocumentSheetConfig.registerSheet(Item, 'cardigan', CardiganSystemItemSheet, {
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

  // Pre-load HBS partials for reusable template components
  foundry.applications.handlebars.loadTemplates([
    'systems/cardigan/templates/actor/partials/skill-row.hbs',
    'systems/cardigan/templates/actor/partials/recipe-row.hbs',
    'systems/cardigan/templates/actor/partials/durability-display.hbs',
    'systems/cardigan/templates/actor/partials/armor-info-badges.hbs',
  ]);
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