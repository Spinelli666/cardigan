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
      initial: "leve"
    });

    schema.price = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 0,
      min: 0,
    });

    // Ammunition fields
    schema.ammunitionType = new fields.StringField({
      required: false,
      initial: "arrow",
      choices: {
        "arrow": "CARDIGAN.ItemMunicao.Types.Arrow",
        "bolt": "CARDIGAN.ItemMunicao.Types.Bolt", 
        "bullet": "CARDIGAN.ItemMunicao.Types.Bullet",
        "stone": "CARDIGAN.ItemMunicao.Types.Stone",
        "dart": "CARDIGAN.ItemMunicao.Types.Dart"
      }
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