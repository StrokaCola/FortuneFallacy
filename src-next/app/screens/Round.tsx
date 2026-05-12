import { useEffect, useRef, useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore } from '../../state/store';
import { sfxPlay } from '../../audio/sfx';
import { playHaptic } from '../haptics/haptics';
import { TopBar } from '../hud/TopBar';
import { useReportHudHeight } from '../hud/useReportHudHeight';
import { PauseButton } from '../hud/PauseButton';
import { CatalystStrip } from '../hud/CatalystStrip';
import { LegendaryFire } from '../hud/LegendaryFire';
import { HotStreakBanner } from '../hud/HotStreakBanner';
import { VoidstormBadge } from '../hud/VoidstormBadge';
import { BossDebuffBadge } from '../hud/BossDebuffBadge';
import { PatternDetectedBanner } from '../hud/PatternDetectedBanner';
import { ShardDeductToast } from '../hud/ShardDeductToast';
import { ShardGainToast } from '../hud/ShardGainToast';
import { ClearShardsToast } from '../hud/ClearShardsToast';
import { ConsumableTray } from '../hud/ConsumableTray';
import { DiceStackStrip } from '../hud/DiceStackStrip';
import { FaceReadout } from '../hud/FaceReadout';
import { DieTip } from '../hud/DieTip';
import { ScoreMoment } from '../hud/ScoreMoment';
import { ScoringVFX } from '../hud/ScoringVFX';
import '../hud/ScoringVFX.css';
import { ScoreBreakdown } from '../hud/ScoreBreakdown';
import { ScoreExplain } from '../hud/ScoreExplain';
import { AstralHint } from '../hud/AstralHint';
import { RoundDebugOverlay } from '../hud/RoundDebugOverlay';
import { useScoreDisplay } from '../hud/useScoreDisplay';
import {
  selectHandsLeft, selectRerollsLeft,
  selectTarget, selectShards, selectAnte,
  selectCatalysts, selectMaxCatalystSlots, selectVouchers,
  selectAccent, selectEffectiveCatalystSlotsUsed,
} from '../../state/selectors';
import { BLIND_DEFS } from '../../data/blinds';

export function Round() {
  const hands    = useStore(selectHandsLeft);
  const rerolls  = useStore(selectRerollsLeft);
  const score    = useScoreDisplay();
  const target   = useStore(selectTarget);
  const shards   = useStore(selectShards);
  const ante     = useStore(selectAnte);
  const catalysts = useStore(selectCatalysts);
  const maxCatalysts = useStore(selectMaxCatalystSlots);
  const usedCatalystSlots = useStore(selectEffectiveCatalystSlotsUsed);
  const vouchers = useStore(selectVouchers);
  const blindIndex = useStore((s) => s.round.blindIndex);
  const firstRollDone = useStore((s) => s.round.firstRollDone);
  const roundActive = useStore((s) => s.round.active);

  // Last-throw warning: when only 1 hand remains and the player is short
  // of the target, the score readout pulses red and a one-shot haptic
  // fires on entry. Tightens the closer dramatically without forcing
  // the player into the fail-loop music yet — the bust hasn't actually
  // happened. Tracks edges so the haptic only triggers ONCE per entry.
  const tense = roundActive && firstRollDone && hands === 1 && score < target && target > 0;
  const wasTenseRef = useRef(false);
  useEffect(() => {
    if (tense && !wasTenseRef.current) {
      playHaptic('tap');
      sfxPlay('targetCross', { gain: 0.35 });
    }
    wasTenseRef.current = tense;
  }, [tense]);
  // Constellation accent (red on boss). See selectAccent in state/selectors.ts.
  const accent = useStore(selectAccent);

  const blindName = BLIND_DEFS.find((b) => b.index === blindIndex)?.name ?? 'Trial';

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <ScoringVFX />
      <TopBar
        ante={ante}
        blind={blindName}
        shards={shards}
        hands={hands}
        rerolls={rerolls}
        target={target}
        score={score}
        catalystSlots={{ used: usedCatalystSlots, max: maxCatalysts }}
        voucherCount={vouchers.length}
        vouchers={vouchers}
        accent={accent}
        tense={tense}
      />
      <PauseButton />

      <CatalystStrip />
      <LegendaryFire />
      <HotStreakBanner />
      <VoidstormBadge />
      <BossDebuffBadge />
      <PatternDetectedBanner />
      <ShardDeductToast />
      <ShardGainToast />
      <ClearShardsToast />
      <ConsumableTray />
      <DiceStackStrip />

      <FaceReadout />
      <DieTip />
      <ScoreBreakdown />
      <ScoreMoment />
      <AstralHint />
      <ScoreExplain />

      <ActionBar hands={hands} rerolls={rerolls} accent={accent} firstRollDone={firstRollDone} />
      {/* Invisible anchor for the post-first-roll "tap to lock" coachmark.
          Sits roughly where the dice settle so the bubble points at them
          rather than at the entire stage canvas. See app/onboarding/. */}
      <div
        data-coach="dice-tray"
        aria-hidden
        style={{
          position: 'absolute', left: '50%', top: 'calc(var(--hud-top-h, 134px) + (var(--stage-h, 100vh) - var(--hud-top-h, 0px) - var(--hud-bottom-h, 0px)) * 0.6)',
          width: 1, height: 1, transform: 'translateX(-50%)', pointerEvents: 'none',
        }}
      />
      <RoundDebugOverlay />
    </div>
  );
}

// "The Pull" — first-roll-of-blind dwell time. Lets the audio swell and
// the player's anticipation set BEFORE the dice fly. Slot-machine
// cabinet language: the lever pulls, the chamber loads, then the spin.
// Tuned so the dwell is felt but not annoying — short enough that a
// determined speedrunner will barely notice on subsequent attempts.
const PULL_DURATION_MS = 520;

function ActionBar({ hands, rerolls, accent, firstRollDone }: { hands: number; rerolls: number; accent: string; firstRollDone: boolean }) {
  // Self-measure so the dice canvas can shrink to the play area above
  // this bar (#three-next reads --hud-bottom-h) and pinned overlays can
  // align upward from the bar's top edge.
  const ref = useRef<HTMLDivElement>(null);
  useReportHudHeight(ref, '--hud-bottom-h', 'bottom');
  const [pulling, setPulling] = useState(false);

  // Trigger The Pull on the first-roll path only. Reroll keeps the
  // immediate-dispatch behavior — players get the dwell once per blind,
  // not every reroll, so the rhythm of the loop stays brisk.
  const triggerFirstRoll = () => {
    if (pulling) return;
    setPulling(true);
    sfxPlay('castSwell', { gain: 0.85 });
    window.setTimeout(() => {
      dispatch({ type: 'ROLL_REQUESTED' });
      setPulling(false);
    }, PULL_DURATION_MS);
  };

  return (
    <div
      ref={ref}
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
          data-coach="roll-btn"
          className={`btn btn-ghost mat-interactive tap${pulling ? ' is-pulling' : ''}`}
          disabled={hands === 0 || pulling}
          onClick={triggerFirstRoll}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: accent }}>⤴</span> {pulling ? 'Pulling…' : 'Roll'}
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
