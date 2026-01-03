// Import document classes.
import { CardiganSystemActor } from './documents/actor.mjs';
import { CardiganSystemItem } from './documents/item.mjs';
// Import sheet classes.
import { CardiganSystemActorSheet } from './sheets/actor-sheet.mjs';
import { CardiganSystemItemSheet } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { CARDIGAN, registerHandlebarsHelpers, buildRollFormula } from './helpers/config.mjs';
import CardiganTooltips from './helpers/tooltips.mjs';
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

  // Socket listener para notificações de evasão, dano e resultado de ataque (registrado no init)
  game.socket.on("system.cardigan", async (data) => {
    if (data.action === "notifyGMEvasion" && game.user.isGM) {
      createGMEvasionNotification(data.payload);
    } else if (data.action === "notifyDamage") {
      showDamageNotification(data.payload);
    } else if (data.action === "notifyArmorDurability") {
      showArmorDurabilityNotification(data.payload);
    } else if (data.action === "notifyAttacker" && !game.user.isGM) {
      // Only show to the attacker's owner
      if (data.payload.attackerOwnerId === game.user.id) {
        createAttackerResultDialog(data.payload);
      }
    } else if (data.action === "applyDamage") {
      // Apply damage to actor - only if user owns the actor or is GM
      const actor = game.actors.get(data.payload.actorId);
      if (actor && (actor.isOwner || game.user.isGM)) {
        actor.update({ 'system.health.value': data.payload.newHP });
      }
    } else if (data.action === "closeAttackDialog") {
      // Close attack dialog by ID
      closeAttackDialogForAttacker(data.payload);
    } else if (data.action === "openNewAttackDialog") {
      // Close old dialog and open new one with updated values
      if (data.payload.attackerOwnerId === game.user.id) {
        closeAttackDialogForAttacker({ dialogId: data.payload.oldDialogId });
        createAttackerResultDialog(data.payload);
      }
    } else if (data.type === "applyBleeding" && game.user.isGM) {
      // Handle bleeding application - only GM can execute
      const targetActor = game.actors.get(data.targetActorId);
      if (targetActor) {
        const { Ferir } = await import('./weapon-properties/properties/ferir.mjs');
        await Ferir.applyBleedingEffect(targetActor, data.weaponName);
      } else {
        console.error('[FERIR] Target actor not found:', data.targetActorId);
      }
    } else if (data.type === "notifyBleeding") {
      // Notify defender's owner about bleeding effect
      if (data.userId === game.user.id) {
        ui.notifications.info(`🩸 Você recebeu Sangramento de ${data.weaponName}!`);
      }
    } else if (data.type === "applyWeakened" && game.user.isGM) {
      // Handle weakened application - only GM can execute
      const targetActor = game.actors.get(data.targetActorId);
      if (targetActor) {
        const { Traspassar } = await import('./weapon-properties/properties/traspassar.mjs');
        await Traspassar.applyWeakenedEffect(targetActor, data.weaponName);
      } else {
        console.error('[TRASPASSAR] Target actor not found:', data.targetActorId);
      }
    } else if (data.type === "notifyWeakened") {
      // Notify defender's owner about weakened effect
      if (data.userId === game.user.id) {
        ui.notifications.info(`💪 Você ficou Enfraquecido por ${data.weaponName}!`);
      }
    } else if (data.type === "applyProne" && game.user.isGM) {
      // Handle prone application - only GM can execute
      const targetActor = game.actors.get(data.targetActorId);
      if (targetActor) {
        const { Contundente } = await import('./weapon-properties/properties/contundente.mjs');
        await Contundente.applyProneEffect(targetActor, data.weaponName);
      } else {
        console.error('[CONTUNDENTE] Target actor not found:', data.targetActorId);
      }
    } else if (data.type === "notifyProne") {
      // Notify defender's owner about prone effect
      if (data.userId === game.user.id) {
        ui.notifications.info(`🔽 Você ficou Caído por ${data.weaponName}!`);
      }
    } else if (data.type === "applyBurning" && game.user.isGM) {
      // Handle burning application - only GM can execute
      const targetActor = game.actors.get(data.targetActorId);
      if (targetActor) {
        const { Incendiar } = await import('./weapon-properties/properties/incendiar.mjs');
        await Incendiar.applyBurningEffect(targetActor, data.weaponName);
      } else {
        console.error('[INCENDIAR] Target actor not found:', data.targetActorId);
      }
    } else if (data.type === "notifyBurning") {
      // Notify defender's owner about burning effect
      if (data.userId === game.user.id) {
        ui.notifications.info(`🔥 Você ficou Incendiado por ${data.weaponName}!`);
      }
    } else if (data.type === "applyShocked" && game.user.isGM) {
      // Handle shocked application - only GM can execute
      const targetActor = game.actors.get(data.targetActorId);
      if (targetActor) {
        const { Eletrocutar } = await import('./weapon-properties/properties/eletrocutar.mjs');
        await Eletrocutar.applyShockedEffect(targetActor, data.weaponName);
      } else {
        console.error('[ELETROCUTAR] Target actor not found:', data.targetActorId);
      }
    } else if (data.type === "notifyShocked") {
      // Notify defender's owner about shocked effect
      if (data.userId === game.user.id) {
        ui.notifications.info(`⚡ Você ficou Eletrocutado por ${data.weaponName}!`);
      }
    } else if (data.type === "applyFracture" && game.user.isGM) {
      // Handle fracture application - only GM can execute
      const targetActor = game.actors.get(data.targetActorId);
      if (targetActor) {
        const { Impacto } = await import('./weapon-properties/properties/impacto.mjs');
        await Impacto.applyFractureEffect(targetActor, data.weaponName);
      } else {
        console.error('[IMPACTO] Target actor not found:', data.targetActorId);
      }
    } else if (data.type === "notifyFracture") {
      // Notify defender's owner about fracture increment
      if (data.userId === game.user.id) {
        ui.notifications.info(`🦴 Você sofreu Fratura por ${data.weaponName}! (${data.oldFracture} → ${data.newFracture})`);
      }
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
})

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

// Helper para multiplicação matemática
Handlebars.registerHelper('multiply', function (a, b) {
  return (a || 0) * (b || 0);
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

// Import weapon property classes for combat effects
import { Ferir } from './weapon-properties/properties/ferir.mjs';
import { Traspassar } from './weapon-properties/properties/traspassar.mjs';
import { Contundente } from './weapon-properties/properties/contundente.mjs';
import { Incendiar } from './weapon-properties/properties/incendiar.mjs';
import { Eletrocutar } from './weapon-properties/properties/eletrocutar.mjs';
import { Impacto } from './weapon-properties/properties/impacto.mjs';

// Global Map to track active attack dialogs
const activeAttackDialogs = new Map();

/**
 * Close attack dialog for attacker
 * @param {Object} data - Data containing dialogId
 */
function closeAttackDialogForAttacker(data) {
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
 * Show armor durability notification to the actor's owner only
 * @param {Object} data - Armor durability notification data
 */
function showArmorDurabilityNotification(data) {
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
async function createAttackerResultDialog(data) {
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
          const { AdvantageSelectionDialog } = await import('./applications/advantage-selection-dialog.mjs');
          const result = await AdvantageSelectionDialog.show();
          if (!result) return false; // User cancelled
          
          const { rollType } = result;
          
          // Get roll data from attacker
          const rollData = attackerActor.getRollData();
          
          // Determine formula based on roll type
          const formula = buildRollFormula(rollType, "@accuracy.total");
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
          const { CardiganSystemActorSheet } = await import('./sheets/actor-sheet.mjs');
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
          
          // Create flavor text
          const flavor = `
            <div style="text-align: center;">
              <strong>🔄 Re-rolagem de Ataque de ${attackerName}</strong> - ${rollDescription}<br>
            </div>
          `;
          
          // Use player's roll mode setting
          const rollMode = game.settings.get('core', 'rollMode');
          
          // Get defender token for flags
          const defenderActor = game.actors.get(actorId);
          const defenderToken = game.scenes.current?.tokens.find(t => t.actorId === actorId);
          
          // Create message data with flags for evasion button system
          const messageData = {
            speaker: { alias: attackerName },
            flavor: flavor,
            rolls: [roll],
            flags: {
              cardigan: {
                criticalSuccess: criticalSuccess,
                criticalFailure: criticalFailure,
                attackTargets: {
                  targets: [{ tokenId: defenderToken?.id, actorId: actorId }],
                  damage: attackDamage,
                  attackerId: attackerActor.id,
                  attackerCriticalHit: criticalSuccess,  // Add attacker critical for damage calculation
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
          };
          
          // Apply roll mode
          ChatMessage.applyRollMode(messageData, rollMode);
          
          // Create the chat message (this will trigger the existing hook that adds evasion button)
          await ChatMessage.create(messageData);
          
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
          
          // Apply bleeding effect if weapon has "ferir" property and attacker scored critical hit
          if (attackerCriticalHit && weaponProperties && weaponProperties.includes("ferir")) {
            console.log('[FERIR] Player Dialog - Conditions met: critical hit + ferir property');
            const defenderActor = game.actors.get(actorId);
            if (defenderActor) {
              await Ferir.applyBleedingEffect(defenderActor, weaponName || "arma com ferir");
            }
          }
          
          // Apply weakened effect if weapon has "traspassar" property and attacker scored critical hit
          if (attackerCriticalHit && weaponProperties && weaponProperties.includes("traspassar")) {
            const defenderActor = game.actors.get(actorId);
            if (defenderActor) {
              await Traspassar.applyWeakenedEffect(defenderActor, weaponName || "arma com traspassar");
            }
          }
          
          // Apply prone effect if weapon has "contundente" property and attacker scored critical hit
          if (attackerCriticalHit && weaponProperties && weaponProperties.includes("contundente")) {
            const defenderActor = game.actors.get(actorId);
            if (defenderActor) {
              await Contundente.applyProneEffect(defenderActor, weaponName || "arma contundente");
            }
          }
          
          // Apply burning effect if weapon has "incendiar" property and attacker scored critical hit
          if (attackerCriticalHit && weaponProperties && weaponProperties.includes("incendiar")) {
            const defenderActor = game.actors.get(actorId);
            if (defenderActor) {
              await Incendiar.applyBurningEffect(defenderActor, weaponName || "arma incendiária");
            }
          }
          
          // Apply shocked effect if weapon has "eletrocutar" property and attacker scored critical hit
          if (attackerCriticalHit && weaponProperties && weaponProperties.includes("eletrocutar")) {
            const defenderActor = game.actors.get(actorId);
            if (defenderActor) {
              await Eletrocutar.applyShockedEffect(defenderActor, weaponName || "arma elétrica");
            }
          }
          
          // Apply fracture if weapon has "impacto" property and attacker scored critical hit
          if (attackerCriticalHit && weaponProperties && weaponProperties.includes("impacto")) {
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
async function showArmorDurabilityDialog(armors, previouslySelected = []) {
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
async function createGMEvasionNotification(data) {
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
            
            // Apply bleeding effect if weapon has "ferir" property and attacker scored critical hit
            if (attackerCriticalHit && weaponProperties && weaponProperties.includes("ferir")) {
              await Ferir.applyBleedingEffect(actor, weaponName || "arma com ferir");
            }
            
            // Apply weakened effect if weapon has "traspassar" property and attacker scored critical hit
            if (attackerCriticalHit && weaponProperties && weaponProperties.includes("traspassar")) {
              await Traspassar.applyWeakenedEffect(actor, weaponName || "arma com traspassar");
            }
            
            // Apply prone effect if weapon has "contundente" property and attacker scored critical hit
            if (attackerCriticalHit && weaponProperties && weaponProperties.includes("contundente")) {
              await Contundente.applyProneEffect(actor, weaponName || "arma contundente");
            }
            
            // Apply burning effect if weapon has "incendiar" property and attacker scored critical hit
            if (attackerCriticalHit && weaponProperties && weaponProperties.includes("incendiar")) {
              await Incendiar.applyBurningEffect(actor, weaponName || "arma incendiária");
            }
            
            // Apply shocked effect if weapon has "eletrocutar" property and attacker scored critical hit
            if (attackerCriticalHit && weaponProperties && weaponProperties.includes("eletrocutar")) {
              await Eletrocutar.applyShockedEffect(actor, weaponName || "arma elétrica");
            }
            
            // Apply fracture if weapon has "impacto" property and attacker scored critical hit
            if (attackerCriticalHit && weaponProperties && weaponProperties.includes("impacto")) {
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
          const { AdvantageSelectionDialog } = await import('./applications/advantage-selection-dialog.mjs');
          const result = await AdvantageSelectionDialog.show({ 
            hideAttackMode: rollChoice === "evasion" 
          });
          if (!result) return false; // User cancelled
          
          const { rollType } = result;
          
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
          const formula = buildRollFormula(rollType, attribute);
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
          const { CardiganSystemActorSheet } = await import('./sheets/actor-sheet.mjs');
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
          
          // Create flavor text
          const flavor = `
            <div style="text-align: center;">
              <strong>🔄 Re-rolagem de ${attributeName} de ${rollingActorName}</strong> - ${rollDescription}<br>
            </div>
          `;
          
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
          
          // Create message data
          const messageData = {
            speaker: { alias: rollingActorName },
            flavor: flavor,
            rolls: [roll],
            flags: messageFlags
          };
          
          // Use GM roll mode
          const rollMode = "gmroll";
          ChatMessage.applyRollMode(messageData, rollMode);
          
          // Create the chat message
          await ChatMessage.create(messageData);
          
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
          tooltipElement.classList.add('visible');
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

/* -------------------------------------------- */
/*  Trade System - Global Map                   */
/* -------------------------------------------- */

// Global Map to track active trade dialogs
const activeTradeDialogs = new Map();

// Export to global scope so actor-sheet can access it
globalThis.cardiganActiveTradeDialogs = activeTradeDialogs;

// Global Map to track active merchant trade dialogs
const activeMerchantTrades = new Map();

// Export to global scope so actor-sheet can access it
globalThis.cardiganActiveMerchantTrades = activeMerchantTrades;

/**
 * Handle incoming trade request
 * @param {Object} data - Trade request data
 */
async function handleTradeRequest(data) {
  const { tradeId, initiatorId, targetId } = data;
  
  // Check if this user owns the target actor
  const targetActor = game.actors.get(targetId);
  if (!targetActor) return;
  
  // Only show dialog to users who have explicit ownership of this character
  // GMs should only see if they are in the list of owners or if it's their assigned character
  const ownerIds = Object.entries(targetActor.ownership || {})
    .filter(([userId, level]) => level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && userId !== "default")
    .map(([userId]) => userId);
  
  const isOwner = ownerIds.includes(game.user.id);
  const isAssignedCharacter = game.user.character?.id === targetId;
  
  // If not owner and not assigned character, don't show dialog
  if (!isOwner && !isAssignedCharacter) return;
  
  const initiatorActor = game.actors.get(initiatorId);
  if (!initiatorActor) return;
  
  // Ask for confirmation
  const accept = await foundry.applications.api.DialogV2.confirm({
    window: {
      title: "Solicitação de Negociação",
      icon: "fa-solid fa-handshake"
    },
    content: `
      <p style="margin-bottom: 12px;">
        <strong>${initiatorActor.name}</strong> quer negociar items com você!
      </p>
      <p>Deseja aceitar?</p>
    `,
    rejectClose: false,
    modal: true
  });
  
  if (!accept) {
    // Send rejection
    game.socket.emit('system.cardigan', {
      action: 'tradeRejected',
      data: {
        tradeId: tradeId,
        rejectedBy: targetActor.name
      }
    });
    return;
  }
  
  // Accept - emit acceptance event to open dialog for both players
  game.socket.emit('system.cardigan', {
    action: 'tradeAccepted',
    data: {
      tradeId: tradeId,
      initiatorId: initiatorId,
      targetId: targetId
    }
  });
  
  // Also open dialog locally for the target (socket doesn't deliver to sender)
  const { TradeDialog } = await import('./applications/trade-dialog.mjs');
  const tradeDialog = new TradeDialog({
    tradeId: tradeId,
    initiator: initiatorActor,
    target: targetActor,
    isInitiator: false
  });
  
  activeTradeDialogs.set(tradeId, tradeDialog);
  tradeDialog.render(true);
}

/**
 * Handle trade acceptance - open dialog for initiator
 * @param {Object} data - Acceptance data
 */
async function handleTradeAccepted(data) {
  const { tradeId, initiatorId, targetId } = data;
  
  // Check if this user owns the initiator actor
  const initiatorActor = game.actors.get(initiatorId);
  if (!initiatorActor) return;
  
  // Only show dialog to users who have explicit ownership of the initiator
  const ownerIds = Object.entries(initiatorActor.ownership || {})
    .filter(([userId, level]) => level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && userId !== "default")
    .map(([userId]) => userId);
  
  const isOwner = ownerIds.includes(game.user.id);
  const isAssignedCharacter = game.user.character?.id === initiatorId;
  
  // If not owner and not assigned character, don't show dialog
  if (!isOwner && !isAssignedCharacter) return;
  
  const targetActor = game.actors.get(targetId);
  if (!targetActor) return;
  
  // Open trade dialog for initiator
  const { TradeDialog } = await import('./applications/trade-dialog.mjs');
  const tradeDialog = new TradeDialog({
    tradeId: tradeId,
    initiator: initiatorActor,
    target: targetActor,
    isInitiator: true
  });
  
  activeTradeDialogs.set(tradeId, tradeDialog);
  tradeDialog.render(true);
  
  ui.notifications.success(`${targetActor.name} aceitou a negociação!`);
}

/**
 * Handle trade rejection
 * @param {Object} data - Rejection data
 */
function handleTradeRejected(data) {
  const { tradeId, rejectedBy } = data;
  
  ui.notifications.warn(`${rejectedBy} recusou a negociação.`);
  
  // Close initiator's dialog if open
  const dialog = activeTradeDialogs.get(tradeId);
  if (dialog) {
    dialog.close();
    activeTradeDialogs.delete(tradeId);
  }
}

/**
 * Handle trade state update from other player
 * @param {Object} data - Trade update data
 */
function handleTradeUpdate(data) {
  const { tradeId, state } = data;
  
  const dialog = activeTradeDialogs.get(tradeId);
  if (dialog) {
    dialog.updateTradeState(state);
  }
}

/**
 * Handle trade confirmation from other player
 * @param {Object} data - Confirmation data
 */
async function handleTradeConfirm(data) {
  const { tradeId, side, gold } = data;
  
  const dialog = activeTradeDialogs.get(tradeId);
  if (dialog) {
    await dialog.handleConfirmation(side, gold);
  }
}

/**
 * Handle trade undo from other player
 * @param {Object} data - Undo data
 */
function handleTradeUndo(data) {
  const { tradeId, side } = data;
  
  const dialog = activeTradeDialogs.get(tradeId);
  if (dialog) {
    if (side === 'initiator') {
      dialog.tradeState.initiatorConfirmed = false;
    } else if (side === 'target') {
      dialog.tradeState.targetConfirmed = false;
    }
    dialog.render();
  }
}

/**
 * Handle trade cancellation
 * @param {Object} data - Cancellation data
 */
function handleTradeCancel(data) {
  const { tradeId, cancelledBy } = data;
  
  const dialog = activeTradeDialogs.get(tradeId);
  if (dialog) {
    dialog.close();
    activeTradeDialogs.delete(tradeId);
  }
  
  // Notification is handled by the canceller
}

/**
 * Handle trade completion
 * @param {Object} data - Completion data
 */
function handleTradeComplete(data) {
  const { tradeId } = data;
  
  console.log('[CARDIGAN TRADE COMPLETE] Attempting to close trade:', tradeId);
  console.log('[CARDIGAN TRADE COMPLETE] Active dialogs:', Array.from(activeTradeDialogs.keys()));
  
  const dialog = activeTradeDialogs.get(tradeId);
  if (dialog) {
    console.log('[CARDIGAN TRADE COMPLETE] Dialog found, closing...');
    ui.notifications.info("Negociação concluída com sucesso!");
    dialog.close();
    activeTradeDialogs.delete(tradeId);
  } else {
    console.warn('[CARDIGAN TRADE COMPLETE] Dialog not found in activeTradeDialogs!');
  }
}

/**
 * Handle trade transfer execution (GM only)
 * @param {Object} data - Trade transfer data
 */
// Global execution tracker to prevent duplicate GM executions
const tradeExecutionTracker = new Map();

async function handleExecuteTradeTransfer(data) {
  const { tradeId, initiatorId, targetId, initiatorItems, targetItems, initiatorGold, targetGold } = data;
  
  // Check if this trade was already executed recently (within 3 seconds)
  const lastExecution = tradeExecutionTracker.get(tradeId);
  if (lastExecution && (Date.now() - lastExecution) < 3000) {
    console.log('[CARDIGAN TRADE GM] Trade already executed recently, ignoring duplicate:', tradeId);
    return;
  }
  
  // Mark this trade as executing
  tradeExecutionTracker.set(tradeId, Date.now());
  
  try {
    const initiator = game.actors.get(initiatorId);
    const target = game.actors.get(targetId);
    
    if (!initiator || !target) {
      console.error('[CARDIGAN TRADE] Actors not found');
      tradeExecutionTracker.delete(tradeId);
      return;
    }
    
    console.log('[CARDIGAN TRADE GM] Starting transfer...', { initiatorItems, targetItems });
    
    // Transfer items from initiator to target
    for (const tradeItem of initiatorItems) {
      const sourceItem = initiator.items.get(tradeItem.id);
      if (!sourceItem) continue;
      
      console.log(`[CARDIGAN TRADE GM] Processing item: ${sourceItem.name} (qty: ${tradeItem.quantity})`);
      
      // Unequip if equipped
      if (sourceItem.system.equipped) {
        await sourceItem.update({ 'system.equipped': false });
      }
      
      // Check if target already has this item (same name and type)
      // Force refresh the items collection to get the latest state
      const existingItem = target.items.find(i => 
        i.name === sourceItem.name && 
        i.type === sourceItem.type &&
        !i.system.equipped // Only stack with unequipped items
      );
      
      console.log(`[CARDIGAN TRADE GM] Existing item found:`, existingItem ? `${existingItem.name} (qty: ${existingItem.system.quantity})` : 'none');
      
      if (existingItem) {
        // Item exists, just add to quantity
        const newQuantity = (existingItem.system.quantity || 1) + tradeItem.quantity;
        console.log(`[CARDIGAN TRADE GM] Updating quantity: ${existingItem.system.quantity} → ${newQuantity}`);
        await existingItem.update({ 'system.quantity': newQuantity });
      } else {
        // Item doesn't exist, create new
        const itemData = sourceItem.toObject();
        itemData.system.quantity = tradeItem.quantity;
        itemData.system.equipped = false;
        
        console.log(`[CARDIGAN TRADE GM] Creating new item: ${itemData.name} (qty: ${itemData.system.quantity})`);
        
        // Create and wait for the operation to complete fully
        const created = await target.createEmbeddedDocuments('Item', [itemData]);
        
        console.log(`[CARDIGAN TRADE GM] Item created:`, created[0]?.name);
        
        // Wait for the actor's items collection to be fully updated
        // Increased from 50ms to 100ms for better synchronization
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Update or delete from source
      const remainingQty = (sourceItem.system.quantity || 1) - tradeItem.quantity;
      if (remainingQty <= 0) {
        await sourceItem.delete();
      } else {
        await sourceItem.update({ 'system.quantity': remainingQty });
      }
    }
    
    // Transfer items from target to initiator
    for (const tradeItem of targetItems) {
      const sourceItem = target.items.get(tradeItem.id);
      if (!sourceItem) continue;
      
      // Unequip if equipped
      if (sourceItem.system.equipped) {
        await sourceItem.update({ 'system.equipped': false });
      }
      
      // Check if initiator already has this item (same name and type)
      // Force refresh the items collection to get the latest state
      const existingItem = initiator.items.find(i => 
        i.name === sourceItem.name && 
        i.type === sourceItem.type &&
        !i.system.equipped // Only stack with unequipped items
      );
      
      if (existingItem) {
        // Item exists, just add to quantity
        const newQuantity = (existingItem.system.quantity || 1) + tradeItem.quantity;
        await existingItem.update({ 'system.quantity': newQuantity });
      } else {
        // Item doesn't exist, create new
        const itemData = sourceItem.toObject();
        itemData.system.quantity = tradeItem.quantity;
        itemData.system.equipped = false;
        
        // Create and wait for the operation to complete fully
        const created = await initiator.createEmbeddedDocuments('Item', [itemData]);
        
        // Wait for the actor's items collection to be fully updated
        // Increased from 50ms to 100ms for better synchronization
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Update or delete from source
      const remainingQty = (sourceItem.system.quantity || 1) - tradeItem.quantity;
      if (remainingQty <= 0) {
        await sourceItem.delete();
      } else {
        await sourceItem.update({ 'system.quantity': remainingQty });
      }
    }
    
    // Transfer gold from initiator to target
    if (initiatorGold > 0) {
      const initiatorCurrentGold = initiator.system.money || 0;
      const targetCurrentGold = target.system.money || 0;
      
      await initiator.update({
        'system.money': initiatorCurrentGold - initiatorGold
      });
      
      await target.update({
        'system.money': targetCurrentGold + initiatorGold
      });
    }
    
    // Transfer gold from target to initiator
    if (targetGold > 0) {
      const initiatorCurrentGold = initiator.system.money || 0;
      const targetCurrentGold = target.system.money || 0;
      
      await target.update({
        'system.money': targetCurrentGold - targetGold
      });
      
      await initiator.update({
        'system.money': initiatorCurrentGold + targetGold
      });
    }
    
    // Create success message in chat
    let content = `
      <div style="border: 2px solid #28a745; border-radius: 4px; padding: 12px; background: rgba(40, 167, 69, 0.1);">
        <h3 style="margin: 0 0 8px 0; color: #28a745;">
          <i class="fas fa-handshake"></i> NEGOCIAÇÃO CONCLUÍDA
        </h3>
    `;
    
    // Initiator gave
    if (initiatorItems.length > 0 || initiatorGold > 0) {
      content += `<p style="margin: 8px 0;"><strong>${initiator.name}</strong> → <strong>${target.name}</strong>:</p><ul style="margin: 4px 0;">`;
      
      initiatorItems.forEach(item => {
        content += `<li>${item.name} (x${item.quantity})</li>`;
      });
      
      if (initiatorGold > 0) {
        content += `<li>${initiatorGold} PO</li>`;
      }
      
      content += `</ul>`;
    }
    
    // Target gave
    if (targetItems.length > 0 || targetGold > 0) {
      content += `<p style="margin: 8px 0;"><strong>${target.name}</strong> → <strong>${initiator.name}</strong>:</p><ul style="margin: 4px 0;">`;
      
      targetItems.forEach(item => {
        content += `<li>${item.name} (x${item.quantity})</li>`;
      });
      
      if (targetGold > 0) {
        content += `<li>${targetGold} PO</li>`;
      }
      
      content += `</ul>`;
    }
    
    content += `</div>`;
    
    await ChatMessage.create({
      content,
      speaker: { alias: "Sistema de Negociação" }
    });
    
    // Close the dialog locally (for GM)
    handleTradeComplete({ tradeId: tradeId });
    
    // Emit completion to all OTHER players (socket doesn't deliver to sender)
    game.socket.emit('system.cardigan', {
      action: 'tradeComplete',
      data: { tradeId: tradeId }
    });
    
    // Clean up execution tracker after 5 seconds
    setTimeout(() => {
      tradeExecutionTracker.delete(tradeId);
      console.log('[CARDIGAN TRADE GM] Cleaned up execution tracker for:', tradeId);
    }, 5000);
    
  } catch (error) {
    console.error('[CARDIGAN TRADE GM] Error executing trade transfer:', error);
    // Clean up tracker immediately on error
    tradeExecutionTracker.delete(tradeId);
  }
}

/* -------------------------------------------- */
/*  Merchant Trade System Handlers              */
/* -------------------------------------------- */

/**
 * Handle merchant trade request (customer receives)
 * @param {Object} data - Merchant trade request data
 */
async function handleMerchantTradeRequest(data) {
  const { tradeId, merchantId, customerId } = data;
  
  // Check if this user owns the customer actor
  const customerActor = game.actors.get(customerId);
  if (!customerActor) return;
  
  // Only show dialog to users who have ownership of the customer
  const ownerIds = Object.entries(customerActor.ownership || {})
    .filter(([userId, level]) => level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && userId !== "default")
    .map(([userId]) => userId);
  
  const isOwner = ownerIds.includes(game.user.id);
  const isAssignedCharacter = game.user.character?.id === customerId;
  
  if (!isOwner && !isAssignedCharacter) return;
  
  const merchantActor = game.actors.get(merchantId);
  if (!merchantActor) return;
  
  // Ask for confirmation
  const accept = await foundry.applications.api.DialogV2.confirm({
    window: {
      title: "Solicitação de Comércio",
      icon: "fa-solid fa-store"
    },
    content: `
      <p style="margin-bottom: 12px;">
        <strong>${merchantActor.name}</strong> quer vender items para você!
      </p>
      <p>Deseja aceitar?</p>
    `,
    rejectClose: false,
    modal: true
  });
  
  if (!accept) {
    // Send rejection
    game.socket.emit('system.cardigan', {
      action: 'merchantTradeRejected',
      data: {
        tradeId: tradeId,
        rejectedBy: customerActor.name
      }
    });
    return;
  }
  
  // Accept - emit to open dialog for both
  game.socket.emit('system.cardigan', {
    action: 'merchantTradeAccepted',
    data: {
      tradeId: tradeId,
      merchantId: merchantId,
      customerId: customerId,
      merchantOwnerId: data.merchantOwnerId,
      customerOwnerId: game.user.id
    }
  });
  
  // Open dialog locally for customer
  const { MerchantTradeDialog } = await import('./applications/merchant-trade-dialog.mjs');
  const dialog = new MerchantTradeDialog({
    customer: customerActor,
    merchant: merchantActor,
    customerOwnerId: game.user.id,
    merchantOwnerId: data.merchantOwnerId
  });
  
  dialog.tradeId = tradeId;
  activeMerchantTrades.set(tradeId, dialog);
  dialog.render(true);
}

/**
 * Handle merchant trade acceptance (merchant receives)
 * @param {Object} data - Acceptance data
 */
async function handleMerchantTradeAccepted(data) {
  const { tradeId, merchantId, customerId, merchantOwnerId, customerOwnerId } = data;
  
  // Check if this user is the merchant owner
  if (game.user.id !== merchantOwnerId) return;
  
  const merchantActor = game.actors.get(merchantId);
  const customerActor = game.actors.get(customerId);
  
  if (!merchantActor || !customerActor) return;
  
  // Open merchant dialog
  const { MerchantTradeDialog } = await import('./applications/merchant-trade-dialog.mjs');
  const dialog = new MerchantTradeDialog({
    customer: customerActor,
    merchant: merchantActor,
    customerOwnerId: customerOwnerId,
    merchantOwnerId: merchantOwnerId
  });
  
  dialog.tradeId = tradeId;
  activeMerchantTrades.set(tradeId, dialog);
  dialog.render(true);
  
  ui.notifications.success(`${customerActor.name} aceitou o comércio!`);
}

/**
 * Handle merchant trade rejection
 * @param {Object} data - Rejection data
 */
function handleMerchantTradeRejected(data) {
  const { tradeId, rejectedBy } = data;
  
  ui.notifications.warn(`${rejectedBy} recusou o comércio.`);
  
  const dialog = activeMerchantTrades.get(tradeId);
  if (dialog) {
    dialog.close();
    activeMerchantTrades.delete(tradeId);
  }
}

/**
 * Handle merchant trade update
 * @param {Object} data - Update data
 */
function handleMerchantTradeUpdate(data) {
  const { tradeId, customerOfferedItems, customerRequestedItems, customerOfferedGold, merchantGold } = data;
  
  console.log('[CARDIGAN MERCHANT TRADE UPDATE] Received:', {
    tradeId,
    customerOfferedItems,
    customerRequestedItems,
    customerOfferedGold,
    merchantGold
  });
  
  const dialog = activeMerchantTrades.get(tradeId);
  if (dialog) {
    dialog.tradeState.customerOfferedItems = customerOfferedItems || [];
    dialog.tradeState.customerRequestedItems = customerRequestedItems || [];
    dialog.tradeState.customerOfferedGold = customerOfferedGold || 0;
    dialog.tradeState.merchantGold = merchantGold || 0;
    console.log('[CARDIGAN MERCHANT TRADE UPDATE] Updated dialog state, re-rendering...');
    dialog.render();
  } else {
    console.warn('[CARDIGAN MERCHANT TRADE UPDATE] Dialog not found for tradeId:', tradeId);
  }
}

/**
 * Handle merchant trade confirmation
 * @param {Object} data - Confirmation data
 */
async function handleMerchantTradeConfirm(data) {
  const { tradeId, side, gold } = data;
  
  const dialog = activeMerchantTrades.get(tradeId);
  if (dialog) {
    await dialog.handleConfirmation(side, gold);
  }
}

/**
 * Handle merchant trade undo confirmation
 * @param {Object} data - Undo data
 */
function handleMerchantTradeUndo(data) {
  const { tradeId, side } = data;
  
  const dialog = activeMerchantTrades.get(tradeId);
  if (dialog) {
    // Update confirmation state
    if (side === 'customer') {
      dialog.tradeState.customerConfirmed = false;
    } else if (side === 'merchant') {
      dialog.tradeState.merchantConfirmed = false;
    }
    
    // Re-render dialog
    dialog.render();
  }
}

/**
 * Handle merchant trade cancellation
 * @param {Object} data - Cancellation data
 */
function handleMerchantTradeCancel(data) {
  const { tradeId, cancelledBy } = data;
  
  const dialog = activeMerchantTrades.get(tradeId);
  if (dialog) {
    dialog.close();
    activeMerchantTrades.delete(tradeId);
  }
}

/**
 * Handle merchant trade completion
 * @param {Object} data - Completion data
 */
function handleMerchantTradeComplete(data) {
  const { tradeId } = data;
  
  console.log('[CARDIGAN MERCHANT TRADE COMPLETE] Closing trade:', tradeId);
  
  const dialog = activeMerchantTrades.get(tradeId);
  if (dialog) {
    ui.notifications.info("Comércio concluído com sucesso!");
    dialog.close();
    activeMerchantTrades.delete(tradeId);
  }
}

/**
 * Execute merchant trade transfer (GM only)
 * @param {Object} data - Transfer data
 */
const merchantTradeExecutionTracker = new Map();

async function handleExecuteMerchantTradeTransfer(data) {
  console.log('[CARDIGAN MERCHANT TRADE GM] Received transfer request:', data);
  
  // Only GM should execute transfers
  if (!game.user.isGM) {
    console.log('[CARDIGAN MERCHANT TRADE GM] Non-GM received transfer request, ignoring');
    return;
  }
  
  const { tradeId, customerId, merchantId, customerOfferedItems, customerRequestedItems, customerOfferedGold, merchantGold } = data;
  
  // Check if already executed
  const lastExecution = merchantTradeExecutionTracker.get(tradeId);
  if (lastExecution && (Date.now() - lastExecution) < 3000) {
    console.log('[CARDIGAN MERCHANT TRADE GM] Already executed, ignoring duplicate:', tradeId);
    return;
  }
  
  merchantTradeExecutionTracker.set(tradeId, Date.now());
  
  try {
    const customer = game.actors.get(customerId);
    const merchant = game.actors.get(merchantId);
    
    if (!customer || !merchant) {
      console.error('[CARDIGAN MERCHANT TRADE GM] Actors not found');
      merchantTradeExecutionTracker.delete(tradeId);
      return;
    }
    
    console.log('[CARDIGAN MERCHANT TRADE GM] Starting transfer...');
    
    // Transfer items from customer to merchant (customerOfferedItems)
    for (const tradeItem of customerOfferedItems) {
      const sourceItem = customer.items.get(tradeItem.id);
      if (!sourceItem) continue;
      
      if (sourceItem.system.equipped) {
        await sourceItem.update({ 'system.equipped': false });
      }
      
      const existingItem = merchant.items.find(i => 
        i.name === sourceItem.name && 
        i.type === sourceItem.type &&
        !i.system.equipped
      );
      
      if (existingItem) {
        const newQuantity = (existingItem.system.quantity || 1) + tradeItem.quantity;
        await existingItem.update({ 'system.quantity': newQuantity });
      } else {
        const itemData = sourceItem.toObject();
        itemData.system.quantity = tradeItem.quantity;
        itemData.system.equipped = false;
        await merchant.createEmbeddedDocuments('Item', [itemData]);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const remainingQty = (sourceItem.system.quantity || 1) - tradeItem.quantity;
      if (remainingQty <= 0) {
        await sourceItem.delete();
      } else {
        await sourceItem.update({ 'system.quantity': remainingQty });
      }
    }
    
    // Transfer items from merchant to customer (customerRequestedItems)
    for (const tradeItem of customerRequestedItems) {
      const sourceItem = merchant.items.get(tradeItem.id);
      if (!sourceItem) continue;
      
      if (sourceItem.system.equipped) {
        await sourceItem.update({ 'system.equipped': false });
      }
      
      const existingItem = customer.items.find(i => 
        i.name === sourceItem.name && 
        i.type === sourceItem.type &&
        !i.system.equipped
      );
      
      if (existingItem) {
        const newQuantity = (existingItem.system.quantity || 1) + tradeItem.quantity;
        await existingItem.update({ 'system.quantity': newQuantity });
      } else {
        const itemData = sourceItem.toObject();
        itemData.system.quantity = tradeItem.quantity;
        itemData.system.equipped = false;
        await customer.createEmbeddedDocuments('Item', [itemData]);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const remainingQty = (sourceItem.system.quantity || 1) - tradeItem.quantity;
      if (remainingQty <= 0) {
        await sourceItem.delete();
      } else {
        await sourceItem.update({ 'system.quantity': remainingQty });
      }
    }
    
    // Transfer gold from customer to merchant
    if (customerOfferedGold > 0) {
      const customerCurrentGold = customer.system.money || 0;
      const merchantCurrentGold = merchant.system.money || 0;
      
      await customer.update({ 'system.money': customerCurrentGold - customerOfferedGold });
      await merchant.update({ 'system.money': merchantCurrentGold + customerOfferedGold });
    }
    
    // Transfer gold from merchant to customer
    if (merchantGold > 0) {
      const customerCurrentGold = customer.system.money || 0;
      const merchantCurrentGold = merchant.system.money || 0;
      
      await merchant.update({ 'system.money': merchantCurrentGold - merchantGold });
      await customer.update({ 'system.money': customerCurrentGold + merchantGold });
    }
    
    // Create chat message
    let content = `
      <div style="border: 2px solid #28a745; border-radius: 4px; padding: 12px; background: rgba(40, 167, 69, 0.1);">
        <h3 style="margin: 0 0 8px 0; color: #28a745;">
          <i class="fas fa-store"></i> COMÉRCIO CONCLUÍDO
        </h3>
    `;
    
    if (customerOfferedItems.length > 0 || customerOfferedGold > 0) {
      content += `<p style="margin: 8px 0;"><strong>${customer.name}</strong> → <strong>${merchant.name}</strong>:</p><ul style="margin: 4px 0;">`;
      
      customerOfferedItems.forEach(item => {
        content += `<li>${item.name} (x${item.quantity})</li>`;
      });
      
      if (customerOfferedGold > 0) {
        content += `<li>${customerOfferedGold} PO</li>`;
      }
      
      content += `</ul>`;
    }
    
    if (customerRequestedItems.length > 0 || merchantGold > 0) {
      content += `<p style="margin: 8px 0;"><strong>${merchant.name}</strong> → <strong>${customer.name}</strong>:</p><ul style="margin: 4px 0;">`;
      
      customerRequestedItems.forEach(item => {
        content += `<li>${item.name} (x${item.quantity})</li>`;
      });
      
      if (merchantGold > 0) {
        content += `<li>${merchantGold} PO</li>`;
      }
      
      content += `</ul>`;
    }
    
    content += `</div>`;
    
    await ChatMessage.create({
      content,
      speaker: { alias: "Sistema de Comércio" }
    });
    
    // Close dialog locally
    handleMerchantTradeComplete({ tradeId: tradeId });
    
    // Emit completion to other players
    game.socket.emit('system.cardigan', {
      action: 'merchantTradeComplete',
      data: { tradeId: tradeId }
    });
    
    setTimeout(() => {
      merchantTradeExecutionTracker.delete(tradeId);
    }, 5000);
    
  } catch (error) {
    console.error('[CARDIGAN MERCHANT TRADE GM] Error:', error);
    merchantTradeExecutionTracker.delete(tradeId);
  }
}

// Expose function globally for direct calling
globalThis.handleExecuteMerchantTradeTransfer = handleExecuteMerchantTradeTransfer;

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => createDocMacro(data, slot));
  
  // Initialize tooltips observer
  game.cardigan.tooltips.observe();
  
  // Register trade system socket listeners
  game.socket.on('system.cardigan', async (data) => {
    console.log('[CARDIGAN SOCKET] Received:', data);
    
    switch (data.action) {
      case 'tradeRequest':
        await handleTradeRequest(data.data);
        break;
      case 'tradeAccepted':
        await handleTradeAccepted(data.data);
        break;
      case 'tradeRejected':
        handleTradeRejected(data.data);
        break;
      case 'tradeUpdate':
        handleTradeUpdate(data.data);
        break;
      case 'tradeConfirm':
        await handleTradeConfirm(data.data);
        break;
      case 'tradeUndo':
        handleTradeUndo(data.data);
        break;
      case 'tradeCancel':
        handleTradeCancel(data.data);
        break;
      case 'tradeComplete':
        handleTradeComplete(data.data);
        break;
      case 'executeTradeTransfer':
        if (game.user.isGM) {
          await handleExecuteTradeTransfer(data.data);
        }
        break;
      
      // Merchant trade system
      case 'merchantTradeRequest':
        await handleMerchantTradeRequest(data.data);
        break;
      case 'merchantTradeAccepted':
        await handleMerchantTradeAccepted(data.data);
        break;
      case 'merchantTradeRejected':
        handleMerchantTradeRejected(data.data);
        break;
      case 'merchantTradeUpdate':
        handleMerchantTradeUpdate(data.data);
        break;
      case 'merchantTradeConfirm':
        await handleMerchantTradeConfirm(data.data);
        break;
      case 'merchantTradeUndo':
        handleMerchantTradeUndo(data.data);
        break;
      case 'merchantTradeCancel':
        handleMerchantTradeCancel(data.data);
        break;
      case 'merchantTradeComplete':
        handleMerchantTradeComplete(data.data);
        break;
      case 'executeMerchantTradeTransfer':
        if (game.user.isGM) {
          await handleExecuteMerchantTradeTransfer(data.data);
        }
        break;
      
      // Existing combat system handlers
      case 'createGMEvasionNotification':
        if (game.user.isGM) {
          await createGMEvasionNotification(data.data);
        }
        break;
      case 'createAttackerResultDialog':
        await createAttackerResultDialog(data.data);
        break;
      case 'closeAttackDialogForAttacker':
        closeAttackDialogForAttacker(data.data);
        break;
      case 'showDamageNotification':
        showDamageNotification(data.data);
        break;
      case 'showArmorDurabilityNotification':
        showArmorDurabilityNotification(data.data);
        break;
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
  precisionSection.style.cssText = 'margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.1);';

  // Check if current user can attack (owns the attacker)
  const attackerToken = game.scenes.current?.tokens.get(precisionData.tokenId);
  if (!attackerToken) return;
  
  const ownsToken = attackerToken.isOwner || game.user.isGM;
  const ownsActor = attackerToken.actor && (attackerToken.actor.isOwner || game.user.isGM);
  
  if (!ownsToken && !ownsActor) return;

  // Create precision button
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'margin-top: 4px; text-align: center;';

  const button = document.createElement('button');
  button.className = 'cardigan-precision-button';
  button.dataset.messageId = message.id;
  button.dataset.tokenId = precisionData.tokenId;
  button.dataset.actorId = precisionData.actorId;
  button.dataset.evasionTotal = evasionTotal;
  button.style.cssText = 'padding: 4px 12px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;';
  button.textContent = 'Rolar Precisão';
  
  button.addEventListener('click', () => handlePrecisionClick(button));
  buttonContainer.appendChild(button);
  precisionSection.appendChild(buttonContainer);

  // Add precision section to message
  const messageContent = html.querySelector('.message-content');
  if (messageContent) {
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
    const formula = buildRollFormula(rollType, "@evasion.total");
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

    // Create flavor text
    const flavor = `
      <div style="text-align: center;">
        <strong>Evasão de ${token.name}</strong> - ${rollDescription}<br>
      </div>
    `;

    // Use player's roll mode setting (GM can choose blind manually)
    const rollMode = game.settings.get('core', 'rollMode');

    // Create message data with critical flags
    const messageData = {
      speaker: { alias: token.name },
      flavor: flavor,
      rolls: [roll],
      flags: {
        cardigan: {
          criticalSuccess: criticalSuccess,
          criticalFailure: criticalFailure
        }
      }
    };

    // Apply roll mode using Foundry's official API method
    ChatMessage.applyRollMode(messageData, rollMode);
    
    // Create the chat message
    const chatMessage = await ChatMessage.create(messageData);

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

    const { rollType } = result;

    // Import buildRollFormula helper
    const { buildRollFormula } = await import('./helpers/config.mjs');
    
    // Build roll formula
    const formula = buildRollFormula(rollType, `@abilities.accuracy.total`);
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

    // Create chat message with roll
    const flavor = `
      <div style="text-align: center;">
        <strong>🎯 Re-rolagem de Precisão de ${actor.name}</strong>
      </div>
    `;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: flavor,
      rolls: [roll],
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
