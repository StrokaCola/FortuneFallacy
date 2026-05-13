// Resolves run-scoped dice/scoring configuration from `state.run.constellationId`.
// All read sites in the engine route through these helpers so adding a new
// constellation never means hunting through the codebase for hardcoded 5/6/8.

import type { GameState } from '../../state/store';
import type { DiceSpec } from '../../data/dice';
import { lookupConstellation } from '../../data/constellations';
import type { ConstellationModifiers, ScoringMode } from '../../data/constellations';

// 2026-05-12 QA fix: lowered 8 → 4 per the 2026-05-07 audit that already
// updated constellationChain.ts and balance.fullrun.sim.test.ts. The previous
// value here meant runtime cap diverged from the sim's expectations.
const CHAIN_CAP_DEFAULT = 4;
const CHAIN_STEP_DEFAULT = 0.25;

function modsOf(state: GameState): ConstellationModifiers {
  return lookupConstellation(state.run.constellationId).modifiers ?? {};
}

// Extra-die voucher ('extra_die', 'Sixth Star') — appends a copy of the
// constellation's last die to the spec when owned. Read inline (not via
// vouchers/index.ts) to avoid a circular import: vouchers/index.ts
// already imports getCatalystSlotBonus from this file.
function bonusDiceCount(state: GameState): number {
  return state.run.vouchers?.includes('extra_die') ? 1 : 0;
}

export function getDiceSpec(state: GameState): DiceSpec {
  const base = lookupConstellation(state.run.constellationId).dice;
  const bonus = bonusDiceCount(state);
  if (bonus === 0) return base;
  const last = base[base.length - 1];
  if (!last) return base;
  return [...base, ...Array.from({ length: bonus }, () => last)];
}

export function getDiceCount(state: GameState): number {
  return getDiceSpec(state).length;
}

export function getScoringMode(state: GameState): ScoringMode {
  return modsOf(state).scoringMode ?? 'combo';
}

export function getChainConfig(state: GameState): { cap: number; step: number; neverBreaks: boolean } {
  const m = modsOf(state);
  return {
    cap: m.chainCap ?? CHAIN_CAP_DEFAULT,
    step: m.chainStep ?? CHAIN_STEP_DEFAULT,
    neverBreaks: !!m.chainNeverBreaks,
  };
}

export type ComboCtx = {
  diceCount: number;
  comboCountBonus: number;
  straightLenBonus: number;
  faceUniverse: number[];
};

export function getComboCtx(state: GameState): ComboCtx {
  const spec = getDiceSpec(state);
  const m = modsOf(state);
  const universe = new Set<number>();
  for (const die of spec) {
    for (const f of die.faces) {
      if (typeof f === 'number') universe.add(f);
    }
  }
  return {
    diceCount: spec.length,
    comboCountBonus: m.comboCountBonus ?? 0,
    straightLenBonus: m.straightLenBonus ?? 0,
    faceUniverse: [...universe].sort((a, b) => a - b),
  };
}

export function getBaseScoreMults(state: GameState): { chips: number; mult: number } {
  const m = modsOf(state);
  return { chips: m.baseChipsMult ?? 1, mult: m.baseMultMult ?? 1 };
}

export function getCatalystSlotBonus(state: GameState): number {
  // Constellation modifier + Wider Orbit astral perk both contribute. Astral
  // perks are imported via require to avoid a circular import with
  // applyAstralPerks.ts (which can transitively import diceContext through
  // applyConstellation in the future).
  const constMod = modsOf(state).catalystSlotBonus ?? 0;
  let perkBonus = 0;
  for (const id of (state.meta.astralPerks ?? [])) {
    if (id === 'wider_orbit') perkBonus += 1;
  }
  return constMod + perkBonus;
}

export function isForgeDisabled(state: GameState): boolean {
  return !!modsOf(state).forgeDisabled;
}

export function areModsDisabled(state: GameState): boolean {
  return !!modsOf(state).modsDisabled;
}

export function getFaceMultiplierPerCatalyst(state: GameState): number {
  return modsOf(state).faceMultiplierPerCatalyst ?? 0;
}
