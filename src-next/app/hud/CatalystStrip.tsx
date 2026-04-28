import { useStore, type GameState } from '../../state/store';
import { lookupCatalyst } from '../../data/catalysts';

const selectCatalysts = (s: GameState) => s.run.catalysts;

export function CatalystStrip() {
  const catalysts = useStore(selectCatalysts);
  if (catalysts.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', top: 142, left: 18,
      display: 'flex', gap: 8, zIndex: 4,
    }}>
      {catalysts.map((id, i) => {
        const c = lookupCatalyst(id);
        if (!c) return null;
        return (
          <div key={i} className="has-tip" style={{ position: 'relative' }}>
            <div style={{
              width: 64, height: 88, borderRadius: 8,
              background: `linear-gradient(180deg, ${c.color}25, rgba(15,9,37,0.85))`,
              border: `1px solid ${c.color}80`,
              boxShadow: `0 0 14px ${c.color}40, inset 0 0 10px ${c.color}20`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 4px',
              cursor: 'help',
            }}>
              <div className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.18em', color: '#bba8ff' }}>catalyst</div>
              <div style={{ fontSize: 28, color: c.color, filter: `drop-shadow(0 0 6px ${c.color})` }}>{c.icon}</div>
              <div className="f-mono uc" style={{ fontSize: 7, letterSpacing: '0.14em', color: c.color, textAlign: 'center', lineHeight: 1.2 }}>
                {c.name.split(' ').pop()}
              </div>
            </div>
            <div className="tip">{c.desc}</div>
          </div>
        );
      })}
    </div>
  );
}
