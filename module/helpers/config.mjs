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
}
