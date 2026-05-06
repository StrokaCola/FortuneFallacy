// All-Band (legendary): once per round, the played hand scores as if it
// were the next-tier-higher combo. Promotes the *base* values; downstream
// catalyst gates that read combo.id continue to see the original combo,
// so this never accidentally satisfies a Stratifier (Full House) gate
// from a Two Pair hand. Only the chips/mult delta is added to ctx.
//
// Marks `round.allBandUsedThisRound = true` after firing — `initialRoundSlice()`
// resets that flag at the start of every blind via the round transition.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { COMBOS } from '../../scoring/combos';
import { emitUpgrade } from './_helpers';

// Map current combo id → { current raw, next raw } for tier-up math. Built
// once from COMBOS. Reading raw COMBOS table values (not ctx.combo.baseChips)
// avoids double-counting Galaxy levels — the player's Whirlpool investment
// stays attached to Three of a Kind, not the upgraded tier.
const TIER_UP_DELTA: Record<string, { chips: number; mult: number } | undefined> = (() => {
  const out: Record<string, { chips: number; mult: number } | undefined> = {};
  for (const c of COMBOS) {
    const next = COMBOS.find((x) => x.tier === c.tier + 1);
    out[c.id] = next
      ? { chips: next.chips - c.chips, mult: next.mult - c.mult }
      : undefined;
  }
  return out;
})();

register({
  id: 'all_band',
  phase: Phase.UPGRADES,
  // Late priority so the tier-up base bonus rides on top of any early
  // single-effect catalysts but BEFORE the multiplicative finishers.
  priority: 130,
  apply: (ctx) => {
    if (!ctx.combo) return ctx;
    if (ctx.state.round.allBandUsedThisRound) return ctx;
    const delta = TIER_UP_DELTA[ctx.combo.id];
    if (!delta) return ctx; // already at top tier (Five of a Kind)

    return {
      ...ctx,
      chips: ctx.chips + delta.chips,
      mult: ctx.mult + delta.mult,
      state: {
        ...ctx.state,
        round: { ...ctx.state.round, allBandUsedThisRound: true },
      },
      events: emitUpgrade(ctx, 'all_band', delta.chips, delta.mult),
    };
  },
});
