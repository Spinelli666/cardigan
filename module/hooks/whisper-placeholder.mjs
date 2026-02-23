/**
 * Whisper Placeholder Hook
 * Replaces the default "???" whisper placeholder with a styled roll-message visual.
 * Only shown to users who are NOT recipients of the whisper.
 */
export function registerWhisperPlaceholderHook() {
  Hooks.on('renderChatMessageHTML', (message, html) => {
    // Only handle whisper messages not visible to the current user
    if (!message.whisper || message.whisper.length === 0) return;
    if (message.isContentVisible) return;

    const messageContent = html.querySelector('.message-content');
    if (!messageContent) return;

    // Replace content with styled placeholder
    messageContent.innerHTML = `
      <div class="cardigan-roll-chat-message cardigan-whisper-placeholder">
        <div class="roll-content">
          <div class="dice-result-container">
            <div class="dice-result-number whisper-question-mark">?</div>
          </div>
        </div>
      </div>
    `;

    // Remove flavor text rendered by Foundry (shown in header or content)
    const flavorText = html.querySelector('.flavor-text');
    if (flavorText) flavorText.remove();

    // Add classes to trigger the same header dividers as roll messages
    html.classList.add('cardigan-chat', 'cardigan-roll-message');

    // Add dividers to the message header if not already present
    const messageHeader = html.querySelector('.message-header');
    if (messageHeader && !messageHeader.querySelector('.message-divider')) {
      const divider1 = document.createElement('img');
      divider1.classList.add('message-divider', 'message-divider-1');
      divider1.src = 'systems/cardigan/assets/images/decorative/divider.webp';
      divider1.alt = '';
      divider1.setAttribute('aria-hidden', 'true');

      const divider2 = document.createElement('img');
      divider2.classList.add('message-divider', 'message-divider-2');
      divider2.src = 'systems/cardigan/assets/images/decorative/divider.webp';
      divider2.alt = '';
      divider2.setAttribute('aria-hidden', 'true');

      messageHeader.appendChild(divider1);
      messageHeader.appendChild(divider2);
    }

    // Move message-metadata into content (same as _enrichChatCard)
    const messageMetadata = messageHeader?.querySelector('.message-metadata');
    if (messageMetadata) {
      messageContent.appendChild(messageMetadata);
    }
  });
}
