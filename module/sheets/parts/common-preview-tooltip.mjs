import { wrapWordsInGradientSpans } from '../../helpers/gradient-text.mjs';

/**
 * Builds and attaches the native Foundry tooltip (data-tooltip-html) shown when hovering an
 * item-comum's icon in the backpack list, and posts the same content as a chat message.
 * Mirrors ConsumablePreviewTooltip/ArmorPreviewTooltip, reusing the same
 * templates/tooltips/item-preview-tooltip.hbs — item-comum has no armor/movement/critical/
 * skill/status characteristics and no life-energy/effects/skill-test/single/heavy/magicalArtifact/
 * stylish header badges, so hasInfoRows and hasHeaderBadges are always false here. Also omits the
 * consumable-summary-info-border divider image above the systematic description (hideInfoBorder).
 */
export class CommonPreviewTooltip {
  /**
   * @param {HTMLElement} html - The rendered sheet element
   * @param {Actor} actor - Actor owning the inventory
   */
  static async attach(html, actor) {
    const icons = html.querySelectorAll('li.item.backpack-row-generic > .item-image img');
    if (!icons.length) return;

    for (const icon of icons) {
      const row = icon.closest('li.item[data-item-id]');
      const itemId = row?.dataset.itemId;
      if (!itemId) continue;

      const item = actor.items.get(itemId);
      if (item?.type !== 'item-comum') continue;

      try {
        icon.dataset.tooltipHtml = await this._buildTooltipHtml(item);
      } catch (error) {
        console.error('[CARDIGAN] Error building common item preview tooltip:', error);
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

    const content = await foundry.applications.handlebars.renderTemplate('systems/cardigan/templates/tooltips/item-preview-tooltip.hbs', {
      item,
      hasDescription,
      description,
      hasInfoRows: false,
      hasSystematicDescription,
      enrichedSystematicDescription,
      hasHeaderBadges: false,
      hideInfoBorder: true,
      hideFooter,
      hideDividers
    });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = content;
    wrapWordsInGradientSpans(wrapper, '.item-preview-tooltip-description p, .consumable-summary-systematic-description p');
    return wrapper.innerHTML;
  }
}
