import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { PortalGate } from '../portal/PortalGate';
import { TopBar } from '../hud/TopBar';
import { OrnateFrame } from '../visual/OrnateFrame';
import {
  selectAnte, selectGoalIdx, selectShards, selectOracles, selectVouchers, selectScore, selectTarget,
} from '../../state/selectors';
import { BLIND_DEFS, targetForBlind } from '../../data/blinds';
import { sfxPlay } from '../../audio/sfx';

const selectHandsLeft = (s: GameState) => s.round.handsLeft;
const selectRerollsLeft = (s: GameState) => s.round.rerollsLeft;

const SIGILS_BY_BLIND = ['☽', '☀', '⛧'];

export function Hub() {
  const ante     = useStore(selectAnte);
  const goalIdx  = useStore(selectGoalIdx);
  const shards   = useStore(selectShards);
  const oracles  = useStore(selectOracles);
  const vouchers = useStore(selectVouchers);
  const handsLeft = useStore(selectHandsLeft);
  const rerollsLeft = useStore(selectRerollsLeft);
  const score    = useStore(selectScore);
  const target   = useStore(selectTarget);

  const accent = '#7be3ff';
  const blindIdx = goalIdx % 3;

  const blinds = BLIND_DEFS.map((def, i) => ({
    def,
    cleared: i < blindIdx,
    current: i === blindIdx,
    target: targetForBlind(ante, i),
    sigil: SIGILS_BY_BLIND[i] ?? '✦',
    reward: def.isBoss ? 8 : 5,
    mult: def.targetMult,
  }));

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
      <TopBar
        ante={ante}
        blind="Hub"
        shards={shards}
        hands={handsLeft}
        rerolls={rerollsLeft}
        target={target}
        score={score}
        oracleSlots={{ used: oracles.length, max: 6 }}
        voucherCount={vouchers.length}
        accent={accent}
      />

      <div style={{
        position: 'absolute', left: '50%', top: 200, transform: 'translateX(-50%)',
        textAlign: 'center', zIndex: 4,
      }}>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
          ◇ choose your trial ◇
        </div>
        <div className="f-display" style={{ fontSize: 36, color: '#f3f0ff', marginTop: 8 }}>
          The Tribunal of Stars
        </div>
        <div style={{ fontFamily: '"Exo 2", sans-serif', fontSize: 13, color: '#bba8ff', marginTop: 6, maxWidth: 460, marginInline: 'auto' }}>
          Three blinds bar your ascension. Each cleared blind grants shards and admittance to the Bazaar.
        </div>
      </div>

      <div style={{
        position: 'absolute', left: '50%', top: 360, transform: 'translateX(-50%)',
        display: 'flex', gap: 26, zIndex: 4,
      }}>
        {blinds.map((b, i) => {
          const isBoss = b.def.isBoss;
          const cur = b.current;
          const cleared = b.cleared;
          const frameColor = cur ? accent : isBoss ? 'rgba(226,51,74,0.6)' : 'rgba(245,196,81,0.4)';
          const sigilColor = isBoss ? '#e2334a' : cur ? accent : '#9577ff';
          return (
            <div
              key={i}
              onMouseEnter={() => sfxPlay('nodePulse')}
              className="panel-strong"
              style={{
                width: 240, height: 320, padding: 20, position: 'relative',
                border: cur ? `2px solid ${accent}` : (isBoss ? '1px solid rgba(226,51,74,0.5)' : '1px solid rgba(149,119,255,0.3)'),
                boxShadow: cur ? `0 0 30px ${accent}55` : (isBoss ? '0 0 24px rgba(226,51,74,0.3)' : '0 8px 24px rgba(0,0,0,0.4)'),
                opacity: cleared ? 0.55 : 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}>
              <OrnateFrame style={{ width: '100%', height: '100%' }} color={frameColor}>
                <div style={{ position: 'absolute', inset: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.3em', color: cur ? accent : '#bba8ff' }}>
                    blind {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="f-display" style={{ fontSize: 22, color: '#f3f0ff', marginTop: 6 }}>
                    {b.def.name}
                  </div>
                  <div style={{
                    fontSize: 64, marginTop: 14, color: sigilColor,
                    filter: `drop-shadow(0 0 14px ${sigilColor}80)`,
                  }}>{b.sigil}</div>
                  <div style={{ marginTop: 'auto', textAlign: 'center', width: '100%' }}>
                    <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.2em', color: '#bba8ff' }}>target</div>
                    <div className="f-display num" style={{ fontSize: 26, color: '#f3f0ff' }}>{b.target.toLocaleString()}</div>
                    <div className="f-mono" style={{ fontSize: 10, color: accent, marginTop: 2 }}>×{b.mult.toFixed(1)} multiplier</div>
                    <div className="f-mono" style={{ fontSize: 10, color: '#f5c451', marginTop: 6 }}>
                      ◇ +{b.reward} shards
                    </div>
                  </div>
                </div>
              </OrnateFrame>

              {cur && (
                <button
                  className="btn btn-primary mat-interactive"
                  onClick={() => dispatch({ type: 'START_BLIND' })}
                  style={{
                    position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 13, padding: '10px 18px',
                  }}>
                  Begin
                </button>
              )}
              {cleared && (
                <div style={{
                  position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 10, color: '#9577ff', fontFamily: 'JetBrains Mono, monospace',
                }}>
                  ✓ cleared
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 12, zIndex: 5,
      }}>
        <button
          className="btn btn-ghost mat-interactive"
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'forge' })}>
          ⚒ Forge
        </button>
        {!blinds[blindIdx]?.def.isBoss && (
          <button
            className="btn btn-ghost mat-interactive"
            onClick={() => dispatch({ type: 'SKIP_BLIND' })}>
            ↪ Skip (+{blinds[blindIdx]?.def.skipReward ?? 0} ◇)
          </button>
        )}
        <button
          className="btn btn-ghost mat-interactive"
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}>
          ← Title
        </button>
      </div>

      <div style={{
        position: 'absolute', right: 24, bottom: 24, display: 'flex', gap: 18, zIndex: 5,
        alignItems: 'flex-end', pointerEvents: 'auto',
      }}>
        <PortalGate size={96} label="Travel" />
        {(typeof window !== 'undefined' && window.Portal?.readPortalParams().ref) && (
          <PortalGate size={72} label="Return" refUrl={window.Portal.readPortalParams().ref!} />
        )}
      </div>
    </div>
  );
}
