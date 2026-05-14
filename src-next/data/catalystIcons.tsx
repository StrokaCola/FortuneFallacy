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
};

/** True iff a hand-authored SVG renderer exists for this catalyst id. */
export function hasCatalystIconSvg(id: string): boolean {
  return id in CATALYST_ICON_SVGS;
}
