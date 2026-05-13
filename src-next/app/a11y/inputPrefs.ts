// Motor-accessibility input preferences.
//
// Two settings, both stored in localStorage and broadcast via the same
// subscribe pattern the colorblind / motion / haptics prefs already use:
//
//   orientationOverride  — when true, the OrientationGate stops blocking
//                          phone-landscape play. Players who can only hold
//                          their device in a fixed orientation (mounted
//                          phones, voice-control rigs, certain accessibility
//                          cases) are no longer locked out.
//
//   longPressMs          — overrides the default 450ms hold required to pin
//                          a tooltip via long-press. Players with tremors,
//                          arthritis, or limited dexterity can shorten this.
//                          Three presets: 'standard' (450), 'quick' (200),
//                          'instant' (60).

export type LongPressPref = 'standard' | 'quick' | 'instant';

const ORIENTATION_KEY = 'ff_next_orientationOverride';
const LONG_PRESS_KEY = 'ff_next_longPressPref';

const LONG_PRESS_MS: Record<LongPressPref, number> = {
  standard: 450,
  quick: 200,
  instant: 60,
};

const VALID_LP: LongPressPref[] = ['standard', 'quick', 'instant'];

const orientationListeners = new Set<() => void>();
const longPressListeners = new Set<() => void>();

export function getOrientationOverride(): boolean {
  try {
    return localStorage.getItem(ORIENTATION_KEY) === '1';
  } catch {
    return false;
  }
}

export function setOrientationOverride(on: boolean): void {
  try {
    if (on) localStorage.setItem(ORIENTATION_KEY, '1');
    else localStorage.removeItem(ORIENTATION_KEY);
  } catch { /* ignore */ }
  for (const fn of orientationListeners) {
    try { fn(); } catch (e) { console.warn('[a11y] orientation listener:', e); }
  }
}

export function subscribeOrientationOverride(fn: () => void): () => void {
  orientationListeners.add(fn);
  return () => { orientationListeners.delete(fn); };
}

export function getLongPressPref(): LongPressPref {
  try {
    const v = localStorage.getItem(LONG_PRESS_KEY);
    return VALID_LP.includes(v as LongPressPref) ? (v as LongPressPref) : 'standard';
  } catch {
    return 'standard';
  }
}

export function setLongPressPref(pref: LongPressPref): void {
  try {
    if (pref === 'standard') localStorage.removeItem(LONG_PRESS_KEY);
    else localStorage.setItem(LONG_PRESS_KEY, pref);
  } catch { /* ignore */ }
  for (const fn of longPressListeners) {
    try { fn(); } catch (e) { console.warn('[a11y] long-press listener:', e); }
  }
}

export function subscribeLongPressPref(fn: () => void): () => void {
  longPressListeners.add(fn);
  return () => { longPressListeners.delete(fn); };
}

// Resolved hold duration for the long-press tooltip controller. Reads the
// stored pref; falls back to the standard 450ms.
export function getLongPressMs(): number {
  return LONG_PRESS_MS[getLongPressPref()];
}
