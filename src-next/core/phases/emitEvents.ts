import type { PhaseFn } from '../pipeline/types';

export const emitEvents: PhaseFn = (ctx) => {
  const events = [...ctx.events];
  if (ctx.combo) {
    events.push({ type: 'onComboDetected', payload: { combo: ctx.combo.id, tier: ctx.combo.tier } });
  }
  events.push({
    type: 'onScoreCalculated',
    payload: {
      combo: ctx.combo?.id ?? 'unknown',
      chips: ctx.chips,
      mult: ctx.mult,
      total: ctx.total,
    },
  });
  return { ...ctx, events };
};
