import CardiganSystemItemBase from './base-item.mjs';

export default class CardiganSystemItemIngredient extends CardiganSystemItemBase {
  static LOCALIZATION_PREFIXES = [
    'CARDIGAN.Item.base',
    'CARDIGAN.Item.ItemIngredient',
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
      initial: "muito-leve"
    });

    schema.price = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 0,
      min: 0,
    });

    // Ingredient-specific fields
    schema.ingredientType = new fields.StringField({
      required: false,
      initial: "herb",
      choices: {
        "herb": "CARDIGAN.ItemIngredient.Types.Herb",
        "mineral": "CARDIGAN.ItemIngredient.Types.Mineral",
        "animal": "CARDIGAN.ItemIngredient.Types.Animal",
        "magical": "CARDIGAN.ItemIngredient.Types.Magical",
        "chemical": "CARDIGAN.ItemIngredient.Types.Chemical",
        "other": "CARDIGAN.ItemIngredient.Types.Other"
      }
    });

    schema.rarity = new fields.StringField({
      required: false,
      initial: "common",
      choices: {
        "common": "CARDIGAN.ItemIngredient.RarityLevels.Common",
        "uncommon": "CARDIGAN.ItemIngredient.RarityLevels.Uncommon",
        "rare": "CARDIGAN.ItemIngredient.RarityLevels.Rare",
        "very-rare": "CARDIGAN.ItemIngredient.RarityLevels.VeryRare",
        "legendary": "CARDIGAN.ItemIngredient.RarityLevels.Legendary"
      }
    });

    schema.freshness = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 100,
      min: 0,
      max: 100
    });

    schema.origin = new fields.StringField({
      required: false,
      blank: true,
      initial: ""
    });

    schema.craftingProperties = new fields.StringField({
      required: false,
      blank: true,
      initial: ""
    });

    return schema;
  }
}