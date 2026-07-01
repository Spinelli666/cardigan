import { handleEvasionClick, handlePrecisionClick } from '../combat/evasion-precision.mjs';
import { registerWhisperPlaceholderHook } from './whisper-placeholder.mjs';

/* -------------------------------------------- */
/*  Chat Message Hooks                          */
/* -------------------------------------------- */

// Modern Skills System - Chat button interactions are now handled
// directly by the SkillManager using the renderChatMessageHTML hook

// Skills functions have been moved to module/skills/ for better organization
// All skill-related functionality is now handled by the SkillManager system

/* -------------------------------------------- */
/*  Critical Results Coloring Hook              */
/* -------------------------------------------- */

// Hook to color roll totals based on critical success/failure
// This needs to be registered globally (not inside ready hook) so it works for all clients
Hooks.on('renderChatMessageHTML', (chatMessage, html) => {
  // Only process roll messages with our flags
  const flags = chatMessage.flags?.cardigan;
  if (!flags || (!flags.criticalHit && !flags.criticalFailure && !flags.isCriticalHit && !flags.isCriticalFailure && !flags.criticalSuccess)) return;
  
  // Find the roll total element (html is now HTMLElement, not jQuery)
  const rollTotal = html.querySelector('.dice-total');
  if (!rollTotal) return;
  
  // Apply colors based on critical type (checking all flag formats)
  if (flags.criticalHit || flags.isCriticalHit || flags.criticalSuccess) {
    rollTotal.style.color = '#4CAF50'; // Green for critical hit/success
  } else if (flags.criticalFailure || flags.isCriticalFailure) {
    rollTotal.style.color = '#f44336'; // Red for critical failure
  }
});

/* -------------------------------------------- */
/*  Dice Formula Rich Tooltips Hook             */
/* -------------------------------------------- */

// Hook to attach rich tooltips to dice formula results
Hooks.on('renderChatMessageHTML', (chatMessage, html) => {
  // Import tooltip manager dynamically to avoid circular dependencies
  import('../tooltips/tooltip-manager.mjs').then(module => {
    const TooltipManager = module.default;
    TooltipManager.attachDiceFormulaTooltips(html);
  });
});

/**
 * Add toggle functionality to skill description buttons in chat
 */
Hooks.on('renderChatMessageHTML', (chatMessage, html) => {
  const toggleButtons = html.querySelectorAll('.toggle-skill-description');
  if (toggleButtons.length === 0) return;

  toggleButtons.forEach(button => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      
      const targetId = button.dataset.target;
      const descElement = html.querySelector(`#${targetId}`);
      
      if (!descElement) return;
      
      const isHidden = descElement.style.display === 'none';
      
      // Toggle visibility
      descElement.style.display = isHidden ? 'block' : 'none';
      
      // Update button text and icon
      if (isHidden) {
        button.innerHTML = '<i class="fas fa-eye-slash"></i> Esconder Descrição';
      } else {
        button.innerHTML = '<i class="fas fa-eye"></i> Mostrar Descrição';
      }
    });
  });
});

/**
 * Add toggle functionality to effect title buttons in chat
 */
Hooks.on('renderChatMessageHTML', (message, html) => {
  const toggleButtons = html.querySelectorAll('.toggle-effect-description');
  if (toggleButtons.length === 0) return;

  toggleButtons.forEach(button => {
    const effectId = button.dataset.effectId;
    const descElement = html.querySelector(`.effect-description[data-effect-id="${effectId}"]`);

    button.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();

      if (!descElement) return;

      const isHidden = descElement.style.display === 'none' || !descElement.style.display;

      // Toggle visibility
      descElement.style.display = isHidden ? 'block' : 'none';
    });
  });
});

/* -------------------------------------------- */
/*  Evasion System Hooks                        */
/* -------------------------------------------- */

// Register whisper placeholder hook (see module/hooks/whisper-placeholder.mjs)
registerWhisperPlaceholderHook();

/**
 * Add evasion buttons to attack chat messages
 */
Hooks.on('renderChatMessageHTML', (message, html) => {
  // Check if this is an attack message with target data
  const attackData = message.flags?.cardigan?.attackTargets;
  if (!attackData || !attackData.targets || attackData.targets.length === 0) return;

  // Get the roll total from the message
  const attackTotal = message.rolls?.[0]?.total;
  if (!attackTotal) return;

  // Get damage from attack data
  const attackDamage = attackData.damage || 0;

  // Create evasion buttons container
  const evasionSection = document.createElement('div');
  evasionSection.className = 'cardigan-evasion-section';

  // Check if current user can defend (owns any of the targets)
  let canDefend = false;
  let userTarget = null;

  for (const targetData of attackData.targets) {
    const target = game.scenes.current?.tokens.get(targetData.tokenId);
    if (!target) continue;
    
    // Check if user owns the token OR the actor
    const ownsToken = target.isOwner || game.user.isGM;
    const ownsActor = target.actor && (target.actor.isOwner || game.user.isGM);
    
    if (ownsToken || ownsActor) {
      canDefend = true;
      userTarget = { target, data: targetData };
      break;
    }
  }

  if (!canDefend) return;

  // Create single evasion button
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'cardigan-chat-action-section';

  const button = document.createElement('button');
  button.className = 'cardigan-evasion-button cardigan-chat-action-button';
  button.dataset.messageId = message.id;
  button.dataset.tokenId = userTarget.data.tokenId;
  button.dataset.actorId = userTarget.data.actorId;
  button.dataset.attackTotal = attackTotal;
  button.dataset.attackDamage = attackDamage;
  button.dataset.tooltip = 'Testar EVASÃO';
  button.dataset.tooltipClass = 'cardigan-chat-tooltip';
  button.textContent = '';
  const evasionIcon = document.createElement('img');
  evasionIcon.src = 'systems/cardigan/assets/images/decorative/icons/icon-d20-message.svg';
  evasionIcon.alt = '';
  evasionIcon.className = 'action-button-icon';
  button.appendChild(evasionIcon);
  
  button.addEventListener('click', () => handleEvasionClick(button));
  const evasionDividerLeft = document.createElement('img');
  evasionDividerLeft.src = 'systems/cardigan/assets/images/decorative/divider.webp';
  evasionDividerLeft.alt = '';
  evasionDividerLeft.className = 'action-button-divider action-button-divider--left';
  buttonContainer.appendChild(evasionDividerLeft);
  buttonContainer.appendChild(button);
  const evasionDivider = document.createElement('img');
  evasionDivider.src = 'systems/cardigan/assets/images/decorative/divider.webp';
  evasionDivider.alt = '';
  evasionDivider.className = 'action-button-divider';
  buttonContainer.appendChild(evasionDivider);
  evasionSection.appendChild(buttonContainer);

  // Add border decoration + evasion section to message
  const messageContent = html.querySelector('.message-content');
  if (messageContent) {
    const borderImg = document.createElement('img');
    borderImg.src = 'systems/cardigan/assets/images/decorative/border-chat-message.webp';
    borderImg.alt = '';
    borderImg.className = 'chat-border-decoration';
    messageContent.appendChild(borderImg);
    messageContent.appendChild(evasionSection);
  }
});

/**
 * Add toggle functionality to effect chat messages
 */
Hooks.on('renderChatMessageHTML', (message, html) => {
  // Validate html parameter
  if (!html || !html[0]) return;
  
  // Check if this is an effect message
  const effectMessage = html[0].querySelector('.cardigan-effect-chat-message');
  if (!effectMessage) return;

  const effectTitle = effectMessage.querySelector('.effect-title[data-action="toggle-description"]');
  const effectDescription = effectMessage.querySelector('.effect-description');
  
  if (!effectTitle || !effectDescription) return;

  // Add click event listener to toggle description
  effectTitle.addEventListener('click', (event) => {
    event.preventDefault();
    effectDescription.classList.toggle('collapsed');
  });
});

/**
 * Add precision buttons to evasion reroll chat messages
 */
Hooks.on('renderChatMessageHTML', (message, html) => {
  // Check if this is an evasion reroll message with precision target data
  const precisionData = message.flags?.cardigan?.precisionTarget;
  if (!precisionData) return;

  // Get the evasion total from the message
  const evasionTotal = message.rolls?.[0]?.total || precisionData.evasionTotal;
  if (!evasionTotal) return;

  // Create precision button container
  const precisionSection = document.createElement('div');
  precisionSection.className = 'cardigan-precision-section';

  // Check if current user can attack (owns the attacker)
  const attackerToken = game.scenes.current?.tokens.get(precisionData.tokenId);
  if (!attackerToken) return;
  
  const ownsToken = attackerToken.isOwner || game.user.isGM;
  const ownsActor = attackerToken.actor && (attackerToken.actor.isOwner || game.user.isGM);
  
  if (!ownsToken && !ownsActor) return;

  // Create precision button
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'cardigan-chat-action-section';

  const button = document.createElement('button');
  button.className = 'cardigan-precision-button cardigan-chat-action-button';
  button.dataset.messageId = message.id;
  button.dataset.tokenId = precisionData.tokenId;
  button.dataset.actorId = precisionData.actorId;
  button.dataset.evasionTotal = evasionTotal;
  button.dataset.tooltip = 'Testar PRECISÃO';
  button.dataset.tooltipClass = 'cardigan-chat-tooltip';
  button.textContent = '';
  const precisionIcon = document.createElement('img');
  precisionIcon.src = 'systems/cardigan/assets/images/decorative/icons/icon-d20-message.svg';
  precisionIcon.alt = '';
  precisionIcon.className = 'action-button-icon';
  button.appendChild(precisionIcon);
  
  button.addEventListener('click', () => handlePrecisionClick(button));
  const precisionDividerLeft = document.createElement('img');
  precisionDividerLeft.src = 'systems/cardigan/assets/images/decorative/divider.webp';
  precisionDividerLeft.alt = '';
  precisionDividerLeft.className = 'action-button-divider action-button-divider--left';
  buttonContainer.appendChild(precisionDividerLeft);
  buttonContainer.appendChild(button);
  const precisionDivider = document.createElement('img');
  precisionDivider.src = 'systems/cardigan/assets/images/decorative/divider.webp';
  precisionDivider.alt = '';
  precisionDivider.className = 'action-button-divider';
  buttonContainer.appendChild(precisionDivider);
  precisionSection.appendChild(buttonContainer);

  // Add border decoration + precision section to message
  const messageContent = html.querySelector('.message-content');
  if (messageContent) {
    const borderImg = document.createElement('img');
    borderImg.src = 'systems/cardigan/assets/images/decorative/border-chat-message.webp';
    borderImg.alt = '';
    borderImg.className = 'chat-border-decoration';
    messageContent.appendChild(borderImg);
    messageContent.appendChild(precisionSection);
  }
});