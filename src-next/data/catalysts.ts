export type CatalystMeta = {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  flavor?: string;
  rarity: 'common' | 'uncommon' | 'rare';
};

export const CATALYST_META: CatalystMeta[] = [
  { id: 'stratifier',     name: 'Stratifier',     icon: '👁',  color: '#cc88ff',
    desc: 'Full House → Mult ×2',          flavor: 'Three plus two. The shape pays.', rarity: 'uncommon' },
  { id: 'chaos_theory',   name: 'Chaos Theory',   icon: '∞',   color: '#44ddff',
    desc: 'Straights → +5 Mult',           flavor: 'Order from disorder. +5 for the trick.', rarity: 'uncommon' },
  { id: 'six_bias',       name: 'Six Bias',       icon: '📈',  color: '#b088ff',
    desc: 'Each 6 → +4 Chips',             flavor: 'Instrument loaded. Top of range pays.', rarity: 'common'   },
  { id: 'twin_sample',    name: 'Twin Sample',    icon: '🔢',  color: '#ff9944',
    desc: 'Two Pair → Chips ×2',           flavor: 'Both samples agree. Confidence doubled.', rarity: 'uncommon' },
  { id: 'cold_hand',      name: 'Cold Hand',      icon: '💬',  color: '#c0c8ff',
    desc: 'Chance → +4 Mult',              flavor: "No pattern? The book says you're due. The book is wrong, but you score anyway.", rarity: 'common'   },
  { id: 'entropy_index',  name: 'Entropy Index',  icon: '◈',   color: '#a080c0',
    desc: 'Each unique face → ×1.25 Mult', flavor: 'Variety paid in compounding interest.', rarity: 'rare'    },
  { id: 'compounding_bias', name: 'Compounding Bias', icon: '∆', color: '#88ddff',
    desc: 'Each cleared blind: +0.05× mult permanently. Resets on bust.',
    flavor: 'Variance bleeds out. Edge holds.', rarity: 'uncommon' },
  { id: 'last_throw', name: 'Last Throw', icon: '🔔', color: '#ff7847',
    desc: 'Last hand of round: +25 chips.',
    flavor: 'House always pays the closer.', rarity: 'common' },
  { id: 'patience_counter', name: 'Patience Counter', icon: '⏳', color: '#cc88ff',
    desc: 'Every 5th hand of run: ×3 mult (this hand only).',
    flavor: 'Wait. Then strike.', rarity: 'rare' },
  { id: 'catalyst_bench', name: 'Catalyst Bench', icon: '⌗', color: '#a080c0',
    desc: '+1 mult per other catalyst owned.',
    flavor: 'Crowded table tilts faster.', rarity: 'uncommon' },
  { id: 'shard_sink', name: 'Shard Sink', icon: '◈', color: '#f5c451',
    desc: 'Spend 1 shard before scoring: ×1.5 mult. Skips if 0 shards.',
    flavor: 'Pay to play. Pays back.', rarity: 'common' },
  { id: 'stipend', name: 'Stipend', icon: '💠', color: '#f5c451',
    desc: '+1 shard at the start of each hand (caps at 6 shards).',
    flavor: 'Steady drip. Fills the cup before it fills the grave.', rarity: 'uncommon' },
  { id: 'recursive_sink', name: 'Recursive Sink', icon: '◇', color: '#f5c451',
    desc: 'When Shard Sink primes, pay 1 more shard for an extra ×1.25 mult.',
    flavor: 'A deeper cut. The vein keeps giving.', rarity: 'rare' },
  { id: 'encore', name: 'Encore', icon: '⤾', color: '#bba8ff',
    desc: 'The last scoring die\'s mods fire one extra time (chips/mult).',
    flavor: 'The crowd demands it.', rarity: 'rare' },
  { id: 'phase_shift', name: 'Phase-Shift', icon: '⊚', color: '#bba8ff',
    desc: 'Mirror Pair, Conduit, Crescendo, Pip Charge each gain +1 per instance.',
    flavor: 'Tilt the lattice; the threads sing one note louder.', rarity: 'uncommon' },
  { id: 'iron_six', name: 'Iron Six', icon: '⬢', color: '#ffd84a',
    desc: 'Each scoring 6 also grants +1 mult.',
    flavor: 'Heavy at the top of the range.', rarity: 'common' },
  { id: 'solar_flare', name: 'Solar Flare', icon: '☀', color: '#ff7847',
    desc: '3+ scoring dice show 5 or 6 → ×1.5 mult.',
    flavor: 'High pressure ignites. The sky bleaches.', rarity: 'uncommon' },
  { id: 'tempo', name: 'Tempo', icon: '♪', color: '#5be8a4',
    desc: 'Each consecutive higher-tier hand: +0.5× mult, capping at ×3.0.',
    flavor: 'Each measure climbs. Don\'t miss the beat.', rarity: 'uncommon' },
  { id: 'conductor', name: 'Conductor', icon: '⌘', color: '#bba8ff',
    desc: 'Full hand scores: +20 chips × distinct mods across scoring dice.',
    flavor: 'Every section accounted for.', rarity: 'rare' },
  { id: 'quorum', name: 'Quorum', icon: '⫶', color: '#cc88ff',
    desc: 'Same combo as last hand: chips ×1.5. 3rd in a row: also mult ×1.5.',
    flavor: 'Repeat until the verdict holds.', rarity: 'uncommon' },
];

export function lookupCatalyst(id: string): CatalystMeta | undefined {
  return CATALYST_META.find((c) => c.id === id);
}
