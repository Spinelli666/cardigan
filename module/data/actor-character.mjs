import CardiganSystemActorBase from './base-actor.mjs';

export default class CardiganSystemCharacter extends CardiganSystemActorBase {
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    'CARDIGAN.Actor.Character',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.attributes = new fields.SchemaField({
      level: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      }),
    });

    schema.abilities = new fields.SchemaField(
      Object.keys(CONFIG.CARDIGAN.abilities).reduce((obj, ability) => {
        obj[ability] = new fields.SchemaField({
          value: new fields.NumberField({
            ...requiredInteger,
            initial: 0,
          }),
          bonus: new fields.NumberField({
            initial: 0,
            integer: true
          }),
          manualValue: new fields.NumberField({
            initial: 0,
            integer: true
          }),
          manualBonus: new fields.NumberField({
            initial: 0,
            integer: true
          }),
          baseValue: new fields.NumberField({
            initial: 0,
            integer: true
          }),
        });
        return obj;
      }, {})
    );

    schema.status = new fields.SchemaField({
      hunger: new fields.NumberField({ initial: 0, min: 0, max: 3, integer: true }),
      thirst: new fields.NumberField({ initial: 0, min: 0, max: 3, integer: true }),
      fracture: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }),
      giftOfLife: new fields.NumberField({ initial: null, min: 0, max: 3, integer: true }),
      deathSentence: new fields.NumberField({ initial: null, min: 0, max: 3, integer: true }),
      sanity: new fields.NumberField({ initial: null, min: 0, max: 5, integer: true }),
      toxicity: new fields.NumberField({ initial: null, min: 0, max: 5, integer: true }),
      healthBonus: new fields.NumberField({ initial: 0, integer: true }),
      energyBonus: new fields.NumberField({ initial: 0, integer: true }),
      armorBonusManual: new fields.NumberField({ initial: 0, integer: true }),
      armorBonus: new fields.NumberField({ initial: 0, integer: true })
    });

    // Temporary effects for health bonuses from consumables
    schema.temporaryEffects = new fields.ArrayField(
      new fields.SchemaField({
        id: new fields.StringField({ required: true }),
        name: new fields.StringField({ required: true }),
        healthBonus: new fields.NumberField({ required: true, integer: true }),
        source: new fields.StringField({ required: true }),
        sourceId: new fields.StringField({ required: true }),
        formula: new fields.StringField({ required: true }),
        timestamp: new fields.NumberField({ required: true, integer: true })
      }),
      { initial: [] }
    );

    schema.details = new fields.SchemaField({
      name: new fields.StringField({ initial: "" }),
      age: new fields.NumberField({ initial: 0, integer: true }),
      race: new fields.StringField({ initial: "" }),
      movement: new fields.NumberField({ initial: 0, integer: true }),
      movementManual: new fields.NumberField({ initial: 0, integer: true }),
      criticalHit: new fields.NumberField({ initial: 20, integer: true }),
      criticalHitManual: new fields.NumberField({ initial: 0, integer: true }),
      additionalNotes: new fields.StringField({ initial: "" }),
      showAdditionalNotes: new fields.BooleanField({ initial: true }),
      showEffectsTab: new fields.BooleanField({ initial: true }),
      showBackpackContainer: new fields.BooleanField({ initial: false }),
      showWeaponsTable: new fields.BooleanField({ initial: true }),
      showCulinaryTable: new fields.BooleanField({ initial: false }),
      showTailoringTable: new fields.BooleanField({ initial: false }),
      showTecnomagicTable: new fields.BooleanField({ initial: false }),
      showBlacksmithingTable: new fields.BooleanField({ initial: false }),
      showAlchemyTable: new fields.BooleanField({ initial: false }),
      showSkillsAndarilhoTable: new fields.BooleanField({ initial: false }),
      showSkillsGuerreiroTable: new fields.BooleanField({ initial: false }),
      showSkillsLadinoTable: new fields.BooleanField({ initial: false }),
      showSkillsFeiticeiroTable: new fields.BooleanField({ initial: false }),
      showSkillsRaciaisTable: new fields.BooleanField({ initial: false }),
      showSkillsUnicasTable: new fields.BooleanField({ initial: false })
    });

    return schema;
  }

  prepareDerivedData() {
    // Prepare level and experience progression
    this._prepareLevelAndExperience();
    
    // Calculate race bonuses FIRST and apply to baseValue
    this._calculateRaceBonuses();

    // Prepare all ability scores (labels, values, bonuses)
    this._prepareAbilities();

    // Calculate weapon skill bonuses and add to abilities
    this._calculateWeaponSkillBonuses();
    
    // Calculate armor system bonuses (protection, health, energy, movement, backpack, skill bonuses)
    this._prepareArmorSystem();
    
    // Recalculate ability totals after all bonuses have been applied
    this._updateAbilityTotals();

    // Calculate health, energy, armor and backpack resources
    this._prepareHealthAndEnergy();

    // Calculate critical hit threshold
    this._prepareCriticalHit();

    // Calculate movement
    this._prepareMovement();

    // Prepare status resources (Hunger, Thirst, Sanity, Toxicity)
    this._prepareStatusResources();
  }

  /**
   * Calculate race bonuses and apply to abilities' baseValue (adds to wizard points)
   * @private
   */
  _calculateRaceBonuses() {
    const raceItem = this.parent?.items?.find(item => item.type === 'race');
    
    const wizardPoints = {};
    for (const key in this.abilities) {
      wizardPoints[key] = this.abilities[key].baseValue || 0;
    }
    
    if (!raceItem) {
      this._raceMovementBonus = 0;
      this._raceHealthBonus = 0;
      this._racePowerBonus = 0;
      this._raceArmorBonus = 0;
      return;
    }
    
    const abilityModifiers = raceItem.system.abilityModifiers || {};
    for (const key in this.abilities) {
      const raceModifier = abilityModifiers[key] || 0;
      this.abilities[key].baseValue = wizardPoints[key] + raceModifier;
    }
    
    this._raceMovementBonus = raceItem.system.movementBonus || 0;
    this._raceHealthBonus = raceItem.system.healthBonus || 0;
    this._racePowerBonus = raceItem.system.powerBonus || 0;
    this._raceArmorBonus = raceItem.system.armorBonus || 0;
  }

  /**
   * Localize ability labels and calculate values (baseValue + manualValue)
   * @private
   */
  _prepareAbilities() {
    for (const key in this.abilities) {
      this.abilities[key].label =
        game.i18n.localize(CONFIG.CARDIGAN.abilities[key]) ?? key;
        
      const baseValue = this.abilities[key].baseValue || 0;
      const manualValue = this.abilities[key].manualValue || 0;
      this.abilities[key].value = baseValue + manualValue;
    }
  }

  /**
   * Recalculate ability totals (value + totalBonus) after all bonuses applied
   * @private
   */
  _updateAbilityTotals() {
    for (const key in this.abilities) {
      const baseValue = this.abilities[key].value || 0;
      const totalBonus = this.abilities[key].totalBonus || 0;
      this.abilities[key].total = baseValue + totalBonus;
    }
  }

  /**
   * Calculate and apply skill bonuses from equipped weapons (cumulative)
   * @private
   */
  _calculateWeaponSkillBonuses() {
    const weaponBonuses = {};
    for (const key in this.abilities) {
      weaponBonuses[key] = 0;
    }

    const weapons = this.parent?.items?.filter(item => item.type === 'arma') || [];
    
    for (const weapon of weapons) {
      const isEquipped = weapon.system.rightHand || weapon.system.leftHand;
      if (!isEquipped) continue;
      
      const currentDurability = weapon.system.durability?.current ?? 0;
      if (currentDurability <= 0) continue;
      
      const skillBonuses = weapon.system.skillBonuses || [];
      
      for (const skillBonus of skillBonuses) {
        const skill = skillBonus.skill;
        const bonus = skillBonus.bonus || 0;
        
        if (!skill || bonus === 0) continue;
        
        if (weaponBonuses.hasOwnProperty(skill)) {
          weaponBonuses[skill] += bonus;
        }
      }
    }

    for (const key in this.abilities) {
      const manualBonus = this.abilities[key].manualBonus || 0;
      const weaponBonus = weaponBonuses[key] || 0;
      
      this.abilities[key].weaponBonus = weaponBonus;
      this.abilities[key].totalBonus = manualBonus + weaponBonus;
    }

    for (const key in this.abilities) {
      const baseValue = this.abilities[key].value || 0;
      const totalBonus = this.abilities[key].totalBonus || 0;
      this.abilities[key].total = baseValue + totalBonus;
    }
  }

  /**
   * Calculate all armor bonuses (protection, health, energy, movement, backpack, skills)
   * @private
   */
  _prepareArmorSystem() {
    this._calculateArmorBonuses();
  }

  /**
   * Calculate critical hit threshold: 20 - (Dex÷3) - Certeiro + manual
   * @private
   */
  _prepareCriticalHit() {
    const dexterity = this.abilities?.dexterity?.value ?? 0;
    const dexterityTotalBonus = this.abilities?.dexterity?.totalBonus ?? 0;
    const totalDexterity = dexterity + dexterityTotalBonus;
    
    const dexterityCriticalEffect = Math.floor(totalDexterity / 3);
    
    let certeiroCriticalBonus = 0;
    const weapons = this.parent?.items?.filter(item => item.type === 'arma') || [];
    
    for (const weapon of weapons) {
      const isEquipped = weapon.system.rightHand || weapon.system.leftHand;
      if (!isEquipped) continue;
      
      const currentDurability = weapon.system.durability?.current ?? 0;
      if (currentDurability <= 0) continue;
      
      if (weapon.system.properties?.includes('certeiro')) {
        certeiroCriticalBonus -= 1;
      }
    }
    
    const autoValue = Math.max(1, 20 - dexterityCriticalEffect + certeiroCriticalBonus);
    const manualValue = this.details.criticalHitManual ?? 0;
    this.details.criticalHit = autoValue + manualValue;
  }

  /**
   * Calculate movement: Dex÷2 + armor + race + manual
   * @private
   */
  _prepareMovement() {
    const totalDexterity = this._getTotalAbility('dexterity');
    const dexterityMovement = Math.floor(totalDexterity / 2);
    
    const armorMovementBonus = this._armorMovementBonus ?? 0;
    const raceMovementBonus = this._raceMovementBonus ?? 0;
    const manualMovement = this.details.movementManual ?? 0;
    
    this.details.movement = dexterityMovement + armorMovementBonus + raceMovementBonus + manualMovement;
  }

  /**
   * Set status messages for Hunger, Thirst, Sanity, and Toxicity using lookup tables
   * @private
   */
  _prepareStatusResources() {
    const hungerLevel = this.status?.hunger ?? 0;
    const thirstLevel = this.status?.thirst ?? 0;
    const sanityLevel = this.status?.sanity ?? 0;
    const toxicityLevel = this.status?.toxicity ?? 0;

    this.status.hungerMessage = hungerLevel > 0 ? game.i18n.localize(`CARDIGAN.Actor.Status.Hunger.${hungerLevel}`) : "";
    this.status.thirstMessage = thirstLevel > 0 ? game.i18n.localize(`CARDIGAN.Actor.Status.Thirst.${thirstLevel}`) : "";
    this.status.sanityMessage = sanityLevel > 0 ? game.i18n.localize(`CARDIGAN.Actor.Status.Sanity.${sanityLevel}`) : "";
    this.status.toxicityMessage = toxicityLevel > 0 ? game.i18n.localize(`CARDIGAN.Actor.Status.Toxicity.${toxicityLevel}`) : "";
  }

  /**
   * Calculate max HP, Energy, Armor, and Backpack based on stats and equipment
   * @private
   */
  _prepareHealthAndEnergy() {
    // Stamina bonuses (rule: each point adds +10 HP and +1 Energy)
    const totalStamina = this._getTotalAbility('stamina');
    const staminaHealthBonus = totalStamina * 10;
    const staminaEnergyBonus = totalStamina * 1;
    
    // Level bonuses (rule: levels 2-10 give +5 HP and +1 Energy each, level 1 gives nothing)
    const level = this.attributes?.level?.value ?? 0;
    const levelHealthBonus = Math.max(0, Math.min(level, 10) - 1) * 5;
    const levelEnergyBonus = Math.max(0, Math.min(level, 10) - 1) * 1;
    
    // Fracture reduction (rule: each Fracture point reduces HP by 5, no longer reduces Energy)
    const fractureLevel = this.status?.fracture ?? 0;
    const fractureReduction = fractureLevel * 5;
    
    // Manual bonuses from status
    const healthBonus = this.status?.healthBonus ?? 0;
    const energyBonus = this.status?.energyBonus ?? 0;
    const armorBonus = this.status?.armorBonus ?? 0;
    
    // Equipment bonuses (calculated from equipped armors)
    const armorHealthBonus = this._armorHealthBonus ?? 0;
    const armorEnergyBonus = this._armorEnergyBonus ?? 0;
    const armorProtectionBonus = this._armorProtectionBonus ?? 0;
    
    // Race bonuses (calculated from race item)
    const raceHealthBonus = this._raceHealthBonus ?? 0;
    const racePowerBonus = this._racePowerBonus ?? 0;
    const raceArmorBonus = this._raceArmorBonus ?? 0;
    
    // Calculate maximum values
    const totalStrength = this._getTotalAbility('strength');
    const strengthArmorBonus = Math.floor(totalStrength / 2);
    this.health.max = Math.max(0, staminaHealthBonus + levelHealthBonus - fractureReduction + healthBonus + armorHealthBonus + raceHealthBonus);
    this.power.max = Math.max(0, staminaEnergyBonus + levelEnergyBonus + energyBonus + armorEnergyBonus + racePowerBonus);
    this.armor.max = Math.max(0, armorBonus + armorProtectionBonus + raceArmorBonus + strengthArmorBonus);
    
    // Backpack capacity (rule: 15 base + Strength/2 + armor bonus)
    const baseBackpackCapacity = 15 + Math.floor(totalStrength / 2);
    const armorBackpackBonus = this._armorBackpackSpaceBonus || 0;
    this.backpack.max = baseBackpackCapacity + armorBackpackBonus;
    
    if (this.health.value > this.health.max) this.health.value = this.health.max;
    if (this.power.value > this.power.max) this.power.value = this.power.max;
    if (this.armor.value > this.armor.max) this.armor.value = this.armor.max;
  }

  /**
   * Calculate and apply bonuses from equipped armors (cumulative)
   * @private
   */
  _calculateArmorBonuses() {
    // Initialize armor bonuses for abilities
    const armorSkillBonuses = {};
    for (const key in this.abilities) {
      armorSkillBonuses[key] = 0;
    }

    // Initialize stat bonuses from armors
    let armorHealthBonus = 0;
    let armorEnergyBonus = 0;
    let armorProtectionBonus = 0;
    let armorMovementBonus = 0;
    let armorBackpackSpaceBonus = 0;

    // Get all armors from the actor
    const armors = this.parent?.items?.filter(item => item.type === 'armadura') || [];
    
    // Get all weapons from the actor  
    const weapons = this.parent?.items?.filter(item => item.type === 'arma') || [];
    
    // Count stylish items equipped (armors only)
    let stylishCount = 0;
    
    // Calculate total bonuses from equipped armors only
    for (const armor of armors) {
      // Only apply bonuses if armor is equipped
      const isEquipped = armor.system.equipped;
      if (!isEquipped) continue;
      
      // Skip if armor is broken (durability 0 or less)
      const currentDurability = armor.system.durability?.current ?? 0;
      if (currentDurability <= 0) continue;
      
      // Count stylish items
      if (armor.system.stylish) {
        stylishCount++;
      }
      
      // 1. Calculate skill bonuses from armors
      const skillBonuses = armor.system.skillBonuses || [];
      for (const skillBonus of skillBonuses) {
        const skill = skillBonus.skill;
        const bonus = skillBonus.bonus || 0;
        
        // Skip if no skill selected or bonus is 0
        if (!skill || bonus === 0) continue;
        
        // Add bonus to the corresponding ability
        if (armorSkillBonuses.hasOwnProperty(skill)) {
          armorSkillBonuses[skill] += bonus;
        }
      }

      // 2. Calculate stat bonuses from armors
      // Health bonus
      if (armor.system.bonusVida && armor.system.bonusVida > 0) {
        armorHealthBonus += armor.system.bonusVida;
      }
      
      // Energy bonus  
      if (armor.system.bonusEnergia && armor.system.bonusEnergia > 0) {
        armorEnergyBonus += armor.system.bonusEnergia;
      }
      
      // Protection bonus (contributes to armor max)
      if (armor.system.protecao && armor.system.protecao > 0) {
        armorProtectionBonus += armor.system.protecao;
      }
      
      // Movement bonus
      if (armor.system.bonusDeslocamento && armor.system.bonusDeslocamento.enabled && armor.system.bonusDeslocamento.bonus > 0) {
        armorMovementBonus += armor.system.bonusDeslocamento.bonus;
      }
      
      // Backpack space bonus
      if (armor.system.bonusEspacoMochila && armor.system.bonusEspacoMochila.enabled && armor.system.bonusEspacoMochila.bonus > 0) {
        armorBackpackSpaceBonus += armor.system.bonusEspacoMochila.bonus;
      }
    }

    // Calculate protection bonuses from equipped weapons with protection enabled
    for (const weapon of weapons) {
      // Only apply bonuses if weapon is equipped
      const isEquipped = weapon.system.equipped;
      if (!isEquipped) continue;
      
      // Add protection bonus from weapons if enabled
      if (weapon.system.protection && weapon.system.protection.enabled && weapon.system.protection.value > 0) {
        armorProtectionBonus += weapon.system.protection.value;
      }
    }

    // Calculate Persuasion bonus from Stylish items (every 3 items = +1 Persuasion)
    const stylishPersuasionBonus = Math.floor(stylishCount / 3);
    if (stylishPersuasionBonus > 0 && armorSkillBonuses.hasOwnProperty('persuasion')) {
      armorSkillBonuses.persuasion += stylishPersuasionBonus;
    }

    // Apply armor skill bonuses to abilities (add to existing totalBonus)
    for (const key in this.abilities) {
      const currentTotalBonus = this.abilities[key].totalBonus || 0;
      const armorBonus = armorSkillBonuses[key] || 0;
      
      // Store armor bonus separately
      this.abilities[key].armorBonus = armorBonus;
      
      // Update totalBonus to include armor bonuses
      this.abilities[key].totalBonus = currentTotalBonus + armorBonus;
    }

    // Apply stat bonuses - store them separately instead of adding to existing status
    // These will be used directly in the max calculations
    this._armorHealthBonus = armorHealthBonus;
    this._armorEnergyBonus = armorEnergyBonus; 
    this._armorProtectionBonus = armorProtectionBonus;
    this._armorMovementBonus = armorMovementBonus;
    this._armorBackpackSpaceBonus = armorBackpackSpaceBonus;

    // Recalculate ability totals with armor bonuses included
    for (const key in this.abilities) {
      const baseValue = this.abilities[key].value || 0;
      const totalBonus = this.abilities[key].totalBonus || 0;
      this.abilities[key].total = baseValue + totalBonus;
    }
  }

  /**
   * Get total ability value (value + totalBonus)
   * @param {string} abilityName - Ability name (dexterity, stamina, etc)
   * @returns {number} Total value or 0
   * @private
   */
  _getTotalAbility(abilityName) {
    const ability = this.abilities?.[abilityName];
    if (!ability) return 0;
    
    const value = ability.value ?? 0;
    const totalBonus = ability.totalBonus ?? 0;
    return value + totalBonus;
  }

  /**
   * Ensure level has valid value (minimum 0)
   * @private
   */
  _prepareLevelAndExperience() {
    const level = this.attributes?.level?.value ?? 0;
    this.attributes.level.value = Math.max(0, level);
  }

  getRollData() {
    const data = {};

    if (this.abilities) {
      for (let [k, v] of Object.entries(this.abilities)) {
        data[k] = {
          value: v.value || 0,
          bonus: v.totalBonus || 0,
          total: (v.value || 0) + (v.totalBonus || 0)
        };
      }
    }

    return data;
  }
}
