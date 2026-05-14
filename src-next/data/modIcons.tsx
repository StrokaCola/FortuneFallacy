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
};

/** True iff a hand-authored SVG renderer exists for this mod id. */
export function hasModIconSvg(id: string): boolean {
  return id in MOD_ICON_SVGS;
}
