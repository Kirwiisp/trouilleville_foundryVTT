import { BaseActorDataModel } from "./base-actor-data-model.js";

const { SchemaField, NumberField, StringField } = foundry.data.fields;

/**
 * Foundry Actor sub-type "npc". Extends the shared stat block (data-model.md) with no
 * Notes/Histoire fields (data-model.md "Differences from pc") — and, unlike a PC, with a
 * Trouille track instead of Mana/Experience, which are PC-only (PcDataModel). Shaped exactly
 * like Health (`value`/`max`) rather than Mana's own "stores how much is spent" convention —
 * an NPC's Trouille track is read directly off `value` as "how much is currently left," with no
 * derived "remaining" counterpart needed the way Mana has (BaseActorDataModel's old
 * `manaRemaining`, now PcDataModel's).
 */
export class NpcDataModel extends BaseActorDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      trouille: new SchemaField({
        value: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        max: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
      }),
      // Free-text GM reference (traits, special rules, anything that doesn't fit the Atout/
      // Sortilège/Faiblesse/Attaque item types below) — an NPC has no Notes/Histoire fields the
      // way a PC does, just this one field (data-model.md "Differences from pc").
      description: new StringField({ required: true, blank: true, initial: "" })
    };
  }
}
