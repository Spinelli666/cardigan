/**
 * Central export point for the races system
 */

export { default as BaseRace } from './base-race.mjs';
export { default as RaceManager } from './race-manager.mjs';

// Export custom race implementations
export { NorscaRace } from './races/norsca.mjs';

/**
 * Initialize the races system
 * This should be called during system initialization (init hook)
 */
export async function initializeRaces() {
  console.log('[CARDIGAN] Initializing Races System...');
  
  // Import custom races and register them
  const { NorscaRace } = await import('./races/norsca.mjs');
  const { default: RaceManager } = await import('./race-manager.mjs');
  
  RaceManager.register('Norsca', NorscaRace);
  
  console.log('[CARDIGAN] Races System initialized successfully');
  console.log('[CARDIGAN] Registered races:', RaceManager.getRegisteredRaces());
}
