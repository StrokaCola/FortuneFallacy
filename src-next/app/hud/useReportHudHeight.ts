import { useEffect, type RefObject } from 'react';

// Reports the live size of a HUD bar (TopBar / ActionBar) into a CSS
// variable on `documentElement`, so other absolute-positioned overlays
// (CatalystStrip, ConsumableTray, ScoreBreakdown, …) and the dice canvas
// can reserve space below / above it without hard-coded pixel offsets.
//
// `mode = 'top'`     reports the bar's bottom edge (top + height) — used
//                    by the TopBar so children stack starting from
//                    `var(--hud-top-h)` and grow downward.
// `mode = 'bottom'`  reports the bar's distance from the viewport bottom
//                    (`viewportH - top`) so children pin upward from
//                    `var(--hud-bottom-h)`.
//
// Falls back to no-op if ResizeObserver is unavailable (e.g. jsdom in
// some test configs) — the seeded `0px` default in stage.ts keeps things
// rendering at full-viewport.
export function useReportHudHeight(
  ref: RefObject<HTMLElement>,
  varName: string,
  mode: 'top' | 'bottom' = 'top',
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === 'undefined') return;

    const root = document.documentElement.style;
    const write = () => {
      const r = el.getBoundingClientRect();
      if (mode === 'top') {
        // Bottom edge of the bar in viewport space — children stack from here.
        root.setProperty(varName, `${Math.round(r.bottom)}px`);
      } else {
        // Inset from viewport bottom — `bottom: var(--hud-bottom-h)` reserves
        // exactly the bar's footprint.
        root.setProperty(varName, `${Math.round(window.innerHeight - r.top)}px`);
      }
    };

    write();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(write);
      ro.observe(el);
    }
    // Window resize / orientation also shifts the bottom-mode value
    // (depends on innerHeight) and the top-mode value if the bar wraps.
    window.addEventListener('resize', write);
    window.addEventListener('orientationchange', write);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', write);
      window.removeEventListener('orientationchange', write);
      // Reset to 0 so screens without this bar (Hub, Title, …) get full-viewport.
      root.setProperty(varName, '0px');
    };
  }, [ref, varName, mode]);
}
