// Performance Mode preference + frame-budget auto-degrade.
//
// One Settings preference governs the rendering quality tier. Three states:
//
//   'off'   — full quality (PBR, env map, normal DPR, 30fps nebula).
//   'auto'  — quality based on a low-end heuristic *plus* a live frame-budget
//             watcher. Starts at full quality; degrades when sustained jank
//             is detected; restores when perf recovers.  Default.
//   'on'    — force degraded quality (lower DPR, no AA, slower nebula).
//
// "Degraded" is a single boolean state the rest of the codebase reads:
//
//   - sharedRenderer.ts picks DPR cap + antialias at init time based on it.
//   - nebula.ts subscribes to changes and lowers/raises its frame cap live.
//   - Future: Dice3D particle counts / material tiers / mod-FX intensity.
//
// Renderer changes that require WebGL re-init (DPR, antialias) take effect
// on next page reload; live-tweakable surfaces (nebula framerate) update
// immediately.

import { getSnapshot } from '../../devtools/perf';

export type PerfMode = 'off' | 'auto' | 'on';

const KEY = 'ff_next_perfMode';
const VALID: PerfMode[] = ['off', 'auto', 'on'];

// Thresholds for the live auto-degrade gate in 'auto' mode.
const DEGRADE_FRAME_MS = 25; // ~40 fps; sustained jank
const RESTORE_FRAME_MS = 18; // ~55 fps; comfortable headroom
const WINDOW_MS = 4000;
const POLL_MS = 1000;

const listeners = new Set<() => void>();
let _budgetExceeded = false;
let _lastDegradeAt = 0;
let _lastRestoreAt = 0;
let _watcherTimer: number | null = null;

export function getPerfMode(): PerfMode {
  try {
    const v = localStorage.getItem(KEY);
    return VALID.includes(v as PerfMode) ? (v as PerfMode) : 'auto';
  } catch {
    return 'auto';
  }
}

export function setPerfMode(mode: PerfMode): void {
  try {
    if (mode === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  } catch { /* ignore */ }
  notify();
}

export function subscribePerfMode(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify(): void {
  for (const fn of listeners) {
    try { fn(); } catch (e) { console.warn('[perfMode] listener error:', e); }
  }
}

// Low-end device heuristic, formerly private to sharedRenderer. Exposed here
// so the same signal feeds both the renderer init and the perfMode default.
export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const lowCpu = (navigator.hardwareConcurrency ?? 8) <= 4;
  const coarse = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  return lowCpu && coarse;
}

/**
 * Resolves the current effective state. True when the renderer / nebula /
 * other consumers should run in their degraded path.
 */
export function isPerfDegraded(): boolean {
  const mode = getPerfMode();
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  // mode === 'auto'
  return isLowEndDevice() || _budgetExceeded;
}

/**
 * Live frame-budget watcher. Polls the perf sampler every POLL_MS; flips
 * `_budgetExceeded` when sustained jank is observed and back when perf
 * recovers. Listeners (e.g. nebula) get notified on every state change.
 *
 * Safe to call multiple times — the second call is a no-op.
 */
export function startFrameBudgetWatcher(): () => void {
  if (_watcherTimer != null) return stopFrameBudgetWatcher;
  if (typeof window === 'undefined') return () => undefined;

  _watcherTimer = window.setInterval(() => {
    // Skip evaluation when the tab is hidden — rAF throttling produces
    // wildly elevated frame times that aren't representative.
    if (typeof document !== 'undefined' && document.hidden) return;
    const snap = getSnapshot();
    if (snap.frameMs.count < 30) return; // not enough samples yet
    const p95 = snap.frameMs.p95;
    const now = performance.now();
    if (!_budgetExceeded && p95 > DEGRADE_FRAME_MS) {
      // Require the elevation to persist for at least WINDOW_MS.
      if (_lastDegradeAt === 0) _lastDegradeAt = now;
      else if (now - _lastDegradeAt >= WINDOW_MS) {
        _budgetExceeded = true;
        _lastDegradeAt = 0;
        if (getPerfMode() === 'auto') notify();
      }
    } else if (_budgetExceeded && p95 < RESTORE_FRAME_MS) {
      if (_lastRestoreAt === 0) _lastRestoreAt = now;
      else if (now - _lastRestoreAt >= WINDOW_MS) {
        _budgetExceeded = false;
        _lastRestoreAt = 0;
        if (getPerfMode() === 'auto') notify();
      }
    } else {
      // Reset the persistence timers when we're not crossing a threshold.
      _lastDegradeAt = 0;
      _lastRestoreAt = 0;
    }
  }, POLL_MS);
  return stopFrameBudgetWatcher;
}

export function stopFrameBudgetWatcher(): void {
  if (_watcherTimer != null) {
    window.clearInterval(_watcherTimer);
    _watcherTimer = null;
  }
}

/**
 * Mirror the `isPerfDegraded()` state onto `<body class="perf-degraded">`
 * so CSS rules can react without per-component prop drilling. The
 * cheapest hook for gating expensive GPU paths (backdrop-filter blur
 * radius, mix-blend-mode overlays, animated drop-shadows, infinite
 * decorative animations) lives in CSS, so a single body-class flip
 * lets the whole stylesheet downshift at once.
 *
 * Idempotent — returns a teardown that removes the listener + class.
 */
export function installPerfBodyClass(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const sync = () => {
    document.body.classList.toggle('perf-degraded', isPerfDegraded());
  };
  sync();
  const off = subscribePerfMode(sync);
  return () => {
    off();
    document.body.classList.remove('perf-degraded');
  };
}

// Test-only helpers.
export function _resetPerfMode(): void {
  _budgetExceeded = false;
  _lastDegradeAt = 0;
  _lastRestoreAt = 0;
  stopFrameBudgetWatcher();
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Test-only: simulate sustained jank crossing the auto-degrade threshold
// so unit tests can validate downstream effects (e.g. installPerfBodyClass
// adding the body class). Notifies subscribers like the real watcher does.
export function _setBudgetExceededForTest(v: boolean): void {
  _budgetExceeded = v;
  notify();
}
