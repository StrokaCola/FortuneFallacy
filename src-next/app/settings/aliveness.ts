// Aliveness settings (2026-05-18). Single user-facing toggle that
// gates the ambient reactions layer (death's-edge tension, storm
// telegraph, heartbeat haptic, vignette darkening). Discovery
// features (first-encounter reveal, DiscoveryFeed) are always on
// — they're informational, not motion-heavy.
//
// Three levels:
//   'on'     — full ambience (default)
//   'subtle' — half-intensity; smaller vignette, softer audio
//              ducking, no heartbeat haptic
//   'off'    — disable the listener entirely
//
// Persisted to localStorage so the choice survives reloads.
// Mirrors the audioSettings.ts subscribe/get/set shape so the
// settings UI can drive it the same way as volumes/captions.

const KEY = 'ff_next_ambientReactions';

export type AmbientReactionsLevel = 'on' | 'subtle' | 'off';
const DEFAULT: AmbientReactionsLevel = 'on';

const listeners = new Set<() => void>();

export function getAmbientReactions(): AmbientReactionsLevel {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === 'on' || raw === 'subtle' || raw === 'off') return raw;
  } catch { /* ignore */ }
  return DEFAULT;
}

export function setAmbientReactions(v: AmbientReactionsLevel): void {
  try {
    if (v === DEFAULT) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, v);
  } catch { /* ignore */ }
  for (const fn of listeners) {
    try { fn(); } catch { /* ignore */ }
  }
}

export function subscribeAmbientReactions(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// Convenience: returns the effective intensity multiplier for the
// current setting. Listeners scale their output by this so 'subtle'
// is a half-strength version of 'on' without per-feature branches.
export function ambientIntensityScalar(): number {
  switch (getAmbientReactions()) {
    case 'on': return 1;
    case 'subtle': return 0.5;
    case 'off': return 0;
  }
}
