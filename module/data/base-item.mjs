export default class CardiganSystemItemBase extends foundry.abstract
  .TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    schema.description = new fields.HTMLField();

    return schema;
  }
}
