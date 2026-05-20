// Stargazer — +1 mult per distinct face value seen this run (uncapped).
// Codex-completion reward. Tracks faces via run.catalystStacks
// (overloads the field to store a packed "seen-face bitset" as a
// stack count: each bit position = a face value).
//
// Packing scheme: face values 1..12 each occupy one bit. catalystStacks
// stores the integer value of the bitset. On each scoring hand we OR
// in the bits for the scored faces, then count set bits. The OR
// + popcount happens inside the apply function so existing scaling
// hooks (accrueBlindCleared) don't need to know about this catalyst.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

function popcount(n: number): number {
  let c = 0;
  while (n) { c += n & 1; n >>>= 1; }
  return c;
}

register({
  id: 'stargazer',
  phase: Phase.UPGRADES,
  priority: 90,
  apply: (ctx) => {
    const faces: number[] = ctx.sim?.finalFaces ?? [];
    const order: number[] = ctx.state.round.scoringOrder ?? faces.map((_, i) => i);
    const scoringFaces = order
      .filter((idx: number) => idx >= 0 && idx < faces.length)
      .map((i: number) => faces[i]!)
      .filter((f: number) => typeof f === 'number' && f > 0 && f <= 31);
    const prevBitset = ctx.state.run.catalystStacks?.stargazer ?? 0;
    let nextBitset = prevBitset;
    for (const f of scoringFaces) nextBitset |= (1 << (f - 1));
    const distinct = popcount(nextBitset);
    if (distinct === 0) return ctx;
    // Persist the updated bitset back so the next hand inherits the
    // accumulated face history.
    return {
      ...ctx,
      mult: ctx.mult + distinct,
      state: {
        ...ctx.state,
        run: {
          ...ctx.state.run,
          catalystStacks: {
            ...(ctx.state.run.catalystStacks ?? {}),
            stargazer: nextBitset,
          },
        },
      },
      events: emitUpgrade(ctx, 'stargazer', 0, distinct),
    };
  },
});
