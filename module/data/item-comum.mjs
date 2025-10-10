import CardiganSystemItemBase from './base-item.mjs';

export default class CardiganSystemItemComum extends CardiganSystemItemBase {
  static LOCALIZATION_PREFIXES = [
    'CARDIGAN.Item.base',
    'CARDIGAN.Item.ItemComum',
  ];

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
      initial: "leve"
    });

    schema.price = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 0,
      min: 0,
    });

    // Common item fields
    schema.category = new fields.StringField({
      required: false,
      initial: "misc",
      choices: {
        "equipment": "CARDIGAN.ItemComum.Categories.Equipment",
        "tool": "CARDIGAN.ItemComum.Categories.Tool",
        "misc": "CARDIGAN.ItemComum.Categories.Misc",
        "valuable": "CARDIGAN.ItemComum.Categories.Valuable"
      }
    });

    schema.usage = new fields.StringField({ required: false, blank: true });

    return schema;
  }
}