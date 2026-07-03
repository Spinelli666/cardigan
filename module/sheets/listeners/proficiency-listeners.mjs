/**
 * Proficiency Listeners Module
 * Manages click/edit listeners for proficiency value fields (roll on left-click, edit on right-click)
 */
export class ProficiencyListeners {

  /**
   * Add click listeners to all proficiency value fields for rolling
   * Left-click: Show roll dialog
   * Right-click (contextmenu): Allow normal editing
   * @param {HTMLElement} element - The sheet's HTML element
   * @param {ActorSheet} sheet - The sheet instance (needed to call _onRoll)
   */
  static addProficiencyRollListeners(element, sheet) {
    const proficiencyFields = element.querySelectorAll('.proficiency-item .ability-value[data-ability]');

    if (proficiencyFields.length === 0) {
      console.warn('[CARDIGAN] No proficiency fields found for roll listeners');
      return;
    }

    proficiencyFields.forEach(field => {
      const abilityKey = field.dataset.ability;
      // Capitalize first letter for localization key (accuracy -> Accuracy)
      const abilityKeyCapitalized = abilityKey.charAt(0).toUpperCase() + abilityKey.slice(1);
      const localizationKey = `CARDIGAN.Ability.${abilityKeyCapitalized}.full`;
      const abilityLabel = game.i18n.localize(localizationKey);

      // Track edit mode per field
      let isEditMode = false;

      // Mousedown: Prevent focus on left-click
      field.addEventListener('mousedown', (event) => {
        if (event.button === 0 && !isEditMode) {
          event.preventDefault();
        }
        if (event.button === 2) {
          isEditMode = true;
        }
      });

      // Click: Trigger roll dialog (only if not in edit mode)
      field.addEventListener('click', async (event) => {
        if (isEditMode) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const rollData = {
          roll: `1d20+@${abilityKey}.total`,
          label: abilityLabel,
          key: abilityKey
        };

        const simulatedTarget = {
          dataset: rollData
        };

        await sheet.constructor._onRoll.call(sheet, event, simulatedTarget);

        console.log(`[CARDIGAN] ${abilityLabel} roll triggered from value field`);
      });

      // Right-click: Activate edit mode and force normal state (hide d20, show number)
      field.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        isEditMode = true;

        const statusDisplay = field.closest('.status-display');
        if (statusDisplay) {
          statusDisplay.classList.add('force-normal');
        }

        field.focus();
        field.select();

        console.log(`[CARDIGAN] ${abilityLabel} field opened for editing`);
      });

      // Blur: Deactivate edit mode when leaving the field
      field.addEventListener('blur', () => {
        isEditMode = false;

        const statusDisplay = field.closest('.status-display');
        if (statusDisplay) {
          statusDisplay.classList.remove('force-normal');
        }
      });

      field.style.cursor = 'pointer';
    });

    console.log(`[CARDIGAN] Proficiency roll listeners added to ${proficiencyFields.length} fields`);
  }

}
