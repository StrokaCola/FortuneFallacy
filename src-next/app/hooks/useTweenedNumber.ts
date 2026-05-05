import { useEffect, useRef, useState } from 'react';

const DEFAULT_MS = 360;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function reducedMotion(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('reduce-motion');
}

// Tweens `target` toward its new value over `durationMs` (easeOutCubic).
// Snaps instantly when the user has reduced motion enabled. The first render
// returns `target` directly so the initial value never animates from 0.
export function useTweenedNumber(target: number, durationMs = DEFAULT_MS): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const toRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === toRef.current) return;
    if (reducedMotion()) {
      fromRef.current = target;
      toRef.current = target;
      setDisplay(target);
      return;
    }
    fromRef.current = display;
    toRef.current = target;
    startRef.current = performance.now();
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      const v = fromRef.current + (toRef.current - fromRef.current) * easeOutCubic(t);
      setDisplay(t >= 1 ? toRef.current : v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // We intentionally don't depend on `display` — we read it once at the
    // start of a tween as the from-value, then own the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return display;
}
