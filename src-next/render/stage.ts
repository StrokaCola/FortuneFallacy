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

function recompute(): void {
  if (typeof window === 'undefined') return;
  const next = computeScale(window.innerWidth, window.innerHeight);
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
