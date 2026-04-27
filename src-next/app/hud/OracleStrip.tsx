import { useStore, type GameState } from '../../state/store';
import { lookupOracle } from '../../data/oracles';

const selectOracles = (s: GameState) => s.run.oracles;

export function OracleStrip() {
  const oracles = useStore(selectOracles);
  if (oracles.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', top: 142, left: 18,
      display: 'flex', gap: 8, zIndex: 4,
    }}>
      {oracles.map((id, i) => {
        const o = lookupOracle(id);
        if (!o) return null;
        return (
          <div key={i} className="has-tip" style={{ position: 'relative' }}>
            <div style={{
              width: 64, height: 88, borderRadius: 8,
              background: `linear-gradient(180deg, ${o.color}25, rgba(15,9,37,0.85))`,
              border: `1px solid ${o.color}80`,
              boxShadow: `0 0 14px ${o.color}40, inset 0 0 10px ${o.color}20`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 4px',
              cursor: 'help',
            }}>
              <div className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.18em', color: '#bba8ff' }}>oracle</div>
              <div style={{ fontSize: 28, color: o.color, filter: `drop-shadow(0 0 6px ${o.color})` }}>{o.icon}</div>
              <div className="f-mono uc" style={{ fontSize: 7, letterSpacing: '0.14em', color: o.color, textAlign: 'center', lineHeight: 1.2 }}>
                {o.name.split(' ').pop()}
              </div>
            </div>
            <div className="tip">{o.desc}</div>
          </div>
        );
      })}
    </div>
  );
}
