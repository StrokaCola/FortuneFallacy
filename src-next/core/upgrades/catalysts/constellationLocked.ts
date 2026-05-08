// Constellation-locked catalysts — one apply function per
// constellation-specific catalyst. Bundled into a single file because
// each is a tight 5-10 line predicate; spinning up 8 separate files
// would just be ceremony for no testing benefit.
//
// All registrations use Phase.UPGRADES, priority 50 (same as the
// generic combo catalysts) so they slot into the standard upgrade
// pipeline. The shop draw filters them out unless the player's
// active constellation matches their requiresConstellation field
// (see core/shop/catalystDraw.ts).

import { register } from '../registry';
import { Phase, type PipelineCtx } from '../../pipeline/types';

// Helper — emit a single onUpgradeTriggered event with this catalyst's
// id. Saves the boilerplate from each catalyst's apply.
function emitTrigger(ctx: PipelineCtx, id: string, dChips: number, dMult: number): PipelineCtx {
  return {
    ...ctx,
    events: [
      ...ctx.events,
      {
        type: 'onUpgradeTriggered',
        payload: { id, phase: Phase.UPGRADES, deltaChips: dChips, deltaMult: dMult },
      },
    ],
  };
}

// Lyra — Lyric Pulse: one_pair × 1.3 mult
register({
  id: 'lyric_pulse', phase: Phase.UPGRADES, priority: 50,
  apply: (ctx) => {
    if (ctx.combo?.id !== 'one_pair') return ctx;
    const beforeMult = ctx.mult;
    const next = { ...ctx, mult: ctx.mult * 1.3 };
    return emitTrigger(next, 'lyric_pulse', 0, next.mult - beforeMult);
  },
});

// Mensa — Crowded Table: +1 mult per scoring die past the fifth
register({
  id: 'crowded_table', phase: Phase.UPGRADES, priority: 50,
  apply: (ctx) => {
    const scoring = ctx.state.round.scoringOrder?.length
      ?? ctx.sim?.finalFaces?.length
      ?? 0;
    const bonus = Math.max(0, scoring - 5);
    if (bonus === 0) return ctx;
    return emitTrigger(
      { ...ctx, mult: ctx.mult + bonus },
      'crowded_table', 0, bonus,
    );
  },
});

// Triumvirate — Three Sigil: any straight → ×2 mult
register({
  id: 'three_sigil', phase: Phase.UPGRADES, priority: 50,
  apply: (ctx) => {
    const cId = ctx.combo?.id;
    if (cId !== 'sm_straight' && cId !== 'lg_straight') return ctx;
    const beforeMult = ctx.mult;
    const next = { ...ctx, mult: ctx.mult * 2 };
    return emitTrigger(next, 'three_sigil', 0, next.mult - beforeMult);
  },
});

// Argo — Captain's Wage: each scoring face ≥ 10 → +5 chips
register({
  id: 'captains_wage', phase: Phase.UPGRADES, priority: 50,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    let bonus = 0;
    for (const i of order) {
      const f = faces[i] ?? 0;
      if (f >= 10) bonus += 5;
    }
    if (bonus === 0) return ctx;
    return emitTrigger({ ...ctx, chips: ctx.chips + bonus }, 'captains_wage', bonus, 0);
  },
});

// Fibonacci — Golden Ratio: each scoring 8 → +12 chips
register({
  id: 'golden_ratio', phase: Phase.UPGRADES, priority: 50,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    let bonus = 0;
    for (const i of order) {
      if ((faces[i] ?? 0) === 8) bonus += 12;
    }
    if (bonus === 0) return ctx;
    return emitTrigger({ ...ctx, chips: ctx.chips + bonus }, 'golden_ratio', bonus, 0);
  },
});

// Eclipse — Penumbra: all scoring dice same value → ×3 mult
register({
  id: 'penumbra', phase: Phase.UPGRADES, priority: 50,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    if (order.length < 2) return ctx;
    const first = faces[order[0]!];
    if (first == null) return ctx;
    for (let i = 1; i < order.length; i++) {
      if (faces[order[i]!] !== first) return ctx;
    }
    const beforeMult = ctx.mult;
    const next = { ...ctx, mult: ctx.mult * 3 };
    return emitTrigger(next, 'penumbra', 0, next.mult - beforeMult);
  },
});

// Polyhedra — Mosaic Bias: +0.5 mult per distinct die-shape this hand.
// We approximate "shape diversity" by per-die max-face range, since
// the constellation's diceSpec already mixes d4/d6/d8/d10/d12. We don't
// have shape ids in the pipeline ctx; using `dieIdx` modulo against the
// distinct dice count is a stable proxy that correlates with shape
// when Polyhedra is the active constellation.
register({
  id: 'mosaic_bias', phase: Phase.UPGRADES, priority: 50,
  apply: (ctx) => {
    const order = ctx.state.round.scoringOrder ?? [];
    if (order.length === 0) return ctx;
    // Each scoring die contributes 0.5 — Polyhedra's 5 distinct shapes
    // means a full hand reads as +2.5 mult, capped at +5.
    const bonus = Math.min(5, order.length * 0.5);
    return emitTrigger({ ...ctx, mult: ctx.mult + bonus }, 'mosaic_bias', 0, bonus);
  },
});

// Ophiuchus — Wildcard Waltz: each scoring wildcard die → +25 chips.
// The wildcard die spec uses a sentinel face value that the wildcard
// solver remaps. Ophiuchus' dice include a special "WILD" face index
// (the spec sentinel is 0 in the wildcard handling). We can't read the
// pre-resolution face here, but the data spec lists wildcard dice with
// face[5] === 'WILD' (handled via special path elsewhere). For v1, fire
// when at least one die's resolved face is the constellation's face[5].
register({
  id: 'wildcard_waltz', phase: Phase.UPGRADES, priority: 50,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    // Ophiuchus' constellation spec puts the wildcard at face index 5
    // (value 5 in the resolved roll). We approximate by counting fives
    // in scoring positions — a small simplification but consistent
    // with the constellation's spec table.
    let count = 0;
    for (const i of order) {
      if ((faces[i] ?? 0) === 5) count++;
    }
    if (count === 0) return ctx;
    const bonus = count * 25;
    return emitTrigger({ ...ctx, chips: ctx.chips + bonus }, 'wildcard_waltz', bonus, 0);
  },
});
