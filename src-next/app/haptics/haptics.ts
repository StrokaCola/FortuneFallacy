// Haptic feedback wrapper around navigator.vibrate.
//
// Three preference states:
//   'on'    — always buzz (when supported)
//   'off'   — never buzz
//   'os'    — buzz unless the player has Reduce Motion enabled (default)
//
// Persisted to localStorage and exposed via the same subscribe/get/set
// shape as useMotion, so Settings can drive both with one widget.
//
// Patterns are tiny and tactile — a long buzz feels like a notification,
// not a confirmation. Don't add patterns longer than ~120ms total without
// good reason.

const KEY = 'ff_haptics_pref';
export type HapticsPref = 'on' | 'off' | 'os';

export type HapticName = 'tap' | 'tick' | 'clear' | 'heartbeat';

const PATTERNS: Record<HapticName, number | number[]> = {
  // Lock toggle: a single short pulse so the player knows the tap landed
  // even when the visual lock indicator is small.
  tap: 10,
  // Chain step tick: extremely brief, designed to layer through a fast
  // chain without merging into one long buzz.
  tick: 5,
  // Blind cleared: doublet with a small gap, doesn't try to be a fanfare.
  clear: [40, 60, 40],
  // Death's-edge ambience (2026-05-18) — paired low-low double pulse
  // that reads as a heartbeat through a phone. Repeats while the
  // bridge keeps the player in near-bust; one full pattern ≈ 480ms
  // (~125 bpm equivalent on a single beat including the gap before
  // the next dispatch).
  heartbeat: [50, 80, 30],
};

const listeners = new Set<() => void>();

export function getHapticsPref(): HapticsPref {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === 'on' || raw === 'off') return raw;
  } catch { /* ignore */ }
  return 'os';
}

export function setHapticsPref(p: HapticsPref): void {
  try {
    if (p === 'os') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, p);
  } catch { /* ignore */ }
  for (const fn of listeners) {
    try { fn(); } catch { /* ignore */ }
  }
}

export function subscribeHapticsPref(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function isSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function reducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isHapticsActive(): boolean {
  if (!isSupported()) return false;
  const pref = getHapticsPref();
  if (pref === 'off') return false;
  if (pref === 'on') return true;
  // 'os': honour Reduce Motion — players who opt out of motion likely
  // don't want their phone to buzz on every tap either.
  return !reducedMotion();
}

export function playHaptic(name: HapticName): void {
  if (!isHapticsActive()) return;
  try {
    navigator.vibrate(PATTERNS[name]);
  } catch {
    // Some browsers (Safari iOS) reject vibrate without user gesture in
    // certain contexts. Swallow — haptics are non-critical.
  }
}

// Test-only: lets specs reset the listener set and stub navigator.vibrate.
export const __test__ = {
  PATTERNS,
  reset() {
    listeners.clear();
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  },
};
