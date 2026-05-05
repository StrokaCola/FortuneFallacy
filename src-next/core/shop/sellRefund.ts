import type { ShopOffer } from '../../events/types';
import { lookupVoucher } from '../../data/vouchers';

const CATALYST_BUY_PRICE = 5;
const MOD_BUY_PRICE = 4;
const CONSUMABLE_BUY_PRICE = 3;

export function sellRefund(kind: ShopOffer['kind'], id: string): number {
  if (kind === 'catalyst')   return Math.floor(CATALYST_BUY_PRICE / 2);
  if (kind === 'mod')        return Math.floor(MOD_BUY_PRICE / 2);
  if (kind === 'consumable') return Math.floor(CONSUMABLE_BUY_PRICE / 2);
  if (kind === 'voucher')    return Math.floor((lookupVoucher(id)?.price ?? 6) / 2);
  return 0;
}
