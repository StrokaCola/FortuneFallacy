// Tier 2 (responsive landscape HUD): the stage is no longer a fixed
// 1280×800 logical box scaled by CSS transform — it IS the viewport,
// minus safe-area insets. Layout flows with the actual window size.
//
// We keep STAGE_W/STAGE_H as nominal *design defaults* so callers that
// care about a default aspect or fall back to a known size still have
// something to import. Live size is read via getStageSize().
export const STAGE_W = 1280;
export const STAGE_H = 800;

export type StageResizeListener = (info: { scale: number; w: number; h: number }) => void;
export type Insets = { top: number; right: number; bottom: number; left: number };

// Pure ratio. Useful for callers that want to derive a uniform scale
// for a 1280×800 design at the current viewport (e.g. font-size
// breakpoints). Layout no longer applies this scale to the root.
export function computeScale(viewportW: number, viewportH: number): number {
  if (viewportW <= 0 || viewportH <= 0) return 1;
  return Math.min(viewportW / STAGE_W, viewportH / STAGE_H);
}

// Pass-through: client coords ARE stage coords now (the stage is the
// viewport). The rect parameter is kept for API stability; only `left`
// and `top` matter.
export function mapClientToStage(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  return { x: clientX - rect.left, y: clientY - rect.top };
}

let currentW = 0;
let currentH = 0;
const listeners = new Set<StageResizeListener>();
let installed = false;
let rafPending = false;
let safeProbe: HTMLDivElement | null = null;

function readSafeAreaInsets(): Insets {
  if (typeof document === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
  if (!safeProbe) {
    const d = document.createElement('div');
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = [
      'position:fixed', 'left:0', 'top:0', 'right:0', 'bottom:0',
      'padding-top:env(safe-area-inset-top, 0px)',
      'padding-right:env(safe-area-inset-right, 0px)',
      'padding-bottom:env(safe-area-inset-bottom, 0px)',
      'padding-left:env(safe-area-inset-left, 0px)',
      'visibility:hidden', 'pointer-events:none', 'z-index:-1',
    ].join(';');
    document.body.appendChild(d);
    safeProbe = d;
  }
  const cs = getComputedStyle(safeProbe);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}

export function getSafeAreaInsets(): Insets {
  return readSafeAreaInsets();
}

// Live viewport-minus-safe-area in CSS pixels. Layout, particle effects,
// and orthographic camera bounds should read from this.
export function getStageSize(): { w: number; h: number } {
  if (typeof window === 'undefined') return { w: STAGE_W, h: STAGE_H };
  const insets = readSafeAreaInsets();
  const w = Math.max(1, window.innerWidth - insets.left - insets.right);
  const h = Math.max(1, window.innerHeight - insets.top - insets.bottom);
  return { w, h };
}

function recompute(): void {
  if (typeof window === 'undefined') return;
  const { w, h } = getStageSize();
  // CSS vars updated each tick so HUD code that wants a global "I'm in
  // a small viewport" read can use them. --stage-scale is fixed at 1
  // for back-compat with any leftover transforms; use --stage-w/h for
  // sizing decisions.
  document.documentElement.style.setProperty('--stage-w', `${w}px`);
  document.documentElement.style.setProperty('--stage-h', `${h}px`);
  document.documentElement.style.setProperty('--stage-scale', '1');
  if (w === currentW && h === currentH) return;
  currentW = w;
  currentH = h;
  const info = { scale: 1, w, h };
  for (const l of listeners) {
    try { l(info); } catch (e) { console.warn('[stage] listener threw', e); }
  }
}

function scheduleRecompute(): void {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    recompute();
  });
}

export function installStage(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  recompute();
  window.addEventListener('resize', scheduleRecompute);
  window.addEventListener('orientationchange', scheduleRecompute);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => scheduleRecompute());
    ro.observe(document.documentElement);
  }
  if (typeof window.visualViewport !== 'undefined' && window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleRecompute);
  }
}

// Always 1 in tier 2 — the stage is the viewport, no inverse scaling.
// Kept as a function (rather than a constant) so callers don't need to
// change. Effects that currently divide by `stageScale()` simply become
// no-ops, which is the correct behavior for viewport-anchored coords.
export function stageScale(): number {
  return 1;
}

export function onStageResize(cb: StageResizeListener): () => void {
  listeners.add(cb);
  // Fire once with the current size so subscribers don't have to
  // separately query getStageSize() on mount.
  if (currentW > 0 && currentH > 0) {
    try { cb({ scale: 1, w: currentW, h: currentH }); } catch (e) { console.warn('[stage] listener threw', e); }
  }
  return () => { listeners.delete(cb); };
}

export function mapEventToStage(ev: { clientX: number; clientY: number }, el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return mapClientToStage(ev.clientX, ev.clientY, r);
}
