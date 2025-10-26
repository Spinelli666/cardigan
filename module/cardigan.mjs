// Import document classes.
import { CardiganSystemActor } from './documents/actor.mjs';
import { CardiganSystemItem } from './documents/item.mjs';
// Import sheet classes.
import { CardiganSystemActorSheet } from './sheets/actor-sheet.mjs';
import { CardiganSystemItemSheet } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { CARDIGAN, registerHandlebarsHelpers } from './helpers/config.mjs';
// Import DataModel classes
import * as models from './data/_module.mjs';
// Import Skills System
import { initializeSkillsSystem, getSkillManager } from './skills/index.mjs';

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
    "culinary-recipe": models.CardiganSystemItemRecipe,
    "tailoring-recipe": models.CardiganSystemItemRecipe,
    "tecnomagic-recipe": models.CardiganSystemItemRecipe,
    "blacksmithing-recipe": models.CardiganSystemItemRecipe,
    "alchemy-recipe": models.CardiganSystemItemRecipe,
    "carpentry-recipe": models.CardiganSystemItemRecipe,
    feature: models.CardiganSystemFeature,
    skill: models.CardiganSystemSkill,
    spell: models.CardiganSystemSpell,
    efeito: models.CardiganSystemEfeito,
    arma: models.CardiganSystemArma,
    armadura: models.CardiganSystemArmadura,
  };

  // Debug logging
  console.log('[CARDIGAN] Registered Item types:', Object.keys(CONFIG.Item.dataModels));
  console.log('[CARDIGAN] CardiganSystemItemComum model:', models.CardiganSystemItemComum);
  console.log('[CARDIGAN] CardiganSystemItemMunicao model:', models.CardiganSystemItemMunicao);
  console.log('[CARDIGAN] CardiganSystemItemConsumivel model:', models.CardiganSystemItemConsumivel);
  console.log('[CARDIGAN] CardiganSystemEfeito model:', models.CardiganSystemEfeito);
  console.log('[CARDIGAN] CardiganSystemSkill model:', models.CardiganSystemSkill);
  console.log('[CARDIGAN] CardiganSystemArma model:', models.CardiganSystemArma);
  console.log('[CARDIGAN] CardiganSystemArmadura model:', models.CardiganSystemArmadura);
  
  // Verify document types (using modern documentTypes instead of deprecated template)
  console.log('[CARDIGAN] Document types from system.json:', game.system?.documentTypes?.Item);
  
  // Verify that CONFIG recognizes the backpack and skill types
  console.log('[CARDIGAN] CONFIG.Item.dataModels keys:', Object.keys(CONFIG.Item.dataModels));
  console.log('[CARDIGAN] Does CONFIG have backpack?', 'backpack' in CONFIG.Item.dataModels);
  console.log('[CARDIGAN] Does CONFIG have skill?', 'skill' in CONFIG.Item.dataModels);

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

  // Register helper for "lt" (less than) comparison
  Handlebars.registerHelper('lt', function (a, b) {
    return a < b;
  });

  // Register helper for "selected" attribute
  Handlebars.registerHelper('selected', function (value, expectedValue) {
    return value === expectedValue ? 'selected' : '';
  });

  // Initialize Skills System
  initializeSkillsSystem().catch(error => {
    console.error('[CARDIGAN] Failed to initialize Skills System:', error);
  });
});

/* -------------------------------------------- */
/*  Item Update Hook for Bidirectional Sync    */
/* -------------------------------------------- */

Hooks.on('updateItem', function (item, updates, options, userId) {
  console.log('[CARDIGAN] updateItem hook triggered:', item.name, updates);
  
  // Update actor sheets if item belongs to an actor
  if (item.parent && item.parent.documentName === 'Actor') {
    const actorSheets = Object.values(ui.windows).filter(app => 
      app instanceof CardiganSystemActorSheet && 
      app.document.id === item.parent.id
    );
    
    actorSheets.forEach(sheet => {
      console.log('[CARDIGAN] Re-rendering actor sheet for:', item.parent.name);
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
    console.log('[CARDIGAN] Re-rendering item sheet for:', item.name);
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

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => createDocMacro(data, slot));
  
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
  console.log('[CARDIGAN] System ready - verifying configuration...');
  console.log('[CARDIGAN] Available Item types in CONFIG:', Object.keys(CONFIG.Item.dataModels));
  console.log('[CARDIGAN] System document types:', game.system?.documentTypes?.Item);
  console.log('[CARDIGAN] Backpack model available:', !!CONFIG.Item.dataModels.backpack);
  
  // Test if we can create a backpack item
  try {
    const itemClass = getDocumentClass("Item");
    console.log('[CARDIGAN] Item class:', itemClass);
    console.log('[CARDIGAN] Item class supports backpack:', itemClass.TYPES.includes('backpack'));
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
