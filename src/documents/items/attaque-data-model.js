const { NumberField, StringField } = foundry.data.fields;

/**
 * Foundry Item sub-type "attaque" (Attack). Owned by an NPC (contracts/item-attaque.md).
 *
 * `damage` was `healthModifier` (a signed value) until the GM asked for "Dégâts" instead of
 * "Modificateur de santé" — an Attack's own number is never a heal, only damage dealt, so it's
 * now a plain non-negative amount (NpcSheet#onApplyDamage subtracts it from a target's health,
 * clamped at 0, rather than adding a signed modifier).
 *
 * No "used this session" state (unlike Object/Atout/Faiblesse) — reported as unnecessary: an
 * Attack is reused freely across a fight, nothing about it is a one-time consumable.
 */
export class AttaqueDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      damage: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      // Optional free-text detail, shown on the item's own sheet (see BaseEntryDataModel).
      description: new StringField({ required: true, blank: true, initial: "" })
    };
  }

  /**
   * Transparently upgrades any Attack item saved under the old `healthModifier` field name —
   * no manual world-data fix-up needed (constitution Principle III). A negative stored
   * `healthModifier` (a heal, under the old signed semantics) has no equivalent under `damage`'s
   * non-negative schema, so it's floored at 0 rather than migrated as-is. The old `used` field
   * (removed outright, not renamed) needs no migration — Foundry simply stops persisting a
   * field once it's no longer in the schema.
   */
  static migrateData(source) {
    if (source && "healthModifier" in source && !("damage" in source)) {
      source.damage = Math.max(0, source.healthModifier);
      delete source.healthModifier;
    }
    return super.migrateData(source);
  }
}
