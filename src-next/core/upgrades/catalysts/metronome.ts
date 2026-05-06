// Metronome: alternates per hand within a run. Odd-numbered hand → chips
// ×1.5; even-numbered hand → mult ×1.5. handsPlayed is incremented AFTER
// the pipeline by SCORE_HAND, so the current hand number = handsPlayed + 1.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'metronome',
  phase: Phase.UPGRADES,
  priority: 125,
  apply: (ctx) => {
    const handNumber = ctx.state.run.handsPlayed + 1;
    const isOdd = handNumber % 2 === 1;
    if (isOdd) {
      const newChips = ctx.chips * 1.5;
      return {
        ...ctx,
        chips: newChips,
        events: emitUpgrade(ctx, 'metronome', newChips - ctx.chips, 0),
      };
    }
    const newMult = ctx.mult * 1.5;
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'metronome', 0, newMult - ctx.mult),
    };
  },
});
