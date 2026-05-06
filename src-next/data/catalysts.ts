export type CatalystMeta = {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  flavor?: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
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
    desc: 'Each cleared trial: +0.05× mult permanently. Resets on bust.',
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

  // Phase 3 additions — combo-tribal coverage. Pairs up with the Galaxy
  // system: a Whirlpool / triplet_engine / levels_levy spike now has a
  // complete deck-building lane.
  { id: 'pair_dynamo', name: 'Pair Dynamo', icon: '⚊', color: '#7be3ff',
    desc: 'One Pair → +5 Mult.',
    flavor: 'The simplest match still spins the wheel.', rarity: 'common' },
  { id: 'triplet_engine', name: 'Triplet Engine', icon: '⚙', color: '#cc88ff',
    desc: 'Three of a Kind → Mult ×1.75.',
    flavor: 'Three sealed prongs, one current.', rarity: 'uncommon' },
  { id: 'magnitude', name: 'Magnitude', icon: '✺', color: '#ffd84a',
    desc: 'Large Straight → Chips ×2 and Mult ×1.5.',
    flavor: 'A clean line through the dark, scaled.', rarity: 'rare' },

  // Face-tribal commons. Cheap pickups that reward die-bias playstyles.
  { id: 'prime_pact', name: 'Prime Pact', icon: 'ℙ', color: '#5be8a4',
    desc: 'Each scoring 2, 3, or 5 → +2 Chips.',
    flavor: 'The indivisible pay first.', rarity: 'common' },
  { id: 'even_keeled', name: 'Even Keeled', icon: '◎', color: '#88ddff',
    desc: 'All scoring dice even → Chips ×1.5.',
    flavor: 'Symmetry rewards the patient.', rarity: 'common' },
  { id: 'odd_voice', name: 'Odd Voice', icon: '◌', color: '#cc88ff',
    desc: 'All scoring dice odd → Mult ×1.5.',
    flavor: 'Off-beats carry farther in thin air.', rarity: 'common' },

  // Economy rare — Stipend / Shard Sink decks finally have a payoff scaler.
  { id: 'usurer', name: 'Usurer', icon: '⛁', color: '#f5c451',
    desc: 'Each shard above 10 → +1 Mult (uncapped).',
    flavor: 'The vault grows louder.', rarity: 'rare' },

  // Galaxy-aware rare — pays you for committing to galaxies. Should be
  // cheap to slot mid-run alongside any Galaxy strategy.
  { id: 'levels_levy', name: "Level's Levy", icon: '✸', color: '#cc88ff',
    desc: 'Each combo level on the played hand → +1 Mult.',
    flavor: 'The galaxies remember.', rarity: 'rare' },

  // Legendary showcase — once-per-round tier-up. Unlocks after the player
  // has held 4 catalysts simultaneously in any run (meta-progression).
  { id: 'all_band', name: 'All-Band', icon: '⌬', color: '#ff7847',
    desc: 'Once per round: this hand scores as if it were the next tier higher.',
    flavor: 'Frequency leaks. The judge upgrades the verdict.', rarity: 'legendary' },

  // Phase 5 additions — completes the combo-tribal lane (one catalyst per
  // hand-type) and rounds out the math/scaling band.
  { id: 'straight_signal', name: 'Straight Signal', icon: '↗', color: '#5be8a4',
    desc: 'Small Straight → +6 Mult.',
    flavor: 'Four steps in tune. The fifth lifts.', rarity: 'uncommon' },
  { id: 'tetrad', name: 'Tetrad', icon: '⊞', color: '#ff7847',
    desc: 'Four of a Kind → Chips ×3.',
    flavor: 'Four corners, one frequency.', rarity: 'rare' },
  { id: 'apex', name: 'Apex', icon: '✦', color: '#ffd84a',
    desc: 'Five of a Kind → Mult ×3, plus +1 Mult per matching scoring die.',
    flavor: 'Every face the same. Every face higher.', rarity: 'rare' },
  { id: 'chance_doctrine', name: 'Chance Doctrine', icon: '?', color: '#c0c8ff',
    desc: 'Chance hand → +20 Chips and +4 Mult per scoring die.',
    flavor: 'When nothing matches, score everything.', rarity: 'uncommon' },
  { id: 'low_choir', name: 'Low Choir', icon: '⫯', color: '#88ddff',
    desc: 'Each scoring face ≤2 → +3 Mult.',
    flavor: 'Bass register. Carries farther.', rarity: 'uncommon' },
  { id: 'harmonic', name: 'Harmonic', icon: '∿', color: '#bba8ff',
    desc: 'Each mod id repeated across dice → +25 Chips, ×1.25 Mult.',
    flavor: 'Two strings tuned same. The room rings.', rarity: 'rare' },
  { id: 'metronome', name: 'Metronome', icon: '♩', color: '#5be8a4',
    desc: 'Odd hand → Chips ×1.5. Even hand → Mult ×1.5.',
    flavor: 'Tick. Tock. Both pay.', rarity: 'rare' },
  { id: 'prime_resonance', name: 'Prime Resonance', icon: 'ℜ', color: '#a080c0',
    desc: 'Mult raised to the power 1.05 per scoring die.',
    flavor: 'Exponentials wear thin clothing.', rarity: 'rare' },
];

export function lookupCatalyst(id: string): CatalystMeta | undefined {
  return CATALYST_META.find((c) => c.id === id);
}
