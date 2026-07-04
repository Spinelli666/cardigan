import CardiganSystemItemBase from "./base-item.mjs";

/**
 * Sistema de dados para itens do tipo Arma.
 * @extends {CardiganSystemItemBase}
 */
export default class CardiganSystemArma extends CardiganSystemItemBase {
  /** @inheritdoc */
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    'CARDIGAN.Item.Arma',
  ];

  /** Weight choices for weapons */
  static WEIGHT_CHOICES = {
    light: "CARDIGAN.Light",
    heavy: "CARDIGAN.Heavy"
  };

  /** Vorpal property damage bonus when wielded with both hands */
  static VORPAL_BONUS = 4;

  /** Maximum durability value for weapons */
  static DURABILITY_MAX = 3;

  /** Valid weapon properties that can be applied */
  static VALID_PROPERTIES = [
    'accurate',
    'blunt',
    'electrify',
    'wound',
    'impact',
    'ignite',
    'pierce',
    'vorpal'
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const requiredString = { required: true, blank: true };

    return {
      ...super.defineSchema(),
      melee: new fields.BooleanField({ required: true, initial: false }),
      ranged: new fields.BooleanField({ required: true, initial: false }),
      isFirearm: new fields.BooleanField({ required: true, initial: false }),
      magazine: new fields.NumberField({ 
        required: true, 
        nullable: false, 
        initial: 0, 
        min: 0, 
        integer: true 
      }),
      loadedAmmo: new fields.NumberField({ 
        required: true, 
        nullable: false, 
        initial: 0, 
        min: 0, 
        integer: true 
      }),
      loadedAmmoTypes: new fields.ObjectField({ 
        required: true, 
        nullable: false,
        initial: {}
      }),
      damage: new fields.SchemaField({
        value: new fields.StringField({ ...requiredString, initial: "0" }),
        useStrength: new fields.BooleanField({ required: true, initial: false }),
        useDexterity: new fields.BooleanField({ required: true, initial: false }),
        usePsionics: new fields.BooleanField({ required: true, initial: false }),
        total: new fields.StringField({ required: true, blank: true, initial: "0" })
      }),
      properties: new fields.ArrayField(
        new fields.StringField({ required: true, blank: true }),
        { initial: [] }
      ),
      rightHand: new fields.BooleanField({ required: true, initial: false }),
      leftHand: new fields.BooleanField({ required: true, initial: false }),
      weight: new fields.StringField({
        required: true,
        blank: false,
        initial: "light",
        choices: CardiganSystemArma.WEIGHT_CHOICES,
        clean: (value) => {
          // Convert old numeric values to string choices
          if (typeof value === 'number') {
            return value <= 0 ? "light" : "heavy";
          }
          // Ensure valid string choices
          if (!["light", "heavy"].includes(value)) {
            return "light";
          }
          return value;
        }
      }),
      quantity: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 1,
        min: 1
      }),
      price: new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
      durability: new fields.SchemaField({
        current: new fields.NumberField({ required: true, nullable: false, initial: CardiganSystemArma.DURABILITY_MAX, min: 0, integer: true }),
        max: new fields.NumberField({ required: true, nullable: false, initial: CardiganSystemArma.DURABILITY_MAX, min: 1, integer: true })
      }),
      skillBonuses: new fields.ArrayField(
        new fields.SchemaField({
          skill: new fields.StringField({ required: true, blank: false }),
          bonus: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 })
        }),
        { initial: [] }
      ),
      equipped: new fields.BooleanField({ required: true, initial: false }),
      magicalArtifact: new fields.BooleanField({ required: true, initial: false }),
      protection: new fields.SchemaField({
        enabled: new fields.BooleanField({ required: true, initial: false }),
        value: new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0, integer: true })
      })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    
    // Clean invalid properties from array
    this._cleanProperties();
    
    // Automatically set equipped based on hand usage
    // A weapon is equipped if it's in at least one hand
    this.equipped = this.rightHand || this.leftHand;

    // Calculate damage total with ability modifier
    this._calculateDamageTotal();
  }

  /** Remove invalid properties from array */
  _cleanProperties() {
    if (!Array.isArray(this.properties)) return;
    
    this.properties = this.properties.filter(prop => 
      CardiganSystemArma.VALID_PROPERTIES.includes(prop)
    );
  }

  /** Calculate Vorpal bonus (4 if both hands, 0 otherwise) */
  _calculateVorpalBonus() {
    if (!this.properties?.includes('vorpal')) return 0;
    if (this.rightHand && this.leftHand) return CardiganSystemArma.VORPAL_BONUS;
    return 0;
  }

  /** Calculate total damage (base + ability + Vorpal) */
  _calculateDamageTotal() {
    const actor = this.parent?.actor;
    if (!actor) {
      this.damage.total = this.damage.value;
      return;
    }

    let baseDamage = this.damage.value;
    let abilityBonus = 0;

    // Get ability bonus based on selected checkboxes
    if (this.damage.useStrength && actor.system.abilities?.strength) {
      abilityBonus = actor.system.abilities.strength.value || 0;
    } else if (this.damage.useDexterity && actor.system.abilities?.dexterity) {
      abilityBonus = actor.system.abilities.dexterity.value || 0;
    } else if (this.damage.usePsionics && actor.system.abilities?.psionics) {
      abilityBonus = actor.system.abilities.psionics.value || 0;
    }

    // Calculate total damage with bonuses
    const vorpalBonus = this._calculateVorpalBonus();
    const totalBonus = abilityBonus + vorpalBonus;
    
    if (totalBonus > 0) {
      // Check if base damage is a simple number that can be added directly
      const baseDamageNum = parseInt(baseDamage);
      if (!isNaN(baseDamageNum)) {
        // Base damage is a simple number, calculate the sum
        const total = baseDamageNum + totalBonus;
        this.damage.total = `${total}`;
      } else if (baseDamage !== "0" && baseDamage !== "") {
        // Base damage is a dice formula or complex string, append the bonus
        this.damage.total = `${baseDamage} + ${totalBonus}`;
      } else {
        // If base damage is 0 or empty, just show the total bonus
        this.damage.total = `${totalBonus}`;
      }
    } else {
      // No bonuses, just use base damage
      this.damage.total = baseDamage;
    }
  }

  /** Create melee weapon (STR bonus) - options: {weight, properties, price} */
  static createMeleeWeapon(name, damage, options = {}) {
    return {
      name,
      type: 'arma',
      system: {
        melee: true,
        ranged: false,
        isFirearm: false,
        magazine: 0,
        loadedAmmo: 0,
        loadedAmmoTypes: {},
        damage: {
          value: damage,
          useStrength: true,
          useDexterity: false,
          total: damage
        },
        properties: options.properties || [],
        rightHand: false,
        leftHand: false,
        weight: options.weight || 'light',
        price: options.price || 0,
        durability: {
          current: CardiganSystemArma.DURABILITY_MAX,
          max: CardiganSystemArma.DURABILITY_MAX
        },
        skillBonuses: [],
        equipped: false,
        magicalArtifact: false,
        protection: {
          enabled: false,
          value: 0
        }
      }
    };
  }

  /** Create ranged weapon (DEX bonus) - options: {weight, properties, price} */
  static createRangedWeapon(name, damage, magazine, options = {}) {
    return {
      name,
      type: 'arma',
      system: {
        melee: false,
        ranged: true,
        isFirearm: false,
        magazine,
        loadedAmmo: 0,
        loadedAmmoTypes: {},
        damage: {
          value: damage,
          useStrength: false,
          useDexterity: true,
          total: damage
        },
        properties: options.properties || [],
        rightHand: false,
        leftHand: false,
        weight: options.weight || 'light',
        price: options.price || 0,
        durability: {
          current: CardiganSystemArma.DURABILITY_MAX,
          max: CardiganSystemArma.DURABILITY_MAX
        },
        skillBonuses: [],
        equipped: false,
        magicalArtifact: false,
        protection: {
          enabled: false,
          value: 0
        }
      }
    };
  }

  /** Create firearm (DEX bonus, isFirearm=true) - options: {weight, properties, price} */
  static createFirearm(name, damage, magazine, options = {}) {
    return {
      name,
      type: 'arma',
      system: {
        melee: false,
        ranged: true,
        isFirearm: true,
        magazine,
        loadedAmmo: 0,
        loadedAmmoTypes: {},
        damage: {
          value: damage,
          useStrength: false,
          useDexterity: true,
          total: damage
        },
        properties: options.properties || [],
        rightHand: false,
        leftHand: false,
        weight: options.weight || 'heavy',
        price: options.price || 0,
        durability: {
          current: CardiganSystemArma.DURABILITY_MAX,
          max: CardiganSystemArma.DURABILITY_MAX
        },
        skillBonuses: [],
        equipped: false,
        magicalArtifact: false,
        protection: {
          enabled: false,
          value: 0
        }
      }
    };
  }
}
