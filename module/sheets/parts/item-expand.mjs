import CardiganTooltipManager from '../../tooltips/tooltip-manager.mjs';

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
   * Toggle expand/collapse for a backpack row's description.
   * Only item-consumivel items render real content (item-consumivel-summary.hbs) for now;
   * other backpack item types just toggle the empty row, to be filled in later.
   * Called by _onToggleBackpackItemExpand (static wrapper).
   * @param {ActorSheet} sheet
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async onToggleBackpackExpand(sheet, event, target) {
    event.preventDefault();

    const itemId = target.dataset.itemId;
    if (!itemId) return;

    const descriptionRow = sheet.element.querySelector(`.backpack-item-description-row[data-item-id="${itemId}"]`);
    if (!descriptionRow) return;

    const itemRow = target.closest('li.item');
    const wrapper = descriptionRow.querySelector('.wrapper');

    const expanded = sheet.expandedSections.get(itemId);

    if (expanded) {
      if (wrapper) wrapper.innerHTML = '';
    } else {
      const item = sheet.document.items.get(itemId);
      if (item?.type === 'item-consumivel' && wrapper) {
        try {
          const template = "systems/cardigan/templates/consumables/item-consumivel-summary.hbs";
          const rawDescription = item.system.description || '';
          // ProseMirror saves an empty editor as "<p></p>" rather than "", which is
          // truthy as a string — strip tags before checking so an untouched/cleared
          // description correctly hides the summary/border instead of rendering blank.
          const hasDescription = rawDescription.replace(/<[^>]*>/g, '').trim().length > 0;
          // Only show a property row (and its divider) when its value is non-zero.
          const hasArmorBonus = Number(item.system.armorBonusAmount) !== 0;
          const hasMovementBonus = Number(item.system.movementBonus?.bonus) !== 0;
          const hasCriticalBonus = Number(item.system.criticalHitBoostAmount) !== 0;

          // Status ailment modifiers: "decrease" (remove) shows as a negative number,
          // "increase" (add) shows as a positive number. Only rendered when active.
          const statusDefs = [
            { hasFlag: 'hasFractureModifier', typeFlag: 'fractureModifierType', amountFlag: 'fractureModifierAmount', icon: 'icon-fracture.svg', label: 'Fratura' },
            { hasFlag: 'hasToxicityModifier', typeFlag: 'toxicityModifierType', amountFlag: 'toxicityModifierAmount', icon: 'icon-toxic.svg', label: 'Toxicidade' },
            { hasFlag: 'hasSanityModifier', typeFlag: 'sanityModifierType', amountFlag: 'sanityModifierAmount', icon: 'icon-sanity.svg', label: 'Sanidade' },
            { hasFlag: 'hasFoodModifier', typeFlag: 'foodModifierType', amountFlag: 'foodModifierAmount', icon: 'icon-hunger.svg', label: 'Fome' },
            { hasFlag: 'hasWaterModifier', typeFlag: 'waterModifierType', amountFlag: 'waterModifierAmount', icon: 'icon-thirst.svg', label: 'Sede' }
          ];
          const statusRows = statusDefs
            .map(def => {
              const amount = Number(item.system[def.amountFlag]) || 0;
              const isDecrease = item.system[def.typeFlag] === 'decrease';
              const value = item.system[def.hasFlag] ? (isDecrease ? -amount : amount) : 0;
              return { icon: def.icon, label: def.label, value, displayValue: value > 0 ? `+${value}` : `${value}` };
            })
            .filter(row => row.value !== 0);
          statusRows.forEach((row, index) => {
            row.showBorder = index < statusRows.length - 1;
          });
          const hasAnyStatus = statusRows.length > 0;
          const hasAnyProperty = hasArmorBonus || hasMovementBonus || hasCriticalBonus;

          const content = await foundry.applications.handlebars.renderTemplate(template, {
            item,
            system: item.system,
            config: CONFIG.CARDIGAN,
            hasArmorBonus,
            hasMovementBonus,
            hasCriticalBonus,
            hasAnyProperty,
            // A border only makes sense between two visible rows, never trailing after the last one.
            showArmorBorder: hasArmorBonus && (hasMovementBonus || hasCriticalBonus),
            showMovementBorder: hasMovementBonus && hasCriticalBonus,
            statusRows,
            hasAnyStatus,
            hasAnyInfo: hasAnyProperty || hasAnyStatus,
            enrichedDescription: hasDescription
              ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawDescription, {
                  secrets: item.isOwner,
                  documents: true,
                  links: true,
                  rolls: true,
                  rollData: item.getRollData?.() || {}
                })
              : ''
          });
          wrapper.innerHTML = content;
          ItemExpand._wrapDescriptionWordsInGradientSpans(wrapper);
          CardiganTooltipManager.attachConsumableBadgeTooltips(wrapper, item);
        } catch (error) {
          console.error("Error rendering consumable summary:", error);
        }
      }
    }

    descriptionRow.classList.toggle('expanded', !expanded);
    itemRow?.classList.toggle('description-expanded', !expanded);
    sheet.expandedSections.set(itemId, !expanded);
  }

  /**
   * Wrap each word of the consumable description in its own <span class="gradient-word">.
   * The gradient text-fill (background-clip: text) is normally sized to the whole paragraph's
   * bounding box, so on multi-line text the top line reads lighter and the bottom line darker.
   * Wrapping per word gives each word its own small box, so the gradient reads consistently
   * across the whole paragraph instead of fading top-to-bottom.
   * @param {HTMLElement} wrapper
   */
  static _wrapDescriptionWordsInGradientSpans(wrapper) {
    const paragraphs = wrapper.querySelectorAll('.consumable-summary-description p');
    for (const p of paragraphs) {
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) textNodes.push(node);

      for (const textNode of textNodes) {
        const fragment = document.createDocumentFragment();
        for (const part of textNode.textContent.split(/(\s+)/)) {
          if (part === '') continue;
          if (/^\s+$/.test(part)) {
            fragment.appendChild(document.createTextNode(part));
          } else {
            const span = document.createElement('span');
            span.className = 'gradient-word';
            span.textContent = part;
            fragment.appendChild(span);
          }
        }
        textNode.replaceWith(fragment);
      }
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
