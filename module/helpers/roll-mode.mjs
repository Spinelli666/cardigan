/**
 * Roll mode compatibility helpers.
 * Foundry v14 renamed the `core.rollMode` client setting to `core.messageMode`,
 * and `ChatMessage.applyRollMode` to `ChatMessage.applyMode`. Both old APIs are
 * still supported through v15 but log a deprecation warning on v14+, so these
 * helpers pick whichever API the running Foundry version actually has.
 */

/**
 * Get the current core roll/message mode setting.
 * @returns {string}
 */
export function getCoreRollMode() {
  const key = game.settings.settings.has('core.messageMode') ? 'messageMode' : 'rollMode';
  return game.settings.get('core', key);
}

/**
 * Apply a roll mode to chat message data using whichever API the running
 * Foundry version supports.
 * @param {object} messageData
 * @param {string} rollMode
 */
export function applyRollModeToMessageData(messageData, rollMode) {
  if (typeof ChatMessage.applyMode === 'function') {
    ChatMessage.applyMode(messageData, rollMode);
  } else {
    ChatMessage.applyRollMode(messageData, rollMode);
  }
}
