// CatalystIcon — single render path for a catalyst's glyph that
// transparently picks the hand-authored SVG when one is registered
// and falls back to the catalyst's existing Unicode `icon` char
// otherwise.
//
// Why: ~10 catalysts shipped with TRUE emoji icons (👁 📈 🔢 💬 🔔
// 🌑 🍀 🎼 ⏳ 💠) that render differently on every OS. The studio
// review's Art Direction dept flagged these as "the visual identity
// is at the mercy of the player's OS." This component gives the
// studio one place to ship custom glyphs without ripping out the
// emoji from `data/catalysts.ts` (saves stay portable; the fallback
// path keeps the original char).
//
// Style — the SVG renderers in `data/catalystIcons.tsx` follow a
// shared style guide (24×24 viewBox, thin stroke, line-art) so the
// catalyst grid reads as one set even when only ~10 of 89 catalysts
// have custom glyphs. The remaining ~80 use Unicode dingbats which
// already render consistently and don't need replacement.

import { CATALYST_ICON_SVGS } from '../../data/catalystIcons';

export type CatalystIconProps = {
  /** Catalyst id from `data/catalysts.ts`. Used to look up a registered SVG renderer. */
  catalystId: string;
  /** The catalyst's existing `icon` char — used as the fallback when no SVG is registered. */
  fallbackChar: string;
  /** Tint colour for the SVG stroke / fallback text. */
  color: string;
  /**
   * Size of the rendered glyph in CSS pixels. Defaults to 24 — large
   * enough for the strip card (38-42px frame), the shop offer card
   * (84px frame), and the codex cell (28px frame). Each consumer can
   * pass its own size to match the surrounding silhouette.
   */
  size?: number;
};

export function CatalystIcon({ catalystId, fallbackChar, color, size = 24 }: CatalystIconProps) {
  const renderer = CATALYST_ICON_SVGS[catalystId];
  if (renderer) {
    return <span style={{ display: 'inline-flex' }}>{renderer(color, size)}</span>;
  }
  // Fallback path — the catalyst's existing `icon` char with the same
  // colour treatment the previous inline `<span>{c.icon}</span>` had.
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
