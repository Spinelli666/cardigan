export default class CardiganSystemActorBase extends foundry.abstract
  .TypeDataModel {
  static LOCALIZATION_PREFIXES = ["CARDIGAN.Actor.base"];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.health = new fields.SchemaField({
      value: new fields.NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0,
      }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });
    schema.power = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });
    
    // Character details
    schema.details = new fields.SchemaField({
      name: new fields.StringField({ initial: "" }),
      age: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      race: new fields.StringField({ initial: "" }),
      movement: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      criticalHit: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });
    
    // Character classes
    schema.classes = new fields.SchemaField({
      andarilho: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      guerreiro: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      ladino: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      feiticeiro: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });
    
    // Experience points
    schema.experience = new fields.SchemaField({
      current: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      nextLevel: new fields.NumberField({ ...requiredInteger, initial: 100, min: 0 }),
    });
    
    schema.biography = new fields.HTMLField();

    return schema;
  }
}
