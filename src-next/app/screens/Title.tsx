import { dispatch } from '../../actions/dispatch';
import { PortalGate } from '../portal/PortalGate';
import { useStore, store } from '../../state/store';
import type { GameState } from '../../state/store';
import { lookupConstellation } from '../../data/constellations';

// Match PauseMenu's notion of "run in progress" — also count an active
// round (mid-hand) so a fresh-launch with `score === 0 && goalIdx === 0`
// but a hand already in flight still surfaces "Continue Run".
const selectHasRun = (s: GameState) =>
  s.run.goalIdx > 0 || s.round.score > 0 || s.run.catalysts.length > 0 || s.round.active;
// Each selector returns a primitive so useSyncExternalStore's Object.is
// comparison stays stable across renders. Returning an object literal here
// would create a fresh reference on every snapshot read and tear-loop.
const selectAnte = (s: GameState) => s.run.ante;
const selectGoalIdx = (s: GameState) => s.run.goalIdx;
const selectScore = (s: GameState) => s.round.score;
const selectConstellationId = (s: GameState) => s.run.constellationId;
const selectHighScores = (s: GameState) => s.meta.highScores;

export function Title() {
  const hasRun = useStore(selectHasRun);
  const ante = useStore(selectAnte);
  const goalIdx = useStore(selectGoalIdx);
  const score = useStore(selectScore);
  const constellationId = useStore(selectConstellationId);
  const highScores = useStore(selectHighScores);
  // Derived in render — the underlying array reference is stable, so this
  // recomputes only when highScores actually changes.
  const best = highScores.length === 0
    ? null
    : highScores.reduce((b, c) => (c.score > b.score ? c : b), highScores[0]!);
  // `score` is round score; surfaced in the run-summary line for parity with
  // the previous structured selector.
  void score;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'auto' }}>
      <div>
        <div className="f-mono uc" style={{
          fontSize: 11, color: '#7be3ff', letterSpacing: '0.6em', marginBottom: 24,
          opacity: 0,
          animation: 'titleStutter 1.4s steps(20, end) 200ms forwards',
          overflow: 'hidden', whiteSpace: 'nowrap', display: 'inline-block',
        }}>
          ◇ the gambler's fallacy, weaponized ◇
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
            className="btn btn-primary mat-interactive tap"
            style={{ width: 240 }}
            onClick={() => {
              if (hasRun) {
                const ok = window.confirm(
                  'A run is in progress. Starting a new ascension will overwrite it. Continue?',
                );
                if (!ok) return;
              }
              dispatch({ type: 'SET_SCREEN', screen: 'nameentry' });
            }}>
            Begin Ascension
          </button>
          {hasRun && (
            <>
              <button
                className="btn btn-ghost tap"
                style={{ width: 240 }}
                onClick={() => {
                  // If we paused mid-round and bailed to title, resume the
                  // game state back to playing. Toggle pause off via the
                  // store so the round resumes naturally on hub-screen.
                  if (store.getState().ui.paused) dispatch({ type: 'TOGGLE_PAUSE' });
                  dispatch({ type: 'SET_SCREEN', screen: 'hub' });
                }}>
                Continue Run
              </button>
              <div className="f-mono uc" style={{
                fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff', marginTop: -4,
              }}>
                ante {ante} · blind {(goalIdx % 3) + 1} · {lookupConstellation(constellationId).name}
              </div>
            </>
          )}
          {!hasRun && best && (
            <div className="f-mono uc" style={{
              fontSize: 9, letterSpacing: '0.32em', color: '#f5c451', marginTop: -2,
              textShadow: '0 0 10px rgba(245,196,81,0.35)',
            }}>
              best ◆ {best.score.toLocaleString()} · {best.name}
            </div>
          )}
          <button
            className="btn btn-ghost tap"
            style={{ width: 200 }}
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'codex' })}>
            Codex
          </button>
          <button
            className="btn btn-ghost tap"
            style={{ width: 200 }}
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'challenges' })}>
            Challenges
          </button>
          <button
            className="btn btn-ghost tap"
            style={{ width: 200 }}
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'scores' })}>
            Records
          </button>
          <button
            className="btn btn-ghost tap"
            style={{ width: 200 }}
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'settings' })}>
            Settings
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
