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
    
    // NOTA: Removido o cálculo automático de armor.max para permitir que ActiveEffects
    // funcionem corretamente. O valor base da armadura máxima é definido no prepareBaseData()
    // e ActiveEffects como "Congelado • Petrificado" podem adicionar bônus ao valor base.
    // Se precisar de armadura base, use armorBonus do status.
    
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
    // Regra: cada 3 pontos de Destreza (valor + bônus) reduz o número crítico em 1 (20 base)
    const dexterity = this.abilities?.dexterity?.value ?? 0;
    const dexterityBonus = this.abilities?.dexterity?.bonus ?? 0;
    const totalDexterity = dexterity + dexterityBonus;
    const dexterityCriticalEffect = Math.floor(totalDexterity / 3); // Crítico: cada 3 pontos
    this.details.criticalHit = Math.max(1, 20 - dexterityCriticalEffect); // Mínimo de 1

    // NOTA: O cálculo de movimento base foi movido para prepareBaseData() no Actor document
    // para que seja executado ANTES dos ActiveEffects, permitindo que efeitos como "Veloz"
    // adicionem bônus corretamente ao valor base.

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

    // Verificar estado de Toxicity e aplicar efeitos de envenenamento fatal automaticamente
    // Usar setTimeout para não bloquear o prepareDerivedData com async
    if (toxicityLevel === 5) {
      setTimeout(() => {
        this._checkAndApplyToxicityEffects(toxicityLevel);
      }, 100);
    } else {
      // Verificar se precisa remover efeitos existentes
      setTimeout(() => {
        this._checkAndApplyToxicityEffects(toxicityLevel);
      }, 100);
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
      console.log(`[CARDIGAN DEBUG] Aplicando efeito de exaustão - Fome: ${hungerLevel}, Sede: ${thirstLevel}`);

      // Buscar o compêndio de efeitos
      const pack = game.packs.get("cardigan.efeitos-cardigan");
      if (!pack) {
        console.error('[CARDIGAN] Compêndio de efeitos não encontrado!');
        return;
      }

      // Buscar o efeito de exaustão no compêndio
      const exhaustionItem = pack.index.find(item => item.name === "Exaustão");
      if (!exhaustionItem) {
        console.error('[CARDIGAN] Efeito "Exaustão" não encontrado no compêndio!');
        return;
      }

      // Carregar o item completo do compêndio
      const originalItem = await pack.getDocument(exhaustionItem._id);
      
      const effectData = {
        name: 'Exaustão',
        img: originalItem?.img || 'icons/svg/downgrade.svg',
        origin: this.parent.uuid,
        disabled: false,
        duration: {
          rounds: undefined,
          seconds: undefined,
          turns: undefined
        },
        flags: {
          core: { statusId: 'exhaustion' },
          cardigan: { 
            applied: 'auto',
            cause: this._getExhaustionCause(hungerLevel, thirstLevel),
            description: this._generateExhaustionDescription(originalItem),
            descriptionPlainText: this._generateExhaustionDescriptionPlainText(originalItem)
          }
        },
        changes: [],
        description: this._generateExhaustionDescription(originalItem)
      };

      // Usar setTimeout para evitar problemas com async dentro de prepareDerivedData
      setTimeout(async () => {
        try {
          await this.parent.createEmbeddedDocuments('ActiveEffect', [effectData]);
          console.log('[CARDIGAN DEBUG] ActiveEffect de exaustão criado com sucesso!');
        } catch (error) {
          console.error('[CARDIGAN] Erro ao criar ActiveEffect:', error);
        }
      }, 10);

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
   * @param {Item} originalItem - Item original do compêndio
   * @returns {string} Descrição do efeito
   * @private
   */
  _generateExhaustionDescription(originalItem) {
    if (!originalItem?.system?.description) {
      return `
        <h3>Exaustão</h3>
        <p><strong>Tipo:</strong> Efeito Negativo</p>
        <p><strong>Descrição:</strong> O personagem está exausto devido à fome e/ou sede extrema. Sua capacidade de ação está severamente comprometida.</p>
        <hr>
        <p><em>Aplicado automaticamente devido à ${this._getExhaustionCause(this.status.hunger, this.status.thirst)}.</em></p>
      `;
    }

    return `
      <h3>Exaustão</h3>
      <p><strong>Tipo:</strong> Efeito Negativo</p>
      ${originalItem.system.description}
      <hr>
      <p><em>Aplicado automaticamente devido à ${this._getExhaustionCause(this.status.hunger, this.status.thirst)}.</em></p>
    `;
  }

  /**
   * Gera versão texto simples da descrição de exaustão para tooltips
   * @param {Item} originalItem - Item original do compêndio
   * @returns {string} Descrição em texto simples
   * @private
   */
  _generateExhaustionDescriptionPlainText(originalItem) {
    if (!originalItem?.system?.description) {
      return `O personagem está exausto devido à fome e/ou sede extrema. Sua capacidade de ação está severamente comprometida.`;
    }

    // Remove tags HTML e limpa a descrição
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = originalItem.system.description;
    const cleanDescription = tempDiv.textContent || tempDiv.innerText || '';
    
    return cleanDescription.trim();
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
   * Verifica e aplica/remove os efeitos de toxicidade baseado no nível
   * Aplica "Inconsciente" e "Intoxicado" quando toxicidade chega ao nível 5 (máximo)
   * @param {number} toxicityLevel - Nível atual de toxicidade (0-5)
   * @private
   */
  async _checkAndApplyToxicityEffects(toxicityLevel) {
    console.log(`[CARDIGAN DEBUG] Verificando toxicidade - Nível: ${toxicityLevel}`);
    
    const shouldHaveToxicityEffects = toxicityLevel === 5;
    console.log(`[CARDIGAN DEBUG] Deve ter efeitos de toxicidade: ${shouldHaveToxicityEffects}`);
    
    // Verificar efeitos existentes de toxicidade
    console.log(`[CARDIGAN DEBUG] Total de efeitos no ator:`, this.parent.effects.size);
    console.log(`[CARDIGAN DEBUG] Lista de todos os efeitos:`, this.parent.effects.map(e => ({
      name: e.name,
      id: e.id,
      flags: e.flags
    })));
    
    const currentToxicityEffects = this.parent.effects.filter(effect => {
      const isToxicityEffect = effect.flags?.cardigan?.source === "toxicity_level5";
      console.log(`[CARDIGAN DEBUG] Verificando efeito "${effect.name}": é efeito de toxicidade? ${isToxicityEffect}`);
      return isToxicityEffect;
    });
    
    console.log(`[CARDIGAN DEBUG] Efeitos de toxicidade atuais:`, currentToxicityEffects.map(e => ({
      name: e.name,
      id: e.id
    })));

    if (shouldHaveToxicityEffects && currentToxicityEffects.length === 0) {
      console.log(`[CARDIGAN DEBUG] Aplicando efeitos de toxicidade...`);
      await this._applyToxicityEffects(toxicityLevel);
    } else if (!shouldHaveToxicityEffects && currentToxicityEffects.length > 0) {
      console.log(`[CARDIGAN DEBUG] Removendo efeitos de toxicidade existentes...`);
      const effectIds = currentToxicityEffects.map(effect => effect.id);
      console.log(`[CARDIGAN DEBUG] IDs dos efeitos a remover:`, effectIds);
      
      if (effectIds.length > 0) {
        try {
          await this.parent.deleteEmbeddedDocuments('ActiveEffect', effectIds);
          console.log(`[CARDIGAN DEBUG] ${effectIds.length} efeito(s) de toxicidade removido(s)`);
          
          // Forçar atualização da ficha
          if (this.parent.sheet && this.parent.sheet.rendered) {
            this.parent.sheet.render(false);
          }
        } catch (error) {
          console.error('[CARDIGAN] Erro ao remover efeitos de toxicidade:', error);
        }
      }
    } else {
      console.log(`[CARDIGAN DEBUG] Nenhuma mudança necessária nos efeitos de toxicidade`);
    }
  }

  /**
   * Aplica os efeitos de toxicidade na ficha do personagem (Inconsciente e Intoxicado)
   * @param {number} toxicityLevel - Nível atual de toxicidade
   * @private
   */
  async _applyToxicityEffects(toxicityLevel) {
    try {
      console.log(`[CARDIGAN DEBUG] Iniciando aplicação dos efeitos de toxicidade...`);
      
      // Buscar os efeitos no compêndio
      const pack = game.packs.get('cardigan.efeitos-cardigan');
      if (!pack) {
        console.error('[CARDIGAN] Compêndio de efeitos não encontrado');
        return;
      }

      console.log(`[CARDIGAN DEBUG] Carregando compêndio...`);
      const packContent = await pack.getDocuments();
      console.log(`[CARDIGAN DEBUG] Compêndio carregado com ${packContent.length} itens`);
      
      // Buscar os efeitos específicos com nomes corretos do compêndio
      const unconsciousItem = packContent.find(item => item.name === "Inconsciente・Sono");
      const intoxicatedItem = packContent.find(item => item.name === "Intoxicado");
      
      console.log(`[CARDIGAN DEBUG] Efeito Inconsciente・Sono encontrado:`, unconsciousItem ? unconsciousItem.name : 'NÃO ENCONTRADO');
      console.log(`[CARDIGAN DEBUG] Efeito Intoxicado encontrado:`, intoxicatedItem ? intoxicatedItem.name : 'NÃO ENCONTRADO');

      if (!unconsciousItem || !intoxicatedItem) {
        console.error('[CARDIGAN] Efeitos "Inconsciente・Sono" ou "Intoxicado" não encontrados no compêndio');
        return;
      }

      // Criar os ActiveEffects com nomes corretos e descrições nas flags
      const effectsData = [
        {
          name: "Inconsciente・Sono",
          img: unconsciousItem.img || "systems/cardigan/assets/images/effects/effects_negative.svg",
          flags: {
            cardigan: {
              source: "toxicity_level5",
              originalName: unconsciousItem.name,
              originalId: unconsciousItem.id,
              autoGenerated: true,
              effectType: "unconscious",
              description: this._generateToxicityEffectDescription(unconsciousItem, "inconsciente"),
              descriptionPlainText: this._generateToxicityEffectDescriptionPlainText(unconsciousItem, "inconsciente")
            }
          },
          disabled: false,
          transfer: false
        },
        {
          name: "Intoxicado",
          img: intoxicatedItem.img || "systems/cardigan/assets/images/effects/effects_negative.svg",
          flags: {
            cardigan: {
              source: "toxicity_level5",
              originalName: intoxicatedItem.name,
              originalId: intoxicatedItem.id,
              autoGenerated: true,
              effectType: "intoxicated",
              description: this._generateToxicityEffectDescription(intoxicatedItem, "intoxicado"),
              descriptionPlainText: this._generateToxicityEffectDescriptionPlainText(intoxicatedItem, "intoxicado")
            }
          },
          disabled: false,
          transfer: false
        }
      ];
      
      console.log(`[CARDIGAN DEBUG] Criando efeitos com dados:`, effectsData);
      
      const createdEffects = await this.parent.createEmbeddedDocuments('ActiveEffect', effectsData);
      console.log(`[CARDIGAN DEBUG] Efeitos criados:`, createdEffects);
      console.log(`[CARDIGAN DEBUG] Total de efeitos no ator após criação:`, this.parent.effects.size);
      
      // Forçar atualização da ficha
      if (this.parent.sheet && this.parent.sheet.rendered) {
        this.parent.sheet.render(false);
      }
      
      console.log(`[CARDIGAN DEBUG] Efeitos de toxicidade aplicados com sucesso!`);
      
      // Mensagem no chat com nomes corretos
      ChatMessage.create({
        content: `${this.parent.name}: Efeitos "Inconsciente・Sono" e "Intoxicado" aplicados automaticamente devido ao envenenamento fatal (Toxicidade nível 5).`,
        speaker: ChatMessage.getSpeaker({ actor: this.parent })
      });
      
    } catch (error) {
      console.error('[CARDIGAN] Erro ao aplicar efeitos de toxicidade:', error);
    }
  }

  /**
   * Gera descrição do efeito de toxicidade usando a descrição do compêndio
   * @param {Item} originalItem - Item original do compêndio
   * @param {string} effectType - Tipo do efeito ("inconsciente" ou "intoxicado")
   * @returns {string} Descrição do efeito
   * @private
   */
  _generateToxicityEffectDescription(originalItem, effectType) {
    const originalDescription = originalItem.system.description || "";
    const cause = "envenenamento fatal (Toxicidade nível 5)";
    
    // Adicionar informação sobre a causa automática
    if (originalDescription.includes("</p>")) {
      return originalDescription.replace("</p>", ` <em>(Aplicado automaticamente devido a ${cause})</em></p>`);
    } else if (originalDescription.trim()) {
      return `<p>${originalDescription} <em>(Aplicado automaticamente devido a ${cause})</em></p>`;
    } else {
      return `<p>Efeito ${effectType} aplicado automaticamente devido a ${cause}.</p>`;
    }
  }

  /**
   * Gera versão texto simples da descrição de toxicidade para tooltips
   * @param {Item} originalItem - Item original do compêndio
   * @param {string} effectType - Tipo do efeito ("inconsciente" ou "intoxicado")
   * @returns {string} Descrição em texto simples
   * @private
   */
  _generateToxicityEffectDescriptionPlainText(originalItem, effectType) {
    const originalDescription = originalItem.system.description || "";
    
    // Remover tags HTML para tooltip (sem informação de causa automática)
    const plainText = originalDescription.replace(/<[^>]*>/g, '').trim();
    
    if (plainText) {
      return plainText;
    } else {
      return `Efeito ${effectType}.`;
    }
  }

  /**
   * Método de teste para verificar o sistema de toxicidade manualmente
   * Pode ser chamado no console: actor.system.testToxicitySystem()
   */
  testToxicitySystem() {
    console.log(`[CARDIGAN TEST] Testando sistema de toxicidade...`);
    console.log(`[CARDIGAN TEST] Valor atual de Toxicidade: ${this.status?.toxicity}`);
    console.log(`[CARDIGAN TEST] Total de efeitos no ator: ${this.parent.effects.size}`);
    console.log(`[CARDIGAN TEST] Lista de efeitos:`, this.parent.effects.map(e => e.name));
    
    // Forçar verificação
    this._checkAndApplyToxicityEffects(this.status?.toxicity ?? 0);
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
