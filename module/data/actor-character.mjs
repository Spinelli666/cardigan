import CardiganSystemActorBase from './base-actor.mjs';

export default class CardiganSystemCharacter extends CardiganSystemActorBase {
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    'CARDIGAN.Actor.Character',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.attributes = new fields.SchemaField({
      level: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      }),
    });

    // Iterate over ability names and create a new SchemaField for each.
    schema.abilities = new fields.SchemaField(
      Object.keys(CONFIG.CARDIGAN.abilities).reduce((obj, ability) => {
        obj[ability] = new fields.SchemaField({
          value: new fields.NumberField({
            ...requiredInteger,
            initial: 0,
            min: 0,
          }),
        });
        return obj;
      }, {})
    );

    // Adiciona campos de Fome e Sede (arrays de 3 checkboxes)
    schema.status = new fields.SchemaField({
      hunger: new fields.ArrayField(new fields.BooleanField(), { initial: [false, false, false] }), // Todas desmarcadas
      thirst: new fields.ArrayField(new fields.BooleanField(), { initial: [false, false, false] })  // Todas desmarcadas
    });
    return schema;
  }

  prepareDerivedData() {
    // Calculate level automatically based on sum of all classes
    this._calculateLevel();

    // Loop through ability scores to handle labels.
    for (const key in this.abilities) {
      // Handle ability label localization.
      this.abilities[key].label =
        game.i18n.localize(CONFIG.CARDIGAN.abilities[key]) ?? key;
    }

    // Regra: cada ponto de Stamina adiciona +5 à vida máxima e +5 à energia máxima
    const stamina = this.abilities?.stamina?.value ?? 0;
    // Regra: cada level até 10 adiciona +5 à vida e energia máxima
    const level = this.attributes?.level?.value ?? 0;
    const levelBonus = Math.min(level, 10) * 5;
    this.health.max = 0 + (stamina * 5) + levelBonus; // 0 pode ser substituído por um valor base, se desejar
    this.power.max = 0 + (stamina * 5) + levelBonus;

    // Verificar estado de Hunger
    const hunger = this.status?.hunger ?? [];
    const hungerLevel = hunger.filter(Boolean).length; // Conta os checkboxes marcados
    if (hungerLevel === 0) {
      this.status.hungerMessage = ""; // Nenhuma checkbox marcada = sem mensagem
    } else if (hungerLevel === 2) {
      this.status.hungerMessage = "O personagem está com muita fome!";
    } else if (hungerLevel === 1) {
      this.status.hungerMessage = "O personagem está com fome.";
    } else if (hungerLevel === 0) {
      this.status.hungerMessage = "O personagem está começando a sentir fome.";
    }

    // Verificar estado de Thirst
    const thirst = this.status?.thirst ?? [];
    const thirstLevel = thirst.filter(Boolean).length; // Conta os checkboxes marcados
    if (thirstLevel === 0) {
      this.status.thirstMessage = ""; // Nenhuma checkbox marcada = sem mensagem
    } else if (thirstLevel === 2) {
      this.status.thirstMessage = "O personagem está com muita sede!";
    } else if (thirstLevel === 1) {
      this.status.thirstMessage = "O personagem está com sede.";
    } else if (thirstLevel === 0) {
      this.status.thirstMessage = "O personagem está começando a sentir sede.";
    }
  }

  /**
   * Calculate level automatically based on the sum of all class points
   * @private
   */
  _calculateLevel() {
    if (this.classes) {
      const totalClassPoints = Object.values(this.classes).reduce((sum, classValue) => {
        return sum + (classValue || 0);
      }, 0);
      
      // Set the calculated level
      this.attributes.level.value = totalClassPoints;
    }
  }

  getRollData() {
    const data = {};

    // Copy the ability scores to the top level, so that rolls can use
    // formulas like `@str.value + 4`.
    if (this.abilities) {
      for (let [k, v] of Object.entries(this.abilities)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    data.lvl = this.attributes.level.value;

    return data;
  }
}
