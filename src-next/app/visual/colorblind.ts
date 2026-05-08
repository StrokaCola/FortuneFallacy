// Colorblind preference — applies a class to <html> that swaps the
// rarity / archetype hue tokens to high-contrast safer alternates AND
// adds shape/icon redundancy. Default ('off') leaves the original
// palette untouched.
//
// We don't ship per-CVD-type presets (deuteranopia / protanopia /
// tritanopia individually) for v1 — a single high-contrast preset
// that's safe across all three is a cleaner accessibility bar to clear
// without requiring real-eye-test research per preset. The system is
// extensible: drop additional preset classes in styles/index.css and
// add ids to the union below.

const KEY = 'ff_next_colorblindPref';

export type ColorblindPref = 'off' | 'high_contrast';

const VALID: ColorblindPref[] = ['off', 'high_contrast'];

const listeners = new Set<() => void>();

export function getColorblindPref(): ColorblindPref {
  try {
    const v = localStorage.getItem(KEY);
    return VALID.includes(v as ColorblindPref) ? (v as ColorblindPref) : 'off';
  } catch {
    return 'off';
  }
}

export function setColorblindPref(p: ColorblindPref): void {
  try {
    if (p === 'off') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, p);
  } catch { /* ignore */ }
  applyColorblindClass();
  for (const fn of listeners) {
    try { fn(); } catch (e) { console.warn('[colorblind] listener error:', e); }
  }
}

export function subscribeColorblind(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// Apply / remove the body-level class. Idempotent — call on app boot
// and on every preference change.
export function applyColorblindClass(): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  for (const p of VALID) {
    if (p === 'off') continue;
    html.classList.remove(`cb-${p}`);
  }
  const cur = getColorblindPref();
  if (cur !== 'off') {
    html.classList.add(`cb-${cur}`);
  }
}
