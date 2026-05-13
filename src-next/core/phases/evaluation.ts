import type { PhaseFn } from '../pipeline/types';
import { detectCombo } from '../scoring/detectCombo';
import { getComboCtx, getDiceSpec, getScoringMode, getBaseScoreMults, getFaceMultiplierPerCatalyst } from '../run/diceContext';
import { GALAXY_BONUS } from '../consumables/galaxies';

// Resolve a hand of faces (some of which may be 'WILD') into the substitution
// that maximises the combo tier. Strategy:
//
//   ≤ 3 wildcards: exhaustive over universe^wildcards (≤6^3 = 216 ops).
//                  Necessary because combo tier isn't monotonic in matches
//                  (e.g. two wildcards completing a small straight beats
//                  the greedy "match the existing pair" choice).
//   ≥ 4 wildcards: combinatorial blowup (6^5 = 7776 per resolve) makes
//                  exhaustive too slow inside the balance simulator. Fall
//                  back to a smarter two-pass heuristic: (a) try assigning
//                  every wildcard to each universe value (n-of-a-kind path),
//                  and (b) try filling missing values to extend the longest
//                  contiguous run (straight path), then take whichever
//                  produces the higher tier. Both passes are O(universe).
//
// The ≥4-wildcards case only happens in Ophiuchus pathological hands or
// with multiple Wildcard mod copies; the heuristic still captures both
// dominant strategies (mass-match vs gap-fill) so it dominates the legacy
// greedy without paying the exponential cost.
function resolveWildcards(
  faces: readonly (number | 'WILD' | 'BLANK')[],
  universe: number[],
  ctx: ReturnType<typeof getComboCtx>,
): { faces: number[]; combo: ReturnType<typeof detectCombo> } {
  const concrete: number[] = [];
  let wildCount = 0;
  for (const f of faces) {
    if (f === 'WILD') wildCount++;
    else concrete.push(typeof f === 'number' ? f : 0);
  }
  if (wildCount === 0) {
    return { faces: concrete, combo: detectCombo(concrete, { comboCtx: ctx }) };
  }
  const u = universe.length;
  if (u === 0) {
    return { faces: concrete, combo: detectCombo(concrete, { comboCtx: ctx }) };
  }

  const EXHAUSTIVE_LIMIT = 3;

  // Helper: pick the better of two candidates (higher tier, ties → higher sum).
  const sumOf = (arr: number[]): number => arr.reduce((s, f) => s + f, 0);
  let bestFaces: number[] = [...concrete, ...new Array(wildCount).fill(universe[0]!)];
  let bestCombo = detectCombo(bestFaces, { comboCtx: ctx });
  let bestSum = sumOf(bestFaces);
  const offer = (candidate: number[]): void => {
    const combo = detectCombo(candidate, { comboCtx: ctx });
    if (combo.tier > bestCombo.tier) {
      bestCombo = combo;
      bestFaces = candidate;
      bestSum = sumOf(candidate);
      return;
    }
    if (combo.tier === bestCombo.tier) {
      const sum = sumOf(candidate);
      if (sum > bestSum) {
        bestCombo = combo;
        bestFaces = candidate;
        bestSum = sum;
      }
    }
  };

  if (wildCount <= EXHAUSTIVE_LIMIT) {
    const pick: number[] = new Array(wildCount).fill(0);
    const totalCombos = u ** wildCount;
    // Skip index 0 (the seed assignment, already evaluated above).
    for (let n = 1; n < totalCombos; n++) {
      let q = n;
      for (let i = 0; i < wildCount; i++) {
        pick[i] = q % u;
        q = Math.floor(q / u);
      }
      const candidate = [...concrete];
      for (let i = 0; i < wildCount; i++) candidate.push(universe[pick[i]!]!);
      offer(candidate);
    }
    return { faces: bestFaces, combo: bestCombo };
  }

  // wildCount > EXHAUSTIVE_LIMIT — two-pass heuristic.
  // Pass 1: n-of-a-kind. Assign every wildcard to the same universe value.
  for (const v of universe) {
    const candidate = [...concrete];
    for (let i = 0; i < wildCount; i++) candidate.push(v);
    offer(candidate);
  }
  // Pass 2: straight extension. Find the longest run already in `concrete`
  // and assign wildcards to fill gaps + extend either edge greedily within
  // the universe. We try each starting anchor in the universe and fill
  // wildCount consecutive values forward.
  const sortedUniverse = [...universe].sort((a, b) => a - b);
  for (let start = 0; start < sortedUniverse.length; start++) {
    const candidate = [...concrete];
    // Take the next `wildCount` values from `start` (wrapping at the end of
    // the universe is meaningless — runs need consecutive ints — so just
    // stop). Pick whichever the universe contains; if we run out, repeat
    // the last value (degenerates to pass 1's behaviour at the tail).
    for (let i = 0; i < wildCount; i++) {
      const v = sortedUniverse[Math.min(start + i, sortedUniverse.length - 1)]!;
      candidate.push(v);
    }
    offer(candidate);
  }
  return { faces: bestFaces, combo: bestCombo };
}

export const evaluation: PhaseFn = (ctx) => {
  const allFaces = ctx.sim?.finalFaces ?? [];
  const order = ctx.state.round.scoringOrder ?? allFaces.map((_, i) => i);
  const heldIdxs = order.filter((idx) => idx >= 0 && idx < allFaces.length);

  const scoringMode = getScoringMode(ctx.state);
  const spec = getDiceSpec(ctx.state);
  const baseMults = getBaseScoreMults(ctx.state);

  // Pull face values, treating per-die specs to support WILD/BLANK markers.
  // Today the simulation produces numeric faces; a WILD-bearing die rolls
  // the literal sentinel value `-1` which we substitute back to 'WILD' here.
  const heldFaces = heldIdxs.map((i) => {
    const raw = allFaces[i]!;
    if (raw === -1) return 'WILD' as const;
    return raw;
  });

  if (scoringMode === 'captain_crew') {
    // Argo: no combo lookup. The highest face this hand rides the catalyst
    // multiplier; the remaining faces add as flat chips alongside it. We bake
    // the whole expression into `chips` so chain mult and downstream catalyst
    // multipliers still apply via the standard chips × mult × chainMult flow.
    const numericFaces = heldFaces.map((f) => (typeof f === 'number' ? f : 0));
    const captain = numericFaces.length > 0 ? Math.max(...numericFaces) : 0;
    const crew = numericFaces.reduce((s, f) => s + f, 0) - captain;
    const perCat = getFaceMultiplierPerCatalyst(ctx.state);
    const catCount = ctx.state.run.catalysts.length;
    const captainMult = 1 + perCat * catCount;
    const chips = captain * captainMult + crew;
    return {
      ...ctx,
      combo: {
        id: 'argo_captain',
        tier: 0,
        baseChips: chips,
        baseMult: 1,
        scoringFaces: numericFaces,
      },
      chips,
      mult: 1,
    };
  }

  const comboCtx = getComboCtx(ctx.state);
  const universe = comboCtx.faceUniverse.length > 0 ? comboCtx.faceUniverse : [1, 2, 3, 4, 5, 6];

  const { faces: resolvedFaces, combo } = resolveWildcards(heldFaces, universe, comboCtx);
  const sumFaces = resolvedFaces.reduce((s, f) => s + f, 0);
  // Galaxy consumables raise per-combo levels in run.comboLevels. Each level
  // adds flat chips/mult to the combo's base, applied here so that catalyst
  // multipliers in Phase.UPGRADES compound on the leveled base.
  const lvl = ctx.state.run.comboLevels?.[combo.id] ?? 0;
  const galaxy = GALAXY_BONUS[combo.id];
  const galaxyChips = lvl * (galaxy?.chips ?? 0);
  const galaxyMult  = lvl * (galaxy?.mult  ?? 0);
  const baseChips = combo.chips * baseMults.chips + galaxyChips;
  const baseMult  = combo.mult  * baseMults.mult  + galaxyMult;
  // Discard the 'spec' parameter — currently unused but reserved for behavior dice.
  void spec;
  return {
    ...ctx,
    combo: {
      id: combo.id,
      tier: combo.tier,
      baseChips,
      baseMult,
      scoringFaces: resolvedFaces,
    },
    chips: baseChips + sumFaces,
    mult: baseMult,
  };
};
