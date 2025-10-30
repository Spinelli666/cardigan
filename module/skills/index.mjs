/**
 * Skills Module - Barrel Export
 * Centralizes all skill-related exports for easy importing
 */

// Base classes and managers
export { BaseSkill } from './base-skill.mjs';
export { SkillManager } from './skill-manager.mjs';

// Individual skill implementations
export { AcertoDebilitanteSkill } from './skills/acerto-debilitante.mjs';

/**
 * Initialize all skills and register them with the SkillManager
 * This function should be called during system initialization
 * @returns {Promise<void>}
 */
export async function initializeSkillsSystem() {
  
  try {
    // Register all skills with the manager
    const { SkillManager } = await import('./skill-manager.mjs');
    const { AcertoDebilitanteSkill } = await import('./skills/acerto-debilitante.mjs');
    
    // Register skills
    SkillManager.registerSkill(AcertoDebilitanteSkill);
    
    // Initialize the skill system
    await SkillManager.initialize();
    
    
  } catch (error) {
    console.error('[CARDIGAN] Failed to initialize Skills System:', error);
    throw error;
  }
}

/**
 * Get the SkillManager instance
 * @returns {SkillManager}
 */
export async function getSkillManager() {
  const { SkillManager } = await import('./skill-manager.mjs');
  return SkillManager;
}