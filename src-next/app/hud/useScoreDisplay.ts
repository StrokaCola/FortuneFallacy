import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { useStore } from '../../state/store';
import { selectScore } from '../../state/selectors';

export function useScoreDisplay(): number {
  const baseScore = useStore(selectScore);
  const [overlay, setOverlay] = useState<number | null>(null);

  useEffect(() => {
    const offBeat = bus.on('onScoreBeat', ({ beat }) => {
      if ('runningTotal' in beat) {
        setOverlay(baseScore + beat.runningTotal);
      } else if (beat.kind === 'cast-swell') {
        setOverlay(null);
      } else if (beat.kind === 'boom') {
        setOverlay(beat.finalTotal + baseScore);
      } else if (beat.kind === 'bail') {
        setOverlay(beat.runningTotal + baseScore);
      }
    });
    return () => offBeat();
  }, [baseScore]);

  return overlay ?? baseScore;
}
