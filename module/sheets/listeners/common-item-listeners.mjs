/**
 * Common Item Listeners Module
 * Manages shared listeners used by item-comum, item-municao and item-ingredient sheets.
 */
export class CommonItemListeners {

  /**
   * Initialize listeners for common-item family sheets.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static initialize(sheet) {
    this.setupProfessionSelectorButtons(sheet);
    this.setupWeightSelector(sheet);
  }

  /**
   * Setup profession selector buttons.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupProfessionSelectorButtons(sheet) {
    if (!['item-comum', 'item-ingredient', 'item-consumivel'].includes(sheet.item.type)) return;

    const grid =
      sheet.element?.querySelector('.common-item-type-selector-grid') ||
      sheet.element?.querySelector('.consumable-item-type-selector-grid');
    if (!grid) return;

    const buttons = grid.querySelectorAll('.common-item-type-selector-btn, .consumable-item-type-selector-btn');
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
   * Setup weight selector (clickable field + dialog options).
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupWeightSelector(sheet) {
    if (!['item-comum', 'item-municao', 'item-ingredient', 'item-consumivel'].includes(sheet.item.type)) return;

    const weightInput =
      sheet.element?.querySelector('.common-item-weight-display') ||
      sheet.element?.querySelector('.consumable-item-weight-display');
    const weightPanel =
      sheet.element?.querySelector('[data-common-item-extra-panel="weight"]') ||
      sheet.element?.querySelector('[data-consumable-item-extra-panel="weight"]');
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

    const options = sheet.item.type === 'item-municao'
      ? [
          { weight: 'leve', number: '0', label: 'LEVE' },
          { weight: 'medio', number: '1', label: 'MÉDIO' },
          { weight: 'pesado', number: '2', label: 'PESADO' }
        ]
      : [
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
}
