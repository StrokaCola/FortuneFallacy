import { describe, it, expect } from 'vitest';
import { resolveEventChoice } from './resolveEvent';
import { lookupEvent } from '../../data/events';
import { initialRunSlice } from '../../state/slices/run';
import { initialRoundSlice } from '../../state/slices/round';
import { initialShopSlice } from '../../state/slices/shop';
import { initialMetaSlice } from '../../state/slices/meta';
import { initialUiSlice } from '../../state/slices/ui';
import type { GameState } from '../../state/store';

function mkState(overrides: Partial<GameState['run']> = {}): GameState {
  return {
    run: { ...initialRunSlice(), shards: 20, ante: 2, goalIdx: 3, ...overrides },
    round: initialRoundSlice(),
    shop: initialShopSlice(),
    meta: initialMetaSlice(),
    ui: { ...initialUiSlice(), screen: 'event' },
    pingCount: 0,
  };
}

describe('resolveEventChoice (Pillar C)', () => {
  it('advances goalIdx by 1 on a no-op choice', () => {
    const ev = lookupEvent('wandering_oracle')!;
    const s = mkState({ goalIdx: 3 });
    // Choice 1 is "Walk past" with empty effects array.
    const r = resolveEventChoice(s, ev, 1);
    expect(r.state.run.goalIdx).toBe(4);
    expect(r.state.ui.screen).toBe('hub');
  });

  it('applies shard cost and shard reward correctly', () => {
    const ev = lookupEvent('coin_pilgrim')!;
    const s = mkState({ shards: 10 });
    // Choice 0: "Take the bet" — costs 3, grants 8 → net +5.
    const r = resolveEventChoice(s, ev, 0);
    expect(r.state.run.shards).toBe(15);
  });

  it('rejects a choice the player cannot afford', () => {
    const ev = lookupEvent('coin_pilgrim')!;
    const s = mkState({ shards: 2 }); // costs 3 — unaffordable
    const r = resolveEventChoice(s, ev, 0);
    expect(r.state.run.shards).toBe(2);
    expect(r.state.run.goalIdx).toBe(s.run.goalIdx); // unchanged
  });

  it('grants cosmic dust when chosen', () => {
    const ev = lookupEvent('wandering_oracle')!;
    const s = mkState({ shards: 10 });
    // Choice 0 grants a consumable + 4 dust.
    const r = resolveEventChoice(s, ev, 0);
    expect(r.state.meta.cosmicDust ?? 0).toBeGreaterThanOrEqual(4);
    expect(r.state.meta.cosmicDustLifetime ?? 0).toBeGreaterThanOrEqual(4);
  });

  it('grants a random catalyst (Mirror Pool free option)', () => {
    const ev = lookupEvent('mirror_pool')!;
    const s = mkState({ catalysts: [] });
    // Choice 0: free common catalyst.
    const r = resolveEventChoice(s, ev, 0);
    expect(r.state.run.catalysts.length).toBe(1);
  });

  it('returns to hub on resolve', () => {
    const ev = lookupEvent('lost_die')!;
    const r = resolveEventChoice(mkState(), ev, 0);
    expect(r.state.ui.screen).toBe('hub');
  });

  it('returns state unchanged on an out-of-range choice index', () => {
    const ev = lookupEvent('lost_die')!;
    const s = mkState();
    const r = resolveEventChoice(s, ev, 99);
    expect(r.state).toBe(s);
  });
});
