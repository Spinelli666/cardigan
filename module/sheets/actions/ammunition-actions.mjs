/**
 * Ammunition Actions Module
 * Handles ammunition management dialog and ranged ammo loading logic
 */
export class AmmunitionActions {

  /**
   * Handle managing ammunition for ranged weapons
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @param {CardiganSystemActorSheet} sheet
   */
  static async onManageAmmunition(event, target, sheet) {
    event.preventDefault();

    const itemId = target.dataset.itemId;
    const item = sheet.document.items.get(itemId);

    if (!item || !item.system.ranged) {
      ui.notifications.warn("Esta arma não é de longo alcance.");
      return;
    }

    // Check if dialog is already open, if so, close it first
    if (sheet._ammunitionDialog) {
      sheet._ammunitionDialog.close();
    }

    // Create reactive ammunition management dialog
    const actorSheet = sheet;
    actorSheet._ammunitionDialog = new foundry.applications.api.DialogV2({
      window: {
        title: "Ammunition Management",
        resizable: true,
        classes: ["ammunition-dialog", "cardigan-ammunition"]
      },
      content: await AmmunitionActions.renderAmmunitionContent(item, actorSheet),
      buttons: [{
        action: "close",
        icon: "fas fa-check",
        label: "Close",
        callback: () => {
          actorSheet._ammunitionDialog = null;
        }
      }],
      modal: false,
      rejectClose: false
    });

    // Render the dialog first
    await actorSheet._ammunitionDialog.render({ force: true });

    // Setup item change listener for reactive updates AFTER rendering
    AmmunitionActions.setupAmmunitionDialogListener(item, actorSheet);
  }

  /**
   * Render ammunition dialog content
   * @param {Item} weapon - The weapon item
   * @param {CardiganSystemActorSheet} sheet
   * @returns {Promise<string>} The rendered HTML content
   */
  static async renderAmmunitionContent(weapon, sheet) {
    // Get actor from weapon or use sheet.document if called from static action
    const actor = weapon.parent || sheet.document;

    // Get all ammunition items
    const allAmmunitionItems = actor.items.filter(i => i.type === "item-municao");

    // Filter ammunition based on weapon type
    const filteredAmmunitionItems = allAmmunitionItems.filter(ammoItem => {
      // If weapon is a firearm, show only firearm ammunition
      if (weapon.system.isFirearm) {
        return ammoItem.system.isFirearmAmmo === true;
      }
      // If weapon is not a firearm, show only non-firearm ammunition
      else {
        return ammoItem.system.isFirearmAmmo === false;
      }
    });

    const templatePath = "systems/cardigan/templates/dialogs/ammunition-management.hbs";
    const templateData = {
      weapon: weapon,
      ammunitionItems: filteredAmmunitionItems
    };

    return await foundry.applications.handlebars.renderTemplate(templatePath, templateData);
  }

  /**
   * Setup listener for item changes to update ammunition dialog
   * @param {Item} weapon - The weapon item
   * @param {CardiganSystemActorSheet} sheet
   */
  static setupAmmunitionDialogListener(weapon, sheet) {
    const actorSheet = sheet;

    // Check if dialog element exists
    if (!actorSheet._ammunitionDialog || !actorSheet._ammunitionDialog.element) {
      console.warn("Ammunition dialog element not available for setup");
      return;
    }

    // No need for loadedAmounts Map since we persist in weapon.system.loadedAmmo

    // Add method to update weapon table ammunition display
    actorSheet._updateWeaponTableAmmunition = function (weaponId, loadedAmmo, magazine, isFirearm) {
      const weaponRow = actorSheet.element.querySelector(`[data-item-id="${weaponId}"]`);
      if (weaponRow) {
        const ammunitionDisplay = weaponRow.querySelector('.ammunition-display');
        if (ammunitionDisplay) {
          const displayText = isFirearm ? `${loadedAmmo}/${magazine}` : loadedAmmo.toString();
          ammunitionDisplay.textContent = displayText;
        }
      }
    };

    // Add method to update ammunition dialog inputs
    actorSheet._updateAmmunitionDialogInputs = function (weaponId, loadedAmmoTypes) {
      if (actorSheet._ammunitionDialog && actorSheet._ammunitionDialog.element) {
        const dialogElement = actorSheet._ammunitionDialog.element;

        // Update each ammunition input based on the loadedAmmoTypes mapping
        for (const [ammoId, amount] of Object.entries(loadedAmmoTypes)) {
          const input = dialogElement.querySelector(`input[data-item-id="${ammoId}"]`);
          if (input) {
            input.value = amount.toString();
          }
        }

        // Set inputs to 0 for ammo types not in the mapping
        const allInputs = dialogElement.querySelectorAll('.ammunition-load-input');
        allInputs.forEach(input => {
          const ammoId = input.getAttribute('data-item-id');
          if (!loadedAmmoTypes[ammoId]) {
            input.value = '0';
          }
        });
      }
    };

    // Setup input listeners for ammunition loading
    actorSheet._ammunitionDialog.element.addEventListener('input', async (event) => {
      if (event.target.classList.contains('ammunition-load-input')) {
        const input = event.target;
        const itemId = input.getAttribute('data-item-id');

        // Clean the input value to prevent leading zeros
        let rawValue = input.value.replace(/^0+/, '') || '0';
        let newValue = parseInt(rawValue) || 0;

        // Update the input value to the cleaned version
        if (input.value !== newValue.toString()) {
          input.value = newValue.toString();
        }

        // Get ammunition item
        const ammunition = actorSheet.actor.items.get(itemId);
        if (!ammunition) return;

        // Get current loaded amount for this specific ammunition type
        const loadedAmmoTypes = weapon.system.loadedAmmoTypes || {};
        const currentLoadedAmount = loadedAmmoTypes[itemId] || 0;

        // Calculate available quantity (current inventory + what's currently loaded of this type)
        const currentQuantity = ammunition.system.quantity;
        const totalAvailable = currentQuantity + currentLoadedAmount;

        // Calculate total loaded ammunition across all types
        const totalLoadedAcrossTypes = Object.values(loadedAmmoTypes).reduce((sum, amount) => sum + amount, 0);

        // Validate maximum value for firearms considering total capacity
        if (weapon.system.isFirearm) {
          const otherTypesLoaded = totalLoadedAcrossTypes - currentLoadedAmount;
          const availableCapacity = weapon.system.magazine - otherTypesLoaded;

          if (newValue > availableCapacity) {
            input.value = availableCapacity;
            newValue = availableCapacity; // Update newValue to the corrected value
            ui.notifications.warn(`Magazine capacity exceeded. Available space: ${availableCapacity} rounds. Value adjusted automatically.`);
          }
        }

        // Validate against total available quantity
        if (newValue > totalAvailable) {
          input.value = totalAvailable;
          newValue = totalAvailable; // Update newValue to the corrected value
          ui.notifications.warn(`Only ${totalAvailable} rounds available in inventory. Value adjusted automatically.`);
        }

        // Calculate the difference in loaded ammunition
        const loadedDifference = newValue - currentLoadedAmount;

        let newQuantity = currentQuantity;

        if (loadedDifference > 0) {
          // Loading more ammunition: reduce inventory
          newQuantity = currentQuantity - loadedDifference;
        } else if (loadedDifference < 0) {
          // Unloading ammunition: for consumed ammo, don't return to inventory
          // Only return to inventory if we're manually unloading (not after consumption)
          // Since this is manual input change, we consider it "disposal" of loaded ammo
          // So we don't add it back to inventory - it's considered consumed/lost
          newQuantity = currentQuantity; // Keep inventory unchanged
        }

        await ammunition.update({
          "system.quantity": newQuantity
        });

        // Update weapon's loaded ammo types mapping
        const updatedLoadedAmmoTypes = { ...loadedAmmoTypes };
        if (newValue > 0) {
          updatedLoadedAmmoTypes[itemId] = newValue;
        } else {
          delete updatedLoadedAmmoTypes[itemId]; // Remove entry if 0
        }

        // Calculate new total loaded ammo
        const newTotalLoaded = Object.values(updatedLoadedAmmoTypes).reduce((sum, amount) => sum + amount, 0);

        // Update weapon with both the mapping and total
        await weapon.update({
          "system.loadedAmmoTypes": updatedLoadedAmmoTypes,
          "system.loadedAmmo": newTotalLoaded
        });

        // No need to track in Map anymore since we persist in weapon

        // Update the display immediately
        const quantityElement = input.parentElement.querySelector('.ammunition-quantity');
        if (quantityElement) {
          quantityElement.textContent = newQuantity;
          quantityElement.setAttribute('data-quantity', newQuantity);
        }

        // Update weapon table display in real-time
        actorSheet._updateWeaponTableAmmunition(weapon._id, newTotalLoaded, weapon.system.magazine, weapon.system.isFirearm);

        // Update ammunition dialog inputs if open (for cross-dialog synchronization)
        if (actorSheet._ammunitionDialog && actorSheet._ammunitionDialog.rendered) {
          actorSheet._updateAmmunitionDialogInputs(weapon._id, updatedLoadedAmmoTypes);
        }
      }
    });

    // Setup ammunition-specific attack button listeners
    actorSheet._ammunitionDialog.element.addEventListener('click', async (event) => {
      if (event.target.classList.contains('ammunition-attack-btn') ||
        event.target.closest('.ammunition-attack-btn')) {

        const button = event.target.classList.contains('ammunition-attack-btn') ?
          event.target : event.target.closest('.ammunition-attack-btn');

        const ammunitionId = button.getAttribute('data-item-id');
        const weaponId = button.getAttribute('data-weapon-id');

        // Get the weapon and ammunition items
        const weaponItem = actorSheet.actor.items.get(weaponId);
        const ammunitionItem = actorSheet.actor.items.get(ammunitionId);

        if (!weaponItem || !ammunitionItem) {
          ui.notifications.error("Weapon or ammunition not found.");
          return;
        }

        // Check if this ammunition type has loaded rounds
        const loadedAmmoTypes = weaponItem.system.loadedAmmoTypes || {};
        const loadedAmount = loadedAmmoTypes[ammunitionId] || 0;

        if (loadedAmount <= 0) {
          ui.notifications.warn(`No ${ammunitionItem.name} loaded in weapon.`);
          return;
        }

        // Call the existing attack method but specify the ammunition to use
        try {
          await actorSheet.constructor._onAttackWithWeapon.call(actorSheet, weaponItem, ammunitionId);

          // Optionally close the dialog after attack
          // actorSheet._ammunitionDialog.close();

        } catch (error) {
          console.error("Error attacking with specific ammunition:", error);
          ui.notifications.error("Failed to attack with this ammunition.");
        }
      }
    });

    // Setup auto-load button listeners
    actorSheet._ammunitionDialog.element.addEventListener('click', async (event) => {
      if (event.target.classList.contains('ammunition-auto-load-btn') ||
        event.target.closest('.ammunition-auto-load-btn')) {

        const button = event.target.classList.contains('ammunition-auto-load-btn') ?
          event.target : event.target.closest('.ammunition-auto-load-btn');

        const itemId = button.getAttribute('data-item-id');
        const availableQuantity = parseInt(button.getAttribute('data-quantity')) || 0;

        if (availableQuantity === 0) {
          ui.notifications.warn("No ammunition available in inventory.");
          return;
        }

        // Get ammunition item
        const ammunition = actorSheet.actor.items.get(itemId);
        if (!ammunition) return;

        // Get current loaded amounts
        const loadedAmmoTypes = weapon.system.loadedAmmoTypes || {};
        const currentLoadedAmount = loadedAmmoTypes[itemId] || 0;

        // Calculate how much we can load
        let amountToLoad = 0;

        if (weapon.system.isFirearm) {
          // For firearms: respect magazine capacity
          const totalLoadedAcrossTypes = Object.values(loadedAmmoTypes).reduce((sum, amount) => sum + amount, 0);
          const otherTypesLoaded = totalLoadedAcrossTypes - currentLoadedAmount;
          const availableCapacity = weapon.system.magazine - otherTypesLoaded;

          // Load up to capacity or available quantity, whichever is smaller
          amountToLoad = Math.min(availableCapacity, availableQuantity);
        } else {
          // For non-firearms: load all available ammunition
          amountToLoad = availableQuantity;
        }

        if (amountToLoad <= 0) {
          ui.notifications.warn("No capacity available or ammunition already loaded.");
          return;
        }

        // Update the input value to trigger the existing logic
        const input = button.parentElement.querySelector('.ammunition-load-input');
        if (input) {
          const newTotalLoaded = currentLoadedAmount + amountToLoad;
          input.value = newTotalLoaded.toString();

          // Trigger input event to use existing validation and update logic
          const inputEvent = new Event('input', { bubbles: true });
          input.dispatchEvent(inputEvent);

          ui.notifications.info(`Auto-loaded ${amountToLoad} rounds of ${ammunition.name}.`);
        }
      }
    });

    // Remove existing listener if any
    if (actorSheet._ammunitionUpdateHook) {
      Hooks.off("updateItem", actorSheet._ammunitionUpdateHook);
    }

    // Create new listener
    actorSheet._ammunitionUpdateHook = Hooks.on("updateItem", async (item, changes, options, userId) => {
      if (!actorSheet._ammunitionDialog || !actorSheet._ammunitionDialog.rendered) {
        return;
      }

      // Handle ammunition item updates
      if (item.type === "item-municao") {
        // Check if quantity changed (simple update)
        if (changes.system?.quantity !== undefined && !changes.system?.isFirearmAmmo) {
          // Find the specific ammunition item in the dialog
          const itemElement = actorSheet._ammunitionDialog.element.querySelector(`[data-item-id="${item.id}"]`);
          if (itemElement) {
            // Update just the quantity text
            const quantityElement = itemElement.querySelector('.ammunition-quantity');
            if (quantityElement) {
              quantityElement.textContent = `${item.system.quantity}`;
              quantityElement.setAttribute('data-quantity', item.system.quantity);
            }
          }
        }
        // Check if firearm ammo type changed (needs full re-render for filtering)
        else if (changes.system?.isFirearmAmmo !== undefined) {
          // Re-render to apply ammunition filtering
          const newContent = await AmmunitionActions.renderAmmunitionContent(weapon, actorSheet);
          const contentElement = actorSheet._ammunitionDialog.element.querySelector('.dialog-content');
          if (contentElement) {
            contentElement.innerHTML = newContent;
          }
        }
        else {
          // For other changes (like name, image), re-render full content
          const newContent = await AmmunitionActions.renderAmmunitionContent(weapon, actorSheet);
          const contentElement = actorSheet._ammunitionDialog.element.querySelector('.dialog-content');
          if (contentElement) {
            contentElement.innerHTML = newContent;
          }
        }
      }

      // Handle weapon updates (magazine capacity)
      else if (item.id === weapon.id && item.type === weapon.type) {
        // Check if magazine capacity or isFirearm changed
        if (changes.system?.magazine !== undefined || changes.system?.isFirearm !== undefined) {
          // Update the capacity display
          const capacityElement = actorSheet._ammunitionDialog.element.querySelector('.capacity-value');

          if (changes.system?.magazine !== undefined && capacityElement) {
            // Update just the capacity number
            capacityElement.textContent = item.system.magazine;
          }

          if (changes.system?.isFirearm !== undefined) {
            // Re-render to show/hide capacity section
            const newContent = await AmmunitionActions.renderAmmunitionContent(item, actorSheet);
            const contentElement = actorSheet._ammunitionDialog.element.querySelector('.dialog-content');
            if (contentElement) {
              contentElement.innerHTML = newContent;
            }
          }
        }

        // Handle ammunition consumption/loading updates
        if (changes.system?.loadedAmmo !== undefined || changes.system?.loadedAmmoTypes !== undefined) {
          // Update dialog inputs to reflect current loaded ammunition
          const loadedAmmoTypes = item.system.loadedAmmoTypes || {};
          actorSheet._updateAmmunitionDialogInputs(item.id, loadedAmmoTypes);

          // Update weapon table display
          actorSheet._updateWeaponTableAmmunition(item.id, item.system.loadedAmmo, item.system.magazine, item.system.isFirearm);
        }
      }
    });

    // Also listen for item creation/deletion
    actorSheet._ammunitionCreateHook = Hooks.on("createItem", async (item, options, userId) => {
      if (item.type === "item-municao" && actorSheet._ammunitionDialog && actorSheet._ammunitionDialog.rendered) {
        const newContent = await AmmunitionActions.renderAmmunitionContent(weapon, actorSheet);
        const contentElement = actorSheet._ammunitionDialog.element.querySelector('.dialog-content');
        if (contentElement) {
          contentElement.innerHTML = newContent;
        }
      }
    });

    actorSheet._ammunitionDeleteHook = Hooks.on("deleteItem", async (item, options, userId) => {
      if (item.type === "item-municao" && actorSheet._ammunitionDialog && actorSheet._ammunitionDialog.rendered) {
        const itemElement = actorSheet._ammunitionDialog.element.querySelector(`[data-item-id="${item.id}"]`);
        if (itemElement) {
          itemElement.remove();
        }
      }
    });

    // Cleanup listeners when dialog closes
    const originalClose = actorSheet._ammunitionDialog.close.bind(actorSheet._ammunitionDialog);
    actorSheet._ammunitionDialog.close = (...args) => {
      if (actorSheet._ammunitionUpdateHook) {
        Hooks.off("updateItem", actorSheet._ammunitionUpdateHook);
        actorSheet._ammunitionUpdateHook = null;
      }
      if (actorSheet._ammunitionCreateHook) {
        Hooks.off("createItem", actorSheet._ammunitionCreateHook);
        actorSheet._ammunitionCreateHook = null;
      }
      if (actorSheet._ammunitionDeleteHook) {
        Hooks.off("deleteItem", actorSheet._ammunitionDeleteHook);
        actorSheet._ammunitionDeleteHook = null;
      }
      actorSheet._ammunitionDialog = null;
      return originalClose(...args);
    };
  }

  /**
   * Load ammunition into weapon
   * @param {Item} weapon - The weapon to load ammunition into
   * @param {string} ammunitionId - The ID of the ammunition item
   * @param {number} amount - The amount to load
   * @param {CardiganSystemActorSheet} sheet
   */
  static async loadAmmunition(weapon, ammunitionId, amount, sheet) {
    try {
      const ammunition = sheet.actor.items.get(ammunitionId);
      if (!ammunition) {
        ui.notifications.error("Ammunition not found.");
        return;
      }

      // Validate available quantity
      if (amount > ammunition.system.quantity) {
        ui.notifications.error(`Only ${ammunition.system.quantity} rounds available.`);
        return;
      }

      // For firearms, validate magazine capacity
      if (weapon.system.isFirearm && amount > weapon.system.magazine) {
        ui.notifications.error(`Cannot load more than ${weapon.system.magazine} rounds.`);
        return;
      }

      // Update ammunition quantity (subtract loaded amount)
      await ammunition.update({
        "system.quantity": ammunition.system.quantity - amount
      });

      // For now, just show notification of successful loading
      // In the future, you might want to track loaded ammunition on the weapon
      const weaponType = weapon.system.isFirearm ? "magazine" : "quiver";
      ui.notifications.info(`Loaded ${amount} rounds into ${weapon.name}'s ${weaponType}.`);

    } catch (error) {
      console.error("Error loading ammunition:", error);
      ui.notifications.error("Failed to load ammunition.");
    }
  }
}