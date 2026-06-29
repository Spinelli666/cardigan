/**
 * Header Context Module
 * Prepares context data for the actor sheet header
 */
export class HeaderContext {
  
  /**
   * Prepare header-specific context data
   * @param {Object} context - The base context object
   * @param {Actor} actor - The actor document
   * @returns {Object} - Enhanced context with header data
   */
  static prepareHeaderData(context, actor) {
    const system = actor.system;
    
    // Prepare health data
    context.health = {
      value: system.health?.value || 0,
      max: system.health?.max || 0,
      percentage: system.health?.max > 0 
        ? Math.round((system.health.value / system.health.max) * 100) 
        : 0
    };
    
    // Prepare power/energy data
    context.power = {
      value: system.power?.value || 0,
      max: system.power?.max || 0,
      percentage: system.power?.max > 0 
        ? Math.round((system.power.value / system.power.max) * 100) 
        : 0
    };
    
    // Prepare level data
    context.level = {
      value: system.attributes?.level?.value || 0,
      canLevelUp: HeaderContext.canLevelUp(actor)
    };
    
    // Prepare XP data
    context.experience = {
      current: system.experience?.current || 0,
      nextLevel: system.experience?.nextLevel || 100,
      percentage: system.experience?.nextLevel > 0 
        ? Math.round((system.experience.current / system.experience.nextLevel) * 100) 
        : 0
    };
    
    // Prepare race data
    context.race = {
      name: system.details?.race || "Sem Raça",
      hasRace: !!system.details?.race
    };
    
    // Prepare status flags
    context.status = {
      canCreateCharacter: system.attributes?.level?.value === 0,
      canRest: true, // Could add conditions here
      hasEffects: actor.items.filter(i => i.type === "efeito").length > 0
    };
    
    // Prepare armor class / defense data
    context.defense = {
      value: system.defense?.value || 0,
      armor: system.defense?.armor || 0,
      bonus: system.defense?.bonus || 0
    };
    
    return context;
  }
  
  /**
   * Check if the actor can level up
   * @param {Actor} actor - The actor to check
   * @returns {boolean} - True if actor has enough XP to level up
   */
  static canLevelUp(actor) {
    const currentLevel = actor.system.attributes?.level?.value || 0;
    const currentXP = actor.system.experience?.current || 0;
    const nextLevelXP = actor.system.experience?.nextLevel || 100;
    
    // Level 0 characters should use character creation wizard
    if (currentLevel === 0) return false;
    
    // Check if has enough XP
    return currentXP >= nextLevelXP;
  }
  
  /**
   * Prepare abilities data for header display
   * @param {Object} context - The context object
   * @param {Actor} actor - The actor document
   * @returns {Object} - Enhanced context with abilities data
   */
  static prepareAbilitiesData(context, actor) {
    const abilities = actor.system.abilities || {};
    
    context.abilities = {
      strength: HeaderContext.formatAbility(abilities.strength),
      dexterity: HeaderContext.formatAbility(abilities.dexterity),
      intelligence: HeaderContext.formatAbility(abilities.intelligence),
      stamina: HeaderContext.formatAbility(abilities.stamina),
      willpower: HeaderContext.formatAbility(abilities.willpower),
      perception: HeaderContext.formatAbility(abilities.perception)
    };
    
    return context;
  }
  
  /**
   * Format a single ability for display
   * @param {Object} ability - The ability data
   * @returns {Object} - Formatted ability data
   */
  static formatAbility(ability) {
    if (!ability) {
      return {
        value: 0,
        bonus: 0,
        total: 0,
        mod: 0
      };
    }
    
    return {
      value: ability.value || 0,
      bonus: ability.totalBonus || 0,
      total: (ability.value || 0) + (ability.totalBonus || 0),
      mod: ability.mod || 0
    };
  }
  
  /**
   * Prepare status effects data
   * @param {Object} context - The context object
   * @param {Actor} actor - The actor document
   * @returns {Object} - Enhanced context with status data
   */
  static prepareStatusData(context, actor) {
    const status = actor.system.status || {};
    
    context.statusEffects = {
      giftOfLife: {
        value: status.giftOfLife || 0,
        max: 3,
        canReset: status.giftOfLife > 0
      },
      deathSentence: {
        value: status.deathSentence || 0,
        max: 3,
        canReset: status.deathSentence > 0
      },
      sanity: {
        value: status.sanity || 0,
        hasEffect: status.sanity > 0
      },
      toxicity: {
        value: status.toxicity || 0,
        hasEffect: status.toxicity > 0
      },
      fracture: {
        value: status.fracture || 0,
        hasEffect: status.fracture > 0
      },
      hunger: {
        value: status.hunger || false
      },
      thirst: {
        value: status.thirst || false
      }
    };
    
    return context;
  }
}
