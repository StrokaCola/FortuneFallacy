import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { selectAnte, selectGoalIdx, selectShards, selectOracles, selectVouchers } from '../../state/selectors';
import { BLIND_DEFS, BOSS_BLINDS, targetForBlind } from '../../data/blinds';
import { TopBar } from '../hud/TopBar';
import { OrnateFrame } from '../visual/OrnateFrame';

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

  const accent = '#7be3ff';
  const blindIdx = goalIdx % 3;

  const blinds = BLIND_DEFS.map((def, i) => {
    const cleared = i < blindIdx;
    const current = i === blindIdx;
    return {
      def,
      cleared,
      current,
      target: targetForBlind(ante, i),
      sigil: SIGILS_BY_BLIND[i] ?? '✦',
    };
  });

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
      <TopBar
        ante={ante}
        blind="Hub"
        shards={shards}
        hands={handsLeft}
        rerolls={rerollsLeft}
        target={0}
        score={0}
        oracleSlots={{ used: oracles.length, max: 6 }}
        voucherCount={vouchers.length}
        accent={accent}
      />

      <div style={{ position: 'absolute', left: '50%', top: 200, transform: 'translateX(-50%)', textAlign: 'center', zIndex: 4 }}>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
          ◇ choose your trial ◇
        </div>
        <div className="f-display" style={{ fontSize: 36, color: '#f3f0ff', marginTop: 8 }}>
          The Tribunal of Stars
        </div>
        <div style={{ fontSize: 13, color: '#bba8ff', marginTop: 6, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
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
          const bossDef = isBoss ? BOSS_BLINDS[0] : null;
          const tintColor = cur ? accent : isBoss ? 'rgba(226,51,74,0.6)' : 'rgba(245,196,81,0.4)';
          const sigilColor = isBoss ? '#e2334a' : cur ? accent : '#9577ff';
          return (
            <div
              key={i}
              className="panel-strong"
              style={{
                width: 240, height: 320, padding: 20,
                border: cur
                  ? `2px solid ${accent}`
                  : isBoss
                  ? '1px solid rgba(226,51,74,0.5)'
                  : '1px solid rgba(149,119,255,0.3)',
                boxShadow: cur
                  ? `0 0 30px ${accent}55`
                  : isBoss
                  ? '0 0 24px rgba(226,51,74,0.3)'
                  : '0 8px 24px rgba(0,0,0,0.4)',
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                opacity: cleared ? 0.5 : 1,
              }}>
              <OrnateFrame style={{ width: '100%', height: '100%' }} color={tintColor}>
                <div style={{ position: 'absolute', inset: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.3em', color: cur ? accent : '#bba8ff' }}>
                    blind {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="f-display" style={{ fontSize: 22, color: '#f3f0ff', marginTop: 6 }}>{b.def.name}</div>
                  <div style={{
                    fontSize: 64, marginTop: 14, color: sigilColor,
                    filter: `drop-shadow(0 0 14px ${sigilColor}80)`,
                  }}>{b.sigil}</div>

                  <div style={{ marginTop: 'auto', textAlign: 'center', width: '100%' }}>
                    <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.2em', color: '#bba8ff' }}>target</div>
                    <div className="f-display num" style={{ fontSize: 26, color: '#f3f0ff' }}>{b.target.toLocaleString()}</div>
                    <div className="f-mono" style={{ fontSize: 10, color: accent, marginTop: 2 }}>×{b.def.targetMult.toFixed(1)} multiplier</div>
                    <div className="f-mono" style={{ fontSize: 10, color: '#f5c451', marginTop: 6 }}>
                      ◇ +{isBoss ? 8 : 5} shards
                    </div>
                  </div>
                </div>
              </OrnateFrame>

              {cur && (
                <button
                  className="btn btn-primary"
                  style={{ position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 13, padding: '10px 18px' }}
                  onClick={() => dispatch({ type: 'START_BLIND' })}>
                  Begin
                </button>
              )}
              {cleared && (
                <div style={{
                  position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 10, color: '#9577ff', fontFamily: 'JetBrains Mono',
                }}>✓ cleared</div>
              )}
              {!cur && !cleared && bossDef && (
                <div style={{
                  position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 10, color: '#e2334a', fontFamily: 'JetBrains Mono', whiteSpace: 'nowrap',
                }}>locked</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12 }}>
        <button className="btn btn-ghost" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'forge' })}>⚒ Forge</button>
        {!blinds[blindIdx]?.def.isBoss && (
          <button className="btn btn-ghost" onClick={() => dispatch({ type: 'SKIP_BLIND' })}>
            ↪ Skip (+{blinds[blindIdx]?.def.skipReward ?? 0} ◇)
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}>← Title</button>
      </div>
    </div>
  );
}
