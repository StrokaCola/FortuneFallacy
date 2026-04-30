// src-next/render/three/sharedRenderer.ts
import * as THREE from 'three';

type ViewSpec = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  getRect: () => DOMRect;
};

let _renderer: THREE.WebGLRenderer | null = null;
let _canvas: HTMLCanvasElement | null = null;
let _views: ViewSpec[] = [];
let _rafHandle: number | null = null;
let _onResize: (() => void) | null = null;

function ensureRenderer(): THREE.WebGLRenderer {
  if (_renderer) return _renderer;
  _canvas = document.createElement('canvas');
  _canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:80;width:100vw;height:100vh;';
  _canvas.setAttribute('data-shared-renderer', '1');
  document.body.appendChild(_canvas);
  _renderer = new THREE.WebGLRenderer({ canvas: _canvas, alpha: true, antialias: true });
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _renderer.setSize(window.innerWidth, window.innerHeight, false);
  _renderer.setScissorTest(true);
  // Keep drawing buffer in sync with viewport on resize/rotate.
  _onResize = () => {
    if (_renderer) _renderer.setSize(window.innerWidth, window.innerHeight, false);
  };
  window.addEventListener('resize', _onResize);
  return _renderer;
}

function loop(): void {
  if (_views.length === 0 || !_renderer) {
    // Clear stale pixels left behind by the last view (otherwise they
    // appear to "stick" on the screen after navigating away).
    if (_renderer) {
      _renderer.setScissorTest(false);
      _renderer.clear();
      _renderer.setScissorTest(true);
    }
    _rafHandle = null;
    return;
  }
  const H = window.innerHeight;
  for (const v of _views) {
    // getBoundingClientRect runs per-frame per-view. Acceptable at <12 dice;
    // if a future phase pushes counts higher, cache via ResizeObserver.
    const r = v.getRect();
    if (r.width <= 0 || r.height <= 0) continue;
    // viewport y is measured from bottom of canvas
    const y = H - r.bottom;
    _renderer.setScissor(r.left, y, r.width, r.height);
    _renderer.setViewport(r.left, y, r.width, r.height);
    _renderer.render(v.scene, v.camera);
  }
  _rafHandle = requestAnimationFrame(loop);
}

export function registerView(spec: ViewSpec): () => void {
  ensureRenderer();
  _views.push(spec);
  if (_rafHandle == null) _rafHandle = requestAnimationFrame(loop);
  return () => {
    const i = _views.indexOf(spec);
    if (i >= 0) _views.splice(i, 1);
  };
}

// Test-only helpers.
export function _viewCount(): number { return _views.length; }
export function _resetSharedRenderer(): void {
  if (_rafHandle != null) cancelAnimationFrame(_rafHandle);
  _rafHandle = null;
  _views = [];
  if (_onResize) window.removeEventListener('resize', _onResize);
  _onResize = null;
  if (_canvas?.parentNode) _canvas.parentNode.removeChild(_canvas);
  _canvas = null;
  if (_renderer) _renderer.dispose();
  _renderer = null;
}
