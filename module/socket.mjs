/**
 * Registers the socket listener active during the 'init' phase.
 * Handles: combat notifications, evasion results, damage, armor durability, weapon property effects.
 * @param {object} handlers
 */
export function registerInitSocketListeners({
  createGMEvasionNotification,
  showDamageNotification,
  showArmorDurabilityNotification,
  createAttackerResultDialog,
  closeAttackDialogForAttacker,
}) {
  game.socket.on("system.cardigan", async (data) => {
    if (data.action === "notifyGMEvasion" && game.user.isGM) {
      createGMEvasionNotification(data.payload);
    } else if (data.action === "notifyDamage") {
      showDamageNotification(data.payload);
    } else if (data.action === "notifyArmorDurability") {
      showArmorDurabilityNotification(data.payload);
    } else if (data.action === "notifyAttacker" && !game.user.isGM) {
      if (data.payload.attackerOwnerId === game.user.id) {
        createAttackerResultDialog(data.payload);
      }
    } else if (data.action === "applyDamage") {
      const actor = game.actors.get(data.payload.actorId);
      if (actor && (actor.isOwner || game.user.isGM)) {
        actor.update({ 'system.health.value': data.payload.newHP });
      }
    } else if (data.action === "closeAttackDialog") {
      closeAttackDialogForAttacker(data.payload);
    } else if (data.action === "openNewAttackDialog") {
      if (data.payload.attackerOwnerId === game.user.id) {
        closeAttackDialogForAttacker({ dialogId: data.payload.oldDialogId });
        createAttackerResultDialog(data.payload);
      }
    } else if (data.type === "applyBleeding" && game.user.isGM) {
      const targetActor = game.actors.get(data.targetActorId);
      if (targetActor) {
        const { Ferir } = await import('./weapon-properties/properties/wound.mjs');
        await Ferir.applyBleedingEffect(targetActor, data.weaponName);
      } else {
        console.error('[FERIR] Target actor not found:', data.targetActorId);
      }
    } else if (data.type === "notifyBleeding") {
      if (data.userId === game.user.id) {
        ui.notifications.info(`🩸 Você recebeu Sangramento de ${data.weaponName}!`);
      }
    } else if (data.type === "applyWeakened" && game.user.isGM) {
      const targetActor = game.actors.get(data.targetActorId);
      if (targetActor) {
        const { Traspassar } = await import('./weapon-properties/properties/pierce.mjs');
        await Traspassar.applyWeakenedEffect(targetActor, data.weaponName);
      } else {
        console.error('[TRASPASSAR] Target actor not found:', data.targetActorId);
      }
    } else if (data.type === "notifyWeakened") {
      if (data.userId === game.user.id) {
        ui.notifications.info(`💪 Você ficou Enfraquecido por ${data.weaponName}!`);
      }
    } else if (data.type === "applyProne" && game.user.isGM) {
      const targetActor = game.actors.get(data.targetActorId);
      if (targetActor) {
        const { Contundente } = await import('./weapon-properties/properties/blunt.mjs');
        await Contundente.applyProneEffect(targetActor, data.weaponName);
      } else {
        console.error('[CONTUNDENTE] Target actor not found:', data.targetActorId);
      }
    } else if (data.type === "notifyProne") {
      if (data.userId === game.user.id) {
        ui.notifications.info(`🔽 Você ficou Caído por ${data.weaponName}!`);
      }
    } else if (data.type === "applyBurning" && game.user.isGM) {
      const targetActor = game.actors.get(data.targetActorId);
      if (targetActor) {
        const { Incendiar } = await import('./weapon-properties/properties/ignite.mjs');
        await Incendiar.applyBurningEffect(targetActor, data.weaponName);
      } else {
        console.error('[INCENDIAR] Target actor not found:', data.targetActorId);
      }
    } else if (data.type === "notifyBurning") {
      if (data.userId === game.user.id) {
        ui.notifications.info(`🔥 Você ficou Incendiado por ${data.weaponName}!`);
      }
    } else if (data.type === "applyShocked" && game.user.isGM) {
      const targetActor = game.actors.get(data.targetActorId);
      if (targetActor) {
        const { Eletrocutar } = await import('./weapon-properties/properties/electrocute.mjs');
        await Eletrocutar.applyShockedEffect(targetActor, data.weaponName);
      } else {
        console.error('[ELETROCUTAR] Target actor not found:', data.targetActorId);
      }
    } else if (data.type === "notifyShocked") {
      if (data.userId === game.user.id) {
        ui.notifications.info(`⚡ Você ficou Eletrocutado por ${data.weaponName}!`);
      }
    } else if (data.type === "applyFracture" && game.user.isGM) {
      const targetActor = game.actors.get(data.targetActorId);
      if (targetActor) {
        const { Impacto } = await import('./weapon-properties/properties/impact.mjs');
        await Impacto.applyFractureEffect(targetActor, data.weaponName);
      } else {
        console.error('[IMPACTO] Target actor not found:', data.targetActorId);
      }
    } else if (data.type === "notifyFracture") {
      if (data.userId === game.user.id) {
        ui.notifications.info(`🦴 Você sofreu Fratura por ${data.weaponName}! (${data.oldFracture} → ${data.newFracture})`);
      }
    }
  });
}

/**
 * Registers the socket listener active during the 'ready' phase.
 * Handles: trade system (player-to-player and merchant) and secondary combat events.
 * @param {object} handlers
 */
export function registerReadySocketListeners({
  handleTradeRequest,
  handleTradeAccepted,
  handleTradeRejected,
  handleTradeUpdate,
  handleTradeConfirm,
  handleTradeUndo,
  handleTradeCancel,
  handleTradeComplete,
  handleExecuteTradeTransfer,
  handleMerchantTradeRequest,
  handleMerchantTradeAccepted,
  handleMerchantTradeRejected,
  handleMerchantTradeUpdate,
  handleMerchantTradeConfirm,
  handleMerchantTradeUndo,
  handleMerchantTradeCancel,
  handleMerchantTradeComplete,
  handleExecuteMerchantTradeTransfer,
  createGMEvasionNotification,
  createAttackerResultDialog,
  closeAttackDialogForAttacker,
  showDamageNotification,
  showArmorDurabilityNotification,
}) {
  game.socket.on('system.cardigan', async (data) => {
    switch (data.action) {
      case 'tradeRequest':
        await handleTradeRequest(data.data);
        break;
      case 'tradeAccepted':
        await handleTradeAccepted(data.data);
        break;
      case 'tradeRejected':
        handleTradeRejected(data.data);
        break;
      case 'tradeUpdate':
        handleTradeUpdate(data.data);
        break;
      case 'tradeConfirm':
        await handleTradeConfirm(data.data);
        break;
      case 'tradeUndo':
        handleTradeUndo(data.data);
        break;
      case 'tradeCancel':
        handleTradeCancel(data.data);
        break;
      case 'tradeComplete':
        handleTradeComplete(data.data);
        break;
      case 'executeTradeTransfer':
        if (game.user.isGM) {
          await handleExecuteTradeTransfer(data.data);
        }
        break;

      case 'merchantTradeRequest':
        await handleMerchantTradeRequest(data.data);
        break;
      case 'merchantTradeAccepted':
        await handleMerchantTradeAccepted(data.data);
        break;
      case 'merchantTradeRejected':
        handleMerchantTradeRejected(data.data);
        break;
      case 'merchantTradeUpdate':
        handleMerchantTradeUpdate(data.data);
        break;
      case 'merchantTradeConfirm':
        await handleMerchantTradeConfirm(data.data);
        break;
      case 'merchantTradeUndo':
        handleMerchantTradeUndo(data.data);
        break;
      case 'merchantTradeCancel':
        handleMerchantTradeCancel(data.data);
        break;
      case 'merchantTradeComplete':
        handleMerchantTradeComplete(data.data);
        break;
      case 'executeMerchantTradeTransfer':
        if (game.user.isGM) {
          await handleExecuteMerchantTradeTransfer(data.data);
        }
        break;

      case 'createGMEvasionNotification':
        if (game.user.isGM) {
          await createGMEvasionNotification(data.data);
        }
        break;
      case 'createAttackerResultDialog':
        await createAttackerResultDialog(data.data);
        break;
      case 'closeAttackDialogForAttacker':
        closeAttackDialogForAttacker(data.data);
        break;
      case 'showDamageNotification':
        showDamageNotification(data.data);
        break;
      case 'showArmorDurabilityNotification':
        showArmorDurabilityNotification(data.data);
        break;
    }
  });
}
