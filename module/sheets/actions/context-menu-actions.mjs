import ContextMenu5e from '../../applications/context-menu.mjs';
import { EquipmentActions } from './equipment-actions.mjs';

export class ContextMenuActions {

  /**
   * Setup context menu for items on the actor sheet.
   * @param {ActorSheet} sheet - The sheet instance
   */
  static setupContextMenu(sheet) {
    for (const control of sheet.element.querySelectorAll("[data-context-menu]")) {
      control.removeEventListener("click", ContextMenu5e.triggerEvent);
      control.addEventListener("click", ContextMenu5e.triggerEvent);
    }

    new ContextMenu5e(sheet.element, "[data-item-id]", [], {
      onOpen: (element) => ContextMenuActions.onOpenContextMenu(element, sheet),
      jQuery: false
    });
  }

  /**
   * Handle opening the context menu for an item.
   * @param {HTMLElement} element - The element that triggered the context menu
   * @param {ActorSheet} sheet - The sheet instance
   */
  static onOpenContextMenu(element, sheet) {
    const { itemId } = element.closest("[data-item-id]")?.dataset ?? {};
    const item = sheet.actor.items.get(itemId);
    if (!item) return;

    ui.context.menuItems = ContextMenuActions.getContextOptions(item, element, sheet);
  }

  /**
   * Show weapon information in chat.
   * @param {Item} weapon - The weapon item to show
   * @param {Actor} document - The actor document (used for speaker)
   * @returns {Promise<ChatMessage>}
   */
  static async showWeaponInChat(weapon, document) {
    const weaponData = weapon.system;
    const weaponHtml = `
      <div style="padding: 8px;">
        <p><strong>Tipo:</strong> ${weaponData.weaponType || 'N/A'}</p>
        <p><strong>Dano:</strong> ${weaponData.damage || 'N/A'}</p>
        <p><strong>Alcance:</strong> ${weaponData.range || 'N/A'}</p>
        ${weaponData.description ? `<p><strong>Descrição:</strong> ${weaponData.description}</p>` : ''}
      </div>
    `;

    const messageData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: document }),
      content: `<div class="weapon-chat-display" style="background: linear-gradient(135deg, #2c2c2c, #1a1a1a); border: 2px solid #c9c7b8; border-radius: 8px; padding: 12px; margin: 8px 0; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
        <div style="text-align: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #c9c7b8;">
          <h3 style="margin: 0; color: #f0f0e0; font-size: 16px;">
            <i class="fas fa-sword" style="margin-right: 6px; color: #c9c7b8;"></i>
            Informações da Arma
          </h3>
        </div>
        ${weaponHtml}
      </div>`,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER
    };

    return ChatMessage.create(messageData);
  }

  /**
   * Show armor information in chat.
   * @param {Item} armor - The armor item to show
   * @param {Actor} document - The actor document (used for speaker)
   * @returns {Promise<ChatMessage>}
   */
  static async showArmorInChat(armor, document) {
    const armorData = armor.system;
    const armorHtml = `
      <div style="padding: 8px;">
        <p><strong>Tipo:</strong> ${armorData.armorType || 'N/A'}</p>
        <p><strong>Defesa:</strong> ${armorData.armor || 'N/A'}</p>
        <p><strong>Durabilidade:</strong> ${armorData.currentDurability || 0}/${armorData.maxDurability || 0}</p>
        ${armorData.description ? `<p><strong>Descrição:</strong> ${armorData.description}</p>` : ''}
      </div>
    `;

    const messageData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: document }),
      content: `<div class="armor-chat-display" style="background: linear-gradient(135deg, #2c2c2c, #1a1a1a); border: 2px solid #c9c7b8; border-radius: 8px; padding: 12px; margin: 8px 0; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
        <div style="text-align: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #c9c7b8;">
          <h3 style="margin: 0; color: #f0f0e0; font-size: 16px;">
            <i class="fas fa-shield-alt" style="margin-right: 6px; color: #c9c7b8;"></i>
            Informações da Armadura
          </h3>
        </div>
        ${armorHtml}
      </div>`,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER
    };

    return ChatMessage.create(messageData);
  }

  /**
   * Get context menu options for an item.
   * @param {Item} item - The item
   * @param {HTMLElement} element - The triggering element
   * @param {ActorSheet} sheet - The sheet instance
   * @returns {Array} Array of context menu options
   */
  static getContextOptions(item, element, sheet) {
    const options = [];

    const itemContainer = element.closest('.item.collapsible');
    const isExpanded = itemContainer && !itemContainer.classList.contains('collapsed');

    if (item.type === "arma" && item.system.equipped) {
      options.push({
        name: isExpanded ? "Recolher" : "Expandir",
        icon: isExpanded ? '<i class="fa-solid fa-compress fa-fw"></i>' : '<i class="fa-solid fa-expand fa-fw"></i>',
        condition: () => true,
        callback: li => ContextMenuActions.onAction(li, "toggleExpand", item, sheet, itemContainer)
      });
    }

    options.push({
      name: "Editar",
      icon: '<i class="fa-solid fa-pen-to-square fa-fw"></i>',
      condition: () => item.isOwner,
      callback: li => ContextMenuActions.onAction(li, "edit", item, sheet)
    });

    if (item.type === "arma") {
      if (item.system.equipped) {
        options.push({
          name: game.i18n.localize("CARDIGAN.Tooltip.Unequip"),
          icon: '<i class="fa-solid fa-shield fa-fw"></i>',
          condition: () => item.isOwner,
          callback: li => ContextMenuActions.onAction(li, "unequip", item, sheet)
        });
      } else {
        options.push({
          name: game.i18n.localize("CARDIGAN.Tooltip.Equip"),
          icon: '<i class="fa-solid fa-hand-fist fa-fw"></i>',
          condition: () => item.isOwner,
          callback: li => ContextMenuActions.onAction(li, "equip", item, sheet)
        });
      }
    }

    if (item.type === "armadura") {
      if (item.system.equipped) {
        options.push({
          name: game.i18n.localize("CARDIGAN.Tooltip.Unequip"),
          icon: '<i class="fa-solid fa-shield-slash fa-fw"></i>',
          condition: () => item.isOwner,
          callback: li => ContextMenuActions.onAction(li, "unequipArmor", item, sheet)
        });
      } else {
        options.push({
          name: game.i18n.localize("CARDIGAN.Tooltip.Equip"),
          icon: '<i class="fa-solid fa-shield fa-fw"></i>',
          condition: () => item.isOwner,
          callback: li => ContextMenuActions.onAction(li, "equipArmor", item, sheet)
        });
      }
    }

    if (item.type === "arma") {
      options.push({
        name: "Mostrar no Chat",
        icon: '<i class="fa-solid fa-comment-dots fa-fw"></i>',
        condition: () => item.type === "arma",
        callback: li => ContextMenuActions.onAction(li, "showInChat", item, sheet)
      });
    }

    if (item.type === "armadura") {
      options.push({
        name: "Mostrar no Chat",
        icon: '<i class="fa-solid fa-comment-dots fa-fw"></i>',
        condition: () => item.type === "armadura",
        callback: li => ContextMenuActions.onAction(li, "showInChat", item, sheet)
      });
    }

    options.push({
      name: "Excluir",
      icon: '<i class="fa-solid fa-trash fa-fw"></i>',
      condition: () => item.isOwner,
      callback: li => ContextMenuActions.onAction(li, "delete", item, sheet)
    });

    return options;
  }

  /**
   * Handle context menu actions.
   * @param {HTMLElement} target - The action target
   * @param {string} action - The action to perform
   * @param {Item} item - The item to act on
   * @param {ActorSheet} sheet - The sheet instance
   * @param {HTMLElement|null} itemContainer - The item container element (for expand/collapse)
   */
  static async onAction(target, action, item, sheet, itemContainer = null) {
    switch (action) {
      case "toggleExpand":
        return sheet._handleToggleExpand(item, itemContainer);
      case "edit":
        return item.sheet.render(true);
      case "equip":
        return EquipmentActions.equipWeaponFromContext(item, sheet);
      case "unequip":
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          title: game.i18n.localize("CARDIGAN.ConfirmUnequipWeapon"),
          content: `<p>Tem certeza que deseja desequipar <strong>"${item.name}"</strong>?</p><p><em>${game.i18n.localize("CARDIGAN.ConfirmUnequipDescription")}</em></p>`,
          yes: () => true,
          no: () => false,
          defaultYes: false
        });
        if (confirmed) return EquipmentActions.unequipWeaponFromContext(item, sheet);
        return null;
      case "equipArmor":
        return EquipmentActions.equipArmorFromContext(item, sheet);
      case "unequipArmor":
        const armorConfirmed = await foundry.applications.api.DialogV2.confirm({
          title: game.i18n.localize("CARDIGAN.ConfirmUnequipArmor"),
          content: `<p>Tem certeza que deseja desequipar <strong>"${item.name}"</strong>?</p><p><em>${game.i18n.localize("CARDIGAN.ConfirmUnequipArmorDescription")}</em></p>`,
          yes: () => true,
          no: () => false,
          defaultYes: false
        });
        if (armorConfirmed) return EquipmentActions.unequipArmorFromContext(item, sheet);
        return null;
      case "showInChat":
        if (item.type === "arma") return ContextMenuActions.showWeaponInChat(item, sheet.document);
        else if (item.type === "armadura") return ContextMenuActions.showArmorInChat(item, sheet.document);
        return null;
      case "delete":
        if (item.type === "efeito") {
          const autoManagedEffects = {
            'Fratura': ['fracture'],
            'Exaustão': ['hunger', 'thirst'],
            'Intoxicado': ['toxicity'],
            'Inconsciente・Sono': ['toxicity']
          };

          const statusKeys = autoManagedEffects[item.name];
          if (statusKeys) {
            const activeStatuses = [];
            for (const statusKey of statusKeys) {
              const statusValue = sheet.document.system.status?.[statusKey] || 0;
              if (statusValue > 0) {
                activeStatuses.push({ key: statusKey, value: statusValue });
              }
            }

            if (activeStatuses.length > 0) {
              const statusInfo = activeStatuses.map(s => `${s.key}: ${s.value}`).join(', ');
              ui.notifications.warn(`Não é possível excluir o efeito "${item.name}" enquanto houver checkboxes marcadas (${statusInfo}). Desmarque as checkboxes primeiro.`);
              return null;
            }
          }
        }

        const deleteConfirmed = await foundry.applications.api.DialogV2.confirm({
          title: `Excluir ${item.name}?`,
          content: `<p>Tem certeza que deseja excluir <strong>"${item.name}"</strong>?</p><p><em>Esta ação não pode ser desfeita.</em></p>`,
          yes: () => true,
          no: () => false,
          defaultYes: false
        });

        if (deleteConfirmed) {
          console.log("[DEBUG DELETE] Item details:", {
            name: item.name,
            type: item.type,
            system: item.system,
            isTemporaryHealth: item.system.isTemporaryHealth,
            healthBonusValue: item.system.healthBonusValue
          });

          if (item.type === "efeito" && item.system.isTemporaryHealth && item.system.healthBonusValue) {
            console.log("[TEMPORARY HEALTH] Removing health bonus on effect deletion:", {
              effectName: item.name,
              bonusToRemove: item.system.healthBonusValue
            });
            const currentHealthBonus = sheet.document.system.status.healthBonus || 0;
            const calculatedHealthBonus = currentHealthBonus - item.system.healthBonusValue;
            const newHealthBonus = Math.max(0, calculatedHealthBonus);
            console.log("[TEMPORARY HEALTH] Health bonus calculation details:", {
              currentBonus: currentHealthBonus,
              bonusToRemove: item.system.healthBonusValue,
              calculated: calculatedHealthBonus,
              final: newHealthBonus
            });
            await sheet.document.update({ 'system.status.healthBonus': newHealthBonus });
            console.log("[TEMPORARY HEALTH] Health bonus adjusted:", {
              previousBonus: currentHealthBonus,
              newBonus: newHealthBonus
            });
          } else if (item.type === "efeito" && item.system.isTemporaryEnergy && item.system.energyBonusValue) {
            console.log("[TEMPORARY ENERGY] Removing energy bonus on effect deletion:", {
              effectName: item.name,
              bonusToRemove: item.system.energyBonusValue
            });
            const currentEnergyBonus = sheet.document.system.status.energyBonus || 0;
            const calculatedEnergyBonus = currentEnergyBonus - item.system.energyBonusValue;
            const newEnergyBonus = Math.max(0, calculatedEnergyBonus);
            console.log("[TEMPORARY ENERGY] Energy bonus calculation details:", {
              currentBonus: currentEnergyBonus,
              bonusToRemove: item.system.energyBonusValue,
              calculated: calculatedEnergyBonus,
              final: newEnergyBonus
            });
            await sheet.document.update({ 'system.status.energyBonus': newEnergyBonus });
            console.log("[TEMPORARY ENERGY] Energy bonus adjusted:", {
              previousBonus: currentEnergyBonus,
              newBonus: newEnergyBonus
            });
          } else if (item.type === "efeito" && item.system.isTemporaryArmor && item.system.armorBonusValue) {
            console.log("[TEMPORARY ARMOR] Removing armor bonus on effect deletion:", {
              effectName: item.name,
              bonusToRemove: item.system.armorBonusValue
            });
            const currentArmorBonus = sheet.document.system.status.armorBonus || 0;
            const calculatedArmorBonus = currentArmorBonus - item.system.armorBonusValue;
            const newArmorBonus = Math.max(0, calculatedArmorBonus);
            console.log("[TEMPORARY ARMOR] Armor bonus calculation details:", {
              currentBonus: currentArmorBonus,
              bonusToRemove: item.system.armorBonusValue,
              calculated: calculatedArmorBonus,
              final: newArmorBonus
            });
            await sheet.document.update({ 'system.status.armorBonus': newArmorBonus });
            console.log("[TEMPORARY ARMOR] Armor bonus adjusted:", {
              previousBonus: currentArmorBonus,
              newBonus: newArmorBonus
            });
          } else {
            console.log("[DEBUG DELETE] Item does not match temporary health criteria:", {
              isEfeito: item.type === "efeito",
              hasIsTemporaryHealth: !!item.system.isTemporaryHealth,
              hasHealthBonusValue: !!item.system.healthBonusValue
            });
          }

          return item.delete();
        }
        return null;
      case "rollSkill":
        const skillId = target.dataset.skillId;
        const skillItem = sheet.document.items.get(skillId);
        if (skillItem && skillItem.system.rollSkillCheck) {
          return skillItem.system.rollSkillCheck();
        }
        return null;
    }
  }

}
