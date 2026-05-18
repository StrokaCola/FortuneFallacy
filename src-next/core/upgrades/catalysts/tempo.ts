// Tempo: each consecutive hand of strictly higher combo tier than previous
// adds +0.4× mult (multiplicative), capping at ×3.5. Streak resets when the
// player ties or drops in tier.
//
// 2026-05-18 balance audit tuning: per-streak rate 0.5→0.4 and cap 3.0→3.5
// to extend the ramp. Prior values capped at streak=4 (hand 5), turning
// Tempo into dead weight by Ante 2. New values cap at streak≈6.25 (hand
// 7+) so the catalyst maintains presence across the full run.
//
// `tempoStreak` represents the streak EXCLUDING the current hand (it's
// updated AFTER scoring, in roll.ts SCORE_HAND via updateComboStreaks).
// So if streak = 2, this is the 3rd consecutive ascending hand and we
// multiply by 1 + 0.4*2 = 1.8.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const PER_STREAK = 0.4;
const CAP = 3.5;

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
