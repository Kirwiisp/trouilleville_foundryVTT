const { NumberField, StringField, BooleanField, ArrayField, SchemaField } = foundry.data.fields;

/**
 * One atout the rulebook offers an archetype at character creation. Mirrors BaseEntryDataModel's
 * modifier/linkedCharacteristic shape (same meaning: a "+1 [characteristic]" badge printed next
 * to the atout's name, e.g. Golem de terre's "Costaud +1 🔴") rather than inventing a parallel
 * representation for the same concept.
 */
function archetypeAtoutSchema() {
  return {
    name: new StringField({ required: true, blank: true, initial: "" }),
    description: new StringField({ required: true, blank: true, initial: "" }),
    // The book marks some atouts "(atout obligatoire)" — every character of that archetype gets
    // it automatically, on top of the N chosen freely (see atoutsAChoisir below).
    obligatoire: new BooleanField({ required: true, initial: false }),
    modifier: new NumberField({ required: true, integer: true, initial: 0 }),
    linkedCharacteristic: new StringField({
      required: false,
      nullable: true,
      initial: null,
      choices: ["corps", "esprit", "frayeur"]
    })
  };
}

/**
 * One sortilège from a tiered "Sortilèges niveau N (coût : N étoiles)" list — only the Sorcière
 * archetype uses this shape instead of a flat atouts list (verified against the rulebook, not
 * assumed from the other four archetypes).
 */
function archetypeSortilegeSchema() {
  return {
    name: new StringField({ required: true, blank: true, initial: "" }),
    description: new StringField({ required: true, blank: true, initial: "" }),
    niveau: new NumberField({ required: true, integer: true, min: 1, initial: 1 }),
    cost: new NumberField({ required: true, integer: true, min: 1, initial: 1 })
  };
}

/**
 * A single Faiblesse or Peur on an archetype's own page — exactly one of each per archetype
 * (never a list to choose from, unlike atouts/sortileges), auto-applied in full as an embedded
 * `faiblesse` item the moment the archetype is linked (src/sheets/monster-kind-picker.js). Same
 * four fields `FaiblesseDataModel`/`BaseEntryDataModel` uses elsewhere, minus `used` — this is the
 * archetype's own reference copy, not live per-PC state.
 */
function archetypeWeaknessSchema() {
  return {
    name: new StringField({ required: true, blank: true, initial: "" }),
    modifier: new NumberField({ required: true, integer: true, initial: 0 }),
    linkedCharacteristic: new StringField({
      required: false,
      nullable: true,
      initial: null,
      choices: ["corps", "esprit", "frayeur"]
    }),
    description: new StringField({ required: true, blank: true, initial: "" })
  };
}

/**
 * Foundry Item sub-type "espece" (Monster Type). contracts/item-monster-kind.md.
 * File named in English per plan.md's Project Structure; the registered Foundry type key is the
 * French "espece", matching the system's primary language (research.md #5/#8).
 *
 * corpsMin/corpsMax/espritMin/espritMax/frayeurMin/frayeurMax are the original fields (the range
 * a linked PC's stats get clamped to — src/rules/monster-kind-link.js) and MUST NOT be renamed or
 * removed: other content (e.g. the trouilleville-bestiaire module's especes pack) links to them
 * by these exact names. Everything below `frayeurMax` is additive — reference material from the
 * archetype's own rulebook page (starting Santé, Faiblesse, Peur, and the Atouts/Sortilèges/
 * Objets offered at creation) that previously had nowhere to live on this item type at all. Any
 * espece Item saved under an older schema loads fine under this one: every new field has a safe
 * `initial`, the same way PcDataModel's `histoire.recit` was added after the fact with no
 * migration needed. `faiblesse`/`peur` were briefly plain free-text fields for display only; they
 * were promoted to the structured shape below once linking an archetype needed to actually create
 * a matching embedded item from them (src/sheets/monster-kind-picker.js), not just show their text.
 */
export class MonsterKindDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      corpsMin: new NumberField({ required: true, integer: true, initial: 0 }),
      corpsMax: new NumberField({ required: true, integer: true, initial: 0 }),
      espritMin: new NumberField({ required: true, integer: true, initial: 0 }),
      espritMax: new NumberField({ required: true, integer: true, initial: 0 }),
      frayeurMin: new NumberField({ required: true, integer: true, initial: 0 }),
      frayeurMax: new NumberField({ required: true, integer: true, initial: 0 }),

      // "Santé de départ : N" on the archetype's rulebook page.
      santeDepart: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      // The archetype's one Faiblesse — every member has it, no choice involved, so linking the
      // archetype auto-creates a matching embedded `faiblesse` item on the PC (unlike atouts/
      // sortileges/objets below, which need a deliberate pick).
      faiblesse: new SchemaField(archetypeWeaknessSchema()),
      // The archetype's one Peur — mechanically just another `faiblesse`-type item in this
      // system (this system has no separate "fear" item type), same auto-apply treatment.
      peur: new SchemaField(archetypeWeaknessSchema()),
      // "Choisissez N atouts" (plus any `obligatoire` ones, which don't count against N).
      atoutsAChoisir: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
      // The flat atouts list an archetype offers at creation (Golem de terre, Profond, Savant
      // fou, Vampire). Empty for an archetype that uses `sortileges` instead (Sorcière). An entry
      // marked `obligatoire` is auto-added on link, same as faiblesse/peur (no real choice);
      // every other entry needs the PC sheet's pick-and-add UI (src/sheets/pc-sheet.js).
      atouts: new ArrayField(new SchemaField(archetypeAtoutSchema()), { required: true, initial: [] }),
      // The tiered Sortilèges list Sorcière offers instead of a flat atouts list. Empty for every
      // other archetype. Always a deliberate pick — never auto-added.
      sortileges: new ArrayField(new SchemaField(archetypeSortilegeSchema()), { required: true, initial: [] }),
      // The catalog an archetype's Inventeur/Chimiste-style atout unlocks (only Savant fou has
      // one, among the five archetypes read so far). Same shape as `atouts` — `obligatoire` is
      // meaningless here (an objet is always a deliberate pick, there's no auto-add path for it)
      // and simply stays false on every entry.
      objets: new ArrayField(new SchemaField(archetypeAtoutSchema()), { required: true, initial: [] })
    };
  }

  /**
   * Cross-field validation: "MUST NOT be saved with a minimum greater than its own maximum for
   * the same characteristic" (FR-005).
   */
  static validateJoint(data) {
    const pairs = [
      ["corpsMin", "corpsMax"],
      ["espritMin", "espritMax"],
      ["frayeurMin", "frayeurMax"]
    ];
    for (const [minKey, maxKey] of pairs) {
      if (data[minKey] > data[maxKey]) {
        throw new Error(
          `${minKey} (${data[minKey]}) must not be greater than ${maxKey} (${data[maxKey]})`
        );
      }
    }
  }
}
