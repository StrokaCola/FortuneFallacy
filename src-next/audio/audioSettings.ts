const MASTER_KEY = 'ff_next_masterVol';
const MUSIC_KEY  = 'ff_next_audioVol';
const SFX_KEY    = 'ff_next_sfxVol';
const CAPTIONS_KEY = 'ff_next_captionsOn';

const DEFAULT_MASTER = 0.7;
const DEFAULT_MUSIC  = 1.0;
const DEFAULT_SFX    = 1.0;

const listeners = new Set<() => void>();
const captionListeners = new Set<() => void>();

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function readKey(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? clamp(n) : fallback;
  } catch {
    return fallback;
  }
}

function writeKey(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch { /* ignore */ }
}

export function getMaster(): number { return readKey(MASTER_KEY, DEFAULT_MASTER); }
export function getMusic(): number  { return readKey(MUSIC_KEY,  DEFAULT_MUSIC);  }
export function getSfx(): number    { return readKey(SFX_KEY,    DEFAULT_SFX);    }

export function setMaster(v: number): void {
  writeKey(MASTER_KEY, clamp(v));
  notify();
}
export function setMusic(v: number): void {
  writeKey(MUSIC_KEY, clamp(v));
  notify();
}
export function setSfx(v: number): void {
  writeKey(SFX_KEY, clamp(v));
  notify();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// Sound captions — accessibility toggle for deaf/HoH players. When on,
// SoundCaptions.tsx renders a floating-text readout of every gameplay
// SFX-bearing event in the bottom-left of the stage. Off by default.
export function getCaptionsEnabled(): boolean {
  try {
    return localStorage.getItem(CAPTIONS_KEY) === '1';
  } catch {
    return false;
  }
}

export function setCaptionsEnabled(v: boolean): void {
  try {
    if (v) localStorage.setItem(CAPTIONS_KEY, '1');
    else localStorage.removeItem(CAPTIONS_KEY);
  } catch { /* ignore */ }
  for (const fn of captionListeners) {
    try { fn(); } catch (e) { console.warn('[audioSettings] caption listener error:', e); }
  }
}

export function subscribeCaptions(fn: () => void): () => void {
  captionListeners.add(fn);
  return () => { captionListeners.delete(fn); };
}

function notify(): void {
  for (const fn of listeners) {
    try { fn(); } catch (e) { console.warn('[audioSettings] listener error:', e); }
  }
}
