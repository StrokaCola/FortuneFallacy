import { dispatch } from '../../actions/dispatch';
import { CONSTELLATIONS, type Constellation } from '../../data/constellations';
import { describeDiceSpec } from '../../data/dice';
import { useIsCompactStage } from '../hooks/useIsCompactStage';

export function ConstellationSelect() {
  const compact = useIsCompactStage();
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'auto',
      overflow: 'auto', padding: compact ? '20px 12px' : '36px 24px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        <div className="f-mono uc" style={{
          fontSize: compact ? 12 : 11, color: '#7be3ff', letterSpacing: '0.5em', marginBottom: 8,
        }}>
          ◇ choose your constellation ◇
        </div>
        <div className="f-display" style={{
          fontSize: compact ? 32 : 44, color: '#f3f0ff', marginBottom: 4,
          textShadow: '0 0 30px rgba(123,227,255,0.4)',
        }}>
          Pick your dice
        </div>
        <div className="f-mono" style={{ fontSize: compact ? 13 : 12, color: '#bba8ff', marginBottom: compact ? 16 : 28, opacity: 0.8 }}>
          Each constellation rolls a different set of dice for the entire run.
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${compact ? 200 : 240}px, 1fr))`,
          gap: compact ? 10 : 14,
          marginBottom: compact ? 16 : 28,
        }}>
          {CONSTELLATIONS.map((c) => <Card key={c.id} c={c} compact={compact} />)}
        </div>

        <button
          className="btn btn-ghost mat-interactive"
          style={{ width: 200 }}
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}>
          ← Back
        </button>
      </div>
    </div>
  );
}

function Card({ c, compact }: { c: Constellation; compact: boolean }) {
  const accent = '#7be3ff';
  return (
    <button
      className="panel mat-interactive"
      onClick={() => dispatch({ type: 'NEW_RUN', constellationId: c.id })}
      style={{
        textAlign: 'left',
        padding: compact ? 12 : 16,
        background: 'rgba(15,9,37,0.6)',
        border: '1px solid rgba(149,119,255,0.25)',
        borderRadius: 12,
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: compact ? 6 : 10,
        minHeight: compact ? 200 : 280,
      }}>
      <Glyph points={c.glyph} accent={accent} />
      <div className="f-display" style={{ fontSize: compact ? 22 : 18, color: '#f3f0ff', lineHeight: 1.1 }}>
        {c.name}
      </div>
      <div className="f-mono uc" style={{
        fontSize: compact ? 11 : 9, letterSpacing: '0.18em', color: '#f5c451',
      }}>
        {describeDiceSpec(c.dice)}
      </div>
      <div style={{ fontSize: compact ? 13 : 11, color: '#bba8ff', fontStyle: 'italic', lineHeight: 1.3 }}>
        {c.flavor}
      </div>
      <ul style={{
        marginTop: 'auto', paddingLeft: 18, marginBottom: 0,
        fontSize: compact ? 12 : 10, color: '#dcd4ff', lineHeight: compact ? 1.3 : 1.4,
      }}>
        {c.rules.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    </button>
  );
}

function Glyph({ points, accent }: { points: { x: number; y: number }[]; accent: string }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="60" style={{ display: 'block' }}>
      {points.map((p, i, arr) => (
        <g key={i}>
          {i < arr.length - 1 && (
            <line
              x1={p.x} y1={p.y}
              x2={arr[i + 1]!.x} y2={arr[i + 1]!.y}
              stroke={accent} strokeWidth="0.6" strokeDasharray="2 3" opacity="0.6" />
          )}
          <circle cx={p.x} cy={p.y} r="2.4" fill="#f5c451"
            style={{ filter: 'drop-shadow(0 0 4px #f5c451)' }} />
        </g>
      ))}
    </svg>
  );
}
