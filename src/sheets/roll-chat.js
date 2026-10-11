import { escapeHtml } from "./html-utils.js";

/**
 * One rolled pool's dice pips and the "Corps 2 +1 → 3" formula line above them — shared by
 * buildRollCard (a bare roll) and buildUseCard (a roll folded into a "this was used" message),
 * so the two stay visually identical.
 */
function rollSection({ characteristicLabel, base, modifier, size, rolls, successes }) {
  const dice = rolls
    .map((r) => `<span class="trouilleville-die ${r >= 4 ? "trouilleville-die--success" : ""}">${r}</span>`)
    .join("");

  // Only spell out the "base + modifier → pool" math when a modifier is actually in play — for
  // a bare characteristic roll (modifier always 0, base === size) that would just repeat the
  // same number twice for no reason.
  const formula = modifier
    ? `${escapeHtml(characteristicLabel)} ${base} ${modifier > 0 ? "+" : ""}${modifier} &rarr; ${size}`
    : `${escapeHtml(characteristicLabel)} ${base}`;

  return `
    <div class="trouilleville-roll-formula">
      <img class="trouilleville-roll-dice-icon" src="systems/trouilleville/assets/dice.svg" alt="" />
      <span>${formula}</span>
    </div>
    <div class="trouilleville-roll-dice">${dice || "—"}</div>
    <div class="trouilleville-roll-successes">${game.i18n.format("TROUILLEVILLE.RollSuccesses", { successes })}</div>
  `;
}

/**
 * Builds a roll's ChatMessage content styled to match the system's own hand-drawn look (warm
 * palette, characteristic-colored accent, the actor's portrait) instead of a plain generic line
 * of text — not a pure function (reads game.i18n), so it lives alongside the sheets rather than
 * src/rules/.
 *
 * @param {object} params
 * @param {Actor} params.actor
 * @param {string} [params.subject] - what's being rolled for, beyond the characteristic itself
 *   (an item's name, e.g. "Mutation") — omitted for a bare characteristic roll.
 * @param {string} params.characteristicLabel - localized, e.g. "Corps"
 * @param {"corps"|"esprit"|"frayeur"} params.characteristic - which color accent to use
 * @param {number} params.base - the characteristic's own current value, before any modifier
 * @param {number} params.modifier - signed; 0 for a bare characteristic roll
 * @param {number} params.size - the actual pool size rolled (base + modifier, floored at 1)
 * @param {number[]} params.rolls
 * @param {number} params.successes
 * @returns {string} HTML
 */
export function buildRollCard({ actor, subject, characteristicLabel, characteristic, base, modifier, size, rolls, successes }) {
  return `
    <div class="trouilleville-roll-card trouilleville-roll-card--${characteristic}">
      <img class="trouilleville-roll-portrait" src="${escapeHtml(actor.img || "icons/svg/mystery-man.svg")}" alt="" />
      <div class="trouilleville-roll-body">
        <div class="trouilleville-roll-title">${escapeHtml(actor.name)}${subject ? ` — ${escapeHtml(subject)}` : ""}</div>
        ${rollSection({ characteristicLabel, base, modifier, size, rolls, successes })}
      </div>
    </div>
  `;
}

// Which localization key phrases the "used" line, per entry type — "{actor} a utilisé l'atout
// {name}." rather than a type-agnostic "{name} a été utilisé.", so the message reads the same
// way a GM would say it out loud. Falls back to the plain, type-agnostic phrasing for anything
// not in this map, though every type showUseChat can apply to (atout/objet/sortilege, and a
// modifier-bearing faiblesse) has its own entry here.
const USED_MESSAGE_KEY = {
  atout: "TROUILLEVILLE.UsedEntryAtout",
  sortilege: "TROUILLEVILLE.UsedEntrySortilege",
  objet: "TROUILLEVILLE.UsedEntryObjet",
  faiblesse: "TROUILLEVILLE.UsedEntryFaiblesse"
};

/**
 * Builds a "this entry was used" ChatMessage's content (PcSheet#onUseEntry) — the "used" line
 * always comes first, each extra fact below it on its own line rather than folded into one
 * sentence: a Sortilège's spent Mana cost, then an associated roll's own formula/dice/successes
 * lines (rollSection, above) when using the entry triggered one (a non-zero modifier rolls
 * automatically, the same as clicking its modifier circle directly would).
 *
 * @param {object} params
 * @param {Actor} params.actor
 * @param {string} params.itemName
 * @param {string} params.itemType - "atout"|"objet"|"sortilege"|"faiblesse", picks the "used"
 *   line's exact phrasing (USED_MESSAGE_KEY above).
 * @param {number} [params.manaCost] - a Sortilège's Mana cost, spent by this use; omitted for
 *   an Objet/Atout/Faiblesse, which don't spend anything.
 * @param {object} [params.roll] - present when a modifier triggered a roll; same shape as
 *   buildRollCard's own params (minus actor/subject).
 * @returns {string} HTML
 */
export function buildUseCard({ actor, itemName, itemType, manaCost, roll }) {
  const usedLine = game.i18n.format(USED_MESSAGE_KEY[itemType] ?? "TROUILLEVILLE.UsedEntryMessage", {
    actor: actor.name, name: itemName
  });
  const manaLine = Number.isFinite(manaCost)
    ? `<div class="trouilleville-roll-successes">${game.i18n.format("TROUILLEVILLE.ManaSpent", { cost: manaCost })}</div>`
    : "";

  return `
    <div class="trouilleville-roll-card ${roll ? `trouilleville-roll-card--${roll.characteristic}` : ""}">
      <img class="trouilleville-roll-portrait" src="${escapeHtml(actor.img || "icons/svg/mystery-man.svg")}" alt="" />
      <div class="trouilleville-roll-body">
        <div class="trouilleville-use-message">${escapeHtml(usedLine)}</div>
        ${manaLine}
        ${roll ? rollSection(roll) : ""}
      </div>
    </div>
  `;
}

/**
 * Builds a "this attack hit a target" ChatMessage's content (NpcSheet#onApplyDamage) — the
 * attacker applying an Attack's damage to a token selected on the canvas. The target's own
 * remaining health gets its own line below the "dealt damage" line, the same as a Sortilège's
 * spent Mana does in buildUseCard, rather than folding into one sentence.
 *
 * @param {object} params
 * @param {Actor} params.attacker
 * @param {string} params.targetName
 * @param {string} params.itemName - the Attack's own name
 * @param {number} params.damage
 * @param {number} params.remaining - the target's health.value after this damage was applied
 * @param {number} params.max - the target's health.max
 * @returns {string} HTML
 */
export function buildDamageCard({ attacker, targetName, itemName, damage, remaining, max }) {
  const line = game.i18n.format("TROUILLEVILLE.DamageAppliedMessage", {
    attacker: attacker.name, target: targetName, name: itemName, damage
  });
  const healthLine = game.i18n.format("TROUILLEVILLE.RemainingHealth", { value: remaining, max });

  return `
    <div class="trouilleville-roll-card">
      <img class="trouilleville-roll-portrait" src="${escapeHtml(attacker.img || "icons/svg/mystery-man.svg")}" alt="" />
      <div class="trouilleville-roll-body">
        <div class="trouilleville-use-message">${escapeHtml(line)}</div>
        <div class="trouilleville-roll-successes">${escapeHtml(healthLine)}</div>
      </div>
    </div>
  `;
}
