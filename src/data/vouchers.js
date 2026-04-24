// Voucher definitions — permanent per-run shop upgrades. Phase 6.
//
// Effects are read via getVoucherEffect(key, defaultValue) in
// src/systems/vouchers.js. Combination rules per key:
//   - shopSlots, runeSlots, extraOracleSlot, startingDice: Math.max
//   - shardsPerHand:   additive
//   - priceMult:       multiplicative (<1 is a discount)
//   - rareBias:        max

export const ALL_VOUCHERS = [
  {
    id: 'overstock',
    name: 'Overstock',
    icon: '📦',
    cost: 10,
    description: 'Shop shows 4 items per tab instead of 3.',
    availableFromAnte: 2,
    effect: { shopSlots: 4 },
  },
  {
    id: 'restock',
    name: 'Restock',
    icon: '🔄',
    cost: 12,
    description: 'First shop reroll each visit is free.',
    availableFromAnte: 2,
    effect: { freeFirstReroll: true },
  },
  {
    id: 'gemstone_mine',
    name: 'Gemstone Mine',
    icon: '💎',
    cost: 12,
    description: '+2 shards after every hand (not just goal clear).',
    availableFromAnte: 2,
    effect: { shardsPerHand: 2 },
  },
  {
    id: 'die_caster',
    name: 'Die Caster',
    icon: '🎲',
    cost: 14,
    description: 'Start blinds with 6 dice instead of 5.',
    availableFromAnte: 2,
    effect: { startingDice: 6 },
  },
  {
    id: 'astral_plane',
    name: 'Astral Plane',
    icon: '🌌',
    cost: 15,
    description: '+1 Oracle slot (7 max instead of 6).',
    availableFromAnte: 2,
    effect: { extraOracleSlot: 1 },
  },
  {
    id: 'forged_links',
    name: 'Forged Links',
    icon: '⛓',
    cost: 15,
    description: 'Runes stack 3 per die instead of 2.',
    availableFromAnte: 2,
    effect: { runeSlots: 3 },
  },
  {
    id: 'hone',
    name: 'Hone',
    icon: '⚒',
    cost: 8,
    description: 'Rarer shop items appear 50% more often.',
    availableFromAnte: 2,
    effect: { rareBias: 1.5 },
  },
  {
    id: 'clearance_sale',
    name: 'Clearance Sale',
    icon: '💰',
    cost: 8,
    description: 'All shop prices reduced by 15%.',
    availableFromAnte: 2,
    effect: { priceMult: 0.85 },
  },
];

export function lookupVoucher(id) {
  return ALL_VOUCHERS.find(v => v.id === id) || null;
}
