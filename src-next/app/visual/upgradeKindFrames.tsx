// KindFrame — bold, distinct silhouette per upgrade kind. Wraps the
// upgrade's icon node so a player can tell catalyst / mod / voucher /
// consumable / pack apart at a glance, anywhere upgrades appear.
//
// One silhouette per kind:
//   catalyst   → flat-top hexagon (crystal lattice)
//   mod        → notched disc (echoes a die's edge contour)
//   voucher    → cut-corner banner (contract / decree)
//   consumable → phial (single-use potion)
//   pack       → crate (container of consumables)
//
// Rarity drives stroke color, stroke width, and an outer radial glow.
// Legendary swaps the radial glow for the existing `.legendary-aura`
// pulsing class so the established legendary identity stays intact.
//
// Editions (foil/holo/poly) are rendered by the parent surface on top of
// this frame; the silhouette layer is edition-agnostic.

import type { ReactNode } from 'react';
import {
  RARITY_COLORS,
  rarityClassName,
  rarityGlowOpacity,
  rarityStrokeWidth,
  type Rarity,
} from './rarityStyles';

export type UpgradeKind = 'catalyst' | 'mod' | 'voucher' | 'consumable' | 'pack';

type Props = {
  kind: UpgradeKind;
  rarity?: Rarity | null;
  /** Override the default rarity-derived stroke. Useful when the parent
   *  already paints a rarity ring and wants the frame to match the
   *  per-item accent color (e.g. catalyst.color in the strip). */
  accentColor?: string;
  /** Edge length of the square viewport the silhouette is drawn into. */
  size: number;
  /** The icon node centered inside the silhouette (typically a 28-40px
   *  glyph with drop-shadow). */
  children: ReactNode;
  className?: string;
};

const VB = 100; // SVG viewBox is 0 0 100 100 for every silhouette

// Each path is sized to the 100×100 viewBox with ~6px padding so the
// stroke doesn't clip when a 2.5px legendary outline is rendered.
const PATHS: Record<UpgradeKind, string> = {
  // Flat-top hexagon, points at top-left/top-right and bottom-left/right.
  catalyst:
    'M 50 6 L 90 28 L 90 72 L 50 94 L 10 72 L 10 28 Z',
  // 6-notch disc — outer circle with 6 small concave notches at the
  // cardinal+diagonal points. Approximated as a circle path; the notches
  // are drawn as overlay marks via a separate layer below.
  mod:
    'M 50 8 a 42 42 0 1 0 0.01 0',
  // Banner with cut top corners and a slight scroll wave at the bottom.
  voucher:
    'M 18 14 L 26 8 L 74 8 L 82 14 L 82 84 L 74 90 L 26 90 L 18 84 Z',
  // Phial — narrow neck (top), bulbous body (bottom).
  consumable:
    'M 38 8 L 62 8 L 62 22 L 70 38 L 70 78 a 20 20 0 0 1 -40 0 L 30 38 L 38 22 Z',
  // Crate — square with a small flap protrusion on top + corner bevels.
  pack:
    'M 14 24 L 36 24 L 40 14 L 60 14 L 64 24 L 86 24 L 86 86 L 14 86 Z',
};

// Optional decoration overlays per kind (kept simple — silhouette does
// the heavy lifting). Drawn AFTER the main path so they sit on top of
// the fill without affecting hit-testing of the silhouette.
function KindDecoration({ kind, stroke }: { kind: UpgradeKind; stroke: string }) {
  if (kind === 'mod') {
    // Six radial notches around the disc edge — gives it the "cog/disc"
    // feel without making it busy at 28px.
    const marks = [0, 60, 120, 180, 240, 300].map((deg, i) => {
      const rad = (deg * Math.PI) / 180;
      const r1 = 42, r2 = 48;
      const cx = 50 + r1 * Math.cos(rad), cy = 50 + r1 * Math.sin(rad);
      const dx = 50 + r2 * Math.cos(rad), dy = 50 + r2 * Math.sin(rad);
      return <line key={i} x1={cx} y1={cy} x2={dx} y2={dy} stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />;
    });
    return <>{marks}</>;
  }
  if (kind === 'voucher') {
    // Two horizontal rule lines suggesting written text inside the banner.
    return (
      <>
        <line x1={28} y1={36} x2={72} y2={36} stroke={stroke} strokeWidth={1} opacity={0.45} />
        <line x1={28} y1={50} x2={66} y2={50} stroke={stroke} strokeWidth={1} opacity={0.45} />
      </>
    );
  }
  if (kind === 'consumable') {
    // Cork band on the neck.
    return <rect x={36} y={4} width={28} height={6} rx={1} fill={stroke} opacity={0.45} />;
  }
  if (kind === 'pack') {
    // Tape strip across the lid.
    return <line x1={14} y1={40} x2={86} y2={40} stroke={stroke} strokeWidth={1.25} opacity={0.55} />;
  }
  return null;
}

export function KindFrame({ kind, rarity, accentColor, size, children, className }: Props) {
  const strokeColor = accentColor ?? (rarity ? RARITY_COLORS[rarity] : '#7be3ff');
  const strokeWidth = rarityStrokeWidth(rarity);
  const glowOpacity = rarityGlowOpacity(rarity);
  const auraClass = rarityClassName(rarity);
  const path = PATHS[kind];

  const wrapperClass = [auraClass, className].filter(Boolean).join(' ') || undefined;

  return (
    <div
      data-kind={kind}
      data-rarity={rarity ?? 'none'}
      className={wrapperClass}
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {/* Outer rarity glow — soft halo behind the silhouette. Legendary
          omits this layer; .legendary-aura class on the wrapper handles
          its pulsing aura instead. */}
      {glowOpacity > 0 && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: -size * 0.12,
            borderRadius: '50%',
            background: `radial-gradient(circle at center, ${strokeColor}${Math.round(glowOpacity * 255).toString(16).padStart(2, '0')} 0%, transparent 65%)`,
            filter: `blur(${Math.max(4, size * 0.1)}px)`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        width={size}
        height={size}
        aria-hidden
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
      >
        <path
          d={path}
          fill={`${strokeColor}1f`}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <KindDecoration kind={kind} stroke={strokeColor} />
      </svg>

      {/* Icon — sits centered above the silhouette. We do NOT force a
          text color here; the parent surface inherits responsibility for
          the icon glyph color so each catalyst / mod / consumable can
          keep its own identity (c.color) while the silhouette stroke
          tells the rarity story. */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          fontSize: Math.round(size * 0.42),
          lineHeight: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
