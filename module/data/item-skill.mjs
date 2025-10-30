import CardiganSystemItemBase from './base-item.mjs';

export default class CardiganSystemSkill extends CardiganSystemItemBase {
  static LOCALIZATION_PREFIXES = [
    'CARDIGAN.Item.base',
    'CARDIGAN.Item.Skill',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    // Campo de descrição padrão para compatibilidade com templates
    schema.description = new fields.HTMLField({
      required: false,
      initial: '',
      label: 'CARDIGAN.Item.base.description'
    });

    schema.skillDescription = new fields.StringField({
      required: false,
      initial: '',
      label: 'CARDIGAN.Item.Skill.Description'
    });

    schema.skillType = new fields.StringField({
      required: false,
      initial: 'general',
      choices: () => CONFIG.CARDIGAN?.skillTypes || {
        general: 'General',
        extra: 'Extra'
      },
      label: 'CARDIGAN.Item.Skill.Type'
    });

    schema.skillCategory = new fields.StringField({
      required: false,
      initial: 'offensive',
      choices: () => CONFIG.CARDIGAN?.skillCategories || {
        offensive: 'Offensive',
        defensive: 'Defensive',
        support: 'Support'
      },
      label: 'CARDIGAN.Item.Skill.Category'
    });

    schema.skillClass = new fields.StringField({
      required: false,
      initial: 'andarilho',
      choices: () => CONFIG.CARDIGAN?.skillClasses || {
        andarilho: 'Andarilho',
        guerreiro: 'Guerreiro',
        ladino: 'Ladino',
        feiticeiro: 'Feiticeiro',
        raciais: 'Raciais',
        unicas: 'Únicas'
      },
      label: 'CARDIGAN.Item.Skill.Class'
    });

    // Energy consumption fields
    schema.hasEnergyCost = new fields.BooleanField({
      required: false,
      initial: false,
      label: 'CARDIGAN.Item.Skill.HasEnergyCost'
    });

    schema.energyCost = new fields.NumberField({
      required: false,
      initial: 0,
      integer: true,
      min: 0,
      label: 'CARDIGAN.Item.Skill.EnergyCost'
    });

    // Custom effects system
    schema.hasCustomEffects = new fields.BooleanField({
      required: false,
      initial: false,
      label: 'CARDIGAN.Item.Skill.HasCustomEffects'
    });

    schema.customEffects = new fields.ArrayField(
      new fields.SchemaField({
        id: new fields.StringField({ required: true }),
        name: new fields.StringField({ required: true }),
        img: new fields.StringField({ required: false, initial: '' })
      }),
      { initial: [] }
    );

    // Enhancements system - array of 3 enhancements
    schema.enhancements = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField({ required: false, initial: '' }),
        description: new fields.HTMLField({ required: false, initial: '' })
      }),
      { initial: [
        { name: '', description: '' },
        { name: '', description: '' },
        { name: '', description: '' }
      ]}
    );

    // Acquired enhancements - which enhancements the player has unlocked
    schema.acquiredEnhancements = new fields.ArrayField(
      new fields.BooleanField({ required: false, initial: false }),
      { initial: [false, false, false] }
    );

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    
    // Gerar descrição para o template padrão
    this._generateCombinedDescription();
  }

  _generateCombinedDescription() {
    // Usar apenas a descrição da skill
    if (this.skillDescription && !this.description) {
      this.description = `<p>${this.skillDescription}</p>`;
    }
  }
}