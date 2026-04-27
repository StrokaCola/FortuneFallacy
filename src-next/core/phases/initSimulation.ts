import type { PhaseFn } from '../pipeline/types';

export const initSimulation: PhaseFn = (ctx) => {
  const diceToRoll = ctx.state.round.dice
    .map((d, i) => (d.locked ? -1 : i))
    .filter((i) => i >= 0);
  return {
    ...ctx,
    simRequest: { diceToRoll, seed: ctx.rng.seed },
  };
};
