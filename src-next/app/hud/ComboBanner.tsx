import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { COMBOS } from '../../core/scoring/combos';

type Banner = { combo: string; chips: number; mult: number; ts: number };

export function ComboBanner({ accent = '#7be3ff' }: { accent?: string }) {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    const off = bus.on('onScoreCalculated', ({ combo, chips, mult }) => {
      const b: Banner = { combo, chips, mult, ts: Date.now() };
      setBanner(b);
      setTimeout(() => setBanner((cur) => (cur === b ? null : cur)), 2000);
    });
    return off;
  }, []);

  if (!banner) return null;
  const c = COMBOS.find((x) => x.id === banner.combo);
  if (!c) return null;

  return (
    <div style={{
      position: 'absolute', left: '50%', top: 145, transform: 'translateX(-50%)',
      pointerEvents: 'none', textAlign: 'center', zIndex: 4,
      animation: 'fadein 0.25s ease-out',
    }}>
      <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.4em', color: '#bba8ff', marginBottom: 4 }}>
        ◇ pattern detected ◇
      </div>
      <div className="panel-strong" style={{
        padding: '10px 28px', display: 'inline-flex', alignItems: 'center', gap: 18,
        border: `1px solid ${accent}88`, boxShadow: `0 0 28px ${accent}55, inset 0 0 18px ${accent}20`,
      }}>
        <span className="f-display" style={{ fontSize: 22, color: '#f3f0ff' }}>{c.name}</span>
        <span className="f-mono num" style={{ fontSize: 14, color: '#7be3ff' }}>+{banner.chips}</span>
        <span style={{ width: 1, height: 18, background: 'rgba(149,119,255,0.4)' }} />
        <span className="f-mono num" style={{ fontSize: 14, color: '#ff7847' }}>×{banner.mult}</span>
      </div>
    </div>
  );
}
