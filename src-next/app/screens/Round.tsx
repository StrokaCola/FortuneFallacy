import { dispatch } from '../../actions/dispatch';
import { useStore } from '../../state/store';
import { TopBar } from '../hud/TopBar';
import { PauseButton } from '../hud/PauseButton';
import { CatalystStrip } from '../hud/CatalystStrip';
import { ShardDeductToast } from '../hud/ShardDeductToast';
import { ShardGainToast } from '../hud/ShardGainToast';
import { ClearShardsToast } from '../hud/ClearShardsToast';
import { ConsumableTray } from '../hud/ConsumableTray';
import { ComboBanner } from '../hud/ComboBanner';
import { FaceReadout } from '../hud/FaceReadout';
import { ScoreMoment } from '../hud/ScoreMoment';
import { ScoreBreakdown } from '../hud/ScoreBreakdown';
import { ScoreExplain } from '../hud/ScoreExplain';
import { AstralHint } from '../hud/AstralHint';
import { useScoreDisplay } from '../hud/useScoreDisplay';
import {
  selectHandsLeft, selectRerollsLeft, selectIsBoss,
  selectTarget, selectShards, selectAnte,
  selectCatalysts, selectMaxCatalystSlots, selectVouchers,
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
  const catalysts = useStore(selectCatalysts);
  const maxCatalysts = useStore(selectMaxCatalystSlots);
  const vouchers = useStore(selectVouchers);
  const blindIndex = useStore((s) => s.round.blindIndex);
  const firstRollDone = useStore((s) => s.round.firstRollDone);
  const accent = isBoss ? '#e2334a' : '#7be3ff';

  const blindName = BLIND_DEFS.find((b) => b.index === blindIndex)?.name ?? 'Trial';

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
        catalystSlots={{ used: catalysts.length, max: maxCatalysts }}
        voucherCount={vouchers.length}
        vouchers={vouchers}
        accent={accent}
      />
      <PauseButton />

      <CatalystStrip />
      <ShardDeductToast />
      <ShardGainToast />
      <ClearShardsToast />
      <ConsumableTray />

      <ComboBanner accent={accent} />
      <FaceReadout />
      <ScoreBreakdown />
      <ScoreMoment />
      <AstralHint />
      <ScoreExplain />

      <ActionBar hands={hands} rerolls={rerolls} accent={accent} firstRollDone={firstRollDone} />
    </div>
  );
}

function ActionBar({ hands, rerolls, accent, firstRollDone }: { hands: number; rerolls: number; accent: string; firstRollDone: boolean }) {
  return (
    <div
      style={{
        position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 16, zIndex: 5, pointerEvents: 'auto',
      }}>
      {firstRollDone ? (
        <button
          className="btn btn-ghost mat-interactive tap"
          disabled={rerolls === 0 || hands === 0}
          onClick={() => dispatch({ type: 'REROLL_REQUESTED' })}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: accent }}>↻</span> Reroll
            <span className="f-mono" style={{ fontSize: 11, opacity: 0.7 }}>({rerolls})</span>
          </span>
        </button>
      ) : (
        <button
          className="btn btn-ghost mat-interactive tap"
          disabled={hands === 0}
          onClick={() => dispatch({ type: 'ROLL_REQUESTED' })}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: accent }}>⤴</span> Roll
          </span>
        </button>
      )}
      <button
        className="btn btn-primary mat-interactive tap"
        disabled={hands === 0 || !firstRollDone}
        onClick={() => dispatch({ type: 'SCORE_HAND' })}>
        ✦ Play Hand
      </button>
    </div>
  );
}
