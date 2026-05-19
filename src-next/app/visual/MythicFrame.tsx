// Mythic catalyst frame — apex-tier visual treatment.
//
// 2026-05-19 — built from the Catalyst Card System Brief design package
// (chats/chat4.md in the bundle). Cyberpunk-cosmic: locked rectangle,
// prismatic spectrum marqueeing the perimeter via @property animated
// conic-gradient, HUD bracket corners + scan-target reticle crown, CRT
// scanline overlay, paired neon data-stream rails, signal-trace cartouche
// with mono RGB-split name and oscilloscope waveform, twin counter-phased
// glitch slices + sub-pixel shake + SVG feDisplacementMap bursts that
// physically warp the host card edges every ~5.5s, plus an orbital comet
// that traces the perimeter on an 8s loop.
//
// The CSS lives in styles/index.css under "Mythic (apex tier)". This
// component just owns the DOM structure + dynamic offset-path that adapts
// the comet's orbital trace to the actual host rect (the design used a
// hand-fit 180×260 path; we recompute on resize so the same component
// works at shop-card 180×250 and at strip-tile 64×88).
//
// Usage:
//   <div style={{ position: 'relative' }} className="is-mythic">
//     <MythicFrame name="Hoarder's Crown" />
//     ...your card content...
//   </div>
//
// Pair `<MythicFrame />` with the `is-mythic` class on the host so the
// breathing halo + shake + displacement bursts fire at the card level
// while this component owns the inner frame surface.

import { useEffect, useRef, useState, type CSSProperties } from 'react';

export type MythicFrameProps = {
  /** Catalyst name to render in the cartouche. When omitted, the
   *  cartouche shows a generic "MYTHIC // CATALYST" marker. Long names
   *  are truncated via text-overflow: ellipsis. */
  name?: string;
  /** Drop the bits that don't read at thumbnail size — cartouche,
   *  scanlines, data-stream rails, and the displacement filter. Keeps
   *  the marquee rim, brackets, crown, glitch slice, and comet. Auto-
   *  detected when the host is < 110px wide; pass explicitly to force. */
  compact?: boolean;
};

// Used in the cartouche when no catalyst name is provided. Matches the
// design package's mockup label ("M-042 // RECURSION") in vibe — fixed
// catalog-style code that reads as "datamoshed prophecy."
const FALLBACK_NAME = 'MYTHIC // CATALYST';

// SVG snippets for the corner brackets, crown, and oscilloscope trace
// — lifted verbatim from the design package brief HTML so the pixel-level
// hatch pattern, tick marks, and waveform peaks match the mockup.
const CornerSvg = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" aria-hidden>
    <path d="M 3 3 L 11 3 M 3 3 L 3 11" />
    <line x1="6" y1="3" x2="6" y2="4.5" />
    <line x1="3" y1="6" x2="4.5" y2="6" />
    <line x1="9" y1="3" x2="9" y2="4" />
    <line x1="3" y1="9" x2="4" y2="9" />
    <line x1="7.5" y1="7.5" x2="11" y2="11" opacity="0.55" />
  </svg>
);

const CrownSvg = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square" aria-hidden>
    <circle cx="12" cy="12" r="6" />
    <line x1="5"  y1="12" x2="9"  y2="12" />
    <line x1="15" y1="12" x2="19" y2="12" />
    <line x1="12" y1="5"  x2="12" y2="9" />
    <line x1="12" y1="15" x2="12" y2="19" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
    <line x1="3"  y1="3"  x2="5"  y2="5" />
    <line x1="21" y1="3"  x2="19" y2="5" />
    <line x1="3"  y1="21" x2="5"  y2="19" />
    <line x1="21" y1="21" x2="19" y2="19" />
  </svg>
);

const TraceSvg = () => (
  <svg className="myth-trace" viewBox="0 0 82 12" fill="none" stroke="currentColor" strokeWidth="0.7" strokeLinecap="square" strokeLinejoin="miter" aria-hidden>
    <polyline points="2,9 10,9 14,3 18,9 26,9 30,1 34,9 42,9 48,5 52,9 60,9 64,3 68,9 80,9" />
    <circle cx="14" cy="3" r="1"   fill="currentColor" />
    <circle cx="30" cy="1" r="1.4" fill="currentColor" />
    <circle cx="48" cy="5" r="1"   fill="currentColor" />
    <circle cx="64" cy="3" r="1"   fill="currentColor" />
  </svg>
);

// Inset the orbital path 5px from each edge so the comet head (10px
// diameter, half-extents margin'd out via the CSS rule) traces along
// the rim rather than off-canvas. Matches the design's `M 5 5 L 175 5
// L 175 255 L 5 255 Z` shape, generalised to the measured rect.
function buildOrbitPath(w: number, h: number): string {
  const inset = 5;
  const x0 = inset, y0 = inset;
  const x1 = Math.max(inset + 1, w - inset);
  const y1 = Math.max(inset + 1, h - inset);
  return `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`;
}

export function MythicFrame({ name, compact }: MythicFrameProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ w: number; h: number } | null>(null);

  // Measure the host on mount + resize so the comet's offset-path tracks
  // the actual rect. ResizeObserver is the only way to react to the
  // parent shop card flipping between tight portrait full-width and the
  // desktop 180×250 fixed size without remounting.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      if (w > 0 && h > 0) setRect({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-compact when the host is small (CatalystStrip tile = 64×88,
  // Codex cell ≈ 48px). The CSS class flips off the cartouche, data-
  // stream rails, scanlines, and the displacement filter for tile-sized
  // surfaces where those bits don't read or aren't worth the GPU cost.
  const isCompact = compact ?? (rect ? rect.w < 110 : false);
  const orbitPath = rect ? buildOrbitPath(rect.w, rect.h) : 'M 5 5 L 175 5 L 175 255 L 5 255 Z';
  const cometStyle: CSSProperties = { offsetPath: `path('${orbitPath}')` } as CSSProperties;

  const classes = ['frame', 'frame-mythic', isCompact ? 'myth-compact' : ''].filter(Boolean).join(' ');

  return (
    <div ref={rootRef} className={classes} aria-hidden>
      <div className="myth-corner tl"><CornerSvg /></div>
      <div className="myth-corner tr"><CornerSvg /></div>
      <div className="myth-corner bl"><CornerSvg /></div>
      <div className="myth-corner br"><CornerSvg /></div>
      <div className="myth-crown"><CrownSvg /></div>
      <div className="myth-scanlines" />
      <div className="myth-datastream l" />
      <div className="myth-datastream r" />
      <div className="myth-glitch" />
      <div className="myth-cartouche">
        <span className="myth-name">{(name ?? FALLBACK_NAME).toUpperCase()}</span>
        <TraceSvg />
      </div>
      <div className="myth-comet" style={cometStyle} />
    </div>
  );
}
