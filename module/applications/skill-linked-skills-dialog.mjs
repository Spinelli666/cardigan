/**
 * Dialog for selecting linked skills for skills
 */
export class SkillLinkedSkillsDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  
  constructor(options = {}) {
    super(options);
    this.item = options.item;
    this.skills = [];
    this.selectedSkills = options.selectedSkills || [];
    this.onConfirmCallback = options.onConfirm || null; // Custom callback
  }

  static DEFAULT_OPTIONS = {
    id: "skill-linked-skills-dialog",
    tag: "dialog",
    window: {
      title: "Selecionar Skills Vinculadas",
      icon: "fas fa-link",
      minimizable: false,
      resizable: true
    },
    position: {
      width: 800,
      height: 700
    },
    actions: {
      confirm: SkillLinkedSkillsDialog.#onConfirm,
      cancel: SkillLinkedSkillsDialog.#onCancel
    }
  };

  static PARTS = {
    form: {
      template: "systems/cardigan/templates/dialogs/skill-linked-skills.hbs"
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  };

  async _prepareContext() {
    // Load skills from compendium
    await this._loadSkillsFromCompendium();

    return {
      skillsByClass: this.skillsByClass || {},
      buttons: [
        {
          type: "submit",
          action: "confirm",
          label: "CARDIGAN.Common.Confirm",
          icon: "fas fa-check"
        },
        {
          type: "button", 
          action: "cancel",
          label: "CARDIGAN.Common.Cancel",
          icon: "fas fa-times"
        }
      ]
    };
  }

  async _loadSkillsFromCompendium() {
    try {
      const pack = game.packs.get("cardigan.skills-cardigan");
      if (!pack) {
        ui.notifications.warn("Compêndio de skills não encontrado");
        return;
      }

      // Load all documents from the pack
      const documents = await pack.getDocuments();
      
      console.log('[CARDIGAN DEBUG] Selected skills on load:', this.selectedSkills);
      
      const allSkills = documents
        .filter(doc => doc.type === 'skill')
        // Exclude the current skill being edited
        .filter(doc => doc.id !== this.item.id)
        .map(skill => ({
          id: skill.id,
          name: skill.name,
          img: skill.img || 'systems/cardigan/assets/images/decorative/icons/icon-item-generic.svg',
          selected: this.selectedSkills.some(selected => selected.id === skill.id),
          skillClass: skill.system.skillClass || 'andarilho',
          uuid: skill.uuid
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      console.log('[CARDIGAN DEBUG] All skills loaded:', allSkills.length);
      console.log('[CARDIGAN DEBUG] Skills marked as selected:', allSkills.filter(s => s.selected).map(s => s.name));

      // Group skills by class
      this.skillsByClass = {
        andarilho: allSkills.filter(s => s.skillClass === 'andarilho'),
        guerreiro: allSkills.filter(s => s.skillClass === 'guerreiro'),
        ladino: allSkills.filter(s => s.skillClass === 'ladino'),
        feiticeiro: allSkills.filter(s => s.skillClass === 'feiticeiro'),
        raciais: allSkills.filter(s => s.skillClass === 'raciais'),
        unicas: allSkills.filter(s => s.skillClass === 'unicas')
      };
    } catch (error) {
      console.error("Error loading skills from compendium:", error);
      ui.notifications.error("Erro ao carregar skills do compêndio");
    }
  }

  static async #onConfirm(event, target) {
    try {
      // Get selected skills
      const selectedSkills = [];
      const checkboxes = this.element.querySelectorAll('input[type="checkbox"]:checked');
      
      console.log('[CARDIGAN DEBUG] Checkboxes found:', checkboxes.length);
      
      checkboxes.forEach(checkbox => {
        const skillId = checkbox.closest('.skill-option').dataset.skillId;
        const skillUuid = checkbox.closest('.skill-option').dataset.skillUuid;
        console.log('[CARDIGAN DEBUG] Processing skill ID:', skillId, 'UUID:', skillUuid);
        
        // Search in all skill classes
        let skill = null;
        for (const classSkills of Object.values(this.skillsByClass || {})) {
          skill = classSkills.find(s => s.id === skillId);
          if (skill) break;
        }
        
        if (skill) {
          selectedSkills.push({
            id: skill.id,
            name: skill.name,
            img: skill.img,
            uuid: skillUuid
          });
          console.log('[CARDIGAN DEBUG] Added skill:', skill.name);
        }
      });

      console.log('[CARDIGAN DEBUG] Total selected skills:', selectedSkills.length, selectedSkills);

      // Use custom callback if provided, otherwise update item directly
      if (this.onConfirmCallback) {
        await this.onConfirmCallback(selectedSkills);
      } else {
        // Default behavior: Update the item with selected skills
        await this.item.update({
          'system.linkedSkills': selectedSkills
        });
      }

      ui.notifications.info(`${selectedSkills.length} skill(s) vinculada(s) selecionada(s)`);
      this.close();
    } catch (error) {
      console.error('[CARDIGAN DEBUG] Error confirming skill selection:', error);
      ui.notifications.error('Erro ao salvar skills vinculadas');
    }
  }

  static async #onCancel(event, target) {
    this.close();
  }
}

export default SkillLinkedSkillsDialog;
