import BaseItemData from "./base-item.mjs";

const { NumberField, StringField, BooleanField, ArrayField, SchemaField, ObjectField } = foundry.data.fields;

/**
 * Data definition for Armor items.
 * @extends {BaseItemData}
 */
export default class ArmorData extends BaseItemData {

  /** @inheritdoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const parentSchema = super.defineSchema();
    
    return {
      ...parentSchema,
      
      // Basic armor properties
      armorType: new StringField({
        required: true,
        initial: "torso",
        choices: {
          "cabeca": "CARDIGAN.ArmorType.Cabeca",
          "acessorios": "CARDIGAN.ArmorType.Acessorios",
          "torso": "CARDIGAN.ArmorType.Torso",
          "bracos": "CARDIGAN.ArmorType.Bracos",
          "pernas": "CARDIGAN.ArmorType.Pernas",
          "pes": "CARDIGAN.ArmorType.Pes"
        }
      }),
      
      // Armor protection value
      protecao: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        min: 0
      }),
      
      // Armor class/type description (like weaponType in weapons)
      armorClass: new StringField({
        required: false, 
        blank: true, 
        initial: ""
      }),
      
      // Equipment status
      equipped: new BooleanField({initial: false}),
      
      // Skill bonus
      // Skill bonuses (array like weapons)
      skillBonuses: new ArrayField(new SchemaField({
        skill: new StringField({initial: ""}),
        bonus: new NumberField({
          required: true,
          nullable: false,
          integer: true,
          initial: 0
        })
      })),
      
      // Magic artifact (same as weapons)
      magicalArtifact: new BooleanField({initial: false}),
      
      // Cold resistance
      resistenciaFrio: new BooleanField({initial: false}),
      
      // Stylish
      stylish: new BooleanField({initial: false}),
      
      // Life and energy bonuses
      bonusVida: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0
      }),
      
      bonusEnergia: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0
      }),
      
      // Movement bonus
      bonusDeslocamento: new SchemaField({
        enabled: new BooleanField({initial: false}),
        bonus: new NumberField({
          required: true,
          nullable: false,
          integer: true,
          initial: 0
        })
      }),

      // Backpack space bonus
      bonusEspacoMochila: new SchemaField({
        enabled: new BooleanField({initial: false}),
        bonus: new NumberField({
          required: true,
          nullable: false,
          integer: true,
          initial: 0,
          min: 0
        })
      }),
      
      // Weight and price
      weight: new StringField({
        required: true,
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
      
      price: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        min: 0
      }),
      
      // Durability (same as weapons)
      durability: new SchemaField({
        current: new NumberField({
          required: true,
          nullable: false,
          integer: true,
          initial: 3,
          min: 0,
          max: 3
        }),
        max: new NumberField({
          required: true,
          nullable: false,
          integer: true,
          initial: 3,
          min: 1
        })
      })
    };
  }

  /** @inheritdoc */
  prepareDerivedData() {
    super.prepareDerivedData();
    
    // Clean old field names for backward compatibility
    this._cleanLegacyFields();
    
    // Ensure skillBonuses is always an array
    if (!Array.isArray(this.skillBonuses)) {
      this.skillBonuses = [];
    }
    
    // Set armor type order for sorting
    const typeOrder = {
      "cabeca": 1,
      "acessorios": 2,
      "torso": 3,
      "bracos": 4,
      "pernas": 5,
      "pes": 6
    };
    
    this.typeOrder = typeOrder[this.armorType] || 99;
    
    // Calculate derived values
    this.isDamaged = this.durability.current < this.durability.max;
    this.isBroken = this.durability.current <= 0;
    this.hasSkillBonus = this.skillBonuses && this.skillBonuses.length > 0 && this.skillBonuses.some(bonus => bonus.skill && bonus.bonus !== 0);
    this.hasMovementBonus = this.bonusDeslocamento.enabled && this.bonusDeslocamento.bonus !== 0;
    this.hasAttributeBonus = this.bonusVida !== 0 || this.bonusEnergia !== 0;
  }

  /**
   * Clean legacy field names for backward compatibility
   * @private
   */
  _cleanLegacyFields() {
    // Convert old durabilidade to durability
    if (this.durabilidade && !this.durability) {
      this.durability = {
        current: this.durabilidade.value || this.durabilidade.current || 3,
        max: this.durabilidade.max || 3
      };
      delete this.durabilidade;
    }
    
    // Convert old propriedades to properties
    if (this.propriedades && !this.properties) {
      this.properties = this.propriedades || [];
      delete this.propriedades;
    }
    
    // Convert old artefatoMagico to magicalArtifact
    if (this.artefatoMagico !== undefined && this.magicalArtifact === undefined) {
      this.magicalArtifact = this.artefatoMagico;
      delete this.artefatoMagico;
    }
  }
}