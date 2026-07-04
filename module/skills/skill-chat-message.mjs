/**
 * Skill chat message helpers — build and update skill chat message content.
 */

/**
 * Default skill-to-chat behavior for unregistered skills
 * @param {string} skillName
 * @param {string} actorId
 * @param {object} manager - SkillManager class reference
 */
export async function defaultSkillToChat(skillName, actorId, manager) {
  console.log(`[SkillManager] Default skill to chat: ${skillName}`, { actorId });

  const actor = game.actors.get(actorId);
  if (!actor) {
    ui.notifications.error("Ator não encontrado");
    return;
  }

  const skill = actor.items.find(item => item.type === 'skill' && item.name === skillName);
  if (!skill) {
    ui.notifications.error("Skill não encontrada");
    return;
  }

  console.log(`[SkillManager] Skill data:`, {
    name: skill.name,
    actionTypes: skill.system.skillActionTypes,
    hasEnergyCost: skill.system.hasEnergyCost,
    energyCost: skill.system.energyCost
  });

  let content = `<div class="cardigan-skill-message" style="text-align: center; padding: 8px; background: rgba(76,175,80,0.1); border: 1px solid #4caf50; border-radius: 3px;">
      <h4 style="margin: 0 0 8px 0; color: #4caf50;">
        <i class="fas fa-star" style="margin-right: 6px;"></i>${skill.name}
      </h4>`;

  // Add skill action types badge if available
  if (skill.system.skillActionTypes && Array.isArray(skill.system.skillActionTypes) && skill.system.skillActionTypes.length > 0) {
    // Format action types with | separator
    const formattedTypes = skill.system.skillActionTypes
      .map(type => {
        const localizationKey = CONFIG.CARDIGAN?.skillTypes?.[type] || type;
        return game.i18n.localize(localizationKey);
      })
      .join(' | ');

    content += `<div style="margin: 4px 0; color: #666; font-style: italic; font-size: 0.9em; text-align: center;">
        ${formattedTypes}
      </div>`;
  }

  // Add energy button if skill has energy cost
  if (skill.system.hasEnergyCost) {
    const energyCost = skill.system.effectiveEnergyCost ?? (skill.system.energyCost || 0);
    if (energyCost > 0) {
      const energySpent = skill.system.energySpent || false;
      const buttonColor = energySpent ? '#4caf50' : '#2196f3'; // Green if spent (can recover), blue if not spent
      const buttonIcon = energySpent ? 'fa-redo' : 'fa-bolt';
      const buttonText = energySpent ? `Recuperar Energia (+${energyCost})` : `Gastar Energia (-${energyCost})`;

      content += `<div style="margin: 8px 0; text-align: center;">
          <button class="cardigan-skill-energy-btn" data-actor-id="${actorId}" data-skill="${skillName}"
                  style="padding: 6px 12px; background: ${buttonColor}; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
            <i class="fas ${buttonIcon}" style="margin-right: 4px;"></i>${buttonText}
          </button>
        </div>`;
    }
  }

  // Add spell categories display if skill is Feiticeiro and has categories
  if (skill.system.skillClass === 'sorcerer' && skill.system.spellCategories && Array.isArray(skill.system.spellCategories) && skill.system.spellCategories.length > 0) {
    const categoryImages = {
      'neutral': 'systems/cardigan/assets/images/others/neutral-spell.webp',
      'fae': 'systems/cardigan/assets/images/bestiary/fae-creatures.webp',
      'chaos': 'systems/cardigan/assets/images/bestiary/indivisible-chaos.webp',
      'necromancy': 'systems/cardigan/assets/images/bestiary/necromancy.webp'
    };

    let categoriesHtml = '<div class="spell-categories-display-chat" style="display: flex; align-items: center; justify-content: center; gap: 10px; margin: 12px 0; padding: 12px 20px; background: rgba(147, 112, 219, 0.1); border: 2px solid rgba(147, 112, 219, 0.3); border-radius: 8px;">';

    skill.system.spellCategories.forEach((category, index) => {
      const imagePath = categoryImages[category];
      if (imagePath) {
        const categoryLabel = game.i18n.localize(`CARDIGAN.SpellCategory.${category.charAt(0).toUpperCase() + category.slice(1)}`) || category;
        categoriesHtml += `<img src="${imagePath}"
            alt="${categoryLabel}"
            title="${categoryLabel}"
            class="spell-category-image"
            style="width: 30px; height: 38px; object-fit: contain; border-radius: 4px; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));" />`;

        // Add separator if not the last category
        if (index < skill.system.spellCategories.length - 1) {
          categoriesHtml += '<span style="font-size: 36px; color: #9370db; line-height: 1; user-select: none; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);">⬩</span>';
        }
      }
    });

    categoriesHtml += '</div>';
    content += categoriesHtml;
  }

  // Add toggle button for description
  const randomId = foundry.utils.randomID();
  content += `
      <div style="text-align: center; margin: 8px 0;">
        <button
          class="toggle-skill-description"
          data-target="skill-desc-${randomId}"
          style="padding: 4px 12px; background: rgba(76, 175, 80, 0.2); color: #4caf50; border: 1px solid #4caf50; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s;"
          onmouseover="this.style.background='rgba(76, 175, 80, 0.3)'"
          onmouseout="this.style.background='rgba(76, 175, 80, 0.2)'"
        >
          <i class="fas fa-eye"></i> Mostrar Descrição
        </button>
      </div>
      <div id="skill-desc-${randomId}" style="display: none; text-align: left; margin: 8px 0; padding: 8px; color: #333; background: rgba(0,0,0,0.03); border-radius: 4px; border-left: 3px solid #4caf50;">
        ${skill.system.description || 'Sem descrição disponível.'}
      </div>`;

  // Add enhancement emojis - try skill class first, fallback to default
  const skillClass = manager.getSkill(skillName);
  let emojisAdded = false;

  if (skillClass && typeof skillClass.generateEnhancementEmojis === 'function') {
    const emojis = skillClass.generateEnhancementEmojis(actorId);
    if (emojis) {
      content += emojis;
      emojisAdded = true;
    }
  }

  // If no skill class, generate default enhancement emojis for all skills
  if (!emojisAdded && skill.system.enhancements && Array.isArray(skill.system.enhancements)) {
    const enhancementEmojis = ['⚔️', '🎯', '💀'];
    let emojisHtml = '';

    for (let i = 0; i < 3; i++) {
      const enhancement = skill.system.enhancements[i];
      const isAcquired = skill.system.acquiredEnhancements?.[i] === true;
      const hasContent = enhancement?.description?.trim();

      if (hasContent) {
        const filterStyle = isAcquired ? '' : 'filter: grayscale(100%); opacity: 0.4;';
        const emoji = enhancementEmojis[i] || '⭐';
        const enhancementName = enhancement.name || `Aprimoramento ${i + 1}`;
        const statusText = isAcquired ? '✓ Adquirido' : '✗ Não Adquirido';

        // Create enhancement data (same as BaseSkill)
        const enhancementData = {
          name: enhancementName,
          description: enhancement.description,
          status: statusText,
          acquired: isAcquired,
          actorUuid: actor.uuid,
          skillName: skill.name,
          index: i
        };

        emojisHtml += `<span
            class="enhancement-emoji"
            style="font-size: 24px; margin: 0 8px; cursor: help; ${filterStyle}"
            data-enhancement='${JSON.stringify(enhancementData).replace(/'/g, "&apos;")}'
            data-tooltip-direction="UP"
          >${emoji}</span>`;
      }
    }

    if (emojisHtml) {
      content += `<div style="margin: 12px 0; text-align: center; padding: 8px; background: rgba(0,0,0,0.03); border-radius: 4px;">
          ${emojisHtml}
        </div>`;
    }
  }

  // Add interactive buttons if available
  const buttons = manager.generateSkillButtons(skillName, actorId);
  if (buttons) {
    content += buttons;
  } else {
    // Check if skill has custom effects to show expand button (base or active enhancements)
    const skill = actor.items.find(item => item.type === 'skill' && item.name === skillName);
    const hasCustomEffects = manager.hasAnyEffects(skill);

    // Add default attack button for all skills (single unified attack button)
    content += `<div style="text-align: center; margin: 12px 0; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; align-items: center;">
        <button class="cardigan-skill-attack-btn cardigan-dynamic-tooltip" data-actor-id="${actorId}" data-skill="${skillName}"
                style="display: inline-block; padding: 8px 16px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
          <i class="fas fa-dice-d20" style="margin-right: 4px;"></i>Ataque
        </button>
        ${hasCustomEffects ? `<button class="cardigan-skill-expand-btn" data-actor-id="${actorId}" data-skill="${skillName}"
                style="display: inline-block; padding: 4px 12px; background: #9e9e9e; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
          <i class="fas fa-chevron-down" style="margin-right: 4px;"></i>Expandir
        </button>` : ''}
      </div>`;
  }

  content += `</div>`;

  await ChatMessage.create({
    content,
    speaker: ChatMessage.getSpeaker({ actor }),
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    flags: {
      cardigan: {
        skillName: skillName,
        actorId: actorId,
        isSkillMessage: true,
        energySpent: false // Each message starts with energy NOT spent
      }
    }
  });
}

/**
 * Update an existing skill chat message with new content
 * @param {ChatMessage} chatMessage - The chat message to update
 * @param {string} skillName - The skill name
 * @param {string} actorId - The actor ID
 * @param {object} manager - SkillManager class reference
 */
export async function updateSkillChatMessage(chatMessage, skillName, actorId, manager) {
  try {
    const actor = game.actors.get(actorId);
    if (!actor) return;

    const skill = actor.items.find(item => item.type === 'skill' && item.name === skillName);
    if (!skill) return;

    // Regenerate the skill content with updated button state
    let content = `<div class="cardigan-skill-message" style="text-align: center; padding: 8px; background: rgba(76,175,80,0.1); border: 1px solid #4caf50; border-radius: 3px;">
        <h4 style="margin: 0 0 8px 0; color: #4caf50;">
          <i class="fas fa-star" style="margin-right: 6px;"></i>${skill.name}
        </h4>`;

    // Add skill action types badge if available
    if (skill.system.skillActionTypes && Array.isArray(skill.system.skillActionTypes) && skill.system.skillActionTypes.length > 0) {
      const formattedTypes = skill.system.skillActionTypes
        .map(type => {
          const localizationKey = CONFIG.CARDIGAN?.skillTypes?.[type] || type;
          return game.i18n.localize(localizationKey);
        })
        .join(' | ');

      content += `<div style="margin: 4px 0; color: #666; font-style: italic; font-size: 0.9em; text-align: center;">
          ${formattedTypes}
        </div>`;
    }

    // Add energy button if skill has energy cost - WITH UPDATED STATE FROM MESSAGE
    if (skill.system.hasEnergyCost) {
      const energyCost = skill.system.effectiveEnergyCost ?? (skill.system.energyCost || 0);
      if (energyCost > 0) {
        const energySpent = chatMessage.getFlag('cardigan', 'energySpent') || false;
        const buttonColor = energySpent ? '#4caf50' : '#2196f3';
        const buttonIcon = energySpent ? 'fa-redo' : 'fa-bolt';
        const buttonText = energySpent ? `Recuperar Energia (+${energyCost})` : `Gastar Energia (-${energyCost})`;

        content += `<div style="margin: 8px 0; text-align: center;">
            <button class="cardigan-skill-energy-btn" data-actor-id="${actorId}" data-skill="${skillName}"
                    style="padding: 6px 12px; background: ${buttonColor}; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
              <i class="fas ${buttonIcon}" style="margin-right: 4px;"></i>${buttonText}
            </button>
          </div>`;
      }
    }

    content += `<div style="text-align: left; margin: 8px 0; color: #333;">
          ${skill.system.description || 'Sem descrição disponível.'}
        </div>`;

    // Add enhancement emojis if available
    const enhancementEmojis = ['⚔️', '🎯', '💀'];
    let emojisHtml = '';

    if (skill.system.enhancements && Array.isArray(skill.system.enhancements)) {
      for (let i = 0; i < skill.system.enhancements.length; i++) {
        const enhancement = skill.system.enhancements[i];
        const isAcquired = skill.system.acquiredEnhancements?.[i] === true;
        const hasContent = enhancement?.description?.trim();

        if (hasContent) {
          const filterStyle = isAcquired ? '' : 'filter: grayscale(100%); opacity: 0.4;';
          const emoji = enhancementEmojis[i] || '⭐';
          const enhancementName = enhancement.name || `Aprimoramento ${i + 1}`;
          const statusText = isAcquired ? '✓ Adquirido' : '✗ Não Adquirido';

          const enhancementData = {
            name: enhancementName,
            description: enhancement.description,
            status: statusText,
            acquired: isAcquired,
            actorUuid: actor.uuid,
            skillName: skill.name,
            index: i
          };

          emojisHtml += `<span
              class="enhancement-emoji"
              style="font-size: 24px; margin: 0 8px; cursor: help; ${filterStyle}"
              data-enhancement='${JSON.stringify(enhancementData).replace(/'/g, "&apos;")}'
              data-tooltip-direction="UP"
            >${emoji}</span>`;
        }
      }

      if (emojisHtml) {
        content += `<div style="margin: 12px 0; text-align: center; padding: 8px; background: rgba(0,0,0,0.03); border-radius: 4px;">
            ${emojisHtml}
          </div>`;
      }
    }

    // Add interactive buttons
    const buttons = manager.generateSkillButtons(skillName, actorId);
    if (buttons) {
      content += buttons;
    } else {
      const hasCustomEffects = manager.hasAnyEffects(skill);

      content += `<div style="text-align: center; margin: 12px 0; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; align-items: center;">
          <button class="cardigan-skill-attack-btn cardigan-dynamic-tooltip" data-actor-id="${actorId}" data-skill="${skillName}"
                  style="display: inline-block; padding: 8px 16px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
            <i class="fas fa-dice-d20" style="margin-right: 4px;"></i>Ataque
          </button>
          ${hasCustomEffects ? `<button class="cardigan-skill-expand-btn" data-actor-id="${actorId}" data-skill="${skillName}"
                  style="display: inline-block; padding: 4px 12px; background: #9e9e9e; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
            <i class="fas fa-chevron-down" style="margin-right: 4px;"></i>Expandir
          </button>` : ''}
        </div>`;
    }

    content += `</div>`;

    // Update the chat message content
    await chatMessage.update({ content });

  } catch (error) {
    console.error("Error updating skill chat message:", error);
  }
}

/**
 * Spend or recover energy for unregistered skills (toggle mode)
 * @param {Actor} actor - The actor
 * @param {string} skillName - The skill name
 * @param {HTMLElement} button - The button that was clicked
 * @param {object} manager - SkillManager class reference
 */
export async function spendEnergyForUnregisteredSkill(actor, skillName, button, manager) {
  try {
    // Get the chat message from the button
    const messageElement = button.closest('.message');
    if (!messageElement) {
      console.error("Could not find message element");
      return;
    }

    const messageId = messageElement.dataset.messageId;
    const chatMessage = game.messages.get(messageId);
    if (!chatMessage) {
      console.error("Could not find chat message");
      return;
    }

    // Get the skill item from the actor
    const skill = actor.items.find(item => item.type === 'skill' && item.name === skillName);
    if (!skill) {
      ui.notifications.error("Skill não encontrada no personagem");
      return;
    }

    // Check if the skill has energy cost configured
    if (!skill.system.hasEnergyCost) {
      ui.notifications.info(`${skillName} não gasta energia`);
      return;
    }

    // Use effective energy cost (considers active enhancements)
    const energyCost = skill.system.effectiveEnergyCost ?? (skill.system.energyCost || 0);

    // If energy cost is 0, don't spend anything
    if (energyCost <= 0) {
      ui.notifications.info(`${skillName} não tem custo de energia configurado`);
      return;
    }

    const currentEnergy = actor.system.power.value || 0;
    const maxEnergy = actor.system.power.max || 0;

    // Check if energy was already spent (toggle mode) - USE MESSAGE STATE
    const energySpent = chatMessage.getFlag('cardigan', 'energySpent') || false;

    if (energySpent) {
      // RECOVER ENERGY - Toggle back
      const newEnergy = Math.min(maxEnergy, currentEnergy + energyCost);

      // Update actor's power (energy)
      await actor.update({
        'system.power.value': newEnergy
      });

      // Update message state
      await chatMessage.setFlag('cardigan', 'energySpent', false);

      // Show notification
      ui.notifications.info(`${actor.name} recuperou ${energyCost} de energia! (${currentEnergy} → ${newEnergy})`);

      // Update the existing chat message with new state
      await updateSkillChatMessage(chatMessage, skillName, actor.id, manager);

    } else {
      // SPEND ENERGY - First time or after recovery

      // Check if has enough energy
      if (currentEnergy < energyCost) {
        ui.notifications.warn(`${actor.name} não tem energia suficiente! (Atual: ${currentEnergy}, Necessário: ${energyCost})`);

        // Still show message in chat informing about the attempt
        const content = `<div class="cardigan-skill-message" style="text-align: center; padding: 8px; background: rgba(255,193,7,0.1); border: 1px solid #ffc107; border-radius: 3px;">
            <h4 style="margin: 0 0 4px 0; color: #ffc107;">
              <i class="fas fa-exclamation-triangle" style="margin-right: 6px;"></i>${skillName}
            </h4>
            <p style="margin: 4px 0; color: #666;">
              <strong>${actor.name}</strong> tentou usar <strong>${skillName}</strong> mas não tem energia suficiente!
            </p>
            <div style="margin: 8px 0; padding: 8px; background: rgba(255,193,7,0.2); border-radius: 3px;">
              Energia atual: <strong>${currentEnergy}</strong> | Necessário: <strong>${energyCost}</strong>
            </div>
          </div>`;

        await ChatMessage.create({
          content,
          speaker: ChatMessage.getSpeaker({ actor }),
          style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
        return;
      }

      // Calculate new energy value
      const newEnergy = Math.max(0, currentEnergy - energyCost);

      // Update actor's power (energy)
      await actor.update({
        'system.power.value': newEnergy
      });

      // Update message state
      await chatMessage.setFlag('cardigan', 'energySpent', true);

      // Show notification
      ui.notifications.info(`${actor.name} gastou ${energyCost} de energia! (${currentEnergy} → ${newEnergy})`);

      // Update the existing chat message with new state
      await updateSkillChatMessage(chatMessage, skillName, actor.id, manager);
    }

  } catch (error) {
    console.error("Error spending skill energy:", error);
    ui.notifications.error(`Erro ao gastar energia: ${error.message}`);
  }
}
