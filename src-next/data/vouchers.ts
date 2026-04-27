export type VoucherDef = {
  id: string;
  name: string;
  description: string;
  price: number;
};

export const VOUCHERS: VoucherDef[] = [
  { id: 'astral_plane', name: 'Astral Plane', description: '+1 oracle slot', price: 8 },
  { id: 'forged_links', name: 'Forged Links', description: '+1 rune slot per die', price: 8 },
  { id: 'shard_streak', name: 'Shard Streak', description: '+1 shard per cleared blind', price: 6 },
];

export function lookupVoucher(id: string): VoucherDef | undefined {
  return VOUCHERS.find((v) => v.id === id);
}
