// Tetrad: Four of a Kind → chips ×3.
//
// 2026-05-16 — "contains" semantics. Five of a Kind also contains a
// Four of a Kind (XXXXX trivially has four of one value), so Tetrad
// now fires on 5oak as well.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';
import { comboContains } from '../../scoring/comboContains';

register({
  id: 'tetrad',
  phase: Phase.UPGRADES,
  priority: 105,
  apply: (ctx) => {
    if (!comboContains(ctx.combo?.id, 'four_kind')) return ctx;
    const newChips = ctx.chips * 3;
    return {
      ...ctx,
      chips: newChips,
      events: emitUpgrade(ctx, 'tetrad', newChips - ctx.chips, 0),
    };
  },
});
