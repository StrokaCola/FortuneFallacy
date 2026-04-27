import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';

type Breakdown = { chips: number; mult: number; ts: number };

export function ScoreBreakdown() {
  const [b, setB] = useState<Breakdown | null>(null);

  useEffect(() => {
    const off = bus.on('onScoreCalculated', ({ chips, mult }) => {
      const next: Breakdown = { chips, mult, ts: Date.now() };
      setB(next);
      setTimeout(() => setB((cur) => (cur === next ? null : cur)), 2000);
    });
    return off;
  }, []);

  if (!b) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: 230,
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 16,
        zIndex: 3,
        pointerEvents: 'none',
        animation: 'fadein 0.25s ease-out',
      }}
    >
      <div className="panel" style={{ padding: '8px 16px', textAlign: 'center' }}>
        <div className="f-mono uc" style={{ fontSize: 9, color: '#bba8ff', letterSpacing: '0.18em' }}>chips</div>
        <div className="f-display num" style={{ fontSize: 28, color: '#7be3ff' }}>{b.chips}</div>
      </div>
      <div className="f-display" style={{ fontSize: 36, color: '#bba8ff', alignSelf: 'center' }}>×</div>
      <div className="panel" style={{ padding: '8px 16px', textAlign: 'center' }}>
        <div className="f-mono uc" style={{ fontSize: 9, color: '#bba8ff', letterSpacing: '0.18em' }}>mult</div>
        <div className="f-display num" style={{ fontSize: 28, color: '#ff7847' }}>{b.mult}</div>
      </div>
    </div>
  );
}
