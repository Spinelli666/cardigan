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
 * Armor sheet context helpers.
 */
export class ArmorContext {

  /**
   * Prepare armor-specific context data.
   * @param {Object} context - The base part context
   * @param {Item} item - The armor item document
   * @returns {Object} - Enhanced context
   */
  static prepareAttributesData(context, item) {
    const system = item?.system ?? {};

    context.armorSkillBonusRows = ArmorContext.#prepareSkillBonusRows(system.skillBonuses);
    context.armorMovementBonus = ArmorContext.#normalizeBonusField(system.movementBonus, null);
    context.armorBackpackSpaceBonus = ArmorContext.#normalizeBonusField(system.backpackBonus, null);

    return context;
  }

  /**
   * Normalize a nested armor bonus field with legacy flat fallback.
   * @param {Object} field - Canonical nested bonus field
   * @param {number|string} legacyValue - Legacy flat bonus value
   * @returns {{enabled: boolean, bonus: number}}
   */
  static #normalizeBonusField(field, legacyValue) {
    const nestedBonus = Number(field?.bonus ?? Number.NaN);
    const fallbackBonus = Number(legacyValue ?? 0);
    const bonus = Number.isFinite(nestedBonus)
      ? nestedBonus
      : (Number.isFinite(fallbackBonus) ? fallbackBonus : 0);

    return {
      enabled: bonus !== 0,
      bonus,
    };
  }

  /**
   * Prepare ordered armor skill bonus rows.
   * @param {Array} skillBonuses - Stored armor skill bonuses
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
