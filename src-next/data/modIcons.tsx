// Hand-authored SVG glyphs for mod icons. Parallel to
// `data/catalystIcons.tsx` — same style guide, same SVG-or-fallback
// migration model. Mods have fewer true-emoji offenders than
// catalysts (only 2 of 57 ship with codepoints ≥ U+1F000); the rest
// use Unicode dingbats which render consistently.
//
// Adding more glyphs is incremental — `<ModIcon>` falls back to the
// mod's existing `icon` char when no entry is registered.

import type React from 'react';

export type ModIconRenderer = (color: string, size: number) => React.ReactNode;

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

export const MOD_ICON_SVGS: Record<string, ModIconRenderer> = {
  // High Roller — was 🎯 (direct hit emoji). Concentric bullseye:
  // outer ring + middle ring + filled centre. Reads as a target
  // even at 16 px.
  high_roller: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="3" fill={color} stroke="none" />
    </svg>
  ),

  // Pyre Mark — was 🔥 (fire emoji). Stylised flame: a single tall
  // teardrop body with a smaller inner flame, both rounded so it
  // reads as alchemical line-art rather than a literal fire pictogram.
  pyre_mark: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M12 3 C 9 8, 6 10, 7 15 C 7 18, 9 21, 12 21 C 15 21, 17 18, 17 15 C 18 12, 15 11, 14 8 C 13 10, 12 11, 12 9 Z" />
      <path d="M12 13 C 11 14, 10 15, 11 17 C 11 18, 12 19, 13 19 C 14 19, 14 18, 14 17 C 14 16, 13 15, 13 13 Z" fill={color} fillOpacity="0.4" stroke="none" />
    </svg>
  ),

  // ── 2026-05-14: duplicate-icon mods get their own sigils so two
  // mods never share a glyph in the strip / build tray / codex. ──

  // Gilded — common chip producer (was ◆). A coin with a centre pip
  // — distinct from Keystone's arch geometry.
  gilded: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.6" fill={color} stroke="none" />
    </svg>
  ),

  // Keystone — rare, highest-face mult (was ◆). A keystone-arch
  // wedge — the cap stone reading literally.
  keystone: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 4 20 L 7 8 L 17 8 L 20 20 Z" />
      <path d="M 9 8 L 11 4 L 13 4 L 15 8 Z" fill={color} fillOpacity="0.3" />
      <line x1="12" y1="4" x2="12" y2="20" opacity="0.5" />
    </svg>
  ),

  // Loaded — 1s count as 6 (was ⚔). A die-face with a weight inside
  // tilting toward the 6-pip corner.
  loaded: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M 12 9 L 17 14 L 12 14 Z" fill={color} fillOpacity="0.4" stroke="none" />
      <circle cx="15" cy="15" r="1.1" fill={color} stroke="none" />
      <circle cx="17" cy="17" r="0.8" fill={color} stroke="none" />
      <circle cx="7" cy="7" r="0.8" fill={color} stroke="none" />
    </svg>
  ),

  // Veteran — +0.5 mult per blind survived (was ⚔). Three chevrons
  // stacked — service stripes.
  veteran: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 4 7 L 12 13 L 20 7" strokeWidth="2" />
      <path d="M 4 13 L 12 19 L 20 13" strokeWidth="2" opacity="0.7" />
      <circle cx="12" cy="4" r="1.2" fill={color} stroke="none" />
    </svg>
  ),

  // Backstop — score floor of 4 (was ✦). A small shield with a
  // baseline bar — the floor that catches the score.
  backstop: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 12 4 L 19 7 L 19 13 C 19 17, 15 19, 12 20 C 9 19, 5 17, 5 13 L 5 7 Z" />
      <line x1="6" y1="14" x2="18" y2="14" strokeWidth="2" />
    </svg>
  ),

  // Anti-One Sigil — banish face 1 (was ✦). A "1" pip slashed with
  // a warding line.
  anti_one_sigil: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" fill={color} stroke="none" />
      <line x1="5" y1="5" x2="19" y2="19" strokeWidth="2.5" />
    </svg>
  ),

  // Brittle — destroyed on bust (was ☄). A cracked-glass triangle
  // — the fracture is the entire visual.
  brittle: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 12 4 L 20 20 L 4 20 Z" />
      <path d="M 12 4 L 12 13 L 7 17" opacity="0.7" />
      <path d="M 12 13 L 15 20" opacity="0.7" />
      <path d="M 12 13 L 18 16" opacity="0.5" />
    </svg>
  ),

  // Pyre Pact — banish face 1 + 3-banish milestone (was ☄). A flame
  // wrapped in a pact-seal ring with three tick marks.
  pyre_pact: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="12" r="8" />
      <path d="M 12 8 C 11 10, 9 12, 10 14 C 10 16, 11 17, 12 17 C 13 17, 14 16, 14 14 C 15 13, 13 11, 12 8 Z" fill={color} fillOpacity="0.4" />
      <line x1="4" y1="12" x2="5.5" y2="12" />
      <line x1="11" y1="3" x2="11" y2="4.5" />
      <line x1="18.5" y1="12" x2="20" y2="12" />
    </svg>
  ),

  // Anchor — combo-set chip (was ⚓). Classic anchor — kept simple
  // and distinct from Captain's Wage by the flat crossbar treatment.
  anchor: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <circle cx="12" cy="5" r="2" />
      <line x1="12" y1="7" x2="12" y2="19" />
      <line x1="7" y1="10" x2="17" y2="10" strokeWidth="2" />
      <path d="M 5 16 Q 8 19, 12 19 Q 16 19, 19 16" />
    </svg>
  ),

  // Ballast — +chips per lock-when-scoring (was ⚓). A weighted
  // pendant on a chain — the lock-down made literal.
  ballast: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <line x1="12" y1="3" x2="12" y2="9" strokeDasharray="1 1" />
      <path d="M 7 9 L 17 9 L 18 16 C 18 19, 14 20, 12 20 C 10 20, 6 19, 6 16 Z" />
      <circle cx="12" cy="14" r="1.2" fill={color} stroke="none" />
    </svg>
  ),

  // Refinery — +shard on Two-Pair / Full-House (was ◇). A crucible
  // with droplet condensing inside.
  refinery: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 5 6 L 19 6 L 17 17 C 17 19, 15 20, 12 20 C 9 20, 7 19, 7 17 Z" />
      <line x1="5" y1="6" x2="3" y2="6" />
      <line x1="19" y1="6" x2="21" y2="6" />
      <path d="M 12 10 C 10 12, 10 15, 12 15 C 14 15, 14 12, 12 10 Z" fill={color} fillOpacity="0.5" stroke="none" />
    </svg>
  ),

  // Mirror Banish — face-banish based on others (was ◇). A vertical
  // mirror with one die on each side, mirrored faces.
  mirror_banish: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <line x1="12" y1="3" x2="12" y2="21" strokeWidth="2.5" />
      <rect x="3" y="9" width="6" height="6" rx="1" />
      <rect x="15" y="9" width="6" height="6" rx="1" />
      <circle cx="6" cy="12" r="0.9" fill={color} stroke="none" />
      <line x1="9.5" y1="12" x2="11" y2="12" strokeDasharray="1 1" opacity="0.6" />
      <line x1="13" y1="12" x2="14.5" y2="12" strokeDasharray="1 1" opacity="0.6" />
    </svg>
  ),

  // ── High-visibility mods getting an upgrade beyond the duplicate set. ──

  // Sharpened — +1 mult per scoring die. A blade-tip with a glint.
  sharpened: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 12 3 L 16 17 L 8 17 Z" />
      <line x1="12" y1="17" x2="12" y2="21" strokeWidth="2.5" />
      <line x1="18" y1="6" x2="20" y2="4" opacity="0.6" />
    </svg>
  ),

  // Crown — face-6 ×1.5 mult. A five-point coronet with three
  // jewel-pips along the band.
  crown: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 4 18 L 5 8 L 9 13 L 12 6 L 15 13 L 19 8 L 20 18 Z" />
      <line x1="4" y1="18" x2="20" y2="18" strokeWidth="2.5" />
      <circle cx="8" cy="16" r="0.8" fill={color} stroke="none" />
      <circle cx="12" cy="16" r="0.8" fill={color} stroke="none" />
      <circle cx="16" cy="16" r="0.8" fill={color} stroke="none" />
    </svg>
  ),

  // Wildcard — counts as any face. Six-point asterisk with a
  // central diamond pip.
  wildcard: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="4.5" y1="8" x2="19.5" y2="16" />
      <line x1="4.5" y1="16" x2="19.5" y2="8" />
      <path d="M 12 9 L 15 12 L 12 15 L 9 12 Z" fill={color} stroke="none" />
    </svg>
  ),

  // Echo — repeats prior mod. A curved arrow returning back on
  // itself, with a phantom-tail.
  echo: (color, size) => (
    <svg {...baseSvgProps(color, size)}>
      <path d="M 5 12 Q 5 5, 12 5 Q 19 5, 19 12 Q 19 18, 13 18" />
      <path d="M 16 15 L 13 18 L 16 21" />
      <path d="M 7 14 Q 7 7, 13 7" opacity="0.5" />
    </svg>
  ),
};

/** True iff a hand-authored SVG renderer exists for this mod id. */
export function hasModIconSvg(id: string): boolean {
  return id in MOD_ICON_SVGS;
}
