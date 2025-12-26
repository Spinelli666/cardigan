import { WeaponPropertyManager } from './weapon-property-manager.mjs';

export { BaseWeaponProperty } from './base-weapon-property.mjs';
export { WeaponPropertyManager } from './weapon-property-manager.mjs';

// Import individual property implementations
import { Certeiro } from './properties/certeiro.mjs';
import { Vorpal } from './properties/vorpal.mjs';
// import { Perfurar } from './properties/perfurar.mjs';
// import { Incendiar } from './properties/incendiar.mjs';
// import { Eletrecutar } from './properties/eletrecutar.mjs';
// import { Colateral } from './properties/colateral.mjs';

/**
 * Initialize weapon properties system
 */
export function initializeWeaponProperties() {
  console.log('[CARDIGAN] Initializing weapon properties system...');
  
  // Register property implementations here
  WeaponPropertyManager.register(Certeiro);
  WeaponPropertyManager.register(Vorpal);
  // WeaponPropertyManager.register(Perfurar);
  // WeaponPropertyManager.register(Incendiar);
  // WeaponPropertyManager.register(Eletrecutar);
  // WeaponPropertyManager.register(Colateral);
  
  console.log('[CARDIGAN] Weapon properties system initialized');
}
