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
      initial: "leve"
    });

    // Ingredient-specific fields
    schema.profession = new fields.StringField({
      required: false,
      initial: "general",
      choices: {
        "general": "CARDIGAN.ItemIngredient.Professions.General",
        "alchemy": "CARDIGAN.ItemIngredient.Professions.Alchemy",
        "blacksmithing": "CARDIGAN.ItemIngredient.Professions.Blacksmithing",
        "carpentry": "CARDIGAN.ItemIngredient.Professions.Carpentry",
        "culinary": "CARDIGAN.ItemIngredient.Professions.Culinary",
        "tailoring": "CARDIGAN.ItemIngredient.Professions.Tailoring",
        "tecnomagic": "CARDIGAN.ItemIngredient.Professions.Tecnomagic"
      }
    });

    return schema;
  }
}