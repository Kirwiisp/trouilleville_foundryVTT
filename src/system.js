import { PcDataModel } from "./documents/actors/pc-data-model.js";
import { NpcDataModel } from "./documents/actors/npc-data-model.js";
import { MonsterKindDataModel } from "./documents/items/monster-kind-data-model.js";
import { ObjetDataModel } from "./documents/items/objet-data-model.js";
import { AtoutDataModel } from "./documents/items/atout-data-model.js";
import { SortilegeDataModel } from "./documents/items/sortilege-data-model.js";
import { FaiblesseDataModel } from "./documents/items/faiblesse-data-model.js";
import { AttaqueDataModel } from "./documents/items/attaque-data-model.js";
import { PcSheet } from "./sheets/pc-sheet.js";
import { NpcSheet } from "./sheets/npc-sheet.js";
import { TrouillevilleItemSheet } from "./sheets/item-sheet.js";

Hooks.once("init", async () => {
  // Foundry doesn't ship a generic equality helper — several templates (monsterKind.mode, item
  // sheets' linkedCharacteristic <select>) rely on `{{#if (eq a b)}}`, so it must be registered
  // by hand or those comparisons silently fail.
  Handlebars.registerHelper("eq", (a, b) => a === b);

  CONFIG.Actor.dataModels.pc = PcDataModel;
  CONFIG.Actor.dataModels.npc = NpcDataModel;
  CONFIG.Item.dataModels.espece = MonsterKindDataModel;
  CONFIG.Item.dataModels.objet = ObjetDataModel;
  CONFIG.Item.dataModels.atout = AtoutDataModel;
  CONFIG.Item.dataModels.sortilege = SortilegeDataModel;
  CONFIG.Item.dataModels.faiblesse = FaiblesseDataModel;
  CONFIG.Item.dataModels.attaque = AttaqueDataModel;

  // Lists which `system.*` paths the token-config "resource bar" dropdown offers, per actor
  // type — without this, Foundry falls back to inferring choices straight from
  // `defineSchema()`, which `manaRemaining` (PC-only, derived-only, computed in
  // PcDataModel#prepareDerivedData, never part of the schema) would never show up in. A PC's
  // own Trouille/Mana-shaped fields obviously don't apply to an NPC and vice versa, hence two
  // separate lists rather than one shared one.
  CONFIG.Actor.trackableAttributes = {
    pc: { bar: ["health", "manaRemaining"], value: ["corps", "esprit", "frayeur", "experience"] },
    npc: { bar: ["health", "trouille"], value: ["corps", "esprit", "frayeur"] }
  };

  Actors.registerSheet("trouilleville", PcSheet, {
    types: ["pc"],
    makeDefault: true,
    label: "TROUILLEVILLE.SheetPc"
  });
  Actors.registerSheet("trouilleville", NpcSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "TROUILLEVILLE.SheetNpc"
  });
  Items.registerSheet("trouilleville", TrouillevilleItemSheet, {
    types: ["espece", "objet", "atout", "sortilege", "faiblesse", "attaque"],
    makeDefault: true,
    label: "TROUILLEVILLE.SheetItem"
  });

  // A `{{> "path"}}` partial reference only resolves if that partial has been pre-loaded into
  // Handlebars' cache — the file existing on disk isn't enough (NOTE this was missed when the
  // sheets/templates were first written; verify this call's exact API shape against the
  // installed Foundry version if partials still fail to resolve after this fix).
  await foundry.applications.handlebars.loadTemplates([
    "systems/trouilleville/templates/parts/pc-item-lists.hbs",
    "systems/trouilleville/templates/parts/pc-histoire.hbs",
    "systems/trouilleville/templates/parts/npc-attack-list.hbs",
    "systems/trouilleville/templates/parts/npc-description.hbs",
    "systems/trouilleville/templates/parts/item-draft-footer.hbs",
    "systems/trouilleville/templates/parts/item-row-controls.hbs"
  ]);
});

// A new PC's token shows Health and remaining Mana by default; a new NPC's shows Health and
// Trouille — the two things a GM glances at on the canvas without opening the sheet, for
// whichever actor type it is. Only sets whichever of bar1/bar2 a given creation didn't already
// specify (e.g. from a compendium actor or a duplicate), never overwriting a deliberate
// existing choice.
Hooks.on("preCreateActor", (actor, data, options, userId) => {
  if (!["pc", "npc"].includes(data.type)) return;
  const update = {};
  if (!data.prototypeToken?.bar1?.attribute) update["prototypeToken.bar1"] = { attribute: "health" };
  if (!data.prototypeToken?.bar2?.attribute) {
    update["prototypeToken.bar2"] = { attribute: data.type === "pc" ? "manaRemaining" : "trouille" };
  }
  if (Object.keys(update).length) actor.updateSource(update);
});

Hooks.once("ready", () => {});
