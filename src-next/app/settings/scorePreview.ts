// Score-preview setting (2026-05-18 P1). Mirrors the ambient-reactions
// setting shape — localStorage-persisted, subscribe/get/set API. The
// TopBar chip respects this flag so purists who prefer the surprise of
// the live commit can hide the projection entirely.
//
// Default: on. Pre-launch QoL — most players want decision clarity.

const KEY = 'ff_next_scorePreview';
type Pref = 'on' | 'off';
const DEFAULT: Pref = 'on';
const listeners = new Set<() => void>();

export function getScorePreviewPref(): Pref {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === 'on' || raw === 'off') return raw;
  } catch { /* ignore */ }
  return DEFAULT;
}

export function setScorePreviewPref(v: Pref): void {
  try {
    if (v === DEFAULT) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, v);
  } catch { /* ignore */ }
  for (const fn of listeners) {
    try { fn(); } catch { /* ignore */ }
  }
}

export function subscribeScorePreviewPref(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
