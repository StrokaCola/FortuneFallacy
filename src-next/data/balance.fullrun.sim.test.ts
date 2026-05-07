// Full-run balance simulator — projects clear-rate per (constellation × stake ×
// build profile) across all 12 blinds (4 antes × 3 trials).
//
// Mirrors the production scoring path from `core/phases/evaluation.ts` (same
// wildcard resolution, combo detection, baseChips/baseMult math) and the chain
// multiplier from `core/scoring/constellationChain.ts`. Catalysts and mods are
// abstracted as a per-build score multiplier that scales with cleared blinds —
// this lets us estimate where the **content** dictates the curve vs where
// player loadouts dominate.
//
// Re-run with: `npx vitest run src-next/data/balance.fullrun.sim.test.ts -t balance`
// All numbers are seeded so results are reproducible.

import { describe, it, expect } from 'vitest';
import { CONSTELLATIONS, type Constellation } from './constellations';
import { STAKES, type Stake } from './stakes';
import { ANTE_BASE_TARGETS, BLIND_DEFS } from './blinds';
import { detectCombo, type DetectCtx } from '../core/scoring/detectCombo';
import { mulberry32 } from '../core/rng';
import type { DieFace, DiceSpec } from './dice';

const RUNS_PER_CELL = 200;
const ANTES = 4;
const BLINDS_PER_ANTE = 3;
const BASE_HANDS_PER_BLIND = 3;
const BASE_REROLLS_PER_HAND = 2; // mirrors `core/run/stakeContext.BASE_REROLLS_PER_HAND`

// ---------------------------------------------------------------------------
// Build profiles — abstract catalyst/mod loadouts as a multiplier curve.
// `mult(blindsCleared)` returns the score multiplier applied AFTER chain mult.
// Calibrated so that "scaling" approximates a typical mid-late mid-game player
// with 4-6 catalysts; "synergy" represents a strong stacked build.
// ---------------------------------------------------------------------------
type BuildProfile = {
  id: string;
  name: string;
  mult: (cleared: number) => number;
};

// Profiles model the cumulative score multiplier from catalysts, mods, and
// galaxy levels at a given progression depth. Calibrated against published
// catalyst values: Tempo (+0.5×/tier, cap ×3), Compounding Bias (+0.05×/clear),
// Prime Resonance (mult^1.05/die), plus mod editions (foil/holo/poly typically
// +0.1-0.5× each). A 6-catalyst mid-game stack with mods reasonably hits 3-6×;
// a strong synergy build can reach 10× by ante 3.
const PROFILES: BuildProfile[] = [
  { id: 'bare',    name: 'bare (no catalysts)',         mult: () => 1.0 },
  { id: 'early',   name: 'early (1-2 catalysts)',       mult: (c) => 1.0 + 0.18 * c },
  { id: 'scaling', name: 'scaling (mid-game stack)',    mult: (c) => Math.min(8.0, 1.0 + 0.45 * c) },
  { id: 'synergy', name: 'synergy (strong build)',      mult: (c) => Math.min(20.0, 1.5 + 0.85 * c) },
];

// ---------------------------------------------------------------------------
// Scoring helpers — mirror evaluation.ts exactly.
// ---------------------------------------------------------------------------
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

function sampleFace(faces: readonly DieFace[], rng: () => number): DieFace {
  const idx = Math.floor(rng() * faces.length);
  return faces[idx]!;
}

function rollFaces(dice: DiceSpec, rng: () => number): DieFace[] {
  return dice.map((die) => sampleFace(die.faces, rng));
}

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

type HandResult = { score: number; tier: number };

// Find which dice indices to keep when planning a reroll. Strategy: keep the
// dice contributing to the best concrete combo, reroll the rest. For combos:
// keep the most-frequent face's dice (best n-of-a-kind candidate), or for
// straights keep dice forming the longest run. For captain_crew: keep the
// highest face. Approximates a competent player without exhaustive search.
function planLocks(c: Constellation, rolledFaces: DieFace[]): boolean[] {
  const mods = c.modifiers ?? {};
  if (mods.scoringMode === 'captain_crew') {
    let bestVal = -Infinity;
    let bestIdx = -1;
    rolledFaces.forEach((f, i) => {
      const v = typeof f === 'number' ? f : 0;
      if (v > bestVal) { bestVal = v; bestIdx = i; }
    });
    return rolledFaces.map((_, i) => i === bestIdx);
  }
  // Combo path — count face frequencies.
  const counts = new Map<DieFace, number>();
  rolledFaces.forEach((f) => counts.set(f, (counts.get(f) ?? 0) + 1));
  let bestFace: DieFace | null = null;
  let bestCount = 0;
  for (const [face, count] of counts) {
    if (count > bestCount && face !== 'BLANK' && face !== 0) {
      bestCount = count;
      bestFace = face;
    }
  }
  if (bestCount < 2) {
    // No matches — keep WILD if present, else high faces (>= 4).
    return rolledFaces.map((f) => f === 'WILD' || (typeof f === 'number' && f >= 4));
  }
  return rolledFaces.map((f) => f === bestFace || f === 'WILD');
}

function scoreHand(c: Constellation, rolledFaces: DieFace[], catN: number): HandResult {
  const mods = c.modifiers ?? {};

  if (mods.scoringMode === 'captain_crew') {
    // Argo path — no combo lookup; tier is always 0 for chain purposes.
    const numericFaces = rolledFaces.map((f) => (typeof f === 'number' ? f : 0));
    const captain = numericFaces.length > 0 ? Math.max(...numericFaces) : 0;
    const crew = numericFaces.reduce((s, f) => s + f, 0) - captain;
    const perCat = mods.faceMultiplierPerCatalyst ?? 0;
    const captainMult = 1 + perCat * catN;
    return { score: Math.round(captain * captainMult + crew), tier: 0 };
  }

  const comboCtx = buildComboCtx(c);
  const concrete = resolveWildcards(rolledFaces, comboCtx);
  const combo = detectCombo(concrete, { comboCtx });
  const sumFaces = concrete.reduce((s, f) => s + f, 0);
  const baseChips = combo.chips * (mods.baseChipsMult ?? 1);
  const baseMult = combo.mult * (mods.baseMultMult ?? 1);
  return { score: Math.round((baseChips + sumFaces) * baseMult), tier: combo.tier };
}

// ---------------------------------------------------------------------------
// Chain mult — mirrors `core/scoring/constellationChain.ts`.
// ---------------------------------------------------------------------------
type ChainState = { len: number; tier: number };

function applyChain(currTier: number, prev: ChainState, c: Constellation): { mult: number; next: ChainState } {
  const mods = c.modifiers ?? {};
  const cap = mods.chainCap ?? 8;
  const step = mods.chainStep ?? 0.25;
  const neverBreaks = !!mods.chainNeverBreaks;
  let len: number;
  let tier: number;
  if (prev.len > 0 && currTier >= prev.tier) {
    len = Math.min(cap, prev.len + 1);
    tier = currTier;
  } else if (prev.len === 0) {
    len = 1;
    tier = currTier;
  } else if (neverBreaks) {
    len = Math.min(cap, prev.len + 1);
    tier = Math.max(prev.tier, currTier);
  } else {
    len = 0;
    tier = -1;
  }
  return { mult: 1 + step * Math.max(0, len - 1), next: { len, tier } };
}

// ---------------------------------------------------------------------------
// Run simulation — full 12-blind ladder.
// ---------------------------------------------------------------------------
type RunResult = {
  cleared: number;          // count of blinds cleared (0..12)
  highestAnte: number;      // 0..4
  bustAt: number;           // index of blind that busted, or 12 if won
  chainSamples: number[];   // realized chainMult per blind (peak)
  busts: number;            // hands lost to chain breaks (informational)
};

function simulateRun(
  c: Constellation,
  stake: Stake,
  profile: BuildProfile,
  seed: number,
): RunResult {
  const rng = mulberry32(seed);
  const result: RunResult = {
    cleared: 0,
    highestAnte: 0,
    bustAt: 12,
    chainSamples: [],
    busts: 0,
  };
  // Rough catN ramp — same shape used by the existing per-hand sim's Argo
  // analysis: ~1 catalyst per 1.5 cleared blinds, capped at 8.
  const catCount = (cleared: number) => Math.min(8, Math.floor(cleared * 0.6));

  for (let blindIdx = 0; blindIdx < ANTES * BLINDS_PER_ANTE; blindIdx++) {
    const ante = Math.floor(blindIdx / BLINDS_PER_ANTE) + 1;
    const trial = blindIdx % BLINDS_PER_ANTE;
    const baseRow = ANTE_BASE_TARGETS[ante - 1] ?? ANTE_BASE_TARGETS[ANTE_BASE_TARGETS.length - 1]!;
    const baseTarget = baseRow[trial]!;
    const trialMult = BLIND_DEFS[trial]!.targetMult;
    const target = Math.ceil(baseTarget * trialMult * stake.targetMult);

    const hands = Math.max(1, BASE_HANDS_PER_BLIND + stake.handsDelta);
    const totalRerolls = Math.max(0, BASE_REROLLS_PER_HAND + stake.rerollsDelta);
    // Player-model: distribute the reroll budget evenly across hands as
    // "best-of-K" picks. With 3 hands and 2 rerolls, ceil(2/3)+1 = 2 → roll
    // twice per hand and keep the higher-scoring one. Approximation; real
    // rerolls are partial-roll, but this captures the average expected
    // improvement per hand without modeling lock-strategy.
    const triesPerHand = 1 + Math.max(0, Math.ceil(totalRerolls / hands));
    const buildMult = profile.mult(result.cleared);
    const cats = catCount(result.cleared);

    // Strategy: roll all hands first to see their tiers, then play them in
    // ascending tier order so chain mult builds. Per hand: roll, lock the
    // dice contributing to the best partial combo, reroll the rest up to
    // (triesPerHand-1) more times, take the best score across attempts.
    // Approximates a competent player using locks + rerolls.
    type Roll = { score: number; tier: number };
    const rolls: Roll[] = [];
    for (let h = 0; h < hands; h++) {
      let curFaces = rollFaces(c.dice, rng.next.bind(rng));
      let best: Roll = scoreHand(c, curFaces, cats);
      for (let t = 1; t < triesPerHand; t++) {
        const locks = planLocks(c, curFaces);
        const nextFaces = curFaces.map((f, i) => (locks[i] ? f : sampleFace(c.dice[i]!.faces, rng.next.bind(rng))));
        const r = scoreHand(c, nextFaces, cats);
        if (r.score > best.score) {
          best = r;
          curFaces = nextFaces;
        }
      }
      rolls.push(best);
    }
    rolls.sort((a, b) => a.tier - b.tier);

    let blindScore = 0;
    let chain: ChainState = { len: 0, tier: -1 };
    let peakChainMult = 1.0;

    for (const roll of rolls) {
      if (blindScore >= target) break;
      const { mult: chainMult, next: nextChain } = applyChain(roll.tier, chain, c);
      if (chain.len >= 1 && nextChain.len === 0) result.busts++;
      chain = nextChain;
      if (chainMult > peakChainMult) peakChainMult = chainMult;
      const handScore = Math.round(roll.score * chainMult * buildMult);
      blindScore += handScore;
    }
    result.chainSamples.push(peakChainMult);

    if (blindScore >= target) {
      result.cleared += 1;
      result.highestAnte = ante;
    } else {
      result.bustAt = blindIdx;
      break;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Cell aggregation.
// ---------------------------------------------------------------------------
type Cell = {
  constId: string;
  stakeId: string;
  profileId: string;
  cleared: { meanRate: number; perAnteRate: number[] };  // perAnteRate[i] = % runs that cleared ante i+1
  chain: { meanPeak: number; capHitRate: number };       // % blinds hitting cap
};

function simulateCell(c: Constellation, stake: Stake, profile: BuildProfile): Cell {
  const seedBase = (c.id.charCodeAt(0) * 7919 + stake.id.charCodeAt(0) * 31 + profile.id.charCodeAt(0)) >>> 0;
  let totalCleared = 0;
  const anteWinCounts = new Array<number>(ANTES).fill(0);
  const chainPeaks: number[] = [];
  let capHits = 0;
  let capSamples = 0;
  const chainCap = c.modifiers?.chainCap ?? 8;
  const chainStep = c.modifiers?.chainStep ?? 0.25;
  const capMult = 1 + chainStep * Math.max(0, chainCap - 1);

  for (let i = 0; i < RUNS_PER_CELL; i++) {
    const r = simulateRun(c, stake, profile, seedBase + i);
    totalCleared += r.cleared;
    for (let a = 1; a <= r.highestAnte; a++) anteWinCounts[a - 1]! += 1;
    for (const peak of r.chainSamples) {
      chainPeaks.push(peak);
      capSamples++;
      if (peak >= capMult - 1e-6) capHits++;
    }
  }
  const meanPeak = chainPeaks.length === 0 ? 0 : chainPeaks.reduce((a, b) => a + b, 0) / chainPeaks.length;

  return {
    constId: c.id,
    stakeId: stake.id,
    profileId: profile.id,
    cleared: {
      meanRate: totalCleared / (RUNS_PER_CELL * ANTES * BLINDS_PER_ANTE),
      perAnteRate: anteWinCounts.map((n) => n / RUNS_PER_CELL),
    },
    chain: {
      meanPeak,
      capHitRate: capSamples > 0 ? capHits / capSamples : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Reporting helpers.
// ---------------------------------------------------------------------------
function pct(n: number): string {
  return `${(n * 100).toFixed(0).padStart(3)}%`;
}

function fmt(n: number, w = 5): string {
  return n.toFixed(2).padStart(w);
}

describe('balance simulation: full-run win-rate ladder', () => {
  it(`reports per-(constellation × stake × profile) clear rates over ${RUNS_PER_CELL} runs/cell`, () => {
    const allCells: Cell[] = [];
    for (const c of CONSTELLATIONS) {
      for (const stake of STAKES) {
        for (const profile of PROFILES) {
          allCells.push(simulateCell(c, stake, profile));
        }
      }
    }

    const lines: string[] = [];
    lines.push('');
    lines.push('=== Full-run win-rate ladder ===');
    lines.push(`(${RUNS_PER_CELL} runs per cell, ${ANTES} antes × ${BLINDS_PER_ANTE} trials, seeded)`);
    lines.push('');

    // ------- Section 1: ante-clear rates per constellation @ Spark / scaling profile -------
    lines.push('--- Per-ante clear rate, Spark stake, "scaling" build ---');
    lines.push(`  ${'constellation'.padEnd(13)}  A1   A2   A3   A4`);
    lines.push('  ' + '-'.repeat(40));
    for (const c of CONSTELLATIONS) {
      const cell = allCells.find((x) => x.constId === c.id && x.stakeId === 'spark' && x.profileId === 'scaling')!;
      const r = cell.cleared.perAnteRate;
      lines.push(`  ${c.id.padEnd(13)}  ${pct(r[0]!)}  ${pct(r[1]!)}  ${pct(r[2]!)}  ${pct(r[3]!)}`);
    }
    lines.push('');

    // ------- Section 2: stake-difficulty curve, Lyra @ scaling -------
    lines.push('--- Stake difficulty curve, Lyra constellation, "scaling" build ---');
    lines.push(`  ${'stake'.padEnd(10)}  A1   A2   A3   A4   any-clear`);
    lines.push('  ' + '-'.repeat(45));
    for (const stake of STAKES) {
      const cell = allCells.find((x) => x.constId === 'lyra' && x.stakeId === stake.id && x.profileId === 'scaling')!;
      const r = cell.cleared.perAnteRate;
      lines.push(`  ${stake.id.padEnd(10)}  ${pct(r[0]!)}  ${pct(r[1]!)}  ${pct(r[2]!)}  ${pct(r[3]!)}    ${pct(cell.cleared.meanRate)}`);
    }
    lines.push('');

    // ------- Section 3: build-profile gradient, Lyra @ Spark -------
    lines.push('--- Build profile impact, Lyra @ Spark ---');
    lines.push(`  ${'profile'.padEnd(38)}  A1   A2   A3   A4`);
    lines.push('  ' + '-'.repeat(60));
    for (const p of PROFILES) {
      const cell = allCells.find((x) => x.constId === 'lyra' && x.stakeId === 'spark' && x.profileId === p.id)!;
      const r = cell.cleared.perAnteRate;
      lines.push(`  ${p.name.padEnd(38)}  ${pct(r[0]!)}  ${pct(r[1]!)}  ${pct(r[2]!)}  ${pct(r[3]!)}`);
    }
    lines.push('');

    // ------- Section 4: chain-mult realization -------
    lines.push('--- Chain multiplier realization (Spark, scaling profile) ---');
    lines.push(`  ${'constellation'.padEnd(13)}  cap-mult  mean-peak  cap-hit%`);
    lines.push('  ' + '-'.repeat(48));
    for (const c of CONSTELLATIONS) {
      const cell = allCells.find((x) => x.constId === c.id && x.stakeId === 'spark' && x.profileId === 'scaling')!;
      const cap = c.modifiers?.chainCap ?? 8;
      const step = c.modifiers?.chainStep ?? 0.25;
      const capMult = 1 + step * Math.max(0, cap - 1);
      lines.push(`  ${c.id.padEnd(13)}  ${fmt(capMult)}      ${fmt(cell.chain.meanPeak)}    ${pct(cell.chain.capHitRate)}`);
    }
    lines.push('');

    // ------- Section 5: outlier flags -------
    lines.push('--- Outlier flags ---');
    const flags: string[] = [];

    // Stake difficulty curve target: Spark ~ 80%+ ante-4 clear; Supernova ~10–20%.
    for (const c of CONSTELLATIONS) {
      const spark = allCells.find((x) => x.constId === c.id && x.stakeId === 'spark' && x.profileId === 'scaling')!;
      const supernova = allCells.find((x) => x.constId === c.id && x.stakeId === 'supernova' && x.profileId === 'scaling')!;
      if (spark.cleared.perAnteRate[3]! < 0.5) flags.push(`  [STAKE] ${c.id}: Spark A4 clear only ${pct(spark.cleared.perAnteRate[3]!)} (target ≥50%)`);
      if (supernova.cleared.perAnteRate[3]! > 0.4) flags.push(`  [STAKE] ${c.id}: Supernova A4 clear ${pct(supernova.cleared.perAnteRate[3]!)} (target ≤40%)`);
    }
    // Chain cap utilization: <2% or >40% of blinds at cap is a flag.
    for (const c of CONSTELLATIONS) {
      const cell = allCells.find((x) => x.constId === c.id && x.stakeId === 'spark' && x.profileId === 'scaling')!;
      if (cell.chain.capHitRate < 0.02) flags.push(`  [CHAIN] ${c.id}: cap-hit-rate ${pct(cell.chain.capHitRate)} (cap is dead weight)`);
      if (cell.chain.capHitRate > 0.40) flags.push(`  [CHAIN] ${c.id}: cap-hit-rate ${pct(cell.chain.capHitRate)} (cap dominates)`);
    }
    // Constellation parity: any constellation >25 pp below the Lyra reference at Spark/scaling A4 is a flag.
    const ref = allCells.find((x) => x.constId === 'lyra' && x.stakeId === 'spark' && x.profileId === 'scaling')!.cleared.perAnteRate[3]!;
    for (const c of CONSTELLATIONS) {
      if (c.id === 'lyra') continue;
      const cell = allCells.find((x) => x.constId === c.id && x.stakeId === 'spark' && x.profileId === 'scaling')!;
      const delta = cell.cleared.perAnteRate[3]! - ref;
      if (Math.abs(delta) > 0.25) flags.push(`  [CONST] ${c.id}: A4 delta vs Lyra ${(delta * 100).toFixed(0)} pp`);
    }
    if (flags.length === 0) lines.push('  (none)');
    else lines.push(...flags);
    lines.push('');

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    // Smoke invariants only — not behaviour assertions.
    expect(allCells.length).toBe(CONSTELLATIONS.length * STAKES.length * PROFILES.length);
    for (const cell of allCells) {
      expect(Number.isFinite(cell.cleared.meanRate)).toBe(true);
      expect(cell.cleared.meanRate).toBeGreaterThanOrEqual(0);
      expect(cell.cleared.meanRate).toBeLessThanOrEqual(1);
      expect(Number.isFinite(cell.chain.meanPeak)).toBe(true);
    }
  });
});
