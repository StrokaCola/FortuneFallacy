// src-next/render/three/sharedRenderer.ts
import * as THREE from 'three';
import { tick as perfTick } from '../../devtools/perf';

type ViewSpec = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  getRect: () => DOMRect;
};

type ViewEntry = {
  spec: ViewSpec;
  // Cached rect so the loop doesn't call getBoundingClientRect every frame.
  // Refreshed by a small invalidation set: window resize/orient, scroll,
  // visibility change, and an explicit per-view ResizeObserver if the spec
  // attaches one. Stale-rect risk is bounded — `_rectStale` flag forces a
  // refresh once per layout-affecting event.
  rect: DOMRect | null;
};

let _renderer: THREE.WebGLRenderer | null = null;
let _canvas: HTMLCanvasElement | null = null;
let _views: ViewEntry[] = [];
let _rafHandle: number | null = null;
let _onResize: (() => void) | null = null;
let _onScroll: (() => void) | null = null;
let _onVis: (() => void) | null = null;
let _rectStale = true;

// Heuristic: lower-end mobiles benefit from disabling MSAA and capping pixel
// ratio more aggressively. We detect via hardware concurrency + coarse
// pointer (matches phone/tablet without exposing UA sniffing). Desktop with a
// touch screen still gets the high-fidelity path.
function isLowEndMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const lowCpu = (navigator.hardwareConcurrency ?? 8) <= 4;
  const coarse = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  return lowCpu && coarse;
}

function ensureRenderer(): THREE.WebGLRenderer {
  if (_renderer) return _renderer;
  _canvas = document.createElement('canvas');
  // Sits at the "dice plane" inside #stage-root (same z as #three-next) so
  // #next-root (z=2) and all React overlays — PauseMenu, Run Info, Settings,
  // shop screens — paint over it. Previously z=80 on document.body, which
  // made any rendered DieView (e.g. Forge thumbnails) punch through modals.
  // The host fallback to document.body keeps unit-test envs (no #stage-root)
  // working.
  _canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;width:100vw;height:100vh;';
  _canvas.setAttribute('data-shared-renderer', '1');
  const host = document.getElementById('stage-root') ?? document.body;
  host.appendChild(_canvas);
  const lowEnd = isLowEndMobile();
  _renderer = new THREE.WebGLRenderer({ canvas: _canvas, alpha: true, antialias: !lowEnd });
  // DPR cap: 2 on desktop / capable mobile, 1.5 on low-end mobile. Halves
  // fragment-shader work on high-DPR phones with weak GPUs.
  const dprCap = lowEnd ? 1.5 : 2;
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
  _renderer.setSize(window.innerWidth, window.innerHeight, false);
  _renderer.setScissorTest(true);
  // Layout-affecting events invalidate every cached rect. The loop refreshes
  // them lazily on the next frame so we don't pay for offscreen views.
  const invalidate = () => { _rectStale = true; };
  _onResize = () => {
    if (_renderer) _renderer.setSize(window.innerWidth, window.innerHeight, false);
    invalidate();
  };
  _onScroll = invalidate;
  _onVis = invalidate;
  window.addEventListener('resize', _onResize);
  window.addEventListener('scroll', _onScroll, { passive: true, capture: true });
  document.addEventListener('visibilitychange', _onVis);
  return _renderer;
}

function loop(): void {
  perfTick();
  if (_views.length === 0 || !_renderer) {
    // Clear stale pixels left behind by the last view (otherwise they
    // appear to "stick" on the screen after navigating away).
    if (_renderer && typeof _renderer.clear === 'function') {
      _renderer.setScissorTest(false);
      _renderer.clear();
      _renderer.setScissorTest(true);
    }
    _rafHandle = null;
    return;
  }
  const H = window.innerHeight;
  if (_rectStale) {
    for (const v of _views) v.rect = v.spec.getRect();
    _rectStale = false;
  }
  for (const v of _views) {
    const r = v.rect ?? v.spec.getRect();
    if (r.width <= 0 || r.height <= 0) continue;
    // viewport y is measured from bottom of canvas
    const y = H - r.bottom;
    _renderer.setScissor(r.left, y, r.width, r.height);
    _renderer.setViewport(r.left, y, r.width, r.height);
    _renderer.render(v.spec.scene, v.spec.camera);
  }
  _rafHandle = requestAnimationFrame(loop);
}

export function registerView(spec: ViewSpec): () => void {
  ensureRenderer();
  const entry: ViewEntry = { spec, rect: null };
  _views.push(entry);
  _rectStale = true;
  if (_rafHandle == null) _rafHandle = requestAnimationFrame(loop);
  return () => {
    const i = _views.indexOf(entry);
    if (i >= 0) _views.splice(i, 1);
  };
}

/** Invalidate cached rects. Call after any layout change a view knows about
 * (e.g. its container resized due to a flex layout shift). */
export function invalidateRects(): void {
  _rectStale = true;
}

// Test-only helpers.
export function _viewCount(): number { return _views.length; }
export function _resetSharedRenderer(): void {
  if (_rafHandle != null) cancelAnimationFrame(_rafHandle);
  _rafHandle = null;
  _views = [];
  if (_onResize) window.removeEventListener('resize', _onResize);
  if (_onScroll) window.removeEventListener('scroll', _onScroll, { capture: true } as EventListenerOptions);
  if (_onVis) document.removeEventListener('visibilitychange', _onVis);
  _onResize = null;
  _onScroll = null;
  _onVis = null;
  _rectStale = true;
  if (_canvas?.parentNode) _canvas.parentNode.removeChild(_canvas);
  _canvas = null;
  if (_renderer) _renderer.dispose();
  _renderer = null;
}
