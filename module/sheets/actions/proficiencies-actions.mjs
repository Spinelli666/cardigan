/**
 * Actions for the Proficiencies tab
 */
export class ProficienciesActions {
  /**
   * Show effect information in chat
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   * @returns {Promise<void>}
   */
  static async onShowEffectInChat(event, target, sheet) {
    event.preventDefault();
    
    try {
      const effectName = target.dataset.effectName;
      const effectDescription = target.dataset.effectDescription || "";
      const actorName = sheet.document.name;
      
      // Create message content
      let content = `<div class="cardigan-effect-message">
        <h3 style="margin: 0 0 8px 0; color: #b5b3a4; border-bottom: 1px solid #c9c7b8; padding-bottom: 4px;">
          <i class="fas fa-magic" style="margin-right: 6px;"></i>Active Effect
        </h3>
        <p style="margin: 4px 0; font-weight: bold;">
          <strong>${actorName}</strong> is under the effect: <em style="color: #b5b3a4;">${effectName}</em>
        </p>`;
      
      if (effectDescription && effectDescription.trim() !== "") {
        content += `<div style="margin-top: 8px; padding: 6px; background: rgba(0,0,0,0.1); border-left: 3px solid #b5b3a4; border-radius: 3px;">
          <div style="margin: 0; font-style: italic; color: #666;">${effectDescription}</div>
        </div>`;
      }
      
      content += `</div>`;
      
      // Send message to chat
      await ChatMessage.create({
        content: content,
        speaker: ChatMessage.getSpeaker({ actor: sheet.document }),
        style: CONST.CHAT_MESSAGE_STYLES.OTHER
      });
      
    } catch (error) {
      console.error("Error showing effect in chat:", error);
      ui.notifications.error(`Error showing effect in chat: ${error.message}`);
    }
  }

  /**
   * Send effect information to chat (when clicking effect image)
   * @param {PointerEvent} event - The originating click event
   * @param {HTMLElement} target - The capturing HTML element which defined a [data-action]
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   * @returns {Promise<void>}
   */
  static async onSendEffectToChat(event, target, sheet) {
    event.preventDefault();
    event.stopPropagation();
    
    try {
      const effectName = target.dataset.effectName;
      const effectDescription = target.dataset.effectDescription || "";
      const effectImg = target.dataset.effectImg || "icons/svg/aura.svg";
      const effectRounds = target.dataset.effectRounds;
      const actorName = sheet.document.name;
      const actorImg = sheet.document.img || sheet.document.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";
      
      // Render template with context data
      const content = await foundry.applications.handlebars.renderTemplate(
        "systems/cardigan/templates/chat/effect-message.hbs",
        {
          actorImg,
          actorName,
          effectImg,
          effectName,
          effectDescription,
          effectRounds
        }
      );
      
      // Send message to chat
      await ChatMessage.create({
        content: content,
        speaker: ChatMessage.getSpeaker({ actor: sheet.document }),
        style: CONST.CHAT_MESSAGE_STYLES.OTHER
      });
      
    } catch (error) {
      console.error("Error sending effect to chat:", error);
      ui.notifications.error(`Error sending effect to chat: ${error.message}`);
    }
  }

  /**
   * Show skill description in chat
   * @param {Event} event - The triggering event
   * @param {HTMLElement} target - The targeted element
   * @param {CardiganSystemActorSheet} sheet - The actor sheet instance
   * @returns {Promise<void>}
   */
  static async onSkillToChat(event, target, sheet) {
    event.preventDefault();
    
    try {
      const itemId = target.dataset.itemId;
      const skill = sheet.document.items.get(itemId);
      
      if (!skill) {
        ui.notifications.error("Skill not found");
        return;
      }
      
      const skillName = skill.name;
      const actorId = sheet.document.id;
      
      // Use the SkillManager to handle skill-to-chat
      try {
        const { getSkillManager } = await import('../../skills/index.mjs');
        const skillManager = await getSkillManager();
        await skillManager.handleSkillToChat(skillName, actorId);
      } catch (error) {
        console.error(`Error showing skill ${skillName} in chat:`, error);
        ui.notifications.error(`Error showing skill in chat: ${error.message}`);
      }
      
    } catch (error) {
      console.error("Error showing skill in chat:", error);
      ui.notifications.error(`Error showing skill in chat: ${error.message}`);
    }
  }
}
