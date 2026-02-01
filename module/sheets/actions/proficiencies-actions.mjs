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
      const actorName = sheet.document.name;
      
      // Create message content with image in card style
      let content = `<div class="cardigan-effect-chat-message" style="
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
        background: linear-gradient(135deg, rgba(40, 44, 52, 0.95) 0%, rgba(25, 28, 33, 0.95) 100%);
        border: 2px solid #c0863b;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding-bottom: 10px;
          border-bottom: 2px solid rgba(192, 134, 59, 0.3);
        ">
          <img src="${effectImg}" alt="${effectName}" style="
            width: 48px;
            height: 48px;
            border-radius: 6px;
            border: 2px solid #c0863b;
            box-shadow: 0 0 12px rgba(192, 134, 59, 0.5);
          " />
          <div style="flex: 1;">
            <h3 style="
              margin: 0 0 4px 0;
              font-family: 'Alatsi', sans-serif;
              font-size: 18px;
              background: linear-gradient(180deg, #FFB75C 20%, #996E37 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            ">
              <i class="fas fa-magic" style="margin-right: 6px; color: #c0863b;"></i>${effectName}
            </h3>
            <p style="
              margin: 0;
              font-size: 12px;
              color: #b5b3a4;
              font-style: italic;
            ">
              <strong style="color: #FFB75C;">${actorName}</strong> está sob este efeito
            </p>
          </div>
        </div>`;
      
      if (effectDescription && effectDescription.trim() !== "") {
        content += `<div style="
          padding: 10px;
          background: rgba(0, 0, 0, 0.2);
          border-left: 3px solid #c0863b;
          border-radius: 4px;
          color: #d0d0d0;
          font-size: 13px;
          line-height: 1.5;
        ">
          ${effectDescription}
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
