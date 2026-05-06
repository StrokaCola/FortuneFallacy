// Tetrad: Four of a Kind → chips ×3.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

register({
  id: 'tetrad',
  phase: Phase.UPGRADES,
  priority: 105,
  apply: (ctx) => {
    if (ctx.combo?.id !== 'four_kind') return ctx;
    const newChips = ctx.chips * 3;
    return {
      ...ctx,
      chips: newChips,
      events: emitUpgrade(ctx, 'tetrad', newChips - ctx.chips, 0),
    };
  },
});
