import type { ActionHandler } from './types';
import type { GameState } from '../../state/store';
import { CONSUMABLES, lookupConsumable } from '../../core/consumables';
import { VOUCHERS, freeShopReroll, maxConsumableSlots, maxCatalystSlots, maxModSlots } from '../../core/vouchers';
import { MOD_IDS } from '../../core/mods';
import { areModsDisabled } from '../../core/run/diceContext';
import { sellRefund } from '../../core/shop/sellRefund';
import type { GameEventEmission, ShopOffer } from '../../events/types';
import { PACK_DEFS, lookupPack, rollPackContents } from '../../core/consumables/galaxies';
import { drawWeightedCatalysts, LEGENDARY_UNLOCK_PREFIX } from '../../core/shop/catalystDraw';
import { rollCatalystEdition } from '../../core/upgrades/editions';

// 4+ catalysts held simultaneously unlocks the All-Band legendary. Stored
// in meta.unlocks under the LEGENDARY_UNLOCK_PREFIX so subsequent runs see
// the gate as open. Pure helper; no side effects.
function maybeUnlockAllBand(s: GameState): { state: GameState; events: GameEventEmission[] } {
  if (s.run.catalysts.length < 4) return { state: s, events: [] };
  const unlockId = `${LEGENDARY_UNLOCK_PREFIX}all_band`;
  if (s.meta.unlocks.includes(unlockId)) return { state: s, events: [] };
  return {
    state: { ...s, meta: { ...s.meta, unlocks: [...s.meta.unlocks, unlockId] } },
    events: [],
  };
}

const BASE_REROLL_COST = 3;
const MOD_OFFER_PRICE = 4;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function rollOffers(s: GameState): ShopOffer[] {
  const offers: ShopOffer[] = [];
  const ownedVouchers = s.run.vouchers;
  const modsOff = areModsDisabled(s);

  if (!modsOff) {
    const modIds = shuffle([...MOD_IDS]).slice(0, 2);
    for (const id of modIds) offers.push({ kind: 'mod', id, price: MOD_OFFER_PRICE });
  }

  // Constellations like Argo replace mod slots with extra catalyst breadth, so
  // surface a third catalyst when mods are off to keep the offer count steady.
  const catalystCount = modsOff ? 3 : 2;
  const catalystIds = drawWeightedCatalysts(catalystCount, s.run.ante, s.meta.unlocks, Math.random);
  for (const id of catalystIds) {
    const edition = rollCatalystEdition(Math.random);
    offers.push({ kind: 'catalyst', id, price: 5, ...(edition ? { edition } : {}) });
  }

  const availableVouchers = VOUCHERS.filter((v) => !ownedVouchers.includes(v.id));
  // Galaxies and spectrals are excluded from the regular consumable pool.
  // Galaxies are gated behind Galaxy Packs (Phase 2). Spectrals (Catalyze,
  // future Void) are rare and meant to come from boss rewards / dedicated
  // Spectral Packs — never the everyday consumable slot.
  const consumableIds = CONSUMABLES
    .filter((c) => c.type !== 'galaxy' && c.type !== 'spectral')
    .map((c) => c.id);

  // Three-way roll for the final slot: pack | voucher | consumable.
  // ~25% pack, then voucher-vs-consumable resolves like before.
  const r = Math.random();
  if (r < 0.25) {
    // Pack tier weighted: 60% Celestial, 30% Stellar, 10% Galactic.
    const tierRoll = Math.random();
    const pack = tierRoll < 0.6 ? PACK_DEFS[0]! : tierRoll < 0.9 ? PACK_DEFS[1]! : PACK_DEFS[2]!;
    offers.push({ kind: 'pack', id: pack.kind, price: pack.price });
  } else {
    const useVoucher = availableVouchers.length > 0 && (consumableIds.length === 0 || Math.random() < 0.5);
    if (useVoucher) {
      const v = shuffle(availableVouchers)[0]!;
      offers.push({ kind: 'voucher', id: v.id, price: v.price });
    } else if (consumableIds.length > 0) {
      const consId = shuffle(consumableIds)[0]!;
      offers.push({ kind: 'consumable', id: consId, price: 3 });
    }
  }

  return offers;
}

// Open a freshly purchased pack: roll its contents, mark all rolled galaxy
// ids as discovered in meta.unlocks, and stash the open state in shop.pendingPack.
function openPack(s: GameState, packKind: string): { state: GameState; events: GameEventEmission[] } {
  const def = lookupPack(packKind);
  if (!def) return { state: s, events: [] };
  const galaxyIds = rollPackContents(def.showCount, Math.random, def.quasarWeightMultiplier ?? 1);
  const events: GameEventEmission[] = [
    { type: 'onPackOpened', payload: { kind: packKind, galaxyIds, picksAllowed: def.pickCount } },
  ];

  // Discovery: any galaxy in this pack the player hasn't seen before goes
  // into meta.unlocks. The shop UI uses this to flip ??? cards to real ones.
  const unlocks = new Set(s.meta.unlocks);
  for (const gid of galaxyIds) {
    if (!unlocks.has(gid)) {
      unlocks.add(gid);
      events.push({ type: 'onGalaxyDiscovered', payload: { galaxyId: gid } });
    }
  }

  return {
    state: {
      ...s,
      meta: { ...s.meta, unlocks: [...unlocks] },
      shop: {
        ...s.shop,
        pendingPack: {
          kind: packKind,
          galaxyIds,
          picksLeft: def.pickCount,
          pickedSoFar: [],
        },
      },
    },
    events,
  };
}

export const shopHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'OPEN_SHOP': {
      const offers = rollOffers(s);
      return {
        state: { ...s, shop: { ...s.shop, open: true, offers, rerollCost: freeShopReroll(s) ? 0 : BASE_REROLL_COST }, ui: { ...s.ui, screen: 'shop' } },
        events: [{ type: 'onShopOpened', payload: { offers } }],
      };
    }
    case 'CLOSE_SHOP':
      return {
        state: { ...s, shop: { ...s.shop, open: false, pendingPack: null }, ui: { ...s.ui, screen: 'round' } },
        events: [],
      };
    case 'REROLL_SHOP': {
      if (!s.shop.open) return { state: s, events: [] };
      // Pack picker is modal — block rerolls until it's resolved.
      if (s.shop.pendingPack) return { state: s, events: [] };
      const cost = s.shop.rerollCost;
      if (s.run.shards < cost) return { state: s, events: [] };
      const offers = rollOffers(s);
      const nextCost = freeShopReroll(s) ? 0 : cost + 1;
      return {
        state: {
          ...s,
          run: { ...s.run, shards: s.run.shards - cost },
          shop: { ...s.shop, offers, rerollCost: nextCost },
        },
        events: [{ type: 'onShopOpened', payload: { offers } }],
      };
    }
    case 'BUY_OFFER': {
      const offer = s.shop.offers[a.offerIdx];
      if (!offer || s.run.shards < offer.price) return { state: s, events: [] };
      // Pack picker is modal — no further buys until it's resolved.
      if (s.shop.pendingPack) return { state: s, events: [] };
      const remaining = s.shop.offers.filter((_, i) => i !== a.offerIdx);

      if (offer.kind === 'pack') {
        // Buying a pack debits shards, removes the offer, and opens the
        // pack picker. The picker grants galaxies via PICK_FROM_PACK.
        const debited: GameState = {
          ...s,
          run: { ...s.run, shards: s.run.shards - offer.price },
          shop: { ...s.shop, offers: remaining },
        };
        const opened = openPack(debited, offer.id);
        return {
          state: opened.state,
          events: [
            { type: 'onOfferBought', payload: { kind: offer.kind, id: offer.id, price: offer.price } },
            ...opened.events,
          ],
        };
      }

      const catalysts = offer.kind === 'catalyst' ? [...s.run.catalysts, offer.id] : s.run.catalysts;
      const consumables = offer.kind === 'consumable' && s.run.consumables.length < maxConsumableSlots(s)
        ? [...s.run.consumables, offer.id]
        : s.run.consumables;
      const vouchers = offer.kind === 'voucher' ? [...s.run.vouchers, offer.id] : s.run.vouchers;
      const ownedMods = offer.kind === 'mod' ? [...s.run.ownedMods, offer.id] : s.run.ownedMods;
      // Carry the offer's rolled edition stamp into run.catalystEditions
      // so the upgrades phase can read it on every score.
      const catalystEditions =
        offer.kind === 'catalyst' && offer.edition
          ? { ...s.run.catalystEditions, [offer.id]: offer.edition }
          : s.run.catalystEditions;
      const bought: GameState = {
        ...s,
        run: { ...s.run, shards: s.run.shards - offer.price, catalysts, consumables, vouchers, ownedMods, catalystEditions },
        shop: { ...s.shop, offers: remaining },
      };
      // Catalyst purchase may cross the 4-catalyst threshold for the first
      // time, unlocking the All-Band legendary in meta.unlocks.
      const withUnlock = offer.kind === 'catalyst' ? maybeUnlockAllBand(bought) : { state: bought, events: [] };
      return {
        state: withUnlock.state,
        events: [
          { type: 'onOfferBought', payload: { kind: offer.kind, id: offer.id, price: offer.price } },
          ...withUnlock.events,
        ],
      };
    }
    case 'PICK_FROM_PACK': {
      const pack = s.shop.pendingPack;
      if (!pack) return { state: s, events: [] };
      const galaxyId = pack.galaxyIds[a.galaxyIdx];
      if (!galaxyId || pack.pickedSoFar.includes(galaxyId)) return { state: s, events: [] };
      const def = lookupConsumable(galaxyId);
      if (!def || def.type !== 'galaxy') return { state: s, events: [] };

      // Apply the galaxy directly — picks bypass the consumable inventory
      // (matches Balatro's planet-pack flow). The galaxy's apply increments
      // run.comboLevels and emits onGalaxyUsed.
      const applied = def.apply(s, []);
      const picksLeft = pack.picksLeft - 1;
      const pickedSoFar = [...pack.pickedSoFar, galaxyId];
      const events: GameEventEmission[] = [
        ...applied.events,
        { type: 'onPackPicked', payload: { galaxyId, remainingPicks: picksLeft } },
      ];

      if (picksLeft <= 0) {
        // Pack exhausted — close it and move on.
        events.push({
          type: 'onPackClosed',
          payload: {
            kind: pack.kind,
            pickedCount: pickedSoFar.length,
            skippedCount: pack.galaxyIds.length - pickedSoFar.length,
          },
        });
        return {
          state: { ...applied.state, shop: { ...applied.state.shop, pendingPack: null } },
          events,
        };
      }

      return {
        state: {
          ...applied.state,
          shop: { ...applied.state.shop, pendingPack: { ...pack, picksLeft, pickedSoFar } },
        },
        events,
      };
    }
    case 'SKIP_PACK': {
      const pack = s.shop.pendingPack;
      if (!pack) return { state: s, events: [] };
      return {
        state: { ...s, shop: { ...s.shop, pendingPack: null } },
        events: [
          {
            type: 'onPackClosed',
            payload: {
              kind: pack.kind,
              pickedCount: pack.pickedSoFar.length,
              skippedCount: pack.galaxyIds.length - pack.pickedSoFar.length,
            },
          },
        ],
      };
    }
    case 'SELL_UPGRADE': {
      const removeAt = <T,>(arr: T[], idx: number): T[] => arr.filter((_, i) => i !== idx);
      if (a.kind === 'catalyst') {
        const id = s.run.catalysts[a.index];
        if (!id) return { state: s, events: [] };
        const refund = sellRefund('catalyst', id);
        // Drop the edition stamp (if any) so a re-bought catalyst with
        // the same id doesn't inherit the prior edition.
        const { [id]: _dropped, ...remainingEditions } = s.run.catalystEditions ?? {};
        return {
          state: {
            ...s,
            run: {
              ...s.run,
              shards: s.run.shards + refund,
              catalysts: removeAt(s.run.catalysts, a.index),
              catalystEditions: remainingEditions,
            },
          },
          events: [{ type: 'onUpgradeSold', payload: { kind: 'catalyst', id, refund } }],
        };
      }
      if (a.kind === 'consumable') {
        const id = s.run.consumables[a.index];
        if (!id) return { state: s, events: [] };
        const refund = sellRefund('consumable', id);
        return {
          state: { ...s, run: { ...s.run, shards: s.run.shards + refund, consumables: removeAt(s.run.consumables, a.index) } },
          events: [{ type: 'onUpgradeSold', payload: { kind: 'consumable', id, refund } }],
        };
      }
      if (a.kind === 'mod') {
        // Only sellable from the owned-mods inventory; attached mods must be
        // detached in the Forge first so we don't mutate diceMods here.
        const id = s.run.ownedMods[a.index];
        if (!id) return { state: s, events: [] };
        const refund = sellRefund('mod', id);
        return {
          state: { ...s, run: { ...s.run, shards: s.run.shards + refund, ownedMods: removeAt(s.run.ownedMods, a.index) } },
          events: [{ type: 'onUpgradeSold', payload: { kind: 'mod', id, refund } }],
        };
      }
      if (a.kind === 'voucher') {
        const id = s.run.vouchers[a.index];
        if (!id) return { state: s, events: [] };
        // Selling a voucher that grants a slot must not strand items above
        // the resulting cap. The caps are computed from current vouchers, so
        // a sell would shrink them by 1 in that direction.
        if (id === 'bench' && s.run.catalysts.length > maxCatalystSlots(s) - 1) return { state: s, events: [] };
        if (id === 'capacity' && s.run.consumables.length > maxConsumableSlots(s) - 1) return { state: s, events: [] };
        if (id === 'forged_links' && s.run.diceMods.some((slots) => slots.length > maxModSlots(s) - 1)) return { state: s, events: [] };
        const refund = sellRefund('voucher', id);
        return {
          state: { ...s, run: { ...s.run, shards: s.run.shards + refund, vouchers: removeAt(s.run.vouchers, a.index) } },
          events: [{ type: 'onUpgradeSold', payload: { kind: 'voucher', id, refund } }],
        };
      }
      return { state: s, events: [] };
    }
    default:
      return { state: s, events: [] };
  }
};
