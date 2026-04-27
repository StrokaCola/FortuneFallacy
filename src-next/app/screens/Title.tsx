import { dispatch } from '../../actions/dispatch';
import { PortalGate } from '../portal/PortalGate';
import { useStore } from '../../state/store';
import type { GameState } from '../../state/store';

const selectHasRun = (s: GameState) => s.run.goalIdx > 0 || s.round.score > 0 || s.run.oracles.length > 0;

export function Title() {
  const hasRun = useStore(selectHasRun);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'auto' }}>
      <div>
        <div className="f-mono uc" style={{
          fontSize: 11, color: '#7be3ff', letterSpacing: '0.6em', marginBottom: 24,
          opacity: 0,
          animation: 'titleStutter 1.4s steps(20, end) 200ms forwards',
          overflow: 'hidden', whiteSpace: 'nowrap', display: 'inline-block',
        }}>
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

        <svg viewBox="0 0 240 60" width="240" height="60" style={{ display: 'block', margin: '40px auto 0' }}>
          {[
            { x: 30,  y: 30 },
            { x: 80,  y: 18 },
            { x: 120, y: 42 },
            { x: 160, y: 22 },
            { x: 210, y: 36 },
          ].map((p, i, arr) => (
            <g key={i}>
              {i < arr.length - 1 && (
                <line
                  x1={p.x} y1={p.y} x2={arr[i + 1]!.x} y2={arr[i + 1]!.y}
                  stroke="#7be3ff" strokeWidth="0.6" strokeDasharray="2 3"
                  style={{
                    strokeDashoffset: 60,
                    animation: 'titleConstDraw 2.4s ease-out forwards',
                    animationDelay: `${i * 200}ms`,
                  }} />
              )}
              <circle cx={p.x} cy={p.y} r="2.5" fill="#f5c451"
                style={{
                  filter: 'drop-shadow(0 0 4px #f5c451)',
                  opacity: 0,
                  animation: 'fadein 600ms ease-out forwards',
                  animationDelay: `${i * 220}ms`,
                }} />
            </g>
          ))}
        </svg>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 36, alignItems: 'center' }}>
          <button
            className="btn btn-primary mat-interactive"
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
          <div style={{ marginTop: 18 }}>
            <PortalGate size={72} label="Travel" />
          </div>
        </div>

        <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.3em', color: '#9577ff', marginTop: 60, opacity: 0.7 }}>
          v 0.42 · seed ⟨LYRA-VII⟩
        </div>
      </div>
    </div>
  );
}
