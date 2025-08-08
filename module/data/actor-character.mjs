import CardiganSystemActorBase from './base-actor.mjs';

export default class CardiganSystemCharacter extends CardiganSystemActorBase {
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    'CARDIGAN.Actor.Character',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.attributes = new fields.SchemaField({
      level: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      }),
    });

    // Iterate over ability names and create a new SchemaField for each.
    schema.abilities = new fields.SchemaField(
      Object.keys(CONFIG.CARDIGAN.abilities).reduce((obj, ability) => {
        obj[ability] = new fields.SchemaField({
          value: new fields.NumberField({
            ...requiredInteger,
            initial: 0,
            min: 0,
          }),
        });
        return obj;
      }, {})
    );

    // Adiciona campos de Fome e Sede (arrays de 3 checkboxes)
    schema.status = new fields.SchemaField({
      hunger: new fields.ArrayField(new fields.BooleanField(), { initial: [true, true, true] }), // Todas marcadas
      thirst: new fields.ArrayField(new fields.BooleanField(), { initial: [true, true, true] }), // Todas marcadas
      exhaustion: new fields.NumberField({ initial: 0, min: 0, integer: true }) // Pontos de exaustão
    });
    return schema;
  }

  prepareDerivedData() {
    // Calculate level automatically based on sum of all classes
    this._calculateLevel();

    // Loop through ability scores to handle labels.
    for (const key in this.abilities) {
      // Handle ability label localization.
      this.abilities[key].label =
        game.i18n.localize(CONFIG.CARDIGAN.abilities[key]) ?? key;
    }

    // Regra: cada ponto de Stamina adiciona +5 à vida máxima e +5 à energia máxima
    const stamina = this.abilities?.stamina?.value ?? 0;
    // Regra: cada level até 10 adiciona +5 à vida e energia máxima
    const level = this.attributes?.level?.value ?? 0;
    const levelBonus = Math.min(level, 10) * 5;
    this.health.max = 0 + (stamina * 5) + levelBonus; // 0 pode ser substituído por um valor base, se desejar
    this.power.max = 0 + (stamina * 5) + levelBonus;

    // Verificar estado de Hunger
    const hunger = this.status?.hunger ?? [];
    const hungerLevel = hunger.filter(Boolean).length; // Conta os checkboxes marcados
    if (hungerLevel === 3) {
      this.status.hungerMessage = ""; // Todas marcadas = sem mensagem (estado normal)
    } else if (hungerLevel === 2) {
      this.status.hungerMessage = "O personagem está ficando com fome. [2 de Fome]";
    } else if (hungerLevel === 1) {
      this.status.hungerMessage = "O personagem está ficando com mais fome. [1 de Fome]";
    } else if (hungerLevel === 0) {
      this.status.hungerMessage = "O personagem está com fome! [0 de Fome]";
    }

    // Verificar estado de Thirst
    const thirst = this.status?.thirst ?? [];
    const thirstLevel = thirst.filter(Boolean).length; // Conta os checkboxes marcados
    if (thirstLevel === 3) {
      this.status.thirstMessage = ""; // Todas marcadas = sem mensagem (estado normal)
    } else if (thirstLevel === 2) {
      this.status.thirstMessage = "O personagem está ficando com sede. [2 de Sede]";
    } else if (thirstLevel === 1) {
      this.status.thirstMessage = "O personagem está ficando com mais sede. [1 de Sede]";
    } else if (thirstLevel === 0) {
      this.status.thirstMessage = "O personagem está com sede! [0 de Sede]";
    }

    // Aplicar penalidade de exaustão nos testes de perícias
    const exhaustion = this.status?.exhaustion ?? 0;
    // A penalidade será aplicada automaticamente nos rolls através do getRollData()
    // Cada ponto de exaustão = -1 em todos os testes de perícias
    this.status.exhaustionPenalty = -exhaustion;
  }

  /**
   * Calculate level automatically based on the sum of all class points
   * @private
   */
  _calculateLevel() {
    if (this.classes) {
      const totalClassPoints = Object.values(this.classes).reduce((sum, classValue) => {
        return sum + (classValue || 0);
      }, 0);
      
      // Set the calculated level
      this.attributes.level.value = totalClassPoints;
    }
  }

  getRollData() {
    const data = {};

    // Copy the ability scores to the top level, so that rolls can use
    // formulas like `@str.value + 4`.
    if (this.abilities) {
      for (let [k, v] of Object.entries(this.abilities)) {
        data[k] = foundry.utils.deepClone(v);
        
        // Aplicar penalidade de exaustão em TODAS as perícias
        const exhaustion = this.status?.exhaustion ?? 0;
        if (exhaustion > 0) {
          // Cada ponto de exaustão = -1 no teste de perícia
          data[k].value = (data[k].value || 0) - exhaustion;
          console.log(`[CARDIGAN] Aplicando penalidade de exaustão: ${k} = ${v.value} - ${exhaustion} = ${data[k].value}`);
        }
      }
    }

    data.lvl = this.attributes.level.value;
    
    // Adicionar informações de exaustão para uso em macros/rolls
    data.exhaustion = this.status?.exhaustion ?? 0;
    data.exhaustionPenalty = -(this.status?.exhaustion ?? 0);

    console.log(`[CARDIGAN] RollData final:`, data);
    return data;
  }
}
