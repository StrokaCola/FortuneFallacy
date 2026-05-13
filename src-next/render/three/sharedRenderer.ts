// src-next/render/three/sharedRenderer.ts
import * as THREE from 'three';
import { tick as perfTick } from '../../devtools/perf';
import { isPerfDegraded } from '../../app/perf/perfMode';

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

// Heuristic moved to `app/perf/perfMode.ts` so the renderer init and the
// user-facing Performance Mode preference share one signal. See
// `isLowEndDevice` / `isPerfDegraded` from that module.

function ensureRenderer(): THREE.WebGLRenderer {
  if (_renderer) return _renderer;
  _canvas = document.createElement('canvas');
  // Sits at the "dice plane" inside #stage-root (same z as #three-next) so
  // #next-root (z=2) and all React overlays — PauseMenu, Run Info, Settings,
  // shop screens — paint over it. Previously z=80 on document.body, which
  // made any rendered DieView (e.g. Forge thumbnails) punch through modals.
  // The host fallback to document.body keeps unit-test envs (no #stage-root)
  // working.
  //
  // IMPORTANT: we size the canvas in CSS pixels from window.inner{Width,Height}
  // rather than `width:100vw;height:100vh`. On mobile, `100vh` measures the
  // *largest* viewport (URL bar collapsed), so when the bar is visible the
  // canvas DOM is taller than the WebGL render area (window.innerHeight),
  // and the WebGL output gets stretched downward — dice render below where
  // their placeholder divs actually are. Pixel-matching the CSS to the WebGL
  // backing store eliminates that stretch.
  _canvas.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:1;';
  _canvas.style.width = window.innerWidth + 'px';
  _canvas.style.height = window.innerHeight + 'px';
  _canvas.setAttribute('data-shared-renderer', '1');
  const host = document.getElementById('stage-root') ?? document.body;
  host.appendChild(_canvas);
  // Renderer init reads `isPerfDegraded()` at boot. Includes both the
  // low-end heuristic (was the only signal) and the user-facing Performance
  // Mode preference. Mode flips after init require a page reload to apply
  // to DPR / antialias; live-tweakable surfaces (nebula framerate) update
  // immediately via subscribePerfMode().
  const degraded = isPerfDegraded();
  _renderer = new THREE.WebGLRenderer({ canvas: _canvas, alpha: true, antialias: !degraded });
  // DPR cap: 2 normally, 1.5 when degraded. Halves fragment-shader work on
  // high-DPR phones with weak GPUs.
  const dprCap = degraded ? 1.5 : 2;
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap));
  _renderer.setSize(window.innerWidth, window.innerHeight, false);
  _renderer.setScissorTest(true);
  // Layout-affecting events invalidate every cached rect. The loop refreshes
  // them lazily on the next frame so we don't pay for offscreen views.
  const invalidate = () => { _rectStale = true; };
  _onResize = () => {
    if (_renderer) _renderer.setSize(window.innerWidth, window.innerHeight, false);
    // Keep canvas CSS pixel-matched to the WebGL backing store on resize
    // (URL-bar show/hide on mobile fires resize) — otherwise the dice
    // start drifting again the moment the address bar appears.
    if (_canvas) {
      _canvas.style.width = window.innerWidth + 'px';
      _canvas.style.height = window.innerHeight + 'px';
    }
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
  // Skip GPU work when the tab is hidden. Browsers throttle rAF for
  // background tabs but an explicit guard removes any residual render
  // cost while keeping the loop alive to resume on visibility.
  if (typeof document !== 'undefined' && document.hidden) {
    _rafHandle = requestAnimationFrame(loop);
    return;
  }
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
