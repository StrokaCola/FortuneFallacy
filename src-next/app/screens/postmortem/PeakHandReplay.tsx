// Replay the run's peak hand in the postmortem. Reuses the same
// buildScoreSequence + runScoreSequence pipeline as live scoring,
// emitting beats onto the same bus channel the existing ScoreMoment
// listens for. Effectively: it's a tiny scoring replay using the
// snapshot stored in run.runStats.peakHandSnapshot.
//
// The button only shows when a snapshot exists (a hand has actually
// been scored). Subsequent presses cancel the in-flight replay first
// so the player can re-trigger without overlap.

import { useRef, useState } from 'react';
import { bus } from '../../../events/bus';
import { buildScoreSequence } from '../../../core/scoring/sequence';
import { runScoreSequence } from '../../hud/useScoreSequence';
import type { PeakHandSnapshot } from '../../../state/slices/run';

type Props = {
  snapshot: PeakHandSnapshot | null;
  // Target the snapshot was scored against. Used by buildScoreSequence
  // to decide which tier (short/mid/full/mega) to render.
  target: number;
  color?: string;
};

export function PeakHandReplay({ snapshot, target, color = '#7be3ff' }: Props) {
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  if (!snapshot) return null;

  const onPlay = () => {
    if (playing) return;
    // Cancel any in-flight replay so a quick re-press doesn't double up.
    stopRef.current?.();
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seq = buildScoreSequence(snapshot, {
      target,
      bail: false,
      reducedMotion,
    });
    bus.emit('onScoreSequenceBuilt', { sequence: seq });
    setPlaying(true);
    stopRef.current = runScoreSequence(seq, (beat) => bus.emit('onScoreBeat', { beat }));
    // Auto-clear playing flag after the sequence's totalDurMs so the
    // button returns to its idle state. Add a small grace buffer for
    // the tail boom animation.
    window.setTimeout(() => {
      setPlaying(false);
      stopRef.current = null;
    }, seq.totalDurMs + 400);
  };

  return (
    <button
      type="button"
      onClick={onPlay}
      disabled={playing}
      className="btn btn-ghost mat-interactive tap"
      style={{
        marginTop: 6,
        fontSize: 11,
        padding: '6px 14px',
        borderColor: `${color}88`,
        color: playing ? '#7a6fa6' : color,
        opacity: playing ? 0.55 : 1,
        cursor: playing ? 'default' : 'pointer',
      }}
    >
      {playing ? '▶ replaying…' : '▶ replay peak hand'}
    </button>
  );
}
