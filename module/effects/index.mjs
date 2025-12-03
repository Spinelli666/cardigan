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
export { IncendiadoEffect } from './effects/incendiado.mjs';
export { EletrocutadoEffect } from './effects/eletrocutado.mjs';
export { CongeladoEffect } from './effects/congelado.mjs';
export { AmaldicoadoEffect } from './effects/amaldicoado.mjs';
export { PetrificadoEffect } from './effects/petrificado.mjs';
export { default as LentoEffect } from './effects/lento.mjs';

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
  const { IncendiadoEffect } = await import('./effects/incendiado.mjs');
  const { EletrocutadoEffect } = await import('./effects/eletrocutado.mjs');
  const { CongeladoEffect } = await import('./effects/congelado.mjs');
  const { AmaldicoadoEffect } = await import('./effects/amaldicoado.mjs');
  const { PetrificadoEffect } = await import('./effects/petrificado.mjs');
  const LentoEffect = (await import('./effects/lento.mjs')).default;
  const { default: EffectManager } = await import('./effect-manager.mjs');
  
  EffectManager.register('Imparável', ImparavelEffect);
  EffectManager.register('Persistência', PersistenciaEffect);
  EffectManager.register('Fratura', FraturaEffect);
  EffectManager.register('Exaustão', ExaustaoEffect);
  EffectManager.register('Sangramento', SangramentoEffect);
  EffectManager.register('Incendiado', IncendiadoEffect);
  EffectManager.register('Eletrocutado', EletrocutadoEffect);
  EffectManager.register('Congelado', CongeladoEffect);
  EffectManager.register('Amaldiçoado', AmaldicoadoEffect);
  EffectManager.register('Petrificado', PetrificadoEffect);
  EffectManager.register('Lento', LentoEffect);
  
  // Register Sangramento hooks for ability rolls
  SangramentoEffect.registerHooks();
  
  // Register Incendiado hooks for combat turns
  IncendiadoEffect.registerHooks();
  
  // Register Eletrocutado hooks for effect application
  EletrocutadoEffect.registerHooks();
  
  // Register Congelado hooks for combat turns
  CongeladoEffect.registerHooks();
  
  // Register Amaldiçoado hooks for combat turns
  AmaldicoadoEffect.registerHooks();
  
  // Register Petrificado hooks for armor bonus modification
  PetrificadoEffect.registerHooks();
  
  // Register Lento hooks for movement penalty
  LentoEffect.register();
  
  console.log('[Effects System] Initialized with custom effects:', Array.from(EffectManager.getRegisteredEffects()));
}

// etc...
