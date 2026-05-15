import { useEffect, useRef, useState } from 'react';

// useCounterTween — smoothly tween a displayed integer toward a new
// target value. Drop-in replacement for `{value}` renders where the
// raw state flips abruptly.
//
// Pattern:
//   const shardsDisplay = useCounterTween(state.run.shards, 320);
//   return <div>{shardsDisplay}</div>;
//
// Behavior:
//   - Initial mount returns the current target with no tween (so
//     navigating into a screen doesn't trigger a "tween up from 0").
//   - Each subsequent target change kicks off an ease-out-cubic ramp
//     from the LAST DISPLAYED value (not the previous target) to
//     the new target over `durationMs`. Changing target mid-tween
//     restarts cleanly from whatever the user is currently seeing.
//   - Reduce-motion: snaps to target immediately, no rAF.
//   - Rounds to integer each frame — shards, hands, rerolls etc.
//     are all integer-valued.
export function useCounterTween(target: number, durationMs = 320): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(display);
  displayRef.current = display;
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef(target);

  useEffect(() => {
    if (target === targetRef.current) return;
    targetRef.current = target;

    const reduced =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('reduce-motion');
    if (reduced) {
      setDisplay(target);
      return;
    }

    const from = displayRef.current;
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [target, durationMs]);

  // Cancel any in-flight rAF on unmount so a torn-down TopBar
  // doesn't keep ticking against a stale setDisplay.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return display;
}
