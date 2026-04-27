import { useStore } from '../../state/store';
import { selectAnte, selectBlindId, selectIsBoss, selectHandsLeft, selectRerollsLeft } from '../../state/selectors';
import { BLIND_DEFS, BOSS_BLINDS } from '../../data/blinds';

export function StatsCorner() {
  const ante     = useStore(selectAnte);
  const blindId  = useStore(selectBlindId);
  const isBoss   = useStore(selectIsBoss);
  const handsLeft = useStore(selectHandsLeft);
  const handsMax  = useStore((s) => s.round.handsMax);
  const rerolls   = useStore(selectRerollsLeft);
  const blindIdx  = useStore((s) => s.round.blindIndex);

  const blindName = isBoss
    ? BOSS_BLINDS.find((b) => b.id === blindId)?.name ?? 'Boss'
    : BLIND_DEFS[blindIdx]?.name ?? 'Blind';

  return (
    <div
      className="mat-obsidian"
      style={{
        position: 'absolute', top: 18, left: 18,
        padding: '10px 14px', borderRadius: 10,
        pointerEvents: 'auto', zIndex: 5,
      }}>
      <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.28em', color: '#bba8ff' }}>
        Ante {String(ante).padStart(2, '0')} · {blindName}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 6, alignItems: 'center' }}>
        <HandPips left={handsLeft} max={handsMax} />
        <RerollPips left={rerolls} />
      </div>
    </div>
  );
}

function HandPips({ left, max }: { left: number; max: number }) {
  return (
    <div className="has-tip" style={{ position: 'relative', display: 'flex', gap: 4 }}>
      {Array.from({ length: max }).map((_, i) => {
        const lit = i < left;
        const isLast = left === 1 && i === 0;
        return (
          <span
            key={i}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isLast ? '#e2334a' : lit ? '#7be3ff' : 'transparent',
              border: `1px solid ${isLast ? '#e2334a' : lit ? '#7be3ff' : 'rgba(149,119,255,0.4)'}`,
              boxShadow: isLast ? '0 0 8px #e2334a' : 'none',
              animation: isLast ? 'twinkle 1.4s ease-in-out infinite' : 'none',
            }}
          />
        );
      })}
      <span className="tip">{left} hand{left === 1 ? '' : 's'} left</span>
    </div>
  );
}

function RerollPips({ left }: { left: number }) {
  return (
    <div className="has-tip" style={{ position: 'relative', display: 'flex', gap: 4, alignItems: 'center' }}>
      <span className="f-mono" style={{ fontSize: 10, color: '#9577ff' }}>↻</span>
      {Array.from({ length: 2 }).map((_, i) => (
        <span key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: i < left ? '#9577ff' : 'transparent',
            border: '1px solid rgba(149,119,255,0.4)',
          }} />
      ))}
      <span className="tip">{left} reroll{left === 1 ? '' : 's'} left</span>
    </div>
  );
}
