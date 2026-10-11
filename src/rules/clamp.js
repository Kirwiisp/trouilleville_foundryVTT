/**
 * Pure bound function — no Foundry globals (constitution Principle IV).
 *
 * Used for Mana (clamp(value, 0, 6)), Experience (clamp(value, 0, 10)), health.value
 * (clamp(value, -Infinity, max) — no enforced lower bound, FR-003/Edge Cases), and as the
 * building block for the Monster-Type-linked characteristic range (src/rules/monster-kind-link.js).
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number} value clamped to [min, max]
 */
export function clamp(value, min, max) {
  if (min > max) {
    throw new RangeError(`clamp: min (${min}) must not be greater than max (${max})`);
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
