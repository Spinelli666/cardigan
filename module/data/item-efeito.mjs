import CardiganSystemItemBase from './base-item.mjs';

/**
 * Data definition for Efeito items.
 * @mixes CardiganSystemItemBase
 */
export default class CardiganSystemEfeito extends CardiganSystemItemBase {
  /** @inheritdoc */
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    'CARDIGAN.Item.Efeito',
  ];

  /** @inheritdoc */
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.efeitoType = new fields.StringField({
      required: false,
      blank: true,
      initial: '',
    });

    schema.duration = new fields.NumberField({
      required: false,
      nullable: true,
      integer: true,
      initial: 0,
    });

    schema.active = new fields.BooleanField({
      required: false,
      initial: false,
    });

    // Tracking system for consumable items
    schema.consumableTracking = new fields.SchemaField({
      isTrackingEffect: new fields.BooleanField({
        required: false,
        initial: false,
      }),
      originalItemName: new fields.StringField({
        required: false,
        blank: true,
        initial: '',
      }),
      originalItemId: new fields.StringField({
        required: false,
        blank: true,
        initial: '',
      }),
      rollType: new fields.StringField({
        required: false,
        blank: true,
        initial: 'normal', // 'normal', 'critical-failure', 'critical-hit'
      }),
      appliedEffects: new fields.ArrayField(
        new fields.StringField({ required: false, blank: true }),
        { required: false, initial: [] }
      ),
      appliedSkillBonuses: new fields.ArrayField(
        new fields.SchemaField({
          ability: new fields.StringField({ required: false, blank: true }),
          value: new fields.NumberField({ required: false, integer: true, initial: 0 }),
        }),
        { required: false, initial: [] }
      ),
    });

    // Temporary health tracking fields
    schema.isTemporaryHealth = new fields.BooleanField({
      required: false,
      initial: false,
    });

    schema.healthBonusValue = new fields.NumberField({
      required: false,
      nullable: true,
      initial: 0,
    });

    schema.sourceItemId = new fields.StringField({
      required: false,
      blank: true,
      initial: '',
    });

    schema.sourceItemName = new fields.StringField({
      required: false,
      blank: true,
      initial: '',
    });

    // Temporary energy tracking fields
    schema.isTemporaryEnergy = new fields.BooleanField({
      required: false,
      initial: false,
    });

    schema.energyBonusValue = new fields.NumberField({
      required: false,
      nullable: true,
      initial: 0,
    });

    // Temporary armor tracking fields
    schema.isTemporaryArmor = new fields.BooleanField({
      required: false,
      initial: false,
    });

    schema.armorBonusValue = new fields.NumberField({
      required: false,
      nullable: true,
      initial: 0,
    });

    return schema;
  }
}
