import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { useStore } from '../../state/store';
import { selectScore } from '../../state/selectors';

// Tween duration when the running total updates. Long enough that the
// digits visibly roll, short enough that consecutive die-ticks (≥350ms
// apart at the fastest tier) don't queue up — each new target restarts
// the tween from the current mid-tween value, so the counter just
// chases the latest beat smoothly.
const TWEEN_MS = 280;

function easeOutQuart(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u * u;
}

// Returns a smoothly-animated score value that chases `runningTotal`
// beats during scoring and rests on `selectScore` between hands. Was a
// hard snap on every beat, which felt clunky — the eye sees the digits
// teleport instead of climbing. Now uses a rAF tween with easeOutQuart
// so each beat lands as a satisfying "roll up" rather than a jump.
export function useScoreDisplay(): number {
  const baseScore = useStore(selectScore);
  const [shown, setShown] = useState<number>(baseScore);

  // Refs avoid re-firing the rAF effect on every shown-state update.
  const shownRef = useRef(baseScore);
  shownRef.current = shown;
  const targetRef = useRef(baseScore);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Update target & restart tween whenever baseScore changes (between
    // hands). Without scoring activity this also serves as the "rest" path.
    targetRef.current = baseScore;
    startTween();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseScore]);

  function startTween(): void {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const from = shownRef.current;
    const to = targetRef.current;
    if (from === to) return;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / TWEEN_MS);
      const eased = easeOutQuart(t);
      const v = from + (to - from) * eased;
      shownRef.current = v;
      setShown(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    const offBeat = bus.on('onScoreBeat', ({ beat }) => {
      if ('runningTotal' in beat) {
        targetRef.current = baseScore + beat.runningTotal;
        startTween();
      } else if (beat.kind === 'cast-swell') {
        // Sequence start — snap immediately to baseScore so the first
        // die-tick tween starts from a known floor, not from a stale
        // mid-tween value left over from the previous hand.
        targetRef.current = baseScore;
        shownRef.current = baseScore;
        setShown(baseScore);
      } else if (beat.kind === 'boom') {
        targetRef.current = beat.finalTotal + baseScore;
        startTween();
      }
    });
    return () => {
      offBeat();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [baseScore]);

  // Round to integer — sub-pixel digits would just shimmer.
  return Math.round(shown);
}
