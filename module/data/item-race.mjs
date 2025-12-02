import CardiganSystemItemBase from './base-item.mjs';

const { StringField, NumberField, ArrayField, SchemaField } = foundry.data.fields;

export default class CardiganSystemRace extends CardiganSystemItemBase {
  static LOCALIZATION_PREFIXES = [
    'CARDIGAN.Item.base',
    'CARDIGAN.Item.Race',
  ];

  static defineSchema() {
    const schema = super.defineSchema();
    
    // Racial movement bonus
    schema.movementBonus = new NumberField({
      required: true,
      nullable: false,
      initial: 0,
      integer: true,
      min: 0,
      label: 'CARDIGAN.Item.Race.FIELDS.movementBonus.label',
      hint: 'CARDIGAN.Item.Race.FIELDS.movementBonus.hint'
    });
    
    // Health bonus
    schema.healthBonus = new NumberField({
      required: true,
      nullable: false,
      initial: 0,
      integer: true,
      label: 'CARDIGAN.Item.Race.FIELDS.healthBonus.label',
      hint: 'CARDIGAN.Item.Race.FIELDS.healthBonus.hint'
    });
    
    // Power/Energy bonus
    schema.powerBonus = new NumberField({
      required: true,
      nullable: false,
      initial: 0,
      integer: true,
      label: 'CARDIGAN.Item.Race.FIELDS.powerBonus.label',
      hint: 'CARDIGAN.Item.Race.FIELDS.powerBonus.hint'
    });
    
    // Racial skills (Array of skill objects with id, name, img, and uuid)
    schema.racialSkills = new ArrayField(
      new SchemaField({
        id: new StringField({ required: true }),
        name: new StringField({ required: true }),
        img: new StringField({ required: false, initial: 'icons/svg/item-bag.svg' }),
        uuid: new StringField({ required: true })
      }),
      {
        required: false,
        initial: [],
        label: 'CARDIGAN.Item.Race.FIELDS.racialSkills.label',
        hint: 'CARDIGAN.Item.Race.FIELDS.racialSkills.hint'
      }
    );
    
    // Ability modifiers
    schema.abilityModifiers = new SchemaField({
      accuracy: new NumberField({ initial: 0, integer: true }),
      evasion: new NumberField({ initial: 0, integer: true }),
      strength: new NumberField({ initial: 0, integer: true }),
      dexterity: new NumberField({ initial: 0, integer: true }),
      stamina: new NumberField({ initial: 0, integer: true }),
      stealth: new NumberField({ initial: 0, integer: true }),
      persuasion: new NumberField({ initial: 0, integer: true }),
      intelligence: new NumberField({ initial: 0, integer: true }),
      psionics: new NumberField({ initial: 0, integer: true })
    }, {
      label: 'CARDIGAN.Item.Race.FIELDS.abilityModifiers.label',
      hint: 'CARDIGAN.Item.Race.FIELDS.abilityModifiers.hint'
    });
    
    return schema;
  }
}
