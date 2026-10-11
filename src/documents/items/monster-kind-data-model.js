const { NumberField } = foundry.data.fields;

/**
 * Foundry Item sub-type "espece" (Monster Type). contracts/item-monster-kind.md.
 * File named in English per plan.md's Project Structure; the registered Foundry type key is the
 * French "espece", matching the system's primary language (research.md #5/#8).
 */
export class MonsterKindDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      corpsMin: new NumberField({ required: true, integer: true, initial: 0 }),
      corpsMax: new NumberField({ required: true, integer: true, initial: 0 }),
      espritMin: new NumberField({ required: true, integer: true, initial: 0 }),
      espritMax: new NumberField({ required: true, integer: true, initial: 0 }),
      frayeurMin: new NumberField({ required: true, integer: true, initial: 0 }),
      frayeurMax: new NumberField({ required: true, integer: true, initial: 0 })
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
