import { dispatch } from '../../actions/dispatch';
import { useStore } from '../../state/store';
import { selectScore, selectShards, selectPlayerName } from '../../state/selectors';
import { PortalGate } from '../portal/PortalGate';

export function Win() {
  const score  = useStore(selectScore);
  const shards = useStore(selectShards);
  const name   = useStore(selectPlayerName);

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
      pointerEvents: 'auto', background: 'rgba(7,5,26,0.85)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        {/* shatter constellation */}
        <svg viewBox="0 0 200 200" width="220" height="220">
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const x = 100 + Math.cos(a) * 70;
            const y = 100 + Math.sin(a) * 70;
            return (
              <g key={i}>
                <line x1="100" y1="100" x2={x} y2={y}
                  stroke="#f5c451" strokeWidth="0.5" opacity="0.5"
                  strokeDasharray="2 3"
                  style={{ animation: `titleConstDraw 1.4s ease-out ${i * 60}ms both` }} />
                <circle cx={x} cy={y} r="2.5" fill="#f5c451"
                  style={{ filter: 'drop-shadow(0 0 6px #f5c451)', animation: `fadein 600ms ease-out ${800 + i * 60}ms both` }} />
              </g>
            );
          })}
          <circle cx="100" cy="100" r="6" fill="#fff"
            style={{ filter: 'drop-shadow(0 0 18px #7be3ff)' }} />
        </svg>

        <div className="f-display" style={{
          fontSize: 56, color: '#f5c451', letterSpacing: '0.2em',
          textShadow: '0 0 30px rgba(245,196,81,0.8)',
        }}>VICTORY</div>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
          all four antes cleared {name ? `· ${name}` : ''}
        </div>

        <div className="mat-obsidian" style={{ padding: '14px 26px', borderRadius: 12, marginTop: 14, display: 'flex', gap: 36 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="f-mono num" style={{ fontSize: 28, color: '#7be3ff' }}>{score.toLocaleString()}</div>
            <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.3em', color: '#bba8ff' }}>final score</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="f-mono num" style={{ fontSize: 28, color: '#f5c451' }}>◆ {shards}</div>
            <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.3em', color: '#bba8ff' }}>shards</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 14 }}>
          <button
            onClick={() => dispatch({ type: 'NEW_RUN' })}
            className="btn btn-primary mat-interactive">
            ✦ New Run
          </button>
          <PortalGate size={72} label="Travel" />
        </div>
      </div>
    </div>
  );
}
