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
      min: 1,
    });

    schema.weight = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 0,
      min: 0,
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

    schema.damageBonus = new fields.StringField({ required: false, blank: true });
    
    schema.rangeModifier = new fields.NumberField({
      required: false,
      nullable: false,
      initial: 0
    });
    
    schema.properties = new fields.StringField({ required: false, blank: true });

    return schema;
  }
}