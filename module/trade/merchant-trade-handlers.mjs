// Global Map to track active merchant trade dialogs
const activeMerchantTrades = new Map();

// Export to global scope so actor-sheet can access it
globalThis.cardiganActiveMerchantTrades = activeMerchantTrades;

// Global execution tracker to prevent duplicate GM executions
const merchantTradeExecutionTracker = new Map();

/**
 * Handle merchant trade request (customer receives)
 * @param {Object} data - Merchant trade request data
 */
export async function handleMerchantTradeRequest(data) {
  const { tradeId, merchantId, customerId } = data;

  // Check if this user owns the customer actor
  const customerActor = game.actors.get(customerId);
  if (!customerActor) return;

  // Only show dialog to users who have ownership of the customer
  const ownerIds = Object.entries(customerActor.ownership || {})
    .filter(([userId, level]) => level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && userId !== "default")
    .map(([userId]) => userId);

  const isOwner = ownerIds.includes(game.user.id);
  const isAssignedCharacter = game.user.character?.id === customerId;

  if (!isOwner && !isAssignedCharacter) return;

  const merchantActor = game.actors.get(merchantId);
  if (!merchantActor) return;

  // Ask for confirmation
  const accept = await foundry.applications.api.DialogV2.confirm({
    window: {
      title: "Solicitação de Comércio",
      icon: "fa-solid fa-store"
    },
    content: `
      <p style="margin-bottom: 12px;">
        <strong>${merchantActor.name}</strong> quer vender items para você!
      </p>
      <p>Deseja aceitar?</p>
    `,
    rejectClose: false,
    modal: true
  });

  if (!accept) {
    // Send rejection
    game.socket.emit('system.cardigan', {
      action: 'merchantTradeRejected',
      data: {
        tradeId: tradeId,
        rejectedBy: customerActor.name
      }
    });
    return;
  }

  // Accept - emit to open dialog for both
  game.socket.emit('system.cardigan', {
    action: 'merchantTradeAccepted',
    data: {
      tradeId: tradeId,
      merchantId: merchantId,
      customerId: customerId,
      merchantOwnerId: data.merchantOwnerId,
      customerOwnerId: game.user.id
    }
  });

  // Open dialog locally for customer
  const { MerchantTradeDialog } = await import('../applications/merchant-trade-dialog.mjs');
  const dialog = new MerchantTradeDialog({
    customer: customerActor,
    merchant: merchantActor,
    customerOwnerId: game.user.id,
    merchantOwnerId: data.merchantOwnerId
  });

  dialog.tradeId = tradeId;
  activeMerchantTrades.set(tradeId, dialog);
  dialog.render(true);
}

/**
 * Handle merchant trade acceptance (merchant receives)
 * @param {Object} data - Acceptance data
 */
export async function handleMerchantTradeAccepted(data) {
  const { tradeId, merchantId, customerId, merchantOwnerId, customerOwnerId } = data;

  // Check if this user is the merchant owner
  if (game.user.id !== merchantOwnerId) return;

  const merchantActor = game.actors.get(merchantId);
  const customerActor = game.actors.get(customerId);

  if (!merchantActor || !customerActor) return;

  // Open merchant dialog
  const { MerchantTradeDialog } = await import('../applications/merchant-trade-dialog.mjs');
  const dialog = new MerchantTradeDialog({
    customer: customerActor,
    merchant: merchantActor,
    customerOwnerId: customerOwnerId,
    merchantOwnerId: merchantOwnerId
  });

  dialog.tradeId = tradeId;
  activeMerchantTrades.set(tradeId, dialog);
  dialog.render(true);

  ui.notifications.success(`${customerActor.name} aceitou o comércio!`);
}

/**
 * Handle merchant trade rejection
 * @param {Object} data - Rejection data
 */
export function handleMerchantTradeRejected(data) {
  const { tradeId, rejectedBy } = data;

  ui.notifications.warn(`${rejectedBy} recusou o comércio.`);

  const dialog = activeMerchantTrades.get(tradeId);
  if (dialog) {
    dialog.close();
    activeMerchantTrades.delete(tradeId);
  }
}

/**
 * Handle merchant trade update
 * @param {Object} data - Update data
 */
export function handleMerchantTradeUpdate(data) {
  const { tradeId, customerOfferedItems, customerRequestedItems, customerOfferedGold, merchantGold } = data;

  console.log('[CARDIGAN MERCHANT TRADE UPDATE] Received:', {
    tradeId,
    customerOfferedItems,
    customerRequestedItems,
    customerOfferedGold,
    merchantGold
  });

  const dialog = activeMerchantTrades.get(tradeId);
  if (dialog) {
    dialog.tradeState.customerOfferedItems = customerOfferedItems || [];
    dialog.tradeState.customerRequestedItems = customerRequestedItems || [];
    dialog.tradeState.customerOfferedGold = customerOfferedGold || 0;
    dialog.tradeState.merchantGold = merchantGold || 0;
    console.log('[CARDIGAN MERCHANT TRADE UPDATE] Updated dialog state, re-rendering...');
    dialog.render();
  } else {
    console.warn('[CARDIGAN MERCHANT TRADE UPDATE] Dialog not found for tradeId:', tradeId);
  }
}

/**
 * Handle merchant trade confirmation
 * @param {Object} data - Confirmation data
 */
export async function handleMerchantTradeConfirm(data) {
  const { tradeId, side, gold } = data;

  const dialog = activeMerchantTrades.get(tradeId);
  if (dialog) {
    await dialog.handleConfirmation(side, gold);
  }
}

/**
 * Handle merchant trade undo confirmation
 * @param {Object} data - Undo data
 */
export function handleMerchantTradeUndo(data) {
  const { tradeId, side } = data;

  const dialog = activeMerchantTrades.get(tradeId);
  if (dialog) {
    // Update confirmation state
    if (side === 'customer') {
      dialog.tradeState.customerConfirmed = false;
    } else if (side === 'merchant') {
      dialog.tradeState.merchantConfirmed = false;
    }

    // Re-render dialog
    dialog.render();
  }
}

/**
 * Handle merchant trade cancellation
 * @param {Object} data - Cancellation data
 */
export function handleMerchantTradeCancel(data) {
  const { tradeId, cancelledBy } = data;

  const dialog = activeMerchantTrades.get(tradeId);
  if (dialog) {
    dialog.close();
    activeMerchantTrades.delete(tradeId);
  }
}

/**
 * Handle merchant trade completion
 * @param {Object} data - Completion data
 */
export function handleMerchantTradeComplete(data) {
  const { tradeId } = data;

  console.log('[CARDIGAN MERCHANT TRADE COMPLETE] Closing trade:', tradeId);

  const dialog = activeMerchantTrades.get(tradeId);
  if (dialog) {
    ui.notifications.info("Comércio concluído com sucesso!");
    dialog.close();
    activeMerchantTrades.delete(tradeId);
  }
}

/**
 * Execute merchant trade transfer (GM only)
 * @param {Object} data - Transfer data
 */
export async function handleExecuteMerchantTradeTransfer(data) {
  console.log('[CARDIGAN MERCHANT TRADE GM] Received transfer request:', data);

  // Only GM should execute transfers
  if (!game.user.isGM) {
    console.log('[CARDIGAN MERCHANT TRADE GM] Non-GM received transfer request, ignoring');
    return;
  }

  const { tradeId, customerId, merchantId, customerOfferedItems, customerRequestedItems, customerOfferedGold, merchantGold } = data;

  // Check if already executed
  const lastExecution = merchantTradeExecutionTracker.get(tradeId);
  if (lastExecution && (Date.now() - lastExecution) < 3000) {
    console.log('[CARDIGAN MERCHANT TRADE GM] Already executed, ignoring duplicate:', tradeId);
    return;
  }

  merchantTradeExecutionTracker.set(tradeId, Date.now());

  try {
    const customer = game.actors.get(customerId);
    const merchant = game.actors.get(merchantId);

    if (!customer || !merchant) {
      console.error('[CARDIGAN MERCHANT TRADE GM] Actors not found');
      merchantTradeExecutionTracker.delete(tradeId);
      return;
    }

    console.log('[CARDIGAN MERCHANT TRADE GM] Starting transfer...');

    // Transfer items from customer to merchant (customerOfferedItems)
    for (const tradeItem of customerOfferedItems) {
      const sourceItem = customer.items.get(tradeItem.id);
      if (!sourceItem) continue;

      if (sourceItem.system.equipped) {
        await sourceItem.update({ 'system.equipped': false });
      }

      const existingItem = merchant.items.find(i =>
        i.name === sourceItem.name &&
        i.type === sourceItem.type &&
        !i.system.equipped
      );

      if (existingItem) {
        const newQuantity = (existingItem.system.quantity || 1) + tradeItem.quantity;
        await existingItem.update({ 'system.quantity': newQuantity });
      } else {
        const itemData = sourceItem.toObject();
        itemData.system.quantity = tradeItem.quantity;
        itemData.system.equipped = false;
        await merchant.createEmbeddedDocuments('Item', [itemData]);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const remainingQty = (sourceItem.system.quantity || 1) - tradeItem.quantity;
      if (remainingQty <= 0) {
        await sourceItem.delete();
      } else {
        await sourceItem.update({ 'system.quantity': remainingQty });
      }
    }

    // Transfer items from merchant to customer (customerRequestedItems)
    for (const tradeItem of customerRequestedItems) {
      const sourceItem = merchant.items.get(tradeItem.id);
      if (!sourceItem) continue;

      if (sourceItem.system.equipped) {
        await sourceItem.update({ 'system.equipped': false });
      }

      const existingItem = customer.items.find(i =>
        i.name === sourceItem.name &&
        i.type === sourceItem.type &&
        !i.system.equipped
      );

      if (existingItem) {
        const newQuantity = (existingItem.system.quantity || 1) + tradeItem.quantity;
        await existingItem.update({ 'system.quantity': newQuantity });
      } else {
        const itemData = sourceItem.toObject();
        itemData.system.quantity = tradeItem.quantity;
        itemData.system.equipped = false;
        await customer.createEmbeddedDocuments('Item', [itemData]);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const remainingQty = (sourceItem.system.quantity || 1) - tradeItem.quantity;
      if (remainingQty <= 0) {
        await sourceItem.delete();
      } else {
        await sourceItem.update({ 'system.quantity': remainingQty });
      }
    }

    // Transfer gold from customer to merchant
    if (customerOfferedGold > 0) {
      const customerCurrentGold = customer.system.money || 0;
      const merchantCurrentGold = merchant.system.money || 0;

      await customer.update({ 'system.money': customerCurrentGold - customerOfferedGold });
      await merchant.update({ 'system.money': merchantCurrentGold + customerOfferedGold });
    }

    // Transfer gold from merchant to customer
    if (merchantGold > 0) {
      const customerCurrentGold = customer.system.money || 0;
      const merchantCurrentGold = merchant.system.money || 0;

      await merchant.update({ 'system.money': merchantCurrentGold - merchantGold });
      await customer.update({ 'system.money': customerCurrentGold + merchantGold });
    }

    // Create chat message
    let content = `
      <div style="border: 2px solid #28a745; border-radius: 4px; padding: 12px; background: rgba(40, 167, 69, 0.1);">
        <h3 style="margin: 0 0 8px 0; color: #28a745;">
          <i class="fas fa-store"></i> COMÉRCIO CONCLUÍDO
        </h3>
    `;

    if (customerOfferedItems.length > 0 || customerOfferedGold > 0) {
      content += `<p style="margin: 8px 0;"><strong>${customer.name}</strong> → <strong>${merchant.name}</strong>:</p><ul style="margin: 4px 0;">`;

      customerOfferedItems.forEach(item => {
        content += `<li>${item.name} (x${item.quantity})</li>`;
      });

      if (customerOfferedGold > 0) {
        content += `<li>${customerOfferedGold} PO</li>`;
      }

      content += `</ul>`;
    }

    if (customerRequestedItems.length > 0 || merchantGold > 0) {
      content += `<p style="margin: 8px 0;"><strong>${merchant.name}</strong> → <strong>${customer.name}</strong>:</p><ul style="margin: 4px 0;">`;

      customerRequestedItems.forEach(item => {
        content += `<li>${item.name} (x${item.quantity})</li>`;
      });

      if (merchantGold > 0) {
        content += `<li>${merchantGold} PO</li>`;
      }

      content += `</ul>`;
    }

    content += `</div>`;

    await ChatMessage.create({
      content,
      speaker: { alias: "Sistema de Comércio" }
    });

    // Close dialog locally
    handleMerchantTradeComplete({ tradeId: tradeId });

    // Emit completion to other players
    game.socket.emit('system.cardigan', {
      action: 'merchantTradeComplete',
      data: { tradeId: tradeId }
    });

    setTimeout(() => {
      merchantTradeExecutionTracker.delete(tradeId);
    }, 5000);

  } catch (error) {
    console.error('[CARDIGAN MERCHANT TRADE GM] Error:', error);
    merchantTradeExecutionTracker.delete(tradeId);
  }
}

// Expose function globally for direct calling
globalThis.handleExecuteMerchantTradeTransfer = handleExecuteMerchantTradeTransfer;
