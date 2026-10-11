import { clamp } from "../rules/clamp.js";
import { rollPool } from "../rules/dice-pool.js";
import {
  buildTrack,
  nextPipValue,
  hasModifier,
  buildCostStars,
  formatModifier,
  characteristicLabelKey,
  checkTiltFromId
} from "../rules/stat-display.js";
import { escapeHtml } from "./html-utils.js";
import { buildRollCard, buildDamageCard, buildUseCard } from "./roll-chat.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Actor sheet for the "npc" sub-type. ApplicationV2 + HandlebarsApplicationMixin (constitution
 * Principle II — the current Application framework).
 *
 * NOTE: see PcSheet's class comment — `classes` deliberately excludes "trouilleville" to avoid
 * leaking this stylesheet's broad rules onto the window header's native control buttons.
 *
 * No Monster Type here at all (unlike PcSheet) — reported as PC-only, moved there entirely
 * (PcDataModel). An NPC's `corps`/`esprit`/`frayeur` are always unconstrained as a result;
 * there's no linked range left to clamp them against.
 */
export class NpcSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["actor", "npc"],
    position: { width: 640, height: 820 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      rollCharacteristic: NpcSheet.#onRollCharacteristic,
      rollModifier: NpcSheet.#onRollModifier,
      createEntry: NpcSheet.#onCreateEntry,
      editEntry: NpcSheet.#onEditEntry,
      deleteEntry: NpcSheet.#onDeleteEntry,
      useEntry: NpcSheet.#onUseEntry,
      applyDamage: NpcSheet.#onApplyDamage,
      setHealth: NpcSheet.#onSetHealth,
      setTrouille: NpcSheet.#onSetTrouille,
      switchTab: NpcSheet.#onSwitchTab,
      editImage: NpcSheet.#onEditImage
    }
  };

  static PARTS = {
    form: { template: "systems/trouilleville/templates/actors/npc-sheet.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor = this.actor;
    context.system = this.actor.system;
    // Foundry's own default (icons/svg/mystery-man.svg) covers most cases, but guard against an
    // actor whose img somehow ended up empty — never show a broken/blank portrait.
    context.portraitSrc = this.actor.img || "icons/svg/mystery-man.svg";

    // NPC-only Health/Trouille tracks: a GM-set number of checkbox pips, filled up to however
    // much is currently remaining — reported as a better fit for an NPC than the PC's own
    // heart+number display, since an NPC has no fixed max (unlike Mana's fixed 6) and no
    // Mana/Experience at all.
    context.healthPips = buildTrack(context.system.health.value, context.system.health.max);
    context.trouillePips = buildTrack(context.system.trouille.value, context.system.trouille.max);

    // FR-011: the NPC's Attack list. Same "hide a zero value" treatment as the PC's entry rows
    // (PcSheet#entryRow) — Attack has no linked characteristic to color by, just its own Damage
    // amount, and (unlike Object/Atout/Faiblesse) no "used this session" state at all: reported
    // as unnecessary, an Attack isn't a one-time consumable.
    context.attaques = this.actor.items
      .filter((i) => i.type === "attaque")
      .map((i) => ({
        id: i.id,
        name: i.name,
        system: i.system,
        damage: i.system.damage,
        hasDamage: hasModifier(i.system.damage)
      }));

    // An NPC can carry the same Atout/Sortilège/Objet/Faiblesse entries a PC can — reusing
    // pc-item-lists.hbs as-is (it has nothing PC-specific in it) is how most special rules
    // (resistances, status effects, etc.) get represented now, same mechanism as a PC's own
    // Atouts: see PcSheet#entryRow for the row shape this mirrors.
    const items = this.actor.items;
    context.atoutsSortileges = items
      .filter((i) => i.type === "atout" || i.type === "sortilege")
      .map((i) => ({
        ...NpcSheet.#entryRow(i),
        costStars: i.type === "sortilege" ? buildCostStars(i.system.cost) : null
      }));
    context.objets = items.filter((i) => i.type === "objet").map(NpcSheet.#entryRow);
    context.faiblesses = items.filter((i) => i.type === "faiblesse").map(NpcSheet.#entryRow);

    return context;
  }

  /** Same row shape as PcSheet#entryRow — see that method for the reasoning behind each field. */
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
   * Health/Trouille's current value isn't a plain form field for an NPC (set only via the
   * track's own pip clicks, #onSetHealth/#onSetTrouille below) — only their `max` is, so
   * editing it is the one place `value` could end up stranded above a newly-lowered ceiling;
   * re-clamping it here whenever `max` changes covers that regardless of what `value` currently
   * is, without needing `value` to be part of the submitted form data at all.
   */
  async _processSubmitData(event, form, submitData, options) {
    const data = foundry.utils.expandObject(submitData);
    if (data.system) {
      if (data.system.health && "max" in data.system.health) {
        const max = clamp(Number(data.system.health.max), 0, Infinity);
        data.system.health.max = max;
        data.system.health.value = clamp(this.actor.system.health.value, 0, max);
      }
      if (data.system.trouille && "max" in data.system.trouille) {
        const max = clamp(Number(data.system.trouille.max), 0, Infinity);
        data.system.trouille.max = max;
        data.system.trouille.value = clamp(this.actor.system.trouille.value, 0, max);
      }
    }
    return super._processSubmitData(event, form, foundry.utils.flattenObject(data), options);
  }

  /**
   * NOTE: see PcSheet#_onDrop for the Foundry-version verification note. Unlike PcSheet, a
   * dropped Monster Type item ("espece") isn't handled specially here at all — an NPC has no
   * Monster Type concept, so it falls through to the generic rejection below like anything else
   * not one of its own entry types.
   */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.getDragEventData(event);
    if (data.type === "Item") {
      const item = await Item.fromDropData(data);
      if (!item) return super._onDrop(event);

      // A dropped Attack, Object, Atout, Sortilège, or Weakness is added to its matching list —
      // same ENTRY_TYPES set as PcSheet#_onDrop, plus "attaque" (PC-equivalent FR-019).
      const ENTRY_TYPES = new Set(["attaque", "objet", "atout", "sortilege", "faiblesse"]);
      if (ENTRY_TYPES.has(item.type)) {
        await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
        return;
      }

      // Anything else is rejected without changing anything (Edge Cases).
      return;
    }
    return super._onDrop(event);
  }

  /** Same checkbox wiring as PcSheet#_onRender — see that method for why `change` rather than
   *  `click` is used here. */
  _onRender(context, options) {
    super._onRender(context, options);
    for (const checkbox of this.element.querySelectorAll(".toggle-used-input")) {
      checkbox.addEventListener("change", async (event) => {
        event.stopPropagation();
        const item = this.actor.items.get(checkbox.dataset.itemId);
        await item?.update({ "system.used": checkbox.checked });
      });
    }
  }

  /** Same roll behavior as PcSheet (FR-017: "the same roll behavior applies as it does for a
   *  PC"). */
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

  /** Same pending-confirmation create behavior as PcSheet, extended to the same entry types
   *  (Atout/Sortilège/Objet/Faiblesse) plus NPC's own Attack — see PcSheet#onCreateEntry for why
   *  the item is created right away rather than as a temporary document, and for the
   *  "atout-sortilege" pseudo-type dialog. */
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
      attaque: "TROUILLEVILLE.Attaque",
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

  /** Same click-anywhere-on-the-row-to-edit behavior as PcSheet, including the guard against
   *  also firing on the row's own interactive controls — see that class for details. */
  static #onEditEntry(event, target) {
    if (event.target.closest(".toggle-used-input, .used-toggle, .delete-entry, .item-modifier-circle, .use-entry, .apply-damage")) return;
    const item = this.actor.items.get(target.dataset.itemId);
    item?.sheet.render(true);
  }

  /** Same roll-modifier math as PcSheet#computeRoll — pool size is this NPC's own characteristic
   *  value plus the entry's modifier. */
  #computeRoll(item, characteristic) {
    const base = this.actor.system[characteristic];
    const modifier = item.system.modifier ?? 0;
    const size = Math.max(1, base + modifier);
    const { rolls, successes } = rollPool(size);
    const characteristicLabel = game.i18n.localize(`TROUILLEVILLE.${characteristic.charAt(0).toUpperCase()}${characteristic.slice(1)}`);

    return { characteristic, characteristicLabel, base, modifier, size, rolls, successes };
  }

  /** Same characteristic-choice dialog as PcSheet#chooseCharacteristic — see that method. */
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

  /** Same modifier-circle click behavior as PcSheet#onRollModifier. */
  static async #onRollModifier(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    const characteristic = item.system.linkedCharacteristic
      ?? await this.#chooseCharacteristic(item, { content: game.i18n.localize("TROUILLEVILLE.ChooseCharacteristic") });
    if (!characteristic) return; // cancelled/closed

    const roll = this.#computeRoll(item, characteristic);
    const content = buildRollCard({ actor: this.actor, subject: item.name, ...roll });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content });
  }

  /** Same "use" chat-button behavior as PcSheet#onUseEntry, minus Mana spending: an NPC has no
   *  Mana pool to spend a Sortilège's cost from (PC-only, PcDataModel), so a Sortilège's cost
   *  stars are shown here purely as reference — using one only ever posts the "was used" message
   *  and, optionally, a roll. */
  static async #onUseEntry(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;

    const linked = item.system.linkedCharacteristic;
    let choice;
    if (linked) {
      const label = game.i18n.localize(characteristicLabelKey(linked));
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: escapeHtml(item.name) },
        classes: ["trouilleville-dialog"],
        content: `<p>${game.i18n.format("TROUILLEVILLE.ConfirmRoll", { characteristic: label })}</p>`,
        rejectClose: false
      });
      if (confirmed === null) return; // dismissed — cancel the whole action
      choice = confirmed ? linked : "none";
    } else {
      choice = await this.#chooseCharacteristic(item, {
        content: game.i18n.localize("TROUILLEVILLE.ChooseCharacteristicOrSkip"),
        extraButtons: [["none", "TROUILLEVILLE.NoRoll"]]
      });
      if (!choice) return; // dismissed
    }

    const roll = choice === "none" ? null : this.#computeRoll(item, choice);

    if (item.system.usable) await item.update({ "system.used": true });

    const content = buildUseCard({ actor: this.actor, itemName: item.name, itemType: item.type, roll });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content });
  }

  /** Same tab-switching behavior as PcSheet#onSwitchTab. */
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

  /**
   * Applies an Attack's Damage to every token currently selected on the canvas — "selected"
   * meaning controlled/highlighted there (`canvas.tokens.controlled`), the plain everyday sense
   * of clicking a token, not Foundry's separate crosshair-"target" feature. Subtracts the full
   * amount from each selected token's actor's current health, clamped at 0 (health can never go
   * negative), and posts one chat card per token hit (buildDamageCard) reporting that actor's
   * remaining health. Does nothing, with a warning, if nothing is selected — there's no target
   * to apply it to.
   */
  static async #onApplyDamage(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;

    const tokens = canvas.tokens?.controlled ?? [];
    if (!tokens.length) {
      ui.notifications.warn(game.i18n.localize("TROUILLEVILLE.NoTokenSelected"));
      return;
    }

    for (const token of tokens) {
      const targetActor = token.actor;
      if (!targetActor) continue;

      const remaining = Math.max(0, targetActor.system.health.value - item.system.damage);
      await targetActor.update({ "system.health.value": remaining });

      const content = buildDamageCard({
        attacker: this.actor, targetName: targetActor.name, itemName: item.name,
        damage: item.system.damage, remaining, max: targetActor.system.health.max
      });
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content });
    }
  }

  /** Same confirm-before-delete behavior as PcSheet — see that class for details. */
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

  /** Clicking a Health or Trouille pip sets that track to the clicked pip's value (or steps it
   *  down by one if already there — nextPipValue), same click-to-set convention as PC's Mana/
   *  Experience, clamped to the track's own current max rather than a fixed constant. */
  static async #onSetHealth(event, target) {
    const clicked = Number(target.dataset.value);
    const max = this.actor.system.health.max;
    const next = clamp(nextPipValue(this.actor.system.health.value, clicked), 0, max);
    await this.actor.update({ "system.health.value": next });
  }

  static async #onSetTrouille(event, target) {
    const clicked = Number(target.dataset.value);
    const max = this.actor.system.trouille.max;
    const next = clamp(nextPipValue(this.actor.system.trouille.value, clicked), 0, max);
    await this.actor.update({ "system.trouille.value": next });
  }

  /** Same portrait-editing behavior as PcSheet — see that class for details. */
  static #onEditImage(event, target) {
    new FilePicker({
      type: "image",
      current: this.actor.img,
      callback: (path) => this.actor.update({ img: path })
    }).browse();
  }
}
