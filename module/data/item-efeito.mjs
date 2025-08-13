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

    return schema;
  }
}
