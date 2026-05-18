// HorizonBackdrop — replaces the procedural ScreenSilhouette with the
// painted Cosmos Horizon Backdrop from the 2026-05-17 → 2026-05-18
// Claude Design handoffs (see public/brand/cosmos-horizon-backdrop.html
// for the source brief, public/brand/horizon-backdrop.js for the
// painter, and public/brand/cosmos-horizon-embed.html for the slim
// runtime wrapper this component points at).
//
// 2026-05-18 revision moved the painter toward "cosmos-first":
//   - Horizon dropped from 38% → 18% of canvas height (more sky)
//   - Architecture shrunk ~50% from original; each centerpiece picks
//     up a glowing aura + orbital sparkles in its accent color
//   - Hub replaced mountains with a proper observatory dome +
//     telescope barrel through a shutter slot
//   - Forge bellows + hammer rack fade out at narrow widths so the
//     anvil owns center stage
//   - Canvas is now responsive via ResizeObserver inside the painter
//
// Strategy: the painter is 2000+ lines of canvas drawing logic with
// its own RAF loop, dev-panel UI, and hardcoded DOM-id lookups. We
// don't refactor it — instead we render an iframe that loads the
// slim embed page (which fetches the painter, regex-patches the
// scene+seed into the TWEAKS const before eval, and runs it). The
// iframe sandbox owns its own canvas + animation loop, so the main
// React tree pays only the iframe overhead.

import { useMemo } from 'react';

// Map game screen id → painter scene id.
const SCREEN_TO_SCENE: Record<string, string> = {
  hub: 'hub',
  shop: 'shop',
  forge: 'forge',
  astral_forge: 'astralForge',
};

type Props = {
  screen: string;
  /** Optional seed override (default: 137 — the painter's design-locked value). */
  seed?: number;
};

export function HorizonBackdrop({ screen, seed = 137 }: Props) {
  const scene = SCREEN_TO_SCENE[screen];
  const src = useMemo(() => {
    if (!scene) return null;
    const base = typeof document !== 'undefined' ? document.baseURI : '/FortuneFallacy/';
    return `${new URL('brand/cosmos-horizon-embed.html', base).href}?scene=${scene}&seed=${seed}`;
  }, [scene, seed]);

  if (!src) return null;
  return (
    <iframe
      key={src}
      src={src}
      title={`Cosmos Horizon Backdrop — ${scene}`}
      aria-hidden="true"
      style={{
        // Cover the full viewport so the painter's cosmos sky bleeds
        // edge-to-edge. The revised painter shifts the architecture
        // to the bottom 18% of the canvas; the upper 82% is cosmos
        // gradient + nebula + starfield that should fill the screen
        // behind game UI, not just hug the bottom 38%.
        //
        // `position: fixed` (not absolute) — the App.tsx parent
        // `.relative.w-full.h-full.overflow-hidden` collapses to ~6px
        // in some screens because its only intrinsic-width children
        // are themselves position:fixed/absolute. Anchoring to the
        // viewport instead of the collapsed parent guarantees the
        // iframe gets real dimensions for ResizeObserver to read.
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        border: 0,
        pointerEvents: 'none',
        // z:0 — must sit BELOW the screen-content wrapper that follows in
        // App.tsx (`<div className="absolute inset-0 pointer-events-none">`,
        // which has z:auto). Earlier z:1 made the iframe paint OVER the UI
        // because positive-z positioned children win over z:auto inside the
        // same stacking context. z:0 ties with z:auto and document order
        // (iframe rendered first in JSX) keeps it underneath.
        zIndex: 0,
        background: 'transparent',
        willChange: 'auto',
      }}
    />
  );
}
