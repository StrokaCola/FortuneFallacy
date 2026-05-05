import type { PhaseFn } from '../pipeline/types';
import { detectCombo } from '../scoring/detectCombo';
import { getComboCtx, getDiceSpec, getScoringMode, getBaseScoreMults, getFaceMultiplierPerCatalyst } from '../run/diceContext';

// Resolve a hand of faces (some of which may be 'WILD') into the substitution
// that maximises the combo tier. Tries each candidate value once and picks
// the highest-tier match. Linear in (universe × wildcards) which is fine for
// the dice counts in play.
function resolveWildcards(
  faces: readonly (number | 'WILD' | 'BLANK')[],
  universe: number[],
  ctx: ReturnType<typeof getComboCtx>,
): { faces: number[]; combo: ReturnType<typeof detectCombo> } {
  const concrete: number[] = [];
  const wildIdxs: number[] = [];
  faces.forEach((f, i) => {
    if (f === 'WILD') wildIdxs.push(i);
    else concrete.push(typeof f === 'number' ? f : 0);
  });
  if (wildIdxs.length === 0) {
    return { faces: concrete, combo: detectCombo(concrete, { comboCtx: ctx }) };
  }
  // Iteratively resolve wildcards greedily: for each wildcard, try every
  // universe value and pick the one that produces the highest-tier combo
  // when combined with the rest. Greedy is sufficient here because wildcards
  // are interchangeable and combo tiers are monotonic in matches.
  let working = [...concrete];
  for (let _ = 0; _ < wildIdxs.length; _++) {
    let bestVal = universe[0] ?? 1;
    let bestTier = -1;
    for (const v of universe) {
      const candidate = [...working, v];
      const tier = detectCombo(candidate, { comboCtx: ctx }).tier;
      if (tier > bestTier) { bestTier = tier; bestVal = v; }
    }
    working.push(bestVal);
  }
  return { faces: working, combo: detectCombo(working, { comboCtx: ctx }) };
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
  const baseChips = combo.chips * baseMults.chips;
  const baseMult  = combo.mult  * baseMults.mult;
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
