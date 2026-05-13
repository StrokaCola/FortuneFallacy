import { getByPhase } from '../upgrades/registry';
import { Phase, type PhaseFn } from '../pipeline/types';

export const unheldScan: PhaseFn = (ctx) => {
  let next = ctx;
  for (const u of getByPhase(Phase.UNHELD_SCAN)) next = u.apply(next);
  return next;
};
