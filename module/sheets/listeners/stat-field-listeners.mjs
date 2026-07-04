/**
 * Stat Field Listeners Module
 * Manages event listeners for experience, bonus, and current value fields
 */
export class StatFieldListeners {

  /**
   * Add listeners for the XP input field
   * @param {HTMLElement} element - The sheet's HTML element
   */
  static addExperienceListeners(element) {
    const xpInput = element?.querySelector("input[name='system.experience.current']");
    if (!(xpInput instanceof HTMLInputElement)) return;

    const clampXPValue = () => {
      if (xpInput.value === '') return;

      const parsedValue = Number.parseInt(xpInput.value, 10);
      if (Number.isNaN(parsedValue)) {
        xpInput.value = '0';
        return;
      }

      const clampedValue = Math.max(0, Math.min(100, parsedValue));
      xpInput.value = String(clampedValue);
    };

    clampXPValue();
    xpInput.addEventListener('input', clampXPValue);
    xpInput.addEventListener('blur', clampXPValue);
  }

  /**
   * Adjust XP input font-size based on digit count (3-digit threshold)
   * @param {HTMLElement} element - The sheet's HTML element
   */
  static setupExperienceInputFontSize(element) {
    const xpInput = element?.querySelector("input[name='system.experience.current']");
    if (!(xpInput instanceof HTMLInputElement)) return;

    const syncXPFontSize = () => {
      const parsedValue = Number.parseInt(xpInput.value, 10);
      const digits = Number.isNaN(parsedValue)
        ? String(xpInput.value || '').replace(/\D/g, '').length
        : String(Math.abs(parsedValue)).length;

      xpInput.classList.toggle('is-three-digits', digits >= 3);
    };

    syncXPFontSize();
    xpInput.addEventListener('input', syncXPFontSize);
    xpInput.addEventListener('change', syncXPFontSize);
    xpInput.addEventListener('blur', syncXPFontSize);
  }

  /**
   * Add listeners for bonus fields (health, energy, armor)
   * @param {HTMLElement} element - The sheet's HTML element
   * @param {Actor} actor - The actor document
   */
  static addBonusFieldsListeners(element, actor) {
    const bonusFields = [
      {
        selector: 'input.health-bonus-input.dynamic-field',
        hiddenSelector: 'input.health-bonus-hidden',
        type: 'healthBonus'
      },
      {
        selector: 'input.energy-bonus-input.dynamic-field',
        hiddenSelector: 'input.energy-bonus-hidden',
        type: 'energyBonus'
      },
      { selector: 'input.armor-bonus-input.dynamic-field', type: 'armorBonus' }
    ];

    bonusFields.forEach(({ selector, hiddenSelector, type }) => {
      const field = element.querySelector(selector);
      const hiddenField = hiddenSelector ? element.querySelector(hiddenSelector) : null;

      if (field) {
        this.syncBonusFieldDisplay(actor, field, type, hiddenField);

        field.addEventListener('focus', (event) => {
          this.handleBonusFieldFocus(event, actor, type, hiddenField);
        });

        field.addEventListener('blur', (event) => {
          this.handleBonusFieldBlur(event, actor, type, hiddenField);
        });
      }
    });

    console.log('[CARDIGAN] Bonus fields dynamic listeners added');
  }

  /**
   * Get equipment-derived bonus for a given stat bonus type
   * @param {Actor} actor - The actor document
   * @param {string} bonusType
   * @returns {number}
   */
  static getEquipmentStatusBonus(actor, bonusType) {
    const system = actor.system;

    switch (bonusType) {
      case 'armorBonus':
        return Number(system._armorProtectionBonus ?? 0);
      default:
        return 0;
    }
  }

  /**
   * Get active temporary armor bonus currently granted by consumable effects
   * @param {Actor} actor - The actor document
   * @returns {number}
   */
  static getActiveConsumableArmorBonus(actor) {
    return actor.items.reduce((total, item) => {
      if (item.type !== 'efeito') return total;
      if (!item.system?.isTemporaryArmor) return total;

      const bonus = Number(item.system?.armorBonusValue || 0);
      return total + bonus;
    }, 0);
  }

  /**
   * Sync visible bonus field value from manual + equipment bonuses
   * @param {Actor} actor - The actor document
   * @param {HTMLInputElement} field
   * @param {string} bonusType
   * @param {HTMLInputElement | null} hiddenField
   */
  static syncBonusFieldDisplay(actor, field, bonusType, hiddenField = null) {
    const manualValue = Number(actor.system.status?.[bonusType] || 0);
    const equipmentBonus = hiddenField ? this.getEquipmentStatusBonus(actor, bonusType) : 0;
    const displayValue = manualValue + equipmentBonus;

    field.value = displayValue;
    field.dataset.currentValue = displayValue;

    if (hiddenField) {
      hiddenField.value = manualValue;
    }
  }

  /**
   * Handler for when the user focuses a bonus field — shows editable value
   * @param {FocusEvent} event
   * @param {Actor} actor - The actor document
   * @param {string} bonusType
   * @param {HTMLInputElement | null} hiddenField
   */
  static handleBonusFieldFocus(event, actor, bonusType, hiddenField = null) {
    const field = event.target;
    const storedValue = Number(actor.system.status?.[bonusType] || 0);
    const equipmentBonus = hiddenField ? this.getEquipmentStatusBonus(actor, bonusType) : 0;

    let valueForEditing = hiddenField ? storedValue : (storedValue + equipmentBonus);

    if (bonusType === 'armorBonus' && !hiddenField) {
      const storedManual = actor.system.status?.armorBonusManual;
      const manualValue = Number.isFinite(Number(storedManual)) ? Number(storedManual) : storedValue;
      const temporaryBonus = Math.max(0, storedValue - manualValue);

      valueForEditing = manualValue;
      field.dataset.armorTemporaryBonus = temporaryBonus;
    }

    field.value = valueForEditing === 0 ? '' : valueForEditing;
    field.dataset.currentValue = valueForEditing;

    console.log(`[${bonusType.toUpperCase()} FOCUS] Editing value: ${valueForEditing}, Stored: ${storedValue}, Equipment: ${equipmentBonus}`);
    field.select();
  }

  /**
   * Handler for when the user blurs a bonus field — calculates and saves the total
   * @param {FocusEvent} event
   * @param {Actor} actor - The actor document
   * @param {string} bonusType
   * @param {HTMLInputElement | null} hiddenField
   */
  static handleBonusFieldBlur(event, actor, bonusType, hiddenField = null) {
    const field = event.target;
    const userInput = Number(field.value) || 0;
    const equipmentBonus = hiddenField ? this.getEquipmentStatusBonus(actor, bonusType) : 0;
    let storedValue = userInput;

    if (bonusType === 'armorBonus' && !hiddenField) {
      const temporaryBonus = Number(field.dataset.armorTemporaryBonus) || 0;
      storedValue = userInput + temporaryBonus;

      const displayValue = storedValue + equipmentBonus;
      field.value = displayValue;
      field.dataset.currentValue = displayValue;

      actor.update({
        'system.status.armorBonusManual': userInput,
        'system.status.armorBonus': storedValue
      }).catch(error => {
        console.error('[CARDIGAN] Erro ao atualizar armorBonus:', error);
      });

      console.log(`[${bonusType.toUpperCase()} BLUR] Total: ${displayValue}, Manual: ${userInput}, Temporary: ${temporaryBonus}, Equipment: ${equipmentBonus}`);
      return;
    }

    const displayValue = storedValue + equipmentBonus;
    field.value = displayValue;
    field.dataset.currentValue = displayValue;

    if (hiddenField) {
      hiddenField.value = storedValue;
    }

    actor.update({
      [`system.status.${bonusType}`]: storedValue
    }).catch(error => {
      console.error(`[CARDIGAN] Erro ao atualizar ${bonusType}:`, error);
    });

    console.log(`[${bonusType.toUpperCase()} BLUR] Total: ${displayValue}, Stored: ${storedValue}, Input: ${userInput}, Equipment: ${equipmentBonus}`);
  }

  /**
   * Add listeners for current value fields (health, energy, armor)
   * @param {HTMLElement} element - The sheet's HTML element
   * @param {Actor} actor - The actor document
   */
  static addValueFieldsListeners(element, actor) {
    const valueFields = [
      { selector: 'input[name="system.health.value"].dynamic-field', type: 'health', path: 'system.health.value' },
      { selector: 'input[name="system.power.value"].dynamic-field', type: 'power', path: 'system.power.value' },
      { selector: 'input[name="system.armor.value"].dynamic-field', type: 'armor', path: 'system.armor.value' }
    ];

    valueFields.forEach(({ selector, type, path }) => {
      const field = element.querySelector(selector);

      if (field) {
        field.addEventListener('focus', (event) => {
          this.handleValueFieldFocus(event, actor, type, path);
        });

        field.addEventListener('blur', (event) => {
          this.handleValueFieldBlur(event, actor, type, path);
        });
      }
    });

    console.log('[CARDIGAN] Value fields dynamic listeners added');
  }

  /**
   * Handler for when the user focuses a value field — shows current value
   * @param {FocusEvent} event
   * @param {Actor} actor - The actor document
   * @param {string} valueType
   * @param {string} valuePath
   */
  static handleValueFieldFocus(event, actor, valueType, valuePath) {
    const field = event.target;
    const system = actor.system;

    const pathParts = valuePath.split('.');
    let currentValue = system;
    for (let i = 1; i < pathParts.length; i++) { // Skip 'system'
      currentValue = currentValue[pathParts[i]];
    }

    field.value = currentValue === 0 ? '' : currentValue;
    field.dataset.currentValue = currentValue;

    console.log(`[${valueType.toUpperCase()} VALUE FOCUS] Current: ${currentValue}`);
    field.select();
  }

  /**
   * Handler for when the user blurs a value field — validates and saves
   * @param {FocusEvent} event
   * @param {Actor} actor - The actor document
   * @param {string} valueType
   * @param {string} valuePath
   */
  static handleValueFieldBlur(event, actor, valueType, valuePath) {
    const field = event.target;
    const userInput = Number(field.value) || 0;
    const system = actor.system;

    const pathParts = valuePath.split('.');
    const resourceType = pathParts[pathParts.length - 2]; // 'health', 'power', or 'armor'
    const maxValue = system[resourceType].max;

    const finalValue = Math.min(userInput, maxValue);

    if (finalValue !== userInput) {
      console.warn(`[${valueType.toUpperCase()} VALUE] Value ${userInput} capped to max ${maxValue}`);
    }

    field.value = finalValue;
    field.dataset.currentValue = finalValue;

    const updateData = {};
    updateData[valuePath] = finalValue;

    actor.update(updateData).catch(error => {
      console.error(`[CARDIGAN] Erro ao atualizar ${valuePath}:`, error);
    });

    console.log(`[${valueType.toUpperCase()} VALUE BLUR] Value: ${finalValue}${finalValue !== userInput ? ` (capped from ${userInput})` : ''}`);
  }

}
