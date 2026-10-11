# Trouilleville — Foundry VTT System

Unofficial implementation of the **Trouilleville** tabletop system for [Foundry Virtual
Tabletop](https://foundryvtt.com), made with the gracious authorization of Makaka Éditions.

This system implements game mechanics, character sheets, and item types only — it ships with
**no rulebook content** (no monsters, items, or spells pre-populated). Content is expected to
come from separate, privately-maintained compendium modules.

## Compatibility

- Foundry VTT **v14.368** or later.

## Features

- **PC and NPC actor sheets** — a shared Corps/Esprit/Frayeur stat block, with Health and
  (for PCs) Mana/Experience, or (for NPCs) a Trouillomètre track.
- **Dice-pool rolling** — clicking a characteristic rolls a d6 pool sized to its value, with
  5s/6s as successes and 6s exploding cumulatively.
- **Item types**: Espèce (Monster Type, for constraining a PC's stat range), Atout, Sortilège,
  Objet, Faiblesse, and Attaque — each with an optional free-text description.
- **Monster Type linking** — a PC can link to an Espèce item, live-constraining its Corps/
  Esprit/Frayeur to that species' declared range.
- **French (primary) and English** localization.

## Installation

In Foundry's Setup screen, under **Game Systems → Install System**, use the manifest URL from
the [latest release](https://github.com/Kirwiisp/trouilleville_foundryVTT/releases/latest).

## Development

No build step — `src/system.js` is loaded directly as an ES module by Foundry. Clone the repo
(or symlink it) into your Foundry `Data/systems/` directory to test changes live.

## Content modules

This repository intentionally contains no published rulebook content. Scenario- and
bestiary-specific compendiums live in separate, private companion modules that declare this
system as a dependency.

## License

Game mechanics and code are original work. "Trouilleville" and its setting are the property of
Makaka Éditions; this is a fan-made, unofficial digital implementation of the tabletop system,
not a redistribution of the published rulebook's content.
