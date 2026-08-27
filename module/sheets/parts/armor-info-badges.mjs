/**
 * Builds the capped, priority-ordered list of "info badge" entries shown in the backpack
 * row's .item-information div (and the equipped-armor-item slot, which reuses the same
 * armor-info-badges.hbs partial) for an armadura item.
 *
 * Unlike armor-property-rows.mjs (used by the caixa expansiva/tooltip, which shows every
 * characteristic), this list is capped at maxCount entries — when more candidates exist than
 * fit, only the highest-priority ones are kept, in the fixed priority order below.
 * @param {Item} item
 * @param {number} [maxCount=3]
 * @returns {Array<object>}
 */
export function buildArmorInfoBadges(item, maxCount = 3) {
  const sys = item.system;
  const candidates = [];

  if (sys.magicalArtifact) {
    candidates.push({ kind: 'paranormal-artifact', icon: 'icon-paranormal-artifact.svg', labelKey: 'CARDIGAN.MagicalArtifact', iconOnly: true });
  }

  const protection = Number(sys.protection) || 0;
  if (protection >= 1) {
    candidates.push({ kind: 'protection', icon: 'icon-armor.svg', labelKey: 'CARDIGAN.Protection', displayValue: `+${protection}` });
  }

  if (sys.movementBonus?.enabled) {
    const movement = Number(sys.movementBonus.bonus) || 0;
    candidates.push({ kind: 'movement-bonus', icon: 'icon-movement.svg', labelKey: 'CARDIGAN.MovementBonus', displayValue: `+${movement}` });
  }

  const skillAbbreviations = {
    accuracy: 'PRE',
    evasion: 'EVA',
    strength: 'FOR',
    dexterity: 'DES',
    stamina: 'VIG',
    stealth: 'FUR',
    persuasion: 'PER',
    intelligence: 'INT',
    psionics: 'PSI'
  };
  for (const bonusEntry of (sys.skillBonuses ?? [])) {
    const bonus = Number(bonusEntry?.bonus) || 0;
    const abbr = skillAbbreviations[bonusEntry?.skill];
    if (bonus !== 0 && abbr) {
      candidates.push({ kind: 'skill-bonus', abbr, displayValue: bonus > 0 ? `+${bonus}` : `${bonus}` });
    }
  }

  const cold = Number(sys.coldResistance) || 0;
  if (cold >= 1) {
    candidates.push({ kind: 'weather', icon: 'icon-weather.svg', labelKey: 'CARDIGAN.ColdResistance', displayValue: `+${cold}` });
  }

  if (sys.stylish) {
    candidates.push({ kind: 'stylish', icon: 'icon-stylish.svg', labelKey: 'CARDIGAN.Stylish', iconOnly: true });
  }

  if (sys.backpackBonus?.enabled) {
    const backpackBonus = Number(sys.backpackBonus.bonus) || 0;
    candidates.push({ kind: 'backpack', icon: 'icon-backpack.svg', labelKey: 'CARDIGAN.BackpackSpaceBonus', displayValue: `+${backpackBonus}` });
  }

  const life = Number(sys.lifeBonus) || 0;
  if (life >= 1) {
    candidates.push({ kind: 'life-bonus', icon: 'icon-health.svg', labelKey: 'CARDIGAN.Life', displayValue: `+${life}` });
  }

  const energy = Number(sys.energyBonus) || 0;
  if (energy >= 1) {
    candidates.push({ kind: 'energy-bonus', icon: 'icon-energy.svg', labelKey: 'CARDIGAN.Energy', displayValue: `+${energy}` });
  }

  return candidates.slice(0, maxCount);
}
