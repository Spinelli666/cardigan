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
          bonus: new fields.NumberField({
            initial: 0,
            integer: true
          }),
        });
        return obj;
      }, {})
    );

    // Adiciona campos de status com radio buttons sequenciais
    schema.status = new fields.SchemaField({
      hunger: new fields.NumberField({ initial: 0, min: 0, max: 3, integer: true }), // Radio 0-3 for Hunger, initial 0 = none marked
      thirst: new fields.NumberField({ initial: 0, min: 0, max: 3, integer: true }), // Radio 0-3 for Thirst, initial 0 = none marked
      fracture: new fields.NumberField({ initial: 0, min: 0, max: 5, integer: true }), // Radio 0-5 for Fracture levels
      giftOfLife: new fields.NumberField({ initial: null, min: 0, max: 3, integer: true }), // Radio 0-3 for Gift of Life, null = none selected
      deathSentence: new fields.NumberField({ initial: null, min: 0, max: 3, integer: true }), // Radio 0-3 for Death Sentence, null = none selected
      sanity: new fields.NumberField({ initial: null, min: 0, max: 5, integer: true }), // Radio 0-5 for Sanity levels, null = none selected
      toxicity: new fields.NumberField({ initial: null, min: 0, max: 5, integer: true }), // Radio 0-5 for Toxicity levels, null = none selected
      healthBonus: new fields.NumberField({ initial: 0, integer: true }), // Bonus to maximum health
      energyBonus: new fields.NumberField({ initial: 0, integer: true }), // Bonus to maximum energy  
      armorBonus: new fields.NumberField({ initial: 0, integer: true }) // Bonus to maximum armor
    });

    // Adiciona campos de detalhes incluindo notas adicionais
    schema.details = new fields.SchemaField({
      name: new fields.StringField({ initial: "" }),
      age: new fields.NumberField({ initial: 0, integer: true }),
      race: new fields.StringField({ initial: "" }),
      movement: new fields.NumberField({ initial: 0, integer: true }),
      criticalHit: new fields.NumberField({ initial: 20, integer: true }),
      additionalNotes: new fields.HTMLField({ initial: "" }), // Campo para notas adicionais com suporte a HTML
      showAdditionalNotes: new fields.BooleanField({ initial: true }) // Controle de exibição das notas
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
      
      // Calcular valor final da perícia (value + bonus) para exibição
      const baseValue = this.abilities[key].value || 0;
      const bonus = this.abilities[key].bonus || 0;
      this.abilities[key].total = baseValue + bonus;
    }

    // Regra: cada ponto de Stamina adiciona +5 à vida máxima e +5 à energia máxima
    const stamina = this.abilities?.stamina?.value ?? 0;
    const staminaBonus = this.abilities?.stamina?.bonus ?? 0;
    const totalStamina = stamina + staminaBonus;
    
    // Regra: cada level até 10 adiciona +5 à vida e energia máxima
    const level = this.attributes?.level?.value ?? 0;
    const levelBonus = Math.min(level, 10) * 5;
    
    // NOVA REGRA FRATURA: cada ponto de Fratura reduz vida e energia máxima em 5
    const fractureLevel = this.status?.fracture ?? 0;
    const fractureReduction = fractureLevel * 5;
    
    // Get bonus values
    const healthBonus = this.status?.healthBonus ?? 0;
    const energyBonus = this.status?.energyBonus ?? 0;
    const armorBonus = this.status?.armorBonus ?? 0;
    
    this.health.max = Math.max(0, 0 + (totalStamina * 5) + levelBonus - fractureReduction + healthBonus);
    this.power.max = Math.max(0, 0 + (totalStamina * 5) + levelBonus - fractureReduction + energyBonus);
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
    // Regra: cada 2 pontos de Destreza (valor + bônus) reduz o número crítico em 1 (20 base)
    const dexterity = this.abilities?.dexterity?.value ?? 0;
    const dexterityBonus = this.abilities?.dexterity?.bonus ?? 0;
    const totalDexterity = dexterity + dexterityBonus;
    const dexterityEffect = Math.floor(totalDexterity / 2);
    this.details.criticalHit = Math.max(1, 20 - dexterityEffect); // Mínimo de 1

    // Calcular Deslocamento baseado na Destreza
    // Regra: cada 2 pontos de Destreza (valor + bônus) adiciona 1 ponto de deslocamento
    this.details.movement = dexterityEffect;

    // Verificar estado de Hunger e aplicar efeito de exaustão automaticamente
    const hungerLevel = this.status?.hunger ?? 0;
    const thirstLevel = this.status?.thirst ?? 0;
    
    // Nova lógica: aplicar efeito de exaustão quando fome OU sede = 3
    // Usar setTimeout para não bloquear o prepareDerivedData com async
    if ((hungerLevel === 3 || thirstLevel === 3)) {
      setTimeout(() => {
        this._checkAndApplyExhaustionEffect(hungerLevel, thirstLevel);
      }, 100);
    } else {
      // Verificar se precisa remover efeito existente
      setTimeout(() => {
        this._checkAndApplyExhaustionEffect(hungerLevel, thirstLevel);
      }, 100);
    }

    // Verificar estado de Hunger
    if (hungerLevel === 0) {
      this.status.hungerMessage = ""; // Nenhuma marcada = sem mensagem (estado normal)
    } else if (hungerLevel === 1) {
      this.status.hungerMessage = "O personagem está ficando com fome. [1 de Fome]";
    } else if (hungerLevel === 2) {
      this.status.hungerMessage = "O personagem está ficando com mais fome. [2 de Fome]";
    } else if (hungerLevel === 3) {
      this.status.hungerMessage = "O personagem está faminto! [3 de Fome]";
    }

    // Verificar estado de Thirst
    if (thirstLevel === 0) {
      this.status.thirstMessage = ""; // Nenhuma marcada = sem mensagem (estado normal)
    } else if (thirstLevel === 1) {
      this.status.thirstMessage = "O personagem está ficando com sede. [1 de Sede]";
    } else if (thirstLevel === 2) {
      this.status.thirstMessage = "O personagem está ficando com mais sede. [2 de Sede]";
    } else if (thirstLevel === 3) {
      this.status.thirstMessage = "O personagem está sedento! [3 de Sede]";
    }

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
   * Verifica e aplica/remove o efeito de exaustão baseado em fome e sede
   * Aplica apenas quando fome OU sede chegam ao nível 3 (máximo)
   * @param {number} hungerLevel - Nível atual de fome (0-3)
   * @param {number} thirstLevel - Nível atual de sede (0-3)
   * @private
   */
  async _checkAndApplyExhaustionEffect(hungerLevel, thirstLevel) {
    console.log(`[CARDIGAN DEBUG] Verificando exaustão - Fome: ${hungerLevel}, Sede: ${thirstLevel}`);
    
    const shouldHaveExhaustion = hungerLevel === 3 || thirstLevel === 3;
    console.log(`[CARDIGAN DEBUG] Deve ter exaustão: ${shouldHaveExhaustion}`);
    
    // Verificar efeitos existentes de forma mais detalhada
    console.log(`[CARDIGAN DEBUG] Total de efeitos no ator:`, this.parent.effects.size);
    console.log(`[CARDIGAN DEBUG] Lista de todos os efeitos:`, this.parent.effects.map(e => ({
      name: e.name,
      id: e.id,
      flags: e.flags
    })));
    
    const currentExhaustionEffect = this.parent.effects.find(effect => {
      const isExhaustion = effect.name === "Exaustão" || 
                          effect.label === "Exaustão" ||
                          effect.flags?.cardigan?.source === "hunger_thirst";
      console.log(`[CARDIGAN DEBUG] Verificando efeito "${effect.name}": é exaustão? ${isExhaustion}`);
      return isExhaustion;
    });
    
    console.log(`[CARDIGAN DEBUG] Efeito atual encontrado:`, currentExhaustionEffect ? {
      name: currentExhaustionEffect.name,
      id: currentExhaustionEffect.id,
      flags: currentExhaustionEffect.flags
    } : null);
    
    if (shouldHaveExhaustion && !currentExhaustionEffect) {
      console.log(`[CARDIGAN DEBUG] Aplicando efeito de exaustão...`);
      // Aplicar efeito de exaustão
      await this._applyExhaustionEffect(hungerLevel, thirstLevel);
    } else if (!shouldHaveExhaustion && currentExhaustionEffect) {
      console.log(`[CARDIGAN DEBUG] Removendo efeito de exaustão...`);
      // Remover efeito de exaustão
      await currentExhaustionEffect.delete();
      
      // Forçar atualização da ficha
      if (this.parent.sheet && this.parent.sheet.rendered) {
        this.parent.sheet.render(false);
      }
      
      ChatMessage.create({
        content: `${this.parent.name}: Efeito de Exaustão removido (fome e sede normalizadas).`,
        speaker: ChatMessage.getSpeaker({ actor: this.parent })
      });
    } else {
      console.log(`[CARDIGAN DEBUG] Nenhuma ação necessária. shouldHave: ${shouldHaveExhaustion}, current: ${!!currentExhaustionEffect}`);
    }
  }

  /**
   * Aplica o efeito de exaustão na ficha do personagem (apenas visual, sem penalidades)
   * @param {number} hungerLevel - Nível atual de fome
   * @param {number} thirstLevel - Nível atual de sede
   * @private
   */
  async _applyExhaustionEffect(hungerLevel, thirstLevel) {
    try {
      console.log(`[CARDIGAN DEBUG] Iniciando aplicação de efeito de exaustão...`);
      
      // Buscar o efeito de exaustão no compêndio
      const pack = game.packs.get('cardigan.efeitos-cardigan');
      console.log(`[CARDIGAN DEBUG] Compêndio encontrado: ${!!pack}`);
      
      if (!pack) {
        console.warn('[CARDIGAN] Compêndio de efeitos não encontrado');
        return;
      }
      
      // Carregar o compêndio se necessário
      if (!pack.indexed) {
        console.log(`[CARDIGAN DEBUG] Indexando compêndio...`);
        await pack.getIndex();
      }
      
      console.log(`[CARDIGAN DEBUG] Procurando efeito de exaustão no compêndio...`);
      console.log(`[CARDIGAN DEBUG] Índice do compêndio:`, pack.index.map(e => e.name));
      
      // Encontrar o efeito de exaustão
      const exhaustionEntry = pack.index.find(entry => 
        entry.name === "Exaustão" || entry.name.toLowerCase().includes("exaust")
      );
      
      console.log(`[CARDIGAN DEBUG] Entrada de exaustão encontrada:`, exhaustionEntry);
      
      if (!exhaustionEntry) {
        console.warn('[CARDIGAN] Efeito de Exaustão não encontrado no compêndio');
        return;
      }
      
      // Obter o documento do efeito
      console.log(`[CARDIGAN DEBUG] Carregando documento do efeito...`);
      const exhaustionItem = await pack.getDocument(exhaustionEntry._id);
      if (!exhaustionItem) {
        console.warn('[CARDIGAN] Não foi possível carregar o efeito de Exaustão');
        return;
      }
      
      console.log(`[CARDIGAN DEBUG] Item de exaustão carregado:`, exhaustionItem);
      
      // Criar o efeito na ficha do personagem (apenas visual, sem penalidades)
      const effectData = {
        name: "Exaustão",
        icon: exhaustionItem.img || "systems/cardigan/assets/images/effects/effects_negative.svg",
        origin: this.parent.uuid,
        disabled: false,
        duration: {
          startTime: null,
          seconds: null,
          rounds: null,
          turns: null,
          startRound: null,
          startTurn: null
        },
        flags: {
          cardigan: {
            source: "hunger_thirst",
            hungerLevel: hungerLevel,
            thirstLevel: thirstLevel,
            description: this._generateExhaustionDescription(),
            descriptionPlainText: this._generateExhaustionDescriptionPlainText()
          }
        },
        changes: [], // Sem penalidades por enquanto
        transfer: false,
        statuses: []
      };
      
      console.log(`[CARDIGAN DEBUG] Dados do efeito criados:`, effectData);
      console.log(`[CARDIGAN DEBUG] Criando efeito no ator...`);
      
      const createdEffects = await this.parent.createEmbeddedDocuments('ActiveEffect', [effectData]);
      console.log(`[CARDIGAN DEBUG] Efeitos criados:`, createdEffects);
      console.log(`[CARDIGAN DEBUG] Total de efeitos no ator após criação:`, this.parent.effects.size);
      
      // Forçar atualização da ficha
      if (this.parent.sheet && this.parent.sheet.rendered) {
        this.parent.sheet.render(false);
      }
      
      console.log(`[CARDIGAN DEBUG] Efeito de exaustão aplicado com sucesso!`);
      
      // Mensagem no chat
      const cause = this._getExhaustionCause(hungerLevel, thirstLevel);
      ChatMessage.create({
        content: `${this.parent.name}: Efeito de Exaustão aplicado automaticamente devido a ${cause}.`,
        speaker: ChatMessage.getSpeaker({ actor: this.parent })
      });
      
    } catch (error) {
      console.error('[CARDIGAN] Erro ao aplicar efeito de exaustão:', error);
    }
  }

  /**
   * Gera descrição do efeito de exaustão usando a descrição do compêndio
   * @returns {string} Descrição do efeito
   * @private
   */
  _generateExhaustionDescription() {
    // Usar sempre a descrição oficial do compêndio para consistência
    return `<p style="text-align: justify">Adquirido de diversas formas mas principalmente ao passar mais de <strong>24h</strong> acordado, ou ao preencher os níveis de <code>🍗</code> / <code>💧</code>, este <em>Efeito Negativo</em> aplica <strong>Desvantagem</strong> cumulativa em todo tipo de teste até que seja removido com um <strong>Descanso</strong>. Caso preencha seus níveis de <code>🍗</code> / <code>💧</code> ao mesmo tempo, este efeito vira uma <strong>Desvantagem Aprimorada</strong> que pode continuar a acumular por outras fontes.</p>`;
  }

  /**
   * Gera versão texto simples da descrição de exaustão para tooltips
   * @returns {string} Descrição em texto simples
   * @private
   */
  _generateExhaustionDescriptionPlainText() {
    return `Adquirido de diversas formas mas principalmente ao passar mais de 24h acordado, ou ao preencher os níveis de 🍗 / 💧, este Efeito Negativo aplica Desvantagem cumulativa em todo tipo de teste até que seja removido com um Descanso. Caso preencha seus níveis de 🍗 / 💧 ao mesmo tempo, este efeito vira uma Desvantagem Aprimorada que pode continuar a acumular por outras fontes.`;
  }

  /**
   * Obtém a causa da exaustão para mensagens
   * @param {number} hungerLevel - Nível de fome
   * @param {number} thirstLevel - Nível de sede
   * @returns {string} Causa da exaustão
   * @private
   */
  _getExhaustionCause(hungerLevel, thirstLevel) {
    const causes = [];
    if (hungerLevel === 3) causes.push(`fome crítica`);
    if (thirstLevel === 3) causes.push(`sede crítica`);
    
    return causes.join(' e ');
  }

  /**
   * Método de teste para verificar o sistema de exaustão manualmente
   * Pode ser chamado no console: actor.system.testExhaustionSystem()
   */
  testExhaustionSystem() {
    console.log(`[CARDIGAN TEST] Testando sistema de exaustão...`);
    console.log(`[CARDIGAN TEST] Valores atuais - Fome: ${this.status?.hunger}, Sede: ${this.status?.thirst}`);
    console.log(`[CARDIGAN TEST] Total de efeitos no ator: ${this.parent.effects.size}`);
    console.log(`[CARDIGAN TEST] Lista de efeitos:`, this.parent.effects.map(e => e.name));
    
    // Forçar verificação
    this._checkAndApplyExhaustionEffect(this.status?.hunger ?? 0, this.status?.thirst ?? 0);
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
        
        // Aplicar bônus
        const abilityBonus = v.bonus || 0;
        const baseValue = (v.value || 0) + abilityBonus;
        
        data[k].value = baseValue;
        console.log(`[CARDIGAN] Aplicando bônus: ${k} = ${v.value} + ${abilityBonus} = ${data[k].value}`);
      }
    }

    data.lvl = this.attributes.level.value;

    console.log(`[CARDIGAN] RollData final:`, data);
    return data;
  }
}
