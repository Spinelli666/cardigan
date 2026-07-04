/**
 * Dialog for selecting racial skills for Race items
 */
export class RacialSkillsSelectionDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  
  constructor(options = {}) {
    super(options);
    this.item = options.item;
    this.racialSkills = [];
    this.selectedSkills = options.selectedSkills || [];
    this.onConfirmCallback = options.onConfirm || null;
  }

  static DEFAULT_OPTIONS = {
    id: "racial-skills-selection-dialog",
    tag: "dialog",
    window: {
      title: "CARDIGAN.Item.Race.SelectRacialSkills",
      icon: "fas fa-user-shield",
      minimizable: false,
      resizable: true
    },
    position: {
      width: 700,
      height: 600
    },
    actions: {
      confirm: RacialSkillsSelectionDialog.#onConfirm,
      cancel: RacialSkillsSelectionDialog.#onCancel
    }
  };

  static PARTS = {
    form: {
      template: "systems/cardigan/templates/dialogs/racial-skills-selection.hbs"
    }
  };

  async _prepareContext() {
    // Load racial skills from compendium and world
    await this._loadRacialSkills();

    return {
      racialSkills: this.racialSkills || []
    };
  }

  async _loadRacialSkills() {
    try {
      const allSkills = [];
      
      // Load skills from compendium
      const pack = game.packs.get("cardigan.skills-cardigan");
      if (pack) {
        const documents = await pack.getDocuments();
        const compendiumSkills = documents
          .filter(doc => doc.type === 'skill' && doc.system.skillClass === 'racial')
          .map(skill => ({
            id: skill.id,
            name: skill.name,
            img: skill.img || 'systems/cardigan/assets/images/decorative/icons/icon-item-generic.svg',
            uuid: skill.uuid,
            source: 'compendium'
          }));
        allSkills.push(...compendiumSkills);
      }
      
      // Load skills from world
      const worldSkills = game.items
        .filter(item => item.type === 'skill' && item.system.skillClass === 'racial')
        .map(skill => ({
          id: skill.id,
          name: skill.name,
          img: skill.img || 'systems/cardigan/assets/images/decorative/icons/icon-item-generic.svg',
          uuid: skill.uuid,
          source: 'world'
        }));
      allSkills.push(...worldSkills);
      
      // Mark selected skills
      this.racialSkills = allSkills.map(skill => ({
        ...skill,
        selected: this.selectedSkills.some(selected => 
          selected.uuid === skill.uuid || selected.id === skill.id
        )
      })).sort((a, b) => a.name.localeCompare(b.name));
      
      console.log('[RacialSkills] Loaded skills:', this.racialSkills.length);
      console.log('[RacialSkills] Selected:', this.racialSkills.filter(s => s.selected).map(s => s.name));
      
    } catch (error) {
      console.error("Error loading racial skills:", error);
      ui.notifications.error("Erro ao carregar skills raciais");
    }
  }

  static async #onConfirm(event, target) {
    try {
      const selectedSkills = [];
      const checkboxes = this.element.querySelectorAll('input[type="checkbox"]:checked');
      
      checkboxes.forEach(checkbox => {
        const skillId = checkbox.closest('.skill-option').dataset.skillId;
        const skillUuid = checkbox.closest('.skill-option').dataset.skillUuid;
        
        const skill = this.racialSkills.find(s => s.id === skillId);
        
        if (skill) {
          selectedSkills.push({
            id: skill.id,
            name: skill.name,
            img: skill.img,
            uuid: skillUuid
          });
        }
      });

      console.log('[RacialSkills] Selected skills:', selectedSkills.length, selectedSkills);

      // Use custom callback if provided, otherwise update item directly
      if (this.onConfirmCallback) {
        await this.onConfirmCallback(selectedSkills);
      } else {
        // Default behavior: Update the race item with selected skills
        await this.item.update({
          'system.racialSkills': selectedSkills
        });
      }

      ui.notifications.info(`${selectedSkills.length} skill(s) racial(is) selecionada(s)`);
      this.close();
    } catch (error) {
      console.error('[RacialSkills] Error confirming skill selection:', error);
      ui.notifications.error('Erro ao salvar skills raciais');
    }
  }

  static async #onCancel(event, target) {
    this.close();
  }
}

export default RacialSkillsSelectionDialog;
