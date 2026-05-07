import { describe, it, expect } from 'vitest';
import { metaHandler } from './meta';
import { roundHandler } from './round';
import { rollHandler } from './roll';
import type { GameState } from '../../state/store';
import { initialRunSlice } from '../../state/slices/run';
import { initialRoundSlice } from '../../state/slices/round';
import { initialShopSlice } from '../../state/slices/shop';
import { initialMetaSlice } from '../../state/slices/meta';
import { initialUiSlice } from '../../state/slices/ui';

const buildState = (over: Partial<GameState> = {}): GameState => ({
  run: { ...initialRunSlice(), seed: 12345 },
  round: { ...initialRoundSlice() },
  shop: initialShopSlice(),
  meta: initialMetaSlice(),
  ui: { ...initialUiSlice(), screen: 'round' },
  pingCount: 0,
  ...over,
} as GameState);

describe('Cosmic Dust — earn on bust', () => {
  it('grants 1 + goalIdx dust on bust and emits onDustEarned', () => {
    const before = buildState({
      run: { ...initialRunSlice(), goalIdx: 3 }, // partway through ante 2
    });
    const r = roundHandler({ type: 'BUST_BLIND' }, before);
    expect(r.state.meta.cosmicDust).toBe(1 + 3);
    expect(r.state.meta.cosmicDustLifetime).toBe(1 + 3);
    const dustEvent = r.events.find((e) => e.type === 'onDustEarned');
    expect(dustEvent).toBeDefined();
    expect((dustEvent as { payload: { reason: string } }).payload.reason).toBe('bust');
  });

  it('preserves existing dust totals across busts', () => {
    const before = buildState({
      run: { ...initialRunSlice(), goalIdx: 0 },
      meta: { ...initialMetaSlice(), cosmicDust: 50, cosmicDustLifetime: 200 },
    });
    const r = roundHandler({ type: 'BUST_BLIND' }, before);
    expect(r.state.meta.cosmicDust).toBe(51);
    expect(r.state.meta.cosmicDustLifetime).toBe(201);
  });
});

describe('BUY_ASTRAL_PERK', () => {
  it('debits dust and adds the perk to astralPerks', () => {
    const before = buildState({
      meta: { ...initialMetaSlice(), cosmicDust: 100, cosmicDustLifetime: 100 },
    });
    const r = metaHandler({ type: 'BUY_ASTRAL_PERK', perkId: 'morning_star' }, before);
    expect(r.state.meta.cosmicDust).toBe(100 - 25);
    expect(r.state.meta.astralPerks).toContain('morning_star');
    // Lifetime is the running total of EARNED dust — purchases don't decrement it.
    expect(r.state.meta.cosmicDustLifetime).toBe(100);
    expect(r.events[0]?.type).toBe('onAstralPerkBought');
  });

  it('rejects when affordability check fails', () => {
    const before = buildState({
      meta: { ...initialMetaSlice(), cosmicDust: 5 },
    });
    const r = metaHandler({ type: 'BUY_ASTRAL_PERK', perkId: 'morning_star' }, before);
    expect(r.state.meta.cosmicDust).toBe(5);
    expect(r.state.meta.astralPerks).toEqual([]);
    expect(r.events).toHaveLength(0);
  });

  it('rejects when perk already owned (no double-buy)', () => {
    const before = buildState({
      meta: { ...initialMetaSlice(), cosmicDust: 100, astralPerks: ['morning_star'] },
    });
    const r = metaHandler({ type: 'BUY_ASTRAL_PERK', perkId: 'morning_star' }, before);
    expect(r.state.meta.cosmicDust).toBe(100); // unchanged
    expect(r.state.meta.astralPerks).toEqual(['morning_star']);
  });

  it('rejects unknown perk ids silently', () => {
    const before = buildState({
      meta: { ...initialMetaSlice(), cosmicDust: 1000 },
    });
    const r = metaHandler({ type: 'BUY_ASTRAL_PERK', perkId: 'nonexistent_perk' }, before);
    expect(r.state.meta.cosmicDust).toBe(1000);
    expect(r.state.meta.astralPerks).toEqual([]);
  });
});

describe('NEW_RUN applies astral perks', () => {
  it('starting shards perk shows up on the fresh run', () => {
    const before = buildState({
      meta: { ...initialMetaSlice(), astralPerks: ['morning_star'] },
    });
    const r = roundHandler({ type: 'NEW_RUN', constellationId: 'lyra' }, before);
    // morning_star: +2 shards starting (Lyra has no constellation startingShards)
    expect(r.state.run.shards).toBe(2);
  });

  it('without perks, starting shards are 0 (Lyra default)', () => {
    const r = roundHandler({ type: 'NEW_RUN', constellationId: 'lyra' }, buildState());
    expect(r.state.run.shards).toBe(0);
  });
});

// Avoid unused import lint
void rollHandler;
