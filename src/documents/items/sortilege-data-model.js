const { NumberField, StringField } = foundry.data.fields;

/**
 * Foundry Item sub-type "sortilege" (Sortilège). Owned by a PC; shares the Atouts/Sortilèges
 * list on the sheet with "atout" (data-model.md, FR-010) — but unlike the other three entry
 * types (objet/atout/faiblesse), it does NOT extend BaseEntryDataModel: per the rulebook, a
 * Sortilège has no dice-roll modifier, no linked characteristic, and no "used this session"
 * state — only its Mana cost (FR-023, FR-028). Casting one means checking off that many Mana
 * stars before its effects happen; this feature doesn't automate that deduction (Assumptions —
 * same boundary as every other reference-data field in this system).
 */
export class SortilegeDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      cost: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
      // Optional free-text detail, shown on the item's own sheet (see BaseEntryDataModel).
      description: new StringField({ required: true, blank: true, initial: "" })
    };
  }
}
