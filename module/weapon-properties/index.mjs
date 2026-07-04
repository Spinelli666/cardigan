import { WeaponPropertyManager } from './weapon-property-manager.mjs';

export { BaseWeaponProperty } from './base-weapon-property.mjs';
export { WeaponPropertyManager } from './weapon-property-manager.mjs';

// Import individual property implementations
import { Certeiro } from './properties/precise.mjs';
import { Vorpal } from './properties/vorpal.mjs';
import { Ferir } from './properties/wound.mjs';
import { Traspassar } from './properties/pierce.mjs';
import { Contundente } from './properties/blunt.mjs';
import { Incendiar } from './properties/ignite.mjs';
import { Eletrocutar } from './properties/electrocute.mjs';
import { Impacto } from './properties/impact.mjs';
// import { Perfurar } from './properties/perfurar.mjs';
// import { Incendiar } from './properties/ignite.mjs';
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
  WeaponPropertyManager.register(Ferir);
  WeaponPropertyManager.register(Traspassar);
  WeaponPropertyManager.register(Contundente);
  WeaponPropertyManager.register(Incendiar);
  WeaponPropertyManager.register(Eletrocutar);
  WeaponPropertyManager.register(Impacto);
  // WeaponPropertyManager.register(Perfurar);
  // WeaponPropertyManager.register(Incendiar);
  // WeaponPropertyManager.register(Eletrecutar);
  // WeaponPropertyManager.register(Colateral);
  
  console.log('[CARDIGAN] Weapon properties system initialized');
}
