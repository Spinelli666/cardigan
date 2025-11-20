import BaseEffect from '../base-effect.mjs';

/**
 * Eletrocutado Effect
 * When applied, deals 15 electric damage and prompts a Vigor test against Stunned
 */
export class EletrocutadoEffect extends BaseEffect {
  static effectName = 'Eletrocutado';
  static ELECTRIC_DAMAGE = 15;
  static ATORDOADO_ID = 'eE7fF8gG9hH0iI1J'; // ID do efeito Atordoado no compêndio

  /**
   * Apply electric damage and create Vigor test prompt
   * @param {Actor} actor - The actor receiving the effect
   * @param {Item} effectItem - The effect item being added
   */
  static async applyElectricDamage(actor, effectItem) {
    console.log(`[${this.effectName}] Applying to ${actor.name}`);

    // Get current HP
    const currentHP = actor.system.health?.value ?? 0;
    const newHP = Math.max(0, currentHP - this.ELECTRIC_DAMAGE);

    // Apply damage
    await actor.update({
      'system.health.value': newHP
    });

    // Create damage message
    const damageMessage = `
      <div class="cardigan-electric-damage" style="
        border: 2px solid #ffd700;
        border-radius: 8px;
        padding: 12px;
        background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%);
        box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
        margin-bottom: 8px;
      ">
        <h3 style="
          color: #ffd700;
          margin: 0 0 8px 0;
          font-size: 18px;
          text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        ">⚡️ Eletrocutado</h3>
        <p style="margin: 0; color: #e0e0e0;">
          <strong>${actor.name}</strong> sofreu <strong style="color: #ffd700;">${this.ELECTRIC_DAMAGE} de dano elétrico</strong>!
        </p>
      </div>
    `;

    await ChatMessage.create({
      content: damageMessage,
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      flags: {
        cardigan: {
          type: 'electric-damage',
          damage: this.ELECTRIC_DAMAGE,
          damageType: 'electric'
        }
      }
    });

    // Create Vigor test prompt
    await this.createVigorTestPrompt(actor);

    console.log(`[${this.effectName}] Applied ${this.ELECTRIC_DAMAGE} electric damage to ${actor.name}`);
  }

  /**
   * Create a chat message with a button to roll Vigor test
   * @param {Actor} actor - The actor who needs to test
   */
  static async createVigorTestPrompt(actor) {
    const vigorTestMessage = `
      <div class="cardigan-vigor-test-prompt" style="
        border: 2px solid #ff6b6b;
        border-radius: 8px;
        padding: 12px;
        background: linear-gradient(135deg, #2d1b1b 0%, #1a0f0f 100%);
        box-shadow: 0 0 15px rgba(255, 107, 107, 0.3);
        text-align: center;
      ">
        <h3 style="
          color: #ff6b6b;
          margin: 0 0 12px 0;
          font-size: 16px;
        ">💫 Teste de Vigor contra Atordoado</h3>
        <button class="cardigan-roll-vigor" 
                data-actor-id="${actor.id}"
                style="
          background: linear-gradient(135deg, #c92a2a 0%, #a61e1e 100%);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(201, 42, 42, 0.4);
          transition: all 0.2s;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
          🎲 Rolar Vigor
        </button>
      </div>
    `;

    await ChatMessage.create({
      content: vigorTestMessage,
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      flags: {
        cardigan: {
          type: 'vigor-test-prompt',
          actorId: actor.id
        }
      }
    });
  }

  /**
   * Roll Vigor test (1d20 + stamina.value + stamina.totalBonus)
   * @param {Actor} actor - The actor rolling
   */
  static async rollVigorTest(actor) {
    // Get Vigor value (from Stamina)
    const staminaValue = actor.system.abilities?.stamina?.value ?? 0;
    const staminaTotalBonus = actor.system.abilities?.stamina?.totalBonus ?? 0;
    const vigorModifier = staminaValue + staminaTotalBonus;

    console.log(`[${this.effectName}] Vigor Test - Stamina Value: ${staminaValue}, Total Bonus: ${staminaTotalBonus}, Total Modifier: ${vigorModifier}`);

    // Roll 1d20 + vigor modifier
    const roll = new Roll(`1d20 + ${vigorModifier}`, actor.getRollData());
    await roll.evaluate();

    const totalResult = roll.total;
    const diceResult = roll.terms[0].total; // Get the d20 result

    console.log(`[${this.effectName}] Roll Total: ${totalResult}, Dice: ${diceResult}`);

    // Determine if the test was successful (11+) or failed (10-)
    const testPassed = totalResult >= 11;

    // Create standard Foundry roll message (Dice So Nice will trigger automatically)
    const flavor = `<strong>Teste de Vigor contra Atordoado</strong>`;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      flavor: flavor,
      rollMode: game.settings.get('core', 'rollMode')
    });

    // Wait for Dice So Nice animation to complete (if module is active)
    if (game.dice3d) {
      await game.dice3d.waitFor3DAnimationByMessageID(
        game.messages.contents[game.messages.contents.length - 1].id
      );
    }

    // If test failed (10-), automatically apply Atordoado
    if (!testPassed) {
      await this.applyAtordoado(actor);
    }

    // Create result message after the roll (and after Dice So Nice animation)
    const resultText = testPassed ? '✅ Passou no teste - Resistiu ao Atordoado!' : '❌ Falhou no teste - Atordoado aplicado!';
    const resultColor = testPassed ? '#51cf66' : '#ff6b6b';

    await ChatMessage.create({
      content: `
        <div style="
          text-align: center;
          padding: 8px;
          font-size: 14px;
          color: ${resultColor};
          font-weight: bold;
        ">
          ${resultText}
        </div>
      `,
      speaker: ChatMessage.getSpeaker({ actor: actor })
    });

    console.log(`[${this.effectName}] ${actor.name} rolled Vigor test: ${totalResult} (${diceResult} + ${vigorModifier})`);
  }

  /**
   * Apply Atordoado effect from compendium to actor
   * @param {Actor} actor - The actor to receive the effect
   */
  static async applyAtordoado(actor) {
    try {
      // Get the compendium
      const pack = game.packs.get('cardigan.efeitos-cardigan');
      if (!pack) {
        ui.notifications.error('Compêndio de efeitos não encontrado!');
        return;
      }

      // Get Atordoado effect from compendium
      const atordoadoEffect = await pack.getDocument(this.ATORDOADO_ID);
      if (!atordoadoEffect) {
        ui.notifications.error('Efeito Atordoado não encontrado no compêndio!');
        return;
      }

      // Create the effect on the actor
      await actor.createEmbeddedDocuments('Item', [atordoadoEffect.toObject()]);

      // Notification
      ui.notifications.info(`${actor.name} recebeu o efeito Atordoado!`);

      // Chat message
      await ChatMessage.create({
        content: `
          <div style="
            border: 2px solid #ff6b6b;
            border-radius: 8px;
            padding: 12px;
            background: linear-gradient(135deg, #2d1b1b 0%, #1a0f0f 100%);
            text-align: center;
          ">
            <p style="margin: 0; color: #e0e0e0;">
              <strong>${actor.name}</strong> falhou no teste de Vigor e ficou <strong style="color: #ff6b6b;">💫 Atordoado</strong>!
            </p>
          </div>
        `,
        speaker: ChatMessage.getSpeaker({ actor: actor })
      });

      console.log(`[${this.effectName}] Applied Atordoado effect to ${actor.name}`);
    } catch (error) {
      console.error(`[${this.effectName}] Error applying Atordoado:`, error);
      ui.notifications.error('Erro ao aplicar efeito Atordoado!');
    }
  }

  /**
   * Handle resistance to Atordoado
   * @param {Actor} actor - The actor who resisted
   */
  static async resistAtordoado(actor) {
    await ChatMessage.create({
      content: `
        <div style="
          border: 2px solid #51cf66;
          border-radius: 8px;
          padding: 12px;
          background: linear-gradient(135deg, #1b2d1b 0%, #0f1a0f 100%);
          text-align: center;
        ">
          <p style="margin: 0; color: #e0e0e0;">
            <strong>${actor.name}</strong> resistiu e <strong style="color: #51cf66;">não ficou Atordoado</strong>! ✨
          </p>
        </div>
      `,
      speaker: ChatMessage.getSpeaker({ actor: actor })
    });

    ui.notifications.info(`${actor.name} resistiu ao efeito Atordoado!`);
    console.log(`[${this.effectName}] ${actor.name} resisted Atordoado`);
  }

  /**
   * Register hooks for effect application and chat button clicks
   */
  static registerHooks() {
    console.log(`[${this.effectName}] Registering hooks...`);

    /**
     * Hook: Item Created on Actor
     * Triggers when Eletrocutado effect is added to an actor
     */
    Hooks.on('createItem', async (item, options, userId) => {
      // Only process if it's an effect item
      if (item.type !== 'efeito') return;
      
      // Only process if it's the Eletrocutado effect
      if (item.name !== this.effectName) return;

      // Only process if it belongs to an actor
      if (!item.parent || item.parent.documentName !== 'Actor') return;

      const actor = item.parent;

      console.log(`[${this.effectName}] Effect added to ${actor.name}`);

      // Apply electric damage and create test prompt
      await this.applyElectricDamage(actor, item);
    });

    /**
     * Hook: Chat Message Render
     * Add click handlers to buttons in chat messages
     */
    Hooks.on('renderChatMessageHTML', (message, html) => {
      // Handle "Roll Vigor" button
      const button = html.querySelector('.cardigan-roll-vigor');
      if (!button) return;

      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const actorId = button.dataset.actorId;
        const actor = game.actors.get(actorId);

        if (!actor) {
          ui.notifications.error('Personagem não encontrado!');
          return;
        }

        // Check if user owns the actor or is GM
        if (!actor.isOwner && !game.user.isGM) {
          ui.notifications.warn('Você não tem permissão para rolar por este personagem!');
          return;
        }

        // Disable button to prevent double clicks
        button.disabled = true;
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';

        await this.rollVigorTest(actor);
      });
    });

    console.log(`[${this.effectName}] Hooks registered successfully`);
  }
}

export default EletrocutadoEffect;
