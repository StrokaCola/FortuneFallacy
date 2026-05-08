import { describe, it, expect } from 'vitest';
import { sellTriggerFor, SELL_TRIGGERS } from './sellTriggers';
import { initialRunSlice } from '../../state/slices/run';
import { initialRoundSlice } from '../../state/slices/round';
import { initialShopSlice } from '../../state/slices/shop';
import { initialMetaSlice } from '../../state/slices/meta';
import { initialUiSlice } from '../../state/slices/ui';
import type { GameState } from '../../state/store';

function baseState(overrides: Partial<{ shards: number; compoundingStacks: number }> = {}): GameState {
  return {
    run: {
      ...initialRunSlice(),
      shards: overrides.shards ?? 0,
      compoundingStacks: overrides.compoundingStacks ?? 0,
    },
    round: initialRoundSlice(),
    shop: initialShopSlice(),
    meta: initialMetaSlice(),
    ui: initialUiSlice(),
    pingCount: 0,
  } as unknown as GameState;
}

describe('sell triggers', () => {
  it('returns undefined for catalysts with no trigger', () => {
    expect(sellTriggerFor('stratifier')).toBeUndefined();
  });

  it('stipend on sell grants 5 shards', () => {
    const s = baseState({ shards: 10 });
    const delta = SELL_TRIGGERS['stipend']!.apply(s);
    expect(delta.shards).toBe(15);
  });

  it('audit on sell grants 20 shards', () => {
    const s = baseState({ shards: 0 });
    const delta = SELL_TRIGGERS['audit']!.apply(s);
    expect(delta.shards).toBe(20);
  });

  it('compounding_bias on sell grants 3 shards per stack and zeros stacks', () => {
    const s = baseState({ shards: 5, compoundingStacks: 4 });
    const delta = SELL_TRIGGERS['compounding_bias']!.apply(s);
    expect(delta.shards).toBe(5 + 12);
    expect(delta.compoundingStacks).toBe(0);
  });

  it('compounding_bias with zero stacks pays nothing', () => {
    const s = baseState({ shards: 5, compoundingStacks: 0 });
    const delta = SELL_TRIGGERS['compounding_bias']!.apply(s);
    expect(delta.shards).toBe(5);
    expect(delta.compoundingStacks).toBe(0);
  });
});
