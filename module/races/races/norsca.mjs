import BaseRace from '../base-race.mjs';

/**
 * Norsca Race Implementation
 * Applies "Sangue de Gigante" passive: +2 natural armor
 */
export class NorscaRace extends BaseRace {
  static raceName = 'Norsca';
  static NATURAL_ARMOR_BONUS = 1;

  /**
   * Apply Norsca racial bonuses when race is added to actor
   * @param {Actor} actor - The actor receiving the race
   */
  async onAdd(actor) {
    console.log(`[${NorscaRace.raceName}] Applying racial bonuses to ${actor.name}`);

    // Find the Norsca race item on the actor
    const raceItem = actor.items.find(item => item.type === 'race' && item.name === NorscaRace.raceName);
    
    if (raceItem) {
      // Set the armorBonus field on the race item
      await raceItem.update({
        'system.armorBonus': NorscaRace.NATURAL_ARMOR_BONUS
      });
      console.log(`[${NorscaRace.raceName}] Applied +${NorscaRace.NATURAL_ARMOR_BONUS} natural armor to ${actor.name}`);
    } else {
      console.warn(`[${NorscaRace.raceName}] Could not find race item on actor ${actor.name}`);
    }
  }

  /**
   * Remove Norsca racial bonuses when race is removed from actor
   * @param {Actor} actor - The actor losing the race
   */
  async onRemove(actor) {
    console.log(`[${NorscaRace.raceName}] Removing racial bonuses from ${actor.name}`);
    // No need to do anything - when the race item is deleted, the armorBonus will be removed automatically
    console.log(`[${NorscaRace.raceName}] Race removed from ${actor.name}`);
  }
}
