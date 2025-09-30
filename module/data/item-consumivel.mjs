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

    // Effects system (similar to skillBonuses from weapons)
    schema.effects = new fields.ArrayField(
      new fields.SchemaField({
        effectId: new fields.StringField({ required: true, blank: true, initial: "" }),
        apply: new fields.BooleanField({ required: true, initial: false }),
        remove: new fields.BooleanField({ required: true, initial: false })
      }),
      { initial: [] }
    );

    // Controls whether skill check section is enabled
    schema.hasSkillCheck = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasSkillCheck"
    });

    // Skill check ability selection
    schema.skillCheckAbility = new fields.StringField({
      required: false,
      blank: true,
      initial: "accuracy",
      choices: {
        "accuracy": "CARDIGAN.Ability.Accuracy.long",
        "evasion": "CARDIGAN.Ability.Evasion.long",
        "strength": "CARDIGAN.Ability.Strength.long",
        "dexterity": "CARDIGAN.Ability.Dexterity.long",
        "stamina": "CARDIGAN.Ability.Stamina.long",
        "stealth": "CARDIGAN.Ability.Stealth.long",
        "persuasion": "CARDIGAN.Ability.Persuasion.long",
        "intelligence": "CARDIGAN.Ability.Intelligence.long",
        "psionics": "CARDIGAN.Ability.Psionics.long"
      },
      label: "CARDIGAN.ItemConsumivel.SkillCheckAbility"
    });

    // Whether skill check has advantage
    schema.skillCheckAdvantage = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.SkillCheckAdvantage"
    });

    // Critical failure effects system
    schema.hasCriticalFailureEffects = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasCriticalFailureEffects"
    });

    schema.criticalFailureEffects = new fields.ArrayField(
      new fields.StringField({ required: true, blank: true, initial: "" }),
      { initial: [] }
    );

    // Critical failure skill loss system
    schema.hasCriticalFailureSkillLoss = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasCriticalFailureSkillLoss"
    });

    schema.criticalFailureSkillLoss = new fields.ArrayField(
      new fields.SchemaField({
        ability: new fields.StringField({
          required: true,
          initial: "accuracy",
          choices: {
            "accuracy": "CARDIGAN.Ability.Accuracy.long",
            "evasion": "CARDIGAN.Ability.Evasion.long",
            "strength": "CARDIGAN.Ability.Strength.long",
            "dexterity": "CARDIGAN.Ability.Dexterity.long",
            "stamina": "CARDIGAN.Ability.Stamina.long",
            "stealth": "CARDIGAN.Ability.Stealth.long",
            "persuasion": "CARDIGAN.Ability.Persuasion.long",
            "intelligence": "CARDIGAN.Ability.Intelligence.long",
            "psionics": "CARDIGAN.Ability.Psionics.long"
          }
        }),
        value: new fields.NumberField({
          required: true,
          initial: 1,
          min: 1,
          integer: true
        })
      }),
      { initial: [] }
    );

    // Controls whether effects section is enabled
    schema.hasEffects = new fields.BooleanField({
      required: true,
      initial: false,
      label: "CARDIGAN.ItemConsumivel.HasEffects"
    });

    // Modifiers system
    schema.modifiers = new fields.SchemaField({
      // Status effects (checkboxes)
      statusEffects: new fields.SchemaField({
        fome: new fields.NumberField({ required: true, initial: 0 }),
        sede: new fields.NumberField({ required: true, initial: 0 }),
        fratura: new fields.NumberField({ required: true, initial: 0 }),
        sanidade: new fields.NumberField({ required: true, initial: 0 }),
        toxidade: new fields.NumberField({ required: true, initial: 0 })
      }),

      // Skill effects
      skillEffects: new fields.ArrayField(new fields.SchemaField({
        skill: new fields.StringField({ 
          required: true, 
          blank: false, 
          initial: "vigor",
          choices: {
            "vigor": "CARDIGAN.Vigor",
            "agilidade": "CARDIGAN.Agilidade", 
            "intelecto": "CARDIGAN.Intelecto",
            "presenca": "CARDIGAN.Presenca",
            "forca": "CARDIGAN.Forca"
          }
        }),
        operation: new fields.StringField({ 
          required: true, 
          initial: "add",
          choices: {
            "add": "CARDIGAN.Modifiers.Add",
            "subtract": "CARDIGAN.Modifiers.Subtract",
            "multiply": "CARDIGAN.Modifiers.Multiply"
          }
        }),
        value: new fields.NumberField({ required: true, initial: 1 }),
        duration: new fields.StringField({
          required: true,
          initial: "temporary",
          choices: {
            "permanent": "CARDIGAN.Modifiers.Permanent",
            "temporary": "CARDIGAN.Modifiers.Temporary", 
            "scene": "CARDIGAN.Modifiers.Scene",
            "combat": "CARDIGAN.Modifiers.Combat"
          }
        })
      })),

      // Roll system
      rollSystem: new fields.SchemaField({
        enabled: new fields.BooleanField({ required: true, initial: false }),
        diceFormula: new fields.StringField({ 
          required: true, 
          blank: true, 
          initial: "1d20",
          choices: {
            "1d4": "1d4",
            "1d6": "1d6", 
            "1d8": "1d8",
            "1d10": "1d10",
            "1d12": "1d12",
            "1d20": "1d20",
            "2d6": "2d6",
            "3d6": "3d6"
          }
        }),
        skillModifier: new fields.SchemaField({
          skill: new fields.StringField({ 
            required: true, 
            blank: true, 
            initial: "vigor",
            choices: {
              "": "CARDIGAN.None",
              "vigor": "CARDIGAN.Vigor",
              "agilidade": "CARDIGAN.Agilidade",
              "intelecto": "CARDIGAN.Intelecto", 
              "presenca": "CARDIGAN.Presenca",
              "forca": "CARDIGAN.Forca"
            }
          }),
          multiplier: new fields.NumberField({ required: true, initial: 1 }),
          operation: new fields.StringField({
            required: true,
            initial: "add",
            choices: {
              "add": "CARDIGAN.Modifiers.Add",
              "subtract": "CARDIGAN.Modifiers.Subtract",
              "multiply": "CARDIGAN.Modifiers.Multiply"
            }
          })
        }),
        rollDescription: new fields.HTMLField({ required: true, blank: true, initial: "" })
      }),

      // System effects (from compendium)
      systemEffects: new fields.ArrayField(new fields.SchemaField({
        effectId: new fields.StringField({ required: true, blank: false }),
        duration: new fields.StringField({
          required: true,
          initial: "temporary",
          choices: {
            "permanent": "CARDIGAN.Modifiers.Permanent",
            "temporary": "CARDIGAN.Modifiers.Temporary",
            "scene": "CARDIGAN.Modifiers.Scene", 
            "combat": "CARDIGAN.Modifiers.Combat"
          }
        }),
        operation: new fields.StringField({
          required: true,
          initial: "apply",
          choices: {
            "apply": "CARDIGAN.Modifiers.Apply",
            "remove": "CARDIGAN.Modifiers.Remove"
          }
        })
      })),

      // Usage settings
      usage: new fields.SchemaField({
        consumeOnUse: new fields.BooleanField({ required: true, initial: true }),
        usesPerDay: new fields.NumberField({ required: true, initial: 0, min: 0 }),
        currentUses: new fields.NumberField({ required: true, initial: 0, min: 0 })
      })
    });

    return schema;
  }
}