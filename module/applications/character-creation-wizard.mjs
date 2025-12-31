/**
 * Character Creation Wizard Dialog
 * Multi-step wizard for creating new characters
 */
export class CharacterCreationWizard extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.currentStep = 1;
    this.totalSteps = 3; // Etapa 1: Raça, Etapa 2: Skills, Etapa 3: Abilities
    this.selectedRace = null;
    this.races = [];
    this.skills = {};
    this.selectedSkills = []; // Array de UUIDs de skills selecionadas
    this.selectedEnhancements = {}; // Objeto: { skillUuid: [index1, index2, ...] } - Array de índices de aprimoramentos
    this.maxSkillPoints = 2; // Padrão: 2 pontos, Elfo: 3 pontos (ambos começam nível 1)
    this.currentPath = null; // Caminho atualmente visualizado
    this.expandedSkillId = null; // Skill com detalhes expandidos
    
    // Etapa 3: Distribuição de pontos nas abilities
    this.abilityPoints = {}; // { abilityKey: points }
    this.baseAbilityPoints = 12; // 12 pontos base
    this.bonusAbilityPoints = 3; // 3 pontos bônus
    this.maxPointsPerAbility = 3; // Máximo 3 pontos por ability (apenas para os 12 pontos base)
    
    // Inicializar abilities com 0 pontos
    for (const abilityKey in CONFIG.CARDIGAN.abilities) {
      this.abilityPoints[abilityKey] = 0;
    }
  }

  static DEFAULT_OPTIONS = {
    id: "character-creation-wizard",
    tag: "dialog",
    window: {
      title: "Criação de Personagem",
      icon: "fas fa-hat-wizard",
      minimizable: false,
      resizable: true
    },
    position: {
      width: 800,
      height: 700
    },
    actions: {
      previousStep: CharacterCreationWizard.#onPreviousStep,
      nextStep: CharacterCreationWizard.#onNextStep,
      finish: CharacterCreationWizard.#onFinish,
      cancel: CharacterCreationWizard.#onCancel,
      selectPath: CharacterCreationWizard.#onSelectPath,
      selectSkill: CharacterCreationWizard.#onSelectSkill,
      toggleSkillDetails: CharacterCreationWizard.#onToggleSkillDetails,
      selectEnhancement: CharacterCreationWizard.#onSelectEnhancement,
      increaseAbility: CharacterCreationWizard.#onIncreaseAbility,
      decreaseAbility: CharacterCreationWizard.#onDecreaseAbility,
      randomizeAbilities: CharacterCreationWizard.#onRandomizeAbilities
    }
  };

  static PARTS = {
    form: {
      template: "systems/cardigan/templates/dialogs/character-creation-wizard.hbs"
    }
  };

  async _prepareContext() {
    // Carregar raças se ainda não foram carregadas
    if (this.races.length === 0) {
      await this._loadRaces();
    }

    // Carregar skills se ainda não foram carregadas
    if (Object.keys(this.skills).length === 0) {
      await this._loadSkills();
    }

    const context = {
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      stepTitle: this._getStepTitle(),
      isFirstStep: this.currentStep === 1,
      isLastStep: this.currentStep === this.totalSteps,
      races: this.races
    };

    // Adicionar dados da etapa 2 se necessário
    if (this.currentStep === 2) {
      context.paths = this._preparePaths();
      
      // Preparar skills do caminho atual com informações de seleção e expansão
      if (this.currentPath && this.skills[this.currentPath]) {
        context.currentPathSkills = this.skills[this.currentPath].map(skill => {
          const selectedEnhancementsArray = this.selectedEnhancements[skill.uuid] || [];
          
          const skillData = {
            ...skill,
            selected: this.selectedSkills.includes(skill.uuid),
            expanded: this.expandedSkillId === skill.id,
            selectedEnhancements: selectedEnhancementsArray // Array de índices selecionados
          };

          // Adicionar flag de seleção para cada aprimoramento
          if (skill.enhancements && Array.isArray(skill.enhancements)) {
            skillData.enhancements = skill.enhancements.map((enh, index) => ({
              ...enh,
              isSelected: selectedEnhancementsArray.includes(index)
            }));
          }

          // Adicionar tipos de ação formatados
          if (skill.skillActionTypes && Array.isArray(skill.skillActionTypes) && skill.skillActionTypes.length > 0) {
            skillData.skillActionTypes = skill.skillActionTypes.map(type => {
              const localizationKey = CONFIG.CARDIGAN?.skillTypes?.[type] || type;
              return game.i18n.localize(localizationKey);
            });
          }

          // Adicionar informações de custo de energia
          if (skill.hasEnergyCost) {
            skillData.hasEnergyCost = true;
            skillData.energyCost = skill.energyCost || 0;
          }

          // Adicionar categorias de magia para Feiticeiro
          if (skill.skillClass === 'feiticeiro' && skill.spellCategories && Array.isArray(skill.spellCategories) && skill.spellCategories.length > 0) {
            const categoryImages = {
              'neutro': 'systems/cardigan/assets/images/others/neutral-spell.webp',
              'feerico': 'systems/cardigan/assets/images/bestiary/fae-creatures.webp',
              'caos': 'systems/cardigan/assets/images/bestiary/indivisible-chaos.webp',
              'necromancia': 'systems/cardigan/assets/images/bestiary/necromancy.webp'
            };

            skillData.spellCategories = skill.spellCategories.map(category => ({
              categoryImage: categoryImages[category],
              categoryName: game.i18n.localize(`CARDIGAN.SpellCategory.${category.charAt(0).toUpperCase() + category.slice(1)}`) || category
            }));
          }

          return skillData;
        });
        
        // Nome do caminho atual para exibição
        const pathNames = {
          andarilho: 'Andarilho',
          guerreiro: 'Guerreiro',
          ladino: 'Ladino',
          feiticeiro: 'Feiticeiro'
        };
        context.currentPathName = pathNames[this.currentPath];
      } else {
        context.currentPathSkills = null;
      }
      
      // Calcular pontos gastos: cada skill = 1 ponto, cada aprimoramento = 1 ponto
      const skillPoints = this.selectedSkills.length;
      const enhancementPoints = Object.values(this.selectedEnhancements).reduce(
        (sum, enhancementArray) => sum + enhancementArray.length,
        0
      );
      const totalPointsUsed = skillPoints + enhancementPoints;
      
      context.selectedSkillsCount = this.selectedSkills.length;
      context.selectedEnhancementsCount = Object.keys(this.selectedEnhancements).length;
      context.totalPointsUsed = totalPointsUsed;
      context.remainingPoints = this.maxSkillPoints - totalPointsUsed;
      context.maxSkillPoints = this.maxSkillPoints;
    }

    // Adicionar dados da etapa 3 (Distribuição de Abilities)
    if (this.currentStep === 3) {
      const abilities = [];
      
      for (const [key, labelKey] of Object.entries(CONFIG.CARDIGAN.abilities)) {
        abilities.push({
          key: key,
          label: game.i18n.localize(labelKey),
          points: this.abilityPoints[key] || 0,
          canIncrease: this._canIncreaseAbility(key),
          canDecrease: this.abilityPoints[key] > 0
        });
      }
      
      context.abilities = abilities;
      
      // Calcular pontos usados
      const totalAbilityPoints = Object.values(this.abilityPoints).reduce((sum, val) => sum + val, 0);
      const basePointsUsed = Math.min(totalAbilityPoints, this.baseAbilityPoints);
      const bonusPointsUsed = Math.max(0, totalAbilityPoints - this.baseAbilityPoints);
      
      context.baseAbilityPoints = this.baseAbilityPoints;
      context.bonusAbilityPoints = this.bonusAbilityPoints;
      context.basePointsUsed = basePointsUsed;
      context.bonusPointsUsed = bonusPointsUsed;
      context.basePointsRemaining = this.baseAbilityPoints - basePointsUsed;
      context.bonusPointsRemaining = this.bonusAbilityPoints - bonusPointsUsed;
      context.totalAbilityPoints = totalAbilityPoints;
    }

    return context;
  }

  /**
   * Carrega raças do compendium
   */
  async _loadRaces() {
    try {
      const allRaces = [];
      
      // Carregar raças do compendium
      const pack = game.packs.get("cardigan.racas-cardigan");
      if (pack) {
        const documents = await pack.getDocuments();
        const compendiumRaces = documents
          .filter(doc => doc.type === 'race')
          .map(race => ({
            id: race.id,
            name: race.name,
            img: race.img || 'icons/svg/mystery-man.svg',
            uuid: race.uuid,
            system: {
              description: race.system.description || ''
            },
            source: 'compendium',
            selected: false
          }));
        allRaces.push(...compendiumRaces);
      }
      
      // Carregar raças do world
      const worldRaces = game.items
        .filter(item => item.type === 'race')
        .map(race => ({
          id: race.id,
          name: race.name,
          img: race.img || 'icons/svg/mystery-man.svg',
          uuid: race.uuid,
          system: {
            description: race.system.description || ''
          },
          source: 'world',
          selected: false
        }));
      allRaces.push(...worldRaces);
      
      this.races = allRaces.sort((a, b) => a.name.localeCompare(b.name));
      
      console.log('[CharacterWizard] Loaded races:', this.races.length);
      
    } catch (error) {
      console.error("Error loading races:", error);
      ui.notifications.error("Erro ao carregar raças");
    }
  }

  /**
   * Retorna o título da etapa atual
   */
  _getStepTitle() {
    switch (this.currentStep) {
      case 1:
        return "Escolha sua Raça";
      case 2:
        return "Distribuir Pontos de Habilidades";
      case 3:
        return "Distribuir Pontos de Atributos";
      default:
        return "";
    }
  }

  /**
   * Carrega skills do compendium organizadas por caminho
   */
  async _loadSkills() {
    try {
      const pack = game.packs.get("cardigan.skills-cardigan");
      if (!pack) {
        console.error('[CharacterWizard] Compendium skills-cardigan não encontrado');
        return;
      }

      const documents = await pack.getDocuments();
      const skillsByClass = {
        andarilho: [],
        guerreiro: [],
        ladino: [],
        feiticeiro: []
      };

      for (const skill of documents.filter(doc => doc.type === 'skill' && doc.system.skillClass)) {
        const skillClass = skill.system.skillClass.toLowerCase();
        if (!skillsByClass[skillClass]) continue;
        
        // Enriquecer descrição da skill
        const enrichedDescription = await foundry.applications.ux.TextEditor.enrichHTML(
          skill.system.description || '',
          { async: true }
        );
        
        // Enriquecer descrições dos aprimoramentos
        const enrichedEnhancements = await Promise.all(
          (skill.system.enhancements || []).map(async (enh) => {
            const enrichedEnhDesc = await foundry.applications.ux.TextEditor.enrichHTML(
              enh.description || '',
              { async: true }
            );
            return {
              ...enh,
              description: enrichedEnhDesc
            };
          })
        );
        
        // Filtrar as skills "Componentes" e "Despertar Psiônico" - elas serão adicionadas automaticamente
        if (skill.name === "Componentes" || skill.name === "Despertar Psiônico") {
          continue;
        }
        
        skillsByClass[skillClass].push({
          id: skill.id,
          name: skill.name,
          img: skill.img || 'icons/svg/mystery-man.svg',
          uuid: skill.uuid,
          skillClass: skillClass,
          description: enrichedDescription,
          enhancements: enrichedEnhancements,
          selected: false,
          // Adicionar campos extras
          skillActionTypes: skill.system.skillActionTypes || [],
          hasEnergyCost: skill.system.hasEnergyCost || false,
          energyCost: skill.system.energyCost || 0,
          spellCategories: skill.system.spellCategories || []
        });
      }

      // Ordenar por nome
      for (const path in skillsByClass) {
        skillsByClass[path].sort((a, b) => a.name.localeCompare(b.name));
      }

      this.skills = skillsByClass;
      console.log('[CharacterWizard] Loaded skills:', {
        andarilho: this.skills.andarilho.length,
        guerreiro: this.skills.guerreiro.length,
        ladino: this.skills.ladino.length,
        feiticeiro: this.skills.feiticeiro.length
      });

    } catch (error) {
      console.error("Error loading skills:", error);
      ui.notifications.error("Erro ao carregar skills");
    }
  }

  /**
   * Prepara dados dos caminhos para exibição
   */
  _preparePaths() {
    return [
      {
        id: 'andarilho',
        name: 'Andarilho',
        img: 'systems/cardigan/assets/images/paths/wanderer.webp',
        active: this.currentPath === 'andarilho',
        skillCount: this.skills.andarilho?.length || 0
      },
      {
        id: 'guerreiro',
        name: 'Guerreiro',
        img: 'systems/cardigan/assets/images/paths/warrior.webp',
        active: this.currentPath === 'guerreiro',
        skillCount: this.skills.guerreiro?.length || 0
      },
      {
        id: 'ladino',
        name: 'Ladino',
        img: 'systems/cardigan/assets/images/paths/rogue.webp',
        active: this.currentPath === 'ladino',
        skillCount: this.skills.ladino?.length || 0
      },
      {
        id: 'feiticeiro',
        name: 'Feiticeiro',
        img: 'systems/cardigan/assets/images/paths/wizard.webp',
        active: this.currentPath === 'feiticeiro',
        skillCount: this.skills.feiticeiro?.length || 0
      }
    ];
  }

  /**
   * Retorna o título da etapa atual
   */
  /**
   * Handler para renderização
   */
  _onRender(context, options) {
    super._onRender(context, options);
    
    if (this.currentStep === 1) {
      // Adicionar event listeners para seleção de raça
      const raceCards = this.element.querySelectorAll('.race-card');
      raceCards.forEach(card => {
        card.addEventListener('click', (event) => {
          this._onRaceClick(event.currentTarget);
        });
      });
    }
    
    // Event listeners para etapa 2 são gerenciados pelas actions
  }

  /**
   * Handler para clique em card de raça
   */
  async _onRaceClick(cardElement) {
    const raceUuid = cardElement.dataset.raceUuid;
    
    // Desmarcar todas as raças
    this.races.forEach(race => race.selected = false);
    this.element.querySelectorAll('.race-card').forEach(card => {
      card.classList.remove('selected');
    });
    
    // Marcar a raça selecionada
    const selectedRace = this.races.find(race => race.uuid === raceUuid);
    if (selectedRace) {
      selectedRace.selected = true;
      this.selectedRace = selectedRace;
      cardElement.classList.add('selected');
      console.log('[CharacterWizard] Selected race:', selectedRace.name);
      
      // Ajustar pontos de habilidade baseado na raça
      // Elfo = 3 pontos (mas começa no nível 1 também)
      // Outras raças = 2 pontos (nível 1)
      const raceName = selectedRace.name.toLowerCase();
      this.maxSkillPoints = raceName.includes('elfo') ? 3 : 2;
      console.log('[CharacterWizard] Skill points for', selectedRace.name, ':', this.maxSkillPoints);
      
      // Atualizar a área de descrição com HTML enriquecido
      const descriptionDisplay = this.element.querySelector('.race-description-display');
      if (descriptionDisplay) {
        const enrichedDescription = await foundry.applications.ux.TextEditor.enrichHTML(
          selectedRace.system.description || 'Sem descrição disponível.',
          { async: true }
        );
        
        descriptionDisplay.innerHTML = `
          <div class="description-content">
            <h3><i class="fas fa-scroll"></i> ${selectedRace.name}</h3>
            <div class="description-text">${enrichedDescription}</div>
          </div>
        `;
      }
    }
  }

  /**
   * Handler para seleção de caminho
   */
  static async #onSelectPath(event, target) {
    const pathId = target.dataset.pathId;
    if (!pathId) return;

    this.currentPath = pathId;
    await this.render(true);
  }

  /**
   * Handler para seleção de skill
   */
  static async #onSelectSkill(event, target) {
    const skillUuid = target.dataset.skillUuid;
    if (!skillUuid) return;

    const index = this.selectedSkills.indexOf(skillUuid);
    
    if (index >= 0) {
      // Desselecionar skill
      this.selectedSkills.splice(index, 1);
      
      // Se a skill tinha aprimoramentos selecionados, remove todos
      if (this.selectedEnhancements[skillUuid]) {
        delete this.selectedEnhancements[skillUuid];
      }
    } else {
      // Calcular pontos totais que seriam usados (skills + aprimoramentos)
      const skillPoints = this.selectedSkills.length + 1; // +1 da nova skill
      const enhancementPoints = Object.values(this.selectedEnhancements).reduce(
        (sum, enhancementArray) => sum + enhancementArray.length,
        0
      );
      const totalPoints = skillPoints + enhancementPoints;
      
      if (totalPoints > this.maxSkillPoints) {
        ui.notifications.warn(`Você não tem pontos suficientes. Total: ${totalPoints}/${this.maxSkillPoints}`);
        return;
      }
      
      this.selectedSkills.push(skillUuid);
    }

    await this.render(true);
  }

  /**
   * Handler para expandir/colapsar detalhes da skill
   */
  static async #onToggleSkillDetails(event, target) {
    const skillId = target.dataset.skillId;
    if (!skillId) return;

    // Guardar elemento clicado antes do render
    const clickedElement = target.closest('.skill-item');

    // Toggle: se já está expandido, colapsa; senão expande
    this.expandedSkillId = this.expandedSkillId === skillId ? null : skillId;
    await this.render(true);
    
    // Após render, rolar suavemente até o elemento expandido
    if (this.expandedSkillId) {
      await this.element.updateComplete;
      const expandedSkill = this.element.querySelector(`[data-skill-id="${skillId}"]`)?.closest('.skill-item');
      if (expandedSkill) {
        expandedSkill.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  /**
   * Handler para selecionar/desselecionar aprimoramento
   */
  static async #onSelectEnhancement(event, target) {
    const skillUuid = target.dataset.skillUuid;
    const enhancementIndex = parseInt(target.dataset.enhancementIndex);
    
    if (!skillUuid || isNaN(enhancementIndex)) return;

    // Verificar se a skill está selecionada
    if (!this.selectedSkills.includes(skillUuid)) {
      ui.notifications.warn("Você precisa selecionar a skill antes de escolher um aprimoramento");
      return;
    }

    // Inicializar array se não existir
    if (!this.selectedEnhancements[skillUuid]) {
      this.selectedEnhancements[skillUuid] = [];
    }

    const enhancementArray = this.selectedEnhancements[skillUuid];
    const indexInArray = enhancementArray.indexOf(enhancementIndex);

    // Toggle: se já está selecionado, remove; senão adiciona
    if (indexInArray >= 0) {
      // Remover aprimoramento
      enhancementArray.splice(indexInArray, 1);
      // Se o array ficou vazio, remove a chave
      if (enhancementArray.length === 0) {
        delete this.selectedEnhancements[skillUuid];
      }
    } else {
      // Calcular pontos gastos se adicionar este aprimoramento (cada aprimoramento = 1 ponto)
      const skillPoints = this.selectedSkills.length;
      const currentEnhancements = Object.values(this.selectedEnhancements).reduce(
        (sum, arr) => sum + arr.length,
        0
      );
      const totalPoints = skillPoints + currentEnhancements + 1;
      
      if (totalPoints > this.maxSkillPoints) {
        ui.notifications.warn(`Você não tem pontos suficientes (${totalPoints}/${this.maxSkillPoints})`);
        return;
      }
      
      enhancementArray.push(enhancementIndex);
    }

    await this.render(true);
  }

  /**
   * Handler para botão Anterior
   */
  static async #onPreviousStep(event, target) {
    if (this.currentStep > 1) {
      this.currentStep--;
      await this.render(true);
    }
  }

  /**
   * Handler para botão Próximo
   */
  static async #onNextStep(event, target) {
    // Validar etapa atual antes de avançar
    if (!this._validateCurrentStep()) {
      return;
    }

    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      await this.render(true);
    }
  }

  /**
   * Valida a etapa atual
   */
  _validateCurrentStep() {
    switch (this.currentStep) {
      case 1:
        // Validar que uma raça foi selecionada
        if (!this.selectedRace) {
          ui.notifications.warn("Selecione uma raça antes de continuar");
          return false;
        }
        return true;
      case 2:
        // Validar que os pontos foram usados corretamente (cada skill = 1 ponto, cada aprimoramento = 1 ponto)
        const skillPoints = this.selectedSkills.length;
        const enhancementPoints = Object.values(this.selectedEnhancements).reduce(
          (sum, enhancementArray) => sum + enhancementArray.length,
          0
        );
        const totalPoints = skillPoints + enhancementPoints;
        
        if (totalPoints !== this.maxSkillPoints) {
          ui.notifications.warn(`Você deve usar todos os ${this.maxSkillPoints} pontos (atual: ${totalPoints})`);
          return false;
        }
        
        // Validar que pelo menos 1 skill foi selecionada
        if (this.selectedSkills.length < 1) {
          ui.notifications.warn("Você deve selecionar pelo menos 1 skill");
          return false;
        }
        
        return true;
      case 3:
        // Validar que todos os pontos foram distribuídos
        const totalAbilityPoints = Object.values(this.abilityPoints).reduce((sum, val) => sum + val, 0);
        const requiredPoints = this.baseAbilityPoints + this.bonusAbilityPoints;
        
        if (totalAbilityPoints !== requiredPoints) {
          ui.notifications.warn(`Você deve distribuir todos os ${requiredPoints} pontos (atual: ${totalAbilityPoints})`);
          return false;
        }
        
        return true;
      default:
        return true;
    }
  }

  /**
   * Verifica se pode aumentar pontos de uma ability
   */
  _canIncreaseAbility(abilityKey) {
    const currentPoints = this.abilityPoints[abilityKey] || 0;
    const totalPointsUsed = Object.values(this.abilityPoints).reduce((sum, val) => sum + val, 0);
    const totalAvailable = this.baseAbilityPoints + this.bonusAbilityPoints;
    
    // Não pode exceder total de pontos disponíveis
    if (totalPointsUsed >= totalAvailable) {
      return false;
    }
    
    // Se ainda está usando pontos base (primeiros 12 pontos)
    if (totalPointsUsed < this.baseAbilityPoints) {
      // Não pode exceder 3 pontos por ability nos pontos base
      return currentPoints < this.maxPointsPerAbility;
    }
    
    // Está usando pontos bônus - sem limite por ability
    return true;
  }

  /**
   * Handler para aumentar pontos de uma ability
   */
  static async #onIncreaseAbility(event, target) {
    const abilityKey = target.dataset.abilityKey;
    
    if (!abilityKey) return;
    
    if (this._canIncreaseAbility(abilityKey)) {
      this.abilityPoints[abilityKey] = (this.abilityPoints[abilityKey] || 0) + 1;
      await this.render(true);
    } else {
      const totalPointsUsed = Object.values(this.abilityPoints).reduce((sum, val) => sum + val, 0);
      const currentPoints = this.abilityPoints[abilityKey] || 0;
      
      if (totalPointsUsed >= this.baseAbilityPoints + this.bonusAbilityPoints) {
        ui.notifications.warn("Você já usou todos os pontos disponíveis");
      } else if (currentPoints >= this.maxPointsPerAbility && totalPointsUsed < this.baseAbilityPoints) {
        ui.notifications.warn(`Máximo de ${this.maxPointsPerAbility} pontos por atributo (nos primeiros ${this.baseAbilityPoints} pontos)`);
      }
    }
  }

  /**
   * Handler para diminuir pontos de uma ability
   */
  static async #onDecreaseAbility(event, target) {
    const abilityKey = target.dataset.abilityKey;
    
    if (!abilityKey) return;
    
    if (this.abilityPoints[abilityKey] > 0) {
      this.abilityPoints[abilityKey]--;
      await this.render(true);
    }
  }

  /**
   * Handler para botão Aleatório (distribui pontos automaticamente)
   */
  static async #onRandomizeAbilities(event, target) {
    // Resetar todos os pontos
    for (const abilityKey in this.abilityPoints) {
      this.abilityPoints[abilityKey] = 0;
    }
    
    const abilityKeys = Object.keys(CONFIG.CARDIGAN.abilities);
    
    // Distribuir os 12 pontos base (máx. 3 por ability)
    let basePointsRemaining = this.baseAbilityPoints;
    while (basePointsRemaining > 0) {
      const randomKey = abilityKeys[Math.floor(Math.random() * abilityKeys.length)];
      
      // Só adiciona se não passou do máximo de 3
      if (this.abilityPoints[randomKey] < this.maxPointsPerAbility) {
        this.abilityPoints[randomKey]++;
        basePointsRemaining--;
      }
    }
    
    // Distribuir os 3 pontos bônus (sem limite)
    let bonusPointsRemaining = this.bonusAbilityPoints;
    while (bonusPointsRemaining > 0) {
      const randomKey = abilityKeys[Math.floor(Math.random() * abilityKeys.length)];
      this.abilityPoints[randomKey]++;
      bonusPointsRemaining--;
    }
    
    console.log('[CharacterWizard] Randomized ability points:', this.abilityPoints);
    await this.render(true);
  }

  /**
   * Handler para botão Concluir
   */
  static async #onFinish(event, target) {
    // Validar etapa final
    if (!this._validateCurrentStep()) {
      return;
    }

    try {
      const itemsToAdd = [];

      // Adicionar a raça selecionada ao ator
      if (this.selectedRace) {
        const raceDocument = await fromUuid(this.selectedRace.uuid);
        if (raceDocument) {
          itemsToAdd.push(raceDocument.toObject());
        }
      }

    // Adicionar as skills selecionadas ao ator
    const pathIncrements = {};
    let hasAndarilhoSkill = false;
    let hasFeiticeiroSkill = false;
    
    for (const skillUuid of this.selectedSkills) {
      const skillDocument = await fromUuid(skillUuid);
      if (skillDocument) {
        itemsToAdd.push(skillDocument.toObject());
        
        // Contar incrementos por caminho (APENAS skills contam, não aprimoramentos)
        const skillClass = skillDocument.system.skillClass;
        if (skillClass) {
          pathIncrements[skillClass] = (pathIncrements[skillClass] || 0) + 1;
          
          // Verificar se tem pelo menos 1 skill do Andarilho
          if (skillClass === 'andarilho') {
            hasAndarilhoSkill = true;
          }
          
          // Verificar se tem pelo menos 1 skill do Feiticeiro
          if (skillClass === 'feiticeiro') {
            hasFeiticeiroSkill = true;
          }
        }
      }
    }
    
    // Se selecionou pelo menos 1 skill do Andarilho, adicionar "Componentes" automaticamente
    if (hasAndarilhoSkill) {
      try {
        const componentesPack = game.packs.get('cardigan.skills-cardigan');
        if (componentesPack) {
          const componentesSkill = componentesPack.index.find(i => i.name === 'Componentes');
          if (componentesSkill) {
            const componentesDocument = await fromUuid(componentesSkill.uuid);
            if (componentesDocument) {
              itemsToAdd.push(componentesDocument.toObject());
              console.log('[CharacterWizard] Added Componentes skill automatically');
            }
          }
        }
      } catch (error) {
        console.error('[CharacterWizard] Error adding Componentes skill:', error);
      }
    }
    
    // Se selecionou pelo menos 1 skill do Feiticeiro, adicionar "Despertar Psiônico" automaticamente
    if (hasFeiticeiroSkill) {
      try {
        const despertarPack = game.packs.get('cardigan.skills-cardigan');
        if (despertarPack) {
          const despertarSkill = despertarPack.index.find(i => i.name === 'Despertar Psiônico');
          if (despertarSkill) {
            const despertarDocument = await fromUuid(despertarSkill.uuid);
            if (despertarDocument) {
              itemsToAdd.push(despertarDocument.toObject());
              console.log('[CharacterWizard] Added Despertar Psiônico skill automatically');
            }
          }
        }
      } catch (error) {
        console.error('[CharacterWizard] Error adding Despertar Psiônico skill:', error);
      }
    }
    
    // Criar todos os items de uma vez
      if (itemsToAdd.length > 0) {
        await this.actor.createEmbeddedDocuments("Item", itemsToAdd);
      }

      // Aplicar aprimoramentos selecionados
      for (const [skillUuid, enhancementIndices] of Object.entries(this.selectedEnhancements)) {
        // Encontrar o item de skill no ator (recém-criado)
        const skillDocument = await fromUuid(skillUuid);
        if (skillDocument && Array.isArray(enhancementIndices)) {
          const actorSkill = this.actor.items.find(i => i.name === skillDocument.name && i.type === 'skill');
          if (actorSkill) {
            // Marcar todos os aprimoramentos como adquiridos
            const acquiredEnhancements = actorSkill.system.acquiredEnhancements || {};
            for (const index of enhancementIndices) {
              acquiredEnhancements[index] = true;
            }
            
            await actorSkill.update({
              'system.acquiredEnhancements': acquiredEnhancements
            });
            
            console.log(`[CharacterWizard] Applied enhancements ${enhancementIndices.join(', ')} to skill ${actorSkill.name}`);
          }
        }
      }

      // Incrementar pontos de caminho e definir level inicial como 1
      const updates = {
        'system.attributes.level.value': 1
      };
      
      // Aplicar pontos de abilities ao baseValue
      for (const [abilityKey, points] of Object.entries(this.abilityPoints)) {
        if (points > 0) {
          updates[`system.abilities.${abilityKey}.baseValue`] = points;
        }
      }
      
      for (const [pathClass, count] of Object.entries(pathIncrements)) {
        const currentValue = this.actor.system.classes?.[pathClass] || 0;
        updates[`system.classes.${pathClass}`] = currentValue + count;
      }
      
      await this.actor.update(updates);

      ui.notifications.info("Personagem criado com sucesso!");
      
      // Fechar o wizard
      this.close();
      
    } catch (error) {
      console.error("Error finishing character creation:", error);
      ui.notifications.error("Erro ao concluir criação de personagem");
    }
  }

  /**
   * Handler para botão Cancelar
   */
  static async #onCancel(event, target) {
    this.close();
  }
}
