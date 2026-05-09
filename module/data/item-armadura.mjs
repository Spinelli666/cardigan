import BaseItemData from "./base-item.mjs";

const { NumberField, StringField, BooleanField, ArrayField, SchemaField, ObjectField } = foundry.data.fields;

/**
 * Data definition for Armor items.
 * @extends {BaseItemData}
 */
export default class ArmorData extends BaseItemData {

  static ARMOR_TYPE_ORDER = {
    "cabeca": 1,
    "acessorios": 2,
    "torso": 3,
    "bracos": 4,
    "pernas": 5,
    "pes": 6
  };
  
  static DEFAULT_TYPE_ORDER = 99;

  /** @inheritdoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const parentSchema = super.defineSchema();
    
    return {
      ...parentSchema,
      
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
      
      protecao: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        min: 0
      }),
      
      armorClass: new StringField({
        required: false, 
        blank: true, 
        initial: ""
      }),
      
      equipped: new BooleanField({initial: false}),
      
      skillBonuses: new ArrayField(new SchemaField({
        skill: new StringField({initial: ""}),
        bonus: new NumberField({
          required: true,
          nullable: false,
          integer: true,
          initial: 0
        })
      })),
      
      magicalArtifact: new BooleanField({initial: false}),
      resistenciaFrio: new BooleanField({initial: false}),
      stylish: new BooleanField({initial: false}),
      single: new BooleanField({initial: false}),
      
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
      
      bonusDeslocamento: new SchemaField({
        enabled: new BooleanField({initial: false}),
        bonus: new NumberField({
          required: true,
          nullable: false,
          integer: true,
          initial: 0
        })
      }),

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

      quantity: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 1,
        min: 1
      }),
      
      price: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        min: 0
      }),
      
      durability: new SchemaField({
        current: new NumberField({
          required: true,
          nullable: false,
          integer: true,
          initial: 3,
          min: 0
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
    
    this._cleanLegacyFields();
    
    if (!Array.isArray(this.skillBonuses)) {
      this.skillBonuses = [];
    }
    
    this._calculateTypeOrder();
    this._calculateDerivedFlags();
  }

  /**
   * Calculate armor type order for sorting
   * @private
   */
  _calculateTypeOrder() {
    this.typeOrder = ArmorData.ARMOR_TYPE_ORDER[this.armorType] ?? ArmorData.DEFAULT_TYPE_ORDER;
  }

  /**
   * Calculate convenience flags for UI display
   * @private
   */
  _calculateDerivedFlags() {
    this.isDamaged = this.durability.current < this.durability.max;
    this.isBroken = this.durability.current <= 0;
    this.hasSkillBonus = this.skillBonuses?.length > 0 && this.skillBonuses.some(b => b.skill && b.bonus !== 0);
    this.hasMovementBonus = this.bonusDeslocamento.enabled && this.bonusDeslocamento.bonus !== 0;
    this.hasAttributeBonus = this.bonusVida !== 0 || this.bonusEnergia !== 0;
  }

  /**
   * Migrate legacy field names (backward compatibility)
   * @private
   */
  _cleanLegacyFields() {
    if (this.durabilidade && !this.durability) {
      this.durability = {
        current: this.durabilidade.value ?? this.durabilidade.current ?? 3,
        max: this.durabilidade.max ?? 3
      };
    }
    
    if (this.propriedades && !this.properties) {
      this.properties = this.propriedades;
    }
    
    if (this.artefatoMagico !== undefined && this.magicalArtifact === undefined) {
      this.magicalArtifact = this.artefatoMagico;
    }
  }
}