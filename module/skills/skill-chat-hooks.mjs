import { setupDefaultDynamicTooltips } from './skill-expand-ui.mjs';

/**
 * Handle the renderChatMessageHTML hook for skill buttons
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 * @param {typeof SkillManager} manager
 */
export function onRenderChatMessageHTML(message, html, manager) {
  const skillButtons = html.querySelectorAll('[class*="cardigan-skill-"], .cardigan-apply-effects-btn');

  if (skillButtons.length > 0) {
    skillButtons.forEach((button) => {
      const skillName = button.dataset.skill;
      const actorId = button.dataset.actorId;

      if (skillName && actorId) {
        const skillClass = manager.getSkill(skillName);

        let buttonType = 'unknown';
        if (button.classList.contains('cardigan-skill-attack-btn')) buttonType = 'attack';
        else if (button.classList.contains('cardigan-skill-attack-secondary-btn')) buttonType = 'attack-secondary';
        else if (button.classList.contains('cardigan-skill-energy-btn')) buttonType = 'energy';
        else if (button.classList.contains('cardigan-skill-d6-btn')) buttonType = 'd6';
        else if (button.classList.contains('cardigan-skill-expand-btn')) buttonType = 'expand';
        else if (button.classList.contains('cardigan-apply-effects-btn')) buttonType = 'apply-effects';
        else if (button.classList.contains('cardigan-skill-apply-effects-btn')) buttonType = 'apply-effects';

        if (skillClass) {
          button.removeEventListener('click', button._skillManagerHandler);

          button._skillManagerHandler = async (event) => {
            event.preventDefault();
            try {
              await skillClass.handleButtonClick(buttonType, actorId, button);
            } catch (error) {
              console.error(`Error handling ${buttonType} button click for ${skillName}:`, error);
              ui.notifications.error(`Erro ao executar ação da skill: ${error.message}`);
            }
          };

          button.addEventListener('click', button._skillManagerHandler);
        } else {
          button.removeEventListener('click', button._defaultSkillHandler);

          button._defaultSkillHandler = async (event) => {
            event.preventDefault();
            try {
              await manager.handleDefaultButtonClick(buttonType, actorId, skillName, button);
            } catch (error) {
              console.error(`Error handling ${buttonType} button click for ${skillName}:`, error);
              ui.notifications.error(`Erro ao executar ação: ${error.message}`);
            }
          };

          button.addEventListener('click', button._defaultSkillHandler);

          if (buttonType === 'attack' || buttonType === 'attack-simple') {
            setupDefaultDynamicTooltips(button, actorId, buttonType);
          }
        }
      }
    });
  }

  setupEnhancementTooltips(html);
}

/**
 * Set up tooltips for enhancement emojis in a chat message
 * @param {HTMLElement} html
 */
export async function setupEnhancementTooltips(html) {
  const enhancementEmojis = html.querySelectorAll('.enhancement-emoji[data-enhancement]');

  for (const emoji of enhancementEmojis) {
    try {
      const enhancementData = JSON.parse(emoji.dataset.enhancement);

      const enrichedDescription = await foundry.applications.ux.TextEditor.enrichHTML(
        enhancementData.description,
        {
          secrets: false,
          async: true,
          relativeTo: await fromUuid(enhancementData.actorUuid)
        }
      );

      const tooltipContent = `
        <div class="enhancement-tooltip">
          <div class="enhancement-header">
            <strong>${enhancementData.name}</strong>
            <span class="enhancement-status ${enhancementData.acquired ? 'acquired' : 'not-acquired'}">${enhancementData.status}</span>
          </div>
          <div class="enhancement-description">
            ${enrichedDescription}
          </div>
        </div>
      `;

      emoji.dataset.tooltip = tooltipContent;
      emoji.dataset.tooltipClass = 'cardigan-enhancement-tooltip';
      emoji.dataset.tooltipDirection = 'UP';
    } catch (error) {
      console.error('Error setting up enhancement tooltip:', error);
    }
  }
}

/**
 * Get button selectors for a specific skill name
 * @param {string} skillName
 * @returns {Array<{selector: string, buttonType: string}>}
 */
export function getButtonSelectorsForSkill(skillName) {
  return [
    { selector: `.cardigan-skill-attack-secondary-btn[data-skill="${skillName}"]`, buttonType: 'attack-secondary' },
    { selector: `.cardigan-skill-attack-btn[data-skill="${skillName}"]`, buttonType: 'attack' },
    { selector: `.cardigan-skill-energy-btn[data-skill="${skillName}"]`, buttonType: 'energy' },
    { selector: `.cardigan-skill-d6-btn[data-skill="${skillName}"]`, buttonType: 'd6' },
    { selector: `.cardigan-skill-expand-btn[data-skill="${skillName}"]`, buttonType: 'expand' },
    { selector: `.cardigan-skill-apply-effects-btn[data-skill="${skillName}"]`, buttonType: 'apply-effects' },
    { selector: `.cardigan-apply-effects-btn`, buttonType: 'apply-effects' }
  ];
}
