/**
 * Abilities Listeners Module
 * Manages event listeners for dynamic ability fields (base value and total bonus)
 * Implements the Dynamic Base + Manual Field pattern
 */
export class AbilitiesListeners {

  /**
   * Initialize all abilities-related event listeners
   * @param {HTMLElement} element - The sheet's HTML element
   * @param {Actor} actor - The actor document
   */
  static initialize(element, actor) {
    this.addAbilitiesListeners(element, actor);
  }

  /**
   * Add focus/blur listeners to all dynamic ability fields
   * @param {HTMLElement} element - The sheet's HTML element
   * @param {Actor} actor - The actor document
   */
  static addAbilitiesListeners(element, actor) {
    const dynamicFields = element.querySelectorAll('.dynamic-field');

    dynamicFields.forEach(field => {
      const ability = field.dataset.ability;
      const fieldType = field.dataset.field; // 'value' ou 'totalBonus'

      field.addEventListener('focus', (event) => {
        this.handleAbilityFieldFocus(event, ability, fieldType, actor);
      });

      field.addEventListener('blur', (event) => {
        this.handleAbilityFieldBlur(event, ability, fieldType, actor);
      });
    });

    console.log(`[CARDIGAN] Dynamic abilities listeners added to ${dynamicFields.length} fields`);
  }

  /**
   * Handler for when the user focuses an ability field — shows the raw manual value
   * @param {FocusEvent} event
   * @param {string} ability
   * @param {string} fieldType - 'value' or 'totalBonus'
   * @param {Actor} actor
   */
  static handleAbilityFieldFocus(event, ability, fieldType, actor) {
    const field = event.target;
    const abilityData = actor.system.abilities[ability];

    if (fieldType === 'value') {
      const manualValue = abilityData.manualValue || 0;
      field.value = manualValue === 0 ? '' : manualValue;
      field.dataset.manualValue = manualValue;
      console.log(`[ABILITY FOCUS] ${ability}.value - Manual: ${manualValue}`);
    } else if (fieldType === 'totalBonus') {
      const manualBonus = abilityData.manualBonus || 0;
      field.value = manualBonus === 0 ? '' : manualBonus;
      field.dataset.manualBonus = manualBonus;
      console.log(`[ABILITY FOCUS] ${ability}.totalBonus - Manual: ${manualBonus}`);
    }

    field.select();
  }

  /**
   * Handler for when the user blurs an ability field — calculates and saves the total
   * @param {FocusEvent} event
   * @param {string} ability
   * @param {string} fieldType - 'value' or 'totalBonus'
   * @param {Actor} actor
   */
  static handleAbilityFieldBlur(event, ability, fieldType, actor) {
    const field = event.target;
    const userInput = Number(field.value) || 0;
    const abilityData = actor.system.abilities[ability];

    if (fieldType === 'value') {
      const baseValue = abilityData.baseValue || 0;
      const totalValue = baseValue + userInput;
      field.value = totalValue;
      field.dataset.manualValue = userInput;
      actor.update({
        [`system.abilities.${ability}.manualValue`]: userInput
      }).catch(error => {
        console.error(`[CARDIGAN] Erro ao atualizar ${ability}.manualValue:`, error);
      });
      console.log(`[ABILITY BLUR] ${ability}.value - Manual: ${userInput}, Total: ${totalValue}`);
    } else if (fieldType === 'totalBonus') {
      const calculatedBonus =
        (abilityData.baseBonus || 0) +
        (abilityData.weaponBonus || 0) +
        (abilityData.armorBonus || 0);
      const totalBonus = calculatedBonus + userInput;
      field.value = totalBonus;
      field.dataset.manualBonus = userInput;
      actor.update({
        [`system.abilities.${ability}.manualBonus`]: userInput
      }).catch(error => {
        console.error(`[CARDIGAN] Erro ao atualizar ${ability}.manualBonus:`, error);
      });
      console.log(`[ABILITY BLUR] ${ability}.totalBonus - Manual: ${userInput}, Calculated: ${calculatedBonus}, Total: ${totalBonus}`);
    }
  }

}
