/**
 * Skills Module - Barrel Export
 * Centralizes all skill-related exports for easy importing
 */

// Base classes and managers
export { BaseSkill } from './base-skill.mjs';
export { SkillManager } from './skill-manager.mjs';

// Individual skill implementations
// (Skills customizadas serão adicionadas aqui no futuro)

/**
 * Initialize all skills and register them with the SkillManager
 * This function should be called during system initialization
 * @returns {Promise<void>}
 */
export async function initializeSkillsSystem() {
  
  try {
    // Register all skills with the manager
    const { SkillManager } = await import('./skill-manager.mjs');
    
    // Register custom skills here when created
    // Example:
    // const { CustomSkill } = await import('./skills/custom-skill.mjs');
    // SkillManager.registerSkill(CustomSkill);
    
    // Initialize the skill system
    await SkillManager.initialize();
    
    console.log('[CARDIGAN] Skills System initialized successfully');
    
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