import { useEffect } from 'react';

// Tri-state motion preference. 'os' defers to the OS (default); 'reduce' and
// 'allow' override OS. Persisted to localStorage so the choice survives reloads.
const KEY = 'ff_motion_pref';
export type MotionPref = 'os' | 'reduce' | 'allow';

const listeners = new Set<() => void>();

export function getMotionPref(): MotionPref {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === 'reduce' || raw === 'allow') return raw;
  } catch { /* ignore */ }
  return 'os';
}

export function setMotionPref(p: MotionPref): void {
  try {
    if (p === 'os') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, p);
  } catch { /* ignore */ }
  applyMotion();
  for (const fn of listeners) {
    try { fn(); } catch { /* ignore */ }
  }
}

export function subscribeMotionPref(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function applyMotion(): void {
  if (typeof document === 'undefined') return;
  const pref = getMotionPref();
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = pref === 'reduce' || (pref === 'os' && mq.matches);
  document.documentElement.classList.toggle('reduce-motion', reduced);
  // 'allow-motion' suppresses the @media (prefers-reduced-motion) fallback in
  // styles/index.css when the user has explicitly opted into motion.
  document.documentElement.classList.toggle('allow-motion', pref === 'allow');
}

export function useMotion(): void {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    applyMotion();
    mq.addEventListener('change', applyMotion);
    return () => {
      mq.removeEventListener('change', applyMotion);
    };
  }, []);
}
