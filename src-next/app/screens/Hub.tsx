import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { PortalGate } from '../portal/PortalGate';
import { TopBar } from '../hud/TopBar';
import { PauseButton } from '../hud/PauseButton';
import { OrnateFrame } from '../visual/OrnateFrame';
import { TierSigil } from '../visual/TierSigil';
import {
  selectAnte, selectGoalIdx, selectShards, selectCatalysts, selectMaxCatalystSlots, selectVouchers, selectScore, selectTarget,
} from '../../state/selectors';
import { BLIND_DEFS, TIER_SIGILS, targetForBlind } from '../../data/blinds';

const selectHandsLeft = (s: GameState) => s.round.handsLeft;
const selectRerollsLeft = (s: GameState) => s.round.rerollsLeft;

const CARD_W = 240;
const CARD_GAP = 26;

export function Hub() {
  const ante     = useStore(selectAnte);
  const goalIdx  = useStore(selectGoalIdx);
  const shards   = useStore(selectShards);
  const catalysts = useStore(selectCatalysts);
  const maxCatalysts = useStore(selectMaxCatalystSlots);
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
    locked: i > blindIdx,
    target: targetForBlind(ante, i),
    tierColor: TIER_SIGILS[i]?.color ?? '#9577ff',
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
        catalystSlots={{ used: catalysts.length, max: maxCatalysts }}
        voucherCount={vouchers.length}
        accent={accent}
      />
      <PauseButton />

      <div style={{
        position: 'absolute', left: '50%', top: 200, transform: 'translateX(-50%)',
        textAlign: 'center', zIndex: 4,
      }}>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
          ◇ choose your trial ◇
        </div>
        <div className="f-display" style={{ fontSize: 36, color: '#f3f0ff', marginTop: 8 }}>
          Tribunal of Stars
        </div>
        <div style={{ fontFamily: '"Exo 2", sans-serif', fontSize: 13, color: '#bba8ff', marginTop: 6, maxWidth: 460, marginInline: 'auto' }}>
          Three trials bar your ascension. Clear them for shards and admittance to the Bazaar.
        </div>
      </div>

      <ConstellationThread blinds={blinds} accent={accent} />

      <div style={{
        position: 'absolute', left: '50%', top: 360, transform: 'translateX(-50%)',
        display: 'flex', gap: CARD_GAP, zIndex: 4,
      }}>
        {blinds.map((b, i) => {
          const isBoss = b.def.isBoss;
          const cur = b.current;
          const cleared = b.cleared;
          const locked = b.locked;
          const frameColor = cur ? accent : isBoss ? 'rgba(226,51,74,0.6)' : 'rgba(245,196,81,0.4)';
          return (
            <div
              key={i}
              className="panel-strong"
              style={{
                width: CARD_W, height: 320, padding: 20, position: 'relative',
                border: cur ? `2px solid ${accent}` : (isBoss ? '1px solid rgba(226,51,74,0.5)' : '1px solid rgba(149,119,255,0.3)'),
                boxShadow: cur ? `0 0 30px ${accent}55` : (isBoss ? '0 0 24px rgba(226,51,74,0.3)' : '0 8px 24px rgba(0,0,0,0.4)'),
                opacity: cleared ? 0.55 : locked ? 0.78 : 1,
                filter: locked ? 'saturate(0.5)' : undefined,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                transition: 'opacity 200ms ease, filter 200ms ease',
              }}>
              <OrnateFrame style={{ width: '100%', height: '100%' }} color={frameColor}>
                <div style={{ position: 'absolute', inset: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="f-mono uc" style={{
                    fontSize: 9, letterSpacing: '0.3em',
                    color: cur ? accent : locked ? '#7a6fa6' : '#bba8ff',
                  }}>
                    trial {String(i + 1).padStart(2, '0')}
                  </div>
                  <div className="f-display" style={{
                    fontSize: 20, color: '#f3f0ff', marginTop: 6,
                    whiteSpace: 'nowrap', maxWidth: '100%',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    textAlign: 'center',
                  }}>
                    {b.def.name}
                  </div>
                  <div style={{
                    marginTop: 14, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {cleared
                      ? <ClearedNode color={b.tierColor} />
                      : <TierSigil tier={i} size={96} animate={cur ? 'idle' : 'none'} />}
                  </div>
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

type ThreadBlind = {
  cleared: boolean;
  current: boolean;
  locked: boolean;
  tierColor: string;
};

function ConstellationThread({ blinds, accent }: { blinds: ThreadBlind[]; accent: string }) {
  const totalW = blinds.length * CARD_W + (blinds.length - 1) * CARD_GAP;
  const centers = blinds.map((_, i) => i * (CARD_W + CARD_GAP) + CARD_W / 2);
  const cy = 16;
  const bandH = 32;

  const segmentColor = (a: ThreadBlind, b: ThreadBlind) => {
    if (a.cleared && b.cleared) return '#9577ff88';
    if (a.cleared && b.current) return accent;
    if (a.current && b.locked) return `${accent}66`;
    if (a.locked && b.locked) return '#bba8ff33';
    return `${accent}55`;
  };

  return (
    <svg
      width={totalW}
      height={bandH}
      style={{
        position: 'absolute', left: '50%', top: 322, transform: 'translateX(-50%)',
        zIndex: 3, pointerEvents: 'none', overflow: 'visible',
      }}
      aria-hidden="true">
      {centers.slice(0, -1).map((x, i) => (
        <line
          key={i}
          x1={x} y1={cy} x2={centers[i + 1]} y2={cy}
          stroke={segmentColor(blinds[i]!, blinds[i + 1]!)}
          strokeWidth={1.25}
          strokeDasharray="2 5"
          strokeLinecap="round"
        />
      ))}
      {centers.map((x, i) => {
        const b = blinds[i]!;
        const r = b.current ? 4 : b.cleared ? 3 : 2.5;
        const fill = b.current ? accent : b.cleared ? '#9577ff' : b.tierColor;
        const opacity = b.current ? 1 : b.cleared ? 0.9 : 0.6;
        return (
          <circle
            key={i}
            cx={x} cy={cy} r={r}
            fill={fill}
            opacity={opacity}
            style={b.current ? { filter: `drop-shadow(0 0 6px ${accent})` } : undefined}
          />
        );
      })}
    </svg>
  );
}

function ClearedNode({ color }: { color: string }) {
  return (
    <svg width={64} height={64} viewBox="0 0 64 64" aria-hidden="true" style={{ overflow: 'visible' }}>
      <circle cx="32" cy="32" r="20" fill="none" stroke={`${color}55`} strokeWidth="1" strokeDasharray="2 4" />
      <circle cx="32" cy="32" r="3.5" fill={color} opacity="0.85"
              style={{ filter: `drop-shadow(0 0 6px ${color}aa)` }} />
    </svg>
  );
}
