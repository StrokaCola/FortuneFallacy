export type VoucherDef = {
  id: string;
  name: string;
  description: string;
  price: number;
};

export const VOUCHERS: VoucherDef[] = [
  { id: 'bench',        name: 'Bench',        description: '+1 catalyst slot', price: 8 },
  { id: 'forged_links', name: 'Forged Links', description: '+1 mod slot per die', price: 8 },
  { id: 'shard_streak', name: 'Shard Streak', description: '+1 shard per cleared blind', price: 6 },
  { id: 'open_mic',     name: 'Open Mic',     description: '+1 hand per round', price: 8 },
  { id: 'free_refresh', name: 'Free Refresh', description: 'Shop rerolls cost 0', price: 8 },
  { id: 'capacity',     name: 'Capacity',     description: '+1 consumable slot (max 5)', price: 6 },
];

export function lookupVoucher(id: string): VoucherDef | undefined {
  return VOUCHERS.find((v) => v.id === id);
}
