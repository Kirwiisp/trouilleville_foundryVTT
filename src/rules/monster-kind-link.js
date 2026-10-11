import { clamp } from "./clamp.js";

/**
 * Pure function — no Foundry globals (constitution Principle IV).
 *
 * Given an actor's current corps/esprit/frayeur and a Monster Type item's six min/max values,
 * returns the clamped { corps, esprit, frayeur } (FR-006). The caller is responsible for
 * resolving a linked Monster Type item's UUID into `monsterKindRange` before calling this
 * (src/sheets/pc-sheet.js, src/sheets/npc-sheet.js).
 *
 * @param {{corps: number, esprit: number, frayeur: number}} actorStats
 * @param {{corpsMin:number, corpsMax:number, espritMin:number, espritMax:number,
 *          frayeurMin:number, frayeurMax:number}} monsterKindRange
 * @returns {{corps: number, esprit: number, frayeur: number}}
 */
export function applyMonsterKindLink(actorStats, monsterKindRange) {
  return {
    corps: clamp(actorStats.corps, monsterKindRange.corpsMin, monsterKindRange.corpsMax),
    esprit: clamp(actorStats.esprit, monsterKindRange.espritMin, monsterKindRange.espritMax),
    frayeur: clamp(actorStats.frayeur, monsterKindRange.frayeurMin, monsterKindRange.frayeurMax)
  };
}
