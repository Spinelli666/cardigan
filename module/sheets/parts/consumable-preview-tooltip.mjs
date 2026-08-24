import { wrapWordsInGradientSpans } from '../../helpers/gradient-text.mjs';

/**
 * Builds and attaches the native Foundry tooltip (data-tooltip-html) shown when hovering an
 * item-consumivel's icon in the backpack list. The content needs async data (skill bonus flag
 * lookup, enrichHTML), which the static Handlebars markup in equipment.hbs can't do — so it's
 * computed here, once per row, right after the sheet renders, and set directly on the element.
 * Interaction (show/hide/lock/position) stays 100% native — this only fills the dataset attribute.
 */
export class ConsumablePreviewTooltip {
  /**
   * @param {HTMLElement} html - The rendered sheet element
   * @param {Actor} actor - Actor owning the inventory
   */
  static async attach(html, actor) {
    const icons = html.querySelectorAll('li.item.backpack-row-consumable > .item-image img');
    if (!icons.length) return;

    for (const icon of icons) {
      const row = icon.closest('li.item[data-item-id]');
      const itemId = row?.dataset.itemId;
      if (!itemId) continue;

      const item = actor.items.get(itemId);
      if (!item) continue;

      try {
        icon.dataset.tooltipHtml = await this._buildTooltipHtml(item);
      } catch (error) {
        console.error('[CARDIGAN] Error building item preview tooltip:', error);
      }
    }
  }

  /**
   * Posts the item's preview tooltip (same content/styling as the backpack hover tooltip,
   * minus the "click to lock" footer, which only makes sense in the floating tooltip) as a
   * chat message. Used by the image click and the "Mostrar no Chat" context menu action.
   * @param {Item} item
   * @param {Actor} actor
   * @returns {Promise<ChatMessage>}
   */
  static async postToChat(item, actor) {
    const content = await this._buildTooltipHtml(item, { hideFooter: true, hideDividers: true });

    return ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor }),
      style: CONST.CHAT_MESSAGE_STYLES.OTHER
    });
  }

  /**
   * @param {Item} item
   * @param {object} [options]
   * @param {boolean} [options.hideFooter] - Omit the "click to lock" footer (used when posting to chat).
   * @param {boolean} [options.hideDividers] - Omit the decorative dividers (used when posting to chat).
   * @returns {Promise<string>}
   */
  static async _buildTooltipHtml(item, { hideFooter = false, hideDividers = false } = {}) {
    const rawDescription = item.system.description || '';
    // ProseMirror saves an empty editor as "<p></p>" rather than "" — strip tags before checking.
    const hasDescription = rawDescription.replace(/<[^>]*>/g, '').trim().length > 0;
    const description = hasDescription
      ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawDescription, {
          secrets: item.isOwner,
          documents: true,
          links: true,
          rolls: true,
          rollData: item.getRollData?.() || {}
        })
      : '';

    const rawSystematicDescription = item.system.systematicDescription || '';
    const hasSystematicDescription = rawSystematicDescription.replace(/<[^>]*>/g, '').trim().length > 0;
    const enrichedSystematicDescription = hasSystematicDescription
      ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawSystematicDescription, {
          secrets: item.isOwner,
          documents: true,
          links: true,
          rolls: true,
          rollData: item.getRollData?.() || {}
        })
      : '';

    const infoRows = await this._buildInfoRows(item);

    const content = await foundry.applications.handlebars.renderTemplate('systems/cardigan/templates/tooltips/item-preview-tooltip.hbs', {
      item,
      hasDescription,
      description,
      infoRows,
      hasInfoRows: infoRows.length > 0,
      hasSystematicDescription,
      enrichedSystematicDescription,
      hideFooter,
      hideDividers
    });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = content;
    wrapWordsInGradientSpans(wrapper, '.item-preview-tooltip-description p, .consumable-summary-systematic-description p');
    return wrapper.innerHTML;
  }

  /**
   * Merges armor/movement/critical bonuses, skill bonuses and status ailment modifiers into a
   * single ordered list of rows — same source data as the item's own Propriedades tab, but shown
   * together in one list here instead of split across two divs like the backpack expandable box.
   * @param {Item} item
   * @returns {Promise<Array<object>>}
   */
  static async _buildInfoRows(item) {
    const rows = [];

    const armorBonus = Number(item.system.armorBonusAmount) || 0;
    if (armorBonus !== 0) {
      rows.push({ kind: 'armor', icon: 'icon-armor.svg', label: 'Bônus de Armadura', displayValue: armorBonus > 0 ? `+${armorBonus}` : `${armorBonus}` });
    }

    const movementBonus = Number(item.system.movementBonus?.bonus) || 0;
    if (movementBonus !== 0) {
      rows.push({ kind: 'movement', icon: 'icon-movement.svg', label: 'Bônus de Movimento', displayValue: movementBonus > 0 ? `+${movementBonus}` : `${movementBonus}` });
    }

    const criticalBonus = Number(item.system.criticalHitBoostAmount) || 0;
    if (criticalBonus !== 0) {
      rows.push({ kind: 'critical', icon: 'icon-critical.svg', label: 'Bônus de Crítico', displayValue: criticalBonus > 0 ? `+${criticalBonus}` : `${criticalBonus}` });
    }

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
    for (const { key, abbr } of skillAbbreviations) {
      const value = skillBonusByKey[key] ?? 0;
      if (value !== 0) {
        rows.push({ kind: 'skill', abbr, displayValue: value > 0 ? `+${value}` : `${value}` });
      }
    }

    const statusDefs = [
      { hasFlag: 'hasFractureModifier', typeFlag: 'fractureModifierType', amountFlag: 'fractureModifierAmount', icon: 'icon-fracture.svg', label: 'Fratura' },
      { hasFlag: 'hasToxicityModifier', typeFlag: 'toxicityModifierType', amountFlag: 'toxicityModifierAmount', icon: 'icon-toxic.svg', label: 'Toxicidade' },
      { hasFlag: 'hasSanityModifier', typeFlag: 'sanityModifierType', amountFlag: 'sanityModifierAmount', icon: 'icon-sanity.svg', label: 'Sanidade' },
      { hasFlag: 'hasFoodModifier', typeFlag: 'foodModifierType', amountFlag: 'foodModifierAmount', icon: 'icon-hunger.svg', label: 'Fome' },
      { hasFlag: 'hasWaterModifier', typeFlag: 'waterModifierType', amountFlag: 'waterModifierAmount', icon: 'icon-thirst.svg', label: 'Sede' }
    ];
    for (const def of statusDefs) {
      const amount = Number(item.system[def.amountFlag]) || 0;
      const isDecrease = item.system[def.typeFlag] === 'decrease';
      const value = item.system[def.hasFlag] ? (isDecrease ? -amount : amount) : 0;
      if (value !== 0) {
        rows.push({ kind: 'status', icon: def.icon, label: def.label, displayValue: value > 0 ? `+${value}` : `${value}` });
      }
    }

    rows.forEach((row, index) => {
      row.showBorder = index < rows.length - 1;
    });

    return rows;
  }
}
