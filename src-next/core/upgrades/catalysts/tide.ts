// Tide: alternating Ebb / Flow per hand. Stacks accumulate every full cycle.
//   stacks = floor(handsPlayed / 2)  — one stack per ebb+flow pair
//   ebb hand (handsPlayed even after THIS increment → odd before): +stacks chips
//   flow hand (next):                                                +stacks mult
//
// Reads handsPlayed (already-played count). The hand being scored RIGHT NOW
// hasn't incremented handsPlayed yet (that happens in roll.ts AFTER the
// pipeline). So:
//   handsPlayed === 0 → this is hand #1 (ebb)
//   handsPlayed === 1 → this is hand #2 (flow)
//   handsPlayed === 2 → this is hand #3 (ebb)
//
// The chip pool is just `stacks` (capped at a sensible number), kept tight
// so a 4-blind run with Tide doesn't dwarf other catalysts.
import { register } from '../registry';
import { Phase } from '../../pipeline/types';
import { emitUpgrade } from './_helpers';

const CHIPS_PER_STACK = 8;
const MULT_PER_STACK = 0.4;

register({
  id: 'tide',
  phase: Phase.UPGRADES,
  priority: 90,
  apply: (ctx) => {
    const handsPlayed = ctx.state.run.handsPlayed ?? 0;
    const stacks = Math.floor(handsPlayed / 2) + 1; // +1 so first cycle still pays
    const isEbb = handsPlayed % 2 === 0;
    if (isEbb) {
      const delta = stacks * CHIPS_PER_STACK;
      return {
        ...ctx,
        chips: ctx.chips + delta,
        events: emitUpgrade(ctx, 'tide', delta, 0),
      };
    }
    const dMult = stacks * MULT_PER_STACK;
    return {
      ...ctx,
      mult: ctx.mult + dMult,
      events: emitUpgrade(ctx, 'tide', 0, dMult),
    };
  },
});
