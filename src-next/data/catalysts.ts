import type { ArchetypeTag } from '../voidmode/types';

// Build archetypes — drives the Ante 1 shop coherence bias (see
// `core/shop/catalystDraw.ts`). Catalysts that play together in a synergistic
// build share an archetype. Optional — uncategorized catalysts ignore the bias.
//   combo:   pays off specific combo tiers (Stratifier, Tetrad, Apex, ...)
//   face:    pays off specific face values (Six Bias, Iron Six, Prime Pact, ...)
//   economy: shard economy plays (Shard Sink, Stipend, Usurer, ...)
//   scaling: grows over time (Tempo, Compounding Bias, Prime Resonance, ...)
//   mods:    rewards mod density / synergy (Conductor, Encore, Harmonic, ...)
//   timing:  rewards specific hand cadence (Quorum, Patience, Metronome, ...)
//   utility: lifecycle / non-pipeline (Silver Tongue, Audit, Dust-Off)
export type CatalystArchetype =
  | 'combo'
  | 'face'
  | 'economy'
  | 'scaling'
  | 'mods'
  | 'timing'
  | 'utility'
  | 'collision'
  // 2026-05-16 — tradeoff catalysts. Upside paired with an explicit
  // downside; shop archetype-bias still works because the bias only
  // requires the archetype string match.
  | 'risk';

export type CatalystMeta = {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  flavor?: string;
  // 2026-05-19 — 'mythic' is a new tier above legendary. Mythics are
  // unlock-gated per-id (mythic_<id> in meta.unlocks), priced at 20
  // shards in the shop, and only appear from ante 3+ (weight = 0 at
  // ante 1-2). See core/shop/catalystDraw.ts and actions/handlers/shop.ts.
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic';
  archetype?: CatalystArchetype;
  // Constellation-locked: when set, this catalyst only spawns in the
  // shop pool when the active constellation matches. Drives build
  // identity across constellations. See core/shop/catalystDraw.ts.
  requiresConstellation?: string;
  /** Tags used by the void-mode affix generator to gate which affix
   * families can attach to this catalyst. Optional — catalysts without
   * tags are skipped by the void generator and fall through as base. */
  archetypeTags?: ArchetypeTag[];
};

export const CATALYST_META: CatalystMeta[] = [
  { id: 'stratifier',     name: 'Stratifier',     icon: '👁',  color: '#cc88ff',
    desc: 'Full House → Mult ×2',          flavor: 'Three plus two. The shape pays.', rarity: 'uncommon', archetype: 'combo',
    archetypeTags: ['combo'] },
  { id: 'chaos_theory',   name: 'Chaos Theory',   icon: '∞',   color: '#44ddff',
    desc: 'Straights → +5 Mult',           flavor: 'Order from disorder. +5 for the trick.', rarity: 'uncommon', archetype: 'combo',
    archetypeTags: ['combo'] },
  { id: 'six_bias',       name: 'Six Bias',       icon: '📈',  color: '#b088ff',
    desc: 'Each 6 → +4 Pips',             flavor: 'Instrument loaded. Top of range pays.', rarity: 'common', archetype: 'face',
    archetypeTags: ['face'] },
  { id: 'twin_sample',    name: 'Twin Sample',    icon: '🔢',  color: '#ff9944',
    desc: 'Hand contains Two Pair → Pips ×2',           flavor: 'Both samples agree. Confidence doubled.', rarity: 'uncommon', archetype: 'combo',
    archetypeTags: ['combo'] },
  { id: 'cold_hand',      name: 'Cold Hand',      icon: '💬',  color: '#c0c8ff',
    desc: 'Chance → +4 Mult',              flavor: "No pattern? The book says you're due. The book is wrong, but you score anyway.", rarity: 'common', archetype: 'combo',
    archetypeTags: ['combo'] },
  { id: 'entropy_index',  name: 'Entropy Index',  icon: '◈',   color: '#a080c0',
    desc: 'Each unique face → ×1.20 Mult', flavor: 'Variety paid in compounding interest.', rarity: 'rare', archetype: 'face',
    archetypeTags: ['face', 'scaling'] },
  // Shipped value: +0.10×/clear. The 2026-05-07 perf-balance audit modeled
  // this catalyst at +0.05×/clear as a conservative under-count in the
  // sim's build-multiplier abstraction. The game itself has always paid
  // the higher 0.10× rate; real clear-rates are higher than the audit's
  // 'synergy' profile suggests for any build that actually slots this card.
  { id: 'compounding_bias', name: 'Compounding Bias', icon: '∆', color: '#88ddff',
    desc: 'Each cleared trial: +0.10× mult permanently. Resets on bust.',
    flavor: 'Variance bleeds out. Edge holds.', rarity: 'uncommon', archetype: 'scaling',
    archetypeTags: ['scaling', 'timing'] },
  { id: 'last_throw', name: 'Last Throw', icon: '🔔', color: '#ff7847',
    desc: 'Last hand of round: +25 pips.',
    flavor: 'House always pays the closer.', rarity: 'common', archetype: 'timing',
    archetypeTags: ['timing'] },
  { id: 'patience_counter', name: 'Patience Counter', icon: '⏳', color: '#cc88ff',
    desc: 'Every 5th hand of run: ×3 mult (this hand only).',
    flavor: 'Wait. Then strike.', rarity: 'rare', archetype: 'timing',
    archetypeTags: ['timing'] },
  { id: 'catalyst_bench', name: 'Catalyst Bench', icon: '⌗', color: '#a080c0',
    desc: '+1 mult per other catalyst owned.',
    flavor: 'Crowded table tilts faster.', rarity: 'uncommon', archetype: 'scaling',
    archetypeTags: ['scaling'] },
  { id: 'shard_sink', name: 'Shard Sink', icon: '◈', color: '#f5c451',
    desc: 'Spend 1 shard before scoring: ×1.5 mult. Skips if 0 shards.',
    flavor: 'Pay to play. Pays back.', rarity: 'common', archetype: 'economy',
    archetypeTags: ['economy'] },
  { id: 'stipend', name: 'Stipend', icon: '💠', color: '#f5c451',
    desc: '+1 shard at the start of each hand (caps at 6 shards).',
    flavor: 'Steady drip. Fills the cup before it fills the grave.', rarity: 'uncommon', archetype: 'economy',
    archetypeTags: ['economy', 'timing'] },
  { id: 'recursive_sink', name: 'Recursive Sink', icon: '◇', color: '#f5c451',
    desc: 'When Shard Sink primes, pay 1 more shard for an extra ×1.25 mult.',
    flavor: 'A deeper cut. The vein keeps giving.', rarity: 'rare', archetype: 'economy',
    archetypeTags: ['economy'] },
  { id: 'encore', name: 'Encore', icon: '⤾', color: '#bba8ff',
    desc: 'The last scoring die\'s mods fire one extra time (pips/mult).',
    flavor: 'The crowd demands it.', rarity: 'rare', archetype: 'mods',
    archetypeTags: ['mods'] },
  { id: 'phase_shift', name: 'Phase-Shift', icon: '⊚', color: '#bba8ff',
    desc: 'Mirror Pair, Conduit, Crescendo, Pip Charge each gain +1 per instance.',
    flavor: 'Tilt the lattice; the threads sing one note louder.', rarity: 'uncommon', archetype: 'mods',
    archetypeTags: ['mods'] },
  { id: 'iron_six', name: 'Iron Six', icon: '⬢', color: '#ffd84a',
    desc: 'Each scoring 6 also grants +2 mult.',
    flavor: 'Heavy at the top of the range.', rarity: 'common', archetype: 'face',
    archetypeTags: ['face'] },
  { id: 'solar_flare', name: 'Solar Flare', icon: '☀', color: '#ff7847',
    desc: '3+ scoring dice show 5 or 6 → ×1.5 mult.',
    flavor: 'High pressure ignites. The sky bleaches.', rarity: 'uncommon', archetype: 'face',
    archetypeTags: ['face'] },
  // 2026-05-12 QA fix: name changed to the palindrome "Solos" so the
  // Mirrored Hand easter egg has a reachable pair (zero palindromic names
  // existed before). ID stays `tempo` so save data and tests are intact.
  { id: 'tempo', name: 'Solos', icon: '♪', color: '#5be8a4',
    desc: 'Each consecutive higher-tier hand: +0.4× mult, capping at ×3.5.',
    flavor: 'Each measure climbs. Don\'t miss the beat.', rarity: 'uncommon', archetype: 'scaling',
    archetypeTags: ['scaling', 'combo'] },
  { id: 'conductor', name: 'Conductor', icon: '⌘', color: '#bba8ff',
    desc: 'Full hand scores: +20 pips × distinct mods across scoring dice.',
    flavor: 'Every section accounted for.', rarity: 'rare', archetype: 'mods',
    archetypeTags: ['mods'] },
  { id: 'quorum', name: 'Quorum', icon: '⫶', color: '#cc88ff',
    desc: 'Same combo as last hand: pips ×1.5. 3rd in a row: also mult ×1.5.',
    flavor: 'Repeat until the verdict holds.', rarity: 'uncommon', archetype: 'timing',
    archetypeTags: ['timing', 'combo'] },

  // Phase 3 additions — combo-tribal coverage. Pairs up with the Galaxy
  // system: a Whirlpool / triplet_engine / levels_levy spike now has a
  // complete deck-building lane.
  { id: 'pair_dynamo', name: 'Pair Dynamo', icon: '⚊', color: '#7be3ff',
    desc: 'Hand contains a Pair → +5 Mult.',
    flavor: 'The simplest match still spins the wheel.', rarity: 'common', archetype: 'combo',
    archetypeTags: ['combo'] },
  { id: 'triplet_engine', name: 'Triplet Engine', icon: '⚙', color: '#cc88ff',
    desc: 'Hand contains Three of a Kind → Mult ×1.75.',
    flavor: 'Three sealed prongs, one current.', rarity: 'uncommon', archetype: 'combo',
    archetypeTags: ['combo'] },
  { id: 'magnitude', name: 'Magnitude', icon: '✺', color: '#ffd84a',
    desc: 'Large Straight → Pips ×2 and Mult ×1.5.',
    flavor: 'A clean line through the dark, scaled.', rarity: 'rare', archetype: 'combo',
    archetypeTags: ['combo'] },

  // Face-tribal commons. Cheap pickups that reward die-bias playstyles.
  { id: 'prime_pact', name: 'Prime Pact', icon: 'ℙ', color: '#5be8a4',
    desc: 'Each scoring 2, 3, or 5 → +2 Pips.',
    flavor: 'The indivisible pay first.', rarity: 'common', archetype: 'face',
    archetypeTags: ['face'] },
  { id: 'even_keeled', name: 'Even Keeled', icon: '◎', color: '#88ddff',
    desc: 'All scoring dice even → Pips ×1.5.',
    flavor: 'Symmetry rewards the patient.', rarity: 'common', archetype: 'face',
    archetypeTags: ['face'] },
  { id: 'odd_voice', name: 'Odd Voice', icon: '◌', color: '#cc88ff',
    desc: 'All scoring dice odd → Mult ×1.5.',
    flavor: 'Off-beats carry farther in thin air.', rarity: 'common', archetype: 'face',
    archetypeTags: ['face'] },

  // Economy rare — Stipend / Shard Sink decks finally have a payoff scaler.
  { id: 'usurer', name: 'Usurer', icon: '⛁', color: '#f5c451',
    desc: 'Each shard above 10 → +1 Mult (uncapped).',
    flavor: 'The vault grows louder.', rarity: 'rare', archetype: 'economy',
    archetypeTags: ['economy', 'scaling'] },

  // Galaxy-aware rare — pays you for committing to galaxies. Should be
  // cheap to slot mid-run alongside any Galaxy strategy.
  { id: 'levels_levy', name: "Level's Levy", icon: '✸', color: '#cc88ff',
    desc: 'Each combo level on the played hand → +1 Mult.',
    flavor: 'The galaxies remember.', rarity: 'rare', archetype: 'scaling',
    archetypeTags: ['scaling', 'combo'] },

  // Legendary showcase — once-per-round tier-up. Unlocks after the player
  // has held 4 catalysts simultaneously in any run (meta-progression).
  { id: 'all_band', name: 'All-Band', icon: '⌬', color: '#ff7847',
    desc: 'Once per round: this hand scores as if it were the next tier higher.',
    flavor: 'Frequency leaks. The judge upgrades the verdict.', rarity: 'legendary', archetype: 'combo',
    archetypeTags: ['combo', 'timing'] },

  // Phase 5 additions — completes the combo-tribal lane (one catalyst per
  // hand-type) and rounds out the math/scaling band.
  { id: 'straight_signal', name: 'Straight Signal', icon: '↗', color: '#5be8a4',
    desc: 'Hand contains a Small Straight → +6 Mult.',
    flavor: 'Four steps in tune. The fifth lifts.', rarity: 'uncommon', archetype: 'combo',
    archetypeTags: ['combo'] },
  { id: 'tetrad', name: 'Tetrad', icon: '⊞', color: '#ff7847',
    desc: 'Hand contains Four of a Kind → Pips ×3.',
    flavor: 'Four corners, one frequency.', rarity: 'rare', archetype: 'combo',
    archetypeTags: ['combo'] },
  { id: 'apex', name: 'Apex', icon: '✦', color: '#ffd84a',
    desc: 'Five of a Kind → Mult ×3, plus +1 Mult per matching scoring die.',
    flavor: 'Every face the same. Every face higher.', rarity: 'rare', archetype: 'combo',
    archetypeTags: ['combo', 'face'] },
  { id: 'chance_doctrine', name: 'Chance Doctrine', icon: '?', color: '#c0c8ff',
    desc: 'Chance hand → +20 Pips and +4 Mult per scoring die.',
    flavor: 'When nothing matches, score everything.', rarity: 'uncommon', archetype: 'combo',
    archetypeTags: ['combo'] },
  { id: 'low_choir', name: 'Low Choir', icon: '⫯', color: '#88ddff',
    desc: 'Each scoring face ≤2 → +3 Mult.',
    flavor: 'Bass register. Carries farther.', rarity: 'uncommon', archetype: 'face',
    archetypeTags: ['face'] },
  { id: 'harmonic', name: 'Harmonic', icon: '∿', color: '#bba8ff',
    desc: 'Each mod id repeated across dice → +25 Pips, ×1.25 Mult.',
    flavor: 'Two strings tuned same. The room rings.', rarity: 'rare', archetype: 'mods',
    archetypeTags: ['mods'] },
  { id: 'metronome', name: 'Metronome', icon: '♩', color: '#5be8a4',
    desc: 'Odd hand → Pips ×1.5. Even hand → Mult ×1.5.',
    flavor: 'Tick. Tock. Both pay.', rarity: 'rare', archetype: 'timing',
    archetypeTags: ['timing'] },
  { id: 'prime_resonance', name: 'Prime Resonance', icon: 'ℜ', color: '#a080c0',
    desc: 'Mult raised to the power 1.10 per scoring die.',
    flavor: 'Exponentials wear thin clothing.', rarity: 'rare', archetype: 'scaling',
    archetypeTags: ['scaling'] },

  // Phase 5d — non-pipeline catalysts: their effects fire in lifecycle
  // hooks (skip-blind, sell-refund) rather than the per-hand upgrades pass.
  { id: 'silver_tongue', name: 'Silver Tongue', icon: '✎', color: '#a4d4ff',
    desc: 'When you skip a blind, gain 2 random consumables.',
    flavor: 'Talk your way past the trial. Pocket the favor.', rarity: 'uncommon', archetype: 'utility',
    archetypeTags: ['utility'] },
  { id: 'dust_off', name: 'Dust-Off', icon: '⤺', color: '#bba8ff',
    desc: 'Shop reroll cost −1 shard (min 0).',
    flavor: 'A quick scrub for the night-market dust.', rarity: 'common', archetype: 'utility',
    archetypeTags: ['utility', 'economy'] },

  // Phase 5e — lifecycle catalysts (need round-state counters or hooks).
  { id: 'crescendo_run', name: 'Crescendo Run', icon: '↗', color: '#5be8a4',
    desc: '×2 Mult after 3+ rolls in a round without locking a die.',
    flavor: 'The pace builds. Don\'t hold back.', rarity: 'uncommon', archetype: 'scaling',
    archetypeTags: ['scaling', 'utility'] },
  { id: 'shard_lung', name: 'Shard Lung', icon: '⛁', color: '#f5c451',
    desc: 'Round start: +ceil(ante/2) shards. Score: spend half shards for +Mult.',
    flavor: 'Inhale. Exhale. The vault pays the breath.', rarity: 'uncommon', archetype: 'economy',
    archetypeTags: ['economy', 'scaling'] },

  // Phase 5f — bust-hook + mod-density catalysts.
  { id: 'audit', name: 'Audit', icon: '☷', color: '#a4d4ff',
    desc: 'Round start: +1 shard. On bust: refund 50% of catalyst spend, self-destructs.',
    flavor: 'The ledger closes. Some debts unwind.', rarity: 'uncommon', archetype: 'utility',
    archetypeTags: ['utility', 'economy', 'risk'] },
  { id: 'gilding_press', name: 'Gilding Press', icon: '⊟', color: '#f5c451',
    desc: 'The first mod on each scoring die fires twice for pips.',
    flavor: 'A second strike on every plate.', rarity: 'uncommon', archetype: 'mods',
    archetypeTags: ['mods'] },

  // Phase 5g — wide-hand bonus.
  { id: 'mod_gravity', name: 'Mod Gravity', icon: '◐', color: '#cc88ff',
    desc: '+10 Mult when 4 or more dice score this hand.',
    flavor: 'Mass attracts mass. The crowd tilts.', rarity: 'uncommon', archetype: 'mods',
    archetypeTags: ['mods', 'combo'] },

  // 2026-05-08 balance pack — 12 deliberately strong catalysts added to
  // lift Spark (lowest difficulty) clear-rate from 0% to ~70%. Sims in
  // src-next/data/balance.fullrun.sim.test.ts gate the tuning.
  { id: 'lucky_streak', name: 'Lucky Streak', icon: '🍀', color: '#5be8a4',
    desc: 'First scoring hand of round: +30 pips, +3 mult.',
    flavor: 'The first throw of the night always lands sweetest.', rarity: 'common', archetype: 'combo',
    archetypeTags: ['timing'] },
  { id: 'face_value', name: 'Face Value', icon: '◇', color: '#7be3ff',
    desc: 'Each scoring 4 → +3 pips, +1 mult.',
    flavor: 'Honest middle. Pays anyway.', rarity: 'common', archetype: 'face',
    archetypeTags: ['face'] },
  { id: 'first_strike', name: 'First Strike', icon: '⚡', color: '#ffd84a',
    desc: 'First scoring hand of each blind: +50 pips, +5 mult.',
    flavor: 'Lead with the loudest swing.', rarity: 'common', archetype: 'scaling',
    archetypeTags: ['timing'] },
  { id: 'momentum', name: 'Momentum', icon: '➤', color: '#ff7847',
    desc: 'Each cleared trial: ×1.4 mult permanent (resets on bust).',
    flavor: 'The wheel keeps turning. The wheel keeps paying.', rarity: 'uncommon', archetype: 'scaling',
    archetypeTags: ['scaling', 'timing'] },
  { id: 'dice_master', name: 'Dice Master', icon: '⚂', color: '#bba8ff',
    desc: '+1 reroll per hand.',
    flavor: 'A steadier hand. A wider net.', rarity: 'uncommon', archetype: 'utility',
    archetypeTags: ['utility'] },
  { id: 'prism_lens', name: 'Prism Lens', icon: '◆', color: '#cc88ff',
    desc: 'Any combo (not Chance): +25 pips, ×1.5 mult.',
    flavor: 'Bend the light, brighten the verdict.', rarity: 'uncommon', archetype: 'combo',
    archetypeTags: ['combo'] },
  { id: 'streak_seeker', name: 'Streak Seeker', icon: '↟', color: '#5be8a4',
    desc: 'Every 4th hand of run: ×2 mult.',
    flavor: 'Count to four. Strike on four.', rarity: 'uncommon', archetype: 'timing',
    archetypeTags: ['timing'] },
  { id: 'nova_burst', name: 'Nova Burst', icon: '✷', color: '#ff7847',
    desc: 'Mult ×(1 + ante × 0.4). Ante 4 → ×2.6.',
    flavor: 'Each ante a deeper detonation.', rarity: 'rare', archetype: 'scaling',
    archetypeTags: ['scaling'] },
  { id: 'high_roller', name: 'High Roller', icon: '⬆', color: '#ffd84a',
    desc: 'Each scoring 5 or 6 → +2 pips, +1 mult.',
    flavor: 'The top of the range, paid in full.', rarity: 'rare', archetype: 'face',
    archetypeTags: ['face'] },
  { id: 'royal_flush', name: 'Royal Flush', icon: '♛', color: '#ffd84a',
    desc: 'Four of a Kind, Five of a Kind, or Large Straight: +200 pips, ×2 mult.',
    flavor: 'When the rare hands hit, the room goes still.', rarity: 'rare', archetype: 'combo',
    archetypeTags: ['combo'] },
  { id: 'economy_engine', name: 'Economy Engine', icon: '⚙', color: '#f5c451',
    desc: 'Each shard held → +0.1 mult (uncapped).',
    flavor: 'The vault hums. Every coin sings.', rarity: 'rare', archetype: 'economy',
    archetypeTags: ['economy', 'scaling'] },
  { id: 'eclipse_pact', name: 'Eclipse Pact', icon: '🌑', color: '#a080c0',
    desc: 'Every scoring hand: +50 pips, +5 mult.',
    flavor: 'Sign once. Score forever.', rarity: 'legendary', archetype: 'combo',
    archetypeTags: ['combo', 'timing'] },

  // ─── Constellation-Locked Catalysts (Phase 7) ─────────────────
  // One per playable constellation. Only appear in the shop pool when
  // that constellation is active. Modest power baseline — the
  // selection-restriction itself is part of the value.
  { id: 'lyric_pulse', name: 'Lyric Pulse', icon: '🎼', color: '#7be3ff',
    desc: 'One Pair → ×1.3 mult.',
    flavor: 'The simplest match still hums in tune.',
    rarity: 'uncommon', archetype: 'combo',
    archetypeTags: ['combo'],
    requiresConstellation: 'lyra' },
  { id: 'crowded_table', name: 'Crowded Table', icon: '◫', color: '#cc88ff',
    desc: 'Each scoring die past the fifth → +1 mult.',
    flavor: 'Seven seats. Every chair pays.',
    rarity: 'uncommon', archetype: 'face',
    archetypeTags: ['face', 'scaling'],
    requiresConstellation: 'mensa' },
  { id: 'three_sigil', name: 'Three Sigil', icon: '◬', color: '#cc88ff',
    desc: 'Any straight → ×2 mult (Triumvirate scoring).',
    flavor: 'Three carved lines. The third closes.',
    rarity: 'rare', archetype: 'combo',
    archetypeTags: ['combo'],
    requiresConstellation: 'triumvirate' },
  { id: 'captains_wage', name: "Captain's Wage", icon: '⚓', color: '#f5c451',
    desc: 'Each scoring face ≥ 10 → +5 pips.',
    flavor: 'The crew expects their cut.',
    rarity: 'uncommon', archetype: 'face',
    archetypeTags: ['face'],
    requiresConstellation: 'argo' },
  { id: 'golden_ratio', name: 'Golden Ratio', icon: 'φ', color: '#f5c451',
    desc: 'Each scoring 8 → +12 pips.',
    flavor: 'Each step a perfect division.',
    rarity: 'uncommon', archetype: 'face',
    archetypeTags: ['face'],
    requiresConstellation: 'fibonacci' },
  { id: 'penumbra', name: 'Penumbra', icon: '◐', color: '#a080c0',
    desc: 'All scoring dice show the same value → ×3 mult.',
    flavor: 'When every shadow aligns.',
    rarity: 'rare', archetype: 'combo',
    archetypeTags: ['combo', 'face'],
    requiresConstellation: 'eclipse' },
  { id: 'mosaic_bias', name: 'Mosaic Bias', icon: '⬡', color: '#5be8a4',
    desc: '+0.5 mult per distinct die-shape this hand.',
    flavor: 'Five shapes. Five voices. One verdict.',
    rarity: 'uncommon', archetype: 'face',
    archetypeTags: ['face', 'scaling'],
    requiresConstellation: 'polyhedra' },
  { id: 'wildcard_waltz', name: 'Wildcard Waltz', icon: '✺', color: '#ff7847',
    desc: 'Each scoring wildcard die → +25 pips.',
    flavor: 'The wildcard always knows the steps.',
    rarity: 'uncommon', archetype: 'face',
    archetypeTags: ['face'],
    requiresConstellation: 'ophiuchus' },

  // ─── Scaling pack (2026-05-11) ────────────────────────────────────
  // Per-catalyst stack counter in run.catalystStacks. Each catalyst
  // surfaces its current stack as a corner badge on the strip card +
  // a "currently" line in the tooltip (see CatalystStrip). The
  // counter is the dopamine; tune multipliers conservatively.
  { id: 'star_chart', name: 'Star Chart', icon: '🜨', color: '#7be3ff',
    desc: 'Each scored Straight permanently adds +0.25× mult to this catalyst.',
    flavor: 'Each line drawn becomes the next.',
    rarity: 'uncommon', archetype: 'scaling',
    archetypeTags: ['scaling', 'combo'] },
  { id: 'lodestone', name: 'Lodestone', icon: '◈', color: '#a4d4ff',
    desc: 'Each scored Pair permanently adds +2 pips.',
    flavor: 'A simple stone, magnetised by repetition.',
    rarity: 'common', archetype: 'scaling',
    archetypeTags: ['scaling', 'combo'] },
  { id: 'comet_trail', name: 'Comet Trail', icon: '☄', color: '#88ddff',
    desc: 'Each blind cleared without using a consumable: +10 pips permanent. Resets on use.',
    flavor: 'Long, bright lines only the patient see.',
    rarity: 'uncommon', archetype: 'scaling',
    archetypeTags: ['scaling', 'utility'] },
  { id: 'memento_star', name: 'Memento Star', icon: '✦', color: '#ffd84a',
    desc: 'Clearing a blind with 200%+ of target → +0.5× mult permanent.',
    flavor: 'The overflow remembers itself.',
    rarity: 'rare', archetype: 'scaling',
    archetypeTags: ['scaling', 'timing'] },
  { id: 'ouroboros', name: 'Ouroboros', icon: '∞', color: '#cc88ff',
    desc: 'Score the same combo tier 3× in one blind → +3 mult permanent.',
    flavor: 'A circle is its own argument.',
    rarity: 'rare', archetype: 'scaling',
    archetypeTags: ['scaling', 'combo'] },
  { id: 'lunar_phases', name: 'Lunar Phases', icon: '☾', color: '#bba8ff',
    desc: '8-phase cycle, advances each hand. Full Moon bakes +0.1× mult permanent, then resets.',
    flavor: 'New, waxing, full, waning. The fourth is yours.',
    rarity: 'rare', archetype: 'scaling',
    archetypeTags: ['scaling', 'timing'] },
  { id: 'tide', name: 'Tide', icon: '◐', color: '#5be8a4',
    desc: 'Alternates Ebb (odd hand: +pips pool) / Flow (even hand: +mult pool). Each cycle adds +1 to both pools.',
    flavor: 'The water is never done counting.',
    rarity: 'uncommon', archetype: 'scaling',
    archetypeTags: ['scaling', 'timing'] },
  { id: 'event_horizon', name: 'Event Horizon', icon: '●', color: '#a080c0',
    desc: 'Whenever any single die contributes 100+ to a hand, absorb 1% as permanent ×mult.',
    flavor: 'Nothing escapes the falling number.',
    rarity: 'rare', archetype: 'scaling',
    archetypeTags: ['scaling'] },
  { id: 'highwater', name: 'Highwater', icon: '↟', color: '#5be8a4',
    desc: 'Each new personal-best hand this run → +1 mult permanent.',
    flavor: 'Tide lines mark the years.',
    rarity: 'uncommon', archetype: 'scaling',
    archetypeTags: ['scaling'] },
  { id: 'heirloom_locket', name: 'Heirloom Locket', icon: '♡', color: '#f5c451',
    desc: 'Each cleared blind: +0.15× mult permanent. Carries half its current bonus into the next run.',
    flavor: "A bequest. Heavier than its size.",
    rarity: 'legendary', archetype: 'scaling',
    archetypeTags: ['scaling', 'timing'] },

  // ─── Retrigger pack (2026-05-11) ──────────────────────────────────
  // All implemented inline in core/phases/upgrades.ts (after applyEncore)
  // because they have to re-run the per-die mod loop AFTER applyModScoring.
  // The metadata + ownership check is enough at the data layer.
  { id: 'polaris', name: 'Polaris', icon: '★', color: '#ffd84a',
    desc: 'The highest-face scoring die retriggers once.',
    flavor: 'Find the still point and the rest moves.',
    rarity: 'uncommon', archetype: 'mods',
    archetypeTags: ['mods', 'face'] },
  // 2026-05-12 QA fix: renamed to "Rotor" — palindrome that still reads as
  // a cyclic/repeating motif, fitting the retrigger flavor. Pairs with
  // "Solos" to make the Mirrored Hand egg reachable.
  { id: 'refrain', name: 'Rotor', icon: '⤺', color: '#cc88ff',
    desc: 'If this hand matches the previous hand\'s combo tier: every scoring die retriggers once.',
    flavor: 'The chorus repeats. The chorus pays.',
    rarity: 'rare', archetype: 'mods',
    archetypeTags: ['mods', 'timing', 'combo'] },
  { id: 'mirror_edge', name: 'Mirror Edge', icon: '⫯', color: '#a4d4ff',
    desc: 'Dice that were locked before scoring retrigger once.',
    flavor: 'The patient die reflects twice.',
    rarity: 'uncommon', archetype: 'mods',
    archetypeTags: ['mods', 'utility'] },
  { id: 'curtain_call', name: 'Curtain Call', icon: '⌬', color: '#ff7847',
    desc: 'On the final hand of a blind, all scoring dice retrigger once.',
    flavor: 'Bow late. Bow loud.',
    rarity: 'rare', archetype: 'timing',
    archetypeTags: ['timing', 'mods'] },
  { id: 'stutter', name: 'Stutter', icon: '⫶', color: '#bba8ff',
    desc: '25% per scoring die to retrigger. Guaranteed if scoring count is prime (2/3/5/7).',
    flavor: 'A skip in the record makes a chorus.',
    rarity: 'uncommon', archetype: 'mods',
    archetypeTags: ['mods'] },
  { id: 'recursion_lens', name: 'Recursion Lens', icon: '◉', color: '#a080c0',
    desc: 'All retriggers fire twice this hand.',
    flavor: 'A lens that points back at itself.',
    rarity: 'legendary', archetype: 'mods',
    archetypeTags: ['mods', 'scaling'] },
  { id: 'cardinal_compass', name: 'Cardinal Compass', icon: '✛', color: '#88ddff',
    desc: 'Scoring dice showing 4 retrigger once.',
    flavor: 'The mid-needle steady.',
    rarity: 'common', archetype: 'face',
    archetypeTags: ['face', 'mods'] },
  { id: 'echo_chamber', name: 'Echo Chamber', icon: '⫷', color: '#bba8ff',
    desc: 'When 4+ dice score, the first scoring die fires its mods twice.',
    flavor: 'A wide room sustains a single note.',
    rarity: 'uncommon', archetype: 'mods',
    archetypeTags: ['mods', 'combo'] },

  // ─── Unheld + collision pack (2026-05-13) ─────────────────────────
  // Two new pipeline phases (UNHELD_SCAN, ON_COLLISION) opened up two
  // archetypes nothing previously paid off: the dice you dropped, and
  // the chaos of the tumble itself.
  { id: 'shadow_cache', name: 'Shadow Cache', icon: '⬚', color: '#a4d4ff',
    desc: 'Each unheld die showing 5+ → +3 pips.',
    flavor: 'The dice you set aside still owe you something.',
    rarity: 'common', archetype: 'face',
    archetypeTags: ['face'] },
  { id: 'reservoir', name: 'Reservoir', icon: '⛁', color: '#5be8a4',
    desc: '+1 chip per pip on every unheld die.',
    flavor: 'Nothing rolled is ever truly wasted.',
    rarity: 'common', archetype: 'face',
    archetypeTags: ['face'] },
  { id: 'silent_witness', name: 'Silent Witness', icon: '◌', color: '#cc88ff',
    desc: 'All unheld dice even (and ≥2 unheld) → +10 pips, ×1.1 mult.',
    flavor: 'The half you ignored is paying attention.',
    rarity: 'uncommon', archetype: 'combo',
    archetypeTags: ['face', 'combo'] },
  { id: 'unseen_chorus', name: 'Unseen Chorus', icon: '⋮', color: '#bba8ff',
    desc: '3+ unheld dice, all different values → ×1.5 mult.',
    flavor: 'They sing in the back of the room.',
    rarity: 'uncommon', archetype: 'combo',
    archetypeTags: ['face', 'combo'] },
  { id: 'kinetic_charge', name: 'Kinetic Charge', icon: '⚡', color: '#ffd84a',
    desc: 'Each die collision in the tray → +1 chip (cap +30).',
    flavor: 'Every bump is a tiny dividend.',
    rarity: 'common', archetype: 'collision',
    archetypeTags: ['collision'] },
  { id: 'chain_reaction', name: 'Chain Reaction', icon: '⛓', color: '#ff7847',
    desc: '15+ collisions this roll → ×1.5 mult.',
    flavor: 'Cascade past the threshold and the room ignites.',
    rarity: 'uncommon', archetype: 'collision',
    archetypeTags: ['collision'] },
  { id: 'kindred_clatter', name: 'Kindred Clatter', icon: '◈', color: '#a080c0',
    desc: '+3 mult for each collision between dice that ended on the same value.',
    flavor: 'Twins find each other in mid-air.',
    rarity: 'rare', archetype: 'collision',
    archetypeTags: ['collision', 'face'] },
  // 2026-05-16 risk pack — tradeoff catalysts. Each pairs a real
  // upside with an explicit downside the player has to plan around.
  { id: 'bone_tax', name: 'Bone Tax', icon: '☠', color: '#ff4d6d',
    desc: '+5 mult per scoring die. Pips ×0.85 each hand.',
    flavor: 'The table eats first. What\'s left, you keep.',
    rarity: 'uncommon', archetype: 'risk',
    archetypeTags: ['risk'] },
  { id: 'hollow_bishop', name: 'Hollow Bishop', icon: '♟', color: '#cc88ff',
    desc: 'Full House and above: +12 mult. One Pair and Two Pair: pips ×0.5.',
    flavor: 'A bishop only moves diagonal. Stop crawling sideways.',
    rarity: 'rare', archetype: 'risk',
    archetypeTags: ['combo', 'risk'] },
  { id: 'witchs_bargain', name: 'Witch\'s Bargain', icon: '🜍', color: '#a080c0',
    desc: 'Mult ×1.4 every hand. Each scoring die: -8 pips before the multiplier.',
    flavor: 'The price is named. Pay it once, pay it every time.',
    rarity: 'uncommon', archetype: 'risk',
    archetypeTags: ['risk'] },
  // 2026-05-16 unlock-content roadmap (10 catalysts).
  // See docs/unlock-gated-content-roadmap.md for unlock conditions.
  { id: 'cosmic_compass', name: 'Cosmic Compass', icon: '✦', color: '#7be3ff',
    desc: 'Each cleared blind: +0.05× mult permanent (cap +0.5× per ante).',
    flavor: 'Three skies remembered. The fourth points itself.',
    rarity: 'rare', archetype: 'scaling',
    archetypeTags: ['scaling', 'timing'] },
  { id: 'voidwalker', name: 'Voidwalker', icon: '⊘', color: '#aa66ff',
    desc: 'While in Cosmic Lap N: +N mult per owned catalyst, per hand.',
    flavor: 'The fourth orbit. The fifth. The horizon stops mattering.',
    rarity: 'legendary', archetype: 'scaling',
    archetypeTags: ['scaling'] },
  { id: 'crown_of_skulls', name: 'Crown of Skulls', icon: '☠', color: '#ff4d6d',
    desc: 'Mult ×3 every hand. Lose 1 hand at blind start.',
    flavor: 'Worn by the patient. Earned by the willing.',
    rarity: 'legendary', archetype: 'risk',
    archetypeTags: ['risk'] },
  { id: 'the_patient', name: 'The Patient', icon: '⌛', color: '#cc88ff',
    desc: 'Every 3rd hand of the run: +50 pips and +3 mult.',
    flavor: 'The waiting catalyst that learned from the master.',
    rarity: 'rare', archetype: 'timing',
    archetypeTags: ['timing'] },
  { id: 'salt_of_earth', name: 'Salt of the Earth', icon: '◆', color: '#f5c451',
    desc: 'Each hand: +1 shard if shards < 5. Otherwise no effect.',
    flavor: 'The pantry catalyst. Fills until full.',
    rarity: 'uncommon', archetype: 'economy',
    archetypeTags: ['economy', 'timing'] },
  { id: 'stargazer', name: 'Stargazer', icon: '⋆', color: '#bba8ff',
    desc: '+1 mult per distinct face value seen this run (uncapped).',
    flavor: 'Every face logged. Every face counts.',
    rarity: 'rare', archetype: 'face',
    archetypeTags: ['face', 'scaling'] },
  { id: 'bloodied_coin', name: 'Bloodied Coin', icon: '◉', color: '#ff7847',
    desc: 'Each owned Risk catalyst (Bone Tax, Hollow Bishop, etc.): +6 mult per hand.',
    flavor: 'Pay the tax twice, keep the savings thrice.',
    rarity: 'rare', archetype: 'risk',
    archetypeTags: ['risk', 'scaling'] },
  { id: 'the_confessor', name: 'The Confessor', icon: '⫶', color: '#bba8ff',
    desc: 'Each die with 3+ mod slots filled: +3 mult per hand.',
    flavor: 'A heavy die speaks twice.',
    rarity: 'uncommon', archetype: 'mods',
    archetypeTags: ['mods'] },
  { id: 'hourglass', name: 'Hourglass', icon: '⧗', color: '#f5c451',
    desc: '+1 hand per blind. Blind target +10%.',
    flavor: 'More breath, more weight.',
    rarity: 'rare', archetype: 'timing',
    archetypeTags: ['timing', 'utility', 'risk'] },
  { id: 'the_reckoning', name: 'The Reckoning', icon: '✦', color: '#ff7847',
    desc: 'First hand of every blind: Mult ×2 and +50 pips.',
    flavor: 'The cosmos remembers what you found.',
    rarity: 'legendary', archetype: 'combo',
    archetypeTags: ['timing', 'combo'] },

  // 2026-05-18 audit additions — fill design gaps surfaced by the
  // 2026-05-16 balance audit.
  { id: 'piggy_bank', name: 'Piggy Bank', icon: '◆', color: '#5be8a4',
    desc: 'Each hand: bank 10% of pips as shards (cap +5/hand).',
    flavor: 'Every coin saved is a coin earned tomorrow.',
    rarity: 'uncommon', archetype: 'economy',
    archetypeTags: ['economy'] },
  { id: 'runaway', name: 'Runaway', icon: '➹', color: '#c0c8ff',
    desc: 'Each scored straight: +1 stack. Each stack: +0.10× Mult.',
    flavor: 'A line that builds on itself.',
    rarity: 'uncommon', archetype: 'scaling',
    archetypeTags: ['scaling', 'combo'] },
  { id: 'double_or_nothing', name: 'Double or Nothing', icon: '⚄', color: '#e2334a',
    desc: '50% chance: Mult ×2. Otherwise: Mult ×0.5. (EV ×1.25)',
    flavor: "The house's favorite game.",
    rarity: 'rare', archetype: 'risk',
    archetypeTags: ['risk'] },
  { id: 'resonance_cascade', name: 'Resonance Cascade', icon: '∿', color: '#7be3ff',
    desc: 'Each collision: +1 stack. Each stack: +0.05× Mult. Cap +20.',
    flavor: 'Small taps echo louder together.',
    rarity: 'rare', archetype: 'collision',
    archetypeTags: ['collision', 'scaling'] },
  { id: 'leveling', name: 'Leveling', icon: '☰', color: '#bba8ff',
    desc: 'Three of a Kind and below count as one tier higher.',
    flavor: 'Three stones build as high as four.',
    rarity: 'uncommon', archetype: 'combo',
    archetypeTags: ['combo'],
    requiresConstellation: 'triumvirate' },

  // 2026-05-19 shard-scaling pack — three lower-rarity catalysts whose
  // power scales with the player's live shard balance. Fills out the
  // shard-hoarder build at every rarity below the mythic Hoarder's Crown.
  // No unlock gate; appear in the standard shop draw.
  { id: 'counter_purse', name: "Counter's Purse", icon: '⛁', color: '#f5c451',
    desc: 'Each 3 shards held: +1 Chip per scored die this hand.',
    flavor: 'Coins counted twice. The hand pays accordingly.',
    rarity: 'common', archetype: 'economy',
    archetypeTags: ['economy', 'scaling'] },
  { id: 'magpie', name: 'Magpie', icon: '◆', color: '#f5c451',
    desc: 'Each 5 shards held: +1 Mult.',
    flavor: 'Bright in the nest. Brighter on the table.',
    rarity: 'uncommon', archetype: 'scaling',
    archetypeTags: ['economy', 'scaling'] },
  { id: 'vault_heart', name: 'Vault Heart', icon: '◈', color: '#f5c451',
    desc: 'Each 10 shards held: ×1.10 Mult (compounds — 30 shards = ×1.33).',
    flavor: 'Locked weight. Each threshold turns the dial.',
    rarity: 'rare', archetype: 'scaling',
    archetypeTags: ['economy', 'scaling'] },

  // 2026-05-19 mythic tier — 5 build-defining catalysts gated behind
  // per-id unlock conditions (see checkMythicUnlocks in transitions.ts).
  // Price: 20 shards (vs 5 for every other rarity). Only appear from
  // ante 3+; rate boosted in Cosmic Laps to reward endless play.
  { id: 'singularity_engine', name: 'Singularity Engine', icon: '✸', color: '#ff7847',
    desc: 'Each shard you hold: +0.5 Mult AND +5 Pips this hand.',
    flavor: 'Compress every coin to a single point. The point screams.',
    rarity: 'mythic', archetype: 'scaling',
    archetypeTags: ['economy', 'scaling'] },
  { id: 'cosmic_anchor', name: 'Cosmic Anchor', icon: '⚓', color: '#7be3ff',
    desc: 'Cosmic affliction target taxes halved; compounding-tax accrues 50% slower.',
    flavor: 'Drop weight against the pull. The current still moves you.',
    rarity: 'mythic', archetype: 'mods',
    archetypeTags: ['utility', 'mods'] },
  { id: 'voidforge', name: 'Voidforge', icon: '✦', color: '#cc88ff',
    desc: 'Each blind cleared: +1 permanent Mult to every hand. Resets on bust.',
    flavor: 'Hammer the dark until it remembers your shape.',
    rarity: 'mythic', archetype: 'scaling',
    archetypeTags: ['scaling', 'timing', 'risk'] },
  { id: 'hoarders_crown', name: "Hoarder's Crown", icon: '♛', color: '#ffd84a',
    desc: 'Per shard above 10: +0.2 Mult. Above 20: also +1 Chip. Above 30: also ×1.10 Mult (compounds).',
    flavor: 'Wear the pile. The pile wears you.',
    rarity: 'mythic', archetype: 'economy',
    archetypeTags: ['economy', 'scaling'] },
  { id: 'eclipse_heart', name: 'Eclipse Heart', icon: '◐', color: '#a080c0',
    desc: 'Permanent: +2 Hands per blind, +1 catalyst slot.',
    flavor: 'A second beat under the first. The dark keeps time.',
    rarity: 'mythic', archetype: 'risk',
    archetypeTags: ['utility', 'risk'] },
  // 2026-05-19 locked-dice archetype pair. Patience's Reward rewards
  // committed plays (all dice locked); Sunk Cost punishes spam-rerolls
  // (compounding 0.85× per reroll, per blind). Asymmetric synergy with
  // crescendo_run (no-lock reward).
  { id: 'patiences_reward', name: "Patience's Reward", icon: '⏸', color: '#88ddff',
    desc: 'All dice locked at score time: ×1.8 mult (this hand).',
    flavor: 'The waiting is the work.',
    rarity: 'rare', archetype: 'timing',
    archetypeTags: ['timing', 'utility'] },
  { id: 'sunk_cost', name: 'Sunk Cost', icon: '⛓', color: '#ff7847',
    desc: 'Each reroll this blind: current hand mult ×0.85 (compounds).',
    flavor: 'Every recall costs the next.',
    rarity: 'rare', archetype: 'risk',
    archetypeTags: ['risk', 'utility'] },
];

export function lookupCatalyst(id: string): CatalystMeta | undefined {
  return CATALYST_META.find((c) => c.id === id);
}

// 2026-05-11 scaling pack — id sets used by the HUD/audio layer to
// classify a catalyst fire into 'scaling' vs 'retrigger' vs the
// existing 'fire'/'fire-legendary' kinds. Keep these aligned with the
// metadata above; new catalysts in the same family should be added here
// so the polish (pulse kind, audio voice, postmortem panel) picks them up
// automatically.
export const SCALING_CATALYST_IDS: ReadonlySet<string> = new Set([
  'star_chart', 'lodestone', 'comet_trail', 'memento_star', 'ouroboros',
  'lunar_phases', 'tide', 'event_horizon', 'highwater', 'heirloom_locket',
  // Existing scaling catalysts that pre-date the 2026-05-11 pack but
  // share the same "permanent stack accrued over the run" feel.
  'compounding_bias', 'momentum',
  // 2026-05-16 unlock-content roadmap — Cosmic Compass + Stargazer
  // both accumulate per-run state via the catalystStacks slot, so they
  // pick up the scaling visual treatment (pulse kind + audio voice).
  'cosmic_compass', 'stargazer',
  // 2026-05-19 shard-scaling + mythic pack — these scale with shards
  // held or per-blind stacks. Mythic Voidforge accrues in catalystStacks
  // like the 2026-05-11 pack; the rest scale off live shard balance.
  'magpie', 'vault_heart', 'counter_purse',
  'singularity_engine', 'hoarders_crown', 'voidforge',
]);

export const RETRIGGER_CATALYST_IDS: ReadonlySet<string> = new Set([
  'polaris', 'refrain', 'mirror_edge', 'curtain_call', 'stutter',
  'recursion_lens', 'cardinal_compass', 'echo_chamber',
  // Existing retrigger catalysts.
  'encore', 'gilding_press',
  // Easter-egg retrigger uses the same audio/visual class.
  'mirrored_hand',
]);

// 2026-05-13 — collision-pack catalysts. Drive a distinct pulse kind on
// the CatalystStrip (sharp electric flash) and a punchier SFX class so
// the tray-physics origin of the trigger reads in the moment.
// Read by:
//   - app/hud/CatalystStrip.tsx     (pulse + ring color)
//   - audio/listeners/scalingSfx.ts (SFX voice routing)
export const COLLISION_CATALYST_IDS: ReadonlySet<string> = new Set([
  'kinetic_charge', 'chain_reaction', 'kindred_clatter',
]);

// Awakening — once a catalyst has fired N times in a single run, it
// reads as "Awakened" with a ★ badge on the strip. v1 is purely
// cosmetic; mechanical scaling will follow once playtesting confirms
// the right multipliers per archetype. Key off the catalyst id with
// undefined = not awakening-eligible.
export const AWAKENING_THRESHOLDS: Record<string, number> = {
  // High-fire-rate catalysts — these tick every hand or close to it,
  // so 8 fires lands around mid-Ante 2.
  six_bias: 8,
  iron_six: 8,
  pair_dynamo: 8,
  cold_hand: 8,
  // Build-defining catalysts that fire less frequently — lower bar
  // (5) so the player can see awakening even on focused runs.
  stratifier: 5,
  triplet_engine: 5,
  conductor: 5,
  encore: 5,
  // Scaling catalysts that gate naturally on hand count — pair their
  // awakening with their natural progression.
  tempo: 6,
  patience_counter: 3,
  compounding_bias: 4,
};

export function awakeningThreshold(id: string): number | undefined {
  return AWAKENING_THRESHOLDS[id];
}

export function isAwakened(id: string, fires: number): boolean {
  const t = AWAKENING_THRESHOLDS[id];
  return t != null && fires >= t;
}
