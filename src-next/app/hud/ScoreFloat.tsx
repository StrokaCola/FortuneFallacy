import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { useStore } from '../../state/store';
import { selectScore, selectTarget } from '../../state/selectors';

// "Score Explosion on Boom" — when the boom beat fires, the counter
// itself erupts: scale-punch + chromatic split + an outward ring. The
// existing scoreCounterCatch animation (220ms tween) is too subtle for
// the climax; this is the dedicated celebration.

const EXPLOSION_DURATION_MS = 720;

export function ScoreFloat() {
  const score = useStore(selectScore);
  const target = useStore(selectTarget);

  const [displayScore, setDisplayScore] = useState<number | null>(null);
  const [goldUntil, setGoldUntil] = useState(0);
  const [explosion, setExplosion] = useState<{ key: number; gold: boolean; mega: boolean } | null>(null);
  const explosionKeyRef = useRef(0);

  useEffect(() => {
    const off = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind === 'cross-target') {
        setGoldUntil(performance.now() + 4000);
      }
      if ('runningTotal' in beat) {
        setDisplayScore(beat.runningTotal);
      }
      if (beat.kind === 'boom') {
        const key = ++explosionKeyRef.current;
        const mega = (beat.megaRatio ?? 0) >= 3;
        setExplosion({ key, gold: beat.crossedTarget, mega });
        window.setTimeout(() => {
          setExplosion((cur) => (cur?.key === key ? null : cur));
        }, EXPLOSION_DURATION_MS);
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
      <div style={{ position: 'relative' }}>
        {explosion && (
          <>
            <div
              key={`ring-${explosion.key}`}
              aria-hidden
              className="score-boom-ring"
              style={{
                position: 'absolute',
                left: '50%', top: '50%',
                width: explosion.mega ? 220 : 160,
                height: explosion.mega ? 220 : 160,
                marginLeft: explosion.mega ? -110 : -80,
                marginTop: explosion.mega ? -110 : -80,
                borderRadius: '50%',
                border: `2px solid ${explosion.gold ? '#f5c451' : '#7be3ff'}`,
                boxShadow: `0 0 28px ${explosion.gold ? '#f5c451' : '#7be3ff'}, 0 0 56px ${explosion.gold ? 'rgba(245,196,81,0.55)' : 'rgba(123,227,255,0.55)'}`,
                pointerEvents: 'none',
              }}
            />
            {explosion.mega && (
              <div
                key={`ring2-${explosion.key}`}
                aria-hidden
                className="score-boom-ring score-boom-ring-2"
                style={{
                  position: 'absolute',
                  left: '50%', top: '50%',
                  width: 280, height: 280,
                  marginLeft: -140, marginTop: -140,
                  borderRadius: '50%',
                  border: '1.5px solid #ff7847',
                  boxShadow: '0 0 32px #ff7847, 0 0 64px rgba(255,120,71,0.4)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </>
        )}
        <div
          key={explosion?.key ?? 'idle'}
          data-score-counter
          className={`f-mono num${explosion ? (explosion.mega ? ' score-boom-mega' : ' score-boom-pop') : ''}`}
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
