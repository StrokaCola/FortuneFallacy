// Quorum: if this hand is the same combo type as the previous hand, ×1.5
// chips. If 3rd or later in a row, also ×1.5 mult.
//
// `comboStreak` is updated AFTER scoring (roll.ts SCORE_HAND), so its value
// here is for the PREVIOUS hand. The current hand "matches" iff its detected
// combo equals `lastComboId`. We treat streak >= 2 (this would be the 3rd)
// as the mult-bonus threshold.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const CHIPS_MULT = 1.5;
const MULT_MULT = 1.5;
const MULT_THRESHOLD = 2; // prev streak ≥2 → this is the 3rd in a row

register({
  id: 'quorum',
  phase: Phase.UPGRADES,
  priority: 110,
  apply: (ctx) => {
    const comboId = ctx.combo?.id;
    if (!comboId) return ctx;
    if (ctx.state.run.lastComboId !== comboId) return ctx;

    const newChips = ctx.chips * CHIPS_MULT;
    const prevStreak = ctx.state.run.comboStreak ?? 1;
    const applyMultBonus = prevStreak >= MULT_THRESHOLD;
    const newMult = applyMultBonus ? ctx.mult * MULT_MULT : ctx.mult;

    return {
      ...ctx,
      chips: newChips,
      mult: newMult,
      events: emitUpgrade(ctx, 'quorum', newChips - ctx.chips, newMult - ctx.mult),
    };
  },
});
