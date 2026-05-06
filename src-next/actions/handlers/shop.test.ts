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
  meta: { playerName: '', highScores: [], unlocks: [] },
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

describe('Galaxy packs — buy + open', () => {
  it('buying a Celestial Pack debits price, removes offer, opens pendingPack with showCount=2 picks=1', () => {
    const offers: ShopOffer[] = [{ kind: 'pack', id: 'celestial', price: 4 }];
    const s = baseState({ shards: 10, offers });
    const r = shopHandler({ type: 'BUY_OFFER', offerIdx: 0 }, s);
    expect(r.state.run.shards).toBe(6);
    expect(r.state.shop.offers).toEqual([]);
    expect(r.state.shop.pendingPack).not.toBeNull();
    expect(r.state.shop.pendingPack!.kind).toBe('celestial');
    expect(r.state.shop.pendingPack!.galaxyIds.length).toBe(2);
    expect(r.state.shop.pendingPack!.picksLeft).toBe(1);
    expect(r.state.shop.pendingPack!.pickedSoFar).toEqual([]);
  });

  it('buying a Galactic Pack opens with showCount=4 picks=2', () => {
    const offers: ShopOffer[] = [{ kind: 'pack', id: 'galactic', price: 8 }];
    const s = baseState({ shards: 10, offers });
    const r = shopHandler({ type: 'BUY_OFFER', offerIdx: 0 }, s);
    expect(r.state.shop.pendingPack!.galaxyIds.length).toBe(4);
    expect(r.state.shop.pendingPack!.picksLeft).toBe(2);
  });

  it('opening a pack adds rolled galaxy ids to meta.unlocks', () => {
    const offers: ShopOffer[] = [{ kind: 'pack', id: 'celestial', price: 4 }];
    const s = baseState({ shards: 10, offers });
    const r = shopHandler({ type: 'BUY_OFFER', offerIdx: 0 }, s);
    for (const gid of r.state.shop.pendingPack!.galaxyIds) {
      expect(r.state.meta.unlocks).toContain(gid);
    }
  });

  it('emits onPackOpened + onGalaxyDiscovered events', () => {
    const offers: ShopOffer[] = [{ kind: 'pack', id: 'celestial', price: 4 }];
    const s = baseState({ shards: 10, offers });
    const r = shopHandler({ type: 'BUY_OFFER', offerIdx: 0 }, s);
    const types = r.events.map((e) => e.type);
    expect(types).toContain('onOfferBought');
    expect(types).toContain('onPackOpened');
    expect(types.filter((t) => t === 'onGalaxyDiscovered').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects buying when shards insufficient', () => {
    const offers: ShopOffer[] = [{ kind: 'pack', id: 'celestial', price: 4 }];
    const s = baseState({ shards: 2, offers });
    const r = shopHandler({ type: 'BUY_OFFER', offerIdx: 0 }, s);
    expect(r.state).toBe(s);
  });
});

describe('Galaxy packs — picking', () => {
  it('PICK_FROM_PACK applies the galaxy (increments comboLevels) and decrements picksLeft', () => {
    // Manually seed a pendingPack with known galaxy ids so the test is deterministic.
    const s = baseState({ shards: 0 });
    const sWithPack = {
      ...s,
      shop: {
        ...s.shop,
        pendingPack: {
          kind: 'stellar',
          galaxyIds: ['galaxy_whirlpool', 'galaxy_andromeda', 'galaxy_milky_way'],
          picksLeft: 1,
          pickedSoFar: [] as string[],
        },
      },
    };
    const r = shopHandler({ type: 'PICK_FROM_PACK', galaxyIdx: 0 }, sWithPack);
    // Pack should close (picksLeft was 1).
    expect(r.state.shop.pendingPack).toBeNull();
    expect(r.state.run.comboLevels.three_kind).toBe(1);
    const types = r.events.map((e) => e.type);
    expect(types).toContain('onGalaxyUsed');
    expect(types).toContain('onPackPicked');
    expect(types).toContain('onPackClosed');
  });

  it('Galactic pack: first pick keeps pack open with picksLeft=1', () => {
    const s = baseState({ shards: 0 });
    const sWithPack = {
      ...s,
      shop: {
        ...s.shop,
        pendingPack: {
          kind: 'galactic',
          galaxyIds: ['galaxy_whirlpool', 'galaxy_andromeda', 'galaxy_milky_way', 'galaxy_quasar'],
          picksLeft: 2,
          pickedSoFar: [] as string[],
        },
      },
    };
    const r = shopHandler({ type: 'PICK_FROM_PACK', galaxyIdx: 1 }, sWithPack);
    expect(r.state.shop.pendingPack).not.toBeNull();
    expect(r.state.shop.pendingPack!.picksLeft).toBe(1);
    expect(r.state.shop.pendingPack!.pickedSoFar).toEqual(['galaxy_andromeda']);
    expect(r.state.run.comboLevels.five_kind).toBe(1);
  });

  it('PICK_FROM_PACK rejects if galaxy already picked (no double-tap)', () => {
    const s = baseState({ shards: 0 });
    const sWithPack = {
      ...s,
      shop: {
        ...s.shop,
        pendingPack: {
          kind: 'galactic',
          galaxyIds: ['galaxy_whirlpool', 'galaxy_andromeda'],
          picksLeft: 1,
          pickedSoFar: ['galaxy_whirlpool'],
        },
      },
    };
    const r = shopHandler({ type: 'PICK_FROM_PACK', galaxyIdx: 0 }, sWithPack);
    expect(r.state).toBe(sWithPack);
  });

  it('SKIP_PACK closes the pack without picking, emitting onPackClosed', () => {
    const s = baseState({ shards: 0 });
    const sWithPack = {
      ...s,
      shop: {
        ...s.shop,
        pendingPack: {
          kind: 'celestial',
          galaxyIds: ['galaxy_whirlpool', 'galaxy_milky_way'],
          picksLeft: 1,
          pickedSoFar: [] as string[],
        },
      },
    };
    const r = shopHandler({ type: 'SKIP_PACK' }, sWithPack);
    expect(r.state.shop.pendingPack).toBeNull();
    expect(r.state.run.comboLevels.three_kind ?? 0).toBe(0); // unchanged
    expect(r.events.map((e) => e.type)).toEqual(['onPackClosed']);
  });

  it('REROLL_SHOP is blocked while pack is pending', () => {
    const s = baseState({ shards: 100, rerollCost: 3 });
    const sWithPack = {
      ...s,
      shop: {
        ...s.shop,
        pendingPack: {
          kind: 'celestial',
          galaxyIds: ['galaxy_milky_way', 'galaxy_cartwheel'],
          picksLeft: 1,
          pickedSoFar: [] as string[],
        },
      },
    };
    const r = shopHandler({ type: 'REROLL_SHOP' }, sWithPack);
    expect(r.state).toBe(sWithPack);
  });

  it('CLOSE_SHOP clears pendingPack defensively (e.g., player escapes via Next Trial)', () => {
    const s = baseState({ shards: 0 });
    const sWithPack = {
      ...s,
      shop: {
        ...s.shop,
        pendingPack: {
          kind: 'celestial',
          galaxyIds: ['galaxy_milky_way'],
          picksLeft: 1,
          pickedSoFar: [] as string[],
        },
      },
    };
    const r = shopHandler({ type: 'CLOSE_SHOP' }, sWithPack);
    expect(r.state.shop.pendingPack).toBeNull();
  });
});

describe('Legendary unlock progression', () => {
  it('buying a 4th catalyst unlocks all_band in meta.unlocks', () => {
    const offers: ShopOffer[] = [{ kind: 'catalyst', id: 'cold_hand', price: 5 }];
    const s = baseState({
      shards: 10,
      catalysts: ['stratifier', 'chaos_theory', 'six_bias'],
      offers,
    });
    expect(s.meta.unlocks).not.toContain('legendary_all_band');
    const r = shopHandler({ type: 'BUY_OFFER', offerIdx: 0 }, s);
    expect(r.state.run.catalysts.length).toBe(4);
    expect(r.state.meta.unlocks).toContain('legendary_all_band');
  });

  it('buying a 3rd catalyst does not unlock all_band', () => {
    const offers: ShopOffer[] = [{ kind: 'catalyst', id: 'six_bias', price: 5 }];
    const s = baseState({
      shards: 10,
      catalysts: ['stratifier', 'chaos_theory'],
      offers,
    });
    const r = shopHandler({ type: 'BUY_OFFER', offerIdx: 0 }, s);
    expect(r.state.run.catalysts.length).toBe(3);
    expect(r.state.meta.unlocks).not.toContain('legendary_all_band');
  });

  it('5th+ purchase does not duplicate the unlock entry', () => {
    const offers: ShopOffer[] = [{ kind: 'catalyst', id: 'cold_hand', price: 5 }];
    const s = baseState({
      shards: 10,
      catalysts: ['stratifier', 'chaos_theory', 'six_bias', 'twin_sample'],
      offers,
    });
    // Pre-seed the unlock from a prior run/state.
    const seeded: GameState = { ...s, meta: { ...s.meta, unlocks: ['legendary_all_band'] } } as GameState;
    const r = shopHandler({ type: 'BUY_OFFER', offerIdx: 0 }, seeded);
    expect(r.state.meta.unlocks.filter((u) => u === 'legendary_all_band').length).toBe(1);
  });
});
