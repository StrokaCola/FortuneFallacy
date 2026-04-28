import { getByPhase } from '../upgrades/registry';
import { Phase, type PhaseFn } from '../pipeline/types';
import { applyFaceRemaps } from '../mods';
import { hasDebuff } from '../round/debuffs';

export const postRollModifiers: PhaseFn = (ctx) => {
  let next = ctx;
  if (ctx.sim) {
    const lockOnes = hasDebuff(ctx.state, 'no_mod_transforms_on_ones');
    const remapped = applyFaceRemaps(ctx.sim.finalFaces, ctx.state.round.diceMods, lockOnes);
    next = { ...next, sim: { ...ctx.sim, finalFaces: remapped } };
  }
  for (const u of getByPhase(Phase.POST_ROLL_MODIFIERS)) next = u.apply(next);
  return next;
};
