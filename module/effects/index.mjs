/**
 * Central export point for the effects system
 */

export { default as BaseEffect } from './base-effect.mjs';
export { default as EffectManager } from './effect-manager.mjs';

// Export custom effect implementations
export { default as ImparavelEffect } from './effects/imparavel.mjs';
export { default as PersistenciaEffect } from './effects/persistencia.mjs';
export { FraturaEffect } from './effects/fratura.mjs';
export { ExaustaoEffect } from './effects/exaustao.mjs';
export { SangramentoEffect } from './effects/sangramento.mjs';

/**
 * Initialize the effects system
 * This should be called during system initialization (init hook)
 */
export async function initializeEffects() {
  // Import custom effects and register them
  const ImparavelEffect = (await import('./effects/imparavel.mjs')).default;
  const PersistenciaEffect = (await import('./effects/persistencia.mjs')).default;
  const { FraturaEffect } = await import('./effects/fratura.mjs');
  const { ExaustaoEffect } = await import('./effects/exaustao.mjs');
  const { SangramentoEffect } = await import('./effects/sangramento.mjs');
  const { default: EffectManager } = await import('./effect-manager.mjs');
  
  EffectManager.register('Imparável', ImparavelEffect);
  EffectManager.register('Persistência', PersistenciaEffect);
  EffectManager.register('Fratura', FraturaEffect);
  EffectManager.register('Exaustão', ExaustaoEffect);
  EffectManager.register('Sangramento', SangramentoEffect);
  
  // Register Sangramento hooks for ability rolls
  SangramentoEffect.registerHooks();
  
  console.log('[Effects System] Initialized with custom effects:', Array.from(EffectManager.getRegisteredEffects()));
}

// etc...
