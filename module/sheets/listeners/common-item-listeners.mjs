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
    this.setupSkillAbilityDropdown(sheet);
    this.setupFractureToggle(sheet);
    this.setupFractureModifierSelector(sheet);
    this.setupToxicityModifierSelector(sheet);
    this.setupSanityModifierSelector(sheet);
    this.setupHungerModifierSelector(sheet);
    this.setupThirstModifierSelector(sheet);
  }

  /**
   * Setup custom skill ability dropdown for consumable items.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupSkillAbilityDropdown(sheet) {
    if (sheet.item.type !== 'item-consumivel') return;

    const wrappers = Array.from(sheet.element?.querySelectorAll('[data-consumable-skill-ability]') ?? []);
    if (!wrappers.length) return;

    wrappers.forEach((wrapper) => {
      const hiddenInput = wrapper.querySelector('.consumable-item-skill-ability-input');
      const trigger = wrapper.querySelector('[data-consumable-skill-ability-trigger]');
      const label = wrapper.querySelector('[data-consumable-skill-ability-label]');
      const menu = wrapper.querySelector('[data-consumable-skill-ability-menu]');
      const options = Array.from(wrapper.querySelectorAll('[data-consumable-skill-ability-option]'));

      if (!hiddenInput || !trigger || !label || !menu || !options.length) return;

      const labelsByValue = options.reduce((acc, option) => {
        acc[option.dataset.value] = option.textContent?.trim() ?? '';
        return acc;
      }, {});

      const getCurrentValue = () => hiddenInput.value || 'accuracy';

      const syncSelection = () => {
        const currentValue = getCurrentValue();
        label.textContent = labelsByValue[currentValue] || 'Precisão';
        options.forEach((option) => {
          option.classList.toggle('is-selected', option.dataset.value === currentValue);
        });
      };

      const closeMenu = () => {
        menu.classList.add('is-collapsed');
        trigger.setAttribute('aria-expanded', 'false');
      };

      const openMenu = () => {
        menu.classList.remove('is-collapsed');
        trigger.setAttribute('aria-expanded', 'true');
      };

      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const isOpen = !menu.classList.contains('is-collapsed');
        if (isOpen) {
          closeMenu();
          return;
        }

        openMenu();

        const onOutsideClick = (outsideEvent) => {
          if (!wrapper.contains(outsideEvent.target)) {
            closeMenu();
            document.removeEventListener('click', onOutsideClick, true);
          }
        };

        document.addEventListener('click', onOutsideClick, true);
      });

      options.forEach((option) => {
        option.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation();

          const nextValue = option.dataset.value;
          if (!nextValue) return;

          if (hiddenInput.value !== nextValue) {
            hiddenInput.value = nextValue;
            await sheet.item.update({ 'system.skillCheckAbility': nextValue });
          }

          syncSelection();
          closeMenu();
        });
      });

      wrapper.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          closeMenu();
        }
      });

      syncSelection();
    });
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

  /**
   * Toggle the fracture details panel on the consumable form.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupFractureToggle(sheet) {
    if (sheet.item.type !== 'item-consumivel') return;

    const fractureToggle = sheet.element?.querySelector('[data-consumable-fracture-toggle]');
    const toxicityToggle = sheet.element?.querySelector('[data-consumable-toxicity-toggle]');
    const sanityToggle = sheet.element?.querySelector('[data-consumable-sanity-toggle]');
    const hungerToggle = sheet.element?.querySelector('[data-consumable-hunger-toggle]');
    const thirstToggle = sheet.element?.querySelector('[data-consumable-thirst-toggle]');
    const fracturePanel = sheet.element?.querySelector('[data-consumable-fracture-panel]');
    const fractureSection = sheet.element?.querySelector('[data-consumable-fracture-section]');
    const toxicitySection = sheet.element?.querySelector('[data-consumable-toxicity-section]');
    const sanitySection = sheet.element?.querySelector('[data-consumable-sanity-section]');
    const hungerSection = sheet.element?.querySelector('[data-consumable-hunger-section]');
    const thirstSection = sheet.element?.querySelector('[data-consumable-thirst-section]');
    if (!fractureToggle || !toxicityToggle || !sanityToggle || !hungerToggle || !thirstToggle || !fracturePanel || !fractureSection || !toxicitySection || !sanitySection || !hungerSection || !thirstSection) return;

    const setSectionsState = (nextState) => {
      const showFracture = Boolean(nextState.fracture);
      const showToxicity = Boolean(nextState.toxicity);
      const showSanity = Boolean(nextState.sanity);
      const showHunger = Boolean(nextState.hunger);
      const showThirst = Boolean(nextState.thirst);
      const showPanel = showFracture || showToxicity || showSanity || showHunger || showThirst;

      fracturePanel.classList.toggle('is-collapsed', !showPanel);
      fractureSection.classList.toggle('is-collapsed', !showFracture);
      toxicitySection.classList.toggle('is-collapsed', !showToxicity);
      sanitySection.classList.toggle('is-collapsed', !showSanity);
      hungerSection.classList.toggle('is-collapsed', !showHunger);
      thirstSection.classList.toggle('is-collapsed', !showThirst);

      fractureToggle.setAttribute('aria-expanded', String(showFracture));
      toxicityToggle.setAttribute('aria-expanded', String(showToxicity));
      sanityToggle.setAttribute('aria-expanded', String(showSanity));
      hungerToggle.setAttribute('aria-expanded', String(showHunger));
      thirstToggle.setAttribute('aria-expanded', String(showThirst));

      const topRow = fractureToggle.closest('.consumable-item-special-properties-row');
      topRow?.classList.toggle('is-fracture-active', showFracture);
      topRow?.classList.toggle('is-toxicity-active', showToxicity);
      topRow?.classList.toggle('is-sanity-active', showSanity);
      topRow?.classList.toggle('is-hunger-active', showHunger);
      topRow?.classList.toggle('is-thirst-active', showThirst);

      sheet._consumableSpecialPanelState = {
        fracture: showFracture,
        toxicity: showToxicity,
        sanity: showSanity,
        hunger: showHunger,
        thirst: showThirst,
      };
    };

    const initialState = sheet._consumableSpecialPanelState ?? {
      fracture: Boolean(sheet.item.system?.hasFractureModifier),
      toxicity: Boolean(sheet.item.system?.hasToxicityModifier),
      sanity: Boolean(sheet.item.system?.hasSanityModifier),
      hunger: Boolean(sheet.item.system?.hasFoodModifier),
      thirst: Boolean(sheet.item.system?.hasWaterModifier),
    };
    setSectionsState(initialState);

    const toggleSection = (section) => async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const currentState = sheet._consumableSpecialPanelState ?? { fracture: false, toxicity: false, sanity: false, hunger: false, thirst: false };
      const nextState = {
        ...currentState,
        [section]: !currentState[section],
      };

      setSectionsState(nextState);

      // If the section is turned off in the top row, disable its runtime modifier.
      if (section === 'fracture' && !nextState.fracture && sheet.item.system?.hasFractureModifier) {
        await sheet.item.update({
          'system.hasFractureModifier': false,
        });
      }

      if (section === 'toxicity' && !nextState.toxicity && sheet.item.system?.hasToxicityModifier) {
        await sheet.item.update({
          'system.hasToxicityModifier': false,
        });
      }

      if (section === 'sanity' && !nextState.sanity && sheet.item.system?.hasSanityModifier) {
        await sheet.item.update({
          'system.hasSanityModifier': false,
        });
      }

      if (section === 'hunger' && !nextState.hunger && sheet.item.system?.hasFoodModifier) {
        await sheet.item.update({
          'system.hasFoodModifier': false,
        });
      }

      if (section === 'thirst' && !nextState.thirst && sheet.item.system?.hasWaterModifier) {
        await sheet.item.update({
          'system.hasWaterModifier': false,
        });
      }
    };

    const handleFractureToggle = toggleSection('fracture');
    const handleToxicityToggle = toggleSection('toxicity');
    const handleSanityToggle = toggleSection('sanity');
    const handleHungerToggle = toggleSection('hunger');
    const handleThirstToggle = toggleSection('thirst');

    fractureToggle.addEventListener('click', handleFractureToggle);
    fractureToggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        void handleFractureToggle(event);
      }
    });

    toxicityToggle.addEventListener('click', handleToxicityToggle);
    toxicityToggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        void handleToxicityToggle(event);
      }
    });

    sanityToggle.addEventListener('click', handleSanityToggle);
    sanityToggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        void handleSanityToggle(event);
      }
    });

    hungerToggle.addEventListener('click', handleHungerToggle);
    hungerToggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        void handleHungerToggle(event);
      }
    });

    thirstToggle.addEventListener('click', handleThirstToggle);
    thirstToggle.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        void handleThirstToggle(event);
      }
    });
  }

  /**
   * Setup exclusive checkbox behavior for fracture modifier (+/-/none).
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupFractureModifierSelector(sheet) {
    if (sheet.item.type !== 'item-consumivel') return;

    const fractureChecks = Array.from(
      sheet.element?.querySelectorAll('.consumable-item-fracture-increase, .consumable-item-fracture-decrease') ?? []
    );
    if (!fractureChecks.length) return;

    const syncSelectedWrappers = () => {
      fractureChecks.forEach((checkbox) => {
        checkbox.closest('.consumable-item-fracture-button-wrapper')?.classList.toggle('is-selected', checkbox.checked);
      });
    };

    syncSelectedWrappers();

    fractureChecks.forEach((checkbox) => {
      checkbox.addEventListener('change', async () => {
        const currentPanelState = sheet._consumableSpecialPanelState ?? { fracture: false, toxicity: false, sanity: false, hunger: false, thirst: false };
        sheet._consumableSpecialPanelState = {
          ...currentPanelState,
          fracture: true,
        };

        if (checkbox.checked) {
          fractureChecks.forEach((otherCheckbox) => {
            if (otherCheckbox !== checkbox) otherCheckbox.checked = false;
          });

          await sheet.item.update({
            'system.hasFractureModifier': true,
            'system.fractureModifierType': checkbox.dataset.fractureModifierType,
          });
        } else {
          await sheet.item.update({
            'system.hasFractureModifier': false,
          });
        }

        syncSelectedWrappers();
      });
    });
  }

  /**
   * Setup exclusive checkbox behavior for toxicity modifier (+/-/none).
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupToxicityModifierSelector(sheet) {
    if (sheet.item.type !== 'item-consumivel') return;

    const toxicityChecks = Array.from(sheet.element?.querySelectorAll('.consumable-item-toxicity-increase, .consumable-item-toxicity-decrease') ?? []);
    if (!toxicityChecks.length) return;

    const syncSelectedWrappers = () => {
      toxicityChecks.forEach((checkbox) => {
        checkbox.closest('.consumable-item-fracture-button-wrapper')?.classList.toggle('is-selected', checkbox.checked);
      });
    };

    syncSelectedWrappers();

    toxicityChecks.forEach((checkbox) => {
      checkbox.addEventListener('change', async () => {
        const currentPanelState = sheet._consumableSpecialPanelState ?? { fracture: false, toxicity: false, sanity: false, hunger: false, thirst: false };
        sheet._consumableSpecialPanelState = {
          ...currentPanelState,
          toxicity: true,
        };

        if (checkbox.checked) {
          toxicityChecks.forEach((otherCheckbox) => {
            if (otherCheckbox !== checkbox) otherCheckbox.checked = false;
          });

          await sheet.item.update({
            'system.hasToxicityModifier': true,
            'system.toxicityModifierType': checkbox.dataset.toxicityModifierType,
          });
        } else {
          await sheet.item.update({
            'system.hasToxicityModifier': false,
          });
        }

        syncSelectedWrappers();
      });
    });
  }

  /**
   * Setup exclusive checkbox behavior for sanity modifier (+/-/none).
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupSanityModifierSelector(sheet) {
    if (sheet.item.type !== 'item-consumivel') return;

    const sanityChecks = Array.from(sheet.element?.querySelectorAll('.consumable-item-sanity-increase, .consumable-item-sanity-decrease') ?? []);
    if (!sanityChecks.length) return;

    const syncSelectedWrappers = () => {
      sanityChecks.forEach((checkbox) => {
        checkbox.closest('.consumable-item-fracture-button-wrapper')?.classList.toggle('is-selected', checkbox.checked);
      });
    };

    syncSelectedWrappers();

    sanityChecks.forEach((checkbox) => {
      checkbox.addEventListener('change', async () => {
        const currentPanelState = sheet._consumableSpecialPanelState ?? { fracture: false, toxicity: false, sanity: false, hunger: false, thirst: false };
        sheet._consumableSpecialPanelState = {
          ...currentPanelState,
          sanity: true,
        };

        if (checkbox.checked) {
          sanityChecks.forEach((otherCheckbox) => {
            if (otherCheckbox !== checkbox) otherCheckbox.checked = false;
          });

          await sheet.item.update({
            'system.hasStatusAilments': true,
            'system.hasSanityModifier': true,
            'system.sanityModifierType': checkbox.dataset.sanityModifierType,
          });
        } else {
          await sheet.item.update({
            'system.hasSanityModifier': false,
          });
        }

        syncSelectedWrappers();
      });
    });
  }

  /**
   * Setup exclusive checkbox behavior for hunger modifier (+/-/none).
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupHungerModifierSelector(sheet) {
    if (sheet.item.type !== 'item-consumivel') return;

    const hungerChecks = Array.from(sheet.element?.querySelectorAll('.consumable-item-hunger-increase, .consumable-item-hunger-decrease') ?? []);
    if (!hungerChecks.length) return;

    const syncSelectedWrappers = () => {
      hungerChecks.forEach((checkbox) => {
        checkbox.closest('.consumable-item-fracture-button-wrapper')?.classList.toggle('is-selected', checkbox.checked);
      });
    };

    syncSelectedWrappers();

    hungerChecks.forEach((checkbox) => {
      checkbox.addEventListener('change', async () => {
        const currentPanelState = sheet._consumableSpecialPanelState ?? { fracture: false, toxicity: false, sanity: false, hunger: false, thirst: false };
        sheet._consumableSpecialPanelState = {
          ...currentPanelState,
          hunger: true,
        };

        if (checkbox.checked) {
          hungerChecks.forEach((otherCheckbox) => {
            if (otherCheckbox !== checkbox) otherCheckbox.checked = false;
          });

          await sheet.item.update({
            'system.hasFoodAndWater': true,
            'system.hasFoodModifier': true,
            'system.foodModifierType': checkbox.dataset.hungerModifierType,
          });
        } else {
          await sheet.item.update({
            'system.hasFoodModifier': false,
          });
        }

        syncSelectedWrappers();
      });
    });
  }

  /**
   * Setup exclusive checkbox behavior for thirst modifier (+/-/none).
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupThirstModifierSelector(sheet) {
    if (sheet.item.type !== 'item-consumivel') return;

    const thirstChecks = Array.from(sheet.element?.querySelectorAll('.consumable-item-thirst-increase, .consumable-item-thirst-decrease') ?? []);
    if (!thirstChecks.length) return;

    const syncSelectedWrappers = () => {
      thirstChecks.forEach((checkbox) => {
        checkbox.closest('.consumable-item-fracture-button-wrapper')?.classList.toggle('is-selected', checkbox.checked);
      });
    };

    syncSelectedWrappers();

    thirstChecks.forEach((checkbox) => {
      checkbox.addEventListener('change', async () => {
        const currentPanelState = sheet._consumableSpecialPanelState ?? { fracture: false, toxicity: false, sanity: false, hunger: false, thirst: false };
        sheet._consumableSpecialPanelState = {
          ...currentPanelState,
          thirst: true,
        };

        if (checkbox.checked) {
          thirstChecks.forEach((otherCheckbox) => {
            if (otherCheckbox !== checkbox) otherCheckbox.checked = false;
          });

          await sheet.item.update({
            'system.hasFoodAndWater': true,
            'system.hasWaterModifier': true,
            'system.waterModifierType': checkbox.dataset.thirstModifierType,
          });
        } else {
          await sheet.item.update({
            'system.hasWaterModifier': false,
          });
        }

        syncSelectedWrappers();
      });
    });
  }
}
