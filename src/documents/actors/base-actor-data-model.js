/**
 * Shared stat-block schema for both the "pc" and "npc" Actor sub-types.
 * data-model.md "Shared base: actor stat block".
 *
 * Monster Type, Mana, and Experience all used to live here too, but they're PC-only (reported:
 * an NPC has none of them — see PcDataModel for all three, and NpcDataModel for Trouille, the
 * NPC-only track that replaces Mana/Experience). Only what's genuinely common to both — Health
 * and the three characteristics — stays shared; an NPC's `corps`/`esprit`/`frayeur` are always
 * unconstrained now, since there's no Monster Type link left to clamp them against.
 */

const { SchemaField, NumberField } = foundry.data.fields;

export class BaseActorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // health.value MUST be clamped so it never exceeds health.max, and never drops below 0
      // (FR-003, Edge Cases).
      health: new SchemaField({
        value: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        max: new NumberField({ required: true, integer: true, initial: 0, min: 0 })
      }),
      corps: new NumberField({ required: true, integer: true, initial: 0 }),
      esprit: new NumberField({ required: true, integer: true, initial: 0 }),
      frayeur: new NumberField({ required: true, integer: true, initial: 0 })
    };
  }
}
