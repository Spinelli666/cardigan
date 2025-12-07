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
          manualValue: new fields.NumberField({
            initial: 0,
            integer: true
          }),
          manualBonus: new fields.NumberField({
            initial: 0,
            integer: true
          }),
          baseValue: new fields.NumberField({
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

    // Temporary effects for health bonuses from consumables
    schema.temporaryEffects = new fields.ArrayField(
      new fields.SchemaField({
        id: new fields.StringField({ required: true }),
        name: new fields.StringField({ required: true }),
        healthBonus: new fields.NumberField({ required: true, integer: true }),
        source: new fields.StringField({ required: true }),
        sourceId: new fields.StringField({ required: true }),
        formula: new fields.StringField({ required: true }),
        timestamp: new fields.NumberField({ required: true, integer: true })
      }),
      { initial: [] }
    );

    // Adiciona campos de detalhes incluindo notas adicionais
    schema.details = new fields.SchemaField({
      name: new fields.StringField({ initial: "" }),
      age: new fields.NumberField({ initial: 0, integer: true }),
      race: new fields.StringField({ initial: "" }),
      movement: new fields.NumberField({ initial: 0, integer: true }),
      movementManual: new fields.NumberField({ initial: 0, integer: true }),
      criticalHit: new fields.NumberField({ initial: 20, integer: true }),
      criticalHitManual: new fields.NumberField({ initial: 0, integer: true }),
      additionalNotes: new fields.StringField({ initial: "" }), // Campo para notas adicionais como texto simples
      showAdditionalNotes: new fields.BooleanField({ initial: true }), // Controle de exibição das notas
      showEffectsTab: new fields.BooleanField({ initial: true }), // Controle de exibição da seção de efeitos
      showWeaponsTable: new fields.BooleanField({ initial: true }), // Controle de exibição da tabela de armas
      showCulinaryTable: new fields.BooleanField({ initial: false }), // Controle de exibição da tabela culinária
      showTailoringTable: new fields.BooleanField({ initial: false }), // Controle de exibição da tabela de alfaiataria
      showTecnomagicTable: new fields.BooleanField({ initial: false }), // Controle de exibição da tabela de tecnomagia
      showBlacksmithingTable: new fields.BooleanField({ initial: false }), // Controle de exibição da tabela de ferraria
      showAlchemyTable: new fields.BooleanField({ initial: false }), // Controle de exibição da tabela de alquimia
      showCarpentryTable: new fields.BooleanField({ initial: false }), // Controle de exibição da tabela de carpintaria
      showSkillsAndarilhoTable: new fields.BooleanField({ initial: false }), // Controle de exibição da tabela de skills Andarilho
      showSkillsGuerreiroTable: new fields.BooleanField({ initial: false }), // Controle de exibição da tabela de skills Guerreiro
      showSkillsLadinoTable: new fields.BooleanField({ initial: false }), // Controle de exibição da tabela de skills Ladino
      showSkillsFeiticeiroTable: new fields.BooleanField({ initial: false }), // Controle de exibição da tabela de skills Feiticeiro
      showSkillsRaciaisTable: new fields.BooleanField({ initial: false }), // Controle de exibição da tabela de skills Raciais
      showSkillsUnicasTable: new fields.BooleanField({ initial: false }) // Controle de exibição da tabela de skills Únicas
    });

    return schema;
  }

  prepareDerivedData() {
    // Calculate level automatically based on sum of all classes
    this._calculateLevel();

    // Calculate race bonuses FIRST and apply to baseValue
    this._calculateRaceBonuses();

    // Loop through ability scores to handle labels and calculate base values
    for (const key in this.abilities) {
      // Handle ability label localization.
      this.abilities[key].label =
        game.i18n.localize(CONFIG.CARDIGAN.abilities[key]) ?? key;
        
      // Calculate final value using Dynamic Base + Manual Field Pattern
      const baseValue = this.abilities[key].baseValue || 0;
      const manualValue = this.abilities[key].manualValue || 0;
      this.abilities[key].value = baseValue + manualValue;
    }

    // Calculate weapon skill bonuses and add to abilities
    this._calculateWeaponSkillBonuses();
    
    // Calculate armor bonuses and add to abilities/stats
    this._calculateArmorBonuses();
    
    // AGORA calcular valor final da perícia (value + totalBonus) para exibição
    // após os bônus de armas terem sido calculados
    for (const key in this.abilities) {
      const baseValue = this.abilities[key].value || 0;
      const totalBonus = this.abilities[key].totalBonus || 0;
      this.abilities[key].total = baseValue + totalBonus;
    }

    // Regra: cada ponto de Stamina adiciona +5 à vida máxima e +1 à energia máxima
    const stamina = this.abilities?.stamina?.value ?? 0;
    const staminaTotalBonus = this.abilities?.stamina?.totalBonus ?? 0;
    const totalStamina = stamina + staminaTotalBonus;
    const staminaHealthBonus = totalStamina * 5;
    const staminaEnergyBonus = totalStamina * 1;
    
    // Regra: cada level de 2 até 10 adiciona +5 à vida e +1 à energia máxima (level 1 não dá bonus)
    const level = this.attributes?.level?.value ?? 0;
    const levelHealthBonus = Math.max(0, Math.min(level, 10) - 1) * 5;
    const levelEnergyBonus = Math.max(0, Math.min(level, 10) - 1) * 1;
    
    // NOVA REGRA FRATURA: cada ponto de Fratura reduz vida e energia máxima em 5
    const fractureLevel = this.status?.fracture ?? 0;
    const fractureReduction = fractureLevel * 5;
    
    // Get bonus values (manual bonuses from status)
    const healthBonus = this.status?.healthBonus ?? 0;
    const energyBonus = this.status?.energyBonus ?? 0;
    const armorBonus = this.status?.armorBonus ?? 0;
    
    // Get armor bonuses (calculated from equipped armors)
    const armorHealthBonus = this._armorHealthBonus ?? 0;
    const armorEnergyBonus = this._armorEnergyBonus ?? 0;
    const armorProtectionBonus = this._armorProtectionBonus ?? 0;
    const armorMovementBonus = this._armorMovementBonus ?? 0;
    
    // Get race bonuses (calculated from race item)
    const raceHealthBonus = this._raceHealthBonus ?? 0;
    const racePowerBonus = this._racePowerBonus ?? 0;
    
    this.health.max = Math.max(0, 0 + staminaHealthBonus + levelHealthBonus - fractureReduction + healthBonus + armorHealthBonus + raceHealthBonus);
    this.power.max = Math.max(0, 0 + staminaEnergyBonus + levelEnergyBonus - fractureReduction + energyBonus + armorEnergyBonus + racePowerBonus);
    
    // Calculate armor maximum based on armor bonus from equipped armors + manual bonus
    this.armor.max = Math.max(0, armorBonus + armorProtectionBonus);
    
    // Calculate backpack maximum capacity based on Strength (every 2 points of Strength = +1 capacity)
    // Use value (baseValue + manualValue) + bonus + totalBonus for complete strength calculation
    const strengthValue = this.abilities?.strength?.value || 0;
    const strengthBonus = this.abilities?.strength?.bonus || 0;
    const strengthTotalBonus = this.abilities?.strength?.totalBonus || 0;
    const totalStrength = strengthValue + strengthBonus + strengthTotalBonus;
    const baseBackpackCapacity = Math.floor(totalStrength / 2);
    
    // Add armor backpack space bonuses
    const armorBackpackBonus = this._armorBackpackSpaceBonus || 0;
    this.backpack.max = baseBackpackCapacity + armorBackpackBonus;
    
    // CAMPO DE TESTE: Implementa lógica de campo manual com bônus automático
    // Exemplo: se stamina é 2, bônus automático é 10 (2 * 5)
    const staminaBonusForTest = totalStamina * 5; // Bônus baseado em stamina
    const testFieldInput = this.status?.testField ?? 0; // Valor manual digitado
    
    // Se não existe um campo calculado ainda, cria
    if (!this.status.testFieldCalculated) {
      this.status.testFieldCalculated = testFieldInput + staminaBonusForTest;
    }
    
    // Sempre recalcula o valor baseado no input + bônus
    this.status.testFieldCalculated = testFieldInput + staminaBonusForTest;
    
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
    // Regra: cada 3 pontos de Destreza (valor + bônus total) reduz o número crítico em 1 (20 base)
    const dexterity = this.abilities?.dexterity?.value ?? 0;
    const dexterityTotalBonus = this.abilities?.dexterity?.totalBonus ?? 0;
    const totalDexterity = dexterity + dexterityTotalBonus;
    const dexterityCriticalEffect = Math.floor(totalDexterity / 3); // Crítico: cada 3 pontos
    const autoValue = Math.max(1, 20 - dexterityCriticalEffect); // Valor automático (mínimo de 1)
    const manualValue = this.details.criticalHitManual ?? 0; // Valor manual
    this.details.criticalHit = autoValue + manualValue; // Total = automático + manual

    // Calcular movimento baseado na Destreza total (incluindo bônus de armas) + bônus de armaduras + bônus de raça
    // Regra: a cada 2 pontos de Destreza = +1 movimento
    const dexterityMovement = Math.floor(totalDexterity / 2);
    const armorMovementBonusTotal = this._armorMovementBonus ?? 0;
    const raceMovementBonus = this._raceMovementBonus ?? 0;
    const autoMovementValue = dexterityMovement + armorMovementBonusTotal + raceMovementBonus; // Valor automático
    const manualMovementValue = this.details.movementManual ?? 0; // Valor manual
    this.details.movement = autoMovementValue + manualMovementValue; // Total = automático + manual

    // Verificar estado de Hunger
    const hungerLevel = this.status?.hunger ?? 0;
    const thirstLevel = this.status?.thirst ?? 0;
    
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
   * Calculate race bonuses and apply them to character abilities' baseValue
   * Only one race item should exist per character
   * Race modifiers affect the base ability values (not bonus)
   * @private
   */
  _calculateRaceBonuses() {
    // Get the race item from the actor (should only be one)
    const raceItem = this.parent?.items?.find(item => item.type === 'race');
    
    // If no race, reset all baseValues to 0
    if (!raceItem) {
      for (const key in this.abilities) {
        this.abilities[key].baseValue = 0;
      }
      // Reset bonuses from race
      this._raceMovementBonus = 0;
      this._raceHealthBonus = 0;
      this._racePowerBonus = 0;
      return;
    }
    
    // Apply race ability modifiers to baseValue
    const abilityModifiers = raceItem.system.abilityModifiers || {};
    for (const key in this.abilities) {
      const raceModifier = abilityModifiers[key] || 0;
      this.abilities[key].baseValue = raceModifier;
    }
    
    // Store race bonuses for later calculation
    this._raceMovementBonus = raceItem.system.movementBonus || 0;
    this._raceHealthBonus = raceItem.system.healthBonus || 0;
    this._racePowerBonus = raceItem.system.powerBonus || 0;
  }

  /**
   * Calculate weapon skill bonuses and add them to character abilities
   * Only equipped weapons (rightHand or leftHand) contribute to bonuses
   * Multiple weapons with the same skill bonus are cumulative
   * @private
   */
  _calculateWeaponSkillBonuses() {
    // First, calculate weapon bonuses for all abilities
    const weaponBonuses = {};
    for (const key in this.abilities) {
      weaponBonuses[key] = 0;
    }

    // Get all weapons from the actor
    const weapons = this.parent?.items?.filter(item => item.type === 'arma') || [];
    
    // Calculate total bonuses from equipped weapons only
    for (const weapon of weapons) {
      // Only apply bonuses if weapon is equipped in one or both hands
      const isEquipped = weapon.system.rightHand || weapon.system.leftHand;
      if (!isEquipped) continue;
      
      const skillBonuses = weapon.system.skillBonuses || [];
      
      for (const skillBonus of skillBonuses) {
        const skill = skillBonus.skill;
        const bonus = skillBonus.bonus || 0;
        
        // Skip if no skill selected or bonus is 0
        if (!skill || bonus === 0) continue;
        
        // Add bonus to the corresponding ability
        if (weaponBonuses.hasOwnProperty(skill)) {
          weaponBonuses[skill] += bonus;
        }
      }
    }

    // Apply weapon bonuses creating a separate totalBonus field
    // Keep the original bonus field untouched (manual bonus only)
    for (const key in this.abilities) {
      const manualBonus = this.abilities[key].manualBonus || 0;
      const weaponBonus = weaponBonuses[key] || 0;
      
      // Store weapon bonus separately
      this.abilities[key].weaponBonus = weaponBonus;
      
      // Create totalBonus field that combines manual + weapon bonuses
      this.abilities[key].totalBonus = manualBonus + weaponBonus;
    }

    // Recalculate totals with the totalBonus values
    for (const key in this.abilities) {
      const baseValue = this.abilities[key].value || 0;
      const totalBonus = this.abilities[key].totalBonus || 0;
      this.abilities[key].total = baseValue + totalBonus;
    }
  }

  /**
   * Calculate armor bonuses and add them to character abilities and stats
   * Only equipped armors contribute to bonuses
   * Multiple armors with bonuses are cumulative
   * @private
   */
  _calculateArmorBonuses() {
    // Initialize armor bonuses for abilities
    const armorSkillBonuses = {};
    for (const key in this.abilities) {
      armorSkillBonuses[key] = 0;
    }

    // Initialize stat bonuses from armors
    let armorHealthBonus = 0;
    let armorEnergyBonus = 0;
    let armorProtectionBonus = 0;
    let armorMovementBonus = 0;
    let armorBackpackSpaceBonus = 0;

    // Get all armors from the actor
    const armors = this.parent?.items?.filter(item => item.type === 'armadura') || [];
    
    // Get all weapons from the actor  
    const weapons = this.parent?.items?.filter(item => item.type === 'arma') || [];
    
    // Calculate total bonuses from equipped armors only
    for (const armor of armors) {
      // Only apply bonuses if armor is equipped
      const isEquipped = armor.system.equipped;
      if (!isEquipped) continue;
      
      // 1. Calculate skill bonuses from armors
      const skillBonuses = armor.system.skillBonuses || [];
      for (const skillBonus of skillBonuses) {
        const skill = skillBonus.skill;
        const bonus = skillBonus.bonus || 0;
        
        // Skip if no skill selected or bonus is 0
        if (!skill || bonus === 0) continue;
        
        // Add bonus to the corresponding ability
        if (armorSkillBonuses.hasOwnProperty(skill)) {
          armorSkillBonuses[skill] += bonus;
        }
      }

      // 2. Calculate stat bonuses from armors
      // Health bonus
      if (armor.system.bonusVida && armor.system.bonusVida > 0) {
        armorHealthBonus += armor.system.bonusVida;
      }
      
      // Energy bonus  
      if (armor.system.bonusEnergia && armor.system.bonusEnergia > 0) {
        armorEnergyBonus += armor.system.bonusEnergia;
      }
      
      // Protection bonus (contributes to armor max)
      if (armor.system.protecao && armor.system.protecao > 0) {
        armorProtectionBonus += armor.system.protecao;
      }
      
      // Movement bonus
      if (armor.system.bonusDeslocamento && armor.system.bonusDeslocamento.enabled && armor.system.bonusDeslocamento.bonus > 0) {
        armorMovementBonus += armor.system.bonusDeslocamento.bonus;
      }
      
      // Backpack space bonus
      if (armor.system.bonusEspacoMochila && armor.system.bonusEspacoMochila.enabled && armor.system.bonusEspacoMochila.bonus > 0) {
        armorBackpackSpaceBonus += armor.system.bonusEspacoMochila.bonus;
      }
    }

    // Calculate protection bonuses from equipped weapons with protection enabled
    for (const weapon of weapons) {
      // Only apply bonuses if weapon is equipped
      const isEquipped = weapon.system.equipped;
      if (!isEquipped) continue;
      
      // Add protection bonus from weapons if enabled
      if (weapon.system.protection && weapon.system.protection.enabled && weapon.system.protection.value > 0) {
        armorProtectionBonus += weapon.system.protection.value;
      }
    }

    // Apply armor skill bonuses to abilities (add to existing totalBonus)
    for (const key in this.abilities) {
      const currentTotalBonus = this.abilities[key].totalBonus || 0;
      const armorBonus = armorSkillBonuses[key] || 0;
      
      // Store armor bonus separately
      this.abilities[key].armorBonus = armorBonus;
      
      // Update totalBonus to include armor bonuses
      this.abilities[key].totalBonus = currentTotalBonus + armorBonus;
    }

    // Apply stat bonuses - store them separately instead of adding to existing status
    // These will be used directly in the max calculations
    this._armorHealthBonus = armorHealthBonus;
    this._armorEnergyBonus = armorEnergyBonus; 
    this._armorProtectionBonus = armorProtectionBonus;
    this._armorMovementBonus = armorMovementBonus;
    this._armorBackpackSpaceBonus = armorBackpackSpaceBonus;

    // Recalculate ability totals with armor bonuses included
    for (const key in this.abilities) {
      const baseValue = this.abilities[key].value || 0;
      const totalBonus = this.abilities[key].totalBonus || 0;
      this.abilities[key].total = baseValue + totalBonus;
    }
  }

  /* ========================================
   * DEPRECATED: Legacy Exhaustion System
   * This code has been replaced by ExaustaoEffect in module/effects/effects/exaustao.mjs
   * Keeping here temporarily for reference, can be removed in future versions
   * ======================================== 
  async _checkAndApplyExhaustionEffect(hungerLevel, thirstLevel) { ... }
  async _applyExhaustionEffect(hungerLevel, thirstLevel) { ... }
  _generateExhaustionDescription(originalItem) { ... }
  _generateExhaustionDescriptionPlainText(originalItem) { ... }
  _getExhaustionCause(hungerLevel, thirstLevel) { ... }
  testExhaustionSystem() { ... }
  ======================================== */

  /**
   * Verifica e aplica/remove os efeitos de toxicidade baseado no nível
   * Aplica "Inconsciente" e "Intoxicado" quando toxicidade chega ao nível 5 (máximo)
   * @param {number} toxicityLevel - Nível atual de toxicidade (0-5)
   * @private
   */
  async _checkAndApplyToxicityEffects(toxicityLevel) {
    
    const shouldHaveToxicityEffects = toxicityLevel === 5;
    
    const currentToxicityEffects = this.parent.effects.filter(effect => {
      const isToxicityEffect = effect.flags?.cardigan?.source === "toxicity_level5";
      return isToxicityEffect;
    });

    if (shouldHaveToxicityEffects && currentToxicityEffects.length === 0) {
      await this._applyToxicityEffects(toxicityLevel);
    } else if (!shouldHaveToxicityEffects && currentToxicityEffects.length > 0) {
      const effectIds = currentToxicityEffects.map(effect => effect.id);
      
      if (effectIds.length > 0) {
        try {
          await this.parent.deleteEmbeddedDocuments('ActiveEffect', effectIds);
          
          // Forçar atualização da ficha
          if (this.parent.sheet && this.parent.sheet.rendered) {
            this.parent.sheet.render(false);
          }
        } catch (error) {
          console.error('[CARDIGAN] Erro ao remover efeitos de toxicidade:', error);
        }
      }
    } else {
    }
  }

  /**
   * Aplica os efeitos de toxicidade na ficha do personagem (Inconsciente e Intoxicado)
   * @param {number} toxicityLevel - Nível atual de toxicidade
   * @private
   */
  async _applyToxicityEffects(toxicityLevel) {
    try {
      
      // Buscar os efeitos no compêndio
      const pack = game.packs.get('cardigan.efeitos-cardigan');
      if (!pack) {
        console.error('[CARDIGAN] Compêndio de efeitos não encontrado');
        return;
      }

      const packContent = await pack.getDocuments();
      
      // Buscar os efeitos específicos com nomes corretos do compêndio
      const unconsciousItem = packContent.find(item => item.name === "Inconsciente・Sono");
      const intoxicatedItem = packContent.find(item => item.name === "Intoxicado");
      

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
      
      
      const createdEffects = await this.parent.createEmbeddedDocuments('ActiveEffect', effectsData);
      
      // Forçar atualização da ficha
      if (this.parent.sheet && this.parent.sheet.rendered) {
        this.parent.sheet.render(false);
      }
      
      
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

    // Copy abilities directly to root level for easier access (@accuracy.value instead of @abilities.accuracy.value)
    if (this.abilities) {
      for (let [k, v] of Object.entries(this.abilities)) {
        data[k] = {
          value: v.value || 0,           // Base value
          bonus: v.totalBonus || 0,      // Total bonus (manual + weapons)
          total: (v.value || 0) + (v.totalBonus || 0)  // Combined total
        };
      }
    }

    return data;
  }
}
