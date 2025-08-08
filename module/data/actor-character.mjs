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
      exhaustion: new fields.NumberField({ initial: 0, min: 0, integer: true }), // Pontos de exaustão manual
      totalExhaustion: new fields.NumberField({ initial: 0, min: 0, integer: true }) // Exaustão total (manual + auto)
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
      this.status.hungerMessage = "O personagem está com fome! [0 de Fome e 5 de Exaustão]";
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
      this.status.thirstMessage = "O personagem está com sede! [0 de Sede e 5 de Exaustão]";
    }

    // Calcular exaustão automática por fome e sede
    let autoExhaustion = 0;
    
    // Se fome estiver em 0 (todas desmarcadas), adiciona 5 de exaustão
    if (hungerLevel === 0) {
      autoExhaustion += 5;
    }
    
    // Se sede estiver em 0 (todas desmarcadas), adiciona 5 de exaustão  
    if (thirstLevel === 0) {
      autoExhaustion += 5;
    }
    
    // O totalExhaustion é editado pelo usuário, então calculamos a exaustão manual
    const totalExhaustion = this.status?.totalExhaustion ?? 0;
    const manualExhaustion = Math.max(0, totalExhaustion - autoExhaustion);
    
    // Atualizar os valores calculados
    this.status.autoExhaustion = autoExhaustion;
    this.status.exhaustion = manualExhaustion;
    
    // Se o valor total for menor que a exaustão automática, ajustar o total
    if (totalExhaustion < autoExhaustion) {
      this.status.totalExhaustion = autoExhaustion;
    }
    
    this.status.exhaustionPenalty = -this.status.totalExhaustion;
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
        
        // Aplicar penalidade de exaustão TOTAL em TODAS as perícias
        const totalExhaustion = this.status?.totalExhaustion ?? 0;
        if (totalExhaustion > 0) {
          // Cada ponto de exaustão = -1 no teste de perícia
          data[k].value = (data[k].value || 0) - totalExhaustion;
          console.log(`[CARDIGAN] Aplicando penalidade de exaustão total: ${k} = ${v.value} - ${totalExhaustion} = ${data[k].value}`);
        }
      }
    }

    data.lvl = this.attributes.level.value;
    
    // Adicionar informações de exaustão para uso em macros/rolls
    const manualExhaustion = this.status?.exhaustion ?? 0;
    const autoExhaustion = this.status?.autoExhaustion ?? 0;
    const totalExhaustion = this.status?.totalExhaustion ?? 0;
    
    data.exhaustion = manualExhaustion;
    data.autoExhaustion = autoExhaustion;
    data.totalExhaustion = totalExhaustion;
    data.exhaustionPenalty = -totalExhaustion;

    console.log(`[CARDIGAN] RollData final:`, data);
    return data;
  }
}
