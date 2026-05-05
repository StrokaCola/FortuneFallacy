import { describe, it, expect } from 'vitest';
import { shopHandler } from './shop';
import { diceHandler } from './dice';
import { initialRoundSlice } from '../../state/slices/round';
import { initialRunSlice } from '../../state/slices/run';
import type { GameState } from '../../state/store';
import type { ShopOffer } from '../../events/types';

type Overrides = Partial<{
  shards: number;
  ownedMods: string[];
  catalysts: string[];
  vouchers: string[];
  consumables: string[];
  diceMods: string[][];
  offers: ShopOffer[];
  rerollCost: number;
  open: boolean;
}>;

const baseState = (overrides?: Overrides): GameState => ({
  run: {
    ...initialRunSlice(),
    shards: overrides?.shards ?? 100,
    ownedMods: overrides?.ownedMods ?? [],
    catalysts: overrides?.catalysts ?? [],
    vouchers: overrides?.vouchers ?? [],
    consumables: overrides?.consumables ?? [],
    ...(overrides?.diceMods ? { diceMods: overrides.diceMods } : {}),
  },
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

describe('SELL_UPGRADE kind=catalyst', () => {
  it('refunds 2 shards and removes the catalyst at index', () => {
    const s = baseState({ shards: 0, catalysts: ['stratifier', 'chaos_theory'] });
    const r = shopHandler({ type: 'SELL_UPGRADE', kind: 'catalyst', index: 1 }, s);
    expect(r.state.run.shards).toBe(2);
    expect(r.state.run.catalysts).toEqual(['stratifier']);
    expect(r.events).toEqual([{ type: 'onUpgradeSold', payload: { kind: 'catalyst', id: 'chaos_theory', refund: 2 } }]);
  });

  it('no-ops when index is out of range', () => {
    const s = baseState({ shards: 0, catalysts: ['stratifier'] });
    const r = shopHandler({ type: 'SELL_UPGRADE', kind: 'catalyst', index: 5 }, s);
    expect(r.state).toBe(s);
  });
});

describe('SELL_UPGRADE kind=mod', () => {
  it('refunds 2 shards and removes from ownedMods only', () => {
    const s = baseState({ shards: 1, ownedMods: ['amplify', 'sharpened'] });
    const r = shopHandler({ type: 'SELL_UPGRADE', kind: 'mod', index: 0 }, s);
    expect(r.state.run.shards).toBe(3);
    expect(r.state.run.ownedMods).toEqual(['sharpened']);
  });

  it('does not affect attached diceMods', () => {
    const s = baseState({ ownedMods: ['amplify'], diceMods: [['sharpened'], [], [], [], []] });
    const r = shopHandler({ type: 'SELL_UPGRADE', kind: 'mod', index: 0 }, s);
    expect(r.state.run.ownedMods).toEqual([]);
    expect(r.state.run.diceMods[0]).toEqual(['sharpened']);
  });
});

describe('SELL_UPGRADE kind=consumable', () => {
  it('refunds 1 shard and removes the consumable at index', () => {
    const s = baseState({ shards: 0, consumables: ['shard_drop', 'pin_six'] });
    const r = shopHandler({ type: 'SELL_UPGRADE', kind: 'consumable', index: 0 }, s);
    expect(r.state.run.shards).toBe(1);
    expect(r.state.run.consumables).toEqual(['pin_six']);
  });
});

describe('SELL_UPGRADE kind=voucher', () => {
  it('refunds floor(price/2) for free_refresh (price 8 → refund 4)', () => {
    const s = baseState({ shards: 0, vouchers: ['free_refresh'] });
    const r = shopHandler({ type: 'SELL_UPGRADE', kind: 'voucher', index: 0 }, s);
    expect(r.state.run.shards).toBe(4);
    expect(r.state.run.vouchers).toEqual([]);
  });

  it('refunds floor(price/2) for shard_streak (price 6 → refund 3)', () => {
    const s = baseState({ shards: 0, vouchers: ['shard_streak'] });
    const r = shopHandler({ type: 'SELL_UPGRADE', kind: 'voucher', index: 0 }, s);
    expect(r.state.run.shards).toBe(3);
  });

  it('blocks selling bench when catalysts would exceed the post-sell cap', () => {
    const cats = ['stratifier', 'chaos_theory', 'six_bias', 'twin_sample', 'cold_hand', 'entropy_index', 'compounding_bias'];
    const s = baseState({ shards: 0, vouchers: ['bench'], catalysts: cats });
    const r = shopHandler({ type: 'SELL_UPGRADE', kind: 'voucher', index: 0 }, s);
    expect(r.state).toBe(s);
  });

  it('allows selling bench when catalysts fit the post-sell cap', () => {
    const s = baseState({ shards: 0, vouchers: ['bench'], catalysts: ['stratifier'] });
    const r = shopHandler({ type: 'SELL_UPGRADE', kind: 'voucher', index: 0 }, s);
    expect(r.state.run.vouchers).toEqual([]);
    expect(r.state.run.shards).toBe(4);
  });

  it('blocks selling forged_links when any die has 3 attached mods', () => {
    const s = baseState({
      vouchers: ['forged_links'],
      diceMods: [['amplify', 'sharpened', 'sharpened'], [], [], [], []],
      ownedMods: [],
    });
    const r = shopHandler({ type: 'SELL_UPGRADE', kind: 'voucher', index: 0 }, s);
    expect(r.state).toBe(s);
  });

  it('blocks selling capacity when consumables would exceed cap', () => {
    const s = baseState({
      vouchers: ['capacity'],
      consumables: ['shard_drop', 'shard_drop', 'shard_drop', 'shard_drop', 'shard_drop'],
    });
    const r = shopHandler({ type: 'SELL_UPGRADE', kind: 'voucher', index: 0 }, s);
    expect(r.state).toBe(s);
  });
});
