export class ItemExpand {

  /**
   * Toggle expand/collapse state of an item row, rendering the inline summary on expand.
   * Called by _handleToggleExpand (instance wrapper).
   * @param {ActorSheet} sheet
   * @param {Item} item
   * @param {HTMLElement} itemContainer
   */
  static async handleToggleExpand(sheet, item, itemContainer) {
    if (!item || !itemContainer) {
      console.warn("Could not find item or item container for expand toggle");
      return;
    }

    const summary = itemContainer.querySelector(":scope > .item-description > .wrapper");
    const itemId = item.id;

    if (!summary) {
      console.warn("Could not find summary wrapper");
      return;
    }

    const expanded = sheet.expandedSections.get(itemId);
    const isArmor = item.type === 'armadura';
    const isWeapon = item.type === 'arma';
    const isSkill = item.type === 'skill';
    const isRecipe = item.type?.includes('recipe') || item.type?.includes('-recipe');

    let summaryClass;
    if (isArmor) summaryClass = ".armor-summary";
    else if (isWeapon) summaryClass = ".weapon-summary";
    else if (isSkill) summaryClass = ".skill-summary";
    else if (isRecipe) summaryClass = ".recipe-summary";
    else summaryClass = ".weapon-summary";

    if (expanded) {
      sheet.expandedSections.set(itemId, false);
      summary.querySelector(summaryClass)?.remove();
    } else {
      try {
        const context = {
          actor: sheet.actor,
          item: item,
          system: item.system,
          config: CONFIG.CARDIGAN,
          enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description || "", {
            secrets: item.isOwner,
            documents: true,
            links: true,
            rolls: true,
            rollData: item.getRollData?.() || {}
          })
        };

        if (isSkill && item.system.enhancements && Array.isArray(item.system.enhancements)) {
          const enhancements = [];
          for (let i = 0; i < item.system.enhancements.length; i++) {
            const enhancement = item.system.enhancements[i];
            const isAcquired = item.system.acquiredEnhancements?.[i] === true;
            if (enhancement?.description) {
              enhancements.push({
                number: i + 1,
                name: enhancement.name || `Enhancement ${i + 1}`,
                description: enhancement.description,
                acquired: isAcquired,
                enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(enhancement.description, {
                  secrets: item.isOwner,
                  documents: true,
                  links: true,
                  rolls: true,
                  rollData: item.getRollData?.() || {}
                })
              });
            }
          }
          if (enhancements.length > 0) context.enhancements = enhancements;
        }

        let template;
        if (isArmor) template = "systems/cardigan/templates/armors/armor-summary.hbs";
        else if (isSkill) template = "systems/cardigan/templates/skills/skill-summary.hbs";
        else if (isRecipe) template = "systems/cardigan/templates/recipes/recipe-summary.hbs";
        else template = "systems/cardigan/templates/weapons/weapon-summary.hbs";

        const content = await foundry.applications.handlebars.renderTemplate(template, context);
        summary.insertAdjacentHTML("beforeend", content);
        sheet.expandedSections.set(itemId, true);
      } catch (error) {
        console.error(`Error creating ${isArmor ? 'armor' : isSkill ? 'skill' : isRecipe ? 'recipe' : 'weapon'} summary:`, error);
        return;
      }
    }

    itemContainer.classList.toggle("collapsed", expanded);
  }

  /**
   * Refresh the expanded skill summary without collapsing/re-expanding.
   * Used when enhancement checkboxes change.
   * Called by _refreshExpandedSummary (instance wrapper).
   * @param {ActorSheet} sheet
   * @param {string} itemId
   * @param {Item} item
   */
  static async refreshExpandedSummary(sheet, itemId, item) {
    const itemContainer = sheet.element.querySelector(`[data-item-id="${itemId}"]`)?.closest('.item-row, .item');
    if (!itemContainer) {
      console.warn("Could not find item container for refresh");
      return;
    }

    const summary = itemContainer.querySelector(":scope > .item-description > .wrapper");
    if (!summary) {
      console.warn("Could not find summary wrapper for refresh");
      return;
    }

    const isSkill = item.type === 'skill';
    if (!isSkill) return;

    const oldSummary = summary.querySelector(".skill-summary");
    if (oldSummary) oldSummary.remove();

    try {
      const context = {
        actor: sheet.actor,
        item: item,
        system: item.system,
        config: CONFIG.CARDIGAN,
        enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description || "", {
          secrets: item.isOwner,
          documents: true,
          links: true,
          rolls: true,
          rollData: item.getRollData?.() || {}
        })
      };

      if (item.system.enhancements && Array.isArray(item.system.enhancements)) {
        const enhancements = [];
        for (let i = 0; i < item.system.enhancements.length; i++) {
          const enhancement = item.system.enhancements[i];
          const isAcquired = item.system.acquiredEnhancements?.[i] === true;
          if (enhancement?.description) {
            enhancements.push({
              number: i + 1,
              name: enhancement.name || `Enhancement ${i + 1}`,
              description: enhancement.description,
              acquired: isAcquired,
              enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(enhancement.description, {
                secrets: item.isOwner,
                documents: true,
                links: true,
                rolls: true,
                rollData: item.getRollData?.() || {}
              })
            });
          }
        }
        if (enhancements.length > 0) context.enhancements = enhancements;
      }

      const template = "systems/cardigan/templates/skills/skill-summary.hbs";
      const content = await foundry.applications.handlebars.renderTemplate(template, context);
      summary.insertAdjacentHTML("beforeend", content);
    } catch (error) {
      console.error("Error refreshing skill summary:", error);
    }
  }

  /**
   * Static action handler for DEFAULT_OPTIONS.actions toggleExpand.
   * Called by _onToggleExpand (static wrapper) with `this` bound to the sheet instance.
   * @param {ActorSheet} sheet
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async onToggleExpand(sheet, event, target) {
    event.preventDefault();

    const icon = target.querySelector(":scope > i");
    const row = target.closest("[data-uuid]") || target.closest("[data-item-id]");

    if (!row) {
      console.warn("Could not find item row for expand toggle");
      return;
    }

    const summary = row.querySelector(":scope > .item-description > .wrapper");
    const itemId = row.dataset.itemId;
    const item = sheet.document.items.get(itemId);

    if (!item || !summary) {
      console.warn("Could not find item or summary wrapper");
      return;
    }

    const expanded = sheet.expandedSections.get(itemId);
    const isArmor = item.type === 'armadura';
    const isWeapon = item.type === 'arma';
    const isSkill = item.type === 'skill';
    const isRecipe = item.type?.includes('recipe') || item.type?.includes('-recipe');

    let summaryClass;
    if (isArmor) summaryClass = ".armor-summary";
    else if (isWeapon) summaryClass = ".weapon-summary";
    else if (isSkill) summaryClass = ".skill-summary";
    else if (isRecipe) summaryClass = ".recipe-summary";
    else summaryClass = ".weapon-summary";

    if (expanded) {
      sheet.expandedSections.set(itemId, false);
      summary.querySelector(summaryClass)?.remove();
    } else {
      try {
        const context = {
          actor: sheet.document,
          item: item,
          system: item.system,
          config: CONFIG.CARDIGAN,
          enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description || "", {
            secrets: item.isOwner,
            documents: true,
            links: true,
            rolls: true,
            rollData: item.getRollData?.() || {}
          })
        };

        if (isSkill && item.system.enhancements && Array.isArray(item.system.enhancements)) {
          const enhancements = [];
          for (let i = 0; i < item.system.enhancements.length; i++) {
            const enhancement = item.system.enhancements[i];
            const isAcquired = item.system.acquiredEnhancements?.[i] === true;
            if (enhancement && enhancement.description) {
              enhancements.push({
                number: i + 1,
                name: enhancement.name || `Enhancement ${i + 1}`,
                description: enhancement.description,
                acquired: isAcquired,
                enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(enhancement.description, {
                  secrets: item.isOwner,
                  documents: true,
                  links: true,
                  rolls: true,
                  rollData: item.getRollData?.() || {}
                })
              });
            }
          }
          if (enhancements.length > 0) context.enhancements = enhancements;
        }

        let template;
        if (isArmor) template = "systems/cardigan/templates/armors/armor-summary.hbs";
        else if (isSkill) template = "systems/cardigan/templates/skills/skill-summary.hbs";
        else if (isRecipe) template = "systems/cardigan/templates/recipes/recipe-summary.hbs";
        else template = "systems/cardigan/templates/weapons/weapon-summary.hbs";

        const content = await foundry.applications.handlebars.renderTemplate(template, context);
        summary.insertAdjacentHTML("beforeend", content);
        sheet.expandedSections.set(itemId, true);
      } catch (error) {
        console.error(`Error creating ${isArmor ? 'armor' : isSkill ? 'skill' : isRecipe ? 'recipe' : 'weapon'} summary:`, error);
        return;
      }
    }

    row.classList.toggle("collapsed", expanded);

    if (icon) {
      icon.classList.toggle("fa-compress", !expanded);
      icon.classList.toggle("fa-expand", expanded);
      target.setAttribute("data-tooltip", !expanded ? "Colapsar Detalhes" : "Expandir Detalhes");
    }
  }

}
