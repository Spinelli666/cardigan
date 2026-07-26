const SKILL_ORDER = [
  { key: 'accuracy', label: 'PRECISÃO' },
  { key: 'evasion', label: 'EVASÃO' },
  { key: 'strength', label: 'FORÇA' },
  { key: 'dexterity', label: 'DESTREZA' },
  { key: 'stamina', label: 'VIGOR' },
  { key: 'stealth', label: 'FURTIVIDADE' },
  { key: 'persuasion', label: 'PERSUASÃO' },
  { key: 'intelligence', label: 'INTELIGÊNCIA' },
  { key: 'psionics', label: 'PSIONISMO' }
];

/**
 * Weapon sheet context helpers.
 */
export class WeaponContext {

  /**
   * Prepare weapon-specific context data.
   * @param {Object} context - The base part context
   * @param {Item} item - The weapon item document
   * @returns {Object} - Enhanced context
   */
  static prepareAttributesData(context, item) {
    const system = item?.system ?? {};

    context.weaponSkillBonusRows = WeaponContext.#prepareSkillBonusRows(system.skillBonuses);

    return context;
  }

  /**
   * Prepare ordered weapon skill bonus rows.
   * @param {Array} skillBonuses - Stored weapon skill bonuses
   * @returns {Array}
   */
  static #prepareSkillBonusRows(skillBonuses) {
    const existingBonuses = Array.isArray(skillBonuses) ? skillBonuses : [];

    const bonusBySkill = existingBonuses.reduce((acc, entry) => {
      if (!entry || typeof entry.skill !== 'string') return acc;
      const key = entry.skill.trim();
      if (!key) return acc;

      const numericBonus = Number(entry.bonus ?? 0);
      acc[key] = Number.isFinite(numericBonus) ? numericBonus : 0;
      return acc;
    }, {});

    return SKILL_ORDER.map((row, index) => ({
      ...row,
      index,
      value: bonusBySkill[row.key] ?? 0,
    }));
  }
}
