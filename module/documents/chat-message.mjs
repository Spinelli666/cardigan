/**
 * Extend the base ChatMessage document to customize chat message rendering
 * @extends {ChatMessage}
 */
export class CardiganChatMessage extends ChatMessage {
  
  /**
   * @override
   * Render the HTML for the ChatMessage which should be added to the log
   */
  async renderHTML(options = {}) {
    const html = await super.renderHTML(options);
    
    // Apply custom enrichments to chat cards
    await this._enrichChatCard(html);
    
    return html;
  }

  /**
   * Augment the chat card markup to add divider image
   * @param {HTMLElement} html - The chat card markup
   * @protected
   */
  async _enrichChatCard(html) {
    // Add custom class marker for Cardigan messages
    html.classList.add("cardigan-chat");

    // Find the message header and content
    const messageHeader = html.querySelector(".message-header");
    const messageContent = html.querySelector(".message-content");
    if (!messageHeader || !messageContent) return;

    // Move message-metadata from header to content
    const messageMetadata = messageHeader.querySelector(".message-metadata");
    if (messageMetadata) {
      messageContent.appendChild(messageMetadata);
    }

    // Check if dividers already exist
    if (messageHeader.querySelector(".message-divider")) return;

    // Create first divider element
    const divider1 = document.createElement("img");
    divider1.classList.add("message-divider", "message-divider-1");
    divider1.src = "systems/cardigan/assets/images/decorative/divider.webp";
    divider1.alt = "";
    divider1.setAttribute("aria-hidden", "true");

    // Create second divider element
    const divider2 = document.createElement("img");
    divider2.classList.add("message-divider", "message-divider-2");
    divider2.src = "systems/cardigan/assets/images/decorative/divider.webp";
    divider2.alt = "";
    divider2.setAttribute("aria-hidden", "true");

    // Add both dividers to message header
    messageHeader.appendChild(divider1);
    messageHeader.appendChild(divider2);
  }
}
