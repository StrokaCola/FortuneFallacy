import { getByPhase } from '../upgrades/registry';
import { Phase, type PhaseFn } from '../pipeline/types';
import { applyFaceRemaps } from '../mods';
import { resolveWildcards } from '../mods/wildcardSolve';
import { hasDebuff } from '../round/debuffs';

export const postRollModifiers: PhaseFn = (ctx) => {
  let next = ctx;
  if (ctx.sim) {
    const lockOnes = hasDebuff(ctx.state, 'no_mod_transforms_on_ones');
    const { faces: remapFaces, events: remapEvents } = applyFaceRemaps(
      ctx.sim.finalFaces,
      ctx.state.run.diceMods,
      lockOnes,
    );
    // Wildcard runs AFTER face remaps so it sees post-Loaded values, then
    // chooses the substitute that maximizes the held combo. Pluto debuff
    // (lockOnes) prevents wildcard from transforming a 1.
    const order = ctx.state.round.scoringOrder ?? remapFaces.map((_, i) => i);
    const scoringIdxs = order.filter((idx) => idx >= 0 && idx < remapFaces.length);
    const { faces, events: wildEvents } = resolveWildcards(
      remapFaces,
      ctx.state.run.diceMods,
      scoringIdxs,
      lockOnes,
    );
    const allFiredEvents = [
      ...remapEvents.map((p) => ({ type: 'onModFired' as const, payload: p })),
      ...wildEvents.map((p) => ({ type: 'onModFired' as const, payload: p })),
    ];
    next = {
      ...next,
      sim: { ...ctx.sim, finalFaces: faces },
      events: [...next.events, ...allFiredEvents],
    };
  }
  for (const u of getByPhase(Phase.POST_ROLL_MODIFIERS)) next = u.apply(next);
  return next;
};
