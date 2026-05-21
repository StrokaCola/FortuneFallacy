// src-next/app/visual/VoidScene.tsx
// Full 11-layer Void Mode backdrop. Replaces the simple violet tint of
// the original <VoidOverlay>. Mounted at App level while run.mode === 'void'.
//
// Layer stack (bottom → top, scoped by VoidScene.css):
//   bg-void · bg-streaks · bg-stardust · void-shell ×3 ·
//   lensed-lattice SVG · accretion-halo · accretion-disk ·
//   photon-orbits ×2 · photon-ring · event-horizon ·
//   bg-tension-wash · bg-progress-underwash · bg-progress-halo
//
// Variants — 7 in total (lyra/triumvirate/fibonacci/ophiuchus/argo/
// eclipse/crimson). The data-variant attribute on the wrapper picks
// the `--v-*` token block in VoidScene.css.
//
// Reactive props — `tension` (0..1) and `progress` (0..~1.5) flow in
// as CSS variables on the wrapper. Layer formulas in VoidScene.css
// read those vars to drive opacity, ring radius, infall speed, and
// the redshifted-lattice tint.
//
// Pointer-events are off on every layer; this is pure cosmetic
// background. All animations honor prefers-reduced-motion via the
// media query at the bottom of VoidScene.css.

import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import './VoidScene.css';

export type VoidVariant =
  | 'lyra'
  | 'triumvirate'
  | 'fibonacci'
  | 'ophiuchus'
  | 'argo'
  | 'eclipse'
  | 'crimson';

type Props = {
  active: boolean;
  variant: VoidVariant;
  tension: number;
  progress: number;
};

// The lensed-lattice SVG is a fixed handful of paths/lines/circles in
// the 100×100 viewBox. Lifted verbatim from the design HTML so the
// CSS in VoidScene.css can target `.web-line`, `.web-node`, etc.
function LensedLatticeSvg() {
  return (
    <svg
      className="web-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="voidLensFalloff" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="85%" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="voidLensFalloffMask">
          <rect x="0" y="0" width="100" height="100" fill="url(#voidLensFalloff)" />
        </mask>
      </defs>
      <g className="web-rotator" mask="url(#voidLensFalloffMask)">
        {/* Ring 1: outermost, 12 nodes on r=44. Clean lattice. */}
        <g className="ring-1">
          <line className="web-line" x1="50.0" y1="6.0" x2="71.0" y2="11.6" />
          <line className="web-line" x1="71.0" y1="11.6" x2="86.4" y2="27.0" />
          <line className="web-line" x1="86.4" y1="27.0" x2="92.0" y2="48.0" />
          <line className="web-line" x1="92.0" y1="48.0" x2="86.4" y2="69.0" />
          <line className="web-line" x1="86.4" y1="69.0" x2="71.0" y2="84.4" />
          <line className="web-line" x1="71.0" y1="84.4" x2="50.0" y2="90.0" />
          <line className="web-line" x1="50.0" y1="90.0" x2="29.0" y2="84.4" />
          <line className="web-line" x1="29.0" y1="84.4" x2="13.6" y2="69.0" />
          <line className="web-line" x1="13.6" y1="69.0" x2="8.0" y2="48.0" />
          <line className="web-line" x1="8.0" y1="48.0" x2="13.6" y2="27.0" />
          <line className="web-line" x1="13.6" y1="27.0" x2="29.0" y2="11.6" />
          <line className="web-line" x1="29.0" y1="11.6" x2="50.0" y2="6.0" />
          <circle className="web-node-bright" cx="50.0" cy="6.0" r="0.75" />
          <circle className="web-node" cx="71.0" cy="11.6" r="0.55" />
          <circle className="web-node" cx="86.4" cy="27.0" r="0.55" />
          <circle className="web-node-bright" cx="92.0" cy="48.0" r="0.75" />
          <circle className="web-node" cx="86.4" cy="69.0" r="0.55" />
          <circle className="web-node" cx="71.0" cy="84.4" r="0.55" />
          <circle className="web-node-bright" cx="50.0" cy="90.0" r="0.75" />
          <circle className="web-node" cx="29.0" cy="84.4" r="0.55" />
          <circle className="web-node" cx="13.6" cy="69.0" r="0.55" />
          <circle className="web-node-bright" cx="8.0" cy="48.0" r="0.75" />
          <circle className="web-node" cx="13.6" cy="27.0" r="0.55" />
          <circle className="web-node" cx="29.0" cy="11.6" r="0.55" />
        </g>

        {/* Ring 2: r=30, 12 nodes, bent spokes to ring 1 */}
        <g className="ring-2">
          <path className="web-line" d="M 50.0,20.0  Q 50.0,30.0 50.0,6.0" />
          <path className="web-line" d="M 65.0,24.0  Q 58.0,30.0 71.0,11.6" />
          <path className="web-line" d="M 76.0,35.0  Q 64.0,42.0 86.4,27.0" />
          <path className="web-line" d="M 80.0,50.0  Q 65.0,50.0 92.0,48.0" />
          <path className="web-line" d="M 76.0,65.0  Q 64.0,58.0 86.4,69.0" />
          <path className="web-line" d="M 65.0,76.0  Q 58.0,70.0 71.0,84.4" />
          <path className="web-line" d="M 50.0,80.0  Q 50.0,70.0 50.0,90.0" />
          <path className="web-line" d="M 35.0,76.0  Q 42.0,70.0 29.0,84.4" />
          <path className="web-line" d="M 24.0,65.0  Q 36.0,58.0 13.6,69.0" />
          <path className="web-line" d="M 20.0,50.0  Q 35.0,50.0 8.0,48.0" />
          <path className="web-line" d="M 24.0,35.0  Q 36.0,42.0 13.6,27.0" />
          <path className="web-line" d="M 35.0,24.0  Q 42.0,30.0 29.0,11.6" />
          <line className="web-line" x1="50.0" y1="20.0" x2="65.0" y2="24.0" />
          <line className="web-line" x1="65.0" y1="24.0" x2="76.0" y2="35.0" />
          <line className="web-line" x1="76.0" y1="35.0" x2="80.0" y2="50.0" />
          <line className="web-line" x1="80.0" y1="50.0" x2="76.0" y2="65.0" />
          <line className="web-line" x1="76.0" y1="65.0" x2="65.0" y2="76.0" />
          <line className="web-line" x1="65.0" y1="76.0" x2="50.0" y2="80.0" />
          <line className="web-line" x1="50.0" y1="80.0" x2="35.0" y2="76.0" />
          <line className="web-line" x1="35.0" y1="76.0" x2="24.0" y2="65.0" />
          <line className="web-line" x1="24.0" y1="65.0" x2="20.0" y2="50.0" />
          <line className="web-line" x1="20.0" y1="50.0" x2="24.0" y2="35.0" />
          <line className="web-line" x1="24.0" y1="35.0" x2="35.0" y2="24.0" />
          <line className="web-line" x1="35.0" y1="24.0" x2="50.0" y2="20.0" />
          <circle className="web-node" cx="50.0" cy="20.0" r="0.50" />
          <circle className="web-node" cx="65.0" cy="24.0" r="0.50" />
          <circle className="web-node" cx="76.0" cy="35.0" r="0.50" />
          <circle className="web-node-bright" cx="80.0" cy="50.0" r="0.75" />
          <circle className="web-node" cx="76.0" cy="65.0" r="0.50" />
          <circle className="web-node" cx="65.0" cy="76.0" r="0.50" />
          <circle className="web-node" cx="50.0" cy="80.0" r="0.50" />
          <circle className="web-node" cx="35.0" cy="76.0" r="0.50" />
          <circle className="web-node" cx="24.0" cy="65.0" r="0.50" />
          <circle className="web-node-bright" cx="20.0" cy="50.0" r="0.75" />
          <circle className="web-node" cx="24.0" cy="35.0" r="0.50" />
          <circle className="web-node" cx="35.0" cy="24.0" r="0.50" />
        </g>

        {/* Ring 3: r=18, 8 nodes, redshifted — sits inside disk plane */}
        <g className="ring-3">
          <path className="web-line redshifted" d="M 50.0,32.0  Q 50.0,26.0 50.0,20.0" />
          <path className="web-line redshifted" d="M 63.0,37.0  Q 60.0,30.0 76.0,35.0" />
          <path className="web-line redshifted" d="M 68.0,50.0  Q 60.0,50.0 80.0,50.0" />
          <path className="web-line redshifted" d="M 63.0,63.0  Q 60.0,70.0 76.0,65.0" />
          <path className="web-line redshifted" d="M 50.0,68.0  Q 50.0,74.0 50.0,80.0" />
          <path className="web-line redshifted" d="M 37.0,63.0  Q 40.0,70.0 24.0,65.0" />
          <path className="web-line redshifted" d="M 32.0,50.0  Q 40.0,50.0 20.0,50.0" />
          <path className="web-line redshifted" d="M 37.0,37.0  Q 40.0,30.0 24.0,35.0" />
          <line className="web-line redshifted" x1="50.0" y1="32.0" x2="63.0" y2="37.0" />
          <line className="web-line redshifted" x1="63.0" y1="37.0" x2="68.0" y2="50.0" />
          <line className="web-line redshifted" x1="68.0" y1="50.0" x2="63.0" y2="63.0" />
          <line className="web-line redshifted" x1="63.0" y1="63.0" x2="50.0" y2="68.0" />
          <line className="web-line redshifted" x1="50.0" y1="68.0" x2="37.0" y2="63.0" />
          <line className="web-line redshifted" x1="37.0" y1="63.0" x2="32.0" y2="50.0" />
          <line className="web-line redshifted" x1="32.0" y1="50.0" x2="37.0" y2="37.0" />
          <line className="web-line redshifted" x1="37.0" y1="37.0" x2="50.0" y2="32.0" />
          <ellipse className="web-node redshifted" cx="50.0" cy="32.0" rx="0.40" ry="0.75" transform="rotate(0 50 32)" />
          <ellipse className="web-node redshifted" cx="63.0" cy="37.0" rx="0.40" ry="0.75" transform="rotate(45 63 37)" />
          <ellipse className="web-node redshifted" cx="68.0" cy="50.0" rx="0.40" ry="0.75" transform="rotate(90 68 50)" />
          <ellipse className="web-node redshifted" cx="63.0" cy="63.0" rx="0.40" ry="0.75" transform="rotate(135 63 63)" />
          <ellipse className="web-node redshifted" cx="50.0" cy="68.0" rx="0.40" ry="0.75" transform="rotate(180 50 68)" />
          <ellipse className="web-node redshifted" cx="37.0" cy="63.0" rx="0.40" ry="0.75" transform="rotate(225 37 63)" />
          <ellipse className="web-node redshifted" cx="32.0" cy="50.0" rx="0.40" ry="0.75" transform="rotate(270 32 50)" />
          <ellipse className="web-node redshifted" cx="37.0" cy="37.0" rx="0.40" ry="0.75" transform="rotate(315 37 37)" />
        </g>
      </g>
    </svg>
  );
}

export function VoidScene({ active, variant, tension, progress }: Props) {
  // Hard unmount when not active so animations/painting stop entirely
  // outside void mode. (No persistent runtime cost in normal play.)
  if (!active) return null;

  // Clamp inputs so a stray value never produces NaN in the CSS calcs.
  const t = Number.isFinite(tension) ? Math.max(0, Math.min(1, tension)) : 0;
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(2, progress)) : 0;

  // Portal target: <div id="void-root"> in index.html, a sibling of
  // #cosmos-root and #three-next inside #stage-root. Rendering here
  // (instead of inside #next-root) lets the scene sit BETWEEN the
  // cosmos background and the 3D dice canvas in the stage stacking
  // order — dice + UI both paint above the scene as designed.
  const host = typeof document !== 'undefined' ? document.getElementById('void-root') : null;
  if (!host) return null;

  const scene = (
    <div
      data-testid="void-scene"
      className="void-scene"
      data-variant={variant}
      aria-hidden="true"
      style={{
        // Inline-styled custom properties cascade to every descendant
        // layer so the formulas in VoidScene.css resolve against the
        // live signals instead of the static defaults.
        ['--tension' as unknown as string]: String(t),
        ['--progress' as unknown as string]: String(p),
      } as CSSProperties}
    >
      <div className="bg-void" aria-hidden="true" />
      <div className="bg-streaks" aria-hidden="true" />
      <div className="bg-stardust" aria-hidden="true" />
      <div className="void-shell back" aria-hidden="true" />
      <div className="void-shell mid" aria-hidden="true" />
      <div className="void-shell front" aria-hidden="true" />
      <LensedLatticeSvg />
      <div className="accretion-halo" aria-hidden="true" />
      <div className="accretion-disk" aria-hidden="true" />
      <div className="photon-orbits alt" aria-hidden="true" />
      <div className="photon-orbits" aria-hidden="true" />
      <div className="photon-ring" aria-hidden="true" />
      <div className="event-horizon" aria-hidden="true" />
      <div className="bg-tension-wash" aria-hidden="true" />
      <div className="bg-progress-underwash" aria-hidden="true" />
      <div className="bg-progress-halo" aria-hidden="true" />
    </div>
  );

  return createPortal(scene, host);
}
