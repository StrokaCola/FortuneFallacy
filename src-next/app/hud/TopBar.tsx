import { useEffect, useRef, useState } from 'react';
import { Astrolabe } from '../visual/Astrolabe';
import { Sigil } from '../visual/Sigil';
import { useTweenedNumber } from '../hooks/useTweenedNumber';

// Toggles a CSS class for `ms` whenever `value` increases. Used to flash the
// score/shards readouts when they tick up. Decreases (e.g. shard sink) skip
// the flash so we don't celebrate losses.
function useIncreaseFlash(value: number, ms = 280): boolean {
  const [flashing, setFlashing] = useState(false);
  const prev = useRef(value);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (value > prev.current) {
      setFlashing(true);
      if (timer.current != null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setFlashing(false), ms);
    }
    prev.current = value;
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, [value, ms]);
  return flashing;
}

export function TopBar({
  ante = 1,
  blind = 'Trial',
  shards = 0,
  hands = 3,
  rerolls = 2,
  target = 0,
  score = 0,
  catalystSlots,
  voucherCount = 0,
  accent = '#7be3ff',
}: {
  ante?: number; blind?: string; shards?: number; hands?: number; rerolls?: number;
  target?: number; score?: number;
  catalystSlots?: { used: number; max: number };
  voucherCount?: number;
  accent?: string;
}) {
  const tweenedScore = useTweenedNumber(score);
  const tweenedShards = useTweenedNumber(shards);
  const scoreFlash = useIncreaseFlash(score);
  const shardFlash = useIncreaseFlash(shards);
  return (
    <div style={{
      position: 'absolute', top: 18, left: 18, right: 18,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      pointerEvents: 'none', zIndex: 5,
    }}>
      <div className="panel" style={{ padding: '14px 18px', minWidth: 280, pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Astrolabe size={92} score={score} target={target} accent={accent} />
          <div>
            <div className="f-mono uc" style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.2em' }}>score</div>
            <div
              className={`f-display num score-readout${scoreFlash ? ' score-flash' : ''}`}
              style={{ fontSize: 38, lineHeight: 1, color: '#f3f0ff', fontWeight: 700 }}
            >
              {Math.round(tweenedScore).toLocaleString()}
            </div>
            <div className="f-mono num" style={{ fontSize: 12, color: accent, marginTop: 2 }}>
              / {target ? target.toLocaleString() : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: '12px 22px', textAlign: 'center', pointerEvents: 'auto' }}>
        <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff' }}>
          ante {String(ante).padStart(2, '0')} · {blind.toLowerCase()}
        </div>
        <div className="f-display" style={{ fontSize: 22, marginTop: 4, color: '#f3f0ff' }}>{blind}</div>
        <div className="f-mono" style={{ fontSize: 10, color: '#9577ff', marginTop: 2 }}>
          hands {hands} · rerolls {rerolls}
        </div>
      </div>

      <div className="panel" style={{ padding: '14px 18px', minWidth: 200, pointerEvents: 'auto' }}>
        <div className="f-mono uc" style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.2em' }}>treasury</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <Sigil kind="star" size={20} color="#f5c451" />
          <div
            className={`f-display num shard-readout${shardFlash ? ' shard-flash' : ''}`}
            style={{ fontSize: 32, color: '#f5c451', fontWeight: 700 }}
          >
            {Math.round(tweenedShards)}
          </div>
          <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.2em' }}>shards</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {catalystSlots && (
            <span className="f-mono" style={{ fontSize: 10, color: '#7be3ff', padding: '2px 6px',
              border: '1px solid rgba(123,227,255,0.4)', borderRadius: 4 }}>
              catalysts {catalystSlots.used}/{catalystSlots.max}
            </span>
          )}
          {voucherCount > 0 && (
            <span className="f-mono" style={{ fontSize: 10, color: '#bba8ff', padding: '2px 6px',
              border: '1px solid rgba(149,119,255,0.3)', borderRadius: 4 }}>
              vouchers {voucherCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
