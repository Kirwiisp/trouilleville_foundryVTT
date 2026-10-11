import { BaseEntryDataModel } from "./base-entry-data-model.js";

const { BooleanField } = foundry.data.fields;

/**
 * Foundry Item sub-type "atout" (Atout). Owned by a PC; shares the Atouts/Sortilèges list on
 * the sheet with "sortilege" (data-model.md, FR-010).
 *
 * `usable` is Atout/Objet-only (FR-024): the "used this session" checkbox on the PC sheet's row
 * only appears when this is set — most Atouts are passive traits with nothing to check off, so
 * the checkbox no longer shows unconditionally on every entry.
 */
export class AtoutDataModel extends BaseEntryDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      usable: new BooleanField({ required: true, initial: false })
    };
  }
}
