import { describe, it, expect } from 'vitest';
import './compoundingBias';
import { getAll } from '../registry';
import type { PipelineCtx } from '../../pipeline/types';
import type { GameState } from '../../../state/store';
import { mulberry32 } from '../../rng';

function makeCtx(overrides: Partial<{ mult: number; runCompoundingStacks: number }> = {}): PipelineCtx {
  const state = {
    run: { compoundingStacks: overrides.runCompoundingStacks ?? 0 },
  } as unknown as GameState;
  return {
    state,
    chips: 0,
    mult: overrides.mult ?? 10,
    total: 0,
    events: [],
    rng: mulberry32(0),
  };
}

describe('compounding_bias catalyst', () => {
  it('returns ctx unchanged when stacks = 0', () => {
    const def = getAll().find((u) => u.id === 'compounding_bias')!;
    const ctx = makeCtx({ runCompoundingStacks: 0, mult: 10 });
    const next = def.apply(ctx);
    expect(next.mult).toBe(10);
    expect(next.events.length).toBe(0);
  });

  it('multiplies mult by 1.15 when stacks = 3', () => {
    const def = getAll().find((u) => u.id === 'compounding_bias')!;
    const ctx = makeCtx({ runCompoundingStacks: 3, mult: 10 });
    const next = def.apply(ctx);
    expect(next.mult).toBeCloseTo(11.5);
  });

  it('emits onUpgradeTriggered when active', () => {
    const def = getAll().find((u) => u.id === 'compounding_bias')!;
    const ctx = makeCtx({ runCompoundingStacks: 1, mult: 10 });
    const next = def.apply(ctx);
    expect(next.events).toHaveLength(1);
    expect(next.events[0]?.type).toBe('onUpgradeTriggered');
  });
});
