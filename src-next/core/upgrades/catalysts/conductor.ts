// Conductor: if all 5 dice are scoring (full hand), award +20 chips × number
// of distinct mod IDs present across the scoring dice.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const PER_DISTINCT_MOD = 20;
const FULL_HAND = 5;

register({
  id: 'conductor',
  phase: Phase.UPGRADES,
  priority: 25,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    const scoringDice = order.filter((idx) => idx >= 0 && idx < faces.length);
    if (scoringDice.length < FULL_HAND) return ctx;
    const distinct = new Set<string>();
    for (const idx of scoringDice) {
      for (const id of ctx.state.run.diceMods[idx] ?? []) {
        distinct.add(id);
      }
    }
    if (distinct.size === 0) return ctx;
    const dChips = distinct.size * PER_DISTINCT_MOD;
    return {
      ...ctx,
      chips: ctx.chips + dChips,
      events: emitUpgrade(ctx, 'conductor', dChips, 0),
    };
  },
});
