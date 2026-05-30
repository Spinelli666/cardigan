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
    this.setupSkillTestAddButton(sheet);
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
   * Setup add button dialog for consumable skill test section.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupSkillTestAddButton(sheet) {
    if (sheet.item.type !== 'item-consumivel') return;

    const addButton = sheet.element?.querySelector('.consumable-item-skill-test-add-button');
    if (!addButton) return;

    const addedContentContainer = sheet.element?.querySelector('.consumable-item-skill-test-added-content');

    const getPersistedEffects = async () => {
      const effectsFromSystem = sheet.item.system?.skillTestAddedEffects;
      if (Array.isArray(effectsFromSystem)) return effectsFromSystem;

      const effectsFromFlag = await sheet.item.getFlag('cardigan', 'skillTestAddedEffects');
      return Array.isArray(effectsFromFlag) ? effectsFromFlag : [];
    };

    const renderAddedEffectsOnForm = (effects = []) => {
      if (!addedContentContainer) return;
      addedContentContainer.innerHTML = '';

      if (!effects.length) {
        addedContentContainer.classList.add('hidden');
        return;
      }

      addedContentContainer.classList.remove('hidden');

      effects.forEach((effect) => {
        const entry = document.createElement('div');
        entry.className = 'consumable-item-skill-test-added-entry';

        const item = document.createElement('div');
        item.className = 'consumable-item-skill-test-added-item';

        const flags = document.createElement('div');
        flags.className = 'consumable-item-skill-test-added-flags';

        const icon = document.createElement('img');
        icon.className = 'consumable-item-skill-test-added-icon';
        icon.src = effect.img || 'icons/svg/aura.svg';
        icon.alt = effect.name || 'Efeito';

        const name = document.createElement('span');
        name.className = 'consumable-item-skill-test-added-name';
        name.textContent = effect.name || 'Efeito sem nome';

        const rounds = document.createElement('span');
        rounds.className = 'consumable-item-skill-test-added-rounds';

        const clock = document.createElement('img');
        clock.className = 'consumable-item-skill-test-added-clock';
        clock.src = 'systems/cardigan/assets/images/decorative/icons/icon-clock.svg';
        clock.alt = 'Rodadas';

        const roundsValue = document.createElement('span');
        roundsValue.className = 'consumable-item-skill-test-added-rounds-value';
        if (effect.rounds === 'infinito' || effect.rounds === '∞') {
          const infiniteIcon = document.createElement('div');
          infiniteIcon.className = 'rounds-infinite-icon';
          roundsValue.appendChild(infiniteIcon);
        } else {
          roundsValue.textContent = effect.rounds || '0';
        }

        rounds.appendChild(clock);
        rounds.appendChild(roundsValue);

        item.appendChild(icon);
        item.appendChild(name);
        item.appendChild(rounds);

        if (effect.criticalFailure) {
          const criticalFailureIcon = document.createElement('img');
          criticalFailureIcon.className = 'consumable-item-skill-test-added-flag-icon';
          criticalFailureIcon.src = 'systems/cardigan/assets/images/decorative/icons/icon-critical-failure.svg';
          criticalFailureIcon.alt = 'Falha crítica';
          criticalFailureIcon.dataset.tooltip = 'Falha Crítica';
          criticalFailureIcon.dataset.tooltipClass = 'cardigan-tooltip';
          flags.appendChild(criticalFailureIcon);
        }

        if (effect.criticalHit) {
          const criticalHitIcon = document.createElement('img');
          criticalHitIcon.className = 'consumable-item-skill-test-added-flag-icon';
          criticalHitIcon.src = 'systems/cardigan/assets/images/decorative/icons/icon-critical-hit.svg';
          criticalHitIcon.alt = 'Acerto crítico';
          criticalHitIcon.dataset.tooltip = 'Acerto Crítico';
          criticalHitIcon.dataset.tooltipClass = 'cardigan-tooltip';
          flags.appendChild(criticalHitIcon);
        }

        entry.appendChild(item);
        entry.appendChild(flags);
        addedContentContainer.appendChild(entry);
      });
    };

    void (async () => {
      const persistedEffects = await getPersistedEffects();
      renderAddedEffectsOnForm(persistedEffects);
    })();

    addButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const templatePath = 'systems/cardigan/templates/dialogs/skill-test-add-dialog.hbs';
      const content = await foundry.applications.handlebars.renderTemplate(templatePath, {});

      const dialog = new foundry.applications.api.DialogV2({
        window: {
          title: ''
        },
        classes: ['cardigan-skill-test-add-dialog'],
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
          width: 580,
          height: 460
        }
      });

      await dialog.render(true);

      const selectedEffects = foundry.utils.deepClone(await getPersistedEffects());
      const effectsListContainer = dialog.element?.querySelector('[data-skill-test-effects-list]');

      const renderSelectedEffects = () => {
        if (!effectsListContainer) return;
        effectsListContainer.innerHTML = '';

        selectedEffects.forEach((effect, index) => {
          const item = document.createElement('div');
          item.className = 'skill-test-add-effect-item';
          item.dataset.effectIndex = String(index);

          const row = document.createElement('div');
          row.className = 'skill-test-add-effect-row';

          const main = document.createElement('div');
          main.className = 'skill-test-add-effect-main';

          const icon = document.createElement('img');
          icon.className = 'skill-test-add-effect-icon';
          icon.src = effect.img || 'icons/svg/aura.svg';
          icon.alt = effect.name || 'Efeito';

          const name = document.createElement('span');
          name.className = 'skill-test-add-effect-name';
          name.textContent = effect.name || 'Efeito sem nome';

          const rounds = document.createElement('span');
          rounds.className = 'skill-test-add-effect-rounds';

          const clock = document.createElement('img');
          clock.className = 'skill-test-add-effect-clock';
          clock.src = 'systems/cardigan/assets/images/decorative/icons/icon-clock.svg';
          clock.alt = 'Rodadas';

          const roundsValue = document.createElement('span');
          roundsValue.className = 'rounds-value';
          if (effect.rounds === 'infinito' || effect.rounds === '∞') {
            const infiniteIcon = document.createElement('div');
            infiniteIcon.className = 'rounds-infinite-icon';
            roundsValue.appendChild(infiniteIcon);
          } else {
            roundsValue.textContent = effect.rounds || '0';
          }

          const flags = document.createElement('div');
          flags.className = 'skill-test-add-effect-flags';

          const removeButton = document.createElement('button');
          removeButton.type = 'button';
          removeButton.className = 'skill-test-add-effect-remove-button';
          removeButton.setAttribute('aria-label', `Remover ${effect.name || 'efeito'}`);
          removeButton.dataset.tooltip = 'Excluir';
          removeButton.dataset.tooltipClass = 'cardigan-tooltip';

          const removeIcon = document.createElement('img');
          removeIcon.className = 'skill-test-add-effect-remove-icon';
          removeIcon.src = 'systems/cardigan/assets/images/decorative/icons/icon-delete.svg';
          removeIcon.alt = 'Remover efeito';

          const criticalFailureLabel = document.createElement('label');
          criticalFailureLabel.className = 'skill-test-add-effect-flag';
          criticalFailureLabel.dataset.tooltip = 'Falha Crítica';
          criticalFailureLabel.dataset.tooltipClass = 'cardigan-tooltip';

          const criticalFailureInput = document.createElement('input');
          criticalFailureInput.type = 'checkbox';
          criticalFailureInput.className = 'skill-test-add-effect-flag-input';
          criticalFailureInput.checked = Boolean(effect.criticalFailure);

          const criticalFailureIcon = document.createElement('img');
          criticalFailureIcon.className = 'skill-test-add-effect-flag-icon';
          criticalFailureIcon.src = 'systems/cardigan/assets/images/decorative/icons/icon-critical-failure.svg';
          criticalFailureIcon.alt = 'Falha crítica';

          criticalFailureInput.addEventListener('change', () => {
            effect.criticalFailure = criticalFailureInput.checked;
          });

          criticalFailureLabel.appendChild(criticalFailureInput);
          criticalFailureLabel.appendChild(criticalFailureIcon);

          const criticalHitLabel = document.createElement('label');
          criticalHitLabel.className = 'skill-test-add-effect-flag';
          criticalHitLabel.dataset.tooltip = 'Acerto Crítico';
          criticalHitLabel.dataset.tooltipClass = 'cardigan-tooltip';

          const criticalHitInput = document.createElement('input');
          criticalHitInput.type = 'checkbox';
          criticalHitInput.className = 'skill-test-add-effect-flag-input';
          criticalHitInput.checked = Boolean(effect.criticalHit);

          const criticalHitIcon = document.createElement('img');
          criticalHitIcon.className = 'skill-test-add-effect-flag-icon';
          criticalHitIcon.src = 'systems/cardigan/assets/images/decorative/icons/icon-critical-hit.svg';
          criticalHitIcon.alt = 'Acerto crítico';

          criticalHitInput.addEventListener('change', () => {
            effect.criticalHit = criticalHitInput.checked;
          });

          criticalHitLabel.appendChild(criticalHitInput);
          criticalHitLabel.appendChild(criticalHitIcon);

          main.appendChild(icon);
          main.appendChild(name);
          rounds.appendChild(clock);
          rounds.appendChild(roundsValue);
          flags.appendChild(criticalFailureLabel);
          flags.appendChild(criticalHitLabel);
          row.appendChild(main);
          row.appendChild(rounds);
          item.appendChild(row);
          item.appendChild(flags);
          removeButton.appendChild(removeIcon);
          item.appendChild(removeButton);

          removeButton.addEventListener('click', () => {
            const effectIndex = Number(item.dataset.effectIndex);
            if (Number.isNaN(effectIndex)) return;
            selectedEffects.splice(effectIndex, 1);
            renderSelectedEffects();
          });

          effectsListContainer.appendChild(item);
        });
      };

      const openEffectsDialog = async (submitEvent) => {
        submitEvent.preventDefault();
        submitEvent.stopPropagation();

        try {
          const { default: EffectsCompendiumSelectionDialog } = await import('../../applications/effects-compendium-selection-dialog.mjs');
          const actor = sheet.item?.actor ?? sheet.item?.parent ?? null;

          await EffectsCompendiumSelectionDialog.show(actor, {
            createOnActor: false,
            onEffectsAdded: async (effects) => {
              selectedEffects.push(
                ...effects.map((effect) => ({
                  ...effect,
                  criticalFailure: Boolean(effect.criticalFailure),
                  criticalHit: Boolean(effect.criticalHit)
                }))
              );
              renderSelectedEffects();
            }
          });
        } catch (error) {
          console.error('[CARDIGAN ERROR] Error opening effects-compendium-selection-dialog:', error);
          ui.notifications.error(`Erro ao abrir dialog de efeitos: ${error.message}`);
        }
      };

      const addEffectsButton = dialog.element?.querySelector('.skill-test-add-effects-add-button');
      addEffectsButton?.addEventListener('click', openEffectsDialog);

      const submitButton = dialog.element?.querySelector('.skill-test-add-submit-button');
      submitButton?.addEventListener('click', async (submitEvent) => {
        submitEvent.preventDefault();
        submitEvent.stopPropagation();

        const payload = selectedEffects.map((effect) => ({
          uuid: effect.uuid,
          name: effect.name,
          img: effect.img,
          rounds: effect.rounds || '0',
          criticalFailure: Boolean(effect.criticalFailure),
          criticalHit: Boolean(effect.criticalHit)
        }));

        await sheet.item.update({ 'system.skillTestAddedEffects': payload });
        await sheet.item.setFlag('cardigan', 'skillTestAddedEffects', payload);
        renderAddedEffectsOnForm(payload);
        dialog.close();
      });

      renderSelectedEffects();
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
