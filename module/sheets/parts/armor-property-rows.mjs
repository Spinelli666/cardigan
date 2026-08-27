/**
 * Builds the flat list of "characteristic" entries for an armadura item (protection,
 * movement/energy/life/backpack bonus, cold resistance, durability, skill bonuses) — shared
 * by the backpack's expandable summary box (item-expand.mjs) and the item preview tooltip/chat
 * message (armor-preview-tooltip.mjs). Chunking into rows of N is left to each caller, since
 * the two contexts use different row sizes.
 * @param {Item} item
 * @returns {Array<object>}
 */
export function buildArmorPropertyEntries(item) {
  const sys = item.system;
  const entries = [];

  const protection = Number(sys.protection) || 0;
  if (protection >= 1) {
    entries.push({ icon: 'icon-armor.svg', label: 'Proteção', displayValue: `+${protection}` });
  }

  const movement = sys.movementBonus?.enabled ? Number(sys.movementBonus.bonus) || 0 : 0;
  if (movement !== 0) {
    entries.push({ icon: 'icon-movement.svg', label: 'Bônus de Movimento', displayValue: movement > 0 ? `+${movement}` : `${movement}` });
  }

  const energy = Number(sys.energyBonus) || 0;
  if (energy !== 0) {
    entries.push({ icon: 'icon-energy.svg', label: 'Bônus de Energia', displayValue: energy > 0 ? `+${energy}` : `${energy}` });
  }

  const life = Number(sys.lifeBonus) || 0;
  if (life !== 0) {
    entries.push({ icon: 'icon-health.svg', label: 'Bônus de Vida', displayValue: life > 0 ? `+${life}` : `${life}` });
  }

  const backpackBonus = sys.backpackBonus?.enabled ? Number(sys.backpackBonus.bonus) || 0 : 0;
  if (backpackBonus !== 0) {
    entries.push({ icon: 'icon-backpack.svg', label: 'Bônus de Mochila', displayValue: backpackBonus > 0 ? `+${backpackBonus}` : `${backpackBonus}` });
  }

  const cold = Number(sys.coldResistance) || 0;
  if (cold >= 1) {
    entries.push({ icon: 'icon-weather.svg', label: 'Resistência ao Frio', displayValue: `+${cold}` });
  }

  if (sys.durability?.max) {
    entries.push({ icon: 'icon-durability.svg', label: 'Durabilidade', kind: 'durability', current: sys.durability.current, max: sys.durability.max });
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
      entries.push({ kind: 'skill', abbr, displayValue: bonus > 0 ? `+${bonus}` : `${bonus}` });
    }
  }

  return entries;
}
