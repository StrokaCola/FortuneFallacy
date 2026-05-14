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
};

/** True iff a hand-authored SVG renderer exists for this catalyst id. */
export function hasCatalystIconSvg(id: string): boolean {
  return id in CATALYST_ICON_SVGS;
}
