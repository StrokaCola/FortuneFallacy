// Hand-authored SVG glyphs for catalyst icons. Replaces emoji
// pictographs (👁 📈 🔢 💬 🔔 🌑 🍀 🎼 ⏳ 💠) that previously rendered
// differently on every OS — Mac's Apple Color Emoji vs Windows' Segoe
// UI Emoji vs Android's Noto Color Emoji etc. — with thin-stroke
// line-art sigils that the studio controls.
//
// Style guide:
//   - viewBox="0 0 24 24"
//   - fill="none", stroke={color}, strokeWidth=1.5
//   - strokeLinecap="round" + strokeLinejoin="round"
//   - small enough to read at 16-24 px, dense enough to feel deliberate
//   - matches the celestial / alchemy / sigil register of the boss
//     sigils in `data/blinds.ts` — geometric, symmetric, ink-on-velum
//
// Catalysts that already use plain Unicode dingbats (∆ ◈ ★ ✦ etc.)
// don't need entries here — those render consistently across systems
// and the existing identity is fine. Add a renderer here only when:
//   - the catalyst's icon is a TRUE emoji (codepoint ≥ U+1F000) OR
//   - the icon is in a block known to differ across OSes (👁, 💠, 💬,
//     📈, 🔔, 🔢, 🌑, 🍀, 🎼)
//
// Adding more glyphs is incremental — `<CatalystIcon>` falls back to
// the catalyst's existing `icon` char when no entry is registered, so
// the migration can ship one sigil at a time.

import type React from 'react';

export type CatalystIconRenderer = (color: string, size: number) => React.ReactNode;

const baseSvgProps = (color: string, size: number) => ({
  viewBox: '0 0 24 24',
  width: size,
  height: size,
  fill: 'none' as const,
  stroke: color,
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const CATALYST_ICON_SVGS: Record<string, CatalystIconRenderer> = {
  // Stratifier — full-house pay-off. Eye-shaped sigil composed of an
  // outer almond + a central pupil + 5 dots arranged 3-over-2 to
  // reference the full-house combo.
  stratifier: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M3 12 C 6 6, 18 6, 21 12 C 18 18, 6 18, 3 12 Z" />
      <circle cx="12" cy="12" r="2.5" fill={color} stroke="none" />
      <circle cx="9" cy="8.5" r="0.6" fill={color} stroke="none" />
      <circle cx="12" cy="7.5" r="0.6" fill={color} stroke="none" />
      <circle cx="15" cy="8.5" r="0.6" fill={color} stroke="none" />
      <circle cx="10.5" cy="16" r="0.6" fill={color} stroke="none" />
      <circle cx="13.5" cy="16" r="0.6" fill={color} stroke="none" />
    </svg>
  ),

  // Six Bias — "Each 6 → +4 chips". Six dots in a die-face 2x3, with
  // an upward arrow indicating the bias.
  six_bias: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <rect x="4" y="4" width="11" height="16" rx="2" />
      <circle cx="7.5" cy="7.5" r="1" fill={color} stroke="none" />
      <circle cx="11.5" cy="7.5" r="1" fill={color} stroke="none" />
      <circle cx="7.5" cy="12" r="1" fill={color} stroke="none" />
      <circle cx="11.5" cy="12" r="1" fill={color} stroke="none" />
      <circle cx="7.5" cy="16.5" r="1" fill={color} stroke="none" />
      <circle cx="11.5" cy="16.5" r="1" fill={color} stroke="none" />
      <path d="M19 18 L19 8 M16 11 L19 8 L22 11" />
    </svg>
  ),

  // Twin Sample — "Two pair → chips ×2". Two adjacent matched dice.
  twin_sample: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <rect x="2" y="6" width="9" height="12" rx="1.5" />
      <rect x="13" y="6" width="9" height="12" rx="1.5" />
      <circle cx="5" cy="10" r="0.9" fill={color} stroke="none" />
      <circle cx="8" cy="14" r="0.9" fill={color} stroke="none" />
      <circle cx="16" cy="10" r="0.9" fill={color} stroke="none" />
      <circle cx="19" cy="14" r="0.9" fill={color} stroke="none" />
    </svg>
  ),

  // Cold Hand — "Chance → +4 mult". Gambler-table speech bubble:
  // a tilted rectangular plaque with a tail, suggesting "the book
  // says" / oracle reading.
  cold_hand: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M4 6 H 19 A 2 2 0 0 1 21 8 V 14 A 2 2 0 0 1 19 16 H 11 L 7 20 L 8 16 H 4 A 2 2 0 0 1 2 14 V 8 A 2 2 0 0 1 4 6 Z" />
      <line x1="6" y1="10" x2="17" y2="10" />
      <line x1="6" y1="13" x2="13" y2="13" />
    </svg>
  ),

  // Last Throw — "Last hand of round: +25 chips". Bell sigil with a
  // small clapper. Reads as the closer's bell at a casino.
  last_throw: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M12 3 V 4.5" />
      <path d="M6 16 C 6 9, 9 5, 12 5 C 15 5, 18 9, 18 16 Z" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  ),

  // Patience Counter — "Every 5th hand: ×3 mult". Hourglass —
  // narrow waist, sand piled bottom, a single sand grain falling.
  patience_counter: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <line x1="6" y1="3" x2="18" y2="3" />
      <line x1="6" y1="21" x2="18" y2="21" />
      <path d="M6 3 L 18 3 L 13 12 L 18 21 L 6 21 L 11 12 Z" />
      <path d="M9 6 L 15 6 L 12 11.5 Z" fill={color} stroke="none" opacity="0.55" />
      <path d="M8 19.5 L 16 19.5 L 13.5 14 L 10.5 14 Z" fill={color} stroke="none" />
      <circle cx="12" cy="12" r="0.6" fill={color} stroke="none" />
    </svg>
  ),

  // Stipend — "+1 shard at the start of each hand". A coin-shaped
  // diamond with a centered pip, suggesting steady coinage.
  stipend: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M12 3 L 21 12 L 12 21 L 3 12 Z" />
      <path d="M12 7 L 17 12 L 12 17 L 7 12 Z" />
      <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
    </svg>
  ),

  // Lucky Streak — four-leaf clover. Four interlocking heart-shaped
  // leaves around a center stem.
  lucky_streak: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M12 11 C 12 7, 8 7, 8 10 C 8 12, 10 12, 12 11 Z" />
      <path d="M13 11 C 17 11, 17 7, 14 7 C 12 7, 12 9, 13 11 Z" />
      <path d="M12 13 C 12 17, 8 17, 8 14 C 8 12, 10 12, 12 13 Z" />
      <path d="M13 13 C 17 13, 17 17, 14 17 C 12 17, 12 15, 13 13 Z" />
      <line x1="12" y1="13" x2="12" y2="20" />
    </svg>
  ),

  // Eclipse Pact — solar eclipse. Sun ring partially occluded by a
  // moon disc.
  eclipse_pact: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="14" cy="12" r="6" fill={color} stroke="none" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="5.5" y1="5.5" x2="7" y2="7" />
      <line x1="5.5" y1="18.5" x2="7" y2="17" />
    </svg>
  ),

  // Lyric Pulse — single eighth note + a sound-wave ripple emanating
  // from the head.
  lyric_pulse: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M9 18 A 2 2 0 1 0 9 14 A 2 2 0 1 0 9 18 Z" />
      <line x1="11" y1="15" x2="11" y2="5" />
      <path d="M11 5 C 14 5, 16 6, 17 8 C 16 9, 14 9, 11 8" fill={color} fillOpacity="0.4" />
      <path d="M14 18 Q 16 16, 14 14" />
      <path d="M16 19 Q 19 16, 16 13" />
    </svg>
  ),

  // ── 2026-05-14 second pass: next tier of recognizability ──

  // Chaos Theory — "Straights → +5 mult". Infinity loop, the
  // shorthand for unbroken order. Reads as the catalyst's flavor
  // "Order from disorder."
  chaos_theory: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 8 12 C 8 8, 4 8, 4 12 C 4 16, 8 16, 12 12 C 16 8, 20 8, 20 12 C 20 16, 16 16, 12 12 Z" />
    </svg>
  ),

  // Entropy Index — "Each unique face → ×1.25 mult". Four small
  // distinct shapes in a 2×2 grid — variety as visual structure.
  entropy_index: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="8" cy="8" r="2.5" />
      <rect x="13.5" y="5.5" width="5" height="5" />
      <path d="M5.5 16 L 8 13.5 L 10.5 16 L 8 18.5 Z" />
      <path d="M13.5 13.5 L 18.5 13.5 L 16 18.5 Z" />
    </svg>
  ),

  // Compounding Bias — "Each cleared trial: +0.10× mult permanently."
  // Four ascending steps — the cleared blinds stacking the bonus.
  compounding_bias: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M3 21 L 7 21 L 7 16 L 11 16 L 11 11 L 15 11 L 15 6 L 19 6 L 19 21" />
      <line x1="3" y1="21" x2="21" y2="21" />
    </svg>
  ),

  // Solar Flare — "3+ scoring dice show 5 or 6 → ×1.5 mult". Sun
  // with extended flare tendrils. The catalyst fires when the dice
  // skew bright.
  solar_flare: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="12" r="4" fill={color} fillOpacity="0.3" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <path d="M5 5 L 7.5 7.5" />
      <path d="M19 5 L 16.5 7.5" />
      <path d="M5 19 L 7.5 16.5" />
      <path d="M19 19 L 16.5 16.5" />
    </svg>
  ),

  // Catalyst Bench — "+1 mult per other catalyst owned". A central
  // pip surrounded by 4 satellite pips — the bench radiating to its
  // neighbours.
  catalyst_bench: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="12" r="2.5" fill={color} stroke="none" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
      <line x1="7" y1="12" x2="9.5" y2="12" strokeDasharray="1 1.5" />
      <line x1="14.5" y1="12" x2="17" y2="12" strokeDasharray="1 1.5" />
      <line x1="12" y1="7" x2="12" y2="9.5" strokeDasharray="1 1.5" />
      <line x1="12" y1="14.5" x2="12" y2="17" strokeDasharray="1 1.5" />
    </svg>
  ),

  // Encore — "The last scoring die's mods fire one extra time."
  // Looped retrigger arrow.
  encore: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 6 9 A 6 6 0 1 1 6 15" />
      <path d="M 6 5 L 6 9 L 10 9" />
      <circle cx="14" cy="12" r="1.5" fill={color} stroke="none" />
      <circle cx="18" cy="12" r="0.9" fill={color} stroke="none" opacity="0.5" />
    </svg>
  ),

  // Phase-Shift — "Mirror Pair, Conduit, Crescendo, Pip Charge gain
  // +1 per instance." Two overlapping circles — the lattice tilting,
  // threads interfering.
  phase_shift: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="9" cy="12" r="5.5" />
      <circle cx="15" cy="12" r="5.5" />
      <path d="M 12 7 L 12 17" strokeDasharray="1 2" opacity="0.6" />
    </svg>
  ),

  // Conductor — "Full hand scores: +20 chips × distinct mods."
  // Conductor's baton with three sound waves rolling off it.
  conductor: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <line x1="6" y1="18" x2="16" y2="6" />
      <circle cx="16" cy="6" r="1.3" fill={color} stroke="none" />
      <path d="M 10 18 Q 12 16, 10 14" />
      <path d="M 13 19 Q 16 16, 13 13" />
      <path d="M 16 20 Q 20 16, 16 12" />
    </svg>
  ),

  // Quorum — "Same combo as last hand: chips ×1.5. 3rd in a row:
  // also mult ×1.5." Three repeated vertical bars — the verdict
  // holding.
  quorum: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <line x1="7" y1="5" x2="7" y2="19" strokeWidth="2.5" />
      <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2.5" />
      <line x1="17" y1="5" x2="17" y2="19" strokeWidth="2.5" />
      <line x1="4" y1="21" x2="20" y2="21" />
    </svg>
  ),

  // Magnitude — "Large Straight → Chips ×2 and Mult ×1.5." Expanding
  // 8-point star burst suggesting scale.
  magnitude: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M12 3 L 13 11 L 21 12 L 13 13 L 12 21 L 11 13 L 3 12 L 11 11 Z" fill={color} fillOpacity="0.25" />
      <line x1="6" y1="6" x2="9" y2="9" opacity="0.6" />
      <line x1="18" y1="6" x2="15" y2="9" opacity="0.6" />
      <line x1="6" y1="18" x2="9" y2="15" opacity="0.6" />
      <line x1="18" y1="18" x2="15" y2="15" opacity="0.6" />
    </svg>
  ),

  // ── 2026-05-14 third pass: combo-tribal + economy + cosmic ──

  // Pair Dynamo — "Pair → +5 mult, Two Pair → +12." Two horizontal
  // bars linked by a central spark: the pair generating current.
  pair_dynamo: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <line x1="4" y1="8" x2="20" y2="8" strokeWidth="2.5" />
      <line x1="4" y1="16" x2="20" y2="16" strokeWidth="2.5" />
      <path d="M 11 9 L 9.5 12 L 12 12 L 10.5 15" strokeWidth="1.8" />
      <circle cx="13.5" cy="12" r="0.8" fill={color} stroke="none" />
    </svg>
  ),

  // Triplet Engine — "Three of a Kind → ×2 mult." Three-lobed cog
  // wheel — rotational 3-fold symmetry replacing the generic ⚙.
  triplet_engine: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3 L 13.5 6 L 10.5 6 Z" />
      <path d="M19.8 16.5 L 16.6 16.2 L 18.1 13.6 Z" />
      <path d="M4.2 16.5 L 5.9 13.6 L 7.4 16.2 Z" />
      <circle cx="12" cy="12" r="1" fill={color} stroke="none" />
    </svg>
  ),

  // Iron Six — "Each retained 6: +6 chips next hand." Hexagonal die
  // frame with the six-pip arrangement inside, evoking the iron face
  // of a forged d6.
  iron_six: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M12 3 L 20 7.5 L 20 16.5 L 12 21 L 4 16.5 L 4 7.5 Z" />
      <circle cx="9" cy="9" r="1" fill={color} stroke="none" />
      <circle cx="15" cy="9" r="1" fill={color} stroke="none" />
      <circle cx="9" cy="12" r="1" fill={color} stroke="none" />
      <circle cx="15" cy="12" r="1" fill={color} stroke="none" />
      <circle cx="9" cy="15" r="1" fill={color} stroke="none" />
      <circle cx="15" cy="15" r="1" fill={color} stroke="none" />
    </svg>
  ),

  // Captain's Wage — "+$3 per cleared blind." A ship's anchor —
  // crossbar, shank, flukes. Reads as steady, weighty income.
  captains_wage: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="5.5" r="1.8" />
      <line x1="12" y1="7.3" x2="12" y2="20" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <path d="M 5 15 C 5 18, 8.5 20.5, 12 20.5 C 15.5 20.5, 19 18, 19 15" />
      <path d="M 5 15 L 3 13.5 M 19 15 L 21 13.5" />
    </svg>
  ),

  // Prime Pact — "Prime faces (2, 3, 5) → +2 chips each." Triangle
  // with a dot at each vertex — the three primes anchored.
  prime_pact: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M12 4 L 20 19 L 4 19 Z" />
      <circle cx="12" cy="4" r="1.8" fill={color} stroke="none" />
      <circle cx="20" cy="19" r="1.8" fill={color} stroke="none" />
      <circle cx="4" cy="19" r="1.8" fill={color} stroke="none" />
      <circle cx="12" cy="14" r="0.7" fill={color} stroke="none" opacity="0.6" />
    </svg>
  ),

  // Even Keeled — "Even-only hand → +25 chips." Balanced scale plate:
  // a horizontal beam with two equal-weight discs hanging.
  even_keeled: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="12" y1="5" x2="12" y2="9" />
      <circle cx="12" cy="4" r="1.2" fill={color} stroke="none" />
      <circle cx="6.5" cy="14" r="3.5" />
      <circle cx="17.5" cy="14" r="3.5" />
      <line x1="6.5" y1="9" x2="6.5" y2="10.5" />
      <line x1="17.5" y1="9" x2="17.5" y2="10.5" />
    </svg>
  ),

  // Apex — "Highest die in scoring set: ×1.5 mult." Mountain peak
  // with a crowning pip — the high die rising above its bench.
  apex: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M3 20 L 9 11 L 12 15 L 16 7 L 21 20 Z" />
      <circle cx="16" cy="4" r="1.5" fill={color} stroke="none" />
      <path d="M 16 4 L 14.5 6.5 L 17.5 6.5 Z" fill={color} fillOpacity="0.4" stroke="none" />
    </svg>
  ),

  // Silver Tongue — "Reroll cost halved." Quill nib with a curving
  // ink-stroke trailing from it.
  silver_tongue: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 17 5 L 20 8 L 9 19 L 5 20 L 6 16 Z" />
      <line x1="9" y1="19" x2="6" y2="16" />
      <line x1="13" y1="9" x2="16" y2="12" opacity="0.7" />
      <path d="M 5 20 Q 9 22, 14 20" strokeDasharray="1.5 1.5" opacity="0.7" />
    </svg>
  ),

  // Comet Trail — "Each consecutive scoring hand: +1 mult."
  // Comet head with a swept tail — the streak made visible.
  comet_trail: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="17.5" cy="6.5" r="2.5" fill={color} stroke="none" />
      <path d="M 16 8 L 4 20" strokeWidth="2" />
      <path d="M 18.5 9 L 8 19.5" opacity="0.7" />
      <path d="M 14 7 L 5 16" opacity="0.5" />
      <circle cx="17.5" cy="6.5" r="4.5" opacity="0.4" />
    </svg>
  ),

  // Ouroboros — "Run-streak: each cleared ante adds +0.05× mult."
  // Serpent-ring biting its own tail, the loop made glyph.
  ouroboros: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 12 4 C 17 4, 20 8, 20 12 C 20 16, 17 20, 12 20 C 8 20, 5 17, 5 13" />
      <path d="M 5 13 L 7.5 14.5 L 8 11" />
      <circle cx="14" cy="6" r="0.9" fill={color} stroke="none" />
      <path d="M 16 5.5 L 17 6.5 L 16 7.5" opacity="0.6" />
    </svg>
  ),

  // ── 2026-05-14 fourth pass: every duplicate-Unicode catalyst gets
  // its own sigil so the strip / shop / codex never present the same
  // glyph for two different catalysts. ──

  // Shard Sink (was ◈, shared) — "Spend 1 shard → ×1.5 mult." A coin
  // tipping into a triangular funnel.
  shard_sink: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="6" r="2.5" />
      <path d="M 12 8.5 L 12 11" strokeDasharray="1 1.5" />
      <path d="M 5 12 L 19 12 L 14 19 L 10 19 Z" />
      <line x1="10" y1="19" x2="14" y2="19" />
    </svg>
  ),

  // Recursive Sink (was ◇, shared) — "Pay 1 more shard for +×1.25."
  // Concentric diamonds — the cut going deeper.
  recursive_sink: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 12 3 L 21 12 L 12 21 L 3 12 Z" />
      <path d="M 12 7 L 17 12 L 12 17 L 7 12 Z" />
      <path d="M 12 10 L 14 12 L 12 14 L 10 12 Z" fill={color} stroke="none" />
    </svg>
  ),

  // Odd Voice (was ◌, shared) — "All odd → ×1.5 mult." Three offset
  // pips above an open-circle staff.
  odd_voice: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="16" r="4" />
      <circle cx="12" cy="16" r="1" fill={color} stroke="none" />
      <circle cx="7" cy="7" r="0.9" fill={color} stroke="none" />
      <circle cx="12" cy="5" r="0.9" fill={color} stroke="none" />
      <circle cx="17" cy="7" r="0.9" fill={color} stroke="none" />
    </svg>
  ),

  // Usurer (was ⛁, shared) — "Each shard >10 → +1 mult." A tall coin
  // stack growing past a horizon line.
  usurer: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <ellipse cx="12" cy="20" rx="6" ry="1.4" />
      <ellipse cx="12" cy="17" rx="6" ry="1.4" />
      <ellipse cx="12" cy="14" rx="6" ry="1.4" />
      <ellipse cx="12" cy="11" rx="6" ry="1.4" />
      <ellipse cx="12" cy="8" rx="6" ry="1.4" />
      <line x1="6" y1="8" x2="6" y2="20" />
      <line x1="18" y1="8" x2="18" y2="20" />
      <line x1="3" y1="5" x2="21" y2="5" strokeDasharray="1 1.5" opacity="0.7" />
    </svg>
  ),

  // All-Band (was ⌬, shared) — "Tier-up once per round." Three
  // expanding sound bands with a tier-shift caret marking the leap.
  all_band: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 4 18 Q 4 6, 10 4" />
      <path d="M 6 18 Q 6 8, 12 6" />
      <path d="M 8 18 Q 8 10, 14 8" />
      <path d="M 14 8 L 18 6 L 18 10 Z" fill={color} stroke="none" />
      <line x1="15" y1="13" x2="19" y2="13" opacity="0.7" />
      <line x1="15" y1="16" x2="19" y2="16" opacity="0.6" />
    </svg>
  ),

  // Straight Signal (was ↗, shared) — "Small Straight → +6 mult."
  // Four ascending rungs, the straight made staircase.
  straight_signal: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 4 20 L 4 16 L 9 16 L 9 12 L 14 12 L 14 8 L 19 8 L 19 4" />
      <path d="M 17 6 L 19 4 L 21 6" />
      <circle cx="4" cy="20" r="0.8" fill={color} stroke="none" />
    </svg>
  ),

  // Low Choir (was ⫯, shared) — "Faces ≤2 → +3 mult each." Two low
  // pips under a descending beam.
  low_choir: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 4 6 L 12 12 L 20 6" />
      <circle cx="8" cy="18" r="1.4" fill={color} stroke="none" />
      <circle cx="16" cy="18" r="1.4" fill={color} stroke="none" />
      <line x1="8" y1="18" x2="16" y2="18" />
    </svg>
  ),

  // Dust-Off (was ⤺, shared) — "Sell value +50%." A swept-away
  // motion line with a coin departing.
  dust_off: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="17" cy="9" r="2" />
      <line x1="17" y1="9" x2="17" y2="9" />
      <path d="M 4 16 Q 8 18, 14 14" />
      <path d="M 5 13 Q 9 15, 13 11" opacity="0.6" />
      <path d="M 4 16 L 6.5 15 L 6 18" />
    </svg>
  ),

  // Crescendo Run (was ↗, shared) — "×2 mult after 3+ rolls w/o lock."
  // Three rising wedges — the building tempo.
  crescendo_run: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 4 19 L 4 16 L 7 14" strokeWidth="2" />
      <path d="M 10 19 L 10 12 L 13 9" strokeWidth="2" />
      <path d="M 16 19 L 16 8 L 19 4" strokeWidth="2" />
      <line x1="3" y1="20" x2="21" y2="20" opacity="0.5" />
    </svg>
  ),

  // Shard Lung (was ⛁, shared) — "Inhale ante-worth of shards;
  // exhale half for mult." A bellows-like double dome with a coin
  // breath-particle inside.
  shard_lung: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 6 4 L 6 11 C 6 16, 10 18, 12 18 C 14 18, 18 16, 18 11 L 18 4" />
      <line x1="12" y1="4" x2="12" y2="18" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <path d="M 12 19 L 12 21" strokeDasharray="1 1.5" />
    </svg>
  ),

  // Mod Gravity (was ◐, shared) — "4+ dice score → +5 mult." A
  // lopsided gravity well — a deep cup tilted by mass.
  mod_gravity: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <ellipse cx="12" cy="8" rx="9" ry="2" />
      <path d="M 3 8 C 3 18, 12 22, 12 22 C 12 22, 21 18, 21 8" />
      <circle cx="12" cy="20" r="1.6" fill={color} stroke="none" />
      <line x1="8" y1="6" x2="9" y2="4" opacity="0.6" />
      <line x1="12" y1="5" x2="12" y2="3" opacity="0.6" />
      <line x1="16" y1="6" x2="15" y2="4" opacity="0.6" />
    </svg>
  ),

  // Face Value (was ◇, shared) — "Each 4 → +3 chips, +1 mult." A
  // d6-face square showing the four-pip pattern.
  face_value: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <circle cx="9" cy="9" r="1.1" fill={color} stroke="none" />
      <circle cx="15" cy="9" r="1.1" fill={color} stroke="none" />
      <circle cx="9" cy="15" r="1.1" fill={color} stroke="none" />
      <circle cx="15" cy="15" r="1.1" fill={color} stroke="none" />
    </svg>
  ),

  // First Strike (was ⚡, shared) — "First hand of each blind: bonus."
  // Lightning bolt with a "1" inscribed start-tick.
  first_strike: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 14 3 L 7 13 L 11 13 L 9 21 L 17 10 L 13 10 Z" fill={color} fillOpacity="0.3" />
      <line x1="4" y1="6" x2="6" y2="6" />
      <line x1="5" y1="5" x2="5" y2="7" />
    </svg>
  ),

  // Streak Seeker (was ↟, shared) — "Every 4th hand: ×2." Four
  // ascending tick-marks toward a target.
  streak_seeker: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="0.9" fill={color} stroke="none" />
      <line x1="4" y1="19" x2="7" y2="17" />
      <line x1="8" y1="16" x2="11" y2="14" />
      <line x1="12" y1="13" x2="15" y2="11" />
      <line x1="16" y1="9" x2="17" y2="8" />
    </svg>
  ),

  // Economy Engine (was ⚙, shared) — "Each shard held → +0.1 mult."
  // A gear whose teeth are stylised coins.
  economy_engine: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
      <circle cx="12" cy="4" r="1.4" />
      <circle cx="12" cy="20" r="1.4" />
      <circle cx="4" cy="12" r="1.4" />
      <circle cx="20" cy="12" r="1.4" />
      <circle cx="6" cy="6" r="1.1" />
      <circle cx="18" cy="6" r="1.1" />
      <circle cx="6" cy="18" r="1.1" />
      <circle cx="18" cy="18" r="1.1" />
    </svg>
  ),

  // Penumbra (was ◐, shared) — "All scoring dice same value → ×3."
  // Total-eclipse ring with a single sharp diamond at apex —
  // alignment made literal.
  penumbra: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="4.5" fill={color} stroke="none" />
      <path d="M 12 3 L 13 5 L 12 7 L 11 5 Z" fill={color} stroke="none" />
      <path d="M 12 17 L 13 19 L 12 21 L 11 19 Z" fill={color} stroke="none" />
    </svg>
  ),

  // Wildcard Waltz (was ✺, shared) — "Each wildcard die → +25 chips."
  // Six-pointed star with a "?" intertwined.
  wildcard_waltz: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 12 3 L 14 9 L 21 10 L 16 14 L 18 21 L 12 17 L 6 21 L 8 14 L 3 10 L 10 9 Z" />
      <path d="M 10 11 Q 12 9, 14 11 Q 14 13, 12 14" strokeWidth="1.8" />
      <circle cx="12" cy="16.5" r="0.6" fill={color} stroke="none" />
    </svg>
  ),

  // Lodestone (was ◈, shared) — "Each scored pair → +2 chips perm."
  // Horseshoe magnet with field-lines bridging the poles.
  lodestone: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 5 18 L 5 12 C 5 7, 10 5, 12 5 C 14 5, 19 7, 19 12 L 19 18" />
      <line x1="5" y1="18" x2="9" y2="18" strokeWidth="2.5" />
      <line x1="15" y1="18" x2="19" y2="18" strokeWidth="2.5" />
      <path d="M 9 13 Q 12 11, 15 13" opacity="0.6" />
      <path d="M 9 10 Q 12 8, 15 10" opacity="0.4" />
    </svg>
  ),

  // Memento Star (was ✦, shared) — "Overflow → +0.5× mult perm." A
  // star inside a stamp-frame: the overage is filed away.
  memento_star: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <rect x="4" y="4" width="16" height="16" rx="1" strokeDasharray="2 1.5" />
      <path d="M 12 7 L 13.5 11.5 L 18 12 L 13.5 12.5 L 12 17 L 10.5 12.5 L 6 12 L 10.5 11.5 Z" fill={color} fillOpacity="0.3" />
    </svg>
  ),

  // Tide (was ◐, shared) — "Ebb/flow alternates." Two opposed waves
  // sharing a horizon line.
  tide: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M 3 9 Q 7 5, 12 9 Q 17 13, 21 9" />
      <path d="M 3 15 Q 7 19, 12 15 Q 17 11, 21 15" opacity="0.7" />
    </svg>
  ),

  // Highwater (was ↟, shared) — "Each PB → +1 mult perm." A high-
  // water tide-line with two prior marks stacked beneath.
  highwater: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2.5" />
      <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="2 2" opacity="0.6" />
      <line x1="3" y1="17" x2="21" y2="17" strokeDasharray="2 2" opacity="0.4" />
      <path d="M 12 21 L 9 18 L 11 18 L 11 13 L 13 13 L 13 18 L 15 18 Z" fill={color} stroke="none" />
    </svg>
  ),

  // Refrain / Rotor (was ⤺, shared) — "Match prior tier → retrigger
  // all." A three-bladed rotor spinning around a central pip.
  refrain: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="12" r="1.4" fill={color} stroke="none" />
      <path d="M 12 12 Q 8 9, 5 11 Q 4 14, 7 14 Q 10 14, 12 12" />
      <path d="M 12 12 Q 16 9, 19 11 Q 20 14, 17 14 Q 14 14, 12 12" />
      <path d="M 12 12 Q 14 16, 12 20 Q 10 20, 10 17 Q 11 14, 12 12" />
    </svg>
  ),

  // Mirror Edge (was ⫯, shared) — "Locked dice retrigger once." A
  // vertical mirror with a die on each side, the right one inverted.
  mirror_edge: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <line x1="12" y1="3" x2="12" y2="21" strokeWidth="2" />
      <rect x="3" y="8" width="7" height="8" rx="1" />
      <rect x="14" y="8" width="7" height="8" rx="1" strokeDasharray="1.5 1.5" />
      <circle cx="6.5" cy="12" r="1.1" fill={color} stroke="none" />
      <circle cx="17.5" cy="12" r="1.1" fill={color} stroke="none" />
    </svg>
  ),

  // Curtain Call (was ⌬, shared) — "Final hand: all retrigger."
  // Two stage curtains parted around an empty centre — the bow.
  curtain_call: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 4 3 Q 4 12, 8 21" strokeWidth="2" />
      <path d="M 20 3 Q 20 12, 16 21" strokeWidth="2" />
      <path d="M 6 6 Q 8 13, 9 20" opacity="0.6" />
      <path d="M 18 6 Q 16 13, 15 20" opacity="0.6" />
      <line x1="3" y1="3" x2="21" y2="3" />
    </svg>
  ),

  // Stutter (was ⫶, shared) — "25%/die retrigger, prime-guarantee."
  // Three pips with a break in the rhythm — a skip.
  stutter: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="6" cy="12" r="1.6" fill={color} stroke="none" />
      <circle cx="11" cy="12" r="1.6" fill={color} stroke="none" />
      <circle cx="18" cy="12" r="1.6" fill={color} stroke="none" opacity="0.5" />
      <line x1="14" y1="9" x2="14" y2="15" strokeDasharray="1 1.5" />
      <path d="M 13 6 L 15 6 M 13 18 L 15 18" />
    </svg>
  ),

  // Silent Witness (was ◌, shared) — "Unheld even → bonus." A
  // closed-eye sigil — the lashes still counting.
  silent_witness: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 3 12 Q 12 18, 21 12" />
      <line x1="6" y1="14" x2="6" y2="16" />
      <line x1="9" y1="15" x2="9" y2="17" />
      <line x1="12" y1="16" x2="12" y2="18" />
      <line x1="15" y1="15" x2="15" y2="17" />
      <line x1="18" y1="14" x2="18" y2="16" />
    </svg>
  ),

  // Kinetic Charge (was ⚡, shared) — "Each collision: +1 chip."
  // Three small sparks radiating from an impact point.
  kinetic_charge: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="12" r="1.6" fill={color} stroke="none" />
      <path d="M 12 12 L 4 4" />
      <path d="M 12 12 L 20 6" />
      <path d="M 12 12 L 6 19" />
      <path d="M 12 12 L 19 18" />
      <path d="M 12 12 L 12 21" opacity="0.6" />
    </svg>
  ),

  // Kindred Clatter (was ◈, shared) — "Same-value collisions → +3
  // mult." Two dice mid-impact with a shared face glow.
  kindred_clatter: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <rect x="3" y="8" width="8" height="8" rx="1" transform="rotate(-8 7 12)" />
      <rect x="13" y="8" width="8" height="8" rx="1" transform="rotate(8 17 12)" />
      <circle cx="7" cy="12" r="0.9" fill={color} stroke="none" />
      <circle cx="17" cy="12" r="0.9" fill={color} stroke="none" />
      <path d="M 11 11 L 13 13 M 13 11 L 11 13" strokeWidth="1.8" />
    </svg>
  ),

  // ── 2026-05-14 fifth pass: weak-Unicode catalysts (single char that
  // doesn't carry the catalyst's mechanic). ──

  // Chance Doctrine — "Chance hand → big bonus." A die balanced on
  // its corner — the verdict suspended.
  chance_doctrine: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" transform="rotate(45 12 12)" />
      <circle cx="12" cy="9" r="0.9" fill={color} stroke="none" />
      <circle cx="9" cy="12" r="0.9" fill={color} stroke="none" />
      <circle cx="15" cy="12" r="0.9" fill={color} stroke="none" />
      <circle cx="12" cy="15" r="0.9" fill={color} stroke="none" />
    </svg>
  ),

  // Event Horizon — "Big-contribution die → +×mult perm." A black
  // disc with an accretion ring tilting around it.
  event_horizon: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <ellipse cx="12" cy="12" rx="9" ry="3" />
      <circle cx="12" cy="12" r="4" fill={color} stroke="none" />
      <path d="M 3 12 Q 12 17, 21 12" opacity="0.6" />
    </svg>
  ),

  // Crowded Table — "+1 mult per scoring die past the fifth." Six
  // seats around a hexagonal table, three filled.
  crowded_table: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 12 8 L 18 11 L 18 16 L 12 19 L 6 16 L 6 11 Z" />
      <circle cx="12" cy="5" r="1.2" fill={color} stroke="none" />
      <circle cx="19.5" cy="9" r="1.2" fill={color} stroke="none" />
      <circle cx="19.5" cy="18" r="1.2" />
      <circle cx="12" cy="22" r="1.2" />
      <circle cx="4.5" cy="18" r="1.2" />
      <circle cx="4.5" cy="9" r="1.2" fill={color} stroke="none" />
    </svg>
  ),

  // Echo Chamber — "4+ scoring → first die mods double." A nested
  // bracket sequence — the same note widening.
  echo_chamber: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 6 5 L 3 12 L 6 19" />
      <path d="M 10 7 L 8 12 L 10 17" opacity="0.7" />
      <path d="M 14 9 L 13 12 L 14 15" opacity="0.55" />
      <circle cx="18" cy="12" r="1.4" fill={color} stroke="none" />
    </svg>
  ),

  // Shadow Cache — "Unheld ≥5 → +3 chips each." A dashed-outline
  // pouch with three pips hidden inside.
  shadow_cache: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 5 9 L 19 9 L 18 19 C 18 20, 17 20, 16 20 L 8 20 C 7 20, 6 20, 6 19 Z" strokeDasharray="2 1.5" />
      <path d="M 9 9 L 9 6 C 9 4, 15 4, 15 6 L 15 9" />
      <circle cx="9" cy="15" r="0.9" fill={color} stroke="none" opacity="0.6" />
      <circle cx="12" cy="16" r="0.9" fill={color} stroke="none" opacity="0.6" />
      <circle cx="15" cy="15" r="0.9" fill={color} stroke="none" opacity="0.6" />
    </svg>
  ),

  // Unseen Chorus — "3+ unheld dice all different → ×1.5 mult."
  // Three different small shapes outside a circle — voices off-stage.
  unseen_chorus: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="12" r="4" strokeDasharray="2 1.5" />
      <circle cx="4" cy="6" r="1.3" />
      <rect x="18" y="5" width="3" height="3" />
      <path d="M 3 19 L 5 16 L 7 19 Z" />
      <path d="M 17 18 L 21 18 L 19 21 Z" />
    </svg>
  ),

  // Audit — "On bust: refund half spent shards." A ledger sheet with
  // a balance line and check-mark.
  audit: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <rect x="5" y="4" width="13" height="16" rx="1" />
      <line x1="8" y1="9" x2="15" y2="9" />
      <line x1="8" y1="12" x2="15" y2="12" />
      <line x1="8" y1="15" x2="13" y2="15" />
      <path d="M 13 18 L 15 20 L 19 16" strokeWidth="2" />
    </svg>
  ),

  // Chain Reaction — "15+ collisions → ×1.5 mult." Three linked
  // rings forming a chain.
  chain_reaction: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <ellipse cx="6" cy="12" rx="3" ry="2" transform="rotate(-30 6 12)" />
      <ellipse cx="12" cy="12" rx="3" ry="2" />
      <ellipse cx="18" cy="12" rx="3" ry="2" transform="rotate(30 18 12)" />
    </svg>
  ),

  // Gilding Press — "First mod on each scoring die fires twice for
  // chips." A press-stamp with double-strike rings.
  gilding_press: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <rect x="8" y="3" width="8" height="4" />
      <line x1="12" y1="7" x2="12" y2="13" strokeWidth="2.5" />
      <rect x="5" y="13" width="14" height="3" rx="0.5" fill={color} fillOpacity="0.3" />
      <ellipse cx="12" cy="18" rx="6" ry="1" />
      <ellipse cx="12" cy="20" rx="7" ry="1" opacity="0.55" />
    </svg>
  ),

  // Star Chart — "Each scored straight → +0.25× mult perm." A small
  // constellation with a line tracing it.
  star_chart: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 4 18 L 8 13 L 13 14 L 17 8 L 20 5" opacity="0.6" />
      <circle cx="4" cy="18" r="1" fill={color} stroke="none" />
      <circle cx="8" cy="13" r="1.4" fill={color} stroke="none" />
      <circle cx="13" cy="14" r="1" fill={color} stroke="none" />
      <circle cx="17" cy="8" r="1.4" fill={color} stroke="none" />
      <circle cx="20" cy="5" r="1" fill={color} stroke="none" />
    </svg>
  ),

  // 2026-05-16 risk-pack glyphs. Replace the unicode fallbacks
  // (☠ ♟ 🜍) which render inconsistently across OSes. Each leans
  // into the brief's "instrument / artifact / sample" framing.

  // Bone Tax — a balance scale with one pan tipped down; the down-pan
  // holds a fractured cube (the chip-tax "bite" the catalyst takes).
  bone_tax: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 12 4 L 12 8" />
      <path d="M 6 8 L 18 8" />
      <path d="M 6 8 L 4 16" />
      <path d="M 18 8 L 20 16" />
      <path d="M 7 16 L 13 16" />
      <path d="M 8 16 L 9.5 21 L 11.5 17.5 L 13 21" />
      <circle cx="11" cy="13" r="0.9" fill={color} stroke="none" />
    </svg>
  ),

  // Hollow Bishop — a chess-bishop silhouette with the upper third
  // hollowed out. Dot inside the hollow marks the gating threshold.
  hollow_bishop: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 12 3 L 12 5" />
      <path d="M 9 7 C 9 5.5 10.5 5 12 5 C 13.5 5 15 5.5 15 7 L 14.5 9 L 9.5 9 Z" />
      <path d="M 10.5 9 L 10.5 11" />
      <path d="M 13.5 9 L 13.5 11" />
      <path d="M 8 17 L 8 15 C 8 12.5 9.5 11 12 11 C 14.5 11 16 12.5 16 15 L 16 17" />
      <path d="M 7 17 L 17 17 L 17 19 L 7 19 Z" />
      <circle cx="12" cy="14" r="0.9" fill={color} stroke="none" />
    </svg>
  ),

  // Witch's Bargain — a brass coin paired with a notched tally.
  // The notch reads as the per-die chip subtraction the catalyst
  // levies before the multiplier hits. No witch imagery — the
  // bargain is the literal transaction.
  witchs_bargain: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="8" cy="12" r="4" />
      <path d="M 8 9.5 L 8 14.5" />
      <path d="M 6 12 L 10 12" />
      <path d="M 14 7 L 19 7" />
      <path d="M 14 10 L 19 10" />
      <path d="M 14 13 L 17 13" />
      <path d="M 14 16 L 19 16" />
      <circle cx="17.5" cy="13" r="0.9" fill={color} stroke="none" />
    </svg>
  ),
};

/** True iff a hand-authored SVG renderer exists for this catalyst id. */
export function hasCatalystIconSvg(id: string): boolean {
  return id in CATALYST_ICON_SVGS;
}
