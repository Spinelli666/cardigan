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
    
    // Racial skills (UUIDs of skills that come with this race)
    schema.racialSkills = new ArrayField(
      new StringField({ required: false }),
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
