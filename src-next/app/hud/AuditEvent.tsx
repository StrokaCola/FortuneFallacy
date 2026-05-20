// "The Audit" — once-per-run mid-run risk event. Pops on ante-3 entry
// (Hub screen) and forces a choice: gamble half/double on a coin flip,
// or pay a flat 5 shards to skip. Pure Clover Pit DNA. Rendered as a
// modal overlay so the player can't click around it.

import { useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, store } from '../../state/store';
import type { GameState } from '../../state/store';
import { sfxPlay } from '../../audio/sfx';
import { Z } from './zLayers';

const selectShards = (s: GameState) => s.run.shards;
const selectAnte = (s: GameState) => s.run.ante;
const selectAuditResolved = (s: GameState) => s.run.auditResolved ?? false;
const selectScreen = (s: GameState) => s.ui.screen;

export function AuditEvent() {
  const ante = useStore(selectAnte);
  const resolved = useStore(selectAuditResolved);
  const screen = useStore(selectScreen);
  const shards = useStore(selectShards);
  // Show only on Hub at ante 3+ until resolved.
  const shouldShow = !resolved && ante >= 3 && screen === 'hub';

  const [phase, setPhase] = useState<'choice' | 'reveal'>('choice');
  const [outcome, setOutcome] = useState<'win' | 'lose' | 'skip' | null>(null);
  const [shardsBefore, setShardsBefore] = useState(shards);

  if (!shouldShow) return null;

  const onGamble = () => {
    const before = shards;
    setShardsBefore(before);
    sfxPlay('castSwell');
    dispatch({ type: 'RESOLVE_AUDIT', choice: 'gamble' });
    // The handler resolves synchronously; defer the reveal flip so the
    // outcome lands as a flourish. We compare via the post-dispatch
    // store read in the timeout — if shards doubled, it's a win; if
    // they decreased, it's a loss. Tied is impossible because the
    // handler always changes shards.
    window.setTimeout(() => {
      // Read the post-dispatch shards directly. The handler resolved
      // synchronously, so the store has the new value.
      const after = store.getState().run.shards;
      const won = after >= before * 2;
      setOutcome(won ? 'win' : 'lose');
      setPhase('reveal');
      sfxPlay(won ? 'bigScore' : 'bust', { gain: 0.6 });
    }, 200);
  };

  const onSkip = () => {
    setShardsBefore(shards);
    setOutcome('skip');
    sfxPlay('uiClick');
    dispatch({ type: 'RESOLVE_AUDIT', choice: 'skip' });
    setPhase('reveal');
  };

  const dismiss = () => {
    // Just unmount via the resolved flag flip. No-op here — the parent
    // Will hide us when the store transitions auditResolved → true.
    // setPhase('choice') / setOutcome(null) reset for the next run.
    setPhase('choice');
    setOutcome(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="The Audit — choose your outcome"
      style={{
        position: 'absolute', inset: 0,
        zIndex: Z.modal,
        background: 'rgba(3,2,12,0.85)',
        display: 'grid', placeItems: 'center',
        pointerEvents: 'auto',
        animation: 'fadein 380ms ease-out',
      }}
    >
      <div className="panel-strong" style={{
        width: 'min(420px, calc(100vw - 32px))',
        padding: '28px 32px',
        border: '1px solid rgba(245,196,81,0.6)',
        boxShadow: '0 0 50px rgba(245,196,81,0.35), 0 30px 60px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>
        <div className="f-mono uc" style={{
          fontSize: 10, letterSpacing: '0.5em', color: '#f5c451',
        }}>
          ★ the audit ★
        </div>
        <div className="f-display" style={{
          fontSize: 24, color: '#f3f0ff', textAlign: 'center', letterSpacing: '0.04em',
        }}>
          The cosmos checks the books.
        </div>

        {phase === 'choice' && (
          <>
            <div style={{
              fontFamily: '"Exo 2", sans-serif',
              fontSize: 13, color: '#bba8ff',
              textAlign: 'center', lineHeight: 1.5,
              maxWidth: 320,
            }}>
              You stand before ante three. A 50/50 coin lies on the table —
              <span style={{ color: '#7be3ff' }}> double or half</span> your
              shards. Or pay <span style={{ color: '#f5c451' }}>5 ◇</span> to
              walk past it.
            </div>
            <div className="f-mono num" style={{ fontSize: 18, color: '#f5c451' }}>
              ◇ {shards}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-primary mat-interactive tap"
                onClick={onGamble}
                style={{
                  background: 'rgba(245,196,81,0.18)',
                  borderColor: '#f5c451',
                  fontSize: 13,
                  padding: '12px 20px',
                  minWidth: 130,
                }}>
                ◈ Gamble
              </button>
              <button
                type="button"
                className="btn btn-ghost mat-interactive tap"
                onClick={onSkip}
                disabled={shards < 5}
                style={{ fontSize: 13, padding: '12px 20px', minWidth: 130 }}>
                Skip · -5 ◇
              </button>
            </div>
          </>
        )}

        {phase === 'reveal' && outcome !== null && (
          <>
            <div className="f-display" style={{
              fontSize: 28,
              color: outcome === 'win' ? '#f5c451' : outcome === 'lose' ? '#ff4d6d' : '#bba8ff',
              textShadow: outcome === 'win'
                ? '0 0 24px rgba(245,196,81,0.85)'
                : outcome === 'lose'
                ? '0 0 24px rgba(255,77,109,0.85)'
                : undefined,
            }}>
              {outcome === 'win' ? 'DOUBLED' : outcome === 'lose' ? 'HALVED' : 'WAVED PAST'}
            </div>
            <div className="f-mono num" style={{ fontSize: 14, color: '#bba8ff' }}>
              ◇ {shardsBefore} → ◇ {shards}
            </div>
            <button
              type="button"
              className="btn btn-primary mat-interactive tap"
              onClick={dismiss}
              data-autofocus
              style={{ fontSize: 13, padding: '10px 22px', marginTop: 6 }}>
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}

