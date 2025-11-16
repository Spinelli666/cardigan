export const CARDIGAN = {};

/**
 * The set of Ability Scores used within the system.
 * @type {Object}
 */
CARDIGAN.abilities = {
  accuracy: 'CARDIGAN.Ability.Accuracy.long',
  evasion: 'CARDIGAN.Ability.Evasion.long',
  strength: 'CARDIGAN.Ability.Strength.long',
  dexterity: 'CARDIGAN.Ability.Dexterity.long',
  stamina: 'CARDIGAN.Ability.Stamina.long',
  stealth: 'CARDIGAN.Ability.Stealth.long',
  persuasion: 'CARDIGAN.Ability.Persuasion.long',
  intelligence: 'CARDIGAN.Ability.Intelligence.long',
  psionics: 'CARDIGAN.Ability.Psionics.long',
};

CARDIGAN.abilityAbbreviations = {
  accuracy: 'CARDIGAN.Ability.Accuracy.abbr',
  evasion: 'CARDIGAN.Ability.Evasion.abbr',
  strength: 'CARDIGAN.Ability.Strength.abbr',
  dexterity: 'CARDIGAN.Ability.Dexterity.abbr',
  stamina: 'CARDIGAN.Ability.Stamina.abbr',
  stealth: 'CARDIGAN.Ability.Stealth.abbr',
  persuasion: 'CARDIGAN.Ability.Persuasion.abbr',
  intelligence: 'CARDIGAN.Ability.Intelligence.abbr',
  psionics: 'CARDIGAN.Ability.Psionics.abbr',
};

/**
 * The set of Skill Types used within the system.
 * @type {Object}
 */
CARDIGAN.skillTypes = {
  general: 'CARDIGAN.Item.Skill.Types.General',
  extra: 'CARDIGAN.Item.Skill.Types.Extra',
  active: 'CARDIGAN.Item.Skill.Types.Active',
  foco: 'CARDIGAN.Item.Skill.Types.Foco',
  deslocamento: 'CARDIGAN.Item.Skill.Types.Deslocamento',
  passiva: 'CARDIGAN.Item.Skill.Types.Passiva',
  simples: 'CARDIGAN.Item.Skill.Types.Simples',
  reacao: 'CARDIGAN.Item.Skill.Types.Reacao',
  postura: 'CARDIGAN.Item.Skill.Types.Postura'
};

/**
 * The set of Skill Classes used within the system.
 * @type {Object}
 */
CARDIGAN.skillClasses = {
  andarilho: 'CARDIGAN.Item.Skill.Classes.Andarilho',
  guerreiro: 'CARDIGAN.Item.Skill.Classes.Guerreiro',
  ladino: 'CARDIGAN.Item.Skill.Classes.Ladino',
  feiticeiro: 'CARDIGAN.Item.Skill.Classes.Feiticeiro',
  raciais: 'CARDIGAN.Item.Skill.Classes.Raciais',
  unicas: 'CARDIGAN.Item.Skill.Classes.Unicas'
};

/**
 * The set of Skill Ranks used within the system.
 * @type {Object}
 */
CARDIGAN.skillRanks = {
  untrained: 'CARDIGAN.Item.Skill.Ranks.untrained',
  trained: 'CARDIGAN.Item.Skill.Ranks.trained',
  proficient: 'CARDIGAN.Item.Skill.Ranks.proficient',
  expert: 'CARDIGAN.Item.Skill.Ranks.expert',
  master: 'CARDIGAN.Item.Skill.Ranks.master'
};

/**
 * The set of Effect Types used within the system.
 * @type {Object}
 */
CARDIGAN.efeitoTypes = {
  positivo: 'CARDIGAN.Item.Efeito.Types.Positivo',
  negativo: 'CARDIGAN.Item.Efeito.Types.Negativo'
};

/**
 * Register Handlebars helpers for the Cardigan system
 */
export function registerHandlebarsHelpers() {
  /**
   * Check if there are any ranged weapons in the weapons array
   * @param {Array} weapons - Array of weapon items
   * @returns {boolean} - True if at least one weapon has ranged: true
   */
  Handlebars.registerHelper('hasRangedWeapons', function(weapons) {
    if (!weapons || !Array.isArray(weapons)) return false;
    return weapons.some(weapon => weapon.system?.ranged === true);
  });

  /**
   * Generate weapon tooltip content with type icons, weight and name (text format for native tooltips)
   * @param {Object} weapon - Weapon item object
   * @returns {string} - Text string for weapon tooltip
   */
  Handlebars.registerHelper('weaponTooltipContent', function(weapon) {
    if (!weapon) return '';
    
    let content = '';
    
    // Add weapon type icons (using Unicode symbols for plain text tooltips)
    let typeIcons = '';
    if (weapon.system.melee && weapon.system.ranged) {
      typeIcons = '⚔️/🏹'; // Melee and ranged
    } else if (weapon.system.melee) {
      typeIcons = '⚔️'; // Only melee (sword)
    } else if (weapon.system.ranged) {
      typeIcons = '🏹'; // Only ranged (bow)
    } else {
      typeIcons = '❓'; // Unknown type
    }
    
    // Add weight icon
    const weightIcon = '🎒'; // Backpack icon
    const weightText = weapon.system.weight === 'leve' ? 'Leve' : 'Pesado';
    
    // Build the complete tooltip content with icons above the name
    content = `${typeIcons} ${weightIcon} ${weightText}\n${weapon.name}`;
    
    // Add description if available
    if (weapon.system.description) {
      content += `\n${weapon.system.description}`;
    }
    
    return content;
  });

  /**
   * Generate rich weapon tooltip HTML content synchronously
   * @param {Object} weapon - Weapon item object
   * @returns {string} - HTML string for weapon tooltip
   */
  Handlebars.registerHelper('weaponRichTooltipSync', function(weapon) {
    if (!weapon) return '';
    
    // Generate weapon type icons
    let typeIcons = '';
    if (weapon.system.melee && weapon.system.ranged) {
      typeIcons = '<i class="fas fa-fist-raised"></i><span class="separator">/</span><i class="fas fa-bullseye"></i>';
    } else if (weapon.system.melee) {
      typeIcons = '<i class="fas fa-fist-raised"></i>';
    } else if (weapon.system.ranged) {
      typeIcons = '<i class="fas fa-bullseye"></i>';
    } else {
      typeIcons = '<i class="fas fa-question" style="opacity: 0.5;"></i>';
    }
    
    // Generate weight info
    const weightText = weapon.system.weight === 'leve' ? 'Leve' : 'Pesado';
    const weightHTML = '<i class="fas fa-backpack"></i><span>' + weightText + '</span>';
    
    // Build complete tooltip HTML
    let html = '<div class="weapon-tooltip">';
    html += '<div class="weapon-image"><img src="' + weapon.img + '" alt="' + weapon.name + '" /></div>';
    html += '<div class="weapon-name-line"><strong>' + weapon.name + '</strong></div>';
    html += '<div class="weapon-properties-line">';
    html += '<div class="weapon-type-icons">' + typeIcons + '</div>';
    html += '<div class="weapon-weight">' + weightHTML + '</div>';
    html += '</div>';
    
    if (weapon.system.description) {
      html += '<div class="weapon-description"><em>' + weapon.system.description + '</em></div>';
    }
    
    html += '</div>';
    
    return new Handlebars.SafeString(html);
  });

  /**
   * Generate rich weapon tooltip content using template (for future advanced tooltips)
   * @param {Object} weapon - Weapon item object
   * @returns {Promise<string>} - HTML string for weapon tooltip
   */
  Handlebars.registerHelper('weaponRichTooltip', async function(weapon) {
    if (!weapon) return '';
    
    try {
      const templatePath = 'systems/cardigan/templates/tooltips/weapon-tooltip.hbs';
      const content = await foundry.applications.handlebars.renderTemplate(templatePath, { weapon });
      return new Handlebars.SafeString(content);
    } catch (error) {
      console.warn('Failed to render weapon tooltip template:', error);
      // Fallback to simple text
      return weapon.name;
    }
  });

  /**
   * Generate simple armor tooltip content (similar to weaponTooltip but for armors)
   * @param {Object} armor - Armor item object
   * @returns {string} - HTML string for armor tooltip
   */
  Handlebars.registerHelper('armorTooltip', function(armor) {
    if (!armor) return '';
    
    // Generate weight info
    const weightText = armor.system.weight === 'leve' ? 'Leve' : 'Pesado';
    const weightHTML = '<i class="fas fa-backpack"></i><span>' + weightText + '</span>';
    
    // Build complete tooltip HTML
    let html = '<div class="armor-tooltip">';
    html += '<div class="armor-image"><img src="' + armor.img + '" alt="' + armor.name + '" /></div>';
    html += '<div class="armor-name-line"><strong>' + armor.name + '</strong></div>';
    html += '<div class="armor-properties-line">';
    html += '<div class="armor-weight">' + weightHTML + '</div>';
    html += '</div>';
    
    if (armor.system.description) {
      html += '<div class="armor-description"><em>' + armor.system.description + '</em></div>';
    }
    
    html += '</div>';
    
    return new Handlebars.SafeString(html);
  });

  /**
   * Generate rich armor tooltip content using template (for future advanced tooltips)
   * @param {Object} armor - Armor item object
   * @returns {Promise<string>} - HTML string for armor tooltip
   */
  Handlebars.registerHelper('armorRichTooltip', async function(armor) {
    if (!armor) return '';
    
    try {
      const templatePath = 'systems/cardigan/templates/tooltips/armor-tooltip.hbs';
      const content = await foundry.applications.handlebars.renderTemplate(templatePath, { armor });
      return new Handlebars.SafeString(content);
    } catch (error) {
      console.warn('Failed to render armor tooltip template:', error);
      // Fallback to simple text
      return armor.name;
    }
  });

  /**
   * Capitalize the first letter of a string
   * @param {string} str - String to capitalize
   * @returns {string} - Capitalized string
   */
  Handlebars.registerHelper('capitalize', function(str) {
    if (typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  /**
   * Concatenate strings
   * @param {...string} args - Strings to concatenate
   * @returns {string} - Concatenated string
   */
  Handlebars.registerHelper('concat', function(...args) {
    // Remove the last argument which is the Handlebars options object
    args.pop();
    return args.join('');
  });

  /**
   * Check if player has sufficient ingredient quantity
   * @param {string} ingredientName - Name of the ingredient to check
   * @param {number} requiredQuantity - Required quantity for the recipe
   * @param {Object} options - Handlebars options object containing context
   * @returns {boolean} - True if player has enough of the ingredient
   */
  Handlebars.registerHelper('hasEnoughIngredient', function(ingredientName, requiredQuantity, options) {
    // Get the actor from the template context
    const actor = options.data.root.actor;
    if (!actor || !actor.items) {
      return false;
    }

    // Normalize ingredient name for comparison (lowercase, trim spaces)
    const normalizedIngredientName = ingredientName.toLowerCase().trim();
    
    // Find all items with matching name in the actor's inventory
    let totalQuantity = 0;
    
    // Check all items in the actor's inventory
    const matchingItems = actor.items.filter(item => {
      const itemName = (item.name || '').toLowerCase().trim();
      return itemName === normalizedIngredientName;
    });
    
    matchingItems.forEach(item => {
      const quantity = item.system?.quantity || 0;
      totalQuantity += quantity;
    });

    return totalQuantity >= requiredQuantity;
  });
}
