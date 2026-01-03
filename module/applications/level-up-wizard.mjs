const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Level Up Wizard - Manages character progression
 * Step 1: Skill/Enhancement selection (every level)
 * Step 2: Attribute distribution (every 3 levels: 3, 6, 9, 12...)
 */
export class LevelUpWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    
    // Current state
    this.currentStep = 1;
    this.newLevel = (actor.system.attributes.level.value || 0) + 1;
    
    // Determine total steps based on level
    this.totalSteps = (this.newLevel % 3 === 0) ? 2 : 1;
    
    // Step 1: Skill/Enhancement selection
    this.currentPath = null; // Caminho atualmente visualizado
    this.selectedSkillUuid = null;
    this.selectedEnhancementIndex = null;
    this.skillsData = [];
    
    // Step 2: Attribute selection (if applicable)
    this.selectedAttribute = null;
    
    // Track expanded skills
    this.expandedSkills = new Set();
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: LevelUpWizard.#onSubmitForm,
      closeOnSubmit: false,
      submitOnChange: false
    },
    classes: ["cardigan", "level-up-wizard"],
    position: {
      width: 600,
      height: "auto"
    },
    window: {
      title: "Level Up",
      icon: "fa-solid fa-arrow-up",
      resizable: true
    },
    actions: {
      previous: LevelUpWizard.#onPrevious,
      next: LevelUpWizard.#onNext,
      finish: LevelUpWizard.#onFinish,
      cancel: LevelUpWizard.#onCancel,
      selectPath: LevelUpWizard.#onSelectPath,
      selectSkill: LevelUpWizard.#onSelectSkill,
      selectEnhancement: LevelUpWizard.#onSelectEnhancement,
      selectAttribute: LevelUpWizard.#onSelectAttribute,
      toggleSkillDetails: LevelUpWizard.#onToggleSkillDetails
    }
  };

  static PARTS = {
    form: {
      template: "systems/cardigan/templates/dialogs/level-up-wizard.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    context.currentStep = this.currentStep;
    context.totalSteps = this.totalSteps;
    context.newLevel = this.newLevel;
    context.isFirstStep = this.currentStep === 1;
    context.isFinalStep = this.currentStep === this.totalSteps;
    
    // Step titles
    const stepTitles = {
      1: "Escolha uma Skill ou Aprimoramento",
      2: "Distribua 1 Ponto de Atributo"
    };
    context.stepTitle = stepTitles[this.currentStep];
    
    // Prepare step-specific data
    if (this.currentStep === 1) {
      await this._prepareStep1Context(context);
    } else if (this.currentStep === 2) {
      await this._prepareStep2Context(context);
    }
    
    return context;
  }

  /**
   * Prepare context for Step 1: Skill/Enhancement Selection
   */
  async _prepareStep1Context(context) {
    // Prepare paths data
    context.paths = await this._preparePathsData();
    
    // If a path is selected, prepare skills for that path
    if (this.currentPath) {
      context.currentPath = this.currentPath;
      context.currentPathName = this._getPathName(this.currentPath);
      context.currentPathSkills = await this._prepareSkillsForSelectedPath(this.currentPath);
    }
    
    context.selectedSkillUuid = this.selectedSkillUuid;
    context.selectedEnhancementIndex = this.selectedEnhancementIndex;
  }

  /**
   * Prepare paths data for display
   */
  async _preparePathsData() {
    const paths = [
      {
        id: 'andarilho',
        name: 'Andarilho',
        img: 'systems/cardigan/assets/images/paths/wanderer.webp',
        active: this.currentPath === 'andarilho'
      },
      {
        id: 'guerreiro',
        name: 'Guerreiro',
        img: 'systems/cardigan/assets/images/paths/warrior.webp',
        active: this.currentPath === 'guerreiro'
      },
      {
        id: 'ladino',
        name: 'Ladino',
        img: 'systems/cardigan/assets/images/paths/rogue.webp',
        active: this.currentPath === 'ladino'
      },
      {
        id: 'feiticeiro',
        name: 'Feiticeiro',
        img: 'systems/cardigan/assets/images/paths/wizard.webp',
        active: this.currentPath === 'feiticeiro'
      }
    ];
    
    // Get skills compendium to count skills
    const skillsPack = game.packs.get('cardigan.skills-cardigan');
    if (skillsPack) {
      const compendiumSkills = await skillsPack.getDocuments();
      
      // Count skills per path
      for (const path of paths) {
        const pathSkills = compendiumSkills.filter(s => 
          s.type === 'skill' && 
          s.system.skillClass === path.id &&
          s.system.skillClass !== 'raciais'
        );
        path.skillCount = pathSkills.length;
      }
    }
    
    return paths;
  }

  /**
   * Get path display name
   */
  _getPathName(pathId) {
    const names = {
      andarilho: 'Andarilho',
      guerreiro: 'Guerreiro',
      ladino: 'Ladino',
      feiticeiro: 'Feiticeiro'
    };
    return names[pathId] || pathId;
  }

  /**
   * Prepare skills for selected path
   */
  async _prepareSkillsForSelectedPath(pathId) {
    // Get skills compendium
    const skillsPack = game.packs.get('cardigan.skills-cardigan');
    if (!skillsPack) {
      console.error('[LevelUpWizard] Skills compendium not found');
      return [];
    }

    // Get all skills from compendium
    const compendiumSkills = await skillsPack.getDocuments();
    
    // Get actor's current skills
    const actorSkills = this.actor.items.filter(i => i.type === 'skill');
    const actorSkillNames = actorSkills.map(s => s.name);
    
    // Prepare skills data
    const skillsData = [];
    
    // Add actor's skills with available enhancements (only from selected path)
    for (const actorSkill of actorSkills) {
      // Skip if not from selected path
      if (actorSkill.system.skillClass !== pathId) continue;
      
      // Skip racial skills
      const isRacialSkill = actorSkill.system.skillClass === 'raciais';
      if (isRacialSkill) continue;
      
      // Filter out "Componentes" and "Despertar Psiônico" - they are added automatically
      if (actorSkill.name === "Componentes" || actorSkill.name === "Despertar Psiônico") {
        continue;
      }
      
      const enhancements = actorSkill.system.enhancements || [];
      const acquiredEnhancements = actorSkill.system.acquiredEnhancements || {};
      
      // Map ALL enhancements (showing which are acquired and which are available)
      const allEnhancements = enhancements.map((enh, index) => ({
        index: index,
        name: enh.name,
        description: enh.description,
        acquired: acquiredEnhancements[index] === true
      }));
      
      // Check if there are any available enhancements
      const hasAvailableEnhancements = allEnhancements.some(enh => !enh.acquired);
      
      if (hasAvailableEnhancements) {
        // Enrich descriptions
        const enrichedDescription = await foundry.applications.ux.TextEditor.enrichHTML(actorSkill.system.description || '', {
          async: true,
          relativeTo: actorSkill
        });
        
        const enrichedEnhancements = await Promise.all(
          allEnhancements.map(async (enh) => ({
            ...enh,
            description: await foundry.applications.ux.TextEditor.enrichHTML(enh.description || '', {
              async: true,
              relativeTo: actorSkill
            })
          }))
        );
        
        skillsData.push({
          id: actorSkill.id,
          uuid: actorSkill.uuid,
          name: actorSkill.name,
          img: actorSkill.img,
          description: enrichedDescription,
          isOwned: true,
          skillClass: actorSkill.system.skillClass,
          skillActionTypes: actorSkill.system.skillActionTypes || [],
          hasEnergyCost: actorSkill.system.hasEnergyCost || false,
          energyCost: actorSkill.system.energyCost || 0,
          spellCategories: actorSkill.system.spellCategories || [],
          enhancements: enrichedEnhancements,
          selected: this.selectedSkillUuid === actorSkill.uuid,
          expanded: this.expandedSkills.has(actorSkill.uuid)
        });
      }
    }
    
    // Add new skills from compendium (not yet owned, from selected path)
    for (const skill of compendiumSkills) {
      // Only show skills from selected path
      if (skill.system.skillClass !== pathId) continue;
      
      // Filter out racial skills and already owned skills
      const isRacialSkill = skill.system.skillClass === 'raciais';
      if (isRacialSkill || actorSkillNames.includes(skill.name)) continue;
      
      // Filter out "Componentes" and "Despertar Psiônico" - they are added automatically
      if (skill.name === "Componentes" || skill.name === "Despertar Psiônico") {
        continue;
      }
      
      // Enrich description
      const enrichedDescription = await foundry.applications.ux.TextEditor.enrichHTML(skill.system.description || '', {
        async: true,
        relativeTo: skill
      });
      
      skillsData.push({
        id: skill.id,
        uuid: skill.uuid,
        name: skill.name,
        img: skill.img,
        description: enrichedDescription,
        isOwned: false,
        skillClass: skill.system.skillClass,
        skillActionTypes: skill.system.skillActionTypes || [],
        hasEnergyCost: skill.system.hasEnergyCost || false,
        energyCost: skill.system.energyCost || 0,
        spellCategories: skill.system.spellCategories || [],
        enhancements: [],
        selected: this.selectedSkillUuid === skill.uuid,
        expanded: this.expandedSkills.has(skill.uuid)
      });
    }
    
    // Sort: owned skills first, then alphabetically
    skillsData.sort((a, b) => {
      if (a.isOwned && !b.isOwned) return -1;
      if (!a.isOwned && b.isOwned) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return skillsData;
    return skillsData;
  }

  /**
   * Prepare context for Step 2: Attribute Distribution
   */
  async _prepareStep2Context(context) {
    const abilities = [];
    
    for (const [key, labelKey] of Object.entries(CONFIG.CARDIGAN.abilities)) {
      const currentValue = this.actor.system.abilities[key]?.baseValue || 0;
      
      abilities.push({
        key: key,
        label: game.i18n.localize(labelKey),
        currentValue: currentValue,
        newValue: this.selectedAttribute === key ? currentValue + 1 : currentValue,
        selected: this.selectedAttribute === key
      });
    }
    
    context.abilities = abilities;
    context.selectedAttribute = this.selectedAttribute;
  }

  /**
   * Handler for path selection
   */
  static async #onSelectPath(event, target) {
    const pathId = target.dataset.pathId;
    
    if (this.currentPath === pathId) {
      // Deselect if clicking the same path
      this.currentPath = null;
    } else {
      this.currentPath = pathId;
    }
    
    // Clear skill selection when changing path
    this.selectedSkillUuid = null;
    this.selectedEnhancementIndex = null;
    this.expandedSkills.clear();
    
    await this.render(true);
  }

  /**
   * Handler for skill selection
   */
  static async #onSelectSkill(event, target) {
    event.stopPropagation();
    const skillUuid = target.dataset.skillUuid;
    
    console.log('[LevelUpWizard] Selecting skill:', skillUuid);
    
    if (this.selectedSkillUuid === skillUuid) {
      // Deselect if clicking the same skill
      this.selectedSkillUuid = null;
      this.selectedEnhancementIndex = null;
    } else {
      this.selectedSkillUuid = skillUuid;
      this.selectedEnhancementIndex = null; // Reset enhancement selection
    }
    
    console.log('[LevelUpWizard] Selected skill UUID:', this.selectedSkillUuid);
    await this.render(true);
  }

  /**
   * Handler for enhancement selection
   */
  static async #onSelectEnhancement(event, target) {
    event.stopPropagation();
    const enhancementIndex = parseInt(target.dataset.enhancementIndex);
    const skillUuid = target.dataset.skillUuid;
    
    console.log('[LevelUpWizard] Selecting enhancement:', enhancementIndex, 'for skill:', skillUuid);
    
    // Always set the skill as selected when selecting an enhancement
    this.selectedSkillUuid = skillUuid;
    
    if (this.selectedEnhancementIndex === enhancementIndex) {
      this.selectedEnhancementIndex = null;
    } else {
      this.selectedEnhancementIndex = enhancementIndex;
    }
    
    console.log('[LevelUpWizard] Selected:', { skillUuid: this.selectedSkillUuid, enhancementIndex: this.selectedEnhancementIndex });
    await this.render(true);
  }

  /**
   * Handler for attribute selection
   */
  static async #onSelectAttribute(event, target) {
    const abilityKey = target.dataset.abilityKey;
    
    if (this.selectedAttribute === abilityKey) {
      this.selectedAttribute = null;
    } else {
      this.selectedAttribute = abilityKey;
    }
    
    await this.render(true);
  }

  /**
   * Handler for toggling skill details (expansion)
   */
  static async #onToggleSkillDetails(event, target) {
    const skillUuid = target.dataset.skillUuid;
    
    if (this.expandedSkills.has(skillUuid)) {
      this.expandedSkills.delete(skillUuid);
    } else {
      this.expandedSkills.add(skillUuid);
    }
    
    await this.render(true);
  }

  /**
   * Handler for Previous button
   */
  static async #onPrevious(event, target) {
    if (this.currentStep > 1) {
      this.currentStep--;
      await this.render(true);
    }
  }

  /**
   * Handler for Next button
   */
  static async #onNext(event, target) {
    // Validate current step
    if (this.currentStep === 1) {
      if (!this.selectedSkillUuid) {
        ui.notifications.warn("Selecione uma skill ou aprimoramento");
        return;
      }
    }
    
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      await this.render(true);
    }
  }

  /**
   * Handler for Finish button
   */
  static async #onFinish(event, target) {
    try {
      // Validate final step
      if (this.currentStep === 1) {
        if (!this.selectedSkillUuid) {
          ui.notifications.warn("Selecione uma skill ou aprimoramento");
          return;
        }
      } else if (this.currentStep === 2) {
        if (!this.selectedAttribute) {
          ui.notifications.warn("Selecione um atributo para melhorar");
          return;
        }
      }
      
      // Apply level up changes
      await this._applyLevelUp();
      
      ui.notifications.info(`Level Up! Agora você está no nível ${this.newLevel}`);
      this.close();
      
    } catch (error) {
      console.error("Error finishing level up:", error);
      ui.notifications.error("Erro ao aplicar level up");
    }
  }

  /**
   * Apply all level up changes to the actor
   */
  async _applyLevelUp() {
    const updates = {};
    const itemsToAdd = [];
    
    // Step 1: Add skill or enhancement
    const actorSkill = this.actor.items.find(i => i.uuid === this.selectedSkillUuid);
    
    if (actorSkill) {
      // It's an owned skill - add enhancement
      if (this.selectedEnhancementIndex !== null) {
        const acquiredEnhancements = actorSkill.system.acquiredEnhancements || {};
        acquiredEnhancements[this.selectedEnhancementIndex] = true;
        
        await actorSkill.update({
          'system.acquiredEnhancements': acquiredEnhancements
        });
        
        console.log(`[LevelUpWizard] Added enhancement ${this.selectedEnhancementIndex} to skill ${actorSkill.name}`);
      }
    } else {
      // It's a new skill - add it
      const skillDocument = await fromUuid(this.selectedSkillUuid);
      if (skillDocument) {
        itemsToAdd.push(skillDocument.toObject());
        console.log(`[LevelUpWizard] Added new skill ${skillDocument.name}`);
      }
    }
    
    // Add new items if any
    if (itemsToAdd.length > 0) {
      await this.actor.createEmbeddedDocuments("Item", itemsToAdd);
    }
    
    // Step 2: Add attribute point (if applicable)
    if (this.totalSteps === 2 && this.selectedAttribute) {
      const currentValue = this.actor.system.abilities[this.selectedAttribute]?.baseValue || 0;
      updates[`system.abilities.${this.selectedAttribute}.baseValue`] = currentValue + 1;
      console.log(`[LevelUpWizard] Increased ${this.selectedAttribute} to ${currentValue + 1}`);
    }
    
    // Increment level and reset XP
    updates['system.attributes.level.value'] = this.newLevel;
    updates['system.experience.current'] = 0;
    
    // Apply all updates
    await this.actor.update(updates);
  }

  /**
   * Handler for Cancel button
   */
  static async #onCancel(event, target) {
    this.close();
  }

  /**
   * Form submission handler
   */
  static async #onSubmitForm(event, form, formData) {
    // Prevent default form submission
    event.preventDefault();
  }
}
