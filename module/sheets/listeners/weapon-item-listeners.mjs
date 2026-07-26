/**
 * Weapon Item Listeners Module
 * Manages all weapon-specific UI listeners for the item sheet.
 */
export class WeaponItemListeners {

  /**
   * Initialize all weapon-related listeners for the item sheet.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static initialize(sheet) {
    this.setupWeaponCategoryButtons(sheet);
    this.setupDamageDialog(sheet);
    this.setupWeaponIconCheckboxToggles(sheet);
    this.setupWeaponPropertiesDialog(sheet);
  }

  /**
   * Setup melee/ranged category toggle buttons.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupWeaponCategoryButtons(sheet) {
    if (sheet.item.type !== 'arma') return;

    const buttons = sheet.element?.querySelectorAll('.weapon-category-btn[data-weapon-category]');
    if (!buttons?.length) return;

    buttons.forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const category = button.dataset.weaponCategory;
        const path = `system.${category}`;
        const current = foundry.utils.getProperty(sheet.item, path);
        await sheet.item.update({ [path]: !current });
      });
    });
  }

  /**
   * Setup the damage field (clickable pill + dialog with value + ability checkboxes).
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupDamageDialog(sheet) {
    if (sheet.item.type !== 'arma') return;

    const damageInput = sheet.element?.querySelector('.weapon-damage-display');
    const damagePanel = sheet.element?.querySelector('[data-weapon-extra-panel="damage"]');
    if (!damageInput || !damagePanel) return;

    const openDamageDialog = async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (sheet._damageDialog?.element) {
        if (typeof sheet._damageDialog.bringToFront === 'function') {
          sheet._damageDialog.bringToFront();
        }
        return;
      }

      const templatePath = 'systems/cardigan/templates/dialogs/weapon-damage.hbs';
      const content = await foundry.applications.handlebars.renderTemplate(templatePath, {
        damageValue: sheet.item.system?.damage?.value ?? '0',
        useStrength: sheet.item.system?.damage?.useStrength ?? false,
        useDexterity: sheet.item.system?.damage?.useDexterity ?? false,
        usePsionics: sheet.item.system?.damage?.usePsionics ?? false,
        titleBorderPath: 'systems/cardigan/assets/images/decorative/border.webp'
      });

      const dialog = sheet._damageDialog = new foundry.applications.api.DialogV2({
        window: {
          title: 'DANO',
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
          width: 390,
          height: 'auto'
        },
        classes: ['cardigan-weapon-damage-dialog']
      });

      dialog.addEventListener('close', () => {
        if (sheet._damageDialog === dialog) sheet._damageDialog = null;
      }, { once: true });

      await dialog.render({ force: true });
      if (typeof dialog.bringToFront === 'function') {
        dialog.bringToFront();
      }

      const valueInput = dialog.element?.querySelector('.weapon-damage-value-input');
      valueInput?.addEventListener('change', async () => {
        await sheet.item.update({ 'system.damage.value': valueInput.value });
      });

      const abilityCheckboxes = dialog.element?.querySelectorAll('.weapon-damage-ability-checkbox') ?? [];
      abilityCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', async () => {
          abilityCheckboxes.forEach((other) => {
            if (other !== checkbox) other.checked = false;
          });

          await sheet.item.update({
            'system.damage.useStrength': checkbox.dataset.ability === 'strength' && checkbox.checked,
            'system.damage.useDexterity': checkbox.dataset.ability === 'dexterity' && checkbox.checked,
            'system.damage.usePsionics': checkbox.dataset.ability === 'psionics' && checkbox.checked
          });
        });
      });
    };

    damagePanel.addEventListener('click', openDamageDialog);
    damageInput.addEventListener('click', openDamageDialog);
  }

  /**
   * Setup click/keyboard toggles where weapon icons control checkbox/string fields.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupWeaponIconCheckboxToggles(sheet) {
    if (sheet.item.type !== 'arma') return;

    const root = sheet.element;
    if (!root) return;

    const toggleIcons = root.querySelectorAll('[data-weapon-checkbox-toggle]');
    if (!toggleIcons.length) return;

    const syncIconState = (icon, isChecked) => {
      icon.classList.toggle('is-active', isChecked);
      icon.setAttribute('aria-pressed', String(isChecked));
      icon.closest('.weapon-extra-content')?.classList.toggle('is-active', isChecked);
    };

    toggleIcons.forEach((icon) => {
      const checkboxPath = icon.dataset.weaponCheckboxToggle;
      if (!checkboxPath) return;

      const hasExplicitValues =
        Object.prototype.hasOwnProperty.call(icon.dataset, 'weaponToggleOnValue') ||
        Object.prototype.hasOwnProperty.call(icon.dataset, 'weaponToggleOffValue');

      const onValue = icon.dataset.weaponToggleOnValue ?? true;
      const offValue = icon.dataset.weaponToggleOffValue ?? false;

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

  /** Weapon property keys (excluding mechanical-only ones not offered in the picker) and their localization suffixes */
  static PROPERTY_LABEL_KEYS = {
    bomba: 'Bomba',
    accurate: 'Accurate',
    colateral: 'Colateral',
    blunt: 'Blunt',
    discreto: 'Discreto',
    duelar: 'Duelar',
    electrify: 'Electrify',
    extensao: 'Extensao',
    wound: 'Wound',
    impact: 'Impact',
    ignite: 'Ignite',
    perfurar: 'Perfurar',
    queimaroupa: 'QueimaRoupa',
    rajada: 'Rajada',
    recarga: 'Recarga',
    saquerapido: 'SaqueRapido',
    pierce: 'Pierce',
    unico: 'Unico',
    vorpal: 'Vorpal'
  };

  /** Weapon property keys that have a rich tooltip in CARDIGAN.WeaponPropertyTooltip */
  static PROPERTY_TOOLTIP_KEYS = {
    saquerapido: 'SaqueRapido',
    bomba: 'Bomba'
  };

  /**
   * Setup add button dialog for weapon properties selection.
   * @param {CardiganSystemItemSheet} sheet - The item sheet instance
   */
  static setupWeaponPropertiesDialog(sheet) {
    if (sheet.item.type !== 'arma') return;

    const addButtonContainer = sheet.element?.querySelector('.weapon-properties-add-button-container');
    const addButton = sheet.element?.querySelector('.weapon-properties-add-button');
    if (!addButtonContainer && !addButton) return;

    const openDialog = async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (sheet._weaponPropertiesDialog?.element) {
        if (typeof sheet._weaponPropertiesDialog.bringToFront === 'function') {
          sheet._weaponPropertiesDialog.bringToFront();
        }
        return;
      }

      const currentProperties = sheet.item.system.properties ?? [];
      const properties = await Promise.all(Object.entries(this.PROPERTY_LABEL_KEYS).map(async ([value, labelKey]) => {
        const tooltipKey = this.PROPERTY_TOOLTIP_KEYS[value];
        const tooltip = tooltipKey
          ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(
            game.i18n.localize(`CARDIGAN.WeaponPropertyTooltip.${tooltipKey}`),
            { async: true }
          )
          : null;

        return {
          value,
          label: game.i18n.localize(`CARDIGAN.WeaponProperty.${labelKey}`),
          selected: currentProperties.includes(value),
          tooltip
        };
      }));

      const templatePath = 'systems/cardigan/templates/dialogs/weapon-properties-dialog.hbs';
      const content = await foundry.applications.handlebars.renderTemplate(templatePath, { properties });

      const dialog = sheet._weaponPropertiesDialog = new foundry.applications.api.DialogV2({
        window: {
          title: 'PROPRIEDADES',
          frame: true,
          positioned: true
        },
        classes: ['cardigan-weapon-properties-dialog'],
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
          width: 420,
          height: 'auto'
        }
      });

      dialog.addEventListener('close', () => {
        if (sheet._weaponPropertiesDialog === dialog) sheet._weaponPropertiesDialog = null;
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

      dialog.element?.querySelectorAll('.property-item').forEach((item) => {
        const property = properties.find((p) => p.value === item.dataset.propertyValue);
        if (property?.tooltip) {
          item.dataset.tooltip = property.tooltip;
          item.dataset.tooltipClass = 'cardigan-tooltip weapon-property-tooltip';
        }

        item.addEventListener('click', () => {
          item.classList.toggle('selected');
        });
      });

      const confirmButton = dialog.element?.querySelector('[data-action="confirmProperties"]');
      confirmButton?.addEventListener('click', async () => {
        const selected = Array.from(dialog.element?.querySelectorAll('.property-item.selected') ?? [])
          .map((item) => item.dataset.propertyValue);
        await sheet.item.update({ 'system.properties': selected });
        dialog.close();
      });
    };

    addButtonContainer?.addEventListener('click', openDialog);
    addButton?.addEventListener('click', openDialog);
  }
}
