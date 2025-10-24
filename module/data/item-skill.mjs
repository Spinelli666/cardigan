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
      choices: CONFIG.CARDIGAN.skillTypes,
      label: 'CARDIGAN.Item.Skill.Type'
    });

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