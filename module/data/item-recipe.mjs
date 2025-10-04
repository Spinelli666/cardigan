import CardiganSystemItemBase from './base-item.mjs';

export default class CardiganSystemItemRecipe extends CardiganSystemItemBase {
  static LOCALIZATION_PREFIXES = [
    'CARDIGAN.Item.base',
    'CARDIGAN.Item.ItemRecipe',
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

    // Recipe specific fields
    schema.ingredients = new fields.StringField({
      required: true,
      blank: true,
      initial: "Add ingredients here...",
      label: "CARDIGAN.Item.ItemRecipe.ingredients.label",
      hint: "CARDIGAN.Item.ItemRecipe.ingredients.hint"
    });

    schema.difficulty = new fields.StringField({
      required: true,
      blank: false,
      initial: "easy",
      choices: {
        "easy": "CARDIGAN.Item.ItemRecipe.difficulty.easy",
        "medium": "CARDIGAN.Item.ItemRecipe.difficulty.medium", 
        "hard": "CARDIGAN.Item.ItemRecipe.difficulty.hard",
        "master": "CARDIGAN.Item.ItemRecipe.difficulty.master"
      },
      label: "CARDIGAN.Item.ItemRecipe.difficulty.label",
      hint: "CARDIGAN.Item.ItemRecipe.difficulty.hint"
    });

    schema.cookingTime = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 10,
      min: 1,
      label: "CARDIGAN.Item.ItemRecipe.cookingTime.label",
      hint: "CARDIGAN.Item.ItemRecipe.cookingTime.hint"
    });

    schema.servings = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 1,
      min: 1,
      label: "CARDIGAN.Item.ItemRecipe.servings.label",
      hint: "CARDIGAN.Item.ItemRecipe.servings.hint"
    });

    schema.consumableType = new fields.StringField({
      required: true,
      blank: false,
      initial: "food",
      choices: {
        "food": "CARDIGAN.Item.ItemRecipe.consumableType.food",
        "drink": "CARDIGAN.Item.ItemRecipe.consumableType.drink",
        "potion": "CARDIGAN.Item.ItemRecipe.consumableType.potion",
        "other": "CARDIGAN.Item.ItemRecipe.consumableType.other"
      },
      label: "CARDIGAN.Item.ItemRecipe.consumableType.label",
      hint: "CARDIGAN.Item.ItemRecipe.consumableType.hint"
    });

    schema.effects = new fields.StringField({
      required: false,
      blank: true,
      initial: "",
      label: "CARDIGAN.Item.ItemRecipe.effects.label",
      hint: "CARDIGAN.Item.ItemRecipe.effects.hint"
    });

    // Required ingredients for crafting
    schema.requiredIngredients = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField({
          required: true,
          blank: false,
          initial: "",
          label: "CARDIGAN.Item.ItemRecipe.IngredientName"
        }),
        quantity: new fields.NumberField({
          required: true,
          nullable: false,
          integer: true,
          initial: 1,
          min: 1,
          label: "CARDIGAN.Item.ItemRecipe.IngredientQuantity"
        }),
        img: new fields.StringField({
          required: false,
          blank: true,
          initial: "icons/svg/item-bag.svg",
          label: "CARDIGAN.Item.ItemRecipe.IngredientImage"
        })
      }),
      {
        initial: [],
        label: "CARDIGAN.Item.ItemRecipe.RequiredIngredients",
        hint: "CARDIGAN.Item.ItemRecipe.RequiredIngredientsHint"
      }
    );

    return schema;
  }
}