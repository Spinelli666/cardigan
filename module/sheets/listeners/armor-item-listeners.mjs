/**
 * Armor Item Listeners Module
 * Manages all armor-specific UI listeners for the item sheet.
 */
export class ArmorItemListeners {

  /**
   * Initialize all armor-related listeners for the item sheet.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static initialize(sheet) {
    this.setupArmorTypeSelectorButtons(sheet);
    this.setupCommonItemProfessionSelectorButtons(sheet);
    this.setupCommonItemWeightSelector(sheet);
    this.setupArmorIconCheckboxToggles(sheet);
  }

  /**
   * Setup armor type selector buttons.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupArmorTypeSelectorButtons(sheet) {
    if (sheet.item.type !== 'armadura') return;

    const grid = sheet.element?.querySelector('.armor-type-selector-grid');
    if (!grid) return;

    const buttons = grid.querySelectorAll('.armor-type-selector-btn');
    buttons.forEach(button => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const armorType = button.dataset.armorType;
        if (armorType && armorType !== sheet.item.system.armorType) {
          await sheet.item.update({ 'system.armorType': armorType });
        }
      });
    });
  }

  /**
   * Setup common-item profession selector buttons.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupCommonItemProfessionSelectorButtons(sheet) {
    if (sheet.item.type !== 'item-comum') return;

    const grid = sheet.element?.querySelector('.common-item-type-selector-grid');
    if (!grid) return;

    const buttons = grid.querySelectorAll('.common-item-type-selector-btn');
    buttons.forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const profession = button.dataset.profession;
        if (profession && profession !== sheet.item.system.profession) {
          await sheet.item.update({ 'system.profession': profession });
        }
      });
    });
  }

  /**
   * Setup common-item weight selector (clickable field + dialog options).
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupCommonItemWeightSelector(sheet) {
    if (sheet.item.type !== 'item-comum') return;

    const weightInput = sheet.element?.querySelector('.common-item-weight-display');
    const weightPanel = sheet.element?.querySelector('[data-common-item-extra-panel="weight"]');
    if (!weightInput || !weightPanel) return;

    const weightToNumber = {
      'leve': '0',
      'medio': '1',
      'pesado': '2',
      'muito-pesado': '4'
    };

    const updateDisplay = () => {
      const currentWeight = sheet.item.system?.weight;
      const weightNumber = weightToNumber[currentWeight] ?? '-';
      weightInput.value = weightNumber;
      weightInput.dataset.weightValue = weightNumber;
    };

    const options = [
      { weight: 'leve', number: '0', label: 'LEVE' },
      { weight: 'medio', number: '1', label: 'MÉDIO' },
      { weight: 'pesado', number: '2', label: 'PESADO' },
      { weight: 'muito-pesado', number: '4', label: 'M. PESADO' }
    ];

    const openWeightDialog = async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const templatePath = 'systems/cardigan/templates/dialogs/common-item-weight.hbs';
      const content = await foundry.applications.handlebars.renderTemplate(templatePath, {
        options,
        titleBorderPath: 'systems/cardigan/assets/images/decorative/border.webp'
      });

      const dialog = new foundry.applications.api.DialogV2({
        window: {
          title: 'PESO'
        },
        content,
        buttons: [
          {
            action: 'close',
            label: 'Fechar',
            callback: () => dialog.close()
          }
        ],
        rejectClose: false,
        modal: false,
        position: {
          width: 300,
          height: 'auto'
        },
        classes: ['cardigan-weight-selection-dialog']
      });

      await dialog.render(true);

      const optionButtons = dialog.element?.querySelectorAll('.weight-option') ?? [];
      optionButtons.forEach((button) => {
        const isSelected = button.dataset.weight === sheet.item.system?.weight;
        button.toggleAttribute('data-selected', isSelected);
      });

      optionButtons.forEach((button) => {
        button.addEventListener('click', async () => {
          optionButtons.forEach((otherButton) => otherButton.removeAttribute('data-selected'));
          button.setAttribute('data-selected', 'true');

          const selectedWeight = button.dataset.weight;
          if (selectedWeight && sheet.item.system?.weight !== selectedWeight) {
            await sheet.item.update({ 'system.weight': selectedWeight });
          }
        });
      });
    };

    weightPanel.addEventListener('click', openWeightDialog);
    weightInput.addEventListener('click', openWeightDialog);
    updateDisplay();
  }


  /**
   * Setup click/keyboard toggles where armor icons control checkbox fields.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupArmorIconCheckboxToggles(sheet) {
    if (sheet.item.type !== 'armadura') return;

    const root = sheet.element;
    if (!root) return;

    const toggleIcons = root.querySelectorAll('[data-armor-checkbox-toggle]');
    if (!toggleIcons.length) return;

    const syncIconState = (icon, isChecked) => {
      icon.classList.toggle('is-active', isChecked);
      icon.setAttribute('aria-pressed', String(isChecked));
      icon.closest('.armor-extra-content')?.classList.toggle('is-active', isChecked);
    };

    toggleIcons.forEach((icon) => {
      const checkboxPath = icon.dataset.armorCheckboxToggle;
      if (!checkboxPath) return;

      const hasExplicitValues =
        Object.prototype.hasOwnProperty.call(icon.dataset, 'armorToggleOnValue') ||
        Object.prototype.hasOwnProperty.call(icon.dataset, 'armorToggleOffValue');

      const onValue = icon.dataset.armorToggleOnValue ?? true;
      const offValue = icon.dataset.armorToggleOffValue ?? false;

      const getCurrentValue = () => foundry.utils.getProperty(sheet.item, checkboxPath);

      const isChecked = () => {
        const current = getCurrentValue();
        if (hasExplicitValues) return String(current) === String(onValue);
        return Boolean(current);
      };

      const toggleCheckbox = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const nextChecked = !isChecked();
        const nextValue = hasExplicitValues ? (nextChecked ? onValue : offValue) : nextChecked;
        syncIconState(icon, nextChecked);
        await sheet.item.update({ [checkboxPath]: nextValue });
      };

      icon.addEventListener('click', toggleCheckbox);
      icon.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          toggleCheckbox(event);
        }
      });

      syncIconState(icon, isChecked());
    });
  }
}
