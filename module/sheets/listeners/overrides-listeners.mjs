export class OverridesListeners {

  static disableOverrides(sheet) {
    for (const input of sheet.element.querySelectorAll('[data-override-disabled="true"]')) {
      input.disabled = false;
      input.removeAttribute('data-override-disabled');
    }

    const alwaysEditableOverrides = new Set([
      'system.status.healthBonus',
      'system.status.energyBonus',
      'system.status.armorBonus'
    ]);

    const flatOverrides = foundry.utils.flattenObject(sheet.actor.overrides);
    for (const override of Object.keys(flatOverrides)) {
      if (alwaysEditableOverrides.has(override)) continue;

      const input = sheet.element.querySelector(`[name="${override}"]`);
      if (input) {
        input.disabled = true;
        input.setAttribute('data-override-disabled', 'true');
      }
    }
  }

}
