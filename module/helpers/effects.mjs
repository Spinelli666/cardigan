/**
 * Prepare the data structure for Active Effects which are currently embedded in an Actor or Item.
 * @param {ActiveEffect[]} effects    A collection or generator of Active Effect documents to prepare sheet data for
 * @return {object}                   Data for rendering
 */
export function prepareActiveEffectCategories(effects) {
  // Define single effect category - simplified approach
  const categories = {
    effects: {
      type: 'effects',
      label: game.i18n.localize('CARDIGAN.Effect.Effects'),
      effects: [],
    },
  };

  // Add all effects to the single category, sorted by active/inactive
  for (const e of effects) {
    categories.effects.effects.push(e);
  }

  // Sort effects - active effects first, then by name
  categories.effects.effects.sort((a, b) => {
    // First sort by disabled status (active effects first)
    if (a.disabled !== b.disabled) {
      return a.disabled ? 1 : -1;
    }
    // Then sort by name
    return (a.name || '').localeCompare(b.name || '');
  });

  return categories;
}
