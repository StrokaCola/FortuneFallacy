import type { ActionHandler } from './types';
import type { GameState } from '../../state/store';
import { CATALYST_IDS } from '../../core/upgrades/catalysts';
import { CONSUMABLES } from '../../core/consumables';
import { VOUCHERS, freeShopReroll, maxConsumableSlots, maxCatalystSlots, maxModSlots } from '../../core/vouchers';
import { MOD_IDS } from '../../core/mods';
import { areModsDisabled } from '../../core/run/diceContext';
import { sellRefund } from '../../core/shop/sellRefund';
import type { ShopOffer } from '../../events/types';

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
  const catalystIds = shuffle([...CATALYST_IDS]).slice(0, catalystCount);
  for (const id of catalystIds) offers.push({ kind: 'catalyst', id, price: 5 });

  const availableVouchers = VOUCHERS.filter((v) => !ownedVouchers.includes(v.id));
  const consumableIds = CONSUMABLES.map((c) => c.id);
  const useVoucher = availableVouchers.length > 0 && (consumableIds.length === 0 || Math.random() < 0.5);
  if (useVoucher) {
    const v = shuffle(availableVouchers)[0]!;
    offers.push({ kind: 'voucher', id: v.id, price: v.price });
  } else if (consumableIds.length > 0) {
    const consId = shuffle(consumableIds)[0]!;
    offers.push({ kind: 'consumable', id: consId, price: 3 });
  }

  return offers;
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
        state: { ...s, shop: { ...s.shop, open: false }, ui: { ...s.ui, screen: 'round' } },
        events: [],
      };
    case 'REROLL_SHOP': {
      if (!s.shop.open) return { state: s, events: [] };
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
      const remaining = s.shop.offers.filter((_, i) => i !== a.offerIdx);
      const catalysts = offer.kind === 'catalyst' ? [...s.run.catalysts, offer.id] : s.run.catalysts;
      const consumables = offer.kind === 'consumable' && s.run.consumables.length < maxConsumableSlots(s)
        ? [...s.run.consumables, offer.id]
        : s.run.consumables;
      const vouchers = offer.kind === 'voucher' ? [...s.run.vouchers, offer.id] : s.run.vouchers;
      const ownedMods = offer.kind === 'mod' ? [...s.run.ownedMods, offer.id] : s.run.ownedMods;
      return {
        state: {
          ...s,
          run: { ...s.run, shards: s.run.shards - offer.price, catalysts, consumables, vouchers, ownedMods },
          shop: { ...s.shop, offers: remaining },
        },
        events: [{ type: 'onOfferBought', payload: { kind: offer.kind, id: offer.id, price: offer.price } }],
      };
    }
    case 'SELL_UPGRADE': {
      const removeAt = <T,>(arr: T[], idx: number): T[] => arr.filter((_, i) => i !== idx);
      if (a.kind === 'catalyst') {
        const id = s.run.catalysts[a.index];
        if (!id) return { state: s, events: [] };
        const refund = sellRefund('catalyst', id);
        return {
          state: { ...s, run: { ...s.run, shards: s.run.shards + refund, catalysts: removeAt(s.run.catalysts, a.index) } },
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
