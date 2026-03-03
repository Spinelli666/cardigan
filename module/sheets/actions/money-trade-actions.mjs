/**
 * Money & Trade Actions Module
 * Handles event handlers related to money and negotiation/trade
 */
export class MoneyTradeActions {

  /**
   * Handle initiating trade with target actor
   * @param {Event} event
   * @param {HTMLElement} target
   * @param {CardiganSystemActorSheet} sheet
   */
  static async onInitiateTrade(event, target, sheet) {
    event.preventDefault();
    const actor = sheet.actor;

    // Validate targeting: must have exactly 1 target
    if (game.user.targets.size === 0) {
      ui.notifications.error("Selecione um alvo antes de negociar!");
      return;
    }

    if (game.user.targets.size > 1) {
      ui.notifications.warn("Você só pode negociar com um alvo por vez!");
      return;
    }

    // Get the single target
    const targetToken = game.user.targets.first();

    if (!targetToken || !targetToken.actor) {
      ui.notifications.error("Alvo inválido!");
      return;
    }

    const targetActor = targetToken.actor;

    // Prevent trading with self
    if (targetActor.id === actor.id) {
      ui.notifications.warn("Você não pode negociar consigo mesmo!");
      return;
    }

    // Generate unique trade ID
    const tradeId = foundry.utils.randomID();

    // If GM, show trade mode selection dialog
    if (game.user.isGM) {
      const mode = await MoneyTradeActions._showTradeModeSelection();

      if (!mode) return; // User cancelled

      if (mode === 'merchant') {
        // Initiate merchant trade
        game.socket.emit('system.cardigan', {
          action: 'merchantTradeRequest',
          data: {
            tradeId: tradeId,
            merchantId: actor.id,
            customerId: targetActor.id,
            merchantOwnerId: game.user.id
          }
        });

        ui.notifications.info(`Solicitação de comércio enviada para ${targetActor.name}! Aguardando resposta...`);
        return;
      }
      // else: fall through to normal trade
    }

    // Normal trade (non-GM or GM selected normal mode)
    game.socket.emit('system.cardigan', {
      action: 'tradeRequest',
      data: {
        tradeId: tradeId,
        initiatorId: actor.id,
        targetId: targetActor.id
      }
    });

    ui.notifications.info(`Solicitação de negociação enviada para ${targetActor.name}! Aguardando resposta...`);
  }

  /**
   * Show trade mode selection dialog (GM only)
   * @returns {Promise<string|null>} Selected mode ('normal' or 'merchant') or null if cancelled
   */
  static async _showTradeModeSelection() {
    const content = await foundry.applications.handlebars.getTemplate(
      'systems/cardigan/templates/dialogs/trade-mode-selection.hbs'
    );
    const html = await content({});

    return new Promise((resolve) => {
      const dialog = new foundry.applications.api.DialogV2({
        window: {
          title: "Modo de Negociação",
          icon: "fa-solid fa-handshake"
        },
        content: html,
        buttons: [
          {
            action: "cancel",
            label: "Cancelar",
            icon: "fa-solid fa-times",
            callback: () => resolve(null)
          }
        ],
        position: { width: 450 }
      });

      // Add click handlers to mode options
      dialog.addEventListener('render', () => {
        const options = dialog.element.querySelectorAll('.mode-option');
        options.forEach(option => {
          option.addEventListener('click', () => {
            const mode = option.dataset.mode;
            dialog.close();
            resolve(mode);
          });
        });
      });

      dialog.render(true);
    });
  }
}
