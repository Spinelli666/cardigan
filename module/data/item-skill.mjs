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
          deslocamento: 'Deslocamento',
          passiva: 'Passiva',
          simples: 'Simples',
          reacao: 'Reação',
          postura: 'Postura'
        }
      }),
      {
        required: false,
        initial: ['general'],
        label: 'CARDIGAN.Item.Skill.ActionTypes'
      }
    );

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

    // Spell Categories (only for Feiticeiro skills) - allows multiple selections
    schema.spellCategories = new fields.ArrayField(
      new fields.StringField({
        required: false,
        blank: true,
        choices: () => CONFIG.CARDIGAN?.spellCategories || {
          neutro: 'Neutro',
          feerico: 'Feérico',
          caos: 'Caos',
          necromancia: 'Necromancia'
        }
      }),
      {
        required: false,
        initial: [],
        label: 'CARDIGAN.Item.Skill.SpellCategories'
      }
    );

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

    // Track if energy has been spent (for toggle functionality)
    schema.energySpent = new fields.BooleanField({
      required: false,
      initial: false,
      label: 'CARDIGAN.Item.Skill.EnergySpent'
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

    // Linked skills system
    schema.hasLinkedSkills = new fields.BooleanField({
      required: false,
      initial: false,
      label: 'CARDIGAN.Item.Skill.HasLinkedSkills'
    });

    schema.linkedSkills = new fields.ArrayField(
      new fields.SchemaField({
        id: new fields.StringField({ required: true }),
        name: new fields.StringField({ required: true }),
        img: new fields.StringField({ required: false, initial: '' }),
        uuid: new fields.StringField({ required: true })
      }),
      { initial: [] }
    );

    // Flag to mark if this skill is a linked skill (added by another skill)
    schema.isLinkedSkill = new fields.BooleanField({
      required: false,
      initial: false,
      label: 'CARDIGAN.Item.Skill.IsLinkedSkill'
    });

    // Enhancement linked skill tracking
    schema.enhancementLinkedSkill = new fields.SchemaField({
      isEnhancementLinked: new fields.BooleanField({ required: false, initial: false }),
      parentSkillId: new fields.StringField({ required: false, initial: '' }),
      parentSkillName: new fields.StringField({ required: false, initial: '' }),
      enhancementIndex: new fields.NumberField({ required: false, initial: -1, integer: true })
    }, {
      required: false,
      initial: { isEnhancementLinked: false, parentSkillId: '', parentSkillName: '', enhancementIndex: -1 }
    });

    // Enhancements system - array of 3 enhancements
    schema.enhancements = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField({ required: false, initial: '' }),
        description: new fields.HTMLField({ required: false, initial: '' }),
        hasEnergy: new fields.BooleanField({ required: false, initial: false }),
        energyCost: new fields.NumberField({ required: false, initial: 0, min: 0, integer: true }),
        hasEffects: new fields.BooleanField({ required: false, initial: false }),
        customEffects: new fields.ArrayField(
          new fields.SchemaField({
            id: new fields.StringField({ required: true }),
            name: new fields.StringField({ required: true }),
            img: new fields.StringField({ required: false, initial: '' })
          }),
          { initial: [] }
        ),
        hasLinkedSkills: new fields.BooleanField({ required: false, initial: false }),
        linkedSkills: new fields.ArrayField(
          new fields.SchemaField({
            id: new fields.StringField({ required: false, initial: '' }),
            name: new fields.StringField({ required: true }),
            img: new fields.StringField({ required: false, initial: '' }),
            uuid: new fields.StringField({ required: false, initial: '' })
          }),
          { initial: [] }
        )
      }),
      { initial: [
        { name: '', description: '', hasEnergy: false, energyCost: 0, hasEffects: false, customEffects: [], hasLinkedSkills: false, linkedSkills: [] },
        { name: '', description: '', hasEnergy: false, energyCost: 0, hasEffects: false, customEffects: [], hasLinkedSkills: false, linkedSkills: [] },
        { name: '', description: '', hasEnergy: false, energyCost: 0, hasEffects: false, customEffects: [], hasLinkedSkills: false, linkedSkills: [] }
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
    
    // Calcular efeitos efetivos (base + aprimoramentos ativos)
    this._calculateEffectiveEffects();
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

  /**
   * Calcula os efeitos efetivos da skill (base + aprimoramentos ativos)
   * Retorna array combinado de todos os efeitos customizados
   */
  _calculateEffectiveEffects() {
    const allEffects = [];
    
    // Adiciona efeitos base da skill
    if (this.hasCustomEffects && this.customEffects && Array.isArray(this.customEffects)) {
      allEffects.push(...this.customEffects);
    }

    // Adiciona efeitos dos aprimoramentos ativos
    if (this.acquiredEnhancements && Array.isArray(this.acquiredEnhancements)) {
      for (let i = 0; i < this.acquiredEnhancements.length; i++) {
        // Se o aprimoramento está ativo
        if (this.acquiredEnhancements[i] === true) {
          const enhancement = this.enhancements?.[i];
          
          // Se o aprimoramento tem efeitos customizados
          if (enhancement?.hasEffects && enhancement.customEffects && Array.isArray(enhancement.customEffects)) {
            allEffects.push(...enhancement.customEffects);
          }
        }
      }
    }

    // Remove duplicatas baseado no ID
    const uniqueEffects = [];
    const seenIds = new Set();
    
    for (const effect of allEffects) {
      if (!seenIds.has(effect.id)) {
        seenIds.add(effect.id);
        uniqueEffects.push(effect);
      }
    }

    this.effectiveCustomEffects = uniqueEffects;
  }
}
