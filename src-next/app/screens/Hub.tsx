import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { selectAnte, selectGoalIdx, selectShards, selectOracles, selectVouchers } from '../../state/selectors';
import { BLIND_DEFS, BOSS_BLINDS, targetForBlind } from '../../data/blinds';
import { sfxPlay } from '../../audio/sfx';

const selectHandsLeft = (s: GameState) => s.round.handsLeft;
const selectRerollsLeft = (s: GameState) => s.round.rerollsLeft;

const SIGILS_BY_BLIND = ['☽', '☀', '⛧'];

type NodePos = { x: number; y: number }; // viewport-percent

function nodeLayout(ante: number): NodePos[] {
  // Deterministic per-ante geometry: ascending S-curve with mild jitter.
  const seed = ante * 73856093;
  const r = (k: number) => {
    const x = Math.sin(seed + k * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  return [
    { x: 22 + (r(1) - 0.5) * 6, y: 70 + (r(2) - 0.5) * 6 },
    { x: 50 + (r(3) - 0.5) * 8, y: 38 + (r(4) - 0.5) * 6 },
    { x: 78 + (r(5) - 0.5) * 6, y: 60 + (r(6) - 0.5) * 6 },
  ];
}

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
  const layout = nodeLayout(ante);

  const blinds = BLIND_DEFS.map((def, i) => {
    const cleared = i < blindIdx;
    const current = i === blindIdx;
    return {
      def,
      cleared,
      current,
      target: targetForBlind(ante, i),
      sigil: SIGILS_BY_BLIND[i] ?? '✦',
      pos: layout[i] ?? { x: 50, y: 50 },
    };
  });

  const currentBlind = blinds[blindIdx];

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
      {/* compact top bar */}
      <div className="mat-obsidian"
        style={{
          position: 'absolute', top: 18, left: 18,
          padding: '10px 14px', borderRadius: 10, zIndex: 5,
        }}>
        <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.28em', color: '#bba8ff' }}>
          Ante {String(ante).padStart(2, '0')} · Tribunal
        </div>
        <div className="f-mono" style={{ fontSize: 11, marginTop: 4, color: '#bba8ff' }}>
          hands {handsLeft} · rerolls {rerollsLeft}
        </div>
      </div>
      <div className="mat-obsidian"
        style={{
          position: 'absolute', top: 18, right: 18,
          padding: '10px 14px', borderRadius: 10, zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
        <span className="f-mono" style={{ color: '#f5c451', fontSize: 16 }}>◆ {shards}</span>
        <span className="f-mono" style={{ fontSize: 10, color: '#bba8ff' }}>oracles {oracles.length}/6</span>
        {vouchers.length > 0 && (
          <span className="f-mono" style={{ fontSize: 10, color: '#bba8ff' }}>vouchers {vouchers.length}</span>
        )}
      </div>

      <div style={{ position: 'absolute', left: '50%', top: 100, transform: 'translateX(-50%)', textAlign: 'center', zIndex: 4 }}>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
          ◇ ascend the chart ◇
        </div>
        <div className="f-display" style={{ fontSize: 30, color: '#f3f0ff', marginTop: 6 }}>
          The Tribunal of Stars
        </div>
      </div>

      {/* star chart */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 3,
        }}>
        {/* dashed lines connecting nodes, drawn left-to-right */}
        {[0, 1].map((i) => {
          const a = layout[i]!; const b = layout[i + 1]!;
          const cleared = i < blindIdx;
          return (
            <line key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={cleared ? '#9577ff' : '#7be3ff'}
              strokeWidth={0.18}
              strokeDasharray="1.5 2.5"
              opacity={cleared ? 0.4 : 0.7}
              style={{ animation: 'fadein 800ms ease-out' }} />
          );
        })}
      </svg>

      {/* nodes */}
      {blinds.map((b, i) => (
        <HubNode key={i} blind={b} accent={accent} />
      ))}

      {/* detail panel */}
      {currentBlind && (
        <div
          className="mat-obsidian"
          style={{
            position: 'absolute', left: '50%', bottom: 90, transform: 'translateX(-50%)',
            padding: '14px 22px', borderRadius: 12, minWidth: 320, textAlign: 'center', zIndex: 6,
            border: currentBlind.def.isBoss ? '1px solid rgba(226,51,74,0.5)' : '1px solid rgba(123,227,255,0.4)',
          }}>
          <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff' }}>
            {currentBlind.def.isBoss ? 'boss blind' : `blind ${blindIdx + 1}`}
          </div>
          <div className="f-display" style={{ fontSize: 22, color: '#f3f0ff', marginTop: 4 }}>
            {currentBlind.def.name}
          </div>
          <div className="f-mono" style={{ fontSize: 11, color: '#bba8ff', marginTop: 6 }}>
            target <span style={{ color: '#f3f0ff' }}>{currentBlind.target.toLocaleString()}</span>
            {' · '}reward <span style={{ color: '#f5c451' }}>◆ +{currentBlind.def.isBoss ? 8 : 5}</span>
          </div>
          <button
            className="btn btn-primary mat-interactive"
            style={{ marginTop: 10 }}
            onClick={() => dispatch({ type: 'START_BLIND' })}>
            ✦ Begin
          </button>
        </div>
      )}

      {/* footer */}
      <div style={{ position: 'absolute', bottom: 18, left: 18, display: 'flex', gap: 12, zIndex: 5 }}>
        <button className="btn btn-ghost mat-interactive" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'forge' })}>⚒ Forge</button>
        {!blinds[blindIdx]?.def.isBoss && (
          <button className="btn btn-ghost mat-interactive" onClick={() => dispatch({ type: 'SKIP_BLIND' })}>
            ↪ Skip (+{blinds[blindIdx]?.def.skipReward ?? 0} ◇)
          </button>
        )}
        <button className="btn btn-ghost mat-interactive" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}>← Title</button>
      </div>
    </div>
  );
}

function HubNode({ blind, accent }: {
  blind: { def: typeof BLIND_DEFS[number]; cleared: boolean; current: boolean; target: number; sigil: string; pos: NodePos };
  accent: string;
}) {
  const { cleared, current, sigil, pos, def } = blind;
  const isBoss = def.isBoss;
  const ringColor = cleared ? '#9577ff' : isBoss ? '#e2334a' : current ? accent : '#9577ff';
  const opacity = cleared ? 0.45 : 1;
  return (
    <div
      onMouseEnter={() => sfxPlay('nodePulse')}
      style={{
        position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)',
        width: 80, height: 80, display: 'grid', placeItems: 'center',
        opacity, zIndex: 4, pointerEvents: 'auto', cursor: current ? 'pointer' : 'default',
      }}>
      <div
        className="mat-obsidian"
        style={{
          width: 64, height: 64, borderRadius: '50%',
          display: 'grid', placeItems: 'center',
          border: `${current ? 2 : 1}px solid ${ringColor}`,
          boxShadow: current ? `0 0 24px ${ringColor}80` : isBoss ? `0 0 14px ${ringColor}50` : 'none',
          animation: current ? 'pulse-glow 1.6s ease-in-out infinite' : 'none',
        }}>
        <span style={{ fontSize: 28, color: ringColor, filter: `drop-shadow(0 0 6px ${ringColor})` }}>{sigil}</span>
      </div>
      <div className="f-mono uc" style={{
        position: 'absolute', bottom: -16,
        fontSize: 8, letterSpacing: '0.2em', color: '#bba8ff', whiteSpace: 'nowrap',
      }}>
        {cleared ? 'cleared' : current ? 'now' : isBoss ? 'boss' : ''}
      </div>
    </div>
  );
}
