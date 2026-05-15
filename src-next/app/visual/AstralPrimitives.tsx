// Bespoke astral primitives — the building blocks of the
// 2026-05-15 polish pass. Bundled into one file because each is
// small (~10-30 lines) and they share a single design language.
// Importing one symbol gives the whole vocabulary.
//
// All components are presentational only — no state, no bus
// listeners, just composition over the CSS classes defined in
// styles/index.css under "BESPOKE ASTRAL POLISH."

import type { ReactNode, CSSProperties } from 'react';

// ─── AstralDivider ─────────────────────────────────────────
// Thin gradient line bookended by tiny diamonds. Drop in
// anywhere a section break would otherwise rely on whitespace
// or contrast alone. The default glyph is ◇; pass `glyph` to
// override (e.g. ✦ for an empty state).
export function AstralDivider({ glyph = '◇' }: { glyph?: string }) {
  return (
    <div className="ff-divider" aria-hidden="true">
      <span className="ff-divider-bar" />
      <span className="ff-divider-glyph">{glyph}</span>
      <span className="ff-divider-bar right" />
    </div>
  );
}

// ─── Chip ──────────────────────────────────────────────────
// Standardized inline label. Replaces the dozens of inline-
// styled "ANTE 02 · LESSER TRIAL" / "treasury" / "score" tags.
// Optional `tone` color drives an accent dot on the left of
// the label; without it, no dot renders.
export function Chip({
  children,
  tone,
  style,
}: {
  children: ReactNode;
  tone?: string;
  style?: CSSProperties;
}) {
  return (
    <span className="ff-chip" style={style}>
      {tone && <span className="ff-chip-dot" style={{ color: tone }} />}
      <span>{children}</span>
    </span>
  );
}

// ─── ScreenHeader ──────────────────────────────────────────
// Standardized screen title block — flanked diamond glyphs +
// breathing gold underline + optional subtitle. Used on Title /
// Settings / Codex / Scores / etc. so every meta-screen reads as
// having the same identity stamp.
export function ScreenHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="ff-screen-header">
      <div className="ff-screen-header-title f-display">{title}</div>
      <div className="ff-screen-header-underline" />
      {subtitle && <div className="ff-screen-header-subtitle">{subtitle}</div>}
    </div>
  );
}

// ─── ScreenWatermark ───────────────────────────────────────
// Faint ~3% sigil rendered at bottom-right of a screen so the
// chrome has a sense of room beyond the immediate UI. Pass any
// SVG content (Sigil, BossSigil, constellation glyph, etc.)
// and an optional accent color for the drop-shadow tint.
export function ScreenWatermark({
  children,
  color = '#7be3ff',
  position = 'bottom-right',
}: {
  children: ReactNode;
  color?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}) {
  const positionStyle: CSSProperties = (() => {
    switch (position) {
      case 'bottom-left':  return { bottom: 24, left: 24, right: 'auto' };
      case 'top-right':    return { top: 24, right: 24, bottom: 'auto' };
      case 'top-left':     return { top: 24, left: 24, right: 'auto', bottom: 'auto' };
      default:             return { bottom: 24, right: 24 };
    }
  })();
  return (
    <div className="ff-screen-watermark" style={{ ...positionStyle, color }} aria-hidden="true">
      {children}
    </div>
  );
}

// ─── AstralSpinner ─────────────────────────────────────────
// Generalized loading spinner — rotating gold rays with a
// pulsing ember in the middle. Replaces the ad-hoc Forge
// loader and the "loading…" plain-text fallbacks.
export function AstralSpinner({ size = 48 }: { size?: number }) {
  return (
    <div className="ff-spinner" style={{ width: size, height: size }} aria-label="Loading">
      <svg
        className="ff-spinner-rays"
        viewBox="0 0 48 48"
        width={size}
        height={size}
        style={{ overflow: 'visible' }}
      >
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const x1 = 24 + Math.cos(angle) * 14;
          const y1 = 24 + Math.sin(angle) * 14;
          const x2 = 24 + Math.cos(angle) * 22;
          const y2 = 24 + Math.sin(angle) * 22;
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#f5c451"
              strokeWidth={1.4}
              strokeLinecap="round"
              opacity={0.55 + (i / 8) * 0.4}
            />
          );
        })}
      </svg>
      <div className="ff-spinner-ember" />
    </div>
  );
}

// ─── ConstellationCount ────────────────────────────────────
// Glanceable replacement for "1/6"-style numeric capacities.
// Renders `filled` solid dots followed by `total - filled`
// outlined dots in the given accent color.
export function ConstellationCount({
  filled,
  total,
  color = '#7be3ff',
  size = 7,
}: {
  filled: number;
  total: number;
  color?: string;
  size?: number;
}) {
  return (
    <span className="ff-count" style={{ color }} aria-label={`${filled} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`ff-count-dot${i >= filled ? ' empty' : ''}`}
          style={{ width: size, height: size }}
        />
      ))}
    </span>
  );
}

// ─── PanelFrame ────────────────────────────────────────────
// Wraps any panel with the four tiny gold-trim corner ornaments.
// Apply via className concat OR wrap a child. The wrapper
// rendering pattern lets you opt-in without restructuring
// existing markup.
export function PanelFrame({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`ff-panel-framed ${className}`.trim()} style={style}>
      <span className="ff-panel-corner-tr" aria-hidden="true" />
      <span className="ff-panel-corner-bl" aria-hidden="true" />
      {children}
    </div>
  );
}
