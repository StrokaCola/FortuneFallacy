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
      const seq = buildScoreSequence(input, {
        target: state.round.target,
        bail: state.round.pendingRoundEnd === 'bust',
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
