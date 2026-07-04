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
      
      protection: new NumberField({
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
      coldResistance: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        min: 0
      }),
      stylish: new BooleanField({initial: false}),
      single: new BooleanField({initial: false}),
      
      lifeBonus: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0
      }),

      energyBonus: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0
      }),

      movementBonus: new SchemaField({
        enabled: new BooleanField({initial: false}),
        bonus: new NumberField({
          required: true,
          nullable: false,
          integer: true,
          initial: 0
        })
      }),

      backpackBonus: new SchemaField({
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
    this._normalizeBonusFields();
    
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
    this.hasMovementBonus = this.movementBonus.enabled && this.movementBonus.bonus !== 0;
    this.hasAttributeBonus = this.lifeBonus !== 0 || this.energyBonus !== 0;
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

    if (this.resistenciaFrio !== undefined && this.coldResistance === undefined) {
      this.coldResistance = this.resistenciaFrio ? 1 : 0;
    }
  }

  /**
   * Normalize armor bonus fields to the canonical nested structure.
   * @private
   */
  _normalizeBonusFields() {
    this._syncBonusEnabledState("movementBonus");
    this._syncBonusEnabledState("backpackBonus");
  }

  /**
   * Move a flat legacy bonus field into the nested armor structure.
   * @param {string} legacyKey - Legacy flat field name
   * @param {string} targetKey - Canonical nested field name
   * @private
   */
  _migrateLegacyBonusField(legacyKey, targetKey) {
    const legacyValue = Number(this[legacyKey]);
    if (!Number.isFinite(legacyValue)) return;

    const target = this[targetKey] ?? { enabled: false, bonus: 0 };
    const currentBonus = Number(target.bonus ?? 0);

    if (!Number.isFinite(currentBonus) || currentBonus === 0) {
      target.bonus = legacyValue;
    }

    this[targetKey] = target;
  }

  /**
   * Keep enabled flags aligned with the stored numeric bonus.
   * @param {string} fieldKey - Canonical nested field name
   * @private
   */
  _syncBonusEnabledState(fieldKey) {
    const field = this[fieldKey] ?? { enabled: false, bonus: 0 };
    const numericBonus = Number(field.bonus ?? 0);
    const normalizedBonus = Number.isFinite(numericBonus) ? numericBonus : 0;

    field.bonus = normalizedBonus;
    field.enabled = normalizedBonus !== 0;

    this[fieldKey] = field;
  }
}