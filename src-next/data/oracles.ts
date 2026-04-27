export type OracleMeta = {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  rarity: 'common' | 'uncommon' | 'rare';
};

export const ORACLE_META: OracleMeta[] = [
  { id: 'the_oracle',     name: 'The Oracle',     icon: '👁',  color: '#cc88ff', desc: 'Full House → Mult ×2',         rarity: 'uncommon' },
  { id: 'chaos_theory',   name: 'Chaos Theory',   icon: '∞',   color: '#44ddff', desc: 'Straights → +5 Mult',          rarity: 'uncommon' },
  { id: 'prophet',        name: 'The Prophet',    icon: '🔮',  color: '#b088ff', desc: 'Each 6 → +4 Chips',            rarity: 'common'   },
  { id: 'fools_fortune',  name: "Fortune's Fool", icon: '🃏',  color: '#ff9944', desc: 'Two Pair → Chips ×2',          rarity: 'uncommon' },
  { id: 'silver_tongue',  name: 'Silver Tongue',  icon: '💬',  color: '#c0c8ff', desc: 'Chance → +4 Mult',             rarity: 'common'   },
  { id: 'entropy_stone',  name: 'Entropy Stone',  icon: '◈',   color: '#a080c0', desc: 'Each unique face → ×1.25 Mult', rarity: 'rare'    },
];

export function lookupOracle(id: string): OracleMeta | undefined {
  return ORACLE_META.find((o) => o.id === id);
}
