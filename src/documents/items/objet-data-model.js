import { BaseEntryDataModel } from "./base-entry-data-model.js";

const { BooleanField } = foundry.data.fields;

/**
 * Foundry Item sub-type "objet" (Object). Owned by a PC (data-model.md).
 *
 * `usable` is Atout/Objet-only (FR-024) — see AtoutDataModel's class comment.
 */
export class ObjetDataModel extends BaseEntryDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      usable: new BooleanField({ required: true, initial: false })
    };
  }
}
