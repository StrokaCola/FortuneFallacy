import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import type { GameState } from '../../../state/store';

const MULT_VALUE = 1.5;

export function shardSinkActive(state: GameState): boolean {
  return state.run.catalysts.includes('shard_sink') && state.run.shards >= 1;
}

register({
  id: 'shard_sink',
  phase: Phase.UPGRADES,
  priority: 90,
  apply: (ctx) => {
    if (!ctx.state.round.shardSinkPrimedThisHand) return ctx;
    const newMult = ctx.mult * MULT_VALUE;
    return {
      ...ctx,
      mult: newMult,
      events: [
        ...ctx.events,
        {
          type: 'onUpgradeTriggered',
          payload: {
            id: 'shard_sink',
            phase: Phase.UPGRADES,
            deltaChips: 0,
            deltaMult: newMult - ctx.mult,
          },
        },
      ],
    };
  },
});
