import { BaseEntryDataModel } from "./base-entry-data-model.js";

/** Foundry Item sub-type "faiblesse" (Weakness). Owned by a PC (data-model.md). */
export class FaiblesseDataModel extends BaseEntryDataModel {
  static defineSchema() {
    return { ...super.defineSchema() };
  }
}
