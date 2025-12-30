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
    this.totalSteps = 2; // Etapa 1: Raça, Etapa 2: Skills
    this.selectedRace = null;
    this.races = [];
    this.skills = {};
    this.selectedSkills = [];
    this.maxSkillPoints = 2;
    this.currentPath = null; // Caminho atualmente visualizado
    this.expandedSkillId = null; // Skill com detalhes expandidos
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
      toggleSkillDetails: CharacterCreationWizard.#onToggleSkillDetails
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
          const skillData = {
            ...skill,
            selected: this.selectedSkills.includes(skill.uuid),
            expanded: this.expandedSkillId === skill.id
          };

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
      
      context.selectedSkillsCount = this.selectedSkills.length;
      context.remainingPoints = this.maxSkillPoints - this.selectedSkills.length;
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
    } else {
      // Tentar selecionar skill
      if (this.selectedSkills.length >= this.maxSkillPoints) {
        ui.notifications.warn(`Você já selecionou o máximo de ${this.maxSkillPoints} skills`);
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
        // Validar que exatamente 2 skills foram selecionadas
        if (this.selectedSkills.length !== 2) {
          ui.notifications.warn(`Você deve selecionar exatamente 2 skills (${this.selectedSkills.length}/2 selecionadas)`);
          return false;
        }
        return true;
      default:
        return true;
    }
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
      for (const skillUuid of this.selectedSkills) {
        const skillDocument = await fromUuid(skillUuid);
        if (skillDocument) {
          itemsToAdd.push(skillDocument.toObject());
          
          // Contar incrementos por caminho
          const skillClass = skillDocument.system.skillClass;
          if (skillClass) {
            pathIncrements[skillClass] = (pathIncrements[skillClass] || 0) + 1;
          }
        }
      }

      // Criar todos os items de uma vez
      if (itemsToAdd.length > 0) {
        await this.actor.createEmbeddedDocuments("Item", itemsToAdd);
      }

      // Incrementar pontos de caminho
      // Cada skill escolhida incrementa 1 ponto no caminho
      // O cálculo especial de nível (2 pontos = nível 1) é feito em _calculateLevel()
      const updates = {};
      for (const [pathClass, count] of Object.entries(pathIncrements)) {
        const currentValue = this.actor.system.classes?.[pathClass] || 0;
        updates[`system.classes.${pathClass}`] = currentValue + count;
      }
      
      if (Object.keys(updates).length > 0) {
        await this.actor.update(updates);
      }

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
