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
    this.setupLifeEnergyAddButton(sheet);
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

      const originalParent = menu.parentElement;
      const originalNextSibling = menu.nextSibling;
      let outsideClickHandler = null;
      let repositionHandler = null;

      const detachOutsideListener = () => {
        if (outsideClickHandler) {
          document.removeEventListener('click', outsideClickHandler, true);
          outsideClickHandler = null;
        }
      };

      const detachRepositionHandlers = () => {
        if (repositionHandler) {
          window.removeEventListener('resize', repositionHandler);
          window.removeEventListener('scroll', repositionHandler, true);
          repositionHandler = null;
        }
      };

      const restoreMenuToWrapper = () => {
        if (!originalParent) return;
        if (menu.parentElement !== originalParent) {
          originalParent.insertBefore(menu, originalNextSibling);
        }

        menu.classList.remove('consumable-item-skill-ability-menu-portal');
        menu.style.position = '';
        menu.style.top = '';
        menu.style.left = '';
        menu.style.width = '';
        menu.style.zIndex = '';
      };

      const positionMenuAsPortal = () => {
        const rect = trigger.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${Math.round(rect.bottom + 1)}px`;
        menu.style.left = `${Math.round(rect.left)}px`;
        menu.style.width = `${Math.round(rect.width)}px`;
        menu.style.zIndex = '10000';
      };

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
        detachOutsideListener();
        detachRepositionHandlers();
        restoreMenuToWrapper();
      };

      const openMenu = () => {
        if (menu.parentElement !== document.body) {
          document.body.appendChild(menu);
        }

        menu.classList.add('consumable-item-skill-ability-menu-portal');
        positionMenuAsPortal();
        menu.classList.remove('is-collapsed');
        trigger.setAttribute('aria-expanded', 'true');

        repositionHandler = () => {
          if (menu.classList.contains('is-collapsed')) return;
          positionMenuAsPortal();
        };

        window.addEventListener('resize', repositionHandler);
        window.addEventListener('scroll', repositionHandler, true);
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

        outsideClickHandler = (outsideEvent) => {
          const clickTarget = outsideEvent.target;
          if (!wrapper.contains(clickTarget) && !menu.contains(clickTarget)) {
            closeMenu();
          }
        };

        document.addEventListener('click', outsideClickHandler, true);
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

    const getPersistedSkills = async () => {
      const skillsFromFlag = await sheet.item.getFlag('cardigan', 'skillTestAddedSkills');
      return Array.isArray(skillsFromFlag) ? skillsFromFlag : [];
    };

    const skillOptions = [
      { key: 'accuracy', label: 'Precisão' },
      { key: 'evasion', label: 'Evasão' },
      { key: 'strength', label: 'Força' },
      { key: 'dexterity', label: 'Destreza' },
      { key: 'stamina', label: 'Vigor' },
      { key: 'persuasion', label: 'Persuasão' },
      { key: 'intelligence', label: 'Inteligência' },
      { key: 'stealth', label: 'Furtividade' }
    ];

    const normalizeSelectedSkills = (skills = []) => {
      if (!Array.isArray(skills)) return [];
      return skills
        .map((entry) => {
          if (typeof entry === 'string') {
            return {
              key: entry,
              skillValue: 0,
              criticalFailure: false,
              criticalHit: false
            };
          }

          if (entry && typeof entry === 'object' && typeof entry.key === 'string') {
            const parsedValue = Number.parseInt(entry.skillValue ?? entry.value, 10);
            return {
              key: entry.key,
              skillValue: Number.isNaN(parsedValue) ? 0 : Math.max(-99, Math.min(99, parsedValue)),
              criticalFailure: Boolean(entry.criticalFailure),
              criticalHit: Boolean(entry.criticalHit)
            };
          }

          return null;
        })
        .filter(Boolean);
    };

    const normalizeRoundsValue = (rounds) => {
      if (rounds === '∞' || rounds === 'infinito') return 'infinito';

      const parsedRounds = Number.parseInt(rounds, 10);
      if (Number.isNaN(parsedRounds)) return '0';

      const clampedRounds = Math.max(0, Math.min(5, parsedRounds));
      return String(clampedRounds);
    };

    const renderAddedContentOnForm = (effects = [], skills = []) => {
      if (!addedContentContainer) return;
      addedContentContainer.innerHTML = '';

      if (!effects.length && !skills.length) {
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

      skills.forEach((skill) => {
        const skillData = skillOptions.find((option) => option.key === skill.key);
        if (!skillData) return;

        const entry = document.createElement('div');
        entry.className = 'consumable-item-skill-test-added-entry';

        const item = document.createElement('div');
        item.className = 'consumable-item-skill-test-added-item consumable-item-skill-test-added-skill-item';

        const flags = document.createElement('div');
        flags.className = 'consumable-item-skill-test-added-flags';

        const name = document.createElement('span');
        name.className = 'consumable-item-skill-test-added-name';
        name.textContent = skillData.label;

        const value = document.createElement('span');
        value.className = 'consumable-item-skill-test-added-skill-value';
        const numericValue = Number(skill.skillValue ?? skill.value ?? 0);
        const modifierPrefix = numericValue > 0 ? '+' : '';
        value.textContent = `${modifierPrefix}${numericValue}`;

        item.appendChild(name);
        item.appendChild(value);

        if (skill.criticalFailure) {
          const criticalFailureIcon = document.createElement('img');
          criticalFailureIcon.className = 'consumable-item-skill-test-added-flag-icon';
          criticalFailureIcon.src = 'systems/cardigan/assets/images/decorative/icons/icon-critical-failure.svg';
          criticalFailureIcon.alt = 'Falha crítica';
          criticalFailureIcon.dataset.tooltip = 'Falha Crítica';
          criticalFailureIcon.dataset.tooltipClass = 'cardigan-tooltip';
          flags.appendChild(criticalFailureIcon);
        }

        if (skill.criticalHit) {
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
      const persistedSkills = normalizeSelectedSkills(await getPersistedSkills());
      renderAddedContentOnForm(persistedEffects, persistedSkills);
    })();

    addButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (sheet._skillTestAddDialog?.element) {
        if (typeof sheet._skillTestAddDialog.bringToFront === 'function') {
          sheet._skillTestAddDialog.bringToFront();
        }
        return;
      }

      const templatePath = 'systems/cardigan/templates/dialogs/skill-test-add-dialog.hbs';
      const content = await foundry.applications.handlebars.renderTemplate(templatePath, {});

      const dialog = sheet._skillTestAddDialog = new foundry.applications.api.DialogV2({
        window: {
          title: '',
          frame: true,
          positioned: true
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
          width: 'auto',
          height: 'auto'
        }
      });

      dialog.addEventListener('close', () => {
        if (sheet._skillTestAddDialog === dialog) sheet._skillTestAddDialog = null;
      }, { once: true });

      await dialog.render({ force: true });
      const closeBtn = dialog.element?.querySelector('.header-control.fa-xmark');
      if (closeBtn) {
        closeBtn.dataset.tooltip = 'Fechar Janela';
        closeBtn.dataset.tooltipClass = 'cardigan-tooltip';
      }
      if (typeof dialog.bringToFront === 'function') {
        dialog.bringToFront();
      }

      const selectedEffects = foundry.utils.deepClone(await getPersistedEffects());
      const effectsListContainer = dialog.element?.querySelector('[data-skill-test-effects-list]');
      const skillsListContainer = dialog.element?.querySelector('[data-skill-test-list]');
      const persistedSkills = foundry.utils.deepClone(await getPersistedSkills());

      const selectedSkills = normalizeSelectedSkills(persistedSkills);

      const renderSelectedSkills = () => {
        if (!skillsListContainer) return;
        skillsListContainer.innerHTML = '';

        selectedSkills.forEach((skillEntry, skillIndex) => {
          const skillData = skillOptions.find((option) => option.key === skillEntry.key);
          if (!skillData) return;

          const item = document.createElement('div');
          item.className = 'skill-test-add-skill-item';

          const nameContainer = document.createElement('div');
          nameContainer.className = 'skill-test-add-skill-name-container';

          const name = document.createElement('span');
          name.className = 'skill-test-add-skill-name';
          name.textContent = skillData.label;

          const flags = document.createElement('div');
          flags.className = 'skill-test-add-effect-flags';

          const controls = document.createElement('div');
          controls.className = 'skill-test-add-skill-controls';

          const inputWrapper = document.createElement('div');
          inputWrapper.className = 'skill-test-add-skill-input-wrapper skill-test-add-skill-range-wrapper';

          const valueInput = document.createElement('input');
          valueInput.type = 'number';
          valueInput.className = 'skill-test-add-skill-range-input';
          valueInput.min = '-99';
          valueInput.max = '99';
          valueInput.step = '1';
          valueInput.value = String(skillEntry.skillValue ?? 0);

          const criticalFailureLabel = document.createElement('label');
          criticalFailureLabel.className = 'skill-test-add-effect-flag';
          criticalFailureLabel.dataset.tooltip = 'Falha Crítica';
          criticalFailureLabel.dataset.tooltipClass = 'cardigan-tooltip';

          const criticalFailureInput = document.createElement('input');
          criticalFailureInput.type = 'checkbox';
          criticalFailureInput.className = 'skill-test-add-effect-flag-input';
          criticalFailureInput.checked = Boolean(skillEntry.criticalFailure);

          const criticalFailureIcon = document.createElement('img');
          criticalFailureIcon.className = 'skill-test-add-effect-flag-icon';
          criticalFailureIcon.src = 'systems/cardigan/assets/images/decorative/icons/icon-critical-failure.svg';
          criticalFailureIcon.alt = 'Falha crítica';

          const criticalHitLabel = document.createElement('label');
          criticalHitLabel.className = 'skill-test-add-effect-flag';
          criticalHitLabel.dataset.tooltip = 'Acerto Crítico';
          criticalHitLabel.dataset.tooltipClass = 'cardigan-tooltip';

          const criticalHitInput = document.createElement('input');
          criticalHitInput.type = 'checkbox';
          criticalHitInput.className = 'skill-test-add-effect-flag-input';
          criticalHitInput.checked = Boolean(skillEntry.criticalHit);

          const criticalHitIcon = document.createElement('img');
          criticalHitIcon.className = 'skill-test-add-effect-flag-icon';
          criticalHitIcon.src = 'systems/cardigan/assets/images/decorative/icons/icon-critical-hit.svg';
          criticalHitIcon.alt = 'Acerto crítico';

          const removeButton = document.createElement('button');
          removeButton.type = 'button';
          removeButton.className = 'skill-test-add-effect-remove-button';
          removeButton.setAttribute('aria-label', `Remover ${skillData.label}`);
          removeButton.dataset.tooltip = 'Excluir';
          removeButton.dataset.tooltipClass = 'cardigan-tooltip';

          const removeIcon = document.createElement('img');
          removeIcon.className = 'skill-test-add-effect-remove-icon';
          removeIcon.src = 'systems/cardigan/assets/images/decorative/icons/icon-delete.svg';
          removeIcon.alt = 'Remover perícia';

          criticalFailureInput.addEventListener('change', () => {
            skillEntry.criticalFailure = criticalFailureInput.checked;
          });

          criticalHitInput.addEventListener('change', () => {
            skillEntry.criticalHit = criticalHitInput.checked;
          });

          const clampSkillValue = (value) => {
            const parsed = Number.parseInt(value, 10);
            if (Number.isNaN(parsed)) return 0;
            return Math.max(-99, Math.min(99, parsed));
          };

          const syncSkillValue = (value) => {
            const normalized = clampSkillValue(value);
            skillEntry.skillValue = normalized;
            valueInput.value = String(normalized);
          };

          valueInput.addEventListener('change', () => {
            syncSkillValue(valueInput.value);
          });

          criticalFailureLabel.appendChild(criticalFailureInput);
          criticalFailureLabel.appendChild(criticalFailureIcon);
          criticalHitLabel.appendChild(criticalHitInput);
          criticalHitLabel.appendChild(criticalHitIcon);

          inputWrapper.appendChild(valueInput);

          controls.appendChild(inputWrapper);

          flags.appendChild(criticalFailureLabel);
          flags.appendChild(criticalHitLabel);
          removeButton.appendChild(removeIcon);

          removeButton.addEventListener('click', () => {
            selectedSkills.splice(skillIndex, 1);
            renderSelectedSkills();
          });

          nameContainer.appendChild(name);
          item.appendChild(nameContainer);
          item.appendChild(controls);
          item.appendChild(flags);
          item.appendChild(removeButton);
          skillsListContainer.appendChild(item);
        });
      };

      const openSkillsDialog = async (submitEvent) => {
        submitEvent.preventDefault();
        submitEvent.stopPropagation();

        const templatePath = 'systems/cardigan/templates/dialogs/skill-test-abilities-selection.hbs';
        const content = await foundry.applications.handlebars.renderTemplate(templatePath, {
          skills: skillOptions.map((option) => ({
            key: option.key,
            label: option.label,
            selected: false
          }))
        });

        const selectionDialog = new foundry.applications.api.DialogV2({
          window: {
            title: 'Selecionar Perícias',
            positioned: true
          },
          classes: ['cardigan-skill-test-abilities-selection-dialog'],
          content,
          buttons: [
            {
              action: 'confirm',
              label: 'Adicionar',
              default: true,
              callback: (event, button, skillDialog) => {
                const selected = Array.from(skillDialog.element.querySelectorAll('input[type="checkbox"]:checked'))
                  .map((input) => input.value);

                selectedSkills.push(...selected.map((key) => ({
                  key,
                  skillValue: 0,
                  criticalFailure: false,
                  criticalHit: false
                })));
                renderSelectedSkills();
              }
            }
          ],
          rejectClose: false,
          modal: false,
          position: {
            width: 370,
            height: 'auto'
          }
        });

        await selectionDialog.render({ force: true });

        const closeBtn = selectionDialog.element?.querySelector('.header-control.fa-xmark');
        if (closeBtn) {
          closeBtn.dataset.tooltip = 'Fechar Janela';
          closeBtn.dataset.tooltipClass = 'cardigan-tooltip';
        }

        const windowContent = selectionDialog.element?.querySelector('.window-content');
        const dialogWrapper = windowContent?.querySelector(':scope > .dialog-content.standard-form');
        if (dialogWrapper && windowContent) {
          while (dialogWrapper.firstChild) windowContent.insertBefore(dialogWrapper.firstChild, dialogWrapper);
          dialogWrapper.remove();
        }

        selectionDialog.element?.querySelectorAll('.skill-test-abilities-selection-item').forEach((item) => {
          const input = item.querySelector('input[type="checkbox"]');
          if (!(input instanceof HTMLInputElement)) return;

          item.classList.toggle('selected', input.checked);
          input.addEventListener('change', () => {
            item.classList.toggle('selected', input.checked);
          });
        });

        if (typeof selectionDialog.bringToFront === 'function') {
          selectionDialog.bringToFront();
        }
      };

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

      const addSkillsButton = dialog.element?.querySelector('.skill-test-add-test-add-button');
      addSkillsButton?.addEventListener('click', openSkillsDialog);

      const submitButton = dialog.element?.querySelector('.skill-test-add-submit-button');
      submitButton?.addEventListener('click', async (submitEvent) => {
        submitEvent.preventDefault();
        submitEvent.stopPropagation();

        const effectsWithoutFlags = selectedEffects
          .filter((effect) => !effect.criticalFailure && !effect.criticalHit)
          .map((effect) => effect.name || 'Efeito sem nome');

        if (effectsWithoutFlags.length) {
          ui.notifications.warn(`Selecione Falha Crítica ou Acerto Crítico para os efeitos: ${effectsWithoutFlags.join(', ')}.`);
          return;
        }

        const skillsWithoutFlags = selectedSkills
          .filter((skill) => !skill.criticalFailure && !skill.criticalHit)
          .map((skill) => skillOptions.find((option) => option.key === skill.key)?.label || 'Perícia sem nome');

        if (skillsWithoutFlags.length) {
          ui.notifications.warn(`Selecione Falha Crítica ou Acerto Crítico para as perícias: ${skillsWithoutFlags.join(', ')}.`);
          return;
        }

        const payload = selectedEffects.map((effect) => ({
          uuid: effect.uuid,
          name: effect.name,
          img: effect.img,
          rounds: normalizeRoundsValue(effect.roundsValue ?? effect.rounds),
          criticalFailure: Boolean(effect.criticalFailure),
          criticalHit: Boolean(effect.criticalHit)
        }));

        await sheet.item.update({ 'system.skillTestAddedEffects': payload });
        await sheet.item.setFlag('cardigan', 'skillTestAddedEffects', payload);
        await sheet.item.setFlag('cardigan', 'skillTestAddedSkills', selectedSkills);
        renderAddedContentOnForm(payload, selectedSkills);
        dialog.close();
      });

      renderSelectedEffects();
      renderSelectedSkills();
    });
  }

  /**
   * Setup add button dialog for consumable life and energy section.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupLifeEnergyAddButton(sheet) {
    if (sheet.item.type !== 'item-consumivel') return;

    const addButtonContainer = sheet.element?.querySelector('.consumable-item-life-energy-add-button-container');
    const addButton = sheet.element?.querySelector('.consumable-item-life-energy-add-button');
    if (!addButtonContainer && !addButton) return;

    const openDialog = async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (sheet._lifeEnergyAddDialog?.element) {
        if (typeof sheet._lifeEnergyAddDialog.bringToFront === 'function') {
          sheet._lifeEnergyAddDialog.bringToFront();
        }
        return;
      }

      const templatePath = 'systems/cardigan/templates/dialogs/life-energy-add-dialog.hbs';
      const content = await foundry.applications.handlebars.renderTemplate(templatePath, {});

      const dialog = sheet._lifeEnergyAddDialog = new foundry.applications.api.DialogV2({
        window: {
          title: 'Vida & Energia',
          frame: true,
          positioned: true
        },
        classes: ['cardigan-life-energy-add-dialog'],
        content,
        buttons: [
          {
            action: 'noop',
            label: 'ok',
            callback: () => {}
          }
        ],
        rejectClose: false,
        modal: false,
        position: {
          width: 620,
          height: 'auto'
        }
      });

      dialog.addEventListener('close', () => {
        if (sheet._lifeEnergyAddDialog === dialog) sheet._lifeEnergyAddDialog = null;
      }, { once: true });

      await dialog.render({ force: true });
      if (typeof dialog.bringToFront === 'function') {
        dialog.bringToFront();
      }

      // Populate dialog with existing item data
      const sys = sheet.item.system;
      const el = dialog.element;

      // Life: modifier type (+/-)
      if (sys.hasHealthModifier) {
        const target = sys.healthModifierType === 'subtract' ? '.life-energy-add-life-decrease' : '.life-energy-add-life-increase';
        const check = el?.querySelector(target);
        if (check) check.checked = true;
      }

      // Life: dice type
      const lifeDiceInput = el?.querySelector('[data-life-energy-life-content] [data-life-energy-dice-input]');
      if (lifeDiceInput && sys.healthModifierDice) lifeDiceInput.value = sys.healthModifierDice.slice(1);

      // Life: quantity and bonus
      const lifeQtyInput = el?.querySelector('[name="lifeEnergy.life.diceQuantity"]');
      if (lifeQtyInput) lifeQtyInput.value = sys.healthModifierQuantity ?? 1;
      const lifeBonusInput = el?.querySelector('[name="lifeEnergy.life.bonus"]');
      if (lifeBonusInput) lifeBonusInput.value = sys.healthModifierAdditionalBonus ?? 0;

      // Life: temporary
      const lifeTempCheck = el?.querySelector('[data-life-energy-temp-life]');
      if (lifeTempCheck) lifeTempCheck.checked = sys.healthModifierIsTemporary ?? false;

      // Life: skill
      const lifeSkillCheck = el?.querySelector('[data-life-energy-skills-life]');
      if (lifeSkillCheck) lifeSkillCheck.checked = sys.healthModifierAddSkill ?? false;
      if (sys.healthModifierAddSkill) {
        el?.querySelector('[data-life-energy-skill-selection-life]')?.classList.remove('hidden');
      }
      const lifeSkillInput = el?.querySelector('[data-life-energy-skill-ability-life] [data-life-energy-skill-input]');
      if (lifeSkillInput && sys.healthModifierSkill) {
        lifeSkillInput.value = sys.healthModifierSkill;
        const activeOpt = el?.querySelector(`[data-life-energy-skill-ability-life] [data-life-energy-skill-option][data-value="${sys.healthModifierSkill}"]`);
        const label = el?.querySelector('[data-life-energy-skill-ability-life] [data-life-energy-skill-label]');
        if (label && activeOpt) label.textContent = activeOpt.textContent;
        el?.querySelectorAll('[data-life-energy-skill-ability-life] [data-life-energy-skill-option]')?.forEach(o => {
          o.classList.toggle('is-selected', o.dataset.value === sys.healthModifierSkill);
        });
      }
      const lifeDoubleCheck = el?.querySelector('[data-life-energy-skill-double-life]');
      if (lifeDoubleCheck) lifeDoubleCheck.checked = sys.healthModifierDoubleSkill ?? false;

      // Energy: modifier type (+/-)
      if (sys.hasEnergyModifier) {
        const target = sys.energyModifierType === 'subtract' ? '.life-energy-add-energy-decrease' : '.life-energy-add-energy-increase';
        const check = el?.querySelector(target);
        if (check) check.checked = true;
      }

      // Energy: dice type
      const energyDiceInput = el?.querySelector('[data-life-energy-energy-content] [data-life-energy-dice-input]');
      if (energyDiceInput && sys.energyModifierDice) energyDiceInput.value = sys.energyModifierDice.slice(1);

      // Energy: quantity and bonus
      const energyQtyInput = el?.querySelector('[name="lifeEnergy.energy.diceQuantity"]');
      if (energyQtyInput) energyQtyInput.value = sys.energyModifierQuantity ?? 1;
      const energyBonusInput = el?.querySelector('[name="lifeEnergy.energy.bonus"]');
      if (energyBonusInput) energyBonusInput.value = sys.energyModifierAdditionalBonus ?? 0;

      // Energy: temporary
      const energyTempCheck = el?.querySelector('[data-life-energy-temp-energy]');
      if (energyTempCheck) energyTempCheck.checked = sys.energyModifierIsTemporary ?? false;

      // Energy: skill
      const energySkillCheck = el?.querySelector('[data-life-energy-skills-energy]');
      if (energySkillCheck) energySkillCheck.checked = sys.energyModifierAddSkill ?? false;
      if (sys.energyModifierAddSkill) {
        el?.querySelector('[data-life-energy-skill-selection-energy]')?.classList.remove('hidden');
      }
      const energySkillInput = el?.querySelector('[data-life-energy-skill-ability-energy] [data-life-energy-skill-input]');
      if (energySkillInput && sys.energyModifierSkill) {
        energySkillInput.value = sys.energyModifierSkill;
        const activeOpt = el?.querySelector(`[data-life-energy-skill-ability-energy] [data-life-energy-skill-option][data-value="${sys.energyModifierSkill}"]`);
        const label = el?.querySelector('[data-life-energy-skill-ability-energy] [data-life-energy-skill-label]');
        if (label && activeOpt) label.textContent = activeOpt.textContent;
        el?.querySelectorAll('[data-life-energy-skill-ability-energy] [data-life-energy-skill-option]')?.forEach(o => {
          o.classList.toggle('is-selected', o.dataset.value === sys.energyModifierSkill);
        });
      }
      const energyDoubleCheck = el?.querySelector('[data-life-energy-skill-double-energy]');
      if (energyDoubleCheck) energyDoubleCheck.checked = sys.energyModifierDoubleSkill ?? false;

      const lifeEnergyChecks = Array.from(dialog.element?.querySelectorAll('.life-energy-add-checkbox') ?? []);

      const syncLifeEnergyWrappers = () => {
        lifeEnergyChecks.forEach((checkbox) => {
          checkbox.closest('.life-energy-add-button-wrapper')?.classList.toggle('is-selected', checkbox.checked);
        });
      };

      syncLifeEnergyWrappers();

      lifeEnergyChecks.forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
          const targetGroup = checkbox.dataset.lifeEnergyTarget;
          if (!targetGroup) {
            syncLifeEnergyWrappers();
            return;
          }

          if (checkbox.checked) {
            lifeEnergyChecks.forEach((otherCheckbox) => {
              if (otherCheckbox !== checkbox && otherCheckbox.dataset.lifeEnergyTarget === targetGroup) {
                otherCheckbox.checked = false;
              }
            });
          }

          syncLifeEnergyWrappers();
        });
      });

      const diceWrappers = Array.from(dialog.element?.querySelectorAll('[data-life-energy-dice-selection]') ?? []);

      diceWrappers.forEach((wrapper) => {
        const hiddenInput = wrapper.querySelector('[data-life-energy-dice-input]');
        const trigger = wrapper.querySelector('[data-life-energy-dice-trigger]');
        const label = wrapper.querySelector('[data-life-energy-dice-label]');
        const menu = wrapper.querySelector('[data-life-energy-dice-menu]');
        const options = Array.from(wrapper.querySelectorAll('[data-life-energy-dice-option]'));

        if (!hiddenInput || !trigger || !label || !menu || !options.length) return;

        const originalParent = menu.parentElement;
        const originalNextSibling = menu.nextSibling;
        let outsideClickHandler = null;
        let repositionHandler = null;

        const detachOutsideListener = () => {
          if (outsideClickHandler) {
            document.removeEventListener('click', outsideClickHandler, true);
            outsideClickHandler = null;
          }
        };

        const detachRepositionHandlers = () => {
          if (repositionHandler) {
            window.removeEventListener('resize', repositionHandler);
            window.removeEventListener('scroll', repositionHandler, true);
            repositionHandler = null;
          }
        };

        const restoreMenuToWrapper = () => {
          if (!originalParent) return;
          if (menu.parentElement !== originalParent) {
            originalParent.insertBefore(menu, originalNextSibling);
          }

          menu.classList.remove('life-energy-add-dice-menu-portal');

          menu.style.position = '';
          menu.style.top = '';
          menu.style.left = '';
          menu.style.width = '';
          menu.style.zIndex = '';
        };

        const positionMenuAsPortal = () => {
          const rect = trigger.getBoundingClientRect();
          menu.style.position = 'fixed';
          menu.style.top = `${Math.round(rect.bottom + 1)}px`;
          menu.style.left = `${Math.round(rect.left)}px`;
          menu.style.width = `${Math.round(rect.width)}px`;
          menu.style.zIndex = '10000';
        };

        const closeMenu = () => {
          menu.classList.add('is-collapsed');
          trigger.setAttribute('aria-expanded', 'false');
          detachOutsideListener();
          detachRepositionHandlers();
          restoreMenuToWrapper();
        };

        const openMenu = () => {
          if (menu.parentElement !== document.body) {
            document.body.appendChild(menu);
          }

          menu.classList.add('life-energy-add-dice-menu-portal');

          positionMenuAsPortal();
          menu.classList.remove('is-collapsed');
          trigger.setAttribute('aria-expanded', 'true');

          repositionHandler = () => {
            if (menu.classList.contains('is-collapsed')) return;
            positionMenuAsPortal();
          };

          window.addEventListener('resize', repositionHandler);
          window.addEventListener('scroll', repositionHandler, true);
        };

        const syncSelection = () => {
          const currentValue = hiddenInput.value || '1d20';
          label.textContent = currentValue;
          options.forEach((option) => {
            option.classList.toggle('is-selected', option.dataset.value === currentValue);
          });
        };

        syncSelection();

        trigger.addEventListener('click', (clickEvent) => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();

          const isOpen = !menu.classList.contains('is-collapsed');
          if (isOpen) {
            closeMenu();
            return;
          }

          openMenu();

          outsideClickHandler = (outsideEvent) => {
            const clickTarget = outsideEvent.target;
            if (!wrapper.contains(clickTarget) && !menu.contains(clickTarget)) {
              closeMenu();
            }
          };

          document.addEventListener('click', outsideClickHandler, true);
        });

        options.forEach((option) => {
          option.addEventListener('click', (optionEvent) => {
            optionEvent.preventDefault();
            optionEvent.stopPropagation();

            const value = option.dataset.value;
            if (!value) return;

            hiddenInput.value = value;
            syncSelection();
            closeMenu();
          });
        });

        wrapper.addEventListener('keydown', (keyEvent) => {
          if (keyEvent.key === 'Escape') closeMenu();
        });

        dialog.addEventListener('close', () => {
          closeMenu();
        }, { once: true });
      });

      const skillsLifeCheckbox = dialog.element?.querySelector('[data-life-energy-skills-life]');
      const skillsLifeWrapper = dialog.element?.querySelector('[data-life-energy-skill-selection-life]');
      const skillsEnergyCheckbox = dialog.element?.querySelector('[data-life-energy-skills-energy]');
      const skillsEnergyWrapper = dialog.element?.querySelector('[data-life-energy-skill-selection-energy]');

      const setupSkillToggle = (checkbox, wrapper) => {
        if (!checkbox || !wrapper) return;
        checkbox.addEventListener('change', () => {
          wrapper.classList.toggle('hidden', !checkbox.checked);
        });
      };

      setupSkillToggle(skillsLifeCheckbox, skillsLifeWrapper);
      setupSkillToggle(skillsEnergyCheckbox, skillsEnergyWrapper);

      dialog.element?.querySelectorAll('[data-life-energy-skill-ability-life], [data-life-energy-skill-ability-energy]').forEach((selectionWrapper) => {
        const hiddenInput = selectionWrapper.querySelector('[data-life-energy-skill-input]');
        const trigger = selectionWrapper.querySelector('[data-life-energy-skill-trigger]');
        const labelEl = selectionWrapper.querySelector('[data-life-energy-skill-label]');
        const menu = selectionWrapper.querySelector('[data-life-energy-skill-menu]');
        const options = Array.from(selectionWrapper.querySelectorAll('[data-life-energy-skill-option]'));

        if (!hiddenInput || !trigger || !labelEl || !menu || !options.length) return;

        const skillOriginalParent = menu.parentElement;
        const skillOriginalNextSibling = menu.nextSibling;
        let skillOutsideClickHandler = null;

        const restoreSkillMenu = () => {
          if (skillOriginalParent && menu.parentElement !== skillOriginalParent) {
            skillOriginalParent.insertBefore(menu, skillOriginalNextSibling);
          }
          menu.classList.remove('life-energy-add-skill-menu-portal');
          menu.style.position = '';
          menu.style.top = '';
          menu.style.left = '';
          menu.style.width = '';
          menu.style.zIndex = '';
          menu.classList.add('is-collapsed');
          if (skillOutsideClickHandler) {
            document.removeEventListener('click', skillOutsideClickHandler, true);
            skillOutsideClickHandler = null;
          }
        };

        const positionSkillMenu = () => {
          const triggerRect = trigger.getBoundingClientRect();
          menu.style.position = 'fixed';
          menu.style.top = `${triggerRect.bottom + 1}px`;
          menu.style.left = `${triggerRect.left}px`;
          menu.style.width = `${triggerRect.width}px`;
          menu.style.zIndex = '99999';
        };

        trigger.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (!menu.classList.contains('is-collapsed')) {
            restoreSkillMenu();
            return;
          }

          document.body.appendChild(menu);
          menu.classList.add('life-energy-add-skill-menu-portal');
          positionSkillMenu();
          menu.classList.remove('is-collapsed');

          skillOutsideClickHandler = (evt) => {
            if (!menu.contains(evt.target) && !trigger.contains(evt.target)) {
              restoreSkillMenu();
            }
          };
          requestAnimationFrame(() => {
            document.addEventListener('click', skillOutsideClickHandler, true);
          });
        });

        options.forEach((option) => {
          option.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            hiddenInput.value = option.dataset.value;
            labelEl.textContent = option.textContent;
            options.forEach((o) => o.classList.toggle('is-selected', o === option));
            restoreSkillMenu();
          });
        });

        dialog.addEventListener('close', () => {
          restoreSkillMenu();
        }, { once: true });
      });

      const submitButton = dialog.element?.querySelector('.life-energy-add-submit-button');
      submitButton?.addEventListener('click', async (submitEvent) => {
        submitEvent.preventDefault();
        submitEvent.stopPropagation();

        const formEl = dialog.element;

        // Life data
        const lifeIncrease = formEl?.querySelector('.life-energy-add-life-increase')?.checked;
        const lifeDecrease = formEl?.querySelector('.life-energy-add-life-decrease')?.checked;
        const hasHealth = lifeIncrease || lifeDecrease;
        const lifeDice = formEl?.querySelector('[data-life-energy-life-content] [data-life-energy-dice-input]')?.value || 'd20';
        const lifeQty = parseInt(formEl?.querySelector('[name="lifeEnergy.life.diceQuantity"]')?.value) || 1;
        const lifeBonus = parseInt(formEl?.querySelector('[name="lifeEnergy.life.bonus"]')?.value) || 0;
        const lifeTemp = formEl?.querySelector('[data-life-energy-temp-life]')?.checked ?? false;
        const lifeAddSkill = formEl?.querySelector('[data-life-energy-skills-life]')?.checked ?? false;
        const lifeSkill = formEl?.querySelector('[data-life-energy-skill-ability-life] [data-life-energy-skill-input]')?.value || 'accuracy';
        const lifeDouble = formEl?.querySelector('[data-life-energy-skill-double-life]')?.checked ?? false;

        // Energy data
        const energyIncrease = formEl?.querySelector('.life-energy-add-energy-increase')?.checked;
        const energyDecrease = formEl?.querySelector('.life-energy-add-energy-decrease')?.checked;
        const hasEnergy = energyIncrease || energyDecrease;
        const energyDice = formEl?.querySelector('[data-life-energy-energy-content] [data-life-energy-dice-input]')?.value || 'd20';
        const energyQty = parseInt(formEl?.querySelector('[name="lifeEnergy.energy.diceQuantity"]')?.value) || 1;
        const energyBonus = parseInt(formEl?.querySelector('[name="lifeEnergy.energy.bonus"]')?.value) || 0;
        const energyTemp = formEl?.querySelector('[data-life-energy-temp-energy]')?.checked ?? false;
        const energyAddSkill = formEl?.querySelector('[data-life-energy-skills-energy]')?.checked ?? false;
        const energySkill = formEl?.querySelector('[data-life-energy-skill-ability-energy] [data-life-energy-skill-input]')?.value || 'accuracy';
        const energyDouble = formEl?.querySelector('[data-life-energy-skill-double-energy]')?.checked ?? false;

        await sheet.item.update({
          'system.hasHealthModifier': hasHealth,
          'system.healthModifierType': lifeDecrease ? 'subtract' : 'add',
          'system.healthModifierDice': '1' + lifeDice,
          'system.healthModifierQuantity': lifeQty,
          'system.healthModifierAdditionalBonus': lifeBonus,
          'system.healthModifierIsTemporary': lifeTemp,
          'system.healthModifierAddSkill': lifeAddSkill,
          'system.healthModifierSkill': lifeSkill,
          'system.healthModifierDoubleSkill': lifeDouble,
          'system.hasEnergyModifier': hasEnergy,
          'system.energyModifierType': energyDecrease ? 'subtract' : 'add',
          'system.energyModifierDice': '1' + energyDice,
          'system.energyModifierQuantity': energyQty,
          'system.energyModifierAdditionalBonus': energyBonus,
          'system.energyModifierIsTemporary': energyTemp,
          'system.energyModifierAddSkill': energyAddSkill,
          'system.energyModifierSkill': energySkill,
          'system.energyModifierDoubleSkill': energyDouble
        });

        dialog.close();
      });
    };

    addButtonContainer?.addEventListener('click', openDialog);
    addButton?.addEventListener('click', openDialog);
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

      if (sheet._weightDialog?.element) {
        if (typeof sheet._weightDialog.bringToFront === 'function') {
          sheet._weightDialog.bringToFront();
        }
        return;
      }

      const templatePath = 'systems/cardigan/templates/dialogs/common-item-weight.hbs';
      const content = await foundry.applications.handlebars.renderTemplate(templatePath, {
        options,
        titleBorderPath: 'systems/cardigan/assets/images/decorative/border.webp'
      });

      const dialog = sheet._weightDialog = new foundry.applications.api.DialogV2({
        window: {
          title: 'PESO',
          positioned: true
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

      dialog.addEventListener('close', () => {
        if (sheet._weightDialog === dialog) sheet._weightDialog = null;
      }, { once: true });

      await dialog.render({ force: true });
      if (typeof dialog.bringToFront === 'function') {
        dialog.bringToFront();
      }

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
