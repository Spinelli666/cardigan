import CardiganSystemItemBase from './base-item.mjs';

export default class CardiganSystemItemRecipe extends CardiganSystemItemBase {
  static LOCALIZATION_PREFIXES = [
    'CARDIGAN.Item.base',
    'CARDIGAN.Item.ItemRecipe',
  ];

  static RECIPE_TYPE_CHOICES = {
    "culinary": "CARDIGAN.Item.ItemRecipe.recipeType.culinary",
    "tailoring": "CARDIGAN.Item.ItemRecipe.recipeType.tailoring",
    "tecnomagic": "CARDIGAN.Item.ItemRecipe.recipeType.tecnomagic",
    "blacksmithing": "CARDIGAN.Item.ItemRecipe.recipeType.blacksmithing",
    "alchemy": "CARDIGAN.Item.ItemRecipe.recipeType.alchemy"
  };

  static DIFFICULTY_CHOICES = {
    "easy": "CARDIGAN.Item.ItemRecipe.difficulty.easy",
    "medium": "CARDIGAN.Item.ItemRecipe.difficulty.medium",
    "hard": "CARDIGAN.Item.ItemRecipe.difficulty.hard",
    "master": "CARDIGAN.Item.ItemRecipe.difficulty.master"
  };

  static CONSUMABLE_TYPE_CHOICES = {
    "food": "CARDIGAN.Item.ItemRecipe.consumableType.food",
    "drink": "CARDIGAN.Item.ItemRecipe.consumableType.drink",
    "potion": "CARDIGAN.Item.ItemRecipe.consumableType.potion",
    "other": "CARDIGAN.Item.ItemRecipe.consumableType.other"
  };

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
      initial: "light"
    });

    schema.price = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 0,
      min: 0,
    });

    // Recipe type (profession)
    schema.recipeType = new fields.StringField({
      required: true,
      blank: false,
      initial: "culinary",
      choices: CardiganSystemItemRecipe.RECIPE_TYPE_CHOICES,
      label: "CARDIGAN.Item.ItemRecipe.recipeType.label",
      hint: "CARDIGAN.Item.ItemRecipe.recipeType.hint"
    });

    // Recipe specific fields
    schema.difficulty = new fields.StringField({
      required: true,
      blank: false,
      initial: "easy",
      choices: CardiganSystemItemRecipe.DIFFICULTY_CHOICES,
      label: "CARDIGAN.Item.ItemRecipe.difficulty.label",
      hint: "CARDIGAN.Item.ItemRecipe.difficulty.hint"
    });

    schema.consumableType = new fields.StringField({
      required: true,
      blank: false,
      initial: "food",
      choices: CardiganSystemItemRecipe.CONSUMABLE_TYPE_CHOICES,
      label: "CARDIGAN.Item.ItemRecipe.consumableType.label",
      hint: "CARDIGAN.Item.ItemRecipe.consumableType.hint"
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
          initial: "systems/cardigan/assets/images/decorative/icons/icon-item-generic.svg",
          label: "CARDIGAN.Item.ItemRecipe.IngredientImage"
        })
      }),
      {
        initial: [],
        label: "CARDIGAN.Item.ItemRecipe.RequiredIngredients",
        hint: "CARDIGAN.Item.ItemRecipe.RequiredIngredientsHint"
      }
    );

    // Result items - multiple possible outputs from this recipe
    schema.resultItems = new fields.ArrayField(
      new fields.SchemaField({
        uuid: new fields.StringField({
          required: false,
          blank: true,
          initial: "",
          label: "CARDIGAN.Item.ItemRecipe.ResultItemUUID",
          hint: "CARDIGAN.Item.ItemRecipe.ResultItemUUIDHint"
        }),
        name: new fields.StringField({
          required: true,
          blank: false,
          initial: "",
          label: "CARDIGAN.Item.ItemRecipe.ResultItemName"
        }),
        img: new fields.StringField({
          required: false,
          blank: true,
          initial: "systems/cardigan/assets/images/decorative/icons/icon-item-generic.svg",
          label: "CARDIGAN.Item.ItemRecipe.ResultItemImage"
        }),
        quantity: new fields.NumberField({
          required: true,
          nullable: false,
          integer: true,
          initial: 1,
          min: 1,
          label: "CARDIGAN.Item.ItemRecipe.ResultItemQuantity"
        }),
        isDefault: new fields.BooleanField({
          required: false,
          initial: false,
          label: "CARDIGAN.Item.ItemRecipe.ResultItemDefault",
          hint: "CARDIGAN.Item.ItemRecipe.ResultItemDefaultHint"
        }),
        // Specific ingredients required for THIS result item
        requiredIngredients: new fields.ArrayField(
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
              initial: "systems/cardigan/assets/images/decorative/icons/icon-item-generic.svg",
              label: "CARDIGAN.Item.ItemRecipe.IngredientImage"
            })
          }),
          {
            initial: [],
            label: "CARDIGAN.Item.ItemRecipe.ResultItemIngredients",
            hint: "CARDIGAN.Item.ItemRecipe.ResultItemIngredientsHint"
          }
        ),
        // Custom properties to override/extend base item properties
        customProperties: new fields.SchemaField({
          // Weapon properties
          damage: new fields.StringField({ required: false, blank: true }),
          weaponType: new fields.StringField({ required: false, blank: true }),
          properties: new fields.ArrayField(
            new fields.StringField({ required: false }),
            { required: false, initial: [] }
          ),
          
          // Armor properties
          protection: new fields.NumberField({ required: false, min: 0 }),
          armorType: new fields.StringField({ required: false, blank: true }),
          armorClass: new fields.StringField({ required: false, blank: true }),
          durability: new fields.SchemaField({
            current: new fields.NumberField({ required: false, min: 0 }),
            max: new fields.NumberField({ required: false, min: 0 })
          }, { required: false }),
          
          // Consumable properties (Culinary/Alchemy)
          quality: new fields.NumberField({ required: false, min: 1, max: 6 }),
          toxicity: new fields.StringField({ required: false, blank: true }),
          hpPerDay: new fields.NumberField({ required: false, min: 0 }),
          consumableType: new fields.StringField({ required: false, blank: true }),
          potency: new fields.StringField({ required: false, blank: true }),
          duration: new fields.StringField({ required: false, blank: true }),
          effectType: new fields.StringField({ required: false, blank: true }),
          
          // General properties
          weight: new fields.StringField({ required: false, blank: true }),
          price: new fields.NumberField({ required: false, min: 0 }),
          description: new fields.StringField({ required: false, blank: true })
        }, { 
          required: false,
          label: "CARDIGAN.Item.ItemRecipe.CustomProperties",
          hint: "CARDIGAN.Item.ItemRecipe.CustomPropertiesHint"
        })
      }),
      {
        initial: [],
        label: "CARDIGAN.Item.ItemRecipe.ResultItems",
        hint: "CARDIGAN.Item.ItemRecipe.ResultItemsHint"
      }
    );

    return schema;
  }

  static createRecipe(name, options = {}) {
    return {
      name: name,
      type: 'recipe',
      img: options.img || 'icons/svg/book.svg',
      system: {
        description: options.description || '',
        quantity: options.quantity || 1,
        weight: options.weight || 'light',
        price: options.price || 0,
        recipeType: options.recipeType || 'culinary',
        difficulty: options.difficulty || 'easy',
        consumableType: options.consumableType || 'food',
        requiredIngredients: options.requiredIngredients || [],
        resultItems: options.resultItems || []
      }
    };
  }
}