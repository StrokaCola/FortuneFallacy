import type { Rarity } from '../app/visual/rarityStyles';

export type VoucherDef = {
  id: string;
  name: string;
  description: string;
  price: number;
  // 2026-05-08 — voucher rarity drives the kind-frame stroke + glow in
  // the visual pass. Mapped from price: 12 → rare, 8 → uncommon, 6 → common.
  rarity: Rarity;
};

export const VOUCHERS: VoucherDef[] = [
  { id: 'bench',        name: 'Bench',        description: '+1 catalyst slot', price: 8,  rarity: 'uncommon' },
  { id: 'forged_links', name: 'Forged Links', description: '+1 mod slot per die', price: 8, rarity: 'uncommon' },
  { id: 'shard_streak', name: 'Shard Streak', description: '+1 shard per cleared trial', price: 6, rarity: 'common' },
  { id: 'open_mic',     name: 'Open Mic',     description: '+1 hand per round', price: 8, rarity: 'uncommon' },
  { id: 'free_refresh', name: 'Free Refresh', description: 'Shop rerolls cost 0', price: 8, rarity: 'uncommon' },
  { id: 'capacity',     name: 'Capacity',     description: '+1 consumable slot (max 5)', price: 6, rarity: 'common' },
  // 2026-05-08 — extra die voucher. Highest-priced voucher (12 vs the
  // 6-8 range above) and the largest single-purchase power swing in the
  // game; rare-by-cost rather than rare-by-pool to keep shop logic
  // unchanged. Read site: getDiceSpec() in core/run/diceContext.ts.
  // 2026-05-12 QA fix: priced 12 → 18 because the +1 die effect is the
  // largest single-purchase power swing in the game and was dominating the
  // voucher slot. 18 keeps it as a "save up for it" target without
  // overshadowing the 6–8 shard utility vouchers.
  { id: 'extra_die',    name: 'Sixth Star',   description: '+1 die for the rest of the run', price: 18, rarity: 'rare' },
];

export function lookupVoucher(id: string): VoucherDef | undefined {
  return VOUCHERS.find((v) => v.id === id);
}
