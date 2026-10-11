import { clamp } from "../rules/clamp.js";
import { applyMonsterKindLink } from "../rules/monster-kind-link.js";
import { rollPool } from "../rules/dice-pool.js";
import {
  buildManaStars,
  buildExpPoints,
  buildCostStars,
  nextPipValue,
  formatModifier,
  hasModifier,
  characteristicLabelKey,
  healthRedOpacity,
  checkTiltFromId
} from "../rules/stat-display.js";
import { listMonsterKindOptions, linkMonsterKindByUuid } from "./monster-kind-picker.js";
import { escapeHtml } from "./html-utils.js";
import { buildRollCard, buildUseCard } from "./roll-chat.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Actor sheet for the "pc" sub-type. ApplicationV2 + HandlebarsApplicationMixin (constitution
 * Principle II — the current Application framework).
 *
 * NOTE: `classes` deliberately does NOT include "trouilleville" — `DEFAULT_OPTIONS.classes` is
 * applied to the outer `.application` frame, which also wraps the window *header* (title bar,
 * popout/configure/close controls). The scoping class lives only on this template's own root
 * `<div>` (inside `.window-content`), so `styles/trouilleville.css`'s broad `.trouilleville *`/
 * `button`/`input` rules never reach — and restyle — Foundry's native header-control buttons.
 */
export class PcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["actor", "pc"],
    position: { width: 700, height: 690 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollCharacteristic: PcSheet.#onRollCharacteristic,
      rollModifier: PcSheet.#onRollModifier,
      unlinkMonsterKind: PcSheet.#onUnlinkMonsterKind,
      createEntry: PcSheet.#onCreateEntry,
      editEntry: PcSheet.#onEditEntry,
      deleteEntry: PcSheet.#onDeleteEntry,
      useEntry: PcSheet.#onUseEntry,
      switchTab: PcSheet.#onSwitchTab,
      setMana: PcSheet.#onSetMana,
      setExperience: PcSheet.#onSetExperience,
      editImage: PcSheet.#onEditImage
    }
  };

  static PARTS = {
    form: { template: "systems/trouilleville/templates/actors/pc-sheet.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.system = this.actor.system;
    // Foundry's own default (icons/svg/mystery-man.svg) covers most cases, but guard against an
    // actor whose img somehow ended up empty — never show a broken/blank portrait.
    context.portraitSrc = this.actor.img || "icons/svg/mystery-man.svg";

    // When linked, clamp the displayed characteristics to the Monster Type item's range
    // (FR-006). This re-derives the view every render; the authoritative clamp-on-write happens
    // in _processSubmitData and the drop handler below.
    if (this.actor.system.monsterKind.mode === "linked" && this.actor.system.monsterKind.uuid) {
      const monsterKind = await fromUuid(this.actor.system.monsterKind.uuid);
      if (monsterKind) {
        context.system = {
          ...context.system,
          ...applyMonsterKindLink(this.actor.system, monsterKind.system)
        };
      }
    }

    // Reference-visual widgets: Mana as a star row, Experience as a crossed-line point count,
    // and the heart's current-health side tinted from green toward red as health drops.
    context.manaStars = buildManaStars(context.system.mana);
    context.expPoints = buildExpPoints(context.system.experience);
    context.healthRedOpacity = healthRedOpacity(context.system.health.value, context.system.health.max);

    // Monster Type items available to import, if any content providing them is installed
    // (FR-009: an empty list is normal and must not block free-text entry).
    context.monsterKindOptions = await listMonsterKindOptions();

    // FR-010: a combined Atouts/Sortilèges list (visibly distinguishable per entry — the star
    // marker alone is enough now that it carries the Mana cost, FR-023; a separate type-badge
    // felt redundant on top of it and was dropped), an Objects list, and a Weaknesses list.
    const items = this.actor.items;
    context.atoutsSortileges = items
      .filter((i) => i.type === "atout" || i.type === "sortilege")
      .map((i) => ({
        ...PcSheet.#entryRow(i),
        // Only a Sortilège carries a Mana cost — an Atout never shows stars at all.
        costStars: i.type === "sortilege" ? buildCostStars(i.system.cost) : null
      }));
    context.objets = items.filter((i) => i.type === "objet").map(PcSheet.#entryRow);
    context.faiblesses = items.filter((i) => i.type === "faiblesse").map(PcSheet.#entryRow);

    return context;
  }

  /**
   * One row's display data for an Objet/Atout/Sortilège/Faiblesse: its modifier, shown as a
   * circle (matching the stat-block's own Corps/Esprit/Frayeur rings) whenever it's non-zero —
   * filled with that characteristic's color when linked to one, or an empty "general" ring when
   * not (FR-025: still shown either way, just not color-filled when unlinked) — and a fixed
   * per-item tilt for its "used" checkmark's hand-drawn look.
   *
   * `showUsedToggle` relies on `usable` simply not existing on Sortilège/Faiblesse's schema
   * (FR-024): `item.system.usable` is `undefined` there, so `Boolean(...)` is always `false` —
   * no per-type branching needed to keep the checkbox off those two entirely.
   *
   * `showUseChat` is a separate, always-available-alongside-the-others way to announce the entry
   * was used (PcSheet#onUseEntry) — every Objet/Atout/Sortilège gets it unconditionally, since
   * any of them can be meaningfully "used" whether or not it happens to have a modifier or an
   * Usable checkbox right now. A Faiblesse only gets it when it has a modifier — a Weakness with
   * no modifier is purely an RP trait, nothing to roll or announce; one with a modifier has a
   * real mechanical effect worth the same treatment as the other three types.
   */
  static #entryRow(item) {
    const characteristic = item.system.linkedCharacteristic || "general";
    const showModifierCircle = hasModifier(item.system.modifier);
    const showUsedToggle = Boolean(item.system.usable);
    return {
      id: item.id,
      type: item.type,
      name: item.name,
      system: item.system,
      modifierLabel: formatModifier(item.system.modifier),
      characteristic,
      characteristicLabel: game.i18n.localize(characteristicLabelKey(item.system.linkedCharacteristic)),
      showModifierCircle,
      checkTilt: checkTiltFromId(item.id),
      showUsedToggle,
      showUseChat: item.type === "faiblesse" ? showModifierCircle : true
    };
  }

  /**
   * The Monster Type picker is a plain <select> with no `name`, so it stays out of form
   * submission and is wired by hand here (ApplicationV2's `actions` map handles clicks, not
   * change events).
   *
   * The "used this session" checkbox is wired by hand too, but for a different reason: it used
   * to carry `data-action="toggleUsed"` directly, relying on Foundry's closest-match dispatch to
   * resolve a click on it to that action rather than the row's own `editEntry` — in practice this
   * didn't hold (clicking it both toggled AND opened the item), most likely because a <label>
   * wrapping a checkbox can dispatch more than one click (the real click, plus a synthesized one
   * from the label's own native activation behavior), and at least one of those resolves against
   * a different effective target than the input itself. Listening for `change` instead of
   * `click` sidesteps that: `change` fires exactly once per actual value flip, no matter how many
   * click events caused it, and stopping its propagation here keeps it from ever reaching the
   * row's own `editEntry` listener.
   */
  _onRender(context, options) {
    super._onRender(context, options);
    const picker = this.element.querySelector(".monster-kind-picker");
    picker?.addEventListener("change", async (event) => {
      const uuid = event.target.value;
      if (uuid) await linkMonsterKindByUuid(this.actor, uuid);
    });

    for (const checkbox of this.element.querySelectorAll(".toggle-used-input")) {
      checkbox.addEventListener("change", async (event) => {
        event.stopPropagation();
        const item = this.actor.items.get(checkbox.dataset.itemId);
        await item?.update({ "system.used": checkbox.checked });
      });
    }
  }

  /**
   * Clamp Mana (0–6), Experience (0–10), health.value (≤ health.max), and — when a Monster Type
   * is linked — Corps/Esprit/Frayeur to that monster kind's range (FR-003, FR-006), before any
   * update reaches the Document — "does not store an out-of-range value".
   * NOTE: verify this override point's exact name/signature against the installed Foundry
   * version's ApplicationV2/ActorSheetV2 form-submission lifecycle (quickstart.md Scenario 1/2).
   */
  async _processSubmitData(event, form, submitData, options) {
    const data = foundry.utils.expandObject(submitData);
    if (data.system) {
      if ("mana" in data.system) {
        data.system.mana = clamp(Number(data.system.mana), 0, 6);
      }
      if ("experience" in data.system) {
        data.system.experience = clamp(Number(data.system.experience), 0, 10);
      }
      if (data.system.health && "value" in data.system.health) {
        const max = "max" in data.system.health
          ? Number(data.system.health.max)
          : this.actor.system.health.max;
        data.system.health.value = clamp(Number(data.system.health.value), 0, max);
      }

      if (
        this.actor.system.monsterKind.mode === "linked" &&
        this.actor.system.monsterKind.uuid &&
        ("corps" in data.system || "esprit" in data.system || "frayeur" in data.system)
      ) {
        const monsterKind = await fromUuid(this.actor.system.monsterKind.uuid);
        if (monsterKind) {
          const merged = {
            corps: data.system.corps ?? this.actor.system.corps,
            esprit: data.system.esprit ?? this.actor.system.esprit,
            frayeur: data.system.frayeur ?? this.actor.system.frayeur
          };
          Object.assign(data.system, applyMonsterKindLink(merged, monsterKind.system));
        }
      }
    }
    return super._processSubmitData(event, form, foundry.utils.flattenObject(data), options);
  }

  /**
   * NOTE: verify this hook name/signature against the installed Foundry version's
   * ActorSheetV2 drag-and-drop lifecycle (research.md #4; quickstart.md Scenario 2).
   */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.getDragEventData(event);
    if (data.type === "Item") {
      const item = await Item.fromDropData(data);
      if (!item) return super._onDrop(event);

      if (item.type === "espece") {
        await this.actor.update({
          "system.monsterKind": { mode: "linked", name: item.name, uuid: item.uuid }
        });
        return;
      }

      // FR-019: a dropped Object/Atout/Sortilège/Weakness item is added to its matching list.
      const ENTRY_TYPES = new Set(["objet", "atout", "sortilege", "faiblesse"]);
      if (ENTRY_TYPES.has(item.type)) {
        await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
        return;
      }

      // Anything else is rejected without changing anything (Edge Cases).
      return;
    }
    return super._onDrop(event);
  }

  /**
   * FR-017: roll a d6 pool sized to the clicked characteristic's current value, no modifier.
   * Reports individual die results and total successes (4s/5s/6s), via a ChatMessage —
   * Foundry's standard roll-reporting convention.
   */
  static async #onRollCharacteristic(event, target) {
    const characteristic = target.dataset.characteristic;
    const size = this.actor.system[characteristic];
    const { rolls, successes } = rollPool(size);

    const label = game.i18n.localize(`TROUILLEVILLE.${characteristic.charAt(0).toUpperCase()}${characteristic.slice(1)}`);
    const content = buildRollCard({
      actor: this.actor, characteristicLabel: label, characteristic, base: size, modifier: 0, size, rolls, successes
    });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content });
  }

  /**
   * Rolls `characteristic` with the pool size adjusted by the entry's modifier (e.g. Corps 2
   * with a +1 modifier rolls 3 dice; -1 rolls 1 die) — the pool never drops below 1 die no
   * matter how negative the modifier is. `modifier` defaults to 0 for a Sortilège, which doesn't
   * have one at all. Pure roll math — the caller has already decided which characteristic to
   * use, by whatever means (the entry's own link, or a dialog choice).
   *
   * @returns {object} buildRollCard-shaped roll params.
   */
  #computeRoll(item, characteristic) {
    const base = this.actor.system[characteristic];
    const modifier = item.system.modifier ?? 0;
    const size = Math.max(1, base + modifier);
    const { rolls, successes } = rollPool(size);
    const characteristicLabel = game.i18n.localize(`TROUILLEVILLE.${characteristic.charAt(0).toUpperCase()}${characteristic.slice(1)}`);

    return { characteristic, characteristicLabel, base, modifier, size, rolls, successes };
  }

  /**
   * The characteristic-choice dialog FR-020 (Atout-vs-Sortilège) and FR-027 (a "general"
   * modifier) share — `classes` scopes this dialog's own styling (styles/trouilleville.css
   * .trouilleville-dialog for the shared theme, .trouilleville-roll-choice for this one's extra
   * per-characteristic button colors) — it's Foundry's own Dialog chrome, not nested under
   * .trouilleville like the rest of this system's UI, so it needs its own scoping class rather
   * than relying on that one (constitution Principle V).
   *
   * @param {string[]} [extraButtons] - additional non-characteristic choices appended after the
   *   three characteristics (e.g. #promptUseRoll's "no roll needed" option) — each `[action,
   *   labelKey]`.
   * @returns {Promise<string|null>} the chosen action, or null if cancelled/closed.
   * NOTE: assumes DialogV2.wait's config accepts `classes` the same way other ApplicationV2
   * options do, and each button's `class` adds that class to its own rendered <button> —
   * flagged for live-client verification like this project's other ApplicationV2-era API
   * assumptions.
   */
  async #chooseCharacteristic(item, { content, extraButtons = [] } = {}) {
    return foundry.applications.api.DialogV2.wait({
      window: { title: escapeHtml(item.name) },
      classes: ["trouilleville-dialog", "trouilleville-roll-choice"],
      content: `<p>${content}</p>`,
      buttons: [
        { action: "corps", label: game.i18n.localize("TROUILLEVILLE.Corps"), class: "corps" },
        { action: "esprit", label: game.i18n.localize("TROUILLEVILLE.Esprit"), class: "esprit" },
        { action: "frayeur", label: game.i18n.localize("TROUILLEVILLE.Frayeur"), class: "frayeur" },
        ...extraButtons.map(([action, labelKey]) => ({ action, label: game.i18n.localize(labelKey) }))
      ],
      rejectClose: false
    });
  }

  /**
   * Resolves which characteristic an entry's modifier rolls against, asking via
   * #chooseCharacteristic when it isn't linked to one ("general"), then rolls it
   * (#computeRoll). Used only by #onRollModifier (clicking the entry's modifier circle directly
   * — always an explicit intent to roll, so no separate "is a roll needed" step).
   *
   * @returns {object|null} buildRollCard-shaped roll params, or null if the characteristic
   *   choice dialog was cancelled/closed — the caller does nothing further in that case.
   */
  async #rollEntryModifier(item) {
    const characteristic = item.system.linkedCharacteristic
      ?? await this.#chooseCharacteristic(item, { content: game.i18n.localize("TROUILLEVILLE.ChooseCharacteristic") });
    if (!characteristic) return null; // cancelled/closed
    return this.#computeRoll(item, characteristic);
  }

  static async #onRollModifier(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    const roll = await this.#rollEntryModifier(item);
    if (!roll) return;

    const content = buildRollCard({ actor: this.actor, subject: item.name, ...roll });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content });
  }

  static async #onUnlinkMonsterKind(event, target) {
    // Revert to free text, keeping the current name and characteristic values unchanged — "the
    // actor's current characteristic values are unchanged, but they are no longer constrained
    // ... until a new one is linked" (Edge Cases).
    await this.actor.update({
      "system.monsterKind": { mode: "text", name: this.actor.system.monsterKind.name, uuid: null }
    });
  }

  /**
   * FR-020/FR-026: create a new Object, Atout, Sortilège, or Weakness. The combined Atouts/
   * Sortilèges list's one "+ Ajouter" button carries `data-type="atout-sortilege"` — a pseudo-
   * type meaning "ask which" — since there's no default/implicit choice between the two
   * (FR-020); Objets/Faiblesses each have their own fixed-type button as before.
   *
   * The item is created right away (Foundry's ItemSheetV2 doesn't support editing a document
   * that doesn't exist yet — ApplicationV2 explicitly rejects `submitOnChange` updates against
   * one, "Document creation from TrouillevilleItemSheet is not supported"), but flagged
   * `pendingConfirmation` so its sheet still opens showing the Save/Cancel footer the GM asked
   * for: Save just clears that flag (every field was already live-saved as usual), Cancel
   * deletes the item outright — undoing the creation, not just discarding unsaved edits.
   */
  static async #onCreateEntry(event, target) {
    let type = target.dataset.type;
    if (type === "atout-sortilege") {
      type = await foundry.applications.api.DialogV2.wait({
        window: { title: game.i18n.localize("TROUILLEVILLE.AddEntry") },
        classes: ["trouilleville-dialog"],
        content: `<p>${game.i18n.localize("TROUILLEVILLE.ChooseEntryType")}</p>`,
        buttons: [
          { action: "atout", label: game.i18n.localize("TROUILLEVILLE.Atout") },
          { action: "sortilege", label: game.i18n.localize("TROUILLEVILLE.Sortilege") }
        ],
        rejectClose: false
      });
      if (!type) return; // cancelled/closed
    }

    const typeLabelKey = {
      objet: "TROUILLEVILLE.Objet",
      atout: "TROUILLEVILLE.Atout",
      sortilege: "TROUILLEVILLE.Sortilege",
      faiblesse: "TROUILLEVILLE.Faiblesse"
    }[type];

    const [created] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: game.i18n.localize(typeLabelKey),
        type,
        flags: { trouilleville: { pendingConfirmation: true } }
      }
    ]);
    created?.sheet.render(true);
  }

  /**
   * Clicking anywhere on an item row opens that item's own sheet for editing — except on one of
   * the row's own interactive controls (the "used" checkbox, delete button, or modifier circle),
   * which this explicitly refuses to also act on. This guard exists because relying on closest-
   * match `data-action` dispatch alone proved unreliable for the checkbox (T162 found clicking it
   * both toggled AND opened the item) even after removing its own `data-action` and handling it
   * via a manually-wired `change` listener instead (_onRender) — Foundry's delegated dispatch
   * appears to still resolve some of these events up to this row's `editEntry`, through a path
   * that isn't fully clear without a live client to inspect. Checking the actual event target
   * here works regardless of the exact mechanism, so it's the one guard this doesn't depend on.
   */
  static #onEditEntry(event, target) {
    if (event.target.closest(".toggle-used-input, .used-toggle, .delete-entry, .item-modifier-circle, .use-entry")) return;
    const item = this.actor.items.get(target.dataset.itemId);
    item?.sheet.render(true);
  }

  /**
   * Resolves whether using an entry via the chat button (#onUseEntry) should also roll, and if
   * so which characteristic — asked every time, regardless of whether the entry currently shows
   * a modifier circle: a Sortilège never has a modifier field at all, and an Atout/Objet/
   * Faiblesse might have one set to exactly 0 right now but still want a roll (at 0, the pool is
   * just the bare characteristic). When the entry is already linked to one characteristic, this
   * is a plain yes/no confirm; otherwise it's the same choice dialog FR-020/FR-027 use, with a
   * fourth button to skip rolling entirely.
   *
   * @returns {string|null} a characteristic to roll, "none" to skip the roll, or null if the
   *   dialog was cancelled/closed — the caller aborts the whole action in that last case, same
   *   as #rollEntryModifier's own cancellation.
   */
  async #promptUseRoll(item) {
    const linked = item.system.linkedCharacteristic;
    if (linked) {
      const label = game.i18n.localize(characteristicLabelKey(linked));
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: escapeHtml(item.name) },
        classes: ["trouilleville-dialog"],
        content: `<p>${game.i18n.format("TROUILLEVILLE.ConfirmRoll", { characteristic: label })}</p>`,
        rejectClose: false
      });
      if (confirmed === null) return null; // dismissed — cancel the whole action
      return confirmed ? linked : "none";
    }

    return this.#chooseCharacteristic(item, {
      content: game.i18n.localize("TROUILLEVILLE.ChooseCharacteristicOrSkip"),
      extraButtons: [["none", "TROUILLEVILLE.NoRoll"]]
    });
  }

  /**
   * The chat-message button every Objet/Atout/Sortilège (and a modifier-bearing Faiblesse) shows
   * (`showUseChat` above), alongside whatever of the modifier circle/"used" checkbox also apply
   * to it — a one-click "announce this was used" that also performs whatever those controls
   * would, instead of requiring each to be triggered by hand first:
   *   - always asks first whether a roll is needed, and which characteristic if the entry isn't
   *     already linked to one (#promptUseRoll) — cancelling/closing that dialog cancels the
   *     whole action, nothing is posted or changed;
   *   - an Usable entry is marked used (`system.used`) the same as checking its checkbox;
   *   - a Sortilège's Mana cost is spent (added to the actor's current Mana) — refused with a
   *     warning instead of silently clamping if that would exceed the 6-star maximum (FR-023's
   *     cost is meant to be spent in full or not at all, unlike the plain clamped Mana field
   *     elsewhere on the sheet).
   * The chat card (buildUseCard) always leads with "this was used," then the Mana spent (if
   * any) and the roll's own formula/dice/successes (if any), each on its own line.
   */
  static async #onUseEntry(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;

    const manaCost = item.type === "sortilege" ? item.system.cost : undefined;
    if (manaCost !== undefined && this.actor.system.mana + manaCost > 6) {
      ui.notifications.warn(game.i18n.format("TROUILLEVILLE.NotEnoughMana", { name: item.name }));
      return;
    }

    const choice = await this.#promptUseRoll(item);
    if (choice === null) return; // dismissed — do nothing at all
    const roll = choice === "none" ? null : this.#computeRoll(item, choice);

    if (manaCost !== undefined) await this.actor.update({ "system.mana": this.actor.system.mana + manaCost });
    if (item.system.usable) await item.update({ "system.used": true });

    const content = buildUseCard({ actor: this.actor, itemName: item.name, itemType: item.type, manaCost, roll });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content });
  }

  /**
   * Erases an Objet/Atout/Sortilège/Faiblesse from this PC, after confirming — this only removes
   * the entry from the actor, not any world data, but it's still a destructive, one-click-away
   * action next to the row's own open-for-editing click, so a confirmation prevents a stray
   * click from silently deleting something.
   * NOTE: verify DialogV2.confirm's exact shape against the installed Foundry version.
   */
  static async #onDeleteEntry(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("TROUILLEVILLE.Delete") },
      classes: ["trouilleville-dialog"],
      content: `<p>${game.i18n.format("TROUILLEVILLE.ConfirmDeleteEntry", { name: escapeHtml(item.name) })}</p>`,
      rejectClose: false
    });
    if (confirmed) await item.delete();
  }

  /**
   * Clicking a Mana star sets Mana to that star's position (or steps it down by one if that
   * star is already the current value — see `nextPipValue`), replacing the plain number input.
   */
  static async #onSetMana(event, target) {
    const clicked = Number(target.dataset.value);
    const next = clamp(nextPipValue(this.actor.system.mana, clicked), 0, 6);
    await this.actor.update({ "system.mana": next });
  }

  /** Same click-to-set behavior as Mana, for Experience (0–10). */
  static async #onSetExperience(event, target) {
    const clicked = Number(target.dataset.value);
    const next = clamp(nextPipValue(this.actor.system.experience, clicked), 0, 10);
    await this.actor.update({ "system.experience": next });
  }

  /**
   * Clicking the portrait opens Foundry's file picker to choose a new image — the standard
   * documented API for this (`FilePicker`), used instead of the legacy `data-edit` auto-wiring
   * convention since that isn't guaranteed to still apply to ApplicationV2 sheets.
   */
  static #onEditImage(event, target) {
    new FilePicker({
      type: "image",
      current: this.actor.img,
      callback: (path) => this.actor.update({ img: path })
    }).browse();
  }

  /**
   * FR-021/FR-022: switch between the Atouts/Sortilèges/Objects/Weaknesses tab and the
   * Notes/Histoire tab. Managed entirely by this sheet (not Foundry's `static TABS` tab-group
   * config) so the active/inactive state doesn't depend on an unverified Mixin API shape —
   * toggles the `.active` class directly on the nav link and matching `.tab` section.
   */
  static #onSwitchTab(event, target) {
    const tabId = target.dataset.tab;
    const nav = target.closest(".sheet-tabs");
    for (const link of nav.querySelectorAll("[data-action='switchTab']")) {
      link.classList.toggle("active", link.dataset.tab === tabId);
    }
    for (const section of this.element.querySelectorAll(".tab")) {
      section.classList.toggle("active", section.dataset.tab === tabId);
    }
  }
}
