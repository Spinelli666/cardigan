/**
 * Equipment Field Listeners Module
 * Manages event listeners for durability, quantity, and ammunition fields
 */
export class EquipmentFieldListeners {

  /**
   * Add listeners for durability inputs and toggle buttons
   * @param {HTMLElement} element - The sheet's HTML element
   * @param {Actor} actor - The actor document
   * @param {ActorSheet} sheet - The sheet instance (for durabilityExpandedItems)
   */
  static addDurabilityListeners(element, actor, sheet) {
    const durabilityInputs = element.querySelectorAll('input[name*="durability"]');
    durabilityInputs.forEach(input => {
      input.dataset.previousValue = input.value;
      input.addEventListener('blur', (event) => this.handleDurabilityChange(event, actor));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') e.target.blur();
      });
    });

    const durabilityToggleButtons = element.querySelectorAll('.item-durability .toggle-durability-display[data-action="toggleDurabilityDisplay"]');
    durabilityToggleButtons.forEach(button => {
      button.addEventListener('click', (event) => this.handleDurabilityToggle(event, sheet));
    });
  }

  /**
   * Toggle expanded durability display for an item row
   * @param {MouseEvent} event
   * @param {ActorSheet} sheet - The sheet instance
   */
  static handleDurabilityToggle(event, sheet) {
    event.preventDefault();
    event.stopPropagation();

    const toggleButton = event.currentTarget;
    const itemRow = toggleButton.closest('li.item[data-item-id]');
    const durabilityContainer = toggleButton.closest('.item-durability');

    if (!itemRow || !durabilityContainer) return;

    const itemId = itemRow.dataset.itemId;
    if (!itemId) return;

    const isExpanded = durabilityContainer.classList.toggle('is-durability-expanded');

    if (isExpanded) {
      sheet.durabilityExpandedItems.add(itemId);
    } else {
      sheet.durabilityExpandedItems.delete(itemId);
    }
  }

  /**
   * Restore durability expanded state after re-render
   * @param {HTMLElement} element - The sheet's HTML element
   * @param {ActorSheet} sheet - The sheet instance
   */
  static restoreDurabilityVisibility(element, sheet) {
    if (!element) return;

    element.querySelectorAll('li.item[data-item-id] .item-durability').forEach(container => {
      const itemRow = container.closest('li.item[data-item-id]');
      const itemId = itemRow?.dataset.itemId;
      if (itemId && sheet.durabilityExpandedItems.has(itemId)) {
        container.classList.add('is-durability-expanded');
      } else {
        container.classList.remove('is-durability-expanded');
      }
    });
  }

  /**
   * Handle changes to durability fields with validation
   * @param {Event} event
   * @param {Actor} actor - The actor document
   */
  static async handleDurabilityChange(event, actor) {
    const input = event.target;
    const name = input.name;
    const currentValue = input.value.trim();
    const previousValue = input.dataset.previousValue;

    if (currentValue === previousValue) return;

    if (currentValue === '') {
      console.log('[CARDIGAN] Campo vazio, aguardando valor...');
      return;
    }

    const match = name.match(/^items\.([^.]+)\.system\.durability\.(.+)$/);
    if (!match) return;

    const [, itemId, field] = match;
    let value = parseInt(currentValue);

    if (isNaN(value) || value < 0) {
      console.log('[CARDIGAN] Valor inválido, restaurando valor anterior');
      input.value = previousValue;
      return;
    }

    const item = actor.items.get(itemId);
    if (!item) return;

    if (field === 'current') {
      const maxDurability = item.system.durability.max;
      if (value > maxDurability) {
        console.log(`[CARDIGAN] Valor ${value} excede máximo ${maxDurability}, ajustando`);
        value = maxDurability;
        input.value = value;
      }
    } else if (field === 'max') {
      if (value < 1) {
        console.log(`[CARDIGAN] Durabilidade máxima deve ser pelo menos 1, ajustando`);
        value = 1;
        input.value = value;
      }

      const currentDurability = item.system.durability.current;
      if (currentDurability > value) {
        console.log(`[CARDIGAN] Ajustando durabilidade atual de ${currentDurability} para ${value}`);
        await item.update({
          'system.durability.current': value,
          'system.durability.max': value
        });
        input.dataset.previousValue = value.toString();
        return;
      }
    }

    console.log(`[CARDIGAN] Atualizando durabilidade - Item: ${itemId}, Campo: ${field}, Valor: ${value}`);

    const updateData = {};
    updateData[`system.durability.${field}`] = value;

    try {
      await item.update(updateData);
      input.dataset.previousValue = value.toString();
      console.log(`[CARDIGAN] Durabilidade atualizada com sucesso para ${item.name}`);
    } catch (error) {
      console.error('[CARDIGAN] Erro ao atualizar durabilidade:', error);
      input.value = previousValue;
    }
  }

  /**
   * Add listeners for item quantity inputs in the backpack table
   * @param {HTMLElement} element - The sheet's HTML element
   * @param {Actor} actor - The actor document
   */
  static addQuantityListeners(element, actor) {
    const quantityInputs = element.querySelectorAll('.backpack-table .item-quantity input[type="number"]');
    quantityInputs.forEach(input => {
      input.dataset.previousValue = input.value;
      this.updateQuantityInputWidth(input);
      input.addEventListener('input', () => this.updateQuantityInputWidth(input));
      input.addEventListener('blur', (event) => this.handleQuantityChange(event, actor));
    });
  }

  /**
   * Adjust input width based on digit count
   * @param {HTMLInputElement} input
   */
  static updateQuantityInputWidth(input) {
    if (!input) return;
    const digits = String(Math.abs(parseInt(input.value) || 0)).length;
    const widthCh = digits === 1 ? 1.5 : digits === 2 ? 2.5 : Math.max(1, Math.min(3, digits));
    input.style.width = `${widthCh}ch`;
  }

  /**
   * Sync widths for all quantity inputs in the inventory
   * @param {HTMLElement} element - The sheet's HTML element
   */
  static syncQuantityInputWidths(element) {
    const quantityInputs = element.querySelectorAll('.backpack-table .item-quantity input[type="number"]');
    quantityInputs.forEach((input) => this.updateQuantityInputWidth(input));
  }

  /**
   * Handle changes to item quantity fields with validation
   * @param {Event} event
   * @param {Actor} actor - The actor document
   */
  static async handleQuantityChange(event, actor) {
    const input = event.target;
    const name = input.name;
    const value = parseInt(input.value) || 0;
    const previousValue = input.dataset.previousValue;

    if (value.toString() === previousValue) return;

    console.log(`[CARDIGAN] Quantidade alterada: ${previousValue} → ${value}`);

    const match = name.match(/^items\.([^.]+)\.system\.quantity$/);
    if (!match) {
      console.warn('[CARDIGAN] Nome do campo de quantidade inválido:', name);
      return;
    }

    const itemId = match[1];
    const item = actor.items.get(itemId);

    if (!item) {
      console.warn('[CARDIGAN] Item não encontrado:', itemId);
      return;
    }

    const allowedQuantityTypes = ['item-comum', 'item-municao', 'item-consumivel', 'item-ingredient', 'arma', 'armadura'];
    if (!allowedQuantityTypes.includes(item.type)) {
      console.warn('[CARDIGAN] Tipo de item não permitido para edição de quantidade:', item.type);
      return;
    }

    const minQuantity = ['arma', 'armadura'].includes(item.type) ? 1 : 0;
    const finalValue = Math.max(minQuantity, value);
    if (finalValue !== value) {
      console.log(`[CARDIGAN] Valor ${value} ajustado para mínimo ${minQuantity}`);
      input.value = finalValue;
    }

    try {
      await item.update({ 'system.quantity': finalValue });
      input.dataset.previousValue = finalValue.toString();
      console.log(`[CARDIGAN] Quantidade atualizada com sucesso para ${item.name}: ${finalValue}`);
    } catch (error) {
      console.error('[CARDIGAN] Erro ao atualizar quantidade:', error);
      input.value = previousValue;
    }
  }

  /**
   * Add listeners for weapon ammunition inputs
   * @param {HTMLElement} element - The sheet's HTML element
   * @param {Actor} actor - The actor document
   */
  static addAmmunitionListeners(element, actor) {
    const ammunitionInputs = element.querySelectorAll('input[name*="ammunition"]');
    ammunitionInputs.forEach(input => {
      input.dataset.previousValue = input.value;
      input.addEventListener('blur', (event) => this.handleAmmunitionChange(event, actor));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') e.target.blur();
      });
    });
  }

  /**
   * Handle changes to ammunition fields with validation
   * @param {Event} event
   * @param {Actor} actor - The actor document
   */
  static async handleAmmunitionChange(event, actor) {
    const input = event.target;
    const name = input.name;
    const currentValue = input.value.trim();
    const previousValue = input.dataset.previousValue;

    if (currentValue === previousValue) return;

    if (currentValue === '') {
      console.log('[CARDIGAN] Campo vazio, aguardando valor...');
      return;
    }

    const match = name.match(/^items\.([^.]+)\.system\.ammunition\.(.+)$/);
    if (!match) return;

    const [, itemId, field] = match;
    let value = parseInt(currentValue);

    if (isNaN(value) || value < 0) {
      console.log('[CARDIGAN] Valor inválido, restaurando valor anterior');
      input.value = previousValue;
      return;
    }

    const item = actor.items.get(itemId);
    if (!item) return;

    if (field === 'current') {
      const maxAmmunition = item.system.ammunition.max;
      if (value > maxAmmunition) {
        console.log(`[CARDIGAN] Valor ${value} excede máximo ${maxAmmunition}, ajustando`);
        value = maxAmmunition;
        input.value = value;
      }
    } else if (field === 'max') {
      if (value < 0) {
        console.log(`[CARDIGAN] Munição máxima deve ser pelo menos 0, ajustando`);
        value = 0;
        input.value = value;
      }

      const currentAmmunition = item.system.ammunition.current;
      if (currentAmmunition > value) {
        console.log(`[CARDIGAN] Ajustando munição atual de ${currentAmmunition} para ${value}`);
        await item.update({
          'system.ammunition.current': value,
          'system.ammunition.max': value
        });
        input.dataset.previousValue = value.toString();
        return;
      }
    }

    console.log(`[CARDIGAN] Atualizando munição - Item: ${itemId}, Campo: ${field}, Valor: ${value}`);

    const updateData = {};
    updateData[`system.ammunition.${field}`] = value;

    try {
      await item.update(updateData);
      input.dataset.previousValue = value.toString();
      console.log(`[CARDIGAN] Munição atualizada com sucesso para ${item.name}`);
    } catch (error) {
      console.error('[CARDIGAN] Erro ao atualizar munição:', error);
      input.value = previousValue;
    }
  }

}
