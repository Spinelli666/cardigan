// Global Map to track active trade dialogs
const activeTradeDialogs = new Map();

// Export to global scope so actor-sheet can access it
globalThis.cardiganActiveTradeDialogs = activeTradeDialogs;

// Global execution tracker to prevent duplicate GM executions
const tradeExecutionTracker = new Map();

/**
 * Handle incoming trade request
 * @param {Object} data - Trade request data
 */
export async function handleTradeRequest(data) {
  const { tradeId, initiatorId, targetId } = data;

  // Check if this user owns the target actor
  const targetActor = game.actors.get(targetId);
  if (!targetActor) return;

  // Only show dialog to users who have explicit ownership of this character
  // GMs should only see if they are in the list of owners or if it's their assigned character
  const ownerIds = Object.entries(targetActor.ownership || {})
    .filter(([userId, level]) => level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && userId !== "default")
    .map(([userId]) => userId);

  const isOwner = ownerIds.includes(game.user.id);
  const isAssignedCharacter = game.user.character?.id === targetId;

  // If not owner and not assigned character, don't show dialog
  if (!isOwner && !isAssignedCharacter) return;

  const initiatorActor = game.actors.get(initiatorId);
  if (!initiatorActor) return;

  // Ask for confirmation
  const accept = await foundry.applications.api.DialogV2.confirm({
    window: {
      title: "Solicitação de Negociação",
      icon: "fa-solid fa-handshake"
    },
    content: `
      <p style="margin-bottom: 12px;">
        <strong>${initiatorActor.name}</strong> quer negociar items com você!
      </p>
      <p>Deseja aceitar?</p>
    `,
    rejectClose: false,
    modal: true
  });

  if (!accept) {
    // Send rejection
    game.socket.emit('system.cardigan', {
      action: 'tradeRejected',
      data: {
        tradeId: tradeId,
        rejectedBy: targetActor.name
      }
    });
    return;
  }

  // Accept - emit acceptance event to open dialog for both players
  game.socket.emit('system.cardigan', {
    action: 'tradeAccepted',
    data: {
      tradeId: tradeId,
      initiatorId: initiatorId,
      targetId: targetId
    }
  });

  // Also open dialog locally for the target (socket doesn't deliver to sender)
  const { TradeDialog } = await import('../applications/trade-dialog.mjs');
  const tradeDialog = new TradeDialog({
    tradeId: tradeId,
    initiator: initiatorActor,
    target: targetActor,
    isInitiator: false
  });

  activeTradeDialogs.set(tradeId, tradeDialog);
  tradeDialog.render(true);
}

/**
 * Handle trade acceptance - open dialog for initiator
 * @param {Object} data - Acceptance data
 */
export async function handleTradeAccepted(data) {
  const { tradeId, initiatorId, targetId } = data;

  // Check if this user owns the initiator actor
  const initiatorActor = game.actors.get(initiatorId);
  if (!initiatorActor) return;

  // Only show dialog to users who have explicit ownership of the initiator
  const ownerIds = Object.entries(initiatorActor.ownership || {})
    .filter(([userId, level]) => level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER && userId !== "default")
    .map(([userId]) => userId);

  const isOwner = ownerIds.includes(game.user.id);
  const isAssignedCharacter = game.user.character?.id === initiatorId;

  // If not owner and not assigned character, don't show dialog
  if (!isOwner && !isAssignedCharacter) return;

  const targetActor = game.actors.get(targetId);
  if (!targetActor) return;

  // Open trade dialog for initiator
  const { TradeDialog } = await import('../applications/trade-dialog.mjs');
  const tradeDialog = new TradeDialog({
    tradeId: tradeId,
    initiator: initiatorActor,
    target: targetActor,
    isInitiator: true
  });

  activeTradeDialogs.set(tradeId, tradeDialog);
  tradeDialog.render(true);

  ui.notifications.success(`${targetActor.name} aceitou a negociação!`);
}

/**
 * Handle trade rejection
 * @param {Object} data - Rejection data
 */
export function handleTradeRejected(data) {
  const { tradeId, rejectedBy } = data;

  ui.notifications.warn(`${rejectedBy} recusou a negociação.`);

  // Close initiator's dialog if open
  const dialog = activeTradeDialogs.get(tradeId);
  if (dialog) {
    dialog.close();
    activeTradeDialogs.delete(tradeId);
  }
}

/**
 * Handle trade state update from other player
 * @param {Object} data - Trade update data
 */
export function handleTradeUpdate(data) {
  const { tradeId, state } = data;

  const dialog = activeTradeDialogs.get(tradeId);
  if (dialog) {
    dialog.updateTradeState(state);
  }
}

/**
 * Handle trade confirmation from other player
 * @param {Object} data - Confirmation data
 */
export async function handleTradeConfirm(data) {
  const { tradeId, side, gold } = data;

  const dialog = activeTradeDialogs.get(tradeId);
  if (dialog) {
    await dialog.handleConfirmation(side, gold);
  }
}

/**
 * Handle trade undo from other player
 * @param {Object} data - Undo data
 */
export function handleTradeUndo(data) {
  const { tradeId, side } = data;

  const dialog = activeTradeDialogs.get(tradeId);
  if (dialog) {
    if (side === 'initiator') {
      dialog.tradeState.initiatorConfirmed = false;
    } else if (side === 'target') {
      dialog.tradeState.targetConfirmed = false;
    }
    dialog.render();
  }
}

/**
 * Handle trade cancellation
 * @param {Object} data - Cancellation data
 */
export function handleTradeCancel(data) {
  const { tradeId, cancelledBy } = data;

  const dialog = activeTradeDialogs.get(tradeId);
  if (dialog) {
    dialog.close();
    activeTradeDialogs.delete(tradeId);
  }

  // Notification is handled by the canceller
}

/**
 * Handle trade completion
 * @param {Object} data - Completion data
 */
export function handleTradeComplete(data) {
  const { tradeId } = data;

  console.log('[CARDIGAN TRADE COMPLETE] Attempting to close trade:', tradeId);
  console.log('[CARDIGAN TRADE COMPLETE] Active dialogs:', Array.from(activeTradeDialogs.keys()));

  const dialog = activeTradeDialogs.get(tradeId);
  if (dialog) {
    console.log('[CARDIGAN TRADE COMPLETE] Dialog found, closing...');
    ui.notifications.info("Negociação concluída com sucesso!");
    dialog.close();
    activeTradeDialogs.delete(tradeId);
  } else {
    console.warn('[CARDIGAN TRADE COMPLETE] Dialog not found in activeTradeDialogs!');
  }
}

/**
 * Handle trade transfer execution (GM only)
 * @param {Object} data - Trade transfer data
 */
export async function handleExecuteTradeTransfer(data) {
  const { tradeId, initiatorId, targetId, initiatorItems, targetItems, initiatorGold, targetGold } = data;

  // Check if this trade was already executed recently (within 3 seconds)
  const lastExecution = tradeExecutionTracker.get(tradeId);
  if (lastExecution && (Date.now() - lastExecution) < 3000) {
    console.log('[CARDIGAN TRADE GM] Trade already executed recently, ignoring duplicate:', tradeId);
    return;
  }

  // Mark this trade as executing
  tradeExecutionTracker.set(tradeId, Date.now());

  try {
    const initiator = game.actors.get(initiatorId);
    const target = game.actors.get(targetId);

    if (!initiator || !target) {
      console.error('[CARDIGAN TRADE] Actors not found');
      tradeExecutionTracker.delete(tradeId);
      return;
    }

    console.log('[CARDIGAN TRADE GM] Starting transfer...', { initiatorItems, targetItems });

    // Transfer items from initiator to target
    for (const tradeItem of initiatorItems) {
      const sourceItem = initiator.items.get(tradeItem.id);
      if (!sourceItem) continue;

      console.log(`[CARDIGAN TRADE GM] Processing item: ${sourceItem.name} (qty: ${tradeItem.quantity})`);

      // Unequip if equipped
      if (sourceItem.system.equipped) {
        await sourceItem.update({ 'system.equipped': false });
      }

      // Check if target already has this item (same name and type)
      // Force refresh the items collection to get the latest state
      const existingItem = target.items.find(i =>
        i.name === sourceItem.name &&
        i.type === sourceItem.type &&
        !i.system.equipped // Only stack with unequipped items
      );

      console.log(`[CARDIGAN TRADE GM] Existing item found:`, existingItem ? `${existingItem.name} (qty: ${existingItem.system.quantity})` : 'none');

      if (existingItem) {
        // Item exists, just add to quantity
        const newQuantity = (existingItem.system.quantity || 1) + tradeItem.quantity;
        console.log(`[CARDIGAN TRADE GM] Updating quantity: ${existingItem.system.quantity} → ${newQuantity}`);
        await existingItem.update({ 'system.quantity': newQuantity });
      } else {
        // Item doesn't exist, create new
        const itemData = sourceItem.toObject();
        itemData.system.quantity = tradeItem.quantity;
        itemData.system.equipped = false;

        console.log(`[CARDIGAN TRADE GM] Creating new item: ${itemData.name} (qty: ${itemData.system.quantity})`);

        // Create and wait for the operation to complete fully
        const created = await target.createEmbeddedDocuments('Item', [itemData]);

        console.log(`[CARDIGAN TRADE GM] Item created:`, created[0]?.name);

        // Wait for the actor's items collection to be fully updated
        // Increased from 50ms to 100ms for better synchronization
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Update or delete from source
      const remainingQty = (sourceItem.system.quantity || 1) - tradeItem.quantity;
      if (remainingQty <= 0) {
        await sourceItem.delete();
      } else {
        await sourceItem.update({ 'system.quantity': remainingQty });
      }
    }

    // Transfer items from target to initiator
    for (const tradeItem of targetItems) {
      const sourceItem = target.items.get(tradeItem.id);
      if (!sourceItem) continue;

      // Unequip if equipped
      if (sourceItem.system.equipped) {
        await sourceItem.update({ 'system.equipped': false });
      }

      // Check if initiator already has this item (same name and type)
      // Force refresh the items collection to get the latest state
      const existingItem = initiator.items.find(i =>
        i.name === sourceItem.name &&
        i.type === sourceItem.type &&
        !i.system.equipped // Only stack with unequipped items
      );

      if (existingItem) {
        // Item exists, just add to quantity
        const newQuantity = (existingItem.system.quantity || 1) + tradeItem.quantity;
        await existingItem.update({ 'system.quantity': newQuantity });
      } else {
        // Item doesn't exist, create new
        const itemData = sourceItem.toObject();
        itemData.system.quantity = tradeItem.quantity;
        itemData.system.equipped = false;

        // Create and wait for the operation to complete fully
        const created = await initiator.createEmbeddedDocuments('Item', [itemData]);

        // Wait for the actor's items collection to be fully updated
        // Increased from 50ms to 100ms for better synchronization
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Update or delete from source
      const remainingQty = (sourceItem.system.quantity || 1) - tradeItem.quantity;
      if (remainingQty <= 0) {
        await sourceItem.delete();
      } else {
        await sourceItem.update({ 'system.quantity': remainingQty });
      }
    }

    // Transfer gold from initiator to target
    if (initiatorGold > 0) {
      const initiatorCurrentGold = initiator.system.money || 0;
      const targetCurrentGold = target.system.money || 0;

      await initiator.update({
        'system.money': initiatorCurrentGold - initiatorGold
      });

      await target.update({
        'system.money': targetCurrentGold + initiatorGold
      });
    }

    // Transfer gold from target to initiator
    if (targetGold > 0) {
      const initiatorCurrentGold = initiator.system.money || 0;
      const targetCurrentGold = target.system.money || 0;

      await target.update({
        'system.money': targetCurrentGold - targetGold
      });

      await initiator.update({
        'system.money': initiatorCurrentGold + targetGold
      });
    }

    // Create success message in chat
    let content = `
      <div style="border: 2px solid #28a745; border-radius: 4px; padding: 12px; background: rgba(40, 167, 69, 0.1);">
        <h3 style="margin: 0 0 8px 0; color: #28a745;">
          <i class="fas fa-handshake"></i> NEGOCIAÇÃO CONCLUÍDA
        </h3>
    `;

    // Initiator gave
    if (initiatorItems.length > 0 || initiatorGold > 0) {
      content += `<p style="margin: 8px 0;"><strong>${initiator.name}</strong> → <strong>${target.name}</strong>:</p><ul style="margin: 4px 0;">`;

      initiatorItems.forEach(item => {
        content += `<li>${item.name} (x${item.quantity})</li>`;
      });

      if (initiatorGold > 0) {
        content += `<li>${initiatorGold} PO</li>`;
      }

      content += `</ul>`;
    }

    // Target gave
    if (targetItems.length > 0 || targetGold > 0) {
      content += `<p style="margin: 8px 0;"><strong>${target.name}</strong> → <strong>${initiator.name}</strong>:</p><ul style="margin: 4px 0;">`;

      targetItems.forEach(item => {
        content += `<li>${item.name} (x${item.quantity})</li>`;
      });

      if (targetGold > 0) {
        content += `<li>${targetGold} PO</li>`;
      }

      content += `</ul>`;
    }

    content += `</div>`;

    await ChatMessage.create({
      content,
      speaker: { alias: "Sistema de Negociação" }
    });

    // Close the dialog locally (for GM)
    handleTradeComplete({ tradeId: tradeId });

    // Emit completion to all OTHER players (socket doesn't deliver to sender)
    game.socket.emit('system.cardigan', {
      action: 'tradeComplete',
      data: { tradeId: tradeId }
    });

    // Clean up execution tracker after 5 seconds
    setTimeout(() => {
      tradeExecutionTracker.delete(tradeId);
      console.log('[CARDIGAN TRADE GM] Cleaned up execution tracker for:', tradeId);
    }, 5000);

  } catch (error) {
    console.error('[CARDIGAN TRADE GM] Error executing trade transfer:', error);
    // Clean up tracker immediately on error
    tradeExecutionTracker.delete(tradeId);
  }
}
