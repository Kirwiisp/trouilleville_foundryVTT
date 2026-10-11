/**
 * Pure presentation-prep functions — no Foundry globals (constitution Principle IV). Turn a
 * Mana/Experience/Health number into the per-pip or color display data the reference visual
 * design's widgets need.
 */

const MANA_MAX = 6;
const EXPERIENCE_MAX = 10;

/**
 * @param {number} value - current Mana (0–6, FR-003)
 * @returns {{ value: number, filled: boolean, src: string }[]} one entry per star, in order;
 *   `value` is the Mana amount clicking that star sets (1 through 6).
 */
export function buildManaStars(value) {
  return Array.from({ length: MANA_MAX }, (_, i) => {
    const starValue = i + 1;
    const filled = starValue <= value;
    return {
      value: starValue,
      filled,
      src: `systems/trouilleville/assets/${filled ? "rough_filled_star" : "rough_empty_star"}.svg`
    };
  });
}

/**
 * @param {number} cost - a Sortilège's Mana cost (1+)
 * @returns {number[]} one entry per point of cost, for the item-row marker to iterate — the
 *   marker itself is a CSS-masked `rough_filled_star.svg` tinted to match Esprit (styles.css
 *   `.sortilege-cost-star`), not an `<img>`, so it can be recolored.
 */
export function buildCostStars(cost) {
  return Array.from({ length: Math.max(0, cost) });
}

// A fixed, hand-picked spread of tilts (degrees) for the 10 Experience crossed-lines — large
// enough to read clearly as "not machine-uniform" at the widget's small size (small ±1-4deg
// jitter proved imperceptible in practice).
const EXPERIENCE_TILTS = [-11, 8, -6, 13, -9, 5, -13, 10, -4, 7];

/**
 * @param {number} value - current Experience (0–10, FR-003)
 * @returns {{ number: number, crossed: boolean, tilt: number }[]} one entry per point, 1
 *   through 10; `number` is also the Experience amount clicking that point sets; `tilt` is the
 *   crossed-line's rotation in degrees, for a hand-drawn look.
 */
export function buildExpPoints(value) {
  return Array.from({ length: EXPERIENCE_MAX }, (_, i) => {
    const number = i + 1;
    return { number, crossed: number <= value, tilt: EXPERIENCE_TILTS[i] };
  });
}

/**
 * An NPC's Health and Trouille tracks (FR-003-equivalent for NPC) — a GM-set number of
 * checkbox-styled pips, filled up to however much is currently remaining, unlike Mana's fixed
 * 6-star track: the max varies per NPC, so it's a parameter here rather than a module constant.
 * Filled reads as "still has this point" (the same direction Health's own value/max already
 * store it), not "spent" — clicking pip N sets the track to N remaining, same nextPipValue
 * click-to-set/step-down convention as Mana/Experience.
 *
 * @param {number} value - current remaining amount
 * @param {number} max - the GM-set ceiling (NPC-specific, not a fixed constant)
 * @returns {{ value: number, filled: boolean }[]} one entry per pip, 1 through `max`
 */
export function buildTrack(value, max) {
  return Array.from({ length: Math.max(0, Math.trunc(max) || 0) }, (_, i) => {
    const pointValue = i + 1;
    return { value: pointValue, filled: pointValue <= value };
  });
}

/**
 * Clicking a pip (a Mana star or an Experience point) sets the field to that pip's value — unless
 * that pip is already the current value, in which case it steps down by one. This is what lets a
 * click reach 0: repeatedly clicking the first pip counts down 1, 0.
 *
 * @param {number} currentValue
 * @param {number} clickedValue - the value the clicked pip represents
 * @returns {number} the new, not-yet-clamped value
 */
export function nextPipValue(currentValue, clickedValue) {
  return clickedValue === currentValue ? clickedValue - 1 : clickedValue;
}

/**
 * Formats an item's modifier for display, always signed so it reads as a modifier rather than
 * a plain quantity.
 *
 * @param {number} value
 * @returns {string} e.g. "+2", "-1", "0"
 */
export function formatModifier(value) {
  const n = Number(value) || 0;
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * Whether an item's modifier is worth showing at all — a modifier of exactly 0 is treated as
 * "none set" and the whole modifier/characteristic display is hidden for that row.
 *
 * @param {number} value
 * @returns {boolean}
 */
export function hasModifier(value) {
  return (Number(value) || 0) !== 0;
}


/**
 * The localization key naming an item's linked characteristic — or the "general" label when the
 * item has none, which is a valid state: a modifier that isn't tied to one characteristic
 * (FR-016's `linkedCharacteristic` is optional).
 *
 * @param {string|null|undefined} characteristic
 * @returns {string} a TROUILLEVILLE.* localization key
 */
export function characteristicLabelKey(characteristic) {
  switch (characteristic) {
    case "corps": return "TROUILLEVILLE.Corps";
    case "esprit": return "TROUILLEVILLE.Esprit";
    case "frayeur": return "TROUILLEVILLE.Frayeur";
    default: return "TROUILLEVILLE.GeneralModifier";
  }
}

/**
 * How opaque the heart's solid-red overlay (styles.css `.heart-current-red-overlay`, masked to
 * the same current-health lobe shape) should be: 0 at full health — fully transparent, the
 * lobe's own native colors show through completely unchanged — rising toward 1 at zero health,
 * fully opaque red. A CSS `filter: hue-rotate()` approach was tried first and dropped: unreliable
 * on this specific artwork (several of its own fill colors, not one flat tone to rotate), and
 * empirically landed on pink rather than red.
 *
 * @param {number} value
 * @param {number} max
 * @returns {number} 0–1
 */
// >1 biases the shift to arrive earlier as health drops, rather than tracking health linearly —
// health at 80% already reads noticeably redder than a linear mix would, per "more red tainted
// on 0 approach"; unchanged at exactly full or exactly zero health.
const HEALTH_RED_BIAS = 1.6;

export function healthRedOpacity(value, max) {
  if (!Number.isFinite(max) || max <= 0) return 0;
  const pct = Math.min(1, Math.max(0, value / max));
  const biasedPct = Math.pow(pct, HEALTH_RED_BIAS);
  return 1 - biasedPct;
}

/**
 * A small, deterministic rotation (in degrees) derived from an item's id, for the handmade-
 * looking checkmark on its "used" checkbox — the same item always gets the same tilt, but
 * different items get visibly different ones, mimicking separate hand-drawn strokes.
 *
 * @param {string} id
 * @returns {number} degrees in [-8, 8]
 */
export function checkTiltFromId(id) {
  if (!id) return 0;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 17) - 8;
}
