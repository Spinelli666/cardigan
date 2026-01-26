import CardiganSystemItemBase from './base-item.mjs';

export default class CardiganSystemItemMunicao extends CardiganSystemItemBase {
  static LOCALIZATION_PREFIXES = [
    'CARDIGAN.Item.base',
    'CARDIGAN.Item.ItemMunicao',
  ];

  /** Weight choices for ammunition */
  static WEIGHT_CHOICES = {
    "leve": "CARDIGAN.WeightLight",
    "medio": "CARDIGAN.WeightMedium",
    "pesado": "CARDIGAN.WeightHeavy"
  };

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
      choices: CardiganSystemItemMunicao.WEIGHT_CHOICES
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

  /** Create ammunition with default settings - options: {quantity, weight, price, isSpecialAmmo} */
  static createAmmo(name, options = {}) {
    return {
      name,
      type: 'municao',
      system: {
        quantity: options.quantity || 1,
        weight: options.weight || 'leve',
        price: options.price || 0,
        isFirearmAmmo: false,
        isSpecialAmmo: options.isSpecialAmmo || false
      }
    };
  }

  /** Create firearm ammunition - options: {quantity, weight, price, isSpecialAmmo} */
  static createFirearmAmmo(name, options = {}) {
    return {
      name,
      type: 'municao',
      system: {
        quantity: options.quantity || 1,
        weight: options.weight || 'leve',
        price: options.price || 0,
        isFirearmAmmo: true,
        isSpecialAmmo: options.isSpecialAmmo || false
      }
    };
  }
}