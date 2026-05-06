export const STAGE_W = 1280;
export const STAGE_H = 800;

export type StageResizeListener = (info: { scale: number; w: number; h: number }) => void;

export function computeScale(viewportW: number, viewportH: number): number {
  if (viewportW <= 0 || viewportH <= 0) return 1;
  return Math.min(viewportW / STAGE_W, viewportH / STAGE_H);
}

export function mapClientToStage(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  const sx = rect.width === 0 ? 1 : STAGE_W / rect.width;
  const sy = rect.height === 0 ? 1 : STAGE_H / rect.height;
  return {
    x: (clientX - rect.left) * sx,
    y: (clientY - rect.top) * sy,
  };
}

let currentScale = 1;
const listeners = new Set<StageResizeListener>();
let installed = false;
let rafPending = false;
let safeProbe: HTMLDivElement | null = null;

type Insets = { top: number; right: number; bottom: number; left: number };

function readSafeAreaInsets(): Insets {
  if (typeof document === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
  if (!safeProbe) {
    const d = document.createElement('div');
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = [
      'position:fixed', 'left:0', 'top:0', 'right:0', 'bottom:0',
      // env() resolves to the viewport-relative safe-area inset on
      // browsers that support it; on browsers that don't, the fallback
      // 0px keeps everything working as before.
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

function recompute(): void {
  if (typeof window === 'undefined') return;
  const insets = readSafeAreaInsets();
  const safeW = Math.max(1, window.innerWidth - insets.left - insets.right);
  const safeH = Math.max(1, window.innerHeight - insets.top - insets.bottom);
  const next = computeScale(safeW, safeH);
  // The stage centres on the viewport with translate(-50%, -50%). When the
  // safe area is asymmetric (e.g. iPhone landscape with the notch on the
  // left), shift the stage so it stays centred inside the safe area.
  const shiftX = (insets.left - insets.right) / 2;
  const shiftY = (insets.top - insets.bottom) / 2;
  document.documentElement.style.setProperty('--inset-shift-x', `${shiftX}px`);
  document.documentElement.style.setProperty('--inset-shift-y', `${shiftY}px`);
  if (next === currentScale) return;
  currentScale = next;
  document.documentElement.style.setProperty('--stage-scale', String(next));
  const info = { scale: next, w: STAGE_W * next, h: STAGE_H * next };
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

export function stageScale(): number {
  return currentScale;
}

export function onStageResize(cb: StageResizeListener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function mapEventToStage(ev: { clientX: number; clientY: number }, el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return mapClientToStage(ev.clientX, ev.clientY, r);
}
