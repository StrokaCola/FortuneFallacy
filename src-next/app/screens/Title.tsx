import { dispatch } from '../../actions/dispatch';
import { Sigil } from '../visual/Sigil';
import { PortalButton } from '../portal/PortalButton';
import { useStore } from '../../state/store';
import type { GameState } from '../../state/store';

const selectHasRun = (s: GameState) => s.run.goalIdx > 0 || s.round.score > 0 || s.run.oracles.length > 0;

export function Title() {
  const hasRun = useStore(selectHasRun);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'auto' }}>
      <div>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#7be3ff', letterSpacing: '0.6em', marginBottom: 24 }}>
          ◇ a roguelike of dice and divination ◇
        </div>
        <div className="f-display" style={{ fontSize: 96, lineHeight: 1, color: '#f3f0ff',
          textShadow: '0 0 40px rgba(123,227,255,0.5), 0 0 80px rgba(149,119,255,0.4)' }}>
          Fortune
        </div>
        <div className="f-display" style={{ fontSize: 96, lineHeight: 1, color: '#7be3ff',
          textShadow: '0 0 40px rgba(123,227,255,0.6)', fontStyle: 'italic' }}>
          Fallacy
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 40 }}>
          <Sigil kind="moon" size={28} color="#bba8ff" />
          <Sigil kind="star" size={32} color="#7be3ff" />
          <Sigil kind="sun" size={28} color="#f5c451" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 36, alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            style={{ width: 240 }}
            onClick={() => dispatch({ type: 'NEW_RUN' })}>
            Begin Ascension
          </button>
          {hasRun && (
            <button
              className="btn btn-ghost"
              style={{ width: 240 }}
              onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'hub' })}>
              Continue Run
            </button>
          )}
          <button
            className="btn btn-ghost"
            style={{ width: 200 }}
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'scores' })}>
            Codex
          </button>
          <PortalButton />
        </div>

        <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.3em', color: '#9577ff', marginTop: 60, opacity: 0.7 }}>
          v 0.42 · seed ⟨LYRA-VII⟩
        </div>
      </div>
    </div>
  );
}
