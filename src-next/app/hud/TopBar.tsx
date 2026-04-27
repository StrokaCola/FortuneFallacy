import { Astrolabe } from '../visual/Astrolabe';
import { Sigil } from '../visual/Sigil';

export function TopBar({
  ante = 1,
  blind = 'Blind',
  shards = 0,
  hands = 3,
  rerolls = 2,
  target = 0,
  score = 0,
  oracleSlots,
  voucherCount = 0,
  accent = '#7be3ff',
}: {
  ante?: number; blind?: string; shards?: number; hands?: number; rerolls?: number;
  target?: number; score?: number;
  oracleSlots?: { used: number; max: number };
  voucherCount?: number;
  accent?: string;
}) {
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
            <div className="f-display num" style={{ fontSize: 38, lineHeight: 1, color: '#f3f0ff', fontWeight: 700 }}>
              {score.toLocaleString()}
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
          <div className="f-display num" style={{ fontSize: 32, color: '#f5c451', fontWeight: 700 }}>{shards}</div>
          <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.2em' }}>shards</div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {oracleSlots && (
            <span className="f-mono" style={{ fontSize: 10, color: '#7be3ff', padding: '2px 6px',
              border: '1px solid rgba(123,227,255,0.4)', borderRadius: 4 }}>
              oracles {oracleSlots.used}/{oracleSlots.max}
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
