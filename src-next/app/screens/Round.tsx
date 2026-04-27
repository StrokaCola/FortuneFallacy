import { useEffect, useRef } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { TopBar } from '../hud/TopBar';
import { OracleStrip } from '../hud/OracleStrip';
import { ComboBanner } from '../hud/ComboBanner';
import { ConsumableTray } from '../hud/ConsumableTray';
import { ConstellationOverlay } from '../hud/ConstellationOverlay';
import {
  selectScore, selectTarget, selectShards, selectAnte,
  selectHandsLeft, selectRerollsLeft, selectBlindId, selectIsBoss,
  selectOracles, selectVouchers,
} from '../../state/selectors';
import { BLIND_DEFS, BOSS_BLINDS } from '../../data/blinds';
import { activeDebuffs } from '../../core/round/debuffs';

const selectDebuffsKey = (s: GameState): string => [...activeDebuffs(s)].sort().join(',');

export function Round() {
  const score   = useStore(selectScore);
  const target  = useStore(selectTarget);
  const shards  = useStore(selectShards);
  const ante    = useStore(selectAnte);
  const hands   = useStore(selectHandsLeft);
  const rerolls = useStore(selectRerollsLeft);
  const blindId = useStore(selectBlindId);
  const isBoss  = useStore(selectIsBoss);
  const oracles = useStore(selectOracles);
  const vouchers = useStore(selectVouchers);
  const debuffs = useStore(selectDebuffsKey);

  const accent = isBoss ? '#e2334a' : '#7be3ff';
  const blindIdx = useStore((s) => s.round.blindIndex);
  const blindName = isBoss
    ? BOSS_BLINDS.find((b) => b.id === blindId)?.name ?? 'Boss'
    : BLIND_DEFS[blindIdx]?.name ?? 'Blind';

  const lastHandsRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastHandsRef.current !== hands && hands > 0) {
      lastHandsRef.current = hands;
      dispatch({ type: 'ROLL_REQUESTED' });
    }
  }, [hands]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <TopBar
        ante={ante}
        blind={blindName}
        shards={shards}
        hands={hands}
        rerolls={rerolls}
        target={target}
        score={score}
        oracleSlots={{ used: oracles.length, max: 6 }}
        voucherCount={vouchers.length}
        accent={accent}
      />
      <OracleStrip />
      <ConsumableTray />
      <ComboBanner accent={accent} />

      {debuffs && (
        <div style={{
          position: 'absolute', top: 240, left: '50%', transform: 'translateX(-50%)',
          padding: '4px 12px', borderRadius: 10,
          background: 'rgba(226,51,74,0.15)', border: '1px solid rgba(226,51,74,0.5)',
          color: '#ff8e9c', fontFamily: 'JetBrains Mono', fontSize: 10, letterSpacing: '0.18em',
          textTransform: 'uppercase', pointerEvents: 'none', zIndex: 4,
        }}>
          ⚠ {debuffs}
        </div>
      )}

      <DiceLockOverlay />
      <ConstellationOverlay />

      <div style={{
        position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)',
        display: 'flex', gap: 16, zIndex: 5, pointerEvents: 'auto',
      }}>
        <button
          className="btn btn-ghost"
          disabled={rerolls === 0 || hands === 0}
          onClick={() => dispatch({ type: 'REROLL_REQUESTED' })}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: accent }}>↻</span> Reroll
            <span className="f-mono" style={{ fontSize: 11, opacity: 0.7 }}>({rerolls})</span>
          </span>
        </button>
        <button
          className="btn btn-primary"
          disabled={hands === 0}
          onClick={() => dispatch({ type: 'SCORE_HAND' })}>
          ✦ Cast Hand
        </button>
      </div>
    </div>
  );
}

function DiceLockOverlay() {
  const dice = useStore((s) => s.round.dice);

  // approximate 3D scene tray bottom Y on viewport
  const trayY = window.innerHeight / 2 + 80;
  const startX = window.innerWidth / 2 - (dice.length - 1) * 70;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4 }}>
      {dice.map((d, i) => (
        <button
          key={i}
          onClick={() => dispatch({ type: 'TOGGLE_LOCK', dieIdx: i })}
          className="f-mono uc"
          style={{
            position: 'absolute',
            left: startX + i * 140 - 32,
            top: trayY,
            width: 64, padding: '4px 0', textAlign: 'center',
            fontSize: 9, letterSpacing: '0.2em', borderRadius: 6,
            background: d.locked ? 'rgba(123,227,255,0.18)' : 'rgba(28,18,69,0.6)',
            border: `1px solid ${d.locked ? '#7be3ff' : 'rgba(149,119,255,0.3)'}`,
            color: d.locked ? '#7be3ff' : '#bba8ff',
            cursor: 'pointer', pointerEvents: 'auto',
          }}>
          {d.locked ? '◆ locked' : 'lock'}
        </button>
      ))}
    </div>
  );
}
