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

    if (sheet._ammunitionDialog) {
      sheet._ammunitionDialog.close();
    }

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

    await actorSheet._ammunitionDialog.render({ force: true });
    AmmunitionActions.setupAmmunitionDialogListener(item, actorSheet);
  }

  /**
   * Render ammunition dialog content
   * @param {Item} weapon - The weapon item
   * @param {CardiganSystemActorSheet} sheet
   * @returns {Promise<string>} The rendered HTML content
   */
  static async renderAmmunitionContent(weapon, sheet) {
    const actor = weapon.parent || sheet.document;
    const allAmmunitionItems = actor.items.filter(i => i.type === "item-municao");

    const filteredAmmunitionItems = allAmmunitionItems.filter(ammoItem => {
      if (weapon.system.isFirearm) {
        return ammoItem.system.isFirearmAmmo === true;
      }
      return ammoItem.system.isFirearmAmmo === false;
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

    if (!actorSheet._ammunitionDialog || !actorSheet._ammunitionDialog.element) {
      console.warn("Ammunition dialog element not available for setup");
      return;
    }

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

    actorSheet._updateAmmunitionDialogInputs = function (weaponId, loadedAmmoTypes) {
      if (actorSheet._ammunitionDialog && actorSheet._ammunitionDialog.element) {
        const dialogElement = actorSheet._ammunitionDialog.element;
        const loadSpans = dialogElement.querySelectorAll('.ammunition-load-input');
        loadSpans.forEach(span => {
          const ammoId = span.getAttribute('data-item-id');
          const amount = loadedAmmoTypes[ammoId] || 0;
          span.textContent = amount.toString();
          span.setAttribute('data-loaded', amount.toString());
        });
      }
    };

    const applyAmmoLoad = async (ammoId, requestedAmount, sourceElement) => {
      const ammunition = actorSheet.actor.items.get(ammoId);
      if (!ammunition) return;

      const loadedAmmoTypes = weapon.system.loadedAmmoTypes || {};
      const currentLoadedAmount = loadedAmmoTypes[ammoId] || 0;
      const currentQuantity = ammunition.system.quantity;
      const totalLoadedAcrossTypes = Object.values(loadedAmmoTypes).reduce((sum, amount) => sum + amount, 0);

      let amountToLoad = Math.max(0, parseInt(requestedAmount) || 0);
      amountToLoad = Math.min(amountToLoad, currentQuantity);
      if (weapon.system.isFirearm) {
        const capacityRemaining = Math.max(0, weapon.system.magazine - totalLoadedAcrossTypes);
        amountToLoad = Math.min(amountToLoad, capacityRemaining);
      }

      if (amountToLoad <= 0) {
        ui.notifications.warn("No capacity available or ammunition already loaded.");
        return;
      }

      const newQuantity = currentQuantity - amountToLoad;
      await ammunition.update({
        "system.quantity": newQuantity
      });

      const updatedLoadedAmmoTypes = { ...loadedAmmoTypes };
      const newLoadedForType = currentLoadedAmount + amountToLoad;
      if (newLoadedForType > 0) {
        updatedLoadedAmmoTypes[ammoId] = newLoadedForType;
      } else {
        delete updatedLoadedAmmoTypes[ammoId];
      }

      const newTotalLoaded = Object.values(updatedLoadedAmmoTypes).reduce((sum, amount) => sum + amount, 0);

      await weapon.update({
        "system.loadedAmmoTypes": updatedLoadedAmmoTypes,
        "system.loadedAmmo": newTotalLoaded
      });

      const quantityElement = sourceElement?.parentElement?.querySelector('.ammunition-quantity');
      if (quantityElement) {
        quantityElement.textContent = newQuantity;
        quantityElement.setAttribute('data-quantity', newQuantity);
      }

      actorSheet._updateWeaponTableAmmunition(weapon._id, newTotalLoaded, weapon.system.magazine, weapon.system.isFirearm);

      if (actorSheet._ammunitionDialog && actorSheet._ammunitionDialog.rendered) {
        actorSheet._updateAmmunitionDialogInputs(weapon._id, updatedLoadedAmmoTypes);
      }
    };

    const openAmmoLoadDialog = async (ammoId, ammoName, currentLoaded, sourceElement) => {
      let dialog;
      dialog = new foundry.applications.api.DialogV2({
        window: {
          title: `Carregar ${ammoName}`,
          resizable: false,
          classes: ["cardigan-ammo-load-dialog"]
        },
        content: `
          <div style="display:flex; flex-direction:column; gap:8px; min-width:220px;">
            <label style="color: var(--cardigan-c-beige, #f4f1e8); font-weight:bold;">Quantidade a carregar</label>
            <input type="number" class="cardigan-ammo-load-input" min="0" value="0" style="width:100%; padding:6px 8px; border:1px solid #666; border-radius:4px; background:rgba(0,0,0,0.3); color: var(--cardigan-c-beige, #f4f1e8); text-align:center;" />
            <div style="color: var(--cardigan-c-beige, #f4f1e8); opacity:0.8; font-size:0.85em;">Atual carregado: ${currentLoaded}</div>
          </div>
        `,
        buttons: [{
          action: "ok",
          icon: "fas fa-check",
          label: "OK",
          callback: async () => {
            const input = dialog.element?.querySelector('.cardigan-ammo-load-input');
            const amount = input ? parseInt(input.value) || 0 : 0;
            await applyAmmoLoad(ammoId, amount, sourceElement);
          }
        }],
        modal: true,
        rejectClose: false
      });

      await dialog.render({ force: true });
      const input = dialog.element?.querySelector('.cardigan-ammo-load-input');
      input?.focus();
      input?.select();
    };

    actorSheet._ammunitionDialog.element.addEventListener('click', async (event) => {
      const loadSpan = event.target.closest('.ammunition-load-input');
      if (loadSpan) {
        const ammoId = loadSpan.getAttribute('data-item-id');
        const ammoName = loadSpan.closest('.ammunition-item')?.querySelector('.ammunition-name')?.textContent?.trim() || 'Ammunition';
        const currentLoaded = parseInt(loadSpan.getAttribute('data-loaded')) || 0;
        await openAmmoLoadDialog(ammoId, ammoName, currentLoaded, loadSpan);
      }
    });

    actorSheet._ammunitionDialog.element.addEventListener('click', async (event) => {
      if (event.target.classList.contains('ammunition-attack-btn') ||
        event.target.closest('.ammunition-attack-btn')) {

        const button = event.target.classList.contains('ammunition-attack-btn') ?
          event.target : event.target.closest('.ammunition-attack-btn');

        const ammunitionId = button.getAttribute('data-item-id');
        const weaponId = button.getAttribute('data-weapon-id');

        const weaponItem = actorSheet.actor.items.get(weaponId);
        const ammunitionItem = actorSheet.actor.items.get(ammunitionId);

        if (!weaponItem || !ammunitionItem) {
          ui.notifications.error("Weapon or ammunition not found.");
          return;
        }

        const loadedAmmoTypes = weaponItem.system.loadedAmmoTypes || {};
        const loadedAmount = loadedAmmoTypes[ammunitionId] || 0;

        if (loadedAmount <= 0) {
          ui.notifications.warn(`No ${ammunitionItem.name} loaded in weapon.`);
          return;
        }

        try {
          await actorSheet.constructor._onAttackWithWeapon.call(actorSheet, weaponItem, ammunitionId);
        } catch (error) {
          console.error("Error attacking with specific ammunition:", error);
          ui.notifications.error("Failed to attack with this ammunition.");
        }
      }
    });

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

        const ammunition = actorSheet.actor.items.get(itemId);
        if (!ammunition) return;

        const loadedAmmoTypes = weapon.system.loadedAmmoTypes || {};
        const currentLoadedAmount = loadedAmmoTypes[itemId] || 0;
        const totalLoadedAcrossTypes = Object.values(loadedAmmoTypes).reduce((sum, amount) => sum + amount, 0);

        let amountToLoad = availableQuantity;
        if (weapon.system.isFirearm) {
          const otherTypesLoaded = totalLoadedAcrossTypes - currentLoadedAmount;
          const availableCapacity = weapon.system.magazine - otherTypesLoaded;
          amountToLoad = Math.min(availableCapacity, availableQuantity);
        }

        if (amountToLoad <= 0) {
          ui.notifications.warn("No capacity available or ammunition already loaded.");
          return;
        }

        await applyAmmoLoad(itemId, amountToLoad, button.parentElement.querySelector('.ammunition-load-input'));
        ui.notifications.info(`Auto-loaded ${amountToLoad} rounds of ${ammunition.name}.`);
      }
    });

    if (actorSheet._ammunitionUpdateHook) {
      Hooks.off("updateItem", actorSheet._ammunitionUpdateHook);
    }

    actorSheet._ammunitionUpdateHook = Hooks.on("updateItem", async (item, changes) => {
      if (!actorSheet._ammunitionDialog || !actorSheet._ammunitionDialog.rendered) {
        return;
      }

      if (item.type === "item-municao") {
        if (changes.system?.quantity !== undefined && !changes.system?.isFirearmAmmo) {
          const itemElement = actorSheet._ammunitionDialog.element.querySelector(`[data-item-id="${item.id}"]`);
          if (itemElement) {
            const quantityElement = itemElement.querySelector('.ammunition-quantity');
            if (quantityElement) {
              quantityElement.textContent = `${item.system.quantity}`;
              quantityElement.setAttribute('data-quantity', item.system.quantity);
            }
          }
        } else if (changes.system?.isFirearmAmmo !== undefined) {
          const newContent = await AmmunitionActions.renderAmmunitionContent(weapon, actorSheet);
          const contentElement = actorSheet._ammunitionDialog.element.querySelector('.dialog-content');
          if (contentElement) {
            contentElement.innerHTML = newContent;
          }
        } else {
          const newContent = await AmmunitionActions.renderAmmunitionContent(weapon, actorSheet);
          const contentElement = actorSheet._ammunitionDialog.element.querySelector('.dialog-content');
          if (contentElement) {
            contentElement.innerHTML = newContent;
          }
        }
      }

      if (item.id === weapon.id && item.type === weapon.type) {
        if (changes.system?.magazine !== undefined || changes.system?.isFirearm !== undefined) {
          const capacityElement = actorSheet._ammunitionDialog.element.querySelector('.capacity-value');

          if (changes.system?.magazine !== undefined && capacityElement) {
            capacityElement.textContent = item.system.magazine;
          }

          if (changes.system?.isFirearm !== undefined) {
            const newContent = await AmmunitionActions.renderAmmunitionContent(item, actorSheet);
            const contentElement = actorSheet._ammunitionDialog.element.querySelector('.dialog-content');
            if (contentElement) {
              contentElement.innerHTML = newContent;
            }
          }
        }

        if (changes.system?.loadedAmmo !== undefined || changes.system?.loadedAmmoTypes !== undefined) {
          const loadedAmmoTypes = item.system.loadedAmmoTypes || {};
          actorSheet._updateAmmunitionDialogInputs(item.id, loadedAmmoTypes);
          actorSheet._updateWeaponTableAmmunition(item.id, item.system.loadedAmmo, item.system.magazine, item.system.isFirearm);
        }
      }
    });

    actorSheet._ammunitionCreateHook = Hooks.on("createItem", async (item) => {
      if (item.type === "item-municao" && actorSheet._ammunitionDialog && actorSheet._ammunitionDialog.rendered) {
        const newContent = await AmmunitionActions.renderAmmunitionContent(weapon, actorSheet);
        const contentElement = actorSheet._ammunitionDialog.element.querySelector('.dialog-content');
        if (contentElement) {
          contentElement.innerHTML = newContent;
        }
      }
    });

    actorSheet._ammunitionDeleteHook = Hooks.on("deleteItem", async (item) => {
      if (item.type === "item-municao" && actorSheet._ammunitionDialog && actorSheet._ammunitionDialog.rendered) {
        const itemElement = actorSheet._ammunitionDialog.element.querySelector(`[data-item-id="${item.id}"]`);
        if (itemElement) {
          itemElement.remove();
        }
      }
    });

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

      if (amount > ammunition.system.quantity) {
        ui.notifications.error(`Only ${ammunition.system.quantity} rounds available.`);
        return;
      }

      if (weapon.system.isFirearm && amount > weapon.system.magazine) {
        ui.notifications.error(`Cannot load more than ${weapon.system.magazine} rounds.`);
        return;
      }

      await ammunition.update({
        "system.quantity": ammunition.system.quantity - amount
      });

      const weaponType = weapon.system.isFirearm ? "magazine" : "quiver";
      ui.notifications.info(`Loaded ${amount} rounds into ${weapon.name}'s ${weaponType}.`);
    } catch (error) {
      console.error("Error loading ammunition:", error);
      ui.notifications.error("Failed to load ammunition.");
    }
  }
}
