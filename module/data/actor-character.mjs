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
      totalExhaustion: new fields.NumberField({ initial: 0, min: 0, integer: true }), // Exaustão total (manual + auto)
      fracture: new fields.NumberField({ initial: 0, min: 0, integer: true }), // Pontos de fratura
      giftOfLife: new fields.NumberField({ initial: null, min: 0, max: 3, integer: true }), // Radio 0-3 for Gift of Life, null = none selected
      deathSentence: new fields.NumberField({ initial: null, min: 0, max: 3, integer: true }), // Radio 0-3 for Death Sentence, null = none selected
      sanity: new fields.NumberField({ initial: null, min: 0, max: 5, integer: true }), // Radio 0-5 for Sanity levels, null = none selected
      toxicity: new fields.NumberField({ initial: null, min: 0, max: 5, integer: true }), // Radio 0-5 for Toxicity levels, null = none selected
      healthBonus: new fields.NumberField({ initial: 0, integer: true }), // Bonus to maximum health
      energyBonus: new fields.NumberField({ initial: 0, integer: true }), // Bonus to maximum energy  
      armorBonus: new fields.NumberField({ initial: 0, integer: true }) // Bonus to maximum armor
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
    // Regra: cada ponto de Fratura reduz vida e energia máxima em 5
    const fracture = this.status?.fracture ?? 0;
    const fractureReduction = fracture * 5;
    
    // Get bonus values
    const healthBonus = this.status?.healthBonus ?? 0;
    const energyBonus = this.status?.energyBonus ?? 0;
    const armorBonus = this.status?.armorBonus ?? 0;
    
    this.health.max = Math.max(0, 0 + (stamina * 5) + levelBonus - fractureReduction + healthBonus);
    this.power.max = Math.max(0, 0 + (stamina * 5) + levelBonus - fractureReduction + energyBonus);
    this.armor.max = Math.max(0, 0 + armorBonus);
    
    // Ajustar valores atuais se excederem o novo máximo
    if (this.health.value > this.health.max) {
      this.health.value = this.health.max;
    }
    if (this.power.value > this.power.max) {
      this.power.value = this.power.max;
    }
    if (this.armor.value > this.armor.max) {
      this.armor.value = this.armor.max;
    }

    // Calcular Acerto Crítico baseado na Destreza
    // Regra: cada 2 pontos de Destreza reduz o número crítico em 1 (20 base)
    const dexterity = this.abilities?.dexterity?.value ?? 0;
    const dexterityBonus = Math.floor(dexterity / 2);
    this.details.criticalHit = Math.max(1, 20 - dexterityBonus); // Mínimo de 1

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

    // Verificar estado de Sanidade
    const sanityLevel = this.status?.sanity ?? null;
    if (sanityLevel === null || sanityLevel === 0) {
      this.status.sanityMessage = ""; // Estado normal
    } else if (sanityLevel === 1) {
      this.status.sanityMessage = "Ansioso, você está estressado, tenso e desconfiado.";
    } else if (sanityLevel === 2) {
      this.status.sanityMessage = "Paranoico, você está desesperado, neurótico e pessimista.";
    } else if (sanityLevel === 3) {
      this.status.sanityMessage = "Violento, você inconsequente, você está hostil e insensível.";
    } else if (sanityLevel === 4) {
      this.status.sanityMessage = "Vilanesco, você está completamente insano, todos são inimigos e odiáveis.";
    } else if (sanityLevel === 5) {
      this.status.sanityMessage = "Perdido, o narrador assume seu personagem para guiá-lo à auto-destruição.";
    }

    // Verificar estado de Toxicity
    const toxicityLevel = this.status?.toxicity ?? null;
    if (toxicityLevel === null || toxicityLevel === 0) {
      this.status.toxicityMessage = ""; // Estado normal
    } else if (toxicityLevel === 1) {
      this.status.toxicityMessage = "Levemente intoxicado, você sente náusea e tontura.";
    } else if (toxicityLevel === 2) {
      this.status.toxicityMessage = "Intoxicação moderada, você está enjoado e com visão turva.";
    } else if (toxicityLevel === 3) {
      this.status.toxicityMessage = "Severamente intoxicado, você está vomitando e com dores intensas.";
    } else if (toxicityLevel === 4) {
      this.status.toxicityMessage = "Intoxicação crítica, você está delirando e perdendo consciência.";
    } else if (toxicityLevel === 5) {
      this.status.toxicityMessage = "Envenenamento fatal, você está à beira da morte por toxinas.";
    }
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
