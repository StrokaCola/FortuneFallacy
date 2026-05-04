import { describe, it, expect } from 'vitest';
import { shopHandler } from './shop';
import { diceHandler } from './dice';
import { initialRoundSlice } from '../../state/slices/round';
import { initialRunSlice } from '../../state/slices/run';
import type { GameState } from '../../state/store';
import type { ShopOffer } from '../../events/types';

const baseState = (overrides?: Partial<{ shards: number; ownedMods: string[]; offers: ShopOffer[]; rerollCost: number; open: boolean }>): GameState => ({
  run: { ...initialRunSlice(), shards: overrides?.shards ?? 100, ownedMods: overrides?.ownedMods ?? [] },
  round: { ...initialRoundSlice() },
  shop: {
    open: overrides?.open ?? true,
    offers: overrides?.offers ?? [],
    rerollCost: overrides?.rerollCost ?? 3,
  },
  meta: { playerName: '', highScores: [] },
  ui: { screen: 'shop', paused: false, tooltip: null, transition: 'idle' },
} as unknown as GameState);

describe('OPEN_SHOP', () => {
  it('seeds rerollCost at 3 (base reroll cost)', () => {
    const s = baseState({ open: false });
    const r = shopHandler({ type: 'OPEN_SHOP' }, s);
    expect(r.state.shop.rerollCost).toBe(3);
  });

  it('includes a mod offer in the rolled offers', () => {
    const s = baseState({ open: false });
    const r = shopHandler({ type: 'OPEN_SHOP' }, s);
    const modOffers = r.state.shop.offers.filter((o) => o.kind === 'mod');
    expect(modOffers.length).toBeGreaterThanOrEqual(1);
  });
});

describe('REROLL_SHOP', () => {
  it('subtracts rerollCost shards and bumps rerollCost by 1', () => {
    const s = baseState({ shards: 10, rerollCost: 3 });
    const r = shopHandler({ type: 'REROLL_SHOP' }, s);
    expect(r.state.run.shards).toBe(7);
    expect(r.state.shop.rerollCost).toBe(4);
  });

  it('no-ops if shards < rerollCost', () => {
    const s = baseState({ shards: 2, rerollCost: 3 });
    const r = shopHandler({ type: 'REROLL_SHOP' }, s);
    expect(r.state.run.shards).toBe(2);
    expect(r.state.shop.rerollCost).toBe(3);
  });

  it('no-ops if shop is closed', () => {
    const s = baseState({ shards: 10, open: false, rerollCost: 3 });
    const r = shopHandler({ type: 'REROLL_SHOP' }, s);
    expect(r.state).toBe(s);
  });

  it('replaces offers on successful reroll', () => {
    const s = baseState({ shards: 10, rerollCost: 3, offers: [{ kind: 'catalyst', id: 'compounding_bias', price: 5 }] });
    const r = shopHandler({ type: 'REROLL_SHOP' }, s);
    expect(r.state.shop.offers).not.toBe(s.shop.offers);
  });
});

describe('BUY_OFFER kind=mod', () => {
  it('adds the mod id to run.ownedMods + subtracts shards', () => {
    const offers: ShopOffer[] = [{ kind: 'mod', id: 'amplify', price: 4 }];
    const s = baseState({ shards: 10, offers });
    const r = shopHandler({ type: 'BUY_OFFER', offerIdx: 0 }, s);
    expect(r.state.run.ownedMods).toEqual(['amplify']);
    expect(r.state.run.shards).toBe(6);
    expect(r.state.shop.offers).toEqual([]);
  });

  it('rejects when shards insufficient', () => {
    const offers: ShopOffer[] = [{ kind: 'mod', id: 'amplify', price: 10 }];
    const s = baseState({ shards: 2, offers });
    const r = shopHandler({ type: 'BUY_OFFER', offerIdx: 0 }, s);
    expect(r.state).toBe(s);
  });
});

describe('ATTACH_MOD with ownedMods inventory', () => {
  it('consumes one instance from ownedMods on attach', () => {
    const s = baseState({ ownedMods: ['amplify', 'sharpened'] });
    const r = diceHandler({ type: 'ATTACH_MOD', dieIdx: 0, modId: 'amplify' }, s);
    expect(r.state.run.ownedMods).toEqual(['sharpened']);
    expect(r.state.run.diceMods[0]).toEqual(['amplify']);
  });

  it('rejects attach when player does not own the mod', () => {
    const s = baseState({ ownedMods: ['sharpened'] });
    const r = diceHandler({ type: 'ATTACH_MOD', dieIdx: 0, modId: 'amplify' }, s);
    expect(r.state).toBe(s);
  });

  it('keeps duplicates separate (own 2 amplifies, attach 1 leaves 1)', () => {
    const s = baseState({ ownedMods: ['amplify', 'amplify'] });
    const r = diceHandler({ type: 'ATTACH_MOD', dieIdx: 0, modId: 'amplify' }, s);
    expect(r.state.run.ownedMods).toEqual(['amplify']);
  });
});

describe('DETACH_MOD returns to inventory', () => {
  it('returns the detached mod id to ownedMods', () => {
    const s = baseState({ ownedMods: [] });
    // Simulate already-attached mod by hand-setting diceMods (now on run slice).
    const sWithAttached = { ...s, run: { ...s.run, diceMods: [['amplify'], [], [], [], []] } };
    const r = diceHandler({ type: 'DETACH_MOD', dieIdx: 0, modIdx: 0 }, sWithAttached);
    expect(r.state.run.ownedMods).toEqual(['amplify']);
    expect(r.state.run.diceMods[0]).toEqual([]);
  });
});
