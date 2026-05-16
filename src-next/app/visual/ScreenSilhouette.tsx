// ScreenSilhouette — per-screen procedural foreground silhouette,
// rendered between CosmosBackground (stars / nebula gradient) and the
// screen content. Gives each "destination" screen a sense of place
// without shipping external art: an observatory dome for the Hub, a
// night-market stall for the Shop, an anvil + bellows for the Forge,
// and an altar for the Astral Forge.
//
// Plain SVG silhouettes anchored to the bottom edge of the viewport.
// Color comes from the same accent tokens already used by panels so
// the silhouette feels native to the active cosmos theme. Opacity is
// low (~0.22) so the silhouette reads as background prop, not content
// the player has to parse.
//
// Tied off when screen isn't one of the four named destinations —
// returning null keeps the existing per-screen render path unchanged
// for Title / Codex / Round / Settings / etc.

import { useMemo } from 'react';

type ScreenId = 'hub' | 'shop' | 'forge' | 'astral_forge' | string;

type SilhouetteDef = {
  // Bottom-aligned SVG path drawn in a 0..600 wide × 0..200 tall viewBox.
  // The path should leave the top edge open (silhouette ground rises
  // from the bottom) and span the full width so wide screens still
  // read as a horizon.
  d: string;
  // CSS color override; falls back to the active screen's tint via
  // currentColor pipeline.
  fill: string;
  // Additional accent dots (sparkle stars near the silhouette). Each
  // tuple is [x, y, r] in the same viewBox space.
  sparks?: Array<[number, number, number]>;
  // Optional label flavor — never shown but reads back as docs.
  label: string;
};

// 4 destinations: Hub, Shop, Forge, Astral Forge. Each silhouette is
// composed from a single subpath so SVG fill-rule never matters and
// the form reads as one continuous horizon.
const SILHOUETTES: Record<string, SilhouetteDef> = {
  hub: {
    label: 'celestial observatory',
    // Dome with a sliver-open shutter + telescope barrel poking out
    // angled up-and-right. Stepped foundation columns frame the dome.
    d:
      'M 0 200 L 0 160 L 70 160 L 70 140 L 90 140 L 90 160 L 130 160 L 130 130 ' +
      'L 150 130 L 150 110 L 168 110 ' +
      // Dome curve
      'Q 200 60 250 50 L 270 40 L 280 30 ' +
      // Telescope barrel
      'L 320 14 L 326 22 L 290 46 ' +
      // Continue dome back down
      'Q 320 60 350 110 L 368 110 L 368 130 L 388 130 L 388 160 L 430 160 ' +
      'L 430 140 L 450 140 L 450 160 L 480 160 L 480 150 L 510 150 L 510 160 ' +
      'L 600 160 L 600 200 Z',
    fill: 'rgba(149, 119, 255, 0.22)',
    sparks: [[240, 30, 1.3], [310, 8, 1.8], [180, 28, 1.0]],
  },
  shop: {
    label: 'night-market stalls',
    // Three peaked stall awnings with a hanging lantern in front of the
    // center stall.
    d:
      'M 0 200 L 0 150 L 60 150 ' +
      // Left stall
      'L 60 110 L 100 80 L 140 110 L 140 150 L 220 150 ' +
      // Center stall (taller)
      'L 220 100 L 280 64 L 340 100 L 340 150 L 420 150 ' +
      // Right stall
      'L 420 120 L 460 92 L 500 120 L 500 150 L 600 150 L 600 200 Z',
    fill: 'rgba(245, 196, 81, 0.18)',
    sparks: [[280, 62, 1.4], [110, 80, 1.2], [470, 90, 1.0]],
  },
  forge: {
    label: 'forge anvil and bellows',
    // Squat anvil center, bellows-shape silhouette on the left,
    // a vertical hammer rack on the right.
    d:
      'M 0 200 L 0 160 ' +
      // Bellows (rounded triangle pointing right)
      'L 60 160 L 60 130 L 100 110 L 160 100 L 180 120 L 160 130 L 100 140 L 60 150 L 60 160 ' +
      'L 220 160 ' +
      // Anvil (T-shape)
      'L 220 130 L 250 130 L 250 90 L 350 90 L 350 130 L 380 130 L 380 160 ' +
      'L 440 160 ' +
      // Hammer rack
      'L 440 110 L 446 110 L 446 160 L 470 160 L 470 90 L 476 90 L 476 160 L 500 160 L 500 140 L 506 140 L 506 160 ' +
      'L 600 160 L 600 200 Z',
    fill: 'rgba(255, 138, 71, 0.20)',
    sparks: [[290, 76, 1.4], [320, 60, 1.0], [460, 50, 1.2]],
  },
  astral_forge: {
    label: 'altar with floating sigil',
    // Tiered altar with two columns flanking a raised slab.
    d:
      'M 0 200 L 0 170 L 80 170 ' +
      // Left column
      'L 80 110 L 100 110 L 100 90 L 130 90 L 130 110 L 150 110 L 150 170 ' +
      'L 220 170 ' +
      // Altar slab + tier
      'L 220 140 L 250 140 L 250 110 L 350 110 L 350 140 L 380 140 L 380 170 ' +
      'L 450 170 ' +
      // Right column (mirror of left)
      'L 450 110 L 470 110 L 470 90 L 500 90 L 500 110 L 520 110 L 520 170 ' +
      'L 600 170 L 600 200 Z',
    fill: 'rgba(123, 227, 255, 0.20)',
    sparks: [[300, 60, 2.4], [300, 80, 1.3], [240, 92, 1.0], [360, 92, 1.0]],
  },
};

export function ScreenSilhouette({ screen }: { screen: ScreenId }) {
  const def = SILHOUETTES[screen];
  // Memoize the sparkle layer so React doesn't shuffle the dot ids on
  // every render (which would re-fire the twinkle animation).
  const sparks = useMemo(() => def?.sparks ?? [], [def]);
  if (!def) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0, right: 0, bottom: 0,
        // Silhouette height scales with viewport but caps at 240px so
        // it doesn't dominate tall portrait phones. min(38vh) keeps the
        // silhouette proportional on tall screens while leaving the
        // screen content with plenty of room above it.
        height: 'min(240px, 38vh)',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <svg
        viewBox="0 0 600 200"
        preserveAspectRatio="xMidYMax slice"
        width="100%"
        height="100%"
        style={{ display: 'block' }}
      >
        {/* Vertical floor gradient softens the silhouette base so it
            doesn't hard-cut at the very bottom edge of the viewport. */}
        <defs>
          <linearGradient id={`silhouette-fade-${screen}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={def.fill} stopOpacity="0.0" />
            <stop offset="35%" stopColor={def.fill} stopOpacity="0.65" />
            <stop offset="100%" stopColor={def.fill} stopOpacity="1" />
          </linearGradient>
        </defs>
        <path d={def.d} fill={`url(#silhouette-fade-${screen})`} />
        {sparks.map((s, i) => (
          <circle
            key={i}
            cx={s[0]}
            cy={s[1]}
            r={s[2]}
            fill="#fff7e0"
            opacity={0.65}
            style={{ animation: `twinkle ${3 + i * 0.4}s ${i * 0.3}s ease-in-out infinite` }}
          />
        ))}
      </svg>
    </div>
  );
}
