// BossAura — procedural illustration layer behind the BossSigil during
// reveal phase. Replaces the "thin wireframe sigil floating in dark
// panel" look with a denser composition: per-boss creature silhouette
// SVG, a slow counter-rotating runic ring, and a radial halo bloom.
//
// All visuals are pure SVG + CSS so no external art assets ship. The
// per-boss silhouette table is intentionally small (8 entries to match
// the 8 bosses); each entry hand-authored as a single path so the
// presence reads as that boss's mythic shape, not a generic outline.

import { useMemo } from 'react';

type Props = {
  bossId: string;
  color: string;
  // Final composed size in px; the aura scales its own elements off
  // this so the sigil and the aura stay visually coupled.
  size: number;
};

// Per-boss creature silhouette path. Each path is hand-authored in a
// -50..50 viewBox so the same `size` from the parent maps cleanly.
//
// Design notes:
//   pluto    — gambler's skull crowned with dice
//   sedna    — deep-cold maiden with long flowing hair
//   ceres    — harvest mother with wheat curls + central eye
//   triton   — tide herald: wave coils + trident
//   charon   — hooded ferryman with lantern
//   callisto — many-eyed bear-beast
//   phobos   — fractal panic-mask
//   eris     — broken apple of discord
//
// Paths kept fill-only (no stroke complexity) so the silhouette reads
// as a solid form behind the line-art sigil. Color comes from the boss's
// own accent so the aura tints with the run's threat color.
const CREATURE_PATHS: Record<string, string> = {
  pluto:
    // Skull crown: dome at top with three small dice-cube crowns +
    // hollow eye sockets and a jawline.
    'M -22 -10 C -22 -28 -10 -36 0 -36 C 10 -36 22 -28 22 -10 ' +
    'L 22 6 L 16 14 L 12 12 L 8 18 L -8 18 L -12 12 L -16 14 L -22 6 Z ' +
    'M -10 -16 a 5 5 0 1 0 0.1 0 Z M 10 -16 a 5 5 0 1 0 0.1 0 Z ' +
    'M -14 -40 h 8 v 6 h -8 z M -4 -42 h 8 v 8 h -8 z M 6 -40 h 8 v 6 h -8 z',
  sedna:
    // Veiled head with long hair streaming downward, lidded eye.
    'M 0 -32 C -14 -32 -20 -22 -20 -12 L -22 -2 L -24 12 L -22 22 ' +
    'L -16 28 L -10 26 L -8 22 L -4 24 L 4 24 L 8 22 L 10 26 L 16 28 ' +
    'L 22 22 L 24 12 L 22 -2 L 20 -12 C 20 -22 14 -32 0 -32 Z ' +
    'M -6 -12 q 6 -4 12 0 q -6 8 -12 0 Z',
  ceres:
    // Central eye with curling wheat fronds either side.
    'M -28 0 q 4 -14 14 -10 q 2 -10 14 -10 q 12 0 14 10 q 10 -4 14 10 ' +
    'q -8 12 -16 8 q -2 12 -12 12 q -10 0 -12 -12 q -8 4 -16 -8 Z ' +
    'M -6 -2 a 6 4 0 1 0 12 0 a 6 4 0 1 0 -12 0 Z',
  triton:
    // Trident emerging from coiled wave.
    'M 0 -36 L -2 -10 L -8 -16 L -8 -8 L -2 -2 L -2 24 ' +
    'M 0 -36 L 2 -10 L 8 -16 L 8 -8 L 2 -2 L 2 24 ' +
    'M -22 24 C -14 16 -6 28 0 22 C 6 28 14 16 22 24 ' +
    'C 22 30 14 32 0 32 C -14 32 -22 30 -22 24 Z',
  charon:
    // Hooded silhouette holding a lantern (small disc to side).
    'M -16 -28 Q -20 -10 -22 8 L -16 26 L 16 26 L 22 8 Q 20 -10 16 -28 ' +
    'Q 12 -34 0 -34 Q -12 -34 -16 -28 Z ' +
    'M -6 -8 q 6 -4 12 0 q -6 8 -12 0 Z ' +
    'M 22 6 a 5 5 0 1 0 0.1 0 Z',
  callisto:
    // Bear-beast outline with multiple eye dots.
    'M -28 -8 Q -30 -28 -16 -32 Q -12 -36 -8 -32 Q 0 -34 8 -32 ' +
    'Q 12 -36 16 -32 Q 30 -28 28 -8 L 24 18 L 14 28 L -14 28 L -24 18 Z ' +
    'M -14 -18 a 3 3 0 1 0 0.1 0 Z M 0 -18 a 3 3 0 1 0 0.1 0 Z ' +
    'M 14 -18 a 3 3 0 1 0 0.1 0 Z M -7 -6 a 2 2 0 1 0 0.1 0 Z ' +
    'M 7 -6 a 2 2 0 1 0 0.1 0 Z',
  phobos:
    // Fractal panic-mask: jagged perimeter, hollow mouth.
    'M 0 -32 L 14 -22 L 24 -22 L 18 -10 L 28 0 L 18 8 L 22 22 L 8 18 L 0 28 ' +
    'L -8 18 L -22 22 L -18 8 L -28 0 L -18 -10 L -24 -22 L -14 -22 Z ' +
    'M -10 -8 a 3 3 0 1 0 0.1 0 Z M 10 -8 a 3 3 0 1 0 0.1 0 Z ' +
    'M -10 8 L -2 14 L 2 14 L 10 8 L 6 12 L -6 12 Z',
  eris:
    // Broken apple of discord with crack down the center.
    'M 0 -28 Q 18 -22 22 -4 Q 22 18 0 26 Q -22 18 -22 -4 Q -18 -22 0 -28 Z ' +
    'M -2 -28 L 4 -16 L -2 -8 L 6 0 L -2 10 L 4 22 ' +
    'M 0 -32 L 6 -38 L 8 -34 L 2 -28 Z',
};

// Outer-ring glyph alphabet. 12 positions around the sigil — picked so
// the ring reads as written language without belonging to any real
// script. Per-boss table picks which 12 to use; falls back to the
// generic set when the boss isn't listed (defensive for older saves).
const GENERIC_GLYPHS = ['◇', '✦', '◈', '☉', '⊕', '⊘', '◐', '◑', '◒', '◓', '◔', '◕'];
const BOSS_GLYPHS: Record<string, string[]> = {
  pluto:    ['☠', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅', '☠', '✶', '⚀', '⚄', '✶'],
  sedna:    ['❄', '◐', '☾', '◑', '❄', '☾', '◒', '❄', '☽', '◓', '❄', '☾'],
  ceres:    ['☘', '✶', '☘', '◉', '☘', '✶', '☘', '◉', '☘', '✶', '☘', '◉'],
  triton:   ['≈', '⊛', '≈', '◈', '≈', '⊛', '≈', '◈', '≈', '⊛', '≈', '◈'],
  charon:   ['☥', '⛧', '☥', '✠', '☥', '⛧', '☥', '✠', '☥', '⛧', '☥', '✠'],
  callisto: ['☉', '◉', '☉', '◎', '☉', '◉', '☉', '◎', '☉', '◉', '☉', '◎'],
  phobos:   ['✕', '☩', '✕', '⚠', '✕', '☩', '✕', '⚠', '✕', '☩', '✕', '⚠'],
  eris:     ['✦', '⚝', '✦', '☆', '✦', '⚝', '✦', '☆', '✦', '⚝', '✦', '☆'],
};

export function BossAura({ bossId, color, size }: Props) {
  const creaturePath = CREATURE_PATHS[bossId];
  const glyphs = BOSS_GLYPHS[bossId] ?? GENERIC_GLYPHS;
  // Pre-compute glyph positions on a circle so the JSX stays declarative.
  // Position math runs once per (bossId, size) tuple — the ring spins via
  // CSS transform, not by re-rendering positions per frame.
  const ringRadius = size * 0.62;
  const innerRadius = size * 0.48;
  const ringPositions = useMemo(() => {
    return glyphs.map((g, i) => {
      const angle = (i / glyphs.length) * Math.PI * 2 - Math.PI / 2;
      return {
        glyph: g,
        x: Math.cos(angle) * ringRadius,
        y: Math.sin(angle) * ringRadius,
        rot: (i / glyphs.length) * 360,
      };
    });
  }, [glyphs, ringRadius]);

  // Container is square + sigil-sized; the aura paints UNDER the BossSigil
  // because BossReveal renders <BossAura/> before <BossSigil/>. Pointer
  // events disabled so the aura never intercepts the dismiss-click that
  // BossReveal's outer wrapper listens for.
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* Radial halo — soft bloom that establishes a "this is luminous"
          read behind the line-art sigil. Color-tinted by boss. Doesn't
          animate; the surrounding panel's float-y already moves it. */}
      <div
        style={{
          position: 'absolute',
          width: size * 1.6,
          height: size * 1.6,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}33 0%, ${color}18 35%, transparent 70%)`,
          filter: 'blur(6px)',
        }}
      />

      {/* Creature silhouette — hand-authored per-boss SVG path filled with
          the boss accent. Sits BEHIND the BossSigil's line-art so the
          combined read is "creature with sigil etched over it." Pulses
          a soft breath cycle so the aura looks alive without competing
          with the foreground glyph. */}
      {creaturePath && (
        <svg
          viewBox="-50 -50 100 100"
          width={size * 1.15}
          height={size * 1.15}
          className="boss-aura-creature"
          style={{
            position: 'absolute',
            filter: `drop-shadow(0 0 18px ${color}cc) drop-shadow(0 0 36px ${color}77)`,
          }}
        >
          <path
            d={creaturePath}
            fill={`${color}66`}
            stroke={`${color}aa`}
            strokeWidth={0.6}
            strokeLinejoin="round"
          />
        </svg>
      )}

      {/* Inner shadow ring — keeps the sigil readable against the
          creature silhouette by dimming the strip directly under it. */}
      <div
        style={{
          position: 'absolute',
          width: innerRadius * 2,
          height: innerRadius * 2,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(7,5,26,0.4) 0%, transparent 75%)',
        }}
      />

      {/* Counter-rotating runic ring. Each glyph counter-rotates
          around its own center so the text always reads upright as the
          parent rotates. 36s/lap → ambient, never urgent. */}
      <div
        className="boss-aura-ring"
        style={{
          position: 'absolute',
          width: ringRadius * 2,
          height: ringRadius * 2,
          ['--boss-aura-color' as string]: color,
        }}
      >
        {ringPositions.map((p, i) => (
          <span
            key={i}
            className="boss-aura-glyph"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(${p.x}px, ${p.y}px)`,
              fontSize: Math.max(11, Math.round(size * 0.075)),
              color,
              textShadow: `0 0 6px ${color}, 0 0 12px ${color}88`,
              lineHeight: 1,
              transformOrigin: 'center',
            }}
          >
            <span
              className="boss-aura-glyph-inner"
              style={{
                display: 'inline-block',
                transform: `rotate(${-p.rot}deg)`,
              }}
            >
              {p.glyph}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
