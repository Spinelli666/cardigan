import { HandSelectionDialog } from '../../applications/hand-selection-dialog.mjs';
import { InventoryActions } from './inventory-actions.mjs';

/**
 * Equipment Actions Module
 * Handles equip/unequip handlers for weapons and armors from the actor sheet actions map
 */
export class EquipmentActions {

  /**
   * Handle equipping a weapon from the backpack
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @param {CardiganSystemActorSheet} sheet
   */
  static async onEquipWeapon(event, target, sheet) {
    event.preventDefault();

    const itemId = target.dataset.itemId;
    const item = sheet.document.items.get(itemId);

    if (!item || item.type !== 'arma') {
      ui.notifications.warn("Item não encontrado ou não é uma arma.");
      return;
    }

    if (item.system.equipped) {
      ui.notifications.info("Esta arma já está equipada.");
      return;
    }

    try {
      // Open dialog to select hand(s) - pass the item as parameter
      const selectedHand = await HandSelectionDialog.show(item);

      if (selectedHand === null) {
        // User cancelled the dialog
        return;
      }

      // Prepare update data based on selection
      const updateData = {
        "system.equipped": true,
        "system.rightHand": false,
        "system.leftHand": false
      };

      // Set hand assignments based on selection
      switch (selectedHand) {
        case "right":
          updateData["system.rightHand"] = true;
          break;
        case "left":
          updateData["system.leftHand"] = true;
          break;
        case "both":
          updateData["system.rightHand"] = true;
          updateData["system.leftHand"] = true;
          break;
      }

      // Handle quantity splitting: if qty > 1, create equipped copy and reduce original
      const currentQuantity = item.system.quantity || 1;
      if (currentQuantity > 1) {
        // Create a new equipped copy with quantity 1
        const equippedCopyData = item.toObject();
        equippedCopyData.system.quantity = 1;
        equippedCopyData.system.equipped = true;
        equippedCopyData.system.rightHand = updateData["system.rightHand"];
        equippedCopyData.system.leftHand = updateData["system.leftHand"];
        delete equippedCopyData._id; // Remove ID to create new item

        // Reduce original item quantity and keep it unequipped
        await item.update({ "system.quantity": currentQuantity - 1 });
        
        // Create the equipped copy
        await sheet.document.createEmbeddedDocuments('Item', [equippedCopyData]);
        
        const handText = selectedHand === "both" ? "ambas as mãos" :
          selectedHand === "right" ? "mão principal" : "mão secundária";
        ui.notifications.info(`${item.name} foi equipada em ${handText}. ${currentQuantity - 1} unidade(s) permanece(m) na mochila.`);
      } else {
        // qty = 1: just equip the item normally
        await item.update(updateData);
        
        const handText = selectedHand === "both" ? "ambas as mãos" :
          selectedHand === "right" ? "mão principal" : "mão secundária";
        ui.notifications.info(`${item.name} foi equipada em ${handText}.`);
      }

      // Force re-render to update the tables
      await sheet.render(false);
    } catch (error) {
      console.error("Error equipping weapon:", error);
      ui.notifications.error("Erro ao equipar a arma.");
    }
  }

  /**
   * Handle unequipping a weapon to the backpack
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @param {CardiganSystemActorSheet} sheet
   */
  static async onUnequipWeapon(event, target, sheet) {
    event.preventDefault();

    const itemId = target.dataset.itemId;
    const item = sheet.document.items.get(itemId);

    if (!item || item.type !== 'arma') {
      ui.notifications.warn("Item não encontrado ou não é uma arma.");
      return;
    }

    if (!item.system.equipped) {
      ui.notifications.info("Esta arma já está desequipada.");
      return;
    }

    // Check if there's enough space in backpack
    if (!InventoryActions.canUnequipItem(sheet.document, item)) {
      const requiredSpaces = InventoryActions.calculateItemSpaces(item.system.weight, item.system.quantity || 1);
      console.log(`[UNEQUIP WEAPON CHECK] canUnequipItem=false, required=${requiredSpaces}`);
      ui.notifications.warn(`Não é possível desequipar ${item.name}. Mochila cheia! Precisa de ${requiredSpaces} espaço(s) livre(s).`);
      return;
    }

    try {
      // Clear hand assignments when unequipping
      const updateData = {
        "system.equipped": false,
        "system.rightHand": false,
        "system.leftHand": false
      };

      // Check if there's an unequipped copy of this weapon to merge with
      const unequippedCopy = sheet.document.items.find((i) => 
        i.type === 'arma' &&
        i.name === item.name &&
        !i.system.equipped &&
        i._id !== item._id
      );

      if (unequippedCopy) {
        // Merge: increase quantity of unequipped copy
        const newQuantity = (unequippedCopy.system.quantity || 1) + (item.system.quantity || 1);
        await unequippedCopy.update({ "system.quantity": newQuantity });
        await item.delete();
        ui.notifications.info(`${item.name} foi desequipada e mesclada com outra cópia na mochila. Total: ${newQuantity} unidade(s).`);
      } else {
        // No unequipped copy: just unequip normally
        await item.update(updateData);
        ui.notifications.info(`${item.name} foi desequipada e movida para a mochila.`);
      }

      // Force re-render to update the tables
      await sheet.render(false);
    } catch (error) {
      console.error("Error unequipping weapon:", error);
      ui.notifications.error("Erro ao desequipar a arma.");
    }
  }

  /**
   * Handle equipping an armor from the backpack
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @param {CardiganSystemActorSheet} sheet
   */
  static async onEquipArmor(event, target, sheet) {
    event.preventDefault();

    const itemId = target.dataset.itemId;
    const item = sheet.document.items.get(itemId);

    if (!item || item.type !== 'armadura') {
      ui.notifications.warn("Item não encontrado ou não é uma armadura.");
      return;
    }

    if (item.system.equipped) {
      ui.notifications.info("Esta armadura já está equipada.");
      return;
    }

    // Se já existir uma armadura equipada desta mesma parte marcada como `single`, bloqueia o equip
    const existingSingleEquipped = sheet.document.items.find((i) =>
      i.type === 'armadura' &&
      i.system.armorType === item.system.armorType &&
      i.system.equipped &&
      i.system.single &&
      i._id !== item._id
    );
    if (existingSingleEquipped) {
      ui.notifications.warn(`${existingSingleEquipped.name} (marcado como \"single\") já está equipada nesta parte (${item.system.armorType}). Desequipe-a antes de equipar outro item desta parte.`);
      return;
    }

    try {
      const armorTypeLabel = game.i18n.localize(`CARDIGAN.ArmorType.${item.system.armorType.charAt(0).toUpperCase() + item.system.armorType.slice(1)}`);
      
      // Handle quantity splitting: if qty > 1, create equipped copy and reduce original
      const currentQuantity = item.system.quantity || 1;
      if (currentQuantity > 1) {
        // Create a new equipped copy with quantity 1
        const equippedCopyData = item.toObject();
        equippedCopyData.system.quantity = 1;
        equippedCopyData.system.equipped = true;
        delete equippedCopyData._id; // Remove ID to create new item

        // Reduce original item quantity and keep it unequipped
        await item.update({ "system.quantity": currentQuantity - 1 });
        
        // Create the equipped copy
        await sheet.document.createEmbeddedDocuments('Item', [equippedCopyData]);
        
        ui.notifications.info(`${item.name} (${armorTypeLabel}) foi equipada. ${currentQuantity - 1} unidade(s) permanece(m) na mochila.`);
      } else {
        // qty = 1: just equip the armor normally
        const updateData = {
          "system.equipped": true
        };
        await item.update(updateData);
        ui.notifications.info(`${item.name} (${armorTypeLabel}) foi equipada.`);
      }

      // Force re-render to update the tables
      await sheet.render(false);
    } catch (error) {
      console.error("Error equipping armor:", error);
      ui.notifications.error("Erro ao equipar a armadura.");
    }
  }

  /**
   * Handle unequipping an armor to the backpack
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @param {CardiganSystemActorSheet} sheet
   */
  static async onUnequipArmor(event, target, sheet) {
    event.preventDefault();

    const itemId = target.dataset.itemId;
    const item = sheet.document.items.get(itemId);

    if (!item || item.type !== 'armadura') {
      ui.notifications.warn("Item não encontrado ou não é uma armadura.");
      return;
    }

    if (!item.system.equipped) {
      ui.notifications.info("Esta armadura já está desequipada.");
      return;
    }

    // Check if there's enough space in backpack
    if (!InventoryActions.canUnequipItem(sheet.document, item)) {
      const requiredSpaces = InventoryActions.calculateItemSpaces(item.system.weight, item.system.quantity || 1);
      console.log(`[UNEQUIP ARMOR CHECK] canUnequipItem=false, required=${requiredSpaces}`);
      ui.notifications.warn(`Não é possível desequipar ${item.name}. Mochila cheia! Precisa de ${requiredSpaces} espaço(s) livre(s).`);
      return;
    }

    try {
      // Check if there's an unequipped copy of this armor to merge with
      const unequippedCopy = sheet.document.items.find((i) => 
        i.type === 'armadura' &&
        i.name === item.name &&
        !i.system.equipped &&
        i._id !== item._id
      );

      if (unequippedCopy) {
        // Merge: increase quantity of unequipped copy
        const newQuantity = (unequippedCopy.system.quantity || 1) + (item.system.quantity || 1);
        await unequippedCopy.update({ "system.quantity": newQuantity });
        await item.delete();
        ui.notifications.info(`${item.name} foi desequipada e mesclada com outra cópia na mochila. Total: ${newQuantity} unidade(s).`);
      } else {
        // No unequipped copy: just unequip normally
        const updateData = {
          "system.equipped": false
        };
        await item.update(updateData);
        ui.notifications.info(`${item.name} foi desequipada e movida para a mochila.`);
      }

      // Force re-render to update the tables
      await sheet.render(false);
    } catch (error) {
      console.error("Error unequipping armor:", error);
      ui.notifications.error("Erro ao desequipar a armadura.");
    }
  }

  /**
   * Equip a weapon via context menu flow (with quantity splitting)
   * @param {Item} weapon
   * @param {CardiganSystemActorSheet} sheet
   */
  static async equipWeaponFromContext(weapon, sheet) {
    if (weapon.type !== "arma") return;

    try {
      console.log("=== EQUIP DEBUG ===");
      console.log("Equipando arma:", weapon.name);
      console.log("Status ANTES do update:", weapon.system.equipped);
      console.log("Weapon ID:", weapon._id);
      console.log("Weapon quantity:", weapon.system.quantity || 1);

      // Show hand selection dialog
      const selectedHand = await HandSelectionDialog.show(weapon);

      if (selectedHand === null) {
        console.log("User cancelled hand selection");
        return; // User cancelled
      }

      console.log("User selected hand:", selectedHand);

      // Prepare update data based on selection
      const updateData = {
        "system.equipped": true,
        "system.rightHand": false,
        "system.leftHand": false
      };

      // Set hand assignments based on selection
      switch (selectedHand) {
        case "right":
          updateData["system.rightHand"] = true;
          break;
        case "left":
          updateData["system.leftHand"] = true;
          break;
        case "both":
          updateData["system.rightHand"] = true;
          updateData["system.leftHand"] = true;
          break;
      }

      // Handle quantity splitting
      const currentQuantity = weapon.system.quantity || 1;
      if (currentQuantity > 1) {
        // Create equipped copy
        const equippedCopyData = weapon.toObject();
        equippedCopyData.system.quantity = 1;
        equippedCopyData.system.equipped = true;
        equippedCopyData.system.rightHand = updateData["system.rightHand"];
        equippedCopyData.system.leftHand = updateData["system.leftHand"];
        delete equippedCopyData._id;

        // Reduce original quantity
        await weapon.update({ "system.quantity": currentQuantity - 1 });
        await sheet.document.createEmbeddedDocuments('Item', [equippedCopyData]);
        
        const handText = selectedHand === "both" ? "ambas as mãos" :
          selectedHand === "right" ? "mão primária" : "mão secundária";
        ui.notifications.info(`${weapon.name} foi equipada na ${handText}. ${currentQuantity - 1} unidade(s) permanece(m) na mochila.`);
      } else {
        // Just equip normally
        const result = await weapon.update(updateData);
        console.log("Update result:", result);
        
        const handText = selectedHand === "both" ? "ambas as mãos" :
          selectedHand === "right" ? "mão primária" : "mão secundária";
        ui.notifications.info(`${weapon.name} foi equipada na ${handText}.`);
      }

      console.log("=== END EQUIP DEBUG ===");

      // Force re-render to update the tables
      await sheet.render(false);
    } catch (error) {
      console.error("Error equipping weapon:", error);
      ui.notifications.error("Erro ao equipar a arma.");
    }
  }

  /**
   * Unequip a weapon via context menu flow (with quantity merging)
   * @param {Item} weapon
   * @param {CardiganSystemActorSheet} sheet
   */
  static async unequipWeaponFromContext(weapon, sheet) {
    if (weapon.type !== "arma") return;

    try {
      console.log("Desequipando arma:", weapon.name, "Status atual:", weapon.system.equipped);

      // Check if there's an unequipped copy to merge with
      const unequippedCopy = sheet.document.items.find((i) => 
        i.type === 'arma' &&
        i.name === weapon.name &&
        !i.system.equipped &&
        i._id !== weapon._id
      );

      if (unequippedCopy) {
        // Merge: increase quantity of unequipped copy
        const newQuantity = (unequippedCopy.system.quantity || 1) + (weapon.system.quantity || 1);
        await unequippedCopy.update({ "system.quantity": newQuantity });
        await weapon.delete();
        console.log("Arma desequipada e mesclada:", weapon.name, "Novo total:", newQuantity);
        ui.notifications.info(`${weapon.name} foi desequipada e mesclada com outra cópia na mochila. Total: ${newQuantity} unidade(s).`);
      } else {
        // No unequipped copy: just unequip normally
        const updateData = {
          "system.equipped": false,
          "system.rightHand": false,
          "system.leftHand": false
        };
        await weapon.update(updateData);
        console.log("Arma desequipada:", weapon.name, "Novo status:", weapon.system.equipped);
        ui.notifications.info(`${weapon.name} foi desequipada e movida para a mochila.`);
      }

      // Force re-render to update the tables
      await sheet.render(false);
    } catch (error) {
      console.error("Error unequipping weapon:", error);
      ui.notifications.error("Erro ao desequipar a arma.");
    }
  }

  /**
   * Equip an armor via context menu flow (with quantity splitting)
   * @param {Item} armor
   * @param {CardiganSystemActorSheet} sheet
   */
  static async equipArmorFromContext(armor, sheet) {
    if (armor.type !== "armadura") return;

    try {
      console.log("=== EQUIP ARMOR DEBUG ===");
      console.log("Equipando armadura:", armor.name);
      console.log("Status ANTES do update:", armor.system.equipped);
      console.log("Armor ID:", armor._id);
      console.log("Armor quantity:", armor.system.quantity || 1);

      const armorTypeLabel = game.i18n.localize(`CARDIGAN.ArmorType.${armor.system.armorType.charAt(0).toUpperCase() + armor.system.armorType.slice(1)}`);

      // Bloqueia equipar se já houver uma armadura equipada desta parte marcada como `single`
      const existingSingleEquipped = sheet.document.items.find((i) =>
        i.type === 'armadura' &&
        i.system.armorType === armor.system.armorType &&
        i.system.equipped &&
        i.system.single &&
        i._id !== armor._id
      );
      if (existingSingleEquipped) {
        ui.notifications.warn(`${existingSingleEquipped.name} (marcado como \"single\") já está equipada nesta parte (${armor.system.armorType}). Desequipe-a antes de equipar outro item desta parte.`);
        return;
      }

      // Handle quantity splitting
      const currentQuantity = armor.system.quantity || 1;
      if (currentQuantity > 1) {
        // Create equipped copy
        const equippedCopyData = armor.toObject();
        equippedCopyData.system.quantity = 1;
        equippedCopyData.system.equipped = true;
        delete equippedCopyData._id;

        // Reduce original quantity
        await armor.update({ "system.quantity": currentQuantity - 1 });
        await sheet.document.createEmbeddedDocuments('Item', [equippedCopyData]);
        
        ui.notifications.info(`${armor.name} (${armorTypeLabel}) foi equipada. ${currentQuantity - 1} unidade(s) permanece(m) na mochila.`);
      } else {
        // Just equip normally
        const updateData = {
          "system.equipped": true
        };
        await armor.update(updateData);
        ui.notifications.info(`${armor.name} (${armorTypeLabel}) foi equipada.`);
      }

      console.log("=== END EQUIP ARMOR DEBUG ===");

      // Force re-render to update the tables
      await sheet.render(false);
    } catch (error) {
      console.error("Error equipping armor:", error);
      ui.notifications.error("Erro ao equipar a armadura.");
    }
  }

  /**
   * Unequip an armor via context menu flow (with quantity merging)
   * @param {Item} armor
   * @param {CardiganSystemActorSheet} sheet
   */
  static async unequipArmorFromContext(armor, sheet) {
    if (armor.type !== "armadura") return;

    try {
      console.log("Desequipando armadura:", armor.name, "Status atual:", armor.system.equipped);

      // Check if there's an unequipped copy to merge with
      const unequippedCopy = sheet.document.items.find((i) => 
        i.type === 'armadura' &&
        i.name === armor.name &&
        !i.system.equipped &&
        i._id !== armor._id
      );

      if (unequippedCopy) {
        // Merge: increase quantity of unequipped copy
        const newQuantity = (unequippedCopy.system.quantity || 1) + (armor.system.quantity || 1);
        await unequippedCopy.update({ "system.quantity": newQuantity });
        await armor.delete();
        console.log("Armadura desequipada e mesclada:", armor.name, "Novo total:", newQuantity);
        ui.notifications.info(`${armor.name} foi desequipada e mesclada com outra cópia na mochila. Total: ${newQuantity} unidade(s).`);
      } else {
        // No unequipped copy: just unequip normally
        const updateData = {
          "system.equipped": false
        };
        await armor.update(updateData);
        console.log("Armadura desequipada:", armor.name, "Novo status:", armor.system.equipped);
        ui.notifications.info(`${armor.name} foi desequipada e movida para a mochila.`);
      }

      // Force re-render to update the tables
      await sheet.render(false);
    } catch (error) {
      console.error("Error unequipping armor:", error);
      ui.notifications.error("Erro ao desequipar a armadura.");
    }
  }
}