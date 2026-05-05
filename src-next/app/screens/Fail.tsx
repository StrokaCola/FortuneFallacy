import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { selectScore, selectTarget, selectAnte, selectPlayerName } from '../../state/selectors';
import { lookupConstellation } from '../../data/constellations';

const selectConstellationId = (s: GameState) => s.run.constellationId;

export function Fail() {
  const score  = useStore(selectScore);
  const target = useStore(selectTarget);
  const ante   = useStore(selectAnte);
  const name   = useStore(selectPlayerName);
  const constellationId = useStore(selectConstellationId);
  const constellation = lookupConstellation(constellationId);

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
      pointerEvents: 'auto',
      background: 'rgba(3,2,12,0.92)',
      animation: 'fadein 800ms ease-out both',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
        <div style={{
          fontFamily: '"Cinzel Decorative", serif',
          fontSize: 72, fontWeight: 900,
          color: '#ff4d6d', letterSpacing: '0.22em',
          textShadow: '0 0 36px #ff4d6d, 0 0 80px rgba(255,77,109,0.45)',
          opacity: 0,
          animation: 'fadein 1400ms ease-out 200ms both',
        }}>NOT ENOUGH</div>

        <div className="f-mono uc" style={{
          fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em',
          opacity: 0,
          animation: 'fadein 800ms ease-out 1400ms both',
        }}>
          run ended {name ? `· ${name}` : ''} · ante {ante}
        </div>
        <div className="f-mono uc" style={{
          fontSize: 9, color: '#f5c451', letterSpacing: '0.3em',
          opacity: 0,
          animation: 'fadein 800ms ease-out 1500ms both',
        }}>
          ✦ {constellation.name}
        </div>

        <div className="mat-obsidian" style={{
          padding: '14px 26px', borderRadius: 12, marginTop: 10,
          display: 'flex', gap: 36,
          opacity: 0,
          animation: 'fadein 800ms ease-out 1700ms both',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div className="f-mono num" style={{ fontSize: 28, color: '#ff4d6d' }}>{score.toLocaleString()}</div>
            <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.3em', color: '#bba8ff' }}>final score</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="f-mono num" style={{ fontSize: 28, color: '#7be3ff' }}>{target.toLocaleString()}</div>
            <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.3em', color: '#bba8ff' }}>target</div>
          </div>
        </div>

        <div style={{
          marginTop: 18,
          opacity: 0,
          animation: 'fadein 800ms ease-out 2100ms both',
        }}>
          <button
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'constellation_select' })}
            className="btn btn-primary mat-interactive">
            ↻ Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
