/**
 * Pure function — no Foundry globals (constitution Principle IV).
 *
 * "The roll MUST use one six-sided die (d6) per point of that characteristic's current value.
 * Each die showing a 4, 5, or 6 MUST count as one success. Each die showing a 6 MUST
 * additionally trigger one further d6, rolled and counted the same way, cumulatively (a 6 on
 * that further die triggers another, and so on)." (FR-017)
 *
 * Takes a `roll6` function for its single die roll so it can be tested deterministically; the
 * caller (src/sheets/pc-sheet.js, npc-sheet.js) passes a real d6 roller backed by Foundry's own
 * Roll/dice-so-nice pipeline in the live system.
 *
 * @param {number} size - the characteristic's current value; may be 0 or negative.
 * @param {() => number} [roll6] - returns an integer 1–6; defaults to Math.random-based.
 * @returns {{rolls: number[], successes: number}}
 */
export function rollPool(size, roll6 = defaultRoll6) {
  const rolls = [];
  let successes = 0;

  let remaining = Math.max(0, size);
  while (remaining > 0) {
    remaining -= 1;
    const result = roll6();
    rolls.push(result);
    if (result >= 4) {
      successes += 1;
      if (result === 6) {
        remaining += 1; // one further d6, cumulative — a 6 on it triggers another in turn
      }
    }
  }

  return { rolls, successes };
}

function defaultRoll6() {
  return Math.floor(Math.random() * 6) + 1;
}
