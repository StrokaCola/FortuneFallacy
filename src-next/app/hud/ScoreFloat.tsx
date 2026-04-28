import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { useStore } from '../../state/store';
import { selectScore, selectTarget } from '../../state/selectors';

export function ScoreFloat() {
  const score = useStore(selectScore);
  const target = useStore(selectTarget);

  const [displayScore, setDisplayScore] = useState<number | null>(null);
  const [goldUntil, setGoldUntil] = useState(0);

  useEffect(() => {
    const off = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind === 'cross-target') {
        setGoldUntil(performance.now() + 4000);
      }
      if ('runningTotal' in beat) {
        setDisplayScore(beat.runningTotal);
      }
    });
    return () => off();
  }, []);

  useEffect(() => {
    if (goldUntil <= performance.now()) return;
    const wait = goldUntil - performance.now();
    const t = setTimeout(() => setGoldUntil(0), wait);
    return () => clearTimeout(t);
  }, [goldUntil]);

  const isGold = performance.now() < goldUntil;
  const shownScore = displayScore ?? score;
  const pct = target > 0 ? Math.min(1, score / target) : 0;

  return (
    <div style={{
      position: 'absolute', top: 28, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      pointerEvents: 'none', zIndex: 5,
    }}>
      <div
        data-score-counter
        className="f-mono num"
        style={{
          fontSize: 56, lineHeight: 1,
          color: isGold ? '#f5c451' : '#f3f0ff',
          textShadow: '0 0 24px rgba(123,227,255,0.5)',
          fontWeight: 700,
          transition: 'color 200ms ease',
        }}
      >
        {shownScore.toLocaleString()}
      </div>
      <div className="f-mono num" style={{
        fontSize: 13, color: '#ff7847', marginTop: 4, letterSpacing: '0.1em',
      }}>
        / {target ? target.toLocaleString() : '—'}
      </div>
      <div style={{
        marginTop: 6, width: 160, height: 2, borderRadius: 2,
        background: 'rgba(149,119,255,0.2)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct * 100}%`, height: '100%',
          background: pct >= 1 ? '#7be3ff' : '#f5c451',
          transition: 'width var(--snap, 120ms) var(--ease-snap, ease)',
        }} />
      </div>
    </div>
  );
}
