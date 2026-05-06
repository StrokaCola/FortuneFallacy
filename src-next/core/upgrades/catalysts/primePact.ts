// Prime Pact: each scoring 2/3/5 grants +2 chips. Reads from the scoring
// set only (same shape as Six Bias / Iron Six).
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const PRIMES = new Set([2, 3, 5]);
const CHIPS_PER_PRIME = 2;

register({
  id: 'prime_pact',
  phase: Phase.UPGRADES,
  priority: 12,
  apply: (ctx) => {
    const faces = ctx.sim?.finalFaces ?? [];
    const order = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    const scoringFaces = order
      .filter((idx) => idx >= 0 && idx < faces.length)
      .map((i) => faces[i]!);
    const primes = scoringFaces.filter((f) => PRIMES.has(f)).length;
    if (primes === 0) return ctx;
    const delta = primes * CHIPS_PER_PRIME;
    return {
      ...ctx,
      chips: ctx.chips + delta,
      events: emitUpgrade(ctx, 'prime_pact', delta, 0),
    };
  },
});
