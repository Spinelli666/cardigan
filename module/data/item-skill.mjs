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

    // Skill Action Types - agora permite múltiplas seleções
    schema.skillActionTypes = new fields.ArrayField(
      new fields.StringField({
        required: false,
        blank: true,
        choices: () => CONFIG.CARDIGAN?.skillTypes || {
          general: 'General',
          extra: 'Extra',
          active: 'Active',
          foco: 'FOCO',
          deslocamento: 'Deslocamento'
        }
      }),
      {
        required: false,
        initial: ['general'],
        label: 'CARDIGAN.Item.Skill.ActionTypes'
      }
    );

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
        description: new fields.HTMLField({ required: false, initial: '' }),
        hasEnergy: new fields.BooleanField({ required: false, initial: false }),
        energyCost: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true })
      }),
      { initial: [
        { name: '', description: '', hasEnergy: false, energyCost: 0 },
        { name: '', description: '', hasEnergy: false, energyCost: 0 },
        { name: '', description: '', hasEnergy: false, energyCost: 0 }
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

    // Clean up skillActionTypes - remove empty strings
    if (this.skillActionTypes && Array.isArray(this.skillActionTypes)) {
      this.skillActionTypes = this.skillActionTypes.filter(type => type && type.trim() !== '');
      if (this.skillActionTypes.length === 0) {
        this.skillActionTypes = ['general'];
      }
    }

    // Calcular custo de energia efetivo baseado em aprimoramentos ativos
    this._calculateEffectiveEnergyCost();
  }

  /**
   * Calcula o custo de energia efetivo da skill baseado em aprimoramentos ativos
   */
  _calculateEffectiveEnergyCost() {
    // Se a skill não gasta energia, não há o que calcular
    if (!this.hasEnergyCost) {
      this.effectiveEnergyCost = 0;
      return;
    }

    // Começa com o custo padrão
    let effectiveCost = this.energyCost || 0;

    // Verifica cada aprimoramento ativo
    if (this.acquiredEnhancements && Array.isArray(this.acquiredEnhancements)) {
      for (let i = 0; i < this.acquiredEnhancements.length; i++) {
        // Se o aprimoramento está ativo
        if (this.acquiredEnhancements[i] === true) {
          const enhancement = this.enhancements?.[i];
          
          // Se o aprimoramento tem modificação de energia
          if (enhancement?.hasEnergy && enhancement.energyCost !== undefined) {
            // Usa o custo do aprimoramento
            effectiveCost = enhancement.energyCost;
            break; // Usa apenas o primeiro aprimoramento ativo com energia
          }
        }
      }
    }

    this.effectiveEnergyCost = effectiveCost;
  }
}