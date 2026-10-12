/**
 * Shared helpers for importing a Monster Type onto an actor (FR-004, FR-008, FR-009).
 *
 * Touches Foundry globals (`game.items`, `game.packs`, `fromUuid`), so it lives here rather than
 * in src/rules/ — constitution Principle IV keeps that directory free of them.
 *
 * Monster Type remains fully usable as free text with none of this installed: when no Monster
 * Type items exist anywhere, `listMonsterKindOptions()` simply returns an empty list and the
 * picker is hidden.
 */

const MONSTER_KIND_TYPE = "espece";

// Marks an embedded Item this module auto-created from a linked archetype's Faiblesse/Peur/
// obligatoire atouts, so a later link (switching to a different archetype, or re-linking after
// unlinking) can find and remove exactly these — and only these — before creating the new set,
// without touching anything the player added by hand via the pick-and-add UI or by dropping an
// item on the sheet themselves.
const AUTO_FLAG_SCOPE = "trouilleville";
const AUTO_FLAG_KEY = "fromMonsterKind";

/**
 * Every Monster Type item available to import — world items first, then compendium entries
 * (from a content module, if one is installed).
 *
 * NOTE: compendium indexes are cached by Foundry after first load, so this stays cheap on
 * re-render; verify against the installed version if sheet rendering ever feels slow with many
 * packs installed.
 *
 * @returns {Promise<{uuid: string, name: string}[]>} sorted by name
 */
export async function listMonsterKindOptions() {
  const options = [];

  for (const item of game.items ?? []) {
    if (item.type === MONSTER_KIND_TYPE) options.push({ uuid: item.uuid, name: item.name });
  }

  for (const pack of game.packs ?? []) {
    if (pack.documentName !== "Item") continue;
    let index;
    try {
      index = await pack.getIndex();
    } catch (err) {
      continue; // an unreadable pack must not break sheet rendering
    }
    for (const entry of index) {
      if (entry.type !== MONSTER_KIND_TYPE) continue;
      const uuid = entry.uuid ?? `Compendium.${pack.collection}.${entry._id}`;
      options.push({ uuid, name: `${entry.name} (${pack.metadata.label})` });
    }
  }

  return options.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Links the Monster Type at `uuid` to `actor`, matching what dropping that item on the sheet
 * does (FR-008) — src/sheets/pc-sheet.js's `_onDrop` calls this same function for the "espece"
 * branch rather than duplicating the update() + auto-apply logic, so the picker dropdown and the
 * drag-drop path can't drift apart. Replaces any previously linked Monster Type.
 *
 * Also applies the archetype's non-optional content, which has no real choice involved and so
 * isn't left for the pick-and-add UI (PcSheet's own Atouts/Sortilèges/Objets section): the
 * archetype's single Faiblesse and single Peur (every member has both — "fear" is just another
 * `faiblesse`-type item in this system, not a separate mechanic) become two embedded `faiblesse`
 * items, and every `obligatoire`-marked atout becomes an embedded `atout` item. Re-linking the
 * exact archetype the actor already has is a no-op; linking a *different* one first removes
 * whatever the previous link auto-added (see #applyMonsterKindAutoItems) so switching archetypes
 * during character creation doesn't stack old weaknesses.
 *
 * @param {Actor} actor
 * @param {string} uuid
 */
export async function linkMonsterKindByUuid(actor, uuid) {
  const monsterKind = await fromUuid(uuid);
  if (!monsterKind || monsterKind.type !== MONSTER_KIND_TYPE) return;

  const resolvedUuid = monsterKind.uuid ?? uuid;
  if (actor.system.monsterKind.mode === "linked" && actor.system.monsterKind.uuid === resolvedUuid) {
    return; // already linked to this exact archetype — nothing to change or duplicate
  }

  await actor.update({
    "system.monsterKind": { mode: "linked", name: monsterKind.name, uuid: resolvedUuid }
  });

  await applyMonsterKindAutoItems(actor, monsterKind, resolvedUuid);
  await showArchetypePickerDialog(actor, monsterKind);
}

/**
 * @param {Actor} actor
 * @param {Item} monsterKind - the linked "espece" item (its `.system` carries faiblesse/peur/atouts)
 * @param {string} monsterKindUuid
 */
async function applyMonsterKindAutoItems(actor, monsterKind, monsterKindUuid) {
  const stale = actor.items.filter((i) => i.getFlag(AUTO_FLAG_SCOPE, AUTO_FLAG_KEY));
  if (stale.length) await actor.deleteEmbeddedDocuments("Item", stale.map((i) => i.id));

  const flags = { [AUTO_FLAG_SCOPE]: { [AUTO_FLAG_KEY]: monsterKindUuid } };
  const toCreate = [];

  for (const weakness of [monsterKind.system.faiblesse, monsterKind.system.peur]) {
    if (!weakness?.name) continue; // an archetype with no name on one of these has nothing to add
    toCreate.push({
      name: weakness.name,
      type: "faiblesse",
      flags,
      system: {
        modifier: weakness.modifier ?? 0,
        linkedCharacteristic: weakness.linkedCharacteristic ?? null,
        description: weakness.description ?? ""
      }
    });
  }

  for (const atout of monsterKind.system.atouts ?? []) {
    if (!atout.obligatoire) continue;
    toCreate.push({
      name: atout.name,
      type: "atout",
      flags,
      system: {
        modifier: atout.modifier ?? 0,
        linkedCharacteristic: atout.linkedCharacteristic ?? null,
        description: atout.description ?? ""
      }
    });
  }

  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
}

/**
 * The archetype's "choisissez N" picks — everything left over once the no-choice content
 * (Faiblesse/Peur/obligatoire atouts, already handled by applyMonsterKindAutoItems) is set
 * aside. Empty for an archetype with nothing left to offer here (e.g. Golem de terre has no
 * Objets).
 *
 * @param {Item} monsterKind
 * @returns {{atouts: object[], sortileges: object[], objets: object[]}}
 */
function getArchetypePicks(monsterKind) {
  return {
    atouts: (monsterKind.system.atouts ?? []).filter((a) => !a.obligatoire),
    sortileges: monsterKind.system.sortileges ?? [],
    objets: monsterKind.system.objets ?? []
  };
}

function listKeyFor(type) {
  return type === "atout" ? "atouts" : type === "sortilege" ? "sortileges" : "objets";
}

/**
 * Creates exactly one embedded Item from a `getArchetypePicks()` entry — a deliberate pick, so
 * (unlike applyMonsterKindAutoItems's output) it's NOT flagged `fromMonsterKind`: it's the
 * player's own choice, kept even if the archetype is later switched. Clicking the same entry
 * again simply adds a second copy, same as every other "+" button on this sheet — no hidden
 * already-added bookkeeping.
 *
 * @param {Actor} actor
 * @param {"atout"|"sortilege"|"objet"} type
 * @param {object} entry - one entry from getArchetypePicks's matching list
 */
async function addArchetypePickToActor(actor, type, entry) {
  const system = type === "sortilege"
    ? { cost: entry.cost ?? 1, description: entry.description ?? "" }
    : {
        modifier: entry.modifier ?? 0,
        linkedCharacteristic: entry.linkedCharacteristic ?? null,
        used: false,
        usable: false,
        description: entry.description ?? ""
      };
  await actor.createEmbeddedDocuments("Item", [{ name: entry.name, type, system }]);
}

/**
 * Pops up right after an archetype is linked, so the player makes the rulebook's "choisissez N"
 * picks immediately instead of hunting for them — replaces an earlier inline <details> section
 * on the PC sheet that (via a missing flex-wrap on its flex-row parent) ended up squeezing the
 * monster kind's own name down to nothing. Can also be reopened later through PcSheet's own
 * re-open button (see pc-sheet.js's #onOpenArchetypePicker, which calls
 * `openArchetypePickerForActor` below) for picks made after the initial link.
 *
 * Loops showing the same choice dialog — one DialogV2.wait per pick — until the player chooses
 * "Terminé" or closes it; nothing here stops picking the same entry twice on purpose, matching
 * addArchetypePickToActor's own no-bookkeeping philosophy.
 *
 * @param {Actor} actor
 * @param {Item} monsterKind
 */
async function showArchetypePickerDialog(actor, monsterKind) {
  const picks = getArchetypePicks(monsterKind);
  if (!picks.atouts.length && !picks.sortileges.length && !picks.objets.length) return;

  for (;;) {
    const buttons = [];
    for (const type of ["atout", "sortilege", "objet"]) {
      picks[listKeyFor(type)].forEach((entry, index) => {
        const label = type === "sortilege"
          ? `${entry.name} (${game.i18n.localize("TROUILLEVILLE.ArchetypeNiveau")} ${entry.niveau})`
          : entry.name;
        buttons.push({ action: `${type}:${index}`, label });
      });
    }
    buttons.push({ action: "done", label: game.i18n.localize("TROUILLEVILLE.Done") });

    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: `${game.i18n.localize("TROUILLEVILLE.ArchetypePickerTitle")} — ${monsterKind.name}` },
      classes: ["trouilleville-dialog", "archetype-picker-dialog"],
      content: `<p>${game.i18n.localize("TROUILLEVILLE.ArchetypePickerPrompt")}</p>`,
      buttons,
      rejectClose: false
    });

    if (!choice || choice === "done") return;
    const [type, indexStr] = choice.split(":");
    const entry = picks[listKeyFor(type)][Number(indexStr)];
    if (entry) await addArchetypePickToActor(actor, type, entry);
  }
}

/**
 * Re-opens the pick-and-add dialog for the actor's currently-linked archetype, if any — wired to
 * the reopen button next to its name in pc-sheet.hbs.
 *
 * @param {Actor} actor
 */
export async function openArchetypePickerForActor(actor) {
  if (actor.system.monsterKind.mode !== "linked" || !actor.system.monsterKind.uuid) return;
  const monsterKind = await fromUuid(actor.system.monsterKind.uuid);
  if (!monsterKind) return;
  await showArchetypePickerDialog(actor, monsterKind);
}

/**
 * Whether the actor's currently-linked archetype (if any) has anything left in
 * `getArchetypePicks()` — gates whether pc-sheet.hbs shows the reopen button at all.
 *
 * @param {Item|null} monsterKind - already-resolved linked archetype item, or null if unlinked/free-text
 * @returns {boolean}
 */
export function hasArchetypePicks(monsterKind) {
  if (!monsterKind) return false;
  const picks = getArchetypePicks(monsterKind);
  return Boolean(picks.atouts.length || picks.sortileges.length || picks.objets.length);
}
