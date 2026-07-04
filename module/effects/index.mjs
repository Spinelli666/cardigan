/**
 * Central export point for the effects system
 */

export { default as BaseEffect } from './base-effect.mjs';
export { default as EffectManager } from './effect-manager.mjs';

// Export custom effect implementations
export { default as ImparavelEffect } from './effects/unstoppable.mjs';
export { default as PersistenciaEffect } from './effects/persistence.mjs';
export { FraturaEffect } from './effects/fracture.mjs';
export { ExaustaoEffect } from './effects/exhaustion.mjs';
export { ToxicidadeEffect } from './effects/toxicity.mjs';
export { SangramentoEffect } from './effects/bleeding.mjs';
export { IncendiadoEffect } from './effects/burning.mjs';
export { EletrocutadoEffect } from './effects/electrocuted.mjs';
export { CongeladoEffect } from './effects/frozen.mjs';
export { AmaldicoadoEffect } from './effects/cursed.mjs';
export { PetrificadoEffect } from './effects/petrified.mjs';
export { default as LentoEffect } from './effects/slowed.mjs';
export { EnvenenadoEffect } from './effects/poisoned.mjs';

/**
 * Initialize the effects system
 * This should be called during system initialization (init hook)
 */
export async function initializeEffects() {
  // Import custom effects and register them
  const ImparavelEffect = (await import('./effects/unstoppable.mjs')).default;
  const PersistenciaEffect = (await import('./effects/persistence.mjs')).default;
  const { FraturaEffect } = await import('./effects/fracture.mjs');
  const { ExaustaoEffect } = await import('./effects/exhaustion.mjs');
  const { ToxicidadeEffect } = await import('./effects/toxicity.mjs');
  const { SangramentoEffect } = await import('./effects/bleeding.mjs');
  const { IncendiadoEffect } = await import('./effects/burning.mjs');
  const { EletrocutadoEffect } = await import('./effects/electrocuted.mjs');
  const { CongeladoEffect } = await import('./effects/frozen.mjs');
  const { AmaldicoadoEffect } = await import('./effects/cursed.mjs');
  const { PetrificadoEffect } = await import('./effects/petrified.mjs');
  const LentoEffect = (await import('./effects/slowed.mjs')).default;
  const { EnvenenadoEffect } = await import('./effects/poisoned.mjs');
  const { default: EffectManager } = await import('./effect-manager.mjs');
  
  EffectManager.register('Imparável', ImparavelEffect);
  EffectManager.register('Persistência', PersistenciaEffect);
  EffectManager.register('Fratura', FraturaEffect);
  EffectManager.register('Exaustão', ExaustaoEffect);
  EffectManager.register('Toxicidade', ToxicidadeEffect);
  EffectManager.register('Sangramento', SangramentoEffect);
  EffectManager.register('Incendiado', IncendiadoEffect);
  EffectManager.register('Eletrocutado', EletrocutadoEffect);
  EffectManager.register('Congelado', CongeladoEffect);
  EffectManager.register('Amaldiçoado', AmaldicoadoEffect);
  EffectManager.register('Petrificado', PetrificadoEffect);
  EffectManager.register('Lento', LentoEffect);
  EffectManager.register('Envenenado', EnvenenadoEffect);
  
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
  
  // Register Envenenado hooks for toxicity management
  EnvenenadoEffect.registerHooks();
  
  console.log('[Effects System] Initialized with custom effects:', Array.from(EffectManager.getRegisteredEffects()));
}

// etc...
