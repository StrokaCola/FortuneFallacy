// Headless bootstrap. Installs a seeded Math.random override + a synchronous
// dice-roll bridge, then resets the Zustand store. After this returns, the
// caller can `dispatch(NEW_RUN)` and drive a full game.
//
// We never edit src-next files; everything wires in from the consumer side.

import { bus } from '../../src-next/events/bus';
import { dispatch } from '../../src-next/actions/dispatch';
import { store, resetStore, setStateRaw } from '../../src-next/state/store';
import { mulberry32 } from '../../src-next/core/rng';
import type { SimulationRequest, SimulationResult } from '../../src-next/events/types';

const REAL_MATH_RANDOM = Math.random;

let rngState = 0;
let rngInstalled = false;

function step(): number {
  rngState = (rngState + 0x6D2B79F5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function installSeededRandom(seed: number): void {
  rngState = seed >>> 0;
  if (!rngInstalled) {
    Math.random = step;
    (Math.random as typeof Math.random & { __snapshot: () => number; __restore: (s: number) => void }).__snapshot = () => rngState;
    (Math.random as typeof Math.random & { __snapshot: () => number; __restore: (s: number) => void }).__restore = (s: number) => { rngState = s >>> 0; };
    rngInstalled = true;
  }
}

export function uninstallSeededRandom(): void {
  Math.random = REAL_MATH_RANDOM;
  rngInstalled = false;
}

export function snapshotRng(): number {
  return rngState;
}

export function restoreRng(s: number): void {
  rngState = s >>> 0;
}

let bridgeUnsubscribe: (() => void) | null = null;

// Synchronous sim bridge. The original startSimRunner uses
// Rapier-then-fallback inside a Promise; we short-circuit by reading
// req.predeterminedFaces (already produced by the seeded pipeline) and
// dispatching ROLL_SETTLED in the same microtask.
export function installSimBridge(): void {
  if (bridgeUnsubscribe) return;
  bridgeUnsubscribe = bus.on('onSimulationStart', ({ request }) => {
    const result = synthesize(request);
    dispatch({ type: 'ROLL_SETTLED', result });
  });
}

export function uninstallSimBridge(): void {
  bridgeUnsubscribe?.();
  bridgeUnsubscribe = null;
}

function synthesize(req: SimulationRequest): SimulationResult {
  const state = store.getState();
  const prevFaces = state.round.dice.map((d) => d.face);
  const lockedMask = state.round.dice.map((d) => d.locked);
  const targets = req.predeterminedFaces ?? [];
  const finalFaces: number[] = [];
  const diceCount = Math.max(prevFaces.length, targets.length);
  for (let i = 0; i < diceCount; i++) {
    if (lockedMask[i]) {
      finalFaces.push(prevFaces[i] ?? targets[i] ?? 1);
    } else if (targets[i] != null) {
      finalFaces.push(targets[i]!);
    } else {
      finalFaces.push(prevFaces[i] ?? 1);
    }
  }
  return {
    finalFaces,
    restPositions: finalFaces.map(() => ({ x: 0, y: 0, z: 0 })),
    settleMs: finalFaces.map(() => 0),
    peakVelocity: 0,
    collisionCount: 0,
    bounceHeights: finalFaces.map(() => 0),
  };
}

// One-shot bootstrap. Caller passes a seed; we install RNG, install bridge,
// reset the store. After this, dispatching NEW_RUN starts a clean run.
export function bootstrapHeadless(seed: number): void {
  installSeededRandom(seed);
  installSimBridge();
  resetStore();
  // Override the Math.random-derived run.seed so the gameplay pipeline RNG
  // is also tied to our master seed.
  setStateRaw((s) => ({ ...s, run: { ...s.run, seed } }));
}

export { dispatch } from '../../src-next/actions/dispatch';
export { store, setStateRaw } from '../../src-next/state/store';
