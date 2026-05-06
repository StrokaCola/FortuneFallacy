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
    let lastValue = '';
    let rafHandle: number | null = null;
    const write = () => {
      const r = el.getBoundingClientRect();
      const next = mode === 'top'
        // Bottom edge of the bar in viewport space — children stack from here.
        ? `${Math.round(r.bottom)}px`
        // Inset from viewport bottom — `bottom: var(--hud-bottom-h)` reserves
        // exactly the bar's footprint.
        : `${Math.round(window.innerHeight - r.top)}px`;
      // Skip writes when the value is unchanged. Avoids spurious style
      // recalcs when ResizeObserver fires for sub-pixel rounding noise.
      if (next === lastValue) return;
      lastValue = next;
      root.setProperty(varName, next);
    };

    // Defer ResizeObserver work to the next animation frame so the
    // callback finishes within the same paint cycle, otherwise the
    // browser logs "ResizeObserver loop completed with undelivered
    // notifications". Coalesces bursts of resize events too.
    const scheduleWrite = () => {
      if (rafHandle != null) return;
      rafHandle = requestAnimationFrame(() => {
        rafHandle = null;
        write();
      });
    };

    write();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(scheduleWrite);
      ro.observe(el);
    }
    // Window resize / orientation also shifts the bottom-mode value
    // (depends on innerHeight) and the top-mode value if the bar wraps.
    window.addEventListener('resize', scheduleWrite);
    window.addEventListener('orientationchange', scheduleWrite);

    return () => {
      if (rafHandle != null) cancelAnimationFrame(rafHandle);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', scheduleWrite);
      window.removeEventListener('orientationchange', scheduleWrite);
      // Reset to 0 so screens without this bar (Hub, Title, …) get full-viewport.
      root.setProperty(varName, '0px');
    };
  }, [ref, varName, mode]);
}
