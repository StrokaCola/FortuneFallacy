import { useEffect, useRef } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore } from '../../state/store';
import { TopBar } from '../hud/TopBar';
import { OracleStrip } from '../hud/OracleStrip';
import { ConsumableTray } from '../hud/ConsumableTray';
import { ComboBanner } from '../hud/ComboBanner';
import { ConstellationOverlay } from '../hud/ConstellationOverlay';
import { ScoreMoment } from '../hud/ScoreMoment';
import { ScoreBreakdown } from '../hud/ScoreBreakdown';
import { AstralHint } from '../hud/AstralHint';
import { useScoreDisplay } from '../hud/useScoreDisplay';
import { TrayBase } from '../visual/TrayBase';
import {
  selectHandsLeft, selectRerollsLeft, selectIsBoss,
  selectTarget, selectShards, selectAnte,
  selectOracles, selectVouchers, selectBlindId,
} from '../../state/selectors';
import { BLIND_DEFS } from '../../data/blinds';

export function Round() {
  const hands    = useStore(selectHandsLeft);
  const rerolls  = useStore(selectRerollsLeft);
  const isBoss   = useStore(selectIsBoss);
  const score    = useScoreDisplay();
  const target   = useStore(selectTarget);
  const shards   = useStore(selectShards);
  const ante     = useStore(selectAnte);
  const oracles  = useStore(selectOracles);
  const vouchers = useStore(selectVouchers);
  const blindId  = useStore(selectBlindId);
  const accent = isBoss ? '#e2334a' : '#7be3ff';

  const blindName = BLIND_DEFS.find((b) => b.index === blindId)?.name ?? 'Blind';

  // Auto-roll when handsLeft changes (existing behavior)
  const lastHandsRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastHandsRef.current !== hands && hands > 0) {
      lastHandsRef.current = hands;
      dispatch({ type: 'ROLL_REQUESTED' });
    }
  }, [hands]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <TrayBase />
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
      <ScoreBreakdown />
      <ConstellationOverlay />
      <ScoreMoment />
      <AstralHint />

      <ActionBar hands={hands} rerolls={rerolls} accent={accent} />
    </div>
  );
}

function ActionBar({ hands, rerolls, accent }: { hands: number; rerolls: number; accent: string }) {
  return (
    <div
      style={{
        position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 12, zIndex: 5, pointerEvents: 'auto',
      }}>
      <button
        className="btn btn-ghost mat-interactive"
        disabled={rerolls === 0 || hands === 0}
        onClick={() => dispatch({ type: 'REROLL_REQUESTED' })}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: accent }}>↻</span> Reroll
          <span className="f-mono" style={{ fontSize: 11, opacity: 0.7 }}>({rerolls})</span>
        </span>
      </button>
      <button
        className="btn btn-primary mat-interactive"
        disabled={hands === 0}
        onClick={() => dispatch({ type: 'SCORE_HAND' })}>
        ✦ Cast Hand
      </button>
    </div>
  );
}
