import type { ActionHandler } from './types';
import { ORACLE_IDS } from '../../core/upgrades/oracles';
import { CONSUMABLES } from '../../core/consumables';
import { VOUCHERS } from '../../core/vouchers';
import type { ShopOffer } from '../../events/types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function rollOffers(ownedVouchers: string[]): ShopOffer[] {
  const oracleIds = shuffle([...ORACLE_IDS]).slice(0, 2);
  const consId = shuffle(CONSUMABLES.map((c) => c.id))[0];
  const offers: ShopOffer[] = oracleIds.map((id) => ({ kind: 'oracle' as const, id, price: 5 }));
  if (consId) offers.push({ kind: 'consumable', id: consId, price: 3 });
  const availableVouchers = VOUCHERS.filter((v) => !ownedVouchers.includes(v.id));
  if (availableVouchers.length > 0 && Math.random() < 0.5) {
    const v = shuffle(availableVouchers)[0]!;
    offers.push({ kind: 'voucher', id: v.id, price: v.price });
  }
  return offers;
}

export const shopHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'OPEN_SHOP': {
      const offers = rollOffers(s.run.vouchers);
      return {
        state: { ...s, shop: { ...s.shop, open: true, offers, rerollCost: 5 }, ui: { ...s.ui, screen: 'shop' } },
        events: [{ type: 'onShopOpened', payload: { offers } }],
      };
    }
    case 'CLOSE_SHOP':
      return {
        state: { ...s, shop: { ...s.shop, open: false }, ui: { ...s.ui, screen: 'round' } },
        events: [],
      };
    case 'BUY_OFFER': {
      const offer = s.shop.offers[a.offerIdx];
      if (!offer || s.run.shards < offer.price) return { state: s, events: [] };
      const remaining = s.shop.offers.filter((_, i) => i !== a.offerIdx);
      const oracles = offer.kind === 'oracle' ? [...s.run.oracles, offer.id] : s.run.oracles;
      const consumables = offer.kind === 'consumable' && s.run.consumables.length < 4
        ? [...s.run.consumables, offer.id]
        : s.run.consumables;
      const vouchers = offer.kind === 'voucher' ? [...s.run.vouchers, offer.id] : s.run.vouchers;
      return {
        state: {
          ...s,
          run: { ...s.run, shards: s.run.shards - offer.price, oracles, consumables, vouchers },
          shop: { ...s.shop, offers: remaining },
        },
        events: [{ type: 'onOfferBought', payload: { kind: offer.kind, id: offer.id, price: offer.price } }],
      };
    }
    default:
      return { state: s, events: [] };
  }
};
