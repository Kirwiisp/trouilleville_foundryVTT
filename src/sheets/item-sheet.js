import { clamp } from "../rules/clamp.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Shared ApplicationV2 item sheet for all of this system's Item sub-types — routes to the
 * matching template by `item.type` (contracts/item-monster-kind.md, item-entry.md,
 * item-attaque.md). One class per plan.md's Project Structure, extended with a new route each
 * time a story adds an item sub-type (currently: espece — User Story 2;
 * objet/atout/sortilege/faiblesse — User Story 4; attaque — User Story 5).
 */
const TEMPLATE_BY_TYPE = {
  espece: "systems/trouilleville/templates/items/monster-kind-sheet.hbs",
  objet: "systems/trouilleville/templates/items/objet-sheet.hbs",
  atout: "systems/trouilleville/templates/items/atout-sheet.hbs",
  sortilege: "systems/trouilleville/templates/items/sortilege-sheet.hbs",
  faiblesse: "systems/trouilleville/templates/items/faiblesse-sheet.hbs",
  attaque: "systems/trouilleville/templates/items/attaque-sheet.hbs"
};

/** The localized type-label PcSheet#onCreateEntry/NpcSheet#onCreateEntry gives a newly created
 *  entry as its placeholder-standing-in-for-a-real-name (Foundry's Document schema requires
 *  `name` to be non-blank from the moment of creation, so it can't start out truly empty). Used
 *  here only to recognize "this is still the untouched default," not to set it — creation is
 *  what actually sets it. */
const TYPE_LABEL_KEY = {
  espece: "TROUILLEVILLE.MonsterKind",
  objet: "TROUILLEVILLE.Objet",
  atout: "TROUILLEVILLE.Atout",
  sortilege: "TROUILLEVILLE.Sortilege",
  faiblesse: "TROUILLEVILLE.Faiblesse",
  attaque: "TROUILLEVILLE.Attaque"
};

export class TrouillevilleItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  // NOTE: `classes` deliberately excludes "trouilleville" — see PcSheet's class comment for why
  // (it would leak styles/trouilleville.css's broad rules onto the window header's own controls).
  static DEFAULT_OPTIONS = {
    classes: ["item"],
    position: { width: 420, height: 440 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      incrementModifier: TrouillevilleItemSheet.#onIncrementModifier,
      decrementModifier: TrouillevilleItemSheet.#onDecrementModifier,
      saveDraft: TrouillevilleItemSheet.#onSaveDraft,
      cancelDraft: TrouillevilleItemSheet.#onCancelDraft
    }
  };

  static PARTS = {
    form: { template: "systems/trouilleville/templates/items/monster-kind-sheet.hbs" }
  };

  /**
   * NOTE: verify this override point's exact name against the installed Foundry version's
   * ApplicationV2/HandlebarsApplicationMixin render-parts lifecycle (quickstart.md Scenario 2).
   */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    const template = TEMPLATE_BY_TYPE[this.document.type];
    if (template) parts.form = { ...parts.form, template };
    return parts;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.document;
    context.system = this.document.system;
    // A new Object/Atout/Sortilège/Weakness/Attack is created right away (see PcSheet#
    // onCreateEntry), carrying this flag, so the GM can still back out of it entirely by closing
    // without clicking Save (#onCancelDraft/close() below) — a *temporary*, not-yet-created
    // Item's sheet can't support this instead: Foundry's own ItemSheetV2 submit path explicitly
    // rejects `submitOnChange` updates on a document with no id ("Document creation from
    // TrouillevilleItemSheet is not supported"), so the item has to exist for real from the
    // start for its fields to be editable at all.
    context.isDraft = this.document.getFlag("trouilleville", "pendingConfirmation") === true;

    // The Name field shows blank-with-a-placeholder-hint only until the GM actually types
    // something real — recomputed fresh every render (not just once at creation) by comparing
    // the document's *current* name against its type's own label, so that live edits (every
    // field, including Name, saves normally and immediately — see _processSubmitData) show up
    // correctly instead of the field snapping back to blank on every re-render.
    const defaultName = TYPE_LABEL_KEY[this.document.type]
      ? game.i18n.localize(TYPE_LABEL_KEY[this.document.type])
      : this.document.name;
    context.namePlaceholder = defaultName;
    context.nameValue = (context.isDraft && this.document.name === defaultName) ? "" : this.document.name;

    return context;
  }

  /**
   * The "—" option in the linked-characteristic select submits an empty string, but the field is
   * a nullable enum of the three characteristics — so map "" to null. Choosing it is a valid,
   * meaningful state: a *general* modifier, not tied to any one characteristic (FR-016).
   *
   * A blank/whitespace-only Name is dropped from the update entirely (keeping whatever name was
   * already there) rather than submitted as `""` — Foundry's own Document schema requires `name`
   * to be non-blank, so an explicit empty string would fail validation outright; this matters
   * most right after creation, when the Name field starts blank-with-a-placeholder (FR-020) and
   * the GM may tab past it without typing anything.
   *
   * Every field — including this one — saves immediately on change, the same as any other item,
   * draft or not. An earlier version deferred all of this until the sheet closed, batching every
   * field into one `update()` read from the live form at that point — overengineered, and broken
   * in practice (it depended on `this.element` containing an actual `<form>` tag, which
   * apparently isn't a safe assumption here, so the batched update silently never applied:
   * editing a draft and clicking Save left it unchanged). Saving normally, immediately, avoids
   * that assumption entirely by never needing to read the form in bulk in the first place.
   * NOTE: verify this override point's exact name/signature against the installed Foundry
   * version's ApplicationV2/ItemSheetV2 form-submission lifecycle (quickstart.md Scenario 1/2).
   */
  async _processSubmitData(event, form, submitData, options) {
    const data = foundry.utils.expandObject(submitData);
    if ("name" in data && !data.name?.trim()) {
      delete data.name;
    }
    if (data.system && data.system.linkedCharacteristic === "") {
      data.system.linkedCharacteristic = null;
    }
    return super._processSubmitData(event, form, foundry.utils.flattenObject(data), options);
  }

  /**
   * The modifier field (`modifier` on the four entry types, `damage` on Attack, `cost`
   * on Sortilège) is editable either by typing directly into the number input or via these +/-
   * buttons — `data-field` on the button names which system property to adjust, so one pair of
   * handlers covers every item type's number field. Bounds (e.g. Sortilège `cost`'s floor of 1)
   * come from that field's own schema definition rather than being hardcoded here, so this stays
   * one generic handler instead of growing a special case per field.
   */
  static async #onIncrementModifier(event, target) {
    await TrouillevilleItemSheet.#adjustModifier(this, target.dataset.field, 1);
  }

  static async #onDecrementModifier(event, target) {
    await TrouillevilleItemSheet.#adjustModifier(this, target.dataset.field, -1);
  }

  static async #adjustModifier(sheet, field, delta) {
    const current = Number(foundry.utils.getProperty(sheet.document.system, field)) || 0;
    const schemaField = sheet.document.system.schema.getField(field);
    const next = clamp(current + delta, schemaField?.min ?? -Infinity, schemaField?.max ?? Infinity);
    await sheet.document.update({ [`system.${field}`]: next });
  }

  /**
   * A draft (an entry created via "+ Ajouter" and not yet confirmed) is only ever kept by the
   * explicit Save button (`options.saveDraft`) — every other way of closing it (the window's
   * native × control, Escape, or the explicit Cancel button) deletes it instead, undoing its
   * creation entirely. Since every field now saves normally as the GM edits (see
   * _processSubmitData), there's nothing left to "batch apply" here — Save only needs to clear
   * the pending flag, and discarding only needs to delete the document; neither needs to read
   * the form at all, which is what made the previous version both complex and broken.
   *
   * Closes the window *before* touching the document (clearing the flag or deleting it), not
   * after: either of those is itself a document update, which reactively re-renders any open
   * sheet for that document — if a sheet were still open when that happened, the render could
   * race the close in progress, which is what caused T175/T178's "needs two clicks" bug. Closing
   * first means there's nothing left open to race.
   * NOTE: assumes closing via the window's native × control and via Escape both route through
   * this same `close()` override — flagged for live-client verification like this project's
   * other ApplicationV2-era API assumptions.
   */
  async close(options = {}) {
    const isDraft = this.document.getFlag("trouilleville", "pendingConfirmation") === true;
    const result = await super.close(options);

    if (isDraft) {
      if (options.saveDraft) {
        await this.document.unsetFlag("trouilleville", "pendingConfirmation");
      } else {
        await this.document.delete();
      }
    }

    return result;
  }

  /** Only Save opts into keeping the draft (`{saveDraft: true}`) — Cancel is just a plain close,
   *  identical to the window's native × control or Escape; all three discard a still-pending
   *  draft via `close()`'s own logic above.
   *
   * `this.submit()` flushes whatever is currently in the form first — including a field (most
   * often Name) that was just typed into but not yet blurred, so submitOnChange's own 'change'
   * listener hasn't fired for it yet. Without this, that edit and the Save click race: close()
   * reads the `pendingConfirmation` flag and clears it immediately, while the blur-triggered
   * update is still in flight — on a slow enough update that edit could lose, landing back on
   * the placeholder name and making Save look like it needs a second click to "take." Submitting
   * explicitly here removes the race instead of depending on its timing. */
  static async #onSaveDraft(event, target) {
    await this.submit();
    await this.close({ saveDraft: true });
  }

  static async #onCancelDraft(event, target) {
    await this.close();
  }
}
