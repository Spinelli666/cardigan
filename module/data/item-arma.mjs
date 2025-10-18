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

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const requiredString = { required: true, blank: true };

    return {
      ...super.defineSchema(),
      weaponType: new fields.StringField({ required: false, blank: true, initial: "" }),
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
        initial: "leve",
        choices: {
          "leve": "CARDIGAN.Light",
          "pesado": "CARDIGAN.Heavy"
        },
        clean: (value) => {
          // Convert old numeric values to string choices
          if (typeof value === 'number') {
            return value <= 0 ? "leve" : "pesado";
          }
          // Ensure valid string choices
          if (!["leve", "pesado"].includes(value)) {
            return "leve";
          }
          return value;
        }
      }),
      price: new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
      durability: new fields.SchemaField({
        current: new fields.NumberField({ required: true, nullable: false, initial: 3, min: 0, max: 3, integer: true }),
        max: new fields.NumberField({ required: true, nullable: false, initial: 3, min: 3, max: 3, integer: true })
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
    
    // Automatically set equipped based on hand usage
    // A weapon is equipped if it's in at least one hand
    this.equipped = this.rightHand || this.leftHand;

    // Calculate damage total with ability modifier
    this._calculateDamageTotal();
  }

  /**
   * Calculate the total damage including ability modifier
   * @private
   */
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
    }

    // Calculate total damage
    if (abilityBonus > 0) {
      // Check if base damage is a simple number that can be added directly
      const baseDamageNum = parseInt(baseDamage);
      if (!isNaN(baseDamageNum)) {
        // Base damage is a simple number, calculate the sum
        const total = baseDamageNum + abilityBonus;
        this.damage.total = `${total}`;
      } else if (baseDamage !== "0" && baseDamage !== "") {
        // Base damage is a dice formula or complex string, append the bonus
        this.damage.total = `${baseDamage} + ${abilityBonus}`;
      } else {
        // If base damage is 0 or empty, just show the ability bonus
        this.damage.total = `${abilityBonus}`;
      }
    } else {
      // No ability bonus, just use base damage
      this.damage.total = baseDamage;
    }
  }
}
