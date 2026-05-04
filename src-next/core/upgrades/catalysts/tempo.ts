// Tempo: each consecutive hand of strictly higher combo tier than previous
// adds +0.5× mult (multiplicative), capping at ×3.0. Streak resets when the
// player ties or drops in tier.
//
// `tempoStreak` represents the streak EXCLUDING the current hand (it's
// updated AFTER scoring, in roll.ts SCORE_HAND via updateComboStreaks).
// So if streak = 2, this is the 3rd consecutive ascending hand and we
// multiply by 1 + 0.5*2 = 2.0.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const PER_STREAK = 0.5;
const CAP = 3.0;

register({
  id: 'tempo',
  phase: Phase.UPGRADES,
  priority: 160,
  apply: (ctx) => {
    const streak = ctx.state.run.tempoStreak ?? 0;
    if (streak <= 0) return ctx;
    const factor = Math.min(CAP, 1 + streak * PER_STREAK);
    if (factor <= 1) return ctx;
    const newMult = ctx.mult * factor;
    return {
      ...ctx,
      mult: newMult,
      events: emitUpgrade(ctx, 'tempo', 0, newMult - ctx.mult),
    };
  },
});
