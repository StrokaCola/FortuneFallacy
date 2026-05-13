// Lazy bundle for the round-time stack: Three.js scene + Rapier physics
// simulator + everything they pull in. None of these are needed on the
// title / hub / codex / settings screens, so they're behind a dynamic
// `import()` that Vite splits into separate chunks.
//
// Boot flow:
//
//   1. `main.tsx` calls `ensureRoundBundle()` once, non-blocking. The
//      shell + initial screen render immediately while the chunk fetch
//      streams in the background.
//   2. When the chunks resolve, `Dice3D` is instantiated against the
//      `#three-next` canvas and `startSimRunner()` registers its bus
//      listeners. The internal `_ready` flag flips and subscribers
//      (e.g., the Roll button) re-render.
//   3. If the player reaches the Round screen before readiness, the
//      Roll button is disabled with a "Warming up..." label. In
//      practice on any reasonable connection the bundle resolves long
//      before the player crosses NameEntry / ConstellationSelect.
//
// Multiple callers are safe: `ensureRoundBundle()` memoizes the
// in-flight promise.

import { useEffect, useState } from 'react';

let _ready = false;
let _promise: Promise<void> | null = null;
const _listeners = new Set<() => void>();

export function isRoundBundleReady(): boolean {
  return _ready;
}

export function subscribeRoundBundle(fn: () => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

function notify(): void {
  for (const fn of _listeners) {
    try { fn(); } catch (e) { console.warn('[roundBundle] listener error:', e); }
  }
}

/**
 * Kicks off (or returns the in-flight) dynamic import of the round-time
 * stack. Non-blocking; safe to call multiple times. The returned promise
 * resolves once Dice3D + the sim runner are live.
 */
export function ensureRoundBundle(): Promise<void> {
  if (_promise) return _promise;
  _promise = (async () => {
    // Parallel dynamic imports - both chunks fetch concurrently.
    const [dice3dMod, simMod] = await Promise.all([
      import('../../render/three/Dice3D'),
      import('../../simulation/runSimulation'),
    ]);

    const threeCanvas = document.getElementById('three-next');
    if (threeCanvas instanceof HTMLCanvasElement) {
      try {
        const d3 = new dice3dMod.Dice3D(threeCanvas);
        (window as unknown as { __dice3d: dice3dMod.Dice3D }).__dice3d = d3;
      } catch (e) {
        console.error('[Dice3D] init failed:', e);
      }
    }
    simMod.startSimRunner();

    _ready = true;
    notify();
  })();
  return _promise;
}

/** React hook for components that gate behavior on bundle readiness. */
export function useRoundBundleReady(): boolean {
  const [r, setR] = useState(isRoundBundleReady);
  useEffect(() => {
    if (isRoundBundleReady()) {
      setR(true);
      return;
    }
    return subscribeRoundBundle(() => setR(isRoundBundleReady()));
  }, []);
  return r;
}

// Test-only helpers.
export function _resetRoundBundle(): void {
  _ready = false;
  _promise = null;
}
