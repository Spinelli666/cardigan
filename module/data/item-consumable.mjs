import CardiganSystemItemBase from './base-item.mjs';

/**
 * Data model for consumable items (potions, food, scrolls, medicine, bombs).
 * Provides modifiers for skills, health, energy, status ailments, and active effects.
 * @extends {CardiganSystemItemBase}
 */
export default class CardiganSystemItemConsumivel extends CardiganSystemItemBase {
  static LOCALIZATION_PREFIXES = [
    'CARDIGAN.Item.base',
    'CARDIGAN.Item.ItemConsumivel',
  ];

  /**
   * Available character abilities for skill checks and bonuses.
   * Used in temporarySkillBonus, criticalHitSkillBonus, criticalFailureSkillLoss fields.
   * 
   * @type {Object<string, string>}
   * @constant
   * 
   * @property {string} accuracy - Accuracy (Acerto)
   * @property {string} evasion - Evasion (Evasão)
   * @property {string} strength - Strength (Força)
   * @property {string} dexterity - Dexterity (Destreza)
   * @property {string} stamina - Stamina (Vigor)
   * @property {string} stealth - Stealth (Furtividade)
   * @property {string} persuasion - Persuasion (Persuasão)
   * @property {string} intelligence - Intelligence (Inteligência)
   * @property {string} psionics - Psionics (Psiônicos)
   */
  static ABILITY_CHOICES = {
    "accuracy": "CARDIGAN.Ability.Accuracy.long",
    "evasion": "CARDIGAN.Ability.Evasion.long",
    "strength": "CARDIGAN.Ability.Strength.long",
    "dexterity": "CARDIGAN.Ability.Dexterity.long",
    "stamina": "CARDIGAN.Ability.Stamina.long",
    "stealth": "CARDIGAN.Ability.Stealth.long",
    "persuasion": "CARDIGAN.Ability.Persuasion.long",
    "intelligence": "CARDIGAN.Ability.Intelligence.long",
    "psionics": "CARDIGAN.Ability.Psionics.long"
  };

  /** Modifier operation types (increase/decrease) */
  static MODIFIER_TYPE_CHOICES = {
    "increase": "CARDIGAN.ItemConsumivel.ModifierIncrease",
    "decrease": "CARDIGAN.ItemConsumivel.ModifierDecrease"
  };

  /** Health modifier types (add/subtract) */
  static HEALTH_MODIFIER_TYPE_CHOICES = {
    "add": "CARDIGAN.ItemConsumivel.HealthAdd",
    "subtract": "CARDIGAN.ItemConsumivel.HealthSubtract"
  };

  /** Energy modifier types (add/subtract) */
  static ENERGY_MODIFIER_TYPE_CHOICES = {
    "add": "CARDIGAN.ItemConsumivel.EnergyModifierTypeAdd",
    "subtract": "CARDIGAN.ItemConsumivel.EnergyModifierTypeSubtract"
  };

  /** Standard dice options (1d4 to 1d20) */
  static DICE_CHOICES = {
    "1d4": "1d4",
    "1d6": "1d6",
    "1d8": "1d8",
    "1d10": "1d10",
    "1d12": "1d12",
    "1d20": "1d20"
  };

  /** Define the data schema for consumable items */
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.quantity = new fields.NumberField({
      ...requiredInteger,
      initial: 1,
      min: 1,
    });

    schema.weight = new fields.StringField({
      required: true,
      blank: false,
      initial: "light"
    });

    schema.price = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 0,
      min: 0,
    });

    // Consumable fields
    schema.consumableType = new fields.StringField({
      required: false,
      initial: "potion",
      choices: {
        "potion": "CARDIGAN.ItemConsumivel.Types.Potion",
        "food": "CARDIGAN.ItemConsumivel.Types.Food",
        "scroll": "CARDIGAN.ItemConsumivel.Types.Scroll",
        "medicine": "CARDIGAN.ItemConsumivel.Types.Medicine",
        "bomb": "CARDIGAN.ItemConsumivel.Types.Bomb",
        "other": "CARDIGAN.ItemConsumivel.Types.Other"
      }
    });

    schema.useTime = new fields.StringField({
      required: false,
      initial: "action",
      choices: {
        "action": "CARDIGAN.ItemConsumivel.UseTimes.Action",
        "bonus-action": "CARDIGAN.ItemConsumivel.UseTimes.BonusAction",
        "reaction": "CARDIGAN.ItemConsumivel.UseTimes.Reaction",
        "minute": "CARDIGAN.ItemConsumivel.UseTimes.Minute"
      }
    });

    schema.duration = new fields.StringField({ required: false, blank: true });
    schema.effect = new fields.StringField({ required: false, blank: true });
    
    schema.requiresCheck = new fields.BooleanField({
      required: false,
      initial: false
    });
    
    schema.checkDifficulty = new fields.NumberField({
      required: false,
      nullable: false,
      initial: 15,
      choices: {
        10: "10 - CARDIGAN.Difficulty.Easy",
        15: "15 - CARDIGAN.Difficulty.Normal", 
        20: "20 - CARDIGAN.Difficulty.Hard",
        25: "25 - CARDIGAN.Difficulty.VeryHard"
      }
    });

    // Effects system (similar to skillBonuses from weapons)
    schema.effects = new fields.ArrayField(
      new fields.SchemaField({
        effectId: new fields.StringField({ required: true, blank: true, initial: "" }),
        apply: new fields.BooleanField({ required: true, initial: false }),
        remove: new fields.BooleanField({ required: true, initial: false })
      }),
      { initial: [] }
    );

    // Controls whether skill check section is enabled
    schema.hasSkillCheck = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasSkillCheck"
    });

    // Skill check ability selection
    schema.skillCheckAbility = new fields.StringField({
      required: false,
      blank: true,
      initial: "accuracy",
      choices: CardiganSystemItemConsumivel.ABILITY_CHOICES,
      label: "CARDIGAN.ItemConsumivel.SkillCheckAbility"
    });

    // Whether skill check has advantage
    schema.skillCheckAdvantage = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.SkillCheckAdvantage"
    });

    // Whether skill check has enhanced advantage
    schema.skillCheckEnhancedAdvantage = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.SkillCheckAdvantage"
    });

    // Whether skill check has disadvantage
    schema.skillCheckDisadvantage = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.SkillCheckAdvantage"
    });

    // Whether skill check has enhanced disadvantage
    schema.skillCheckEnhancedDisadvantage = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.SkillCheckAdvantage"
    });

    // Effects configured by skill-test add dialog (critical hit / critical failure).
    schema.skillTestAddedEffects = new fields.ArrayField(
      new fields.SchemaField({
        uuid: new fields.StringField({ required: true }),
        name: new fields.StringField({ required: true }),
        img: new fields.StringField({ required: false, initial: '' }),
        rounds: new fields.StringField({ required: false, initial: '0' }),
        criticalFailure: new fields.BooleanField({ required: true, initial: false }),
        criticalHit: new fields.BooleanField({ required: true, initial: false })
      }),
      { initial: [] }
    );

    // Critical failure effects system
    schema.hasCriticalFailureEffects = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasCriticalFailureEffects"
    });

    schema.criticalFailureEffects = new fields.ArrayField(
      new fields.SchemaField({
        id: new fields.StringField({ required: true }),
        name: new fields.StringField({ required: true }),
        img: new fields.StringField({ required: false, initial: '' })
      }),
      { initial: [] }
    );

    // Critical failure skill loss system
    schema.hasCriticalFailureSkillLoss = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasCriticalFailureSkillLoss"
    });

    schema.criticalFailureSkillLoss = new fields.ArrayField(
      new fields.SchemaField({
        ability: new fields.StringField({
          required: true,
          initial: "accuracy",
          choices: CardiganSystemItemConsumivel.ABILITY_CHOICES
        }),
        value: new fields.NumberField({
          required: true,
          initial: 1,
          min: 1,
          integer: true
        })
      }),
      { initial: [] }
    );

    // Critical hit effects system
    schema.hasCriticalHitEffects = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasCriticalHitEffects"
    });

    schema.criticalHitEffects = new fields.ArrayField(
      new fields.SchemaField({
        id: new fields.StringField({ required: true }),
        name: new fields.StringField({ required: true }),
        img: new fields.StringField({ required: false, initial: '' })
      }),
      { initial: [] }
    );

    // Critical hit skill bonus system
    schema.hasCriticalHitSkillBonus = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasCriticalHitSkillBonus"
    });

    schema.criticalHitSkillBonus = new fields.ArrayField(
      new fields.SchemaField({
        ability: new fields.StringField({
          required: true,
          initial: "accuracy",
          choices: CardiganSystemItemConsumivel.ABILITY_CHOICES
        }),
        value: new fields.NumberField({
          required: true,
          initial: 1,
          min: 1,
          integer: true
        })
      }),
      { initial: [] }
    );

    // Temporary skill bonus system (always applies on consumption)
    schema.hasTemporarySkillBonus = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasTemporarySkillBonus"
    });

    // Visual toggle for the Attributes tab life & energy block
    schema.hasLifeEnergySection = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasLifeEnergySection"
    });

    // Visual toggle for the Attributes tab effects block
    schema.hasEffectsSection = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasEffectsSection"
    });

    schema.temporarySkillBonus = new fields.ArrayField(
      new fields.SchemaField({
        ability: new fields.StringField({
          required: true,
          initial: "accuracy",
          choices: CardiganSystemItemConsumivel.ABILITY_CHOICES
        }),
        value: new fields.NumberField({
          required: true,
          initial: 1,
          min: 1,
          integer: true
        })
      }),
      { initial: [] }
    );

    // Health buff/debuff system
    schema.hasHealthModifier = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasHealthModifier"
    });

    schema.healthModifierType = new fields.StringField({
      required: false,
      blank: true,
      initial: "add",
      choices: CardiganSystemItemConsumivel.HEALTH_MODIFIER_TYPE_CHOICES,
      label: "CARDIGAN.ItemConsumivel.HealthModifierType"
    });

    schema.healthModifierDice = new fields.StringField({
      required: false,
      blank: true,
      initial: "1d20",
      choices: CardiganSystemItemConsumivel.DICE_CHOICES,
      label: "CARDIGAN.ItemConsumivel.HealthModifierDice"
    });

    schema.healthModifierQuantity = new fields.NumberField({
      required: false,
      initial: 1,
      min: 1,
      max: 10,
      integer: true,
      label: "CARDIGAN.ItemConsumivel.HealthModifierQuantity"
    });

    schema.healthModifierAddSkill = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HealthModifierAddSkill"
    });

    schema.healthModifierSkill = new fields.StringField({
      required: false,
      blank: true,
      initial: "accuracy",
      choices: CardiganSystemItemConsumivel.ABILITY_CHOICES,
      label: "CARDIGAN.ItemConsumivel.HealthModifierSkill"
    });

    schema.healthModifierDoubleSkill = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HealthModifierDoubleSkill"
    });

    schema.healthModifierIsTemporary = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HealthModifierIsTemporary"
    });

    schema.healthModifierAdditionalBonus = new fields.NumberField({
      required: false,
      initial: 0,
      min: 0,
      integer: true,
      label: "CARDIGAN.ItemConsumivel.HealthModifierAdditionalBonus"
    });

    // Energy Modifier System
    schema.hasEnergyModifier = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasEnergyModifier"
    });

    schema.energyModifierType = new fields.StringField({
      required: true,
      initial: "add",
      choices: CardiganSystemItemConsumivel.ENERGY_MODIFIER_TYPE_CHOICES,
      label: "CARDIGAN.ItemConsumivel.EnergyModifierType"
    });

    schema.energyModifierDice = new fields.StringField({
      required: true,
      initial: "1d4",
      choices: CardiganSystemItemConsumivel.DICE_CHOICES,
      label: "CARDIGAN.ItemConsumivel.EnergyModifierDice"
    });

    schema.energyModifierQuantity = new fields.NumberField({
      required: true,
      initial: 1,
      min: 1,
      max: 10,
      integer: true,
      label: "CARDIGAN.ItemConsumivel.EnergyModifierQuantity"
    });

    schema.energyModifierAddSkill = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.EnergyModifierAddSkill"
    });

    schema.energyModifierSkill = new fields.StringField({
      required: true,
      initial: "accuracy",
      choices: CardiganSystemItemConsumivel.ABILITY_CHOICES,
      label: "CARDIGAN.ItemConsumivel.EnergyModifierSkill"
    });

    schema.energyModifierDoubleSkill = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.EnergyModifierDoubleSkill"
    });

    schema.energyModifierIsTemporary = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.EnergyModifierIsTemporary"
    });

    schema.energyModifierAdditionalBonus = new fields.NumberField({
      required: false,
      initial: 0,
      min: 0,
      integer: true,
      label: "CARDIGAN.ItemConsumivel.EnergyModifierAdditionalBonus"
    });

    // Armor Bonus System - Temporary Armor Bonus?
    schema.hasArmorBonus = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasArmorBonus"
    });

    schema.armorBonusAmount = new fields.NumberField({
      required: false,
      nullable: true,
      initial: 0,
      min: 0,
      integer: true,
      label: "CARDIGAN.ItemConsumivel.ArmorBonusAmount"
    });

    // Status Ailments System - Status Ailments?
    schema.hasStatusAilments = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasStatusAilments"
    });

    schema.hasSanityModifier = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasSanityModifier"
    });

    schema.sanityModifierType = new fields.StringField({
      required: false,
      initial: "increase",
      choices: CardiganSystemItemConsumivel.MODIFIER_TYPE_CHOICES,
      label: "CARDIGAN.ItemConsumivel.SanityModifierType"
    });

    schema.sanityModifierAmount = new fields.NumberField({
      required: false,
      initial: 1,
      min: 1,
      max: 5,
      integer: true,
      label: "CARDIGAN.ItemConsumivel.SanityModifierAmount"
    });

    // Toxicity modifier fields
    schema.hasToxicityModifier = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasToxicityModifier"
    });

    schema.toxicityModifierType = new fields.StringField({
      required: false,
      initial: "increase",
      choices: CardiganSystemItemConsumivel.MODIFIER_TYPE_CHOICES,
      label: "CARDIGAN.ItemConsumivel.ToxicityModifierType"
    });

    schema.toxicityModifierAmount = new fields.NumberField({
      required: false,
      initial: 1,
      min: 1,
      max: 5,
      integer: true,
      label: "CARDIGAN.ItemConsumivel.ToxicityModifierAmount"
    });

    // Fracture modifier fields
    schema.hasFractureModifier = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasFractureModifier"
    });

    schema.fractureModifierType = new fields.StringField({
      required: false,
      initial: "increase",
      choices: CardiganSystemItemConsumivel.MODIFIER_TYPE_CHOICES,
      label: "CARDIGAN.ItemConsumivel.FractureModifierType"
    });

    schema.fractureModifierAmount = new fields.NumberField({
      required: false,
      initial: 0,
      min: 0,
      max: 5,
      integer: true,
      label: "CARDIGAN.ItemConsumivel.FractureModifierAmount"
    });

    // Food and Water system
    schema.hasFoodAndWater = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasFoodAndWater"
    });

    // Food modifier fields
    schema.hasFoodModifier = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasFoodModifier"
    });

    schema.foodModifierType = new fields.StringField({
      required: false,
      initial: "increase",
      choices: CardiganSystemItemConsumivel.MODIFIER_TYPE_CHOICES,
      label: "CARDIGAN.ItemConsumivel.FoodModifierType"
    });

    schema.foodModifierAmount = new fields.NumberField({
      required: false,
      initial: 1,
      min: 1,
      max: 5,
      integer: true,
      label: "CARDIGAN.ItemConsumivel.FoodModifierAmount"
    });

    // Water modifier fields
    schema.hasWaterModifier = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasWaterModifier"
    });

    schema.waterModifierType = new fields.StringField({
      required: false,
      initial: "increase",
      choices: CardiganSystemItemConsumivel.MODIFIER_TYPE_CHOICES,
      label: "CARDIGAN.ItemConsumivel.WaterModifierType"
    });

    schema.waterModifierAmount = new fields.NumberField({
      required: false,
      initial: 1,
      min: 1,
      max: 5,
      integer: true,
      label: "CARDIGAN.ItemConsumivel.WaterModifierAmount"
    });

    // Movement bonus object (same structure used by armor)
    schema.movementBonus = new fields.SchemaField({
      enabled: new fields.BooleanField({
        required: true,
        initial: true,
      }),
      bonus: new fields.NumberField({
        required: true,
        initial: 0,
        min: 0,
        max: 10,
        integer: true,
      }),
    });

    // Movement boost system
    schema.hasMovementBoost = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasMovementBoost"
    });

    schema.movementBoostAmount = new fields.NumberField({
      required: false,
      initial: 1,
      min: 1,
      max: 10,
      integer: true,
      label: "CARDIGAN.ItemConsumivel.MovementBoostAmount"
    });

    // Critical hit boost system
    schema.hasCriticalHitBoost = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasCriticalHitBoost"
    });

    schema.criticalHitBoostAmount = new fields.NumberField({
      required: false,
      initial: 0,
      min: 0,
      max: 5,
      integer: true,
      label: "CARDIGAN.ItemConsumivel.CriticalHitBoostAmount"
    });

    // Controls whether effects section is enabled
    schema.hasEffects = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasEffects"
    });

    // Modifiers system
    // NOTE: statusEffects is kept for the schema v1 PT->EN migration (see module/migration/migrate-world.mjs),
    // and usage.consumeOnUse is read by _useConsumableItem in item-sheet.mjs.
    schema.modifiers = new fields.SchemaField({
      // Status effects (checkboxes)
      statusEffects: new fields.SchemaField({
        hunger: new fields.NumberField({ required: true, initial: 0 }),
        thirst: new fields.NumberField({ required: true, initial: 0 }),
        fracture: new fields.NumberField({ required: true, initial: 0 }),
        sanity: new fields.NumberField({ required: true, initial: 0 }),
        toxicity: new fields.NumberField({ required: true, initial: 0 })
      }),

      // Usage settings
      usage: new fields.SchemaField({
        consumeOnUse: new fields.BooleanField({ required: true, initial: true })
      })
    });

    schema.profession = new fields.StringField({
      required: false,
      initial: "general",
      choices: {
        "general": "CARDIGAN.ItemIngredient.Professions.General",
        "alchemy": "CARDIGAN.ItemIngredient.Professions.Alchemy",
        "blacksmithing": "CARDIGAN.ItemIngredient.Professions.Blacksmithing",
        "culinary": "CARDIGAN.ItemIngredient.Professions.Culinary",
        "tailoring": "CARDIGAN.ItemIngredient.Professions.Tailoring",
        "tecnomagic": "CARDIGAN.ItemIngredient.Professions.Tecnomagic"
      }
    });

    return schema;
  }

  /** Prepare derived data: cleans arrays, calculates modifier count, sets UI flags */
  prepareDerivedData() {
    super.prepareDerivedData();

    this._syncLegacyMovementFields();
    this._syncLegacyCriticalHitBoostFields();
    this._syncLegacyArmorBonusFields();
    
    // Clean empty entries from arrays
    this._cleanArrayFields();
    
    // Calculate active modifiers count
    this._calculateActiveModifiersCount();
    
    // Set derived flags for UI conditionals
    this._setDerivedFlags();
  }

  /** Keep compatibility between legacy movement fields and movementBonus object. */
  _syncLegacyMovementFields() {
    const legacyEnabled = Boolean(this.hasMovementBoost);
    const legacyAmount = Number(this.movementBoostAmount ?? 0);

    if (!this.movementBonus || typeof this.movementBonus !== 'object') {
      this.movementBonus = {
        enabled: legacyEnabled,
        bonus: Number.isFinite(legacyAmount) ? Math.max(0, legacyAmount) : 0,
      };
    }

    const nextBonusRaw = Number(this.movementBonus.bonus ?? legacyAmount);
    const nextBonus = Number.isFinite(nextBonusRaw) ? Math.max(0, nextBonusRaw) : 0;
    const nextEnabled = nextBonus > 0;

    this.movementBonus.enabled = nextEnabled;
    this.movementBonus.bonus = nextBonus;

    // Mirror to legacy fields used by existing logic paths.
    this.hasMovementBoost = nextEnabled;
    this.movementBoostAmount = nextBonus;
  }

  /** Keep hasCriticalHitBoost in sync with criticalHitBoostAmount. */
  _syncLegacyCriticalHitBoostFields() {
    const amountRaw = Number(this.criticalHitBoostAmount ?? 0);
    const amount = Number.isFinite(amountRaw) ? Math.max(0, amountRaw) : 0;

    this.criticalHitBoostAmount = amount;
    this.hasCriticalHitBoost = amount > 0;
  }

  /** Keep hasArmorBonus in sync with armorBonusAmount. */
  _syncLegacyArmorBonusFields() {
    const amountRaw = Number(this.armorBonusAmount ?? 0);
    const amount = Number.isFinite(amountRaw) ? Math.max(0, amountRaw) : 0;

    this.armorBonusAmount = amount;
    this.hasArmorBonus = amount > 0;
  }

  /** Remove empty/invalid entries from array fields (skill bonuses, effects, etc.) */
  _cleanArrayFields() {
    // Clean temporary skill bonuses (remove entries with no ability or zero value)
    if (Array.isArray(this.temporarySkillBonus)) {
      this.temporarySkillBonus = this.temporarySkillBonus.filter(
        bonus => bonus.ability && bonus.value > 0
      );
    }

    // Clean critical failure skill loss
    if (Array.isArray(this.criticalFailureSkillLoss)) {
      this.criticalFailureSkillLoss = this.criticalFailureSkillLoss.filter(
        loss => loss.ability && loss.value > 0
      );
    }

    // Clean critical hit skill bonus
    if (Array.isArray(this.criticalHitSkillBonus)) {
      this.criticalHitSkillBonus = this.criticalHitSkillBonus.filter(
        bonus => bonus.ability && bonus.value > 0
      );
    }

    // Clean critical failure effects (remove entries with no id/name)
    if (Array.isArray(this.criticalFailureEffects)) {
      this.criticalFailureEffects = this.criticalFailureEffects.filter(
        effect => effect.id && effect.name
      );
    }

    // Clean critical hit effects
    if (Array.isArray(this.criticalHitEffects)) {
      this.criticalHitEffects = this.criticalHitEffects.filter(
        effect => effect.id && effect.name
      );
    }

    // Clean configured skill-test effects
    if (Array.isArray(this.skillTestAddedEffects)) {
      this.skillTestAddedEffects = this.skillTestAddedEffects.filter(
        effect => effect.uuid && effect.name
      );
    }

    // Clean base effects
    if (Array.isArray(this.effects)) {
      this.effects = this.effects.filter(
        effect => effect.effectId
      );
    }

    // Clean custom effects
    if (Array.isArray(this.customEffects)) {
      this.customEffects = this.customEffects.filter(
        effect => effect.id && effect.name
      );
    }
  }

  /** Calculate total number of active modifiers for UI indicators */
  _calculateActiveModifiersCount() {
    let count = 0;
    
    // Count boolean-gated modifiers
    if (this.hasHealthModifier) count++;
    if (this.hasEnergyModifier) count++;
    if (this.hasSanityModifier) count++;
    if (this.hasToxicityModifier) count++;
    if (this.hasFractureModifier) count++;
    if (this.hasFoodModifier) count++;
    if (this.hasWaterModifier) count++;
    if (this.hasMovementBoost) count++;
    if (this.hasCriticalHitBoost) count++;
    if (this.hasArmorBonus) count++;
    if (this.hasTemporarySkillBonus && this.temporarySkillBonus?.length > 0) count++;
    if (this.hasCriticalHitEffects && this.criticalHitEffects?.length > 0) count++;
    if (this.hasCriticalFailureEffects && this.criticalFailureEffects?.length > 0) count++;
    if (this.hasCriticalHitSkillBonus && this.criticalHitSkillBonus?.length > 0) count++;
    if (this.hasCriticalFailureSkillLoss && this.criticalFailureSkillLoss?.length > 0) count++;
    
    this.activeModifiersCount = count;
  }

  /** Set derived boolean flags for UI conditionals (hasAnyModifier, requiresAbilityCheck, etc.) */
  _setDerivedFlags() {
    // Flag: item has any modifier (useful for UI sections)
    this.hasAnyModifier = this.activeModifiersCount > 0;
    
    // Flag: item requires any kind of check
    this.requiresAbilityCheck = this.hasSkillCheck || this.requiresCheck;
    
    // Flag: item has critical outcomes (success/failure)
    this.hasCriticalOutcomes = 
      this.hasCriticalHitEffects || 
      this.hasCriticalFailureEffects ||
      this.hasCriticalHitSkillBonus ||
      this.hasCriticalFailureSkillLoss;
    
    // Flag: item affects status ailments
    this.affectsStatusAilments = 
      this.hasSanityModifier ||
      this.hasToxicityModifier ||
      this.hasFractureModifier ||
      this.hasFoodModifier ||
      this.hasWaterModifier;
    
    // Flag: item affects resources (HP/Energy)
    this.affectsResources = this.hasHealthModifier || this.hasEnergyModifier;
    
    // Flag: item affects combat stats
    this.affectsCombat = 
      this.hasArmorBonus ||
      this.hasMovementBoost ||
      this.hasCriticalHitBoost ||
      (this.hasTemporarySkillBonus && this.temporarySkillBonus?.length > 0);
  }

}
