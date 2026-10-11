const { StringField, NumberField, BooleanField } = foundry.data.fields;



/**
 * Shared schema for the four PC-owned entry item types: objet, atout, sortilege, faiblesse.
 * data-model.md "Entry items" — identical shape, distinct Foundry sub-types for native
 * icon/label distinguishability (research.md #6).
 */
export class BaseEntryDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Signed integer, no further constraint (FR-016).
      modifier: new NumberField({ required: true, integer: true, initial: 0 }),
      // Optional — "MAY be linked" (FR-016).
      linkedCharacteristic: new StringField({
        required: false,
        nullable: true,
        initial: null,
        choices: ["corps", "esprit", "frayeur"]
      }),
      // Default false; GM-toggled, never auto-cleared by the system (FR-013, FR-018).
      used: new BooleanField({ required: true, initial: false }),
      // Optional free-text detail, shown on the item's own sheet — the list row itself only ever
      // shows the name/modifier (GM feedback: wanted somewhere to put the fuller rules text an
      // entry doesn't have room for inline).
      description: new StringField({ required: true, blank: true, initial: "" })
    };
  }
}
