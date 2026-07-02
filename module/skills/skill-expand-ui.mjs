import { BaseSkill } from './base-skill.mjs';

/**
 * Expand a default skill in chat (show/hide expanded content container)
 * @param {Actor} actor
 * @param {string} skillName
 * @param {HTMLElement} button
 * @param {typeof SkillManager} manager
 */
export async function expandDefaultSkill(actor, skillName, button, manager) {
  const messageElement = button.closest('.message-content');
  if (!messageElement) return;

  let expandedContainer = messageElement.querySelector('.cardigan-skill-expanded-content');

  if (expandedContainer) {
    // Toggle visibility
    const isVisible = expandedContainer.style.display !== 'none';
    expandedContainer.style.display = isVisible ? 'none' : 'block';

    if (isVisible) {
      // Hiding - clear interval and hook
      if (expandedContainer._refreshInterval) {
        clearInterval(expandedContainer._refreshInterval);
        expandedContainer._refreshInterval = null;
      }
      if (expandedContainer._hookId && Hooks) {
        Hooks.off('targetToken', expandedContainer._hookId);
        expandedContainer._hookId = null;
      }
      button.innerHTML = '<i class="fas fa-chevron-down" style="margin-right: 4px;"></i>Expandir';
    } else {
      // Showing - start interval, hook, and update content
      const updateContent = () => {
        expandedContainer.innerHTML = generateExpandedContentForSkill(actor, skillName, manager);
        setupApplyEffectsButtonListener(expandedContainer, actor, skillName, manager);
      };

      updateContent();

      if (Hooks) {
        expandedContainer._hookId = Hooks.on('targetToken', updateContent);
      }

      expandedContainer._refreshInterval = setInterval(updateContent, 500);
      button.innerHTML = '<i class="fas fa-chevron-up" style="margin-right: 4px;"></i>Recolher';
    }
  } else {
    // Create expanded content container
    expandedContainer = document.createElement('div');
    expandedContainer.className = 'cardigan-skill-expanded-content';

    const updateContent = () => {
      expandedContainer.innerHTML = generateExpandedContentForSkill(actor, skillName, manager);
      setupApplyEffectsButtonListener(expandedContainer, actor, skillName, manager);
    };

    updateContent();

    if (Hooks) {
      expandedContainer._hookId = Hooks.on('targetToken', updateContent);
    }

    expandedContainer._refreshInterval = setInterval(updateContent, 500);

    const buttonContainer = button.closest('div[style*="display: flex"]') || button.parentElement;
    buttonContainer.insertAdjacentElement('afterend', expandedContainer);
    button.innerHTML = '<i class="fas fa-chevron-up" style="margin-right: 4px;"></i>Recolher';
  }
}

/**
 * Setup event listener for the apply effects button inside an expanded container
 * @param {HTMLElement} container
 * @param {Actor} actor
 * @param {string} skillName
 * @param {typeof SkillManager} manager
 */
export function setupApplyEffectsButtonListener(container, actor, skillName, manager) {
  const applyButton = container.querySelector('.cardigan-skill-apply-effects-btn');
  if (applyButton) {
    applyButton.removeEventListener('click', applyButton._clickHandler);

    applyButton._clickHandler = async (event) => {
      event.preventDefault();
      await manager.applyCustomEffectsForUnregisteredSkill(actor, skillName);
    };

    applyButton.addEventListener('click', applyButton._clickHandler);
  }
}

/**
 * Generate expanded content HTML for a skill, showing current targets and effects button
 * @param {Actor} actor
 * @param {string} skillName
 * @param {typeof SkillManager} manager
 * @returns {string} HTML content
 */
export function generateExpandedContentForSkill(actor, skillName, manager) {
  const targetedTokens = Array.from(game.user.targets);

  if (targetedTokens.length === 0) {
    return `
      <div style="
        background: rgba(255, 193, 7, 0.1);
        border-left: 4px solid #ffc107;
        padding: 12px;
        margin: 8px 0;
        border-radius: 6px;
        text-align: center;
        color: #856404;
      ">
        <i class="fas fa-exclamation-triangle" style="margin-right: 6px;"></i>
        <strong>Nenhum token alvo selecionado</strong><br>
        <small>Use T ou Shift+T para mirar em tokens</small>
      </div>
    `;
  }

  const tokensHtml = targetedTokens.map(token => {
    const tokenActor = token.actor;
    if (!tokenActor) return '';
    const tokenImg = token.document.texture.src || tokenActor.img || 'icons/svg/mystery-man.svg';
    return `<img src="${tokenImg}" alt="${tokenActor.name}" title="${tokenActor.name}"
             style="width: 32px; height: 32px; border-radius: 50%; margin: 4px; border: 2px solid #4caf50; cursor: pointer;">`;
  }).filter(html => html !== '').join('');

  const skill = actor.items.find(item => item.type === 'skill' && item.name === skillName);
  const hasCustomEffects = manager.hasAnyEffects(skill);

  return `
    <div style="
      background: rgba(76, 175, 80, 0.1);
      border-left: 4px solid #4caf50;
      padding: 12px;
      margin: 8px 0;
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    ">
      <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
        <i class="fas fa-crosshairs" style="color: #4caf50; margin-right: 6px;"></i>
        <strong style="color: #4caf50;">Tokens Alvo:</strong>
      </div>
      <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; margin-bottom: ${hasCustomEffects ? '12px' : '0'};">
        ${tokensHtml}
      </div>
      ${hasCustomEffects ? `
        <div style="text-align: center;">
          <button class="cardigan-skill-apply-effects-btn" data-actor-id="${actor.id}" data-skill="${skillName}"
                  style="padding: 6px 12px; background: #9c27b0; color: white; border: none; border-radius: 3px; cursor: pointer; font-weight: bold;">
            <i class="fas fa-magic" style="margin-right: 4px;"></i>Aplicar Efeitos
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Build weapon tooltip text for unregistered skills (fallback to title attribute)
 * @param {HTMLElement} button
 * @param {string} actorId
 * @param {boolean} isSecondary
 * @returns {string}
 */
export function setupDefaultWeaponTooltip(button, actorId, isSecondary = false) {
  const actor = game.actors.get(actorId);
  if (!actor) return '';

  let weapon = null;

  if (isSecondary) {
    const realWeapons = actor.items.filter(item =>
      item.type === 'arma' &&
      item.system.equipped &&
      !item.system.isUnarmed &&
      (item.system.rightHand || item.system.leftHand)
    );
    weapon = realWeapons.find(w => w.system.leftHand && !w.system.rightHand);
  } else {
    const realWeapons = actor.items.filter(item =>
      item.type === 'arma' &&
      item.system.equipped &&
      !item.system.isUnarmed &&
      (item.system.rightHand || item.system.leftHand)
    );
    weapon = realWeapons.find(w => w.system.rightHand);
  }

  let tooltipText = '';

  if (weapon) {
    const weaponName = weapon.name;
    const damageTotal = weapon.system.damage?.total || "0";
    const baseDamage = weapon.system.damage?.value || "0";

    let abilityModifier = 0;
    let abilityName = "";

    if (weapon.system.damage?.useStrength && actor.system.abilities?.strength) {
      abilityModifier = actor.system.abilities.strength.value || 0;
      abilityName = "Força";
    } else if (weapon.system.damage?.useDexterity && actor.system.abilities?.dexterity) {
      abilityModifier = actor.system.abilities.dexterity.value || 0;
      abilityName = "Destreza";
    }

    let damageBreakdown;
    if (abilityModifier > 0) {
      damageBreakdown = `${baseDamage} + ${abilityModifier}(${abilityName})`;
    } else {
      damageBreakdown = baseDamage;
    }

    if (weapon.system.isFirearm && weapon.system.ranged) {
      const currentAmmo = weapon.system.loadedAmmo || 0;
      const maxAmmo = weapon.system.magazine || 0;
      tooltipText = `${weaponName} - [${currentAmmo}/${maxAmmo}]\n${damageTotal}\n(${damageBreakdown})`;
    } else if (weapon.system.ranged && !weapon.system.melee) {
      const currentAmmo = weapon.system.loadedAmmo || 0;
      tooltipText = `${weaponName} - [${currentAmmo}]\n${damageTotal}\n(${damageBreakdown})`;
    } else {
      tooltipText = `${weaponName}\n${damageTotal}\n(${damageBreakdown})`;
    }
  } else {
    const strengthValue = actor.system.abilities?.strength?.value || 0;
    const strengthTotalBonus = actor.system.abilities?.strength?.totalBonus || 0;
    const totalStrength = strengthValue + strengthTotalBonus;

    const unarmedDamage = totalStrength > 0 ? totalStrength : 1;

    let damageBreakdown;
    if (totalStrength > 0) {
      if (strengthTotalBonus > 0) {
        damageBreakdown = `${strengthValue} + ${strengthTotalBonus}(Força)`;
      } else {
        damageBreakdown = `${strengthValue}(Força)`;
      }
    } else {
      damageBreakdown = "1 (mínimo)";
    }

    tooltipText = `Ataque Desarmado\n${unarmedDamage}\n(${damageBreakdown})`;
  }

  return tooltipText;
}

/**
 * Setup dynamic tooltips with mouseenter/mouseleave for default skill attack buttons
 * @param {HTMLElement} button
 * @param {string} actorId
 * @param {string} buttonType
 */
export function setupDefaultDynamicTooltips(button, actorId, buttonType) {
  button.removeAttribute('title');
  button.removeAttribute('data-tooltip');

  button.removeEventListener('mouseenter', button._defaultTooltipEnterHandler);
  button.removeEventListener('mouseleave', button._defaultTooltipLeaveHandler);

  let customTooltip = null;

  button._defaultTooltipEnterHandler = async (event) => {
    try {
      const isSecondary = buttonType === 'attack-simple';
      let tooltipHTML;

      if (isSecondary && typeof BaseSkill._generateSecondaryWeaponTooltipHTML === 'function') {
        tooltipHTML = await BaseSkill._generateSecondaryWeaponTooltipHTML(actorId);
      } else if (typeof BaseSkill._generateWeaponTooltipHTML === 'function') {
        tooltipHTML = await BaseSkill._generateWeaponTooltipHTML(actorId);
      } else {
        // Fallback to text display
        const tooltipText = setupDefaultWeaponTooltip(button, actorId, isSecondary);
        event.target.setAttribute('title', tooltipText);
        return;
      }

      customTooltip = document.createElement('div');
      customTooltip.className = 'cardigan-custom-tooltip';
      customTooltip.innerHTML = tooltipHTML;
      customTooltip.style.position = 'fixed';
      customTooltip.style.zIndex = '10000';
      customTooltip.style.pointerEvents = 'none';

      document.body.appendChild(customTooltip);

      const rect = event.target.getBoundingClientRect();
      const tooltipRect = customTooltip.getBoundingClientRect();

      let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
      let top = rect.top - tooltipRect.height - 10;

      if (left < 5) left = 5;
      if (left + tooltipRect.width > window.innerWidth - 5) {
        left = window.innerWidth - tooltipRect.width - 5;
      }
      if (top < 5) {
        top = rect.bottom + 10; // Show below if no space above
      }

      customTooltip.style.left = `${left}px`;
      customTooltip.style.top = `${top}px`;

      button._customTooltip = customTooltip;

    } catch (error) {
      console.error('Error generating default tooltip:', error);
      const tooltipText = setupDefaultWeaponTooltip(button, actorId, buttonType === 'attack-simple');
      event.target.setAttribute('title', tooltipText);
    }
  };

  button._defaultTooltipLeaveHandler = (event) => {
    if (button._customTooltip) {
      button._customTooltip.remove();
      button._customTooltip = null;
    }
  };

  button.addEventListener('mouseenter', button._defaultTooltipEnterHandler);
  button.addEventListener('mouseleave', button._defaultTooltipLeaveHandler);
}
