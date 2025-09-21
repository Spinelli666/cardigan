import CardiganSystemItemBase from './base-item.mjs';

export default class CardiganSystemItemConsumivel extends CardiganSystemItemBase {
  static LOCALIZATION_PREFIXES = [
    'CARDIGAN.Item.base',
    'CARDIGAN.Item.ItemConsumivel',
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

    // Consumable fields
    schema.consumableType = new fields.StringField({
      required: false,
      initial: "potion",
      choices: {
        "potion": "CARDIGAN.ItemConsumivel.Types.Potion",
        "food": "CARDIGAN.ItemConsumivel.Types.Food",
        "scroll": "CARDIGAN.ItemConsumivel.Types.Scroll",
        "medicine": "CARDIGAN.ItemConsumivel.Types.Medicine",
        "bomb": "CARDIGAN.ItemConsumivel.Types.Bomb",
        "other": "CARDIGAN.ItemConsumivel.Types.Other"
      }
    });

    schema.useTime = new fields.StringField({
      required: false,
      initial: "action",
      choices: {
        "action": "CARDIGAN.ItemConsumivel.UseTimes.Action",
        "bonus-action": "CARDIGAN.ItemConsumivel.UseTimes.BonusAction",
        "reaction": "CARDIGAN.ItemConsumivel.UseTimes.Reaction",
        "minute": "CARDIGAN.ItemConsumivel.UseTimes.Minute"
      }
    });

    schema.duration = new fields.StringField({ required: false, blank: true });
    schema.effect = new fields.StringField({ required: false, blank: true });
    
    schema.requiresCheck = new fields.BooleanField({
      required: false,
      initial: false
    });
    
    schema.checkDifficulty = new fields.NumberField({
      required: false,
      nullable: false,
      initial: 15,
      choices: {
        10: "10 - CARDIGAN.Difficulty.Easy",
        15: "15 - CARDIGAN.Difficulty.Normal", 
        20: "20 - CARDIGAN.Difficulty.Hard",
        25: "25 - CARDIGAN.Difficulty.VeryHard"
      }
    });

    return schema;
  }
}