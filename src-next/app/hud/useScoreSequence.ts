import { useEffect } from 'react';
import type { Beat, ScoreSequence } from '../../core/scoring/types';
import { bus } from '../../events/bus';

export type BeatHandler = (beat: Beat) => void;

export function runScoreSequence(seq: ScoreSequence, onBeat: BeatHandler): () => void {
  const start = performance.now();
  let i = 0;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = () => {
    if (cancelled) return;
    const t = performance.now() - start;
    while (i < seq.beats.length && seq.beats[i]!.t <= t) {
      onBeat(seq.beats[i++]!);
    }
    if (i < seq.beats.length) {
      const next = seq.beats[i]!.t;
      const wait = Math.max(0, next - (performance.now() - start));
      timer = setTimeout(tick, wait);
    }
  };
  timer = setTimeout(tick, 0);

  return () => {
    cancelled = true;
    if (timer != null) clearTimeout(timer);
  };
}

export function useScoreSequence(seq: ScoreSequence | null): void {
  useEffect(() => {
    if (!seq) return;
    return runScoreSequence(seq, (beat) => bus.emit('onScoreBeat', { beat }));
  }, [seq]);
}
