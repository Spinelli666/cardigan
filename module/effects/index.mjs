/**
 * Central export point for the effects system
 */

export { default as BaseEffect } from './base-effect.mjs';
export { default as EffectManager } from './effect-manager.mjs';

// Export custom effect implementations
export { default as VelozEffect } from './effects/veloz.mjs';
export { default as ImparavelEffect } from './effects/imparavel.mjs';
export { default as PersistenciaEffect } from './effects/persistencia.mjs';

/**
 * Initialize the effects system
 * This should be called during system initialization (init hook)
 */
export async function initializeEffects() {
  // Import custom effects and register them
  const VelozEffect = (await import('./effects/veloz.mjs')).default;
  const ImparavelEffect = (await import('./effects/imparavel.mjs')).default;
  const PersistenciaEffect = (await import('./effects/persistencia.mjs')).default;
  const { default: EffectManager } = await import('./effect-manager.mjs');
  
  EffectManager.register('Veloz', VelozEffect);
  EffectManager.register('Imparável', ImparavelEffect);
  EffectManager.register('Persistência', PersistenciaEffect);
  
  console.log('[Effects System] Initialized with custom effects:', Array.from(EffectManager.getRegisteredEffects()));
}

// etc...
