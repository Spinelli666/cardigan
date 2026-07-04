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

    schema.effectType = new fields.StringField({
      required: true,
      blank: false,
      initial: 'negative',
      choices: CONFIG.CARDIGAN.effectTypes,
    });

    schema.rounds = new fields.StringField({
      required: true,
      blank: false,
      initial: '0',
      choices: {
        '0': '0',
        '1': '1',
        '2': '2',
        '3': '3',
        '4': '4',
        '5': '5',
        'infinito': 'ထ'
      }
    });

    schema.duration = new fields.NumberField({
      required: false,
      nullable: true,
      integer: true,
      initial: 0,
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
      consumedQuantity: new fields.NumberField({
        required: false,
        integer: true,
        initial: 1,
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
      appliedAttributeModifiers: new fields.ArrayField(
        new fields.SchemaField({
          type: new fields.StringField({ required: false, blank: true }), // 'movement', 'criticalHit'
          ability: new fields.StringField({ required: false, blank: true, initial: '' }),
          amount: new fields.NumberField({ required: false, integer: true, initial: 0 }),
          label: new fields.StringField({ required: false, blank: true, initial: '' }),
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

  static createEffect(name, options = {}) {
    return {
      name: name,
      type: 'efeito',
      img: options.img || 'icons/svg/aura.svg',
      system: {
        description: options.description || '',
        effectType: options.effectType || 'negative',
        duration: options.duration || 0,
        consumableTracking: {
          isTrackingEffect: options.consumableTracking?.isTrackingEffect || false,
          originalItemName: options.consumableTracking?.originalItemName || '',
          originalItemId: options.consumableTracking?.originalItemId || '',
          consumedQuantity: options.consumableTracking?.consumedQuantity || 1,
          rollType: options.consumableTracking?.rollType || 'normal',
          appliedEffects: options.consumableTracking?.appliedEffects || [],
          appliedSkillBonuses: options.consumableTracking?.appliedSkillBonuses || [],
          appliedAttributeModifiers: options.consumableTracking?.appliedAttributeModifiers || []
        },
        isTemporaryHealth: options.isTemporaryHealth || false,
        healthBonusValue: options.healthBonusValue || 0,
        sourceItemId: options.sourceItemId || '',
        sourceItemName: options.sourceItemName || '',
        isTemporaryEnergy: options.isTemporaryEnergy || false,
        energyBonusValue: options.energyBonusValue || 0,
        isTemporaryArmor: options.isTemporaryArmor || false,
        armorBonusValue: options.armorBonusValue || 0
      }
    };
  }
}
