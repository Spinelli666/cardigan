import { wrapWordsInGradientSpans } from '../../helpers/gradient-text.mjs';
import { buildHeaderBadgeTooltips } from './consumable-header-badges.mjs';
import { buildArmorPropertyEntries } from './armor-property-rows.mjs';

export class ItemExpand {

  /**
   * Builds the armor caixa-expansiva HTML (armor-backpack-summary.hbs) — used by toggleBackpackExpandById
   * for both the backpack row (mochila) and the equipped-armor-item row (armor-section-container), which
   * reuses the exact same .backpack-item-description-row/.wrapper sibling-<li> markup and CSS.
   * @param {Item} item
   * @returns {Promise<string>}
   */
  static async _buildArmorSummaryHtml(item) {
    const template = "systems/cardigan/templates/armors/armor-backpack-summary.hbs";
    const rawDescription = item.system.description || '';
    // ProseMirror saves an empty editor as "<p></p>" rather than "" — strip tags before checking.
    const hasDescription = rawDescription.replace(/<[^>]*>/g, '').trim().length > 0;
    const rawSystematicDescription = item.system.systematicDescription || '';
    const hasSystematicDescription = rawSystematicDescription.replace(/<[^>]*>/g, '').trim().length > 0;

    const armorEntries = buildArmorPropertyEntries(item);
    const armorPropertyRows = [];
    for (let i = 0; i < armorEntries.length; i += 3) {
      armorPropertyRows.push(armorEntries.slice(i, i + 3));
    }

    const content = await foundry.applications.handlebars.renderTemplate(template, {
      item,
      system: item.system,
      config: CONFIG.CARDIGAN,
      propertyRows: armorPropertyRows,
      hasAnyInfo: armorEntries.length > 0,
      enrichedDescription: hasDescription
        ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawDescription, {
            secrets: item.isOwner,
            documents: true,
            links: true,
            rolls: true,
            rollData: item.getRollData?.() || {}
          })
        : '',
      enrichedSystematicDescription: hasSystematicDescription
        ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawSystematicDescription, {
            secrets: item.isOwner,
            documents: true,
            links: true,
            rolls: true,
            rollData: item.getRollData?.() || {}
          })
        : ''
    });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = content;
    wrapWordsInGradientSpans(wrapper, '.consumable-summary-description p, .consumable-summary-systematic-description p');
    return wrapper.innerHTML;
  }

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
    const isSkill = item.type === 'skill';
    const isRecipe = item.type?.includes('recipe') || item.type?.includes('-recipe');

    let summaryClass;
    if (isSkill) summaryClass = ".skill-summary";
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
        if (isSkill) template = "systems/cardigan/templates/skills/skill-summary.hbs";
        else if (isRecipe) template = "systems/cardigan/templates/recipes/recipe-summary.hbs";
        else template = "systems/cardigan/templates/weapons/weapon-summary.hbs";

        const content = await foundry.applications.handlebars.renderTemplate(template, context);
        summary.insertAdjacentHTML("beforeend", content);
        sheet.expandedSections.set(itemId, true);
      } catch (error) {
        console.error(`Error creating ${isSkill ? 'skill' : isRecipe ? 'recipe' : 'weapon'} summary:`, error);
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
   * Called by _onToggleBackpackItemExpand (static wrapper) with the DOM event/target,
   * or directly by the context menu's "Expandir" action with just the item id.
   * @param {ActorSheet} sheet
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async onToggleBackpackExpand(sheet, event, target) {
    event.preventDefault();

    const itemId = target.dataset.itemId;
    if (!itemId) return;

    return ItemExpand.toggleBackpackExpandById(sheet, itemId);
  }

  /**
   * Toggle expand/collapse for a backpack row's description, by item id.
   * item-consumivel (item-consumivel-summary.hbs), armadura (armor-backpack-summary.hbs),
   * item-comum (item-common-summary.hbs), item-municao (item-ammunition-summary.hbs) and
   * item-ingredient (item-ingredient-summary.hbs) render real content; other backpack item
   * types just toggle the empty row, to be filled in later.
   * @param {ActorSheet} sheet
   * @param {string} itemId
   */
  static async toggleBackpackExpandById(sheet, itemId) {
    const descriptionRow = sheet.element.querySelector(`.backpack-item-description-row[data-item-id="${itemId}"]`);
    if (!descriptionRow) return;

    const itemRow = sheet.element.querySelector(`li.item[data-item-id="${itemId}"]`);
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
          const rawSystematicDescription = item.system.systematicDescription || '';
          const hasSystematicDescription = rawSystematicDescription.replace(/<[^>]*>/g, '').trim().length > 0;
          // Only show a property row (and its divider) when its value is non-zero.
          const armorBonusAmount = Number(item.system.armorBonusAmount) || 0;
          const movementBonusAmount = Number(item.system.movementBonus?.bonus) || 0;
          const criticalBonusAmount = Number(item.system.criticalHitBoostAmount) || 0;
          const hasArmorBonus = armorBonusAmount !== 0;
          const hasMovementBonus = movementBonusAmount !== 0;
          const hasCriticalBonus = criticalBonusAmount !== 0;
          const displayArmorBonus = armorBonusAmount > 0 ? `+${armorBonusAmount}` : `${armorBonusAmount}`;
          const displayMovementBonus = movementBonusAmount > 0 ? `+${movementBonusAmount}` : `${movementBonusAmount}`;
          const displayCriticalBonus = criticalBonusAmount > 0 ? `+${criticalBonusAmount}` : `${criticalBonusAmount}`;

          // Skill bonuses from the item's own "consumable-skill-bonuses-table" (flags.cardigan.consumableSkillBonuses),
          // shown abbreviated — same key order/abbreviations as _prepareConsumableSkillBonusRows in item-sheet.mjs.
          const skillAbbreviations = [
            { key: 'accuracy', abbr: 'PRE' },
            { key: 'evasion', abbr: 'EVA' },
            { key: 'strength', abbr: 'FOR' },
            { key: 'dexterity', abbr: 'DES' },
            { key: 'stamina', abbr: 'VIG' },
            { key: 'stealth', abbr: 'FUR' },
            { key: 'persuasion', abbr: 'PER' },
            { key: 'intelligence', abbr: 'INT' },
            { key: 'psionics', abbr: 'PSI' }
          ];
          const rawSkillBonuses = await item.getFlag('cardigan', 'consumableSkillBonuses');
          const skillBonusList = Array.isArray(rawSkillBonuses)
            ? rawSkillBonuses
            : (rawSkillBonuses && typeof rawSkillBonuses === 'object' ? Object.values(rawSkillBonuses) : []);
          const skillBonusByKey = skillBonusList.reduce((acc, entry) => {
            if (!entry || typeof entry.skill !== 'string') return acc;
            const key = entry.skill.trim();
            if (!key) return acc;
            const numericBonus = Number(entry.bonus ?? 0);
            acc[key] = Number.isFinite(numericBonus) ? numericBonus : 0;
            return acc;
          }, {});
          const skillBonusRows = skillAbbreviations
            .map(row => ({ abbr: row.abbr, value: skillBonusByKey[row.key] ?? 0 }))
            .filter(row => row.value !== 0)
            .map(row => ({ ...row, displayValue: row.value > 0 ? `+${row.value}` : `${row.value}` }));
          const hasSkillBonuses = skillBonusRows.length > 0;

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
          const hasAnyStatus = statusRows.length > 0;
          const hasAnyProperty = hasArmorBonus || hasMovementBonus || hasCriticalBonus || hasSkillBonuses;

          // Flatten armor/movement/critical/skill/status into one ordered list, then chunk
          // into rows of 3 — each row is its own flex line, centered by its parent
          // (.consumable-summary-properties has align-items: center), so a shorter trailing
          // row (e.g. a single leftover item) centers under the fuller rows above it.
          const propertyEntries = [];
          if (hasArmorBonus) propertyEntries.push({ kind: 'armor', displayValue: displayArmorBonus });
          if (hasMovementBonus) propertyEntries.push({ kind: 'movement', displayValue: displayMovementBonus });
          if (hasCriticalBonus) propertyEntries.push({ kind: 'critical', displayValue: displayCriticalBonus });
          for (const row of skillBonusRows) propertyEntries.push({ kind: 'skill', displayValue: row.displayValue, abbr: row.abbr });
          for (const row of statusRows) propertyEntries.push({ kind: 'status', displayValue: row.displayValue, icon: row.icon, label: row.label });

          const propertyRows = [];
          for (let i = 0; i < propertyEntries.length; i += 3) {
            propertyRows.push(propertyEntries.slice(i, i + 3));
          }

          const { lifeEnergyTooltipHtml, effectsTooltipHtml, skillTestTooltipHtml } = await buildHeaderBadgeTooltips(item);

          const content = await foundry.applications.handlebars.renderTemplate(template, {
            item,
            system: item.system,
            config: CONFIG.CARDIGAN,
            propertyRows,
            lifeEnergyTooltipHtml,
            effectsTooltipHtml,
            skillTestTooltipHtml,
            hasAnyInfo: hasAnyProperty || hasAnyStatus,
            enrichedDescription: hasDescription
              ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawDescription, {
                  secrets: item.isOwner,
                  documents: true,
                  links: true,
                  rolls: true,
                  rollData: item.getRollData?.() || {}
                })
              : '',
            enrichedSystematicDescription: hasSystematicDescription
              ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawSystematicDescription, {
                  secrets: item.isOwner,
                  documents: true,
                  links: true,
                  rolls: true,
                  rollData: item.getRollData?.() || {}
                })
              : ''
          });
          wrapper.innerHTML = content;
          wrapWordsInGradientSpans(wrapper, '.consumable-summary-description p, .consumable-summary-systematic-description p');
        } catch (error) {
          console.error("Error rendering consumable summary:", error);
        }
      } else if (item?.type === 'armadura' && wrapper) {
        try {
          wrapper.innerHTML = await ItemExpand._buildArmorSummaryHtml(item);
        } catch (error) {
          console.error("Error rendering armor summary:", error);
        }
      } else if (item?.type === 'item-comum' && wrapper) {
        try {
          const template = "systems/cardigan/templates/common-items/item-common-summary.hbs";
          const rawDescription = item.system.description || '';
          const hasDescription = rawDescription.replace(/<[^>]*>/g, '').trim().length > 0;
          const rawSystematicDescription = item.system.systematicDescription || '';
          const hasSystematicDescription = rawSystematicDescription.replace(/<[^>]*>/g, '').trim().length > 0;

          const content = await foundry.applications.handlebars.renderTemplate(template, {
            item,
            system: item.system,
            config: CONFIG.CARDIGAN,
            enrichedDescription: hasDescription
              ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawDescription, {
                  secrets: item.isOwner,
                  documents: true,
                  links: true,
                  rolls: true,
                  rollData: item.getRollData?.() || {}
                })
              : '',
            enrichedSystematicDescription: hasSystematicDescription
              ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawSystematicDescription, {
                  secrets: item.isOwner,
                  documents: true,
                  links: true,
                  rolls: true,
                  rollData: item.getRollData?.() || {}
                })
              : ''
          });
          wrapper.innerHTML = content;
          wrapWordsInGradientSpans(wrapper, '.consumable-summary-description p, .consumable-summary-systematic-description p');
        } catch (error) {
          console.error("Error rendering common item summary:", error);
        }
      } else if (item?.type === 'item-municao' && wrapper) {
        try {
          const template = "systems/cardigan/templates/ammunitions/item-ammunition-summary.hbs";
          const rawDescription = item.system.description || '';
          const hasDescription = rawDescription.replace(/<[^>]*>/g, '').trim().length > 0;
          const rawSystematicDescription = item.system.systematicDescription || '';
          const hasSystematicDescription = rawSystematicDescription.replace(/<[^>]*>/g, '').trim().length > 0;

          const content = await foundry.applications.handlebars.renderTemplate(template, {
            item,
            system: item.system,
            config: CONFIG.CARDIGAN,
            enrichedDescription: hasDescription
              ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawDescription, {
                  secrets: item.isOwner,
                  documents: true,
                  links: true,
                  rolls: true,
                  rollData: item.getRollData?.() || {}
                })
              : '',
            enrichedSystematicDescription: hasSystematicDescription
              ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawSystematicDescription, {
                  secrets: item.isOwner,
                  documents: true,
                  links: true,
                  rolls: true,
                  rollData: item.getRollData?.() || {}
                })
              : ''
          });
          wrapper.innerHTML = content;
          wrapWordsInGradientSpans(wrapper, '.consumable-summary-description p, .consumable-summary-systematic-description p');
        } catch (error) {
          console.error("Error rendering ammunition summary:", error);
        }
      } else if (item?.type === 'item-ingredient' && wrapper) {
        try {
          const template = "systems/cardigan/templates/ingredients/item-ingredient-summary.hbs";
          const rawDescription = item.system.description || '';
          const hasDescription = rawDescription.replace(/<[^>]*>/g, '').trim().length > 0;
          const rawSystematicDescription = item.system.systematicDescription || '';
          const hasSystematicDescription = rawSystematicDescription.replace(/<[^>]*>/g, '').trim().length > 0;

          const content = await foundry.applications.handlebars.renderTemplate(template, {
            item,
            system: item.system,
            config: CONFIG.CARDIGAN,
            enrichedDescription: hasDescription
              ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawDescription, {
                  secrets: item.isOwner,
                  documents: true,
                  links: true,
                  rolls: true,
                  rollData: item.getRollData?.() || {}
                })
              : '',
            enrichedSystematicDescription: hasSystematicDescription
              ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawSystematicDescription, {
                  secrets: item.isOwner,
                  documents: true,
                  links: true,
                  rolls: true,
                  rollData: item.getRollData?.() || {}
                })
              : ''
          });
          wrapper.innerHTML = content;
          wrapWordsInGradientSpans(wrapper, '.consumable-summary-description p, .consumable-summary-systematic-description p');
        } catch (error) {
          console.error("Error rendering ingredient summary:", error);
        }
      }
    }

    descriptionRow.classList.toggle('expanded', !expanded);
    itemRow?.classList.toggle('description-expanded', !expanded);
    sheet.expandedSections.set(itemId, !expanded);
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
    const isSkill = item.type === 'skill';
    const isRecipe = item.type?.includes('recipe') || item.type?.includes('-recipe');

    let summaryClass;
    if (isSkill) summaryClass = ".skill-summary";
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
        if (isSkill) template = "systems/cardigan/templates/skills/skill-summary.hbs";
        else if (isRecipe) template = "systems/cardigan/templates/recipes/recipe-summary.hbs";
        else template = "systems/cardigan/templates/weapons/weapon-summary.hbs";

        const content = await foundry.applications.handlebars.renderTemplate(template, context);
        summary.insertAdjacentHTML("beforeend", content);
        sheet.expandedSections.set(itemId, true);
      } catch (error) {
        console.error(`Error creating ${isSkill ? 'skill' : isRecipe ? 'recipe' : 'weapon'} summary:`, error);
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
