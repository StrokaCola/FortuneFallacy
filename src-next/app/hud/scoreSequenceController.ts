import { useEffect } from 'react';
import { bus } from '../../events/bus';
import { adaptScoringContext } from '../../core/scoring/adapter';
import { buildScoreSequence } from '../../core/scoring/sequence';
import { runScoreSequence } from './useScoreSequence';
import { getState } from '../../state/store';

export function useScoreSequenceController() {
  useEffect(() => {
    const off = bus.on('onScoreCalculated', () => {
      const state = getState();
      const lastCtx = state.round.lastScoringCtx;
      if (!lastCtx) return;
      const input = adaptScoringContext(lastCtx);
      const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const isLastHand = state.round.handsLeft === 0;
      // Simplification: maxRemaining is set to the score just produced, not the best-case
      // future score. This means bail only triggers when handsLeft === 0 && finalTotal < target
      // (i.e. the actual last hand failed). The "mathematically unreachable from any future hand"
      // scenario described in the spec is not detected — the player just sees a normal mid-tier
      // ceremony on hands 1..n-1 even when victory is impossible. Tracked as follow-up.
      const maxRemaining = input.finalTotal;
      const seq = buildScoreSequence(input, {
        target: state.round.target,
        isLastHand,
        maxRemaining,
        reducedMotion,
      });
      bus.emit('onScoreSequenceBuilt', { sequence: seq });
      const stop = runScoreSequence(seq, (beat) => bus.emit('onScoreBeat', { beat }));
      // safety cleanup if sequence never naturally completes
      setTimeout(stop, seq.totalDurMs + 200);
    });
    return () => off();
  }, []);
}
