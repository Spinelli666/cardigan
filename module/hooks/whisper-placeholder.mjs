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

    // --- Resolve actor display data ---
    // message.speaker is always sent to all clients (even non-recipients)
    const speakerActorId = message.speaker?.actor;
    const speakerActor = speakerActorId ? game.actors.get(speakerActorId) : null;

    // attackTargets flag is always stored on attack/joint roll messages
    const attackTargets = message.flags?.cardigan?.attackTargets;

    // Stored display fallback (only on messages created via ChatMessageHelper)
    const display = message.flags?.cardigan?.whisperDisplay;

    // Determine actor img/name: prefer attackTargets.attackerId, then speaker, then display
    const attackerActorId = attackTargets?.attackerId;
    const attackerActor = attackerActorId ? game.actors.get(attackerActorId) : null;
    const resolvedActor = attackerActor || speakerActor;
    const actorImg = resolvedActor?.img || display?.actorImg || 'icons/svg/mystery-man.svg';
    const actorName = resolvedActor?.name || message.speaker?.alias || display?.actorName || '???';

    // hasSpecialAction: true if attackTargets flag is present, or stored in display
    const hasSpecialAction = !!attackTargets || (display?.hasSpecialAction ?? false);
    // isJointRoll: joint when multiple targets in attackTargets, or stored in display
    const isJointRoll = (attackTargets?.targets?.length > 1) || (display?.isJointRoll ?? false);
    const rollLabel = display?.rollLabel
      || message.flags?.cardigan?.rollLabel
      || attackTargets?.skillName
      || null;

    // --- Resolve target data from attackTargets ---
    const targets = attackTargets?.targets || [];
    // Joint tooltip: all target names joined with <br> (HTML-encoded for attribute)
    const targetNamesTooltip = targets.map(t => t.name).join('&lt;br&gt;');
    // Single target: resolve img from actor registry
    const hasSingleTarget = !isJointRoll && hasSpecialAction && targets.length === 1;
    const singleTarget = hasSingleTarget ? targets[0] : null;
    const singleTargetActor = singleTarget?.actorId ? game.actors.get(singleTarget.actorId) : null;
    const targetImg = singleTargetActor?.img || 'icons/svg/mystery-man.svg';
    const targetName = singleTarget?.name || '';

    // --- Build actor-header HTML ---
    let actorHeaderHtml;
    if (hasSpecialAction) {
      let rightSlotHtml;
      if (isJointRoll) {
        rightSlotHtml = `<img src='systems/cardigan/assets/images/decorative/icons/icon-joint-attack.svg'
          alt='Rolagem em Conjunto' class='joint-roll-header-icon'
          data-tooltip="${targetNamesTooltip}" data-tooltip-class="cardigan-chat-tooltip" />`;
      } else if (hasSingleTarget) {
        rightSlotHtml = `<img src='${targetImg}' alt='${targetName}' class='target-avatar'
          data-tooltip="${targetName}" data-tooltip-class="cardigan-chat-tooltip" />`;
      } else {
        rightSlotHtml = '';
      }
      actorHeaderHtml = `
        <div class='actor-header special-action'>
          <img src='${actorImg}' alt='${actorName}' class='actor-avatar'
            data-tooltip="${actorName}" data-tooltip-class="cardigan-chat-tooltip" />
          <img src='systems/cardigan/assets/images/decorative/icons/icon-attack.svg' alt='Ataque' class='attack-icon' />
          ${rightSlotHtml}
        </div>`;
    } else {
      actorHeaderHtml = `
        <div class='actor-header'>
          <img src='${actorImg}' alt='${actorName}' class='actor-avatar' />
          <h2 class='actor-name'>${actorName}</h2>
        </div>`;
    }

    // --- Build roll-title HTML ---
    const rollTitleHtml = `
      <div class='roll-title'>
        <p class='roll-subtitle'>TESTE DE</p>
        <strong>${rollLabel ?? '???'}</strong>
      </div>`;

    // Replace content with styled placeholder keeping full visual structure
    messageContent.innerHTML = `
      <div class="cardigan-roll-chat-message cardigan-whisper-placeholder">
        ${actorHeaderHtml}
        <div class="roll-content">
          <img src='systems/cardigan/assets/images/decorative/back-icon-d20.webp' alt='Dado' class='roll-chat-icon' />
          ${rollTitleHtml}
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

    // Move message-metadata into content AFTER all hooks have run,
    // so it always ends up below the evasion/precision sections.
    const messageMetadata = messageHeader?.querySelector('.message-metadata');
    if (messageMetadata) {
      queueMicrotask(() => messageContent.appendChild(messageMetadata));
    }
  });
}

