import { BaseActorDataModel } from "./base-actor-data-model.js";

const { SchemaField, StringField, NumberField } = foundry.data.fields;

/**
 * Foundry Actor sub-type "pc". Extends the shared stat block (data-model.md) with the
 * Notes/Histoire fields — PC-only, NPC never gets these (FR-021, FR-022) — and with Monster
 * Type, Mana, and Experience, all three moved here from the shared base: reported as
 * NPC-inappropriate, an NPC has none of them (it tracks Trouille instead of Mana/Experience —
 * NpcDataModel — and has no Monster Type concept at all).
 */
export class PcDataModel extends BaseActorDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      // mode: "text" (free entry, unconstrained — FR-007) or "linked" (constrained by a Monster
      // Type item's min/max — FR-006). uuid is populated only when mode is "linked"
      // (data-model.md).
      monsterKind: new SchemaField({
        mode: new StringField({ required: true, initial: "text", choices: ["text", "linked"] }),
        name: new StringField({ required: true, blank: true, initial: "" }),
        uuid: new StringField({ required: false, nullable: true, initial: null })
      }),
      // Clamped to 0–6 (FR-003).
      mana: new NumberField({ required: true, integer: true, initial: 0, min: 0, max: 6 }),
      // Clamped to 0–10 (FR-003).
      experience: new NumberField({ required: true, integer: true, initial: 0, min: 0, max: 10 }),
      // Five independently-editable free-text fields, each defaulting to "" (FR-021, FR-022).
      // `recit` (general backstory) was added after a real character sheet showed a 5th
      // section above the other four — the tab's own name ("Notes/Histoire") already implied
      // it, but it was missing from the original four-field build. Purely additive with a safe
      // "" default: no migration logic needed (constitution Principle III) since any actor
      // created under the old schema simply gets recit:"" the next time it's loaded, same as
      // Foundry handles any new optional field with an `initial`.
      histoire: new SchemaField({
        recit: new StringField({ required: true, blank: true, initial: "" }),
        amisEtFamille: new StringField({ required: true, blank: true, initial: "" }),
        habitat: new StringField({ required: true, blank: true, initial: "" }),
        reves: new StringField({ required: true, blank: true, initial: "" }),
        notes: new StringField({ required: true, blank: true, initial: "" })
      })
    };
  }

  /**
   * `mana` itself stores how much has been *spent* this session (0 = nothing spent, matching
   * the stars filling up as it's used — see stat-display.js's buildManaStars), not how much is
   * left. The token's own resource bar (bar2, set by default in system.js's `preCreateActor`
   * hook) is meant to read as "Mana remaining," so it points at this derived, never-persisted
   * `manaRemaining` instead of the stored field directly — computed fresh every time, the same
   * way any other derived actor data is (never written back, constitution Principle III stays
   * about `defineSchema()`'s own persisted fields, not this).
   */
  prepareDerivedData() {
    super.prepareDerivedData();
    const max = this.schema.getField("mana").max;
    this.manaRemaining = { value: max - this.mana, max };
  }

  /**
   * `species` was renamed to `monsterKind` (constitution Principle III — no public rulebook
   * terms, and this field never actually meant biological species; "monster kind/type" is what
   * the rest of the system already called it everywhere user-visible). Transparently upgrades
   * any PC saved under the old field name the next time it's loaded — no manual world-data
   * fix-up needed. An NPC saved with either name has neither migrated nor read any more — it
   * has no Monster Type concept now at all.
   */
  static migrateData(source) {
    if (source && "species" in source && !("monsterKind" in source)) {
      source.monsterKind = source.species;
      delete source.species;
    }
    return super.migrateData(source);
  }
}
