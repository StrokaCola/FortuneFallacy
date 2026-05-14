// ModIcon — parallel to `app/visual/CatalystIcon.tsx`. Same
// registered-SVG-or-fallback-char pattern. See the catalyst icon
// system's doc at `docs/design/catalyst-icons.md` for the design
// rationale.

import { MOD_ICON_SVGS } from '../../data/modIcons';

export type ModIconProps = {
  /** Mod id from `core/mods/`. Used to look up a registered SVG renderer. */
  modId: string;
  /** The mod's existing `icon` char — used as the fallback when no SVG is registered. */
  fallbackChar: string;
  /** Tint colour for the SVG stroke / fallback text. */
  color: string;
  /** Size of the rendered glyph in CSS pixels. Defaults to 24. */
  size?: number;
};

export function ModIcon({ modId, fallbackChar, color, size = 24 }: ModIconProps) {
  const renderer = MOD_ICON_SVGS[modId];
  if (renderer) {
    return <span style={{ display: 'inline-flex' }}>{renderer(color, size)}</span>;
  }
  return (
    <span style={{
      color,
      filter: `drop-shadow(0 0 6px ${color})`,
      fontSize: Math.round(size * 0.85),
      lineHeight: 1,
    }}>
      {fallbackChar}
    </span>
  );
}
