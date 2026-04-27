import { getByPhase } from '../upgrades/registry';
import { Phase, type PhaseFn } from '../pipeline/types';
import { applyFaceRemaps } from '../runes';

export const postRollModifiers: PhaseFn = (ctx) => {
  let next = ctx;
  if (ctx.sim) {
    const remapped = applyFaceRemaps(ctx.sim.finalFaces, ctx.state.round.diceRunes);
    next = { ...next, sim: { ...ctx.sim, finalFaces: remapped } };
  }
  for (const u of getByPhase(Phase.POST_ROLL_MODIFIERS)) next = u.apply(next);
  return next;
};
