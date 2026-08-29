import { AdvantageSelectionDialog } from '../applications/advantage-selection-dialog.mjs';
import { ChatMessageHelper } from '../helpers/chat-messages.mjs';
import { buildRollFormula } from '../helpers/config.mjs';
import { detectCriticalResults } from '../skills/skill-default-attacks.mjs';

/**
 * Resolve the actor a roll-link button should act on.
 * Prefers the document the enricher baked in (`data-relative-to-uuid`), falling back to
 * the controlled token or the user's assigned character — same fallback Foundry itself
 * uses for content links rolled outside of a specific sheet/chat context.
 * @param {HTMLElement} link
 * @returns {Actor|null}
 */
function resolveActor(link) {
  const uuid = link.dataset.relativeToUuid;
  if (uuid) {
    const doc = fromUuidSync(uuid);
    if (doc) {
      if (doc.documentName === 'Actor') return doc;
      if (doc.actor) return doc.actor;
    }
  }
  return canvas.tokens?.controlled[0]?.actor ?? game.user.character ?? null;
}

/**
 * Roll an ability check for `@Teste[atributo]`, reusing the same advantage dialog,
 * Congelado penalty, Sangramento trigger and critical detection as the sheet's own
 * ability roll (module/sheets/actions/header-status-actions.mjs onRoll).
 * @param {Actor} actor
 * @param {string} abilityKey
 * @param {number|null} dc
 * @param {string} label
 */
async function rollAbilityCheck(actor, abilityKey, dc, label) {
  const result = await AdvantageSelectionDialog.show({
    hideHandSelection: true,
    hideJointRoll: true,
    hideAttackModeBorder: true
  });
  if (!result) return;

  const { rollType, manualModifier = 0 } = result;

  let formula = buildRollFormula(rollType, `@${abilityKey}.total`, manualModifier);

  const { CongeladoEffect } = await import('../effects/effects/frozen.mjs');
  const congeladoPenalty = CongeladoEffect.getSkillPenalty(actor);
  if (congeladoPenalty !== 0) formula += ` ${congeladoPenalty}`;

  const roll = new Roll(formula, actor.getRollData());
  await roll.evaluate();

  const { SangramentoEffect } = await import('../effects/index.mjs');
  await SangramentoEffect.applyBleedingDamage(actor, label, abilityKey);

  const flags = detectCriticalResults(roll, actor, abilityKey);

  await ChatMessageHelper.createRollMessage({
    actor,
    roll,
    label,
    rollType,
    rollDescription: ChatMessageHelper.getRollTypeDescription(rollType),
    flags,
    dc
  });
}

/**
 * Activate a skill for `@Pericia[Nome]` — same entry point as clicking the skill
 * on the actor sheet (module/sheets/actions/proficiencies-actions.mjs onSkillToChat).
 * @param {Actor} actor
 * @param {string} skillName
 */
async function activateSkill(actor, skillName) {
  const { getSkillManager } = await import('../skills/index.mjs');
  const skillManager = await getSkillManager();
  await skillManager.handleSkillToChat(skillName, actor.id);
}

/**
 * Delegated click handler for `.cardigan-roll-link` elements produced by the
 * @Teste/@Pericia text enricher, registered once on `document` (see index.mjs)
 * so it works regardless of where the enriched HTML was rendered (sheet, chat, tooltip).
 * @param {PointerEvent} event
 */
export async function handleRollEnricherClick(event) {
  const link = event.target.closest?.('a.cardigan-roll-link');
  if (!link) return;
  event.preventDefault();

  const actor = resolveActor(link);
  if (!actor) {
    ui.notifications.warn('Selecione um token ou atribua um personagem para rolar.');
    return;
  }

  try {
    if (link.dataset.command === 'teste') {
      const dc = link.dataset.dc ? Number(link.dataset.dc) : null;
      await rollAbilityCheck(actor, link.dataset.ability, dc, link.dataset.label);
    } else if (link.dataset.command === 'pericia') {
      await activateSkill(actor, link.dataset.skillName);
    }
  } catch (error) {
    console.error('[CARDIGAN] Error handling roll-link click:', error);
    ui.notifications.error(`Erro ao processar rolagem: ${error.message}`);
  }
}
