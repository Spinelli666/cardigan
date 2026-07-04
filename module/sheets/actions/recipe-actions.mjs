/**
 * Recipe Actions Module
 * Handles cooking and crafting from recipe items
 */

import { RecipeCraftingDialog } from '../../applications/recipe-crafting-dialog.mjs';

export class RecipeActions {

  /**
   * Cook a recipe item to create a consumable
   * @param {Actor} actor - The actor performing the cooking
   * @param {Item} recipe - The recipe item
   */
  static async cookRecipe(actor, recipe) {
    try {
      console.log("[RECIPES] Cooking recipe:", recipe.name);

      if (recipe.type !== "item-recipe") {
        ui.notifications.error("Invalid recipe item.");
        return;
      }

      const confirmed = await foundry.applications.api.DialogV2.confirm({
        title: `Cook ${recipe.name}?`,
        content: `
          <div style="margin-bottom: 15px;">
            <p>Do you want to cook <strong>"${recipe.name}"</strong>?</p>
            <div style="background: rgba(43, 24, 16, 0.3); padding: 10px; border-radius: 5px; margin-top: 10px;">
              <p><strong>Difficulty:</strong> ${game.i18n.localize(`CARDIGAN.Item.ItemRecipe.difficulty.${recipe.system.difficulty}`)}</p>
              <p><strong>Cooking Time:</strong> ${recipe.system.cookingTime} minutes</p>
              <p><strong>Servings:</strong> ${recipe.system.servings}</p>
              ${recipe.system.ingredients ? `<p><strong>Ingredients:</strong> ${recipe.system.ingredients}</p>` : ''}
            </div>
          </div>
        `,
        yes: () => true,
        no: () => false,
        defaultYes: true
      });

      if (!confirmed) {
        console.log("[RECIPES] Cooking cancelled by user");
        return;
      }

      let qualityName = null;
      let qualityDice = null;
      let qualityRoll = null;

      if (recipe.system.recipeType === "culinary") {
        qualityRoll = await new Roll("1d20").evaluate();
        await qualityRoll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: `🎲 Rolagem de Qualidade - ${recipe.name}`
        });

        const rollTotal = qualityRoll.total;

        if (rollTotal <= 5) {
          qualityName = "Ruim";
          qualityDice = "1d6";
        } else if (rollTotal <= 10) {
          qualityName = "Simples";
          qualityDice = "1d8";
        } else if (rollTotal <= 15) {
          qualityName = "Boa";
          qualityDice = "1d10";
        } else {
          qualityName = "Incrível";
          qualityDice = "1d12";
        }

        console.log(`[RECIPES] Quality roll: ${rollTotal} → ${qualityName} (${qualityDice} PVT)`);
      }

      const finalItemName = qualityName ? `${recipe.name} (${qualityName})` : recipe.name;

      const existingConsumable = actor.items.find(item =>
        item.type === "item-consumivel" &&
        item.name === finalItemName
      );

      let resultItem;
      let isNewItem = false;

      if (existingConsumable) {
        const currentQuantity = existingConsumable.system.quantity || 1;
        const servingsToAdd = recipe.system.servings || 1;
        const newQuantity = currentQuantity + servingsToAdd;

        await existingConsumable.update({
          "system.quantity": newQuantity
        });

        resultItem = existingConsumable;
        console.log(`[RECIPES] Increased quantity of "${finalItemName}" from ${currentQuantity} to ${newQuantity}`);
        ui.notifications.info(`Added ${servingsToAdd} more "${finalItemName}" to your backpack! (Total: ${newQuantity})`);

      } else {
        const consumableData = {
          name: finalItemName,
          type: "item-consumivel",
          img: recipe.img,
          system: {
            quantity: recipe.system.servings || 1,
            weight: recipe.system.weight || "light",
            price: Math.ceil(recipe.system.price / 2) || 1,
            effects: []
          }
        };

        // If recipe has effects, add them to description
        if (recipe.system.effects) {
          consumableData.system.description = `<p><strong>Recipe Effects:</strong></p><p>${recipe.system.effects}</p>`;
        }

        const newConsumable = await actor.createEmbeddedDocuments("Item", [consumableData]);
        resultItem = newConsumable[0];
        isNewItem = true;

        console.log("[RECIPES] Created new consumable from recipe:", resultItem);
        ui.notifications.info(`Successfully cooked "${finalItemName}"! Check your equipment backpack.`);
      }

      const actionText = isNewItem ? "cooked" : "added more";
      const quantityText = isNewItem ? resultItem.system.quantity : `+${recipe.system.servings || 1} (Total: ${resultItem.system.quantity})`;

      let qualityInfo = '';
      if (qualityName && qualityRoll) {
        const qualityColors = {
          "Ruim": "#8B0000",
          "Simples": "#696969",
          "Boa": "#4169E1",
          "Incrível": "#FFD700"
        };
        const color = qualityColors[qualityName] || "#FFFFFF";

        qualityInfo = `
          <p style="margin: 2px 0;">
            <strong>Quality Roll:</strong>
            <span style="color: ${color}; font-weight: bold;">${qualityRoll.total}</span> →
            <span style="color: ${color}; font-weight: bold;">${qualityName}</span>
          </p>
          <p style="margin: 2px 0;"><strong>PVT Restoration:</strong> ${qualityDice}</p>
        `;
      }

      const messageContent = `
        <div class="cardigan-cook-message" style="background: linear-gradient(90deg, #2b1810 0%, #3d2317 100%); border: 2px solid #8B4513; border-radius: 8px; padding: 15px; color: #c9c7b8;">
          <h3 style="color: #d4af37; margin-bottom: 10px;">
            <i class="fas fa-fire" style="margin-right: 8px; color: #ff6b35;"></i>
            Cooking Complete!
          </h3>
          <p><strong>${actor.name}</strong> has ${actionText} <strong>"${resultItem.name}"</strong>!</p>
          <div style="margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px;">
            <p style="margin: 2px 0;"><strong>Recipe:</strong> ${recipe.name}</p>
            <p style="margin: 2px 0;"><strong>Difficulty:</strong> ${game.i18n.localize(`CARDIGAN.Item.ItemRecipe.difficulty.${recipe.system.difficulty}`)}</p>
            ${qualityInfo}
            <p style="margin: 2px 0;"><strong>Servings:</strong> ${quantityText}</p>
          </div>
        </div>
      `;

      ChatMessage.create({
        content: messageContent,
        speaker: ChatMessage.getSpeaker({ actor })
      });

    } catch (error) {
      console.error("[RECIPES] Error cooking recipe:", error);
      ui.notifications.error("Error cooking recipe. Please try again.");
    }
  }

  /**
   * Validate if actor has all required ingredients for a recipe
   * @param {Item} recipe - The recipe item to validate
   * @param {Actor} actor - The actor whose inventory to check
   * @param {number|null} selectedResultIndex - Index of selected result item
   * @returns {Object} Validation result with valid boolean and message
   */
  static validateRecipeIngredients(recipe, actor, selectedResultIndex = null) {
    let requiredIngredients = [];

    if (selectedResultIndex !== null && recipe.system.resultItems && recipe.system.resultItems[selectedResultIndex]) {
      const selectedResult = recipe.system.resultItems[selectedResultIndex];
      requiredIngredients = selectedResult.requiredIngredients || [];
      console.log(`[CRAFTING] Validating ingredients for result item "${selectedResult.name}":`, requiredIngredients);
    } else {
      requiredIngredients = recipe.system.requiredIngredients || [];
      console.log("[CRAFTING] Validating recipe-level ingredients:", requiredIngredients);
    }

    if (requiredIngredients.length === 0) {
      return { valid: true, message: "" };
    }

    const missing = [];
    const insufficient = [];

    for (const required of requiredIngredients) {
      if (!required.name || !required.quantity) continue;

      const searchTerm = required.name.toLowerCase().trim();
      let totalAvailable = 0;

      for (const item of actor.items) {
        const itemName = item.name.toLowerCase();

        if (itemName === searchTerm ||
            itemName.includes(searchTerm) ||
            searchTerm.includes(itemName)) {
          totalAvailable += (item.system.quantity || 1);
        }
      }

      if (totalAvailable === 0) {
        missing.push(required.name);
      } else if (totalAvailable < required.quantity) {
        insufficient.push({
          name: required.name,
          required: required.quantity,
          available: totalAvailable
        });
      }
    }

    if (missing.length > 0 || insufficient.length > 0) {
      let message = `<div style="font-family: monospace;"><strong>🚫 ${game.i18n.localize("CARDIGAN.Crafting.CannotCraft")}</strong><br><br>`;

      if (missing.length > 0) {
        message += `<strong>❌ ${game.i18n.localize("CARDIGAN.Crafting.MissingIngredients")}:</strong><br>`;
        const missingWithQuantity = missing.map(name => {
          const required = requiredIngredients.find(ing => ing.name === name);
          return `&nbsp;&nbsp;&nbsp;• <span style="color: #ff6b6b;">${name}</span> (${game.i18n.localize("CARDIGAN.Crafting.Required")}: <strong>${required?.quantity || 1}</strong>)`;
        });
        message += missingWithQuantity.join('<br>') + "<br><br>";
      }

      if (insufficient.length > 0) {
        message += `<strong>⚠️ ${game.i18n.localize("CARDIGAN.Crafting.InsufficientIngredients")}:</strong><br>`;
        const insufficientDetails = insufficient.map(ing => {
          const stillNeeded = ing.required - ing.available;
          return `&nbsp;&nbsp;&nbsp;• <span style="color: #ffa500;">${ing.name}</span>: ${game.i18n.localize("CARDIGAN.Crafting.Have")} <span style="color: #ff6b6b;">${ing.available}</span>/<strong>${ing.required}</strong> (${game.i18n.localize("CARDIGAN.Crafting.Missing")} <strong style="color: #ff6b6b;">${stillNeeded}</strong>)`;
        });
        message += insufficientDetails.join('<br>');
      }

      const totalMissing = missing.length + insufficient.reduce((sum, ing) => sum + (ing.required - ing.available), 0);
      message += `<br><div style="background: rgba(255,255,255,0.1); padding: 6px; border-radius: 4px; margin-top: 8px;">`;
      message += `<strong>${game.i18n.localize("CARDIGAN.Crafting.Summary")}:</strong> ${totalMissing} ${game.i18n.localize("CARDIGAN.Crafting.ItemsNeeded")}`;
      message += `</div>`;

      message += `<br><div style="background: rgba(100,149,237,0.1); padding: 8px; border-left: 3px solid #6495ed; margin-top: 10px;"><strong>💡 ${game.i18n.localize("CARDIGAN.Crafting.Tip")}</strong></div></div>`;

      return { valid: false, message };
    }

    return { valid: true, message: "" };
  }

  /**
   * Consume required ingredients from actor's inventory
   * @param {Item} recipe - The recipe item
   * @param {Actor} actor - The actor whose ingredients to consume
   * @param {number|null} selectedResultIndex - Index of selected result item
   * @returns {boolean} Whether consumption was successful
   */
  static async consumeRecipeIngredients(recipe, actor, selectedResultIndex = null) {
    let requiredIngredients = [];

    if (selectedResultIndex !== null && recipe.system.resultItems && recipe.system.resultItems[selectedResultIndex]) {
      const selectedResult = recipe.system.resultItems[selectedResultIndex];
      requiredIngredients = selectedResult.requiredIngredients || [];
      console.log(`[CRAFTING] Consuming ingredients for result item "${selectedResult.name}":`, requiredIngredients);
    } else {
      requiredIngredients = recipe.system.requiredIngredients || [];
      console.log("[CRAFTING] Consuming recipe-level ingredients:", requiredIngredients);
    }

    if (requiredIngredients.length === 0) {
      return true;
    }

    try {
      for (const required of requiredIngredients) {
        if (!required.name || !required.quantity) continue;

        const searchTerm = required.name.toLowerCase().trim();
        let remainingToConsume = required.quantity;

        const matchingItems = actor.items.filter(item => {
          const itemName = item.name.toLowerCase();
          return itemName === searchTerm ||
                 itemName.includes(searchTerm) ||
                 searchTerm.includes(itemName);
        }).sort((a, b) => (a.system.quantity || 1) - (b.system.quantity || 1));

        for (const item of matchingItems) {
          if (remainingToConsume <= 0) break;

          const itemQuantity = item.system.quantity || 1;

          if (itemQuantity <= remainingToConsume) {
            await item.delete();
            remainingToConsume -= itemQuantity;
            console.log(`[CRAFTING] Consumed entire stack of ${item.name} (${itemQuantity})`);
          } else {
            await item.update({
              "system.quantity": itemQuantity - remainingToConsume
            });
            console.log(`[CRAFTING] Consumed ${remainingToConsume} of ${item.name}, ${itemQuantity - remainingToConsume} remaining`);
            remainingToConsume = 0;
          }
        }
      }

      return true;
    } catch (error) {
      console.error("[CRAFTING] Error consuming ingredients:", error);
      return false;
    }
  }

  /**
   * Craft an item from a recipe
   * @param {Actor} actor - The actor performing the crafting
   * @param {Item} recipe - The recipe item
   * @param {string} recipeType - The type of recipe
   */
  static async craftFromRecipe(actor, recipe, recipeType) {
    try {
      const result = await RecipeCraftingDialog.show(actor, recipe, recipeType);
      console.log("[CRAFTING] Dialog result:", result);

      if (!result) {
        console.log("[CRAFTING] Dialog cancelled");
        return;
      }

      if (result.resultIndex !== undefined) {
        const ingredientValidation = RecipeActions.validateRecipeIngredients(
          recipe,
          actor,
          result.resultIndex
        );
        if (!ingredientValidation.valid) {
          console.log("[CRAFTING] Ingredient validation failed for selected item:", ingredientValidation);
          ui.notifications.error(ingredientValidation.message);
          return;
        }
      }

      let itemData;
      let resultItem;

      if (result.resultItem) {
        const selectedResult = result.resultItem;
        console.log("[CRAFTING] Using result item:", selectedResult);

        if (selectedResult.uuid) {
          try {
            const baseItem = await fromUuid(selectedResult.uuid);
            if (baseItem) {
              itemData = baseItem.toObject();
              console.log("[CRAFTING] Cloned base item from UUID:", selectedResult.uuid);
            } else {
              console.warn("[CRAFTING] UUID not found, creating from scratch");
            }
          } catch (error) {
            console.error("[CRAFTING] Error loading UUID:", error);
          }
        }

        if (!itemData) {
          itemData = {
            name: selectedResult.name,
            type: "item-comum",
            img: selectedResult.img || "systems/cardigan/assets/images/decorative/icons/icon-item-generic.svg",
            system: {}
          };
        }

        if (selectedResult.customProperties && Object.keys(selectedResult.customProperties).length > 0) {
          console.log("[CRAFTING] Applying custom properties:", selectedResult.customProperties);

          itemData.system = foundry.utils.mergeObject(
            itemData.system || {},
            {
              ...(selectedResult.customProperties.damage && {
                damage: {
                  value: selectedResult.customProperties.damage,
                  total: selectedResult.customProperties.damage
                }
              }),
              ...(selectedResult.customProperties.weaponType && { weaponType: selectedResult.customProperties.weaponType }),
              ...(selectedResult.customProperties.properties && { properties: selectedResult.customProperties.properties }),
              ...(selectedResult.customProperties.protection !== undefined && { protection: selectedResult.customProperties.protection }),
              ...(selectedResult.customProperties.armorType && { armorType: selectedResult.customProperties.armorType }),
              ...(selectedResult.customProperties.armorClass && { armorClass: selectedResult.customProperties.armorClass }),
              ...(selectedResult.customProperties.durability && { durability: selectedResult.customProperties.durability }),
              ...(selectedResult.customProperties.quality !== undefined && { quality: selectedResult.customProperties.quality }),
              ...(selectedResult.customProperties.toxicity && { toxicity: selectedResult.customProperties.toxicity }),
              ...(selectedResult.customProperties.hpPerDay !== undefined && { hpPerDay: selectedResult.customProperties.hpPerDay }),
              ...(selectedResult.customProperties.consumableType && { consumableType: selectedResult.customProperties.consumableType }),
              ...(selectedResult.customProperties.potency && { potency: selectedResult.customProperties.potency }),
              ...(selectedResult.customProperties.duration && { duration: selectedResult.customProperties.duration }),
              ...(selectedResult.customProperties.effectType && { effectType: selectedResult.customProperties.effectType }),
              ...(selectedResult.customProperties.weight && { weight: selectedResult.customProperties.weight }),
              ...(selectedResult.customProperties.price !== undefined && { price: selectedResult.customProperties.price }),
              ...(selectedResult.customProperties.description && { description: selectedResult.customProperties.description })
            },
            { inplace: false }
          );
        }

        itemData.system.quantity = selectedResult.quantity || 1;

      } else if (result.itemType) {
        console.log("[CRAFTING] Using old system with item type:", result.itemType);

        itemData = {
          name: recipe.name,
          type: result.itemType,
          img: recipe.img || "icons/sundries/miscellaneous/mortar-pestle.svg",
          system: {
            quantity: 1,
            weight: "light",
            price: recipe.system.price || 10,
            description: `Crafted from ${recipe.name} recipe.${recipe.system.description ? `\n\n${recipe.system.description}` : ''}`
          }
        };

        switch (result.itemType) {
          case "item-consumivel":
            itemData.system.effects = recipe.system.effects || "";
            itemData.system.consumableType = recipe.system.consumableType || "other";
            break;
          case "arma":
            itemData.system.weaponType = "";
            itemData.system.melee = true;
            itemData.system.ranged = false;
            itemData.system.isFirearm = false;
            itemData.system.ammunition = { current: 0, max: 0 };
            itemData.system.damage = {
              value: "1d4",
              useStrength: false,
              useDexterity: false,
              total: "1d4"
            };
            itemData.system.properties = [];
            itemData.system.rightHand = false;
            itemData.system.leftHand = false;
            break;
          case "armadura":
            itemData.system.armorType = "torso";
            itemData.system.protection = 1;
            itemData.system.armorClass = "";
            itemData.system.equipped = false;
            itemData.system.properties = [];
            itemData.system.skillBonuses = [];
            itemData.system.magicalArtifact = false;
            itemData.system.resistenciaFrio = false;
            itemData.system.lifeBonus = 0;
            itemData.system.energyBonus = 0;
            itemData.system.movementBonus = { enabled: false, bonus: 0 };
            itemData.system.durability = { current: 3, max: 3 };
            break;
          case "item-municao":
            itemData.system.ammunitionType = "arrow";
            break;
        }
      } else {
        console.error("[CRAFTING] Invalid result from dialog");
        return;
      }

      let qualityName = null;
      let qualityDice = null;
      let qualityRoll = null;

      if (recipe.system.recipeType === "culinary" && itemData.type === "item-consumivel") {
        qualityRoll = await new Roll("1d20").evaluate();

        await qualityRoll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: `🎲 Rolagem de Qualidade - ${recipe.name}`
        });

        if (game.dice3d) {
          await game.dice3d.waitFor3DAnimationByMessageID(
            game.messages.contents[game.messages.contents.length - 1].id
          );
        }

        const rollTotal = qualityRoll.total;

        if (rollTotal <= 5) {
          qualityName = "Ruim";
          qualityDice = "1d6";
        } else if (rollTotal <= 10) {
          qualityName = "Simples";
          qualityDice = "1d8";
        } else if (rollTotal <= 15) {
          qualityName = "Boa";
          qualityDice = "1d10";
        } else {
          qualityName = "Incrível";
          qualityDice = "1d12";
        }

        console.log(`[CRAFTING] Quality roll: ${rollTotal} → ${qualityName} (${qualityDice} PVT)`);

        itemData.name = `${itemData.name} (${qualityName})`;

        itemData.system.hasHealthModifier = true;
        itemData.system.healthModifierType = "add";
        itemData.system.healthModifierDice = qualityDice;
        itemData.system.healthModifierIsTemporary = true;
        itemData.system.healthModifierQuantity = 1;
        itemData.system.healthModifierAdditionalBonus = 0;
      }

      const existingItem = actor.items.find(item =>
        item.type === itemData.type &&
        item.name === itemData.name
      );

      if (existingItem) {
        const currentQuantity = existingItem.system.quantity || 1;
        const quantityToAdd = itemData.system.quantity;
        const newQuantity = currentQuantity + quantityToAdd;

        await existingItem.update({
          "system.quantity": newQuantity
        });

        resultItem = existingItem;
        ui.notifications.info(`Added ${quantityToAdd} more "${itemData.name}" to your backpack! (Total: ${newQuantity})`);
      } else {
        const newItems = await actor.createEmbeddedDocuments("Item", [itemData]);
        resultItem = newItems[0];
        ui.notifications.info(game.i18n.format("CARDIGAN.Crafting.CraftingSuccess", {
          itemName: resultItem.name,
          recipeName: recipe.name
        }));
      }

      const consumeSuccess = await RecipeActions.consumeRecipeIngredients(
        recipe,
        actor,
        result.resultIndex
      );
      if (!consumeSuccess) {
        console.warn("[CRAFTING] Failed to consume ingredients, but item was created");
        ui.notifications.warn("Item created but some ingredients could not be consumed properly.");
      } else {
        console.log("[CRAFTING] Successfully consumed all required ingredients");
      }

      let requiredIngredients = [];
      if (result.resultIndex !== undefined && recipe.system.resultItems && recipe.system.resultItems[result.resultIndex]) {
        requiredIngredients = recipe.system.resultItems[result.resultIndex].requiredIngredients || [];
      } else {
        requiredIngredients = recipe.system.requiredIngredients || [];
      }

      let ingredientsText = "";
      if (requiredIngredients.length > 0) {
        ingredientsText = `
          <div style="margin-top: 8px; padding: 8px; background: rgba(220, 53, 69, 0.1); border-left: 3px solid #dc3545; border-radius: 4px;">
            <p style="margin: 2px 0; color: #dc3545; font-weight: bold;"><strong>${game.i18n.localize("CARDIGAN.Crafting.IngredientsConsumed")}:</strong></p>
            ${requiredIngredients.map(ing => `<p style="margin: 1px 0; font-size: 0.9em; color: #c9c7b8;">• ${ing.name} x${ing.quantity}</p>`).join('')}
          </div>
        `;
      }

      let qualityInfo = '';
      if (qualityName && qualityRoll) {
        const qualityColors = {
          "Ruim": "#8B0000",
          "Simples": "#696969",
          "Boa": "#4169E1",
          "Incrível": "#FFD700"
        };
        const color = qualityColors[qualityName] || "#FFFFFF";

        qualityInfo = `
          <p style="margin: 2px 0;">
            <strong>Quality Roll:</strong>
            <span style="color: ${color}; font-weight: bold;">${qualityRoll.total}</span> →
            <span style="color: ${color}; font-weight: bold;">${qualityName}</span>
          </p>
          <p style="margin: 2px 0;"><strong>PVT Restoration:</strong> ${qualityDice}</p>
        `;
      }

      const messageContent = `
        <div class="cardigan-craft-message" style="background: linear-gradient(90deg, #1a1a2e 0%, #16213e 100%); border: 2px solid #0f3460; border-radius: 8px; padding: 15px; color: #c9c7b8;">
          <h3 style="color: #4dabf7; margin-bottom: 10px;">
            <i class="fas fa-hammer" style="margin-right: 8px; color: #fd7e14;"></i>
            Crafting Complete!
          </h3>
          <p><strong>${actor.name}</strong> has crafted <strong>"${resultItem.name}"</strong>!</p>
          <div style="margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 4px;">
            <p style="margin: 2px 0;"><strong>Recipe:</strong> ${recipe.name}</p>
            <p style="margin: 2px 0;"><strong>Item Type:</strong> ${game.i18n.localize(`TYPES.Item.${resultItem.type}`)}</p>
            ${qualityInfo}
            <p style="margin: 2px 0;"><strong>Quantity:</strong> ${resultItem.system.quantity}</p>
          </div>
          ${ingredientsText}
        </div>
      `;

      ChatMessage.create({
        content: messageContent,
        speaker: ChatMessage.getSpeaker({ actor })
      });

    } catch (error) {
      console.error("[CRAFTING] Error crafting from recipe:", error);
      ui.notifications.error(game.i18n.localize("CARDIGAN.Crafting.CraftingError"));
    }
  }

}
