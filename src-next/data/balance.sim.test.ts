// Monte Carlo harness for per-constellation single-hand expected score.
//
// Mirrors `core/phases/evaluation.ts` so the numbers reflect the actual game
// path: same wildcard resolution, same combo detection, same chips×mult.
// Runs without catalysts, mods, or chain — the **bare baseline** for each
// constellation. Used to spot-check balance after tweaking modifiers.
//
// Re-run with: `npx vitest run src-next/data/balance.sim.test.ts -t balance`
// The numbers are seeded so results are reproducible across runs.

import { describe, it, expect } from 'vitest';
import { CONSTELLATIONS } from './constellations';
import { detectCombo, type DetectCtx } from '../core/scoring/detectCombo';
import { mulberry32 } from '../core/rng';
import type { DieFace, DiceSpec } from './dice';
import type { Constellation } from './constellations';

const HANDS = 50000;
const SEED = 1;
const ANTE_1_SMALL_TARGET = 300;

function sampleFace(faces: readonly DieFace[], rng: { next: () => number }): DieFace {
  const idx = Math.floor(rng.next() * faces.length);
  return faces[idx]!;
}

function rollFaces(dice: DiceSpec, rng: { next: () => number }): DieFace[] {
  return dice.map((die) => sampleFace(die.faces, rng));
}

function buildComboCtx(c: Constellation): DetectCtx['comboCtx'] {
  const mods = c.modifiers ?? {};
  const universe = new Set<number>();
  for (const die of c.dice) {
    for (const f of die.faces) {
      if (typeof f === 'number') universe.add(f);
    }
  }
  return {
    diceCount: c.dice.length,
    comboCountBonus: mods.comboCountBonus ?? 0,
    straightLenBonus: mods.straightLenBonus ?? 0,
    faceUniverse: [...universe].sort((a, b) => a - b),
  };
}

// Mirror of the `resolveWildcards` helper in `evaluation.ts` so the harness
// matches the production scoring path exactly.
function resolveWildcards(
  faces: readonly DieFace[],
  comboCtx: DetectCtx['comboCtx'],
): number[] {
  const concrete: number[] = [];
  let wildCount = 0;
  for (const f of faces) {
    if (f === 'WILD') wildCount++;
    else concrete.push(typeof f === 'number' ? f : 0);
  }
  const universe = comboCtx?.faceUniverse?.length ? comboCtx.faceUniverse : [1, 2, 3, 4, 5, 6];
  for (let _ = 0; _ < wildCount; _++) {
    let bestVal = universe[0]!;
    let bestTier = -1;
    for (const v of universe) {
      const tier = detectCombo([...concrete, v], { comboCtx }).tier;
      if (tier > bestTier) { bestTier = tier; bestVal = v; }
    }
    concrete.push(bestVal);
  }
  return concrete;
}

function scoreHand(c: Constellation, rolledFaces: DieFace[], catN = 0): number {
  const mods = c.modifiers ?? {};

  if (mods.scoringMode === 'captain_crew') {
    // Argo: score = captain × (1 + perCat × catN) + crew. Pass catN to model
    // mid-game (typical 4) and late-game (max 8) catalyst loadouts.
    const numericFaces = rolledFaces.map((f) => (typeof f === 'number' ? f : 0));
    const captain = numericFaces.length > 0 ? Math.max(...numericFaces) : 0;
    const crew = numericFaces.reduce((s, f) => s + f, 0) - captain;
    const perCat = mods.faceMultiplierPerCatalyst ?? 0;
    const captainMult = 1 + perCat * catN;
    return Math.round(captain * captainMult + crew);
  }

  const comboCtx = buildComboCtx(c);
  const concrete = resolveWildcards(rolledFaces, comboCtx);
  const combo = detectCombo(concrete, { comboCtx });
  const sumFaces = concrete.reduce((s, f) => s + f, 0);
  const baseChips = combo.chips * (mods.baseChipsMult ?? 1);
  const baseMult = combo.mult * (mods.baseMultMult ?? 1);
  return Math.round((baseChips + sumFaces) * baseMult);
}

type Stats = { id: string; mean: number; median: number; p10: number; p90: number; max: number };

function statsFor(c: Constellation, rng: { next: () => number }, catN = 0): Stats {
  const samples: number[] = new Array(HANDS);
  let total = 0;
  let max = 0;
  for (let i = 0; i < HANDS; i++) {
    const faces = rollFaces(c.dice, rng);
    const s = scoreHand(c, faces, catN);
    samples[i] = s;
    total += s;
    if (s > max) max = s;
  }
  samples.sort((a, b) => a - b);
  return {
    id: c.id,
    mean: Math.round(total / HANDS),
    median: samples[Math.floor(HANDS / 2)]!,
    p10: samples[Math.floor(HANDS * 0.1)]!,
    p90: samples[Math.floor(HANDS * 0.9)]!,
    max,
  };
}

describe('balance simulation', () => {
  it(`reports per-constellation single-hand stats over ${HANDS} hands`, () => {
    const rng = mulberry32(SEED);
    const rows: Stats[] = CONSTELLATIONS.map((c) => statsFor(c, rng));

    const lines: string[] = [];
    lines.push('');
    lines.push('=== Per-constellation single-hand baseline ===');
    lines.push(`(${HANDS} hands, seed=${SEED}, no catalysts/mods/chain)`);
    lines.push('');
    lines.push(`  ${'id'.padEnd(13)} ${'mean'.padStart(6)} ${'p10'.padStart(6)} ${'med'.padStart(6)} ${'p90'.padStart(6)} ${'max'.padStart(6)}  3-hand est.`);
    lines.push('  ' + '-'.repeat(67));
    for (const r of rows) {
      const threeHand = r.mean * 3;
      const reachesAnte1 = threeHand >= ANTE_1_SMALL_TARGET ? '✓' : '✗';
      lines.push(`  ${r.id.padEnd(13)} ${String(r.mean).padStart(6)} ${String(r.p10).padStart(6)} ${String(r.median).padStart(6)} ${String(r.p90).padStart(6)} ${String(r.max).padStart(6)}  ${String(threeHand).padStart(5)} ${reachesAnte1}`);
    }
    lines.push('');
    lines.push(`Ante 1 small-trial target: ${ANTE_1_SMALL_TARGET}`);
    lines.push('3-hand est. = mean × 3 (no chain mult, no catalysts, no mods, no locking strategy)');
    lines.push('');

    // Argo-only catalyst scaling so we can see whether the captain×(1+perCat×N)
    // scaling actually compensates for the weak baseline as the player invests.
    const argo = CONSTELLATIONS.find((c) => c.id === 'argo');
    if (argo) {
      lines.push('=== Argo catalyst scaling ===');
      lines.push(`  ${'catN'.padStart(4)}  ${'mean'.padStart(6)}  3-hand est.`);
      lines.push('  ' + '-'.repeat(28));
      for (const catN of [0, 2, 4, 6, 8]) {
        const argoRng = mulberry32(SEED + catN);
        const s = statsFor(argo, argoRng, catN);
        lines.push(`  ${String(catN).padStart(4)}  ${String(s.mean).padStart(6)}  ${String(s.mean * 3).padStart(5)}`);
      }
      lines.push('');
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    for (const r of rows) {
      expect(Number.isFinite(r.mean)).toBe(true);
      expect(r.mean).toBeGreaterThanOrEqual(0);
      expect(r.max).toBeGreaterThanOrEqual(r.mean);
    }
  });
});
