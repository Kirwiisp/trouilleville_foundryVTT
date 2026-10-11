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
 * does (FR-008). Replaces any previously linked Monster Type.
 *
 * @param {Actor} actor
 * @param {string} uuid
 */
export async function linkMonsterKindByUuid(actor, uuid) {
  const monsterKind = await fromUuid(uuid);
  if (!monsterKind || monsterKind.type !== MONSTER_KIND_TYPE) return;
  await actor.update({
    "system.monsterKind": { mode: "linked", name: monsterKind.name, uuid: monsterKind.uuid ?? uuid }
  });
}
