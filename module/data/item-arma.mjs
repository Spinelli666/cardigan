import CardiganSystemItemBase from "./base-item.mjs";

/**
 * Sistema de dados para itens do tipo Arma.
 * @extends {CardiganSystemItemBase}
 */
export default class CardiganSystemArma extends CardiganSystemItemBase {
  /** @inheritdoc */
  static LOCALIZATION_PREFIXES = [
    ...super.LOCALIZATION_PREFIXES,
    'CARDIGAN.Item.Arma',
  ];

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const requiredString = { required: true, blank: true };

    return {
      ...super.defineSchema(),
      damage: new fields.SchemaField({
        value: new fields.StringField({ ...requiredString, initial: "1d6" })
      }),
      properties: new fields.ArrayField(
        new fields.StringField({ required: true, blank: true }),
        { initial: [] }
      ),
      rightHand: new fields.BooleanField({ required: true, initial: false }),
      leftHand: new fields.BooleanField({ required: true, initial: false }),
      weight: new fields.NumberField({ required: true, nullable: false, initial: 1, min: 0 }),
      price: new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
      equipped: new fields.BooleanField({ required: true, initial: false })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    
    // Automatically set equipped based on hand usage
    // A weapon is equipped if it's in at least one hand
    this.equipped = this.rightHand || this.leftHand;
  }
}
