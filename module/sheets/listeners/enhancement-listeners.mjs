/**
 * Enhancement Listeners Module
 * Manages checkbox listeners and linked-skill logic for skill enhancements
 */
export class EnhancementListeners {

  /**
   * Add listeners for skill enhancement checkboxes
   * @param {HTMLElement} element - The sheet's HTML element
   * @param {Actor} actor - The actor document
   * @param {ActorSheet} sheet - The sheet instance (for expandedSections and _refreshExpandedSummary)
   */
  static addEnhancementCheckboxListeners(element, actor, sheet) {
    const checkboxes = element.querySelectorAll('input[type="checkbox"][name^="system.acquiredEnhancements"][data-item-id]');

    checkboxes.forEach(checkbox => {
      checkbox.removeEventListener('change', checkbox._enhancementHandler);

      checkbox._enhancementHandler = async (event) => {
        const itemId = checkbox.dataset.itemId;
        const item = actor.items.get(itemId);

        if (!item) {
          console.error('[CARDIGAN] Item not found for enhancement checkbox:', itemId);
          return;
        }

        const match = checkbox.name.match(/system\.acquiredEnhancements\.(\d+)/);
        if (!match) {
          console.error('[CARDIGAN] Could not parse enhancement index from:', checkbox.name);
          return;
        }

        const index = parseInt(match[1]);
        const isChecked = checkbox.checked;

        const currentEnhancements = item.system.acquiredEnhancements || [false, false, false];
        const newEnhancements = [...currentEnhancements];
        newEnhancements[index] = isChecked;

        try {
          await item.update({
            'system.acquiredEnhancements': newEnhancements
          }, {
            render: false
          });

          const enhancement = item.system.enhancements?.[index];
          if (enhancement && enhancement.hasLinkedSkills && enhancement.linkedSkills?.length > 0) {
            if (isChecked) {
              await this.addEnhancementLinkedSkills(actor, item, index, enhancement.linkedSkills);
            } else {
              await this.removeEnhancementLinkedSkills(actor, item, index);
            }
          }

          const itemContainer = element.querySelector(`[data-item-id="${itemId}"]`)?.closest('.item-row, .item');
          if (itemContainer && sheet.expandedSections?.get(itemId)) {
            await sheet._refreshExpandedSummary(itemId, item);
          }

        } catch (error) {
          console.error('[CARDIGAN] Error updating enhancement:', error);
          checkbox.checked = !isChecked;
        }
      };

      checkbox.addEventListener('change', checkbox._enhancementHandler);
    });

    console.log(`[CARDIGAN] Enhancement checkbox listeners added (${checkboxes.length} checkboxes)`);
  }

  /**
   * Add linked skills when an enhancement is acquired
   * @param {Actor} actor - The actor document
   * @param {Item} parentSkill - The parent skill item
   * @param {number} enhancementIndex - Index of the enhancement (0, 1, or 2)
   * @param {Array} linkedSkills - Array of linked skill data
   */
  static async addEnhancementLinkedSkills(actor, parentSkill, enhancementIndex, linkedSkills) {
    if (!linkedSkills || linkedSkills.length === 0) return;

    console.log(`[CARDIGAN] Adding ${linkedSkills.length} linked skills for enhancement ${enhancementIndex} of ${parentSkill.name}`);

    const skillsToAdd = [];
    for (const linkedSkill of linkedSkills) {
      try {
        const skillDoc = await fromUuid(linkedSkill.uuid);
        if (!skillDoc) {
          console.warn(`[CARDIGAN] Could not find skill with UUID: ${linkedSkill.uuid}`);
          continue;
        }

        const existingSkill = actor.items.find(i =>
          i.type === 'skill' && i.name === skillDoc.name
        );

        if (existingSkill) {
          console.log(`[CARDIGAN] Skill ${skillDoc.name} already exists, skipping`);
          continue;
        }

        const skillData = skillDoc.toObject();
        skillData.system.enhancementLinkedSkill = {
          isEnhancementLinked: true,
          parentSkillId: parentSkill.id,
          parentSkillName: parentSkill.name,
          enhancementIndex: enhancementIndex
        };

        skillsToAdd.push(skillData);
      } catch (error) {
        console.error(`[CARDIGAN] Error processing linked skill:`, error);
      }
    }

    if (skillsToAdd.length > 0) {
      await actor.createEmbeddedDocuments('Item', skillsToAdd);
      ui.notifications.info(`${skillsToAdd.length} skill(s) vinculada(s) adicionada(s) pelo aprimoramento ${enhancementIndex + 1} de ${parentSkill.name}`);
    }
  }

  /**
   * Remove linked skills when an enhancement is unacquired
   * @param {Actor} actor - The actor document
   * @param {Item} parentSkill - The parent skill item
   * @param {number} enhancementIndex - Index of the enhancement (0, 1, or 2)
   */
  static async removeEnhancementLinkedSkills(actor, parentSkill, enhancementIndex) {
    console.log(`[CARDIGAN] Removing linked skills for enhancement ${enhancementIndex} of ${parentSkill.name}`);

    const linkedSkills = actor.items.filter(item =>
      item.type === 'skill' &&
      item.system.enhancementLinkedSkill?.isEnhancementLinked === true &&
      item.system.enhancementLinkedSkill?.parentSkillId === parentSkill.id &&
      item.system.enhancementLinkedSkill?.enhancementIndex === enhancementIndex
    );

    if (linkedSkills.length > 0) {
      const idsToDelete = linkedSkills.map(s => s.id);
      await actor.deleteEmbeddedDocuments('Item', idsToDelete);
      ui.notifications.info(`${linkedSkills.length} skill(s) vinculada(s) removida(s) do aprimoramento ${enhancementIndex + 1} de ${parentSkill.name}`);
    }
  }

}
