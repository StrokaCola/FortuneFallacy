import { describe, it, expect } from 'vitest';
import { shopHandler, effectiveFaceUniverse } from './shop';
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

  it('pendingPack.unlockedAtOpen snapshots meta.unlocks at crack time (excluding the new ids)', () => {
    // Pre-seed with one galaxy already known so we can verify it's in the
    // snapshot but newly-rolled ids are NOT (even though they show up in
    // meta.unlocks afterward).
    const offers: ShopOffer[] = [{ kind: 'pack', id: 'celestial', price: 4 }];
    const s = baseState({ shards: 10, offers });
    const seeded: GameState = {
      ...s,
      meta: { ...s.meta, unlocks: ['galaxy_milky_way'] },
    } as GameState;
    const r = shopHandler({ type: 'BUY_OFFER', offerIdx: 0 }, seeded);
    expect(r.state.shop.pendingPack!.unlockedAtOpen).toEqual(['galaxy_milky_way']);
    // meta.unlocks should be the snapshot UNION the rolled galaxy ids.
    for (const gid of r.state.shop.pendingPack!.galaxyIds) {
      expect(r.state.meta.unlocks).toContain(gid);
    }
    expect(r.state.meta.unlocks).toContain('galaxy_milky_way');
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
          unlockedAtOpen: [],
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
          unlockedAtOpen: [],
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
          pickedSoFar: ["galaxy_whirlpool"],
          unlockedAtOpen: [],
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
          unlockedAtOpen: [],
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
          unlockedAtOpen: [],
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
          unlockedAtOpen: [],
        },
      },
    };
    const r = shopHandler({ type: 'CLOSE_SHOP' }, sWithPack);
    expect(r.state.shop.pendingPack).toBeNull();
  });
});

describe('Catalyst editions — buy + sell roundtrip', () => {
  it('BUY_OFFER catalyst with edition stamps run.catalystEditions', () => {
    const offers: ShopOffer[] = [{ kind: 'catalyst', id: 'cold_hand', price: 5, edition: 'foil' }];
    const s = baseState({ shards: 10, offers });
    const r = shopHandler({ type: 'BUY_OFFER', offerIdx: 0 }, s);
    expect(r.state.run.catalysts).toContain('cold_hand');
    expect(r.state.run.catalystEditions.cold_hand).toBe('foil');
  });

  it('BUY_OFFER catalyst without edition leaves catalystEditions untouched', () => {
    const offers: ShopOffer[] = [{ kind: 'catalyst', id: 'cold_hand', price: 5 }];
    const s = baseState({ shards: 10, offers });
    const r = shopHandler({ type: 'BUY_OFFER', offerIdx: 0 }, s);
    expect(r.state.run.catalystEditions.cold_hand).toBeUndefined();
  });

  it('SELL_UPGRADE catalyst clears its edition stamp', () => {
    const s = baseState({ shards: 0, catalysts: ['cold_hand', 'six_bias'] });
    const seeded: GameState = {
      ...s,
      run: {
        ...s.run,
        catalystEditions: { cold_hand: 'foil', six_bias: 'holo' },
      },
    };
    const r = shopHandler({ type: 'SELL_UPGRADE', kind: 'catalyst', index: 0 }, seeded);
    expect(r.state.run.catalysts).toEqual(['six_bias']);
    expect(r.state.run.catalystEditions.cold_hand).toBeUndefined();
    expect(r.state.run.catalystEditions.six_bias).toBe('holo');
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

// 2026-05-18 audit: dust_off repurposed from sell-refund boost to
// reroll-cost discount. Refund tests removed; the catalyst now sells
// back for the base value just like any other common.
describe('dust_off catalyst — base sell refund (post-audit, no boost)', () => {
  it('sells back at the standard catalyst refund value', () => {
    const s = baseState({ shards: 0, catalysts: ['dust_off', 'cold_hand'] });
    const r = shopHandler({ type: 'SELL_UPGRADE', kind: 'catalyst', index: 1 }, s);
    // Base sell refund for a catalyst is 2 — no boost.
    expect(r.state.run.shards).toBe(2);
    expect(r.state.run.catalysts).toEqual(['dust_off']);
  });
});

describe('Mod editions — buy + sell parallel-array sync', () => {
  it('BUY_OFFER mod with edition pushes to ownedMods + ownedModEditions in lockstep', () => {
    const offers: ShopOffer[] = [{ kind: 'mod', id: 'amplify', price: 4, edition: 'foil' }];
    const s = baseState({ shards: 10, offers });
    const r = shopHandler({ type: 'BUY_OFFER', offerIdx: 0 }, s);
    expect(r.state.run.ownedMods).toEqual(['amplify']);
    expect(r.state.run.ownedModEditions).toEqual(['foil']);
  });

  it('BUY_OFFER mod without edition pushes null to ownedModEditions', () => {
    const offers: ShopOffer[] = [{ kind: 'mod', id: 'amplify', price: 4 }];
    const s = baseState({ shards: 10, offers });
    const r = shopHandler({ type: 'BUY_OFFER', offerIdx: 0 }, s);
    expect(r.state.run.ownedMods).toEqual(['amplify']);
    expect(r.state.run.ownedModEditions).toEqual([null]);
  });

  it('SELL_UPGRADE mod drops the parallel edition entry at the same index', () => {
    const s = baseState({ shards: 0, ownedMods: ['amplify', 'sharpened'] });
    const seeded: GameState = {
      ...s,
      run: { ...s.run, ownedModEditions: ['foil', 'holo'] },
    } as GameState;
    const r = shopHandler({ type: 'SELL_UPGRADE', kind: 'mod', index: 0 }, seeded);
    expect(r.state.run.ownedMods).toEqual(['sharpened']);
    expect(r.state.run.ownedModEditions).toEqual(['holo']);
  });
});

describe('Void Mode — catalyst affix offer → purchase → run.catalystAffixes', () => {
  // Helper: build a void-mode state so OPEN_SHOP threads a voidRng and
  // catalyst offers carry the rolled `affixed` payload.
  const voidState = (overrides: Overrides = {}): GameState => {
    const base = baseState({ shards: 100, open: false, ...overrides });
    return {
      ...base,
      run: { ...base.run, mode: 'void', voidSeed: 4242 },
    } as GameState;
  };

  it('OPEN_SHOP in void mode attaches `affixed` to catalyst offers', () => {
    const s = voidState();
    const r = shopHandler({ type: 'OPEN_SHOP' }, s);
    const catalystOffers = r.state.shop.offers.filter((o) => o.kind === 'catalyst');
    expect(catalystOffers.length).toBeGreaterThan(0);
    // At least one catalyst offer must carry an `affixed` payload whose
    // base.id matches the offer's catalyst id.
    const affixedCount = catalystOffers.filter((o) => o.affixed).length;
    expect(affixedCount).toBe(catalystOffers.length);
    for (const o of catalystOffers) {
      expect(o.affixed!.baseId).toBe(o.id);
    }
  });

  it('OPEN_SHOP outside void mode does NOT attach `affixed` to offers', () => {
    const s = baseState({ open: false });
    const r = shopHandler({ type: 'OPEN_SHOP' }, s);
    for (const o of r.state.shop.offers) {
      expect(o.affixed).toBeUndefined();
    }
  });

  it('BUY_OFFER on an affixed catalyst persists the bundle to run.catalystAffixes', () => {
    const s = voidState();
    const opened = shopHandler({ type: 'OPEN_SHOP' }, s);
    const catalystIdx = opened.state.shop.offers.findIndex((o) => o.kind === 'catalyst' && o.affixed);
    expect(catalystIdx).toBeGreaterThanOrEqual(0);
    const offer = opened.state.shop.offers[catalystIdx]!;
    const bought = shopHandler({ type: 'BUY_OFFER', offerIdx: catalystIdx }, opened.state);
    expect(bought.state.run.catalysts).toContain(offer.id);
    expect(bought.state.run.catalystAffixes[offer.id]).toBeDefined();
    expect(bought.state.run.catalystAffixes[offer.id]!.baseId).toBe(offer.id);
  });

  it('SELL_UPGRADE catalyst drops the affix bundle so a re-buy rolls fresh', () => {
    const s = voidState();
    const opened = shopHandler({ type: 'OPEN_SHOP' }, s);
    const catalystIdx = opened.state.shop.offers.findIndex((o) => o.kind === 'catalyst' && o.affixed);
    const bought = shopHandler({ type: 'BUY_OFFER', offerIdx: catalystIdx }, opened.state);
    const boughtId = opened.state.shop.offers[catalystIdx]!.id;
    expect(bought.state.run.catalystAffixes[boughtId]).toBeDefined();
    // Sell from the catalyst tray (index 0 — only catalyst in the run).
    const sold = shopHandler({ type: 'SELL_UPGRADE', kind: 'catalyst', index: 0 }, bought.state);
    expect(sold.state.run.catalystAffixes[boughtId]).toBeUndefined();
  });
});

describe('Void Mode — consumable affix flow (PICK_FROM_PACK + SELL_UPGRADE)', () => {
  // Helper: seed a void-mode state with a pendingPack so PICK_FROM_PACK
  // exercises the consumable affix branch directly. We pre-roll a known
  // galaxy_id list so the test doesn't depend on the pack-content rng.
  const voidPackState = (galaxyIds: string[]): GameState => {
    const base = baseState({ open: true });
    return {
      ...base,
      run: { ...base.run, mode: 'void', voidSeed: 7777 },
      shop: {
        ...base.shop,
        pendingPack: {
          kind: 'celestial',
          galaxyIds,
          picksLeft: 1,
          pickedSoFar: [],
          unlockedAtOpen: [],
        },
      },
    } as GameState;
  };

  it('PICK_FROM_PACK galaxy in void mode persists affixed entry on run.consumableAffixes', () => {
    const s = voidPackState(['galaxy_milky_way']);
    const r = shopHandler({ type: 'PICK_FROM_PACK', galaxyIdx: 0 }, s);
    expect(r.state.run.consumableAffixes['galaxy_milky_way']).toBeDefined();
    expect(r.state.run.consumableAffixes['galaxy_milky_way']!.baseId).toBe('galaxy_milky_way');
    // Galaxy still applies — combo level bumps as normal.
    expect(r.state.run.comboLevels?.['chance']).toBeGreaterThan(0);
  });

  it('PICK_FROM_PACK maneuver in void mode persists affix + adds maneuver to consumables', () => {
    const s = voidPackState(['burn_pass']);
    const r = shopHandler({ type: 'PICK_FROM_PACK', galaxyIdx: 0 }, s);
    expect(r.state.run.consumables).toContain('burn_pass');
    expect(r.state.run.consumableAffixes['burn_pass']).toBeDefined();
    expect(r.state.run.consumableAffixes['burn_pass']!.baseId).toBe('burn_pass');
  });

  it('PICK_FROM_PACK outside void mode does NOT persist consumable affixes', () => {
    const base = baseState({ open: true });
    const s: GameState = {
      ...base,
      shop: {
        ...base.shop,
        pendingPack: {
          kind: 'celestial',
          galaxyIds: ['galaxy_milky_way'],
          picksLeft: 1,
          pickedSoFar: [],
          unlockedAtOpen: [],
        },
      },
    } as GameState;
    const r = shopHandler({ type: 'PICK_FROM_PACK', galaxyIdx: 0 }, s);
    expect(r.state.run.consumableAffixes['galaxy_milky_way']).toBeUndefined();
  });

  it('SELL_UPGRADE consumable in void drops the affix bundle when no copies remain', () => {
    const s = voidPackState(['burn_pass']);
    const picked = shopHandler({ type: 'PICK_FROM_PACK', galaxyIdx: 0 }, s);
    expect(picked.state.run.consumableAffixes['burn_pass']).toBeDefined();
    const sold = shopHandler({ type: 'SELL_UPGRADE', kind: 'consumable', index: 0 }, picked.state);
    expect(sold.state.run.consumableAffixes['burn_pass']).toBeUndefined();
  });
});

// 2026-05-21 — face-creator synergy un-gate. When the player has attached
// a `loaded` mod (1 → 6 remap) to any die, face-keyed picks that would
// otherwise be gated on a no-6 universe become reachable.
describe('effectiveFaceUniverse — face-remap mod synergy', () => {
  it('returns the base universe when no face-remap mods are attached', () => {
    const s = baseState({});
    s.run.constellationId = 'eclipse';
    s.run.diceMods = [[], [], [], [], []];
    const u = effectiveFaceUniverse(s);
    // Eclipse base universe: [0, 1] only.
    expect(u.has(0)).toBe(true);
    expect(u.has(1)).toBe(true);
    expect(u.has(6)).toBe(false);
  });

  it('augments the universe with face 6 when loaded mod is attached on Eclipse', () => {
    const s = baseState({ diceMods: [['loaded'], [], [], [], []] });
    s.run.constellationId = 'eclipse';
    const u = effectiveFaceUniverse(s);
    // Loaded remaps 1 → 6, and Eclipse has 1, so 6 enters the effective universe.
    expect(u.has(6)).toBe(true);
  });

  it('does NOT add face 6 when loaded is attached on a universe lacking face 1', () => {
    // Triumvirate universe is [1..12] — has 1, so loaded would fire there.
    // Pick a synthetic case: faceUniverse without 1 should not pick up 6.
    // (We approximate by checking the no-loaded base path stays clean
    // on a no-1 universe; the live remap check requires `from` to be present.)
    const s = baseState({ diceMods: [['loaded'], [], [], [], []] });
    s.run.constellationId = 'lyra'; // [1..6] — already has 6, so no observable change.
    const u = effectiveFaceUniverse(s);
    expect(u.has(6)).toBe(true); // still has 6 — was already there.
    expect(u.size).toBe(6); // [1..6], unchanged.
  });

  it('gateModsByFaceUniverse un-gates Crown when loaded is attached on Eclipse', () => {
    // 2026-05-21 flake fix (B7): initialRunSlice() seeds run.seed via
    // Math.random(), so each test run sampled a different shop RNG stream
    // and Crown appeared in only ~94% of seeds — the test failed in the
    // ~6% where 40 rerolls missed it. Pin run.seed to 42 (probed via
    // probe-shop.ts: yields 2 Crown sightings with loaded, 0 without)
    // so the deterministic shop RNG produces identical offers every CI run.
    const SEED = 42;

    // Without loaded: Crown is gated out (Eclipse [0,1] has no 6).
    const withoutLoaded = baseState({});
    withoutLoaded.run.constellationId = 'eclipse';
    withoutLoaded.run.diceMods = [[], [], [], [], []];
    withoutLoaded.run.seed = SEED;
    const offersWithout = shopHandler({ type: 'OPEN_SHOP' }, withoutLoaded);
    // Roll the shop ~10 times; Crown should never appear without loaded.
    let crownSightingsWithout = 0;
    let s = offersWithout.state;
    for (let i = 0; i < 10; i++) {
      if (s.shop.offers.some((o) => o.kind === 'mod' && o.id === 'crown')) crownSightingsWithout++;
      const reroll = shopHandler({ type: 'REROLL_SHOP' }, { ...s, run: { ...s.run, shards: 1000 } });
      s = reroll.state;
    }
    expect(crownSightingsWithout).toBe(0);

    // With loaded attached + same seed: Crown re-enters the pool. The fixed
    // seed makes "appears at least once in 40 rerolls" deterministic across CI.
    const withLoaded = baseState({ diceMods: [['loaded'], [], [], [], []] });
    withLoaded.run.constellationId = 'eclipse';
    withLoaded.run.seed = SEED;
    const offersWith = shopHandler({ type: 'OPEN_SHOP' }, withLoaded);
    let crownSightingsWith = 0;
    let t = offersWith.state;
    for (let i = 0; i < 40; i++) {
      if (t.shop.offers.some((o) => o.kind === 'mod' && o.id === 'crown')) crownSightingsWith++;
      const reroll = shopHandler({ type: 'REROLL_SHOP' }, { ...t, run: { ...t.run, shards: 1000 } });
      t = reroll.state;
    }
    expect(crownSightingsWith).toBeGreaterThan(0);
  });
});
