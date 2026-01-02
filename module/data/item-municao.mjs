import CardiganSystemItemBase from './base-item.mjs';

export default class CardiganSystemItemMunicao extends CardiganSystemItemBase {
  static LOCALIZATION_PREFIXES = [
    'CARDIGAN.Item.base',
    'CARDIGAN.Item.ItemMunicao',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.quantity = new fields.NumberField({
      ...requiredInteger,
      initial: 1,
      min: 0,
    });

    schema.weight = new fields.StringField({
      required: true,
      blank: false,
      initial: "leve",
      choices: {
        "leve": "CARDIGAN.WeightLight",
        "medio": "CARDIGAN.WeightMedium",
        "pesado": "CARDIGAN.WeightHeavy"
      }
    });

    schema.price = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 0,
      min: 0,
    });

    schema.isFirearmAmmo = new fields.BooleanField({
      required: true,
      initial: false
    });

    schema.isSpecialAmmo = new fields.BooleanField({
      required: true,
      initial: false
    });

    return schema;
  }
}