import { getByPhase } from '../upgrades/registry';
import { Phase, type PhaseFn } from '../pipeline/types';
import { applyFaceRemaps } from '../mods';
import { hasDebuff } from '../round/debuffs';

export const postRollModifiers: PhaseFn = (ctx) => {
  let next = ctx;
  if (ctx.sim) {
    const lockOnes = hasDebuff(ctx.state, 'no_mod_transforms_on_ones');
    const { faces, events: remapEvents } = applyFaceRemaps(
      ctx.sim.finalFaces,
      ctx.state.run.diceMods,
      lockOnes,
    );
    const modFiredEvents = remapEvents.map((p) => ({ type: 'onModFired' as const, payload: p }));
    next = {
      ...next,
      sim: { ...ctx.sim, finalFaces: faces },
      events: [...next.events, ...modFiredEvents],
    };
  }
  for (const u of getByPhase(Phase.POST_ROLL_MODIFIERS)) next = u.apply(next);
  return next;
};
