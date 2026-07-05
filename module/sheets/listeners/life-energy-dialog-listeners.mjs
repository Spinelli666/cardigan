/**
 * Life & Energy Add Dialog Listeners
 * Manages the "Vida & Energia" add dialog for item-consumivel sheets:
 * populating existing item data, custom dice/skill dropdowns, and submit handling.
 */
export class LifeEnergyDialogListeners {

  /**
   * Setup add button dialog for consumable life and energy section.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setup(sheet) {
    if (sheet.item.type !== 'item-consumivel') return;

    const addButtonContainer = sheet.element?.querySelector('.consumable-item-life-energy-add-button-container');
    const addButton = sheet.element?.querySelector('.consumable-item-life-energy-add-button');
    const addedContentContainer = sheet.element?.querySelector('.consumable-item-life-energy-added-content');
    if (!addButtonContainer && !addButton) return;

    const getAbilityAbbreviation = (ability) => {
      const key = CONFIG.CARDIGAN.abilities[ability];
      return key ? game.i18n.localize(key) : '';
    };

    // Life formula: "{quantity}{diceFaces} + {bonus} + ({ABBR}[ * 2])"
    const buildLifeFormula = (sys) => {
      if (!sys.hasHealthModifier) return null;

      const diceFaces = (sys.healthModifierDice || '1d20').replace(/^1/, '');
      const quantity = Math.max(1, parseInt(sys.healthModifierQuantity, 10) || 1);
      let formula = `${quantity}${diceFaces}`;

      const bonus = Number(sys.healthModifierAdditionalBonus) || 0;
      if (bonus !== 0) formula += ` + ${bonus}`;

      if (sys.healthModifierAddSkill) {
        const abbr = getAbilityAbbreviation(sys.healthModifierSkill);
        formula += ` + (${abbr}${sys.healthModifierDoubleSkill ? ' * 2' : ''})`;
      }

      return formula;
    };

    // Energy formula: "{quantity}{diceFaces} + {bonus} + ({ABBR}[ * 2])"
    const buildEnergyFormula = (sys) => {
      if (!sys.hasEnergyModifier) return null;

      const diceFaces = (sys.energyModifierDice || '1d20').replace(/^1/, '');
      const quantity = Math.max(1, parseInt(sys.energyModifierQuantity, 10) || 1);
      let formula = `${quantity}${diceFaces}`;

      const bonus = Number(sys.energyModifierAdditionalBonus) || 0;
      if (bonus !== 0) formula += ` + ${bonus}`;

      if (sys.energyModifierAddSkill) {
        const abbr = getAbilityAbbreviation(sys.energyModifierSkill);
        formula += ` + (${abbr}${sys.energyModifierDoubleSkill ? ' * 2' : ''})`;
      }

      return formula;
    };

    const renderAddedContent = () => {
      if (!addedContentContainer) return;
      addedContentContainer.innerHTML = '';

      const sys = sheet.item.system;
      const lifeFormula = buildLifeFormula(sys);
      const energyFormula = buildEnergyFormula(sys);
      const entries = [];
      if (lifeFormula) {
        entries.push({
          icon: 'icon-health.svg',
          alt: 'Vida',
          formula: lifeFormula,
          isTemporary: sys.healthModifierIsTemporary ?? false,
          isDecrease: sys.healthModifierType === 'subtract'
        });
      }
      if (energyFormula) {
        entries.push({
          icon: 'icon-energy.svg',
          alt: 'Energia',
          formula: energyFormula,
          isTemporary: sys.energyModifierIsTemporary ?? false,
          isDecrease: sys.energyModifierType === 'subtract'
        });
      }

      if (!entries.length) {
        addedContentContainer.classList.add('hidden');
        return;
      }

      addedContentContainer.classList.remove('hidden');

      entries.forEach(({ icon, alt, formula, isTemporary, isDecrease }) => {
        const row = document.createElement('div');
        row.className = 'consumable-item-life-energy-added-row';

        const iconImg = document.createElement('img');
        iconImg.className = 'consumable-item-life-energy-added-icon';
        iconImg.src = `systems/cardigan/assets/images/decorative/icons/${icon}`;
        iconImg.alt = alt;

        const line = document.createElement('div');
        line.className = 'consumable-item-life-energy-added-line';

        const entry = document.createElement('div');
        entry.className = 'consumable-item-life-energy-added-entry';

        const formulaSpan = document.createElement('span');
        formulaSpan.className = 'consumable-item-life-energy-added-formula';
        formulaSpan.textContent = formula;

        entry.appendChild(formulaSpan);

        const flags = document.createElement('div');
        flags.className = 'consumable-item-life-energy-added-flags';

        const typeSymbol = document.createElement('span');
        typeSymbol.className = isDecrease
          ? 'consumable-item-life-energy-added-type-symbol consumable-item-life-energy-added-decrease-symbol'
          : 'consumable-item-life-energy-added-type-symbol consumable-item-life-energy-added-increase-symbol';
        typeSymbol.textContent = isDecrease ? '-' : '+';
        typeSymbol.dataset.tooltip = isDecrease ? 'Remover' : 'Adicionar';
        typeSymbol.dataset.tooltipClass = 'cardigan-tooltip';
        flags.appendChild(typeSymbol);

        line.appendChild(entry);
        line.appendChild(flags);

        if (isTemporary) {
          const temp = document.createElement('div');
          temp.className = 'consumable-item-life-energy-added-temp';
          temp.dataset.tooltip = 'Temporário';
          temp.dataset.tooltipClass = 'cardigan-tooltip';

          const tempText = document.createElement('p');
          tempText.textContent = 'PVT';
          temp.appendChild(tempText);

          line.appendChild(temp);
        }

        row.appendChild(iconImg);
        row.appendChild(line);

        addedContentContainer.appendChild(row);
      });
    };

    renderAddedContent();

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
            action: 'close',
            label: 'Fechar',
            callback: () => dialog.close()
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

        renderAddedContent();
        dialog.close();
      });
    };

    addButtonContainer?.addEventListener('click', openDialog);
    addButton?.addEventListener('click', openDialog);
  }
}
