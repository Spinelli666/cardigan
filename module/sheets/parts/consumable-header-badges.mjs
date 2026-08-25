/**
 * Builds the tooltip HTML strings for the "Teste de Perícia" / "Vida & Energia" / "Efeitos"
 * header badges shown on item-consumivel items — shared by the backpack's expandable summary
 * box (item-expand.mjs) and the item preview tooltip/chat message (consumable-preview-tooltip.mjs).
 * Uses Foundry's native tooltip mechanism (game.tooltip), not custom JS: middle-click locks it,
 * right-click dismisses the locked one, moving away auto-dismisses. Same source data as the
 * item's own Propriedades tab (life-energy-dialog-listeners.mjs / common-item-listeners.mjs).
 * @param {Item} item
 * @returns {Promise<{lifeEnergyTooltipHtml: string, effectsTooltipHtml: string, skillTestTooltipHtml: string}>}
 */
export async function buildHeaderBadgeTooltips(item) {
  // Full skill name (e.g. "Precisão"), title-cased from the all-caps ".full" localization
  // string (used elsewhere as-is, but here we want "2xPrecisão", not "2xPRECISÃO").
  const getSkillDisplayName = (ability) => {
    const key = `CARDIGAN.Ability.${ability.charAt(0).toUpperCase()}${ability.slice(1)}.full`;
    const raw = game.i18n.localize(key);
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : '';
  };
  const buildLifeEnergyFormula = (dice, quantity, bonus, addSkill, skill, doubleSkill) => {
    const diceFaces = (dice || '1d20').replace(/^1/, '');
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    let formula = `${qty}${diceFaces}`;
    const bonusValue = Number(bonus) || 0;
    if (bonusValue !== 0) formula += ` + ${bonusValue}`;
    if (addSkill) {
      const skillName = getSkillDisplayName(skill);
      formula += ` + ${doubleSkill ? '2x' : ''}${skillName}`;
    }
    return formula;
  };

  const lifeEnergyEntries = [];
  if (item.system.hasHealthModifier) {
    lifeEnergyEntries.push({
      icon: 'icon-health.svg',
      alt: 'Vida',
      formula: buildLifeEnergyFormula(item.system.healthModifierDice, item.system.healthModifierQuantity, item.system.healthModifierAdditionalBonus, item.system.healthModifierAddSkill, item.system.healthModifierSkill, item.system.healthModifierDoubleSkill),
      isTemporary: item.system.healthModifierIsTemporary ?? false,
      isDecrease: item.system.healthModifierType === 'subtract',
      tempLabel: 'PVT'
    });
  }
  if (item.system.hasEnergyModifier) {
    lifeEnergyEntries.push({
      icon: 'icon-energy.svg',
      alt: 'Energia',
      formula: buildLifeEnergyFormula(item.system.energyModifierDice, item.system.energyModifierQuantity, item.system.energyModifierAdditionalBonus, item.system.energyModifierAddSkill, item.system.energyModifierSkill, item.system.energyModifierDoubleSkill),
      isTemporary: item.system.energyModifierIsTemporary ?? false,
      isDecrease: item.system.energyModifierType === 'subtract',
      tempLabel: 'PET'
    });
  }
  const lifeEnergyTooltipHtml = lifeEnergyEntries.length
    ? await foundry.applications.handlebars.renderTemplate('systems/cardigan/templates/tooltips/consumable-life-energy-tooltip.hbs', { entries: lifeEnergyEntries })
    : '';

  const effectsSectionEffects = Array.isArray(item.system.effectsSectionAddedEffects) ? item.system.effectsSectionAddedEffects : [];
  const effectsTooltipHtml = effectsSectionEffects.length
    ? await foundry.applications.handlebars.renderTemplate('systems/cardigan/templates/tooltips/consumable-effects-tooltip.hbs', { effects: effectsSectionEffects })
    : '';

  const skillTestOptions = [
    { key: 'accuracy', label: 'Precisão' },
    { key: 'evasion', label: 'Evasão' },
    { key: 'strength', label: 'Força' },
    { key: 'dexterity', label: 'Destreza' },
    { key: 'stamina', label: 'Vigor' },
    { key: 'persuasion', label: 'Persuasão' },
    { key: 'intelligence', label: 'Inteligência' },
    { key: 'stealth', label: 'Furtividade' }
  ];
  const skillTestEffects = Array.isArray(item.system.skillTestAddedEffects) ? item.system.skillTestAddedEffects : [];
  const rawSkillTestSkills = await item.getFlag('cardigan', 'skillTestAddedSkills');
  const skillTestSkills = (Array.isArray(rawSkillTestSkills) ? rawSkillTestSkills : [])
    .map(entry => {
      const key = typeof entry === 'string' ? entry : entry?.key;
      const skillData = skillTestOptions.find(option => option.key === key);
      if (!skillData) return null;
      const value = Number(entry?.skillValue ?? entry?.value ?? 0) || 0;
      return {
        label: skillData.label,
        displayValue: value > 0 ? `+${value}` : `${value}`,
        criticalFailure: Boolean(entry?.criticalFailure),
        criticalHit: Boolean(entry?.criticalHit)
      };
    })
    .filter(Boolean);
  const skillTestTooltipHtml = (skillTestEffects.length || skillTestSkills.length)
    ? await foundry.applications.handlebars.renderTemplate('systems/cardigan/templates/tooltips/consumable-skill-test-tooltip.hbs', { effects: skillTestEffects, skills: skillTestSkills })
    : '';

  return { lifeEnergyTooltipHtml, effectsTooltipHtml, skillTestTooltipHtml };
}
