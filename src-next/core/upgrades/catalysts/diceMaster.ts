// Dice Master: +1 reroll per hand. Non-pipeline catalyst — its effect is
// read in `core/run/stakeContext.ts:rerollsPerHand`. This file exists so
// the catalyst id appears in the registry's "owned" check (used by tests
// and the no-op apply keeps the pattern uniform), but the apply itself
// is a passthrough.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';

register({
  id: 'dice_master',
  phase: Phase.UPGRADES,
  priority: 200,
  apply: (ctx) => ctx,
});
