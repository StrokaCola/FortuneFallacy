// Piggy Bank (2026-05-18 audit add): economy uncommon. Banks 10% of
// the hand's chips into shards at score time, capped at +5 shards per
// hand. Pure chip → shard conversion lane — sustains shop access for
// chip-heavy builds that otherwise can't keep up with shop pricing.
//
// Priority 250 — runs at the very tail of UPGRADES so it sees the
// fully-built chip total (after First Strike, Lucky Streak, etc.).
// Mutates ctx.state.run.shards directly; the SCORE_HAND committer
// flushes the new ctx.state when the pipeline completes.

import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const SKIM_RATE = 0.10;
const PER_HAND_CAP = 5;

register({
  id: 'piggy_bank',
  phase: Phase.UPGRADES,
  priority: 250,
  apply: (ctx) => {
    if (ctx.chips <= 0) return ctx;
    const skim = Math.min(PER_HAND_CAP, Math.floor(ctx.chips * SKIM_RATE));
    if (skim <= 0) return ctx;
    return {
      ...ctx,
      state: {
        ...ctx.state,
        run: { ...ctx.state.run, shards: ctx.state.run.shards + skim },
      },
      // No chip/mult delta — Piggy Bank moves value from chips into
      // shards rather than amplifying the hand. Event emitted with
      // zero deltas so the CatalystStrip still pulses the card.
      events: emitUpgrade(ctx, 'piggy_bank', 0, 0),
    };
  },
});
