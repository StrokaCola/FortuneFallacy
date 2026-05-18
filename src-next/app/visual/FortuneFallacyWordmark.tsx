// Fortune Fallacy wordmark — Title-screen lockup. Implements the design
// brief at public/brand/wordmark-brief.html (Claude Design handoff,
// 2026-05-17). Inlines the SVG so the wordmark composites cleanly with
// the cosmos background and inherits the title's fade-in animation.
//
// Anatomy (top → bottom):
//   1. 5-star Cassiopeia-shaped constellation polyline above the lockup
//   2. FORTUNE / FALLACY in Cinzel Decorative 900, brass-gradient fill,
//      aurora rim glow (Gaussian wash, NOT a drop shadow)
//   3. Gold hairline with terminal dot endpoints
//   4. "· A DICE ROGUELIKE ·" tagline in JetBrains Mono
//
// The brass gradient + aurora rim are baked into the SVG `<defs>`. The
// component is self-contained — drop anywhere the parent needs a
// stacked title lockup, e.g. the Title screen.

import { useId } from 'react';

const COLORS = {
  aurora: '#9577ff',
  gold: '#f5c451',
  goldDeep: '#c79730',
  bone: '#f3f0ff',
} as const;

// 5-star Cassiopeia "W" constellation — measured points in the 1000×120
// normalized space the brief uses, transformed into the wordmark's
// viewBox at render time.
const CASSIOPEIA = [
  { x:  60, y: 90, r: 7 },
  { x: 280, y: 30, r: 9 },
  { x: 500, y: 70, r: 11 },
  { x: 720, y: 18, r: 8 },
  { x: 940, y: 80, r: 6 },
] as const;

type WordmarkProps = {
  /** Optional sizing — defaults to "scales with width container". */
  width?: number | string;
  /** Override the tagline below the hairline. Pass empty string to hide. */
  tagline?: string;
  /** Hide the gold hairline + terminal dots. */
  hideHairline?: boolean;
  /** Hide the 5-star constellation above the wordmark. */
  hideConstellation?: boolean;
};

export function FortuneFallacyWordmark({
  width = '100%',
  tagline = 'A DICE ROGUELIKE',
  hideHairline = false,
  hideConstellation = false,
}: WordmarkProps) {
  // Stable per-instance gradient + filter ids so multiple wordmarks on
  // the same page (e.g. a side-by-side comparison render) don't collide.
  const uid = useId().replace(/:/g, '');
  const brassId = `ff-wm-brass-${uid}`;
  const auroraId = `ff-wm-aurora-${uid}`;
  const rimId = `ff-wm-rim-${uid}`;

  // viewBox matches the brief's square format. Height is reduced from
  // 2048 → 1280 because the original includes a large empty cosmos
  // field at the top + bottom; the Title screen renders this lockup
  // tightly so we crop the dead space.
  const W = 2048;
  const H = 1280;

  // Constellation lives near the top of the visible composition.
  const constellationX = W * 0.5 - 540;
  const constellationY = H * 0.10;
  const constellationScale = 1080 / 1000;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W} ${H}`}
      width={width}
      role="img"
      aria-label="Fortune Fallacy"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        {/* Aurora wash sits BEHIND the wordmark as backlight. Soft
            radial gradient, NOT a drop shadow. */}
        <radialGradient id={auroraId} cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor={COLORS.aurora} stopOpacity="0.85" />
          <stop offset="55%" stopColor={COLORS.aurora} stopOpacity="0.18" />
          <stop offset="100%" stopColor={COLORS.aurora} stopOpacity="0" />
        </radialGradient>
        {/* Brass gradient — top-bright, bottom-deep so the letterforms
            read as etched into a polished brass plate. */}
        <linearGradient id={brassId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#fde29a" />
          <stop offset="40%" stopColor={COLORS.gold} />
          <stop offset="100%" stopColor={COLORS.goldDeep} />
        </linearGradient>
        {/* Rim glow — Gaussian blur in aurora-violet so the letters
            feel back-lit. Not a drop shadow. */}
        <filter id={rimId} x="-25%" y="-50%" width="150%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="8.5" result="b" />
          <feFlood floodColor={COLORS.aurora} floodOpacity="0.85" />
          <feComposite in2="b" operator="in" />
          <feComponentTransfer><feFuncA type="linear" slope="1.6" /></feComponentTransfer>
        </filter>
      </defs>

      {/* Aurora backlight wash — two stacked ellipses behind the
          wordmark so the soft glow has visible depth. */}
      <ellipse
        cx={W / 2}
        cy={H * 0.46}
        rx={W * 0.40}
        ry={H * 0.22}
        fill={`url(#${auroraId})`}
        opacity={0.45}
      />
      <ellipse
        cx={W / 2}
        cy={H * 0.46}
        rx={W * 0.24}
        ry={H * 0.12}
        fill={`url(#${auroraId})`}
        opacity={0.34}
      />

      {/* 5-star constellation polyline above the wordmark. Lines first
          (so the stars paint on top), then the disc + gold inner ring
          per star. */}
      {!hideConstellation && (
        <g
          transform={`translate(${constellationX} ${constellationY}) scale(${constellationScale})`}
          opacity={0.85}
        >
          {CASSIOPEIA.slice(0, -1).map((p, i) => {
            const next = CASSIOPEIA[i + 1]!;
            return (
              <line
                key={`l-${i}`}
                x1={p.x}
                y1={p.y}
                x2={next.x}
                y2={next.y}
                stroke={COLORS.gold}
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={0.55}
              />
            );
          })}
          {CASSIOPEIA.map((s, i) => (
            <g key={`s-${i}`}>
              <circle cx={s.x} cy={s.y} r={s.r} fill={COLORS.bone} opacity={0.95} />
              <circle cx={s.x} cy={s.y} r={s.r * 0.42} fill={COLORS.gold} opacity={0.9} />
            </g>
          ))}
        </g>
      )}

      {/* FORTUNE + FALLACY are each rendered as a 3-layer stack:
          (1) aurora rim glow on its own filter layer behind the face,
          (2) brass-gradient face on top,
          (3) thin gold-deep hairline stroke over the brass for the
              "etched into a polished plate" read.
          Without the explicit 3-layer split the rim filter washes the
          brass fill (which is what the live brief render does). */}
      {(['FORTUNE', 'FALLACY'] as const).map((label, i) => {
        const cy = i === 0 ? H * 0.44 : H * 0.66;
        const textProps = {
          x: W / 2,
          y: cy,
          textAnchor: 'middle' as const,
          dominantBaseline: 'central' as const,
          fontFamily: "'Cinzel Decorative', serif",
          fontWeight: 900,
          fontSize: 248,
          letterSpacing: 22,
        };
        return (
          <g key={label}>
            <text {...textProps} fill={COLORS.aurora} opacity={0.55} filter={`url(#${rimId})`}>
              {label}
            </text>
            <text {...textProps} fill={`url(#${brassId})`}>
              {label}
            </text>
            <text {...textProps} fill="none" stroke={COLORS.goldDeep} strokeWidth={1} opacity={0.55}>
              {label}
            </text>
          </g>
        );
      })}

      {/* Gold hairline + terminal dots — sits under the wordmark like
          an instrument-panel underline. */}
      {!hideHairline && (
        <g transform={`translate(${W / 2} ${H * 0.80})`}>
          <line
            x1={-360}
            y1={0}
            x2={360}
            y2={0}
            stroke={COLORS.gold}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.85}
          />
          <circle cx={-360} cy={0} r={3} fill={COLORS.gold} opacity={0.85} />
          <circle cx={360} cy={0} r={3} fill={COLORS.gold} opacity={0.85} />
        </g>
      )}

      {/* Tagline — JetBrains Mono caps with wide letter-spacing, sits
          beneath the hairline as if measured on a star chart plate. */}
      {tagline && (
        <g transform={`translate(${W / 2} ${H * 0.88})`}>
          <text
            textAnchor="middle"
            fontFamily="'JetBrains Mono', monospace"
            fontSize={22}
            letterSpacing={14}
            fill={COLORS.gold}
            opacity={0.55}
          >
            · {tagline} ·
          </text>
        </g>
      )}
    </svg>
  );
}
