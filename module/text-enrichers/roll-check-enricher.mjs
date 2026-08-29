/**
 * Maps normalized (accent-stripped, lowercase) aliases to CARDIGAN ability keys.
 * Accepts the Portuguese full name (as authors write in descriptions), the English
 * schema key, and the 3-letter abbreviation, so `@Teste[forca]`, `@Teste[strength]`
 * and `@Teste[str]` all resolve to the same ability.
 */
const ABILITY_ALIASES = {
  precisao: 'accuracy', accuracy: 'accuracy', acc: 'accuracy',
  evasao: 'evasion', evasion: 'evasion', eva: 'evasion',
  forca: 'strength', strength: 'strength', str: 'strength',
  destreza: 'dexterity', dexterity: 'dexterity', dex: 'dexterity',
  vigor: 'stamina', stamina: 'stamina', sta: 'stamina',
  furtividade: 'stealth', stealth: 'stealth', ste: 'stealth',
  persuasao: 'persuasion', persuasion: 'persuasion', per: 'persuasion',
  inteligencia: 'intelligence', intelligence: 'intelligence', int: 'intelligence',
  psionismo: 'psionics', psionics: 'psionics', psi: 'psionics'
};

const ABILITY_LANG_SEGMENT = {
  accuracy: 'Accuracy', evasion: 'Evasion', strength: 'Strength', dexterity: 'Dexterity',
  stamina: 'Stamina', stealth: 'Stealth', persuasion: 'Persuasion', intelligence: 'Intelligence',
  psionics: 'Psionics'
};

/** Strip accents and lowercase, for tolerant matching against ABILITY_ALIASES. */
function normalize(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function resolveAbilityKey(token) {
  return ABILITY_ALIASES[normalize(token)] ?? null;
}

function buildRollLink({ command, label, icon, dataset, relativeToUuid }) {
  const link = document.createElement('a');
  link.className = 'cardigan-roll-link';
  link.dataset.command = command;
  for (const [key, value] of Object.entries(dataset)) {
    link.dataset[key] = value;
  }
  if (relativeToUuid) link.dataset.relativeToUuid = relativeToUuid;

  const iconEl = document.createElement('i');
  iconEl.className = icon;
  link.append(iconEl, document.createTextNode(` ${label}`));
  return link;
}

/**
 * Enricher for `@Teste[atributo]` / `@Teste[atributo dc=16]`.
 * Renders a clickable chip that rolls the ability when clicked (see roll-enricher-actions.mjs).
 */
function enrichTeste(content, options) {
  const tokens = content.trim().split(/\s+/);
  let abilityToken = null;
  let dc = null;

  for (const token of tokens) {
    const dcMatch = token.match(/^dc=(\d+)$/i);
    if (dcMatch) {
      dc = Number(dcMatch[1]);
    } else if (!abilityToken) {
      abilityToken = token;
    }
  }

  const abilityKey = abilityToken ? resolveAbilityKey(abilityToken) : null;
  if (!abilityKey) {
    console.warn(`[CARDIGAN] @Teste: attribute "${abilityToken}" not recognized.`);
    return null;
  }

  const label = game.i18n.localize(`CARDIGAN.Ability.${ABILITY_LANG_SEGMENT[abilityKey]}.full`);

  return buildRollLink({
    command: 'teste',
    label,
    icon: 'fas fa-dice-d20',
    dataset: {
      ability: abilityKey,
      label,
      ...(dc !== null ? { dc: String(dc) } : {})
    },
    relativeToUuid: options.relativeTo?.uuid
  });
}

/**
 * Enricher for `@Pericia[Nome da Skill]`.
 * Skill items have no numeric bonus, so this just activates the skill
 * (same as clicking it on the sheet) instead of rolling anything.
 */
function enrichPericia(content, options) {
  const skillName = content.trim();
  if (!skillName) return null;

  return buildRollLink({
    command: 'pericia',
    label: skillName,
    icon: 'fas fa-star',
    dataset: { skillName },
    relativeToUuid: options.relativeTo?.uuid
  });
}

export const ROLL_CHECK_ENRICHER = {
  pattern: /@(Teste|Pericia)\[([^\]]+)\]/gi,
  enricher: async (match, options) => {
    const [, command, content] = match;
    if (command.toLowerCase() === 'teste') return enrichTeste(content, options);
    if (command.toLowerCase() === 'pericia') return enrichPericia(content, options);
    return null;
  }
};
