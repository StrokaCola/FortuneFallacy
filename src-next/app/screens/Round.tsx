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
import { useRoundBundleReady } from '../perf/roundBundle';
import {
  selectHandsLeft, selectRerollsLeft,
  selectTarget, selectShards, selectAnte,
  selectCatalysts, selectMaxCatalystSlots, selectVouchers,
  selectAccent, selectConstellationAccent, selectEffectiveCatalystSlotsUsed,
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
  // Inter-hand activity flags — used to lock the reroll button while
  // the score-pop animation is playing OR the dice physics is still
  // tumbling. Without this, a fast-clicker can fire REROLL_REQUESTED
  // during the scoring window, which silently eats a reroll because
  // the dice can't actually rebound until the prior hand settles.
  const scoring = useStore((s) => s.round.scoring);
  const handInProgress = useStore((s) => s.round.handInProgress);

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
  // Persistent constellation tint — passed to TopBar so the Astrolabe
  // keeps the run's chosen identity color even when `accent` flips to
  // crimson on boss blinds.
  const constellationAccent = useStore(selectConstellationAccent);
  // Round-time bundle readiness — gates the Roll button while the lazy
  // Three.js + Rapier chunks are still streaming in (see app/perf/roundBundle).
  const ready = useRoundBundleReady();

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
        constellationAccent={constellationAccent}
        tense={tense}
      />
      <PauseButton />

      <CatalystStrip />
      <LegendaryFire />
      <HotStreakBanner />
      <VoidstormBadge />
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

      <ActionBar
        hands={hands}
        rerolls={rerolls}
        accent={accent}
        firstRollDone={firstRollDone}
        ready={ready}
        scoring={scoring}
        handInProgress={handInProgress}
      />
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
const PULL_DURATION_MS = 440;

function ActionBar({
  hands, rerolls, accent, firstRollDone, ready, scoring, handInProgress,
}: {
  hands: number;
  rerolls: number;
  accent: string;
  firstRollDone: boolean;
  ready: boolean;
  scoring: boolean;
  handInProgress: boolean;
}) {
  // Self-measure so the dice canvas can shrink to the play area above
  // this bar (#three-next reads --hud-bottom-h) and pinned overlays can
  // align upward from the bar's top edge.
  const ref = useRef<HTMLDivElement>(null);
  useReportHudHeight(ref, '--hud-bottom-h', 'bottom');
  const [pulling, setPulling] = useState(false);
  const pullTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (pullTimerRef.current != null) {
      clearTimeout(pullTimerRef.current);
      pullTimerRef.current = null;
    }
  }, []);

  // Trigger The Pull on the first-roll path only. Reroll keeps the
  // immediate-dispatch behavior — players get the dwell once per blind,
  // not every reroll, so the rhythm of the loop stays brisk.
  const triggerFirstRoll = () => {
    if (pulling) return;
    playHaptic('tap');
    setPulling(true);
    sfxPlay('castSwell', { gain: 0.85 });
    pullTimerRef.current = window.setTimeout(() => {
      pullTimerRef.current = null;
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
          // Lock the reroll during scoring AND while the dice physics
          // is mid-tumble (handInProgress). A fast click during either
          // window used to fire REROLL_REQUESTED, silently consuming a
          // reroll because the dice couldn't rebound mid-animation.
          disabled={rerolls === 0 || hands === 0 || scoring || handInProgress || !ready}
          onClick={() => { playHaptic('tap'); dispatch({ type: 'REROLL_REQUESTED' }); }}
          title={scoring ? 'Scoring…' : handInProgress ? 'Rolling…' : undefined}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <RerollGlyph color={accent} /> Reroll
            <span className="f-mono" style={{ fontSize: 11, opacity: 0.7 }}>({rerolls})</span>
          </span>
        </button>
      ) : (
        <button
          data-coach="roll-btn"
          className={`btn btn-ghost mat-interactive tap${pulling ? ' is-pulling' : ''}`}
          disabled={hands === 0 || pulling || !ready}
          onClick={triggerFirstRoll}
          title={!ready ? 'Loading dice physics…' : undefined}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <RollGlyph color={accent} />
            {!ready ? 'Warming up…' : pulling ? 'Pulling…' : 'Roll'}
          </span>
        </button>
      )}
      <button
        className="btn btn-primary mat-interactive tap"
        disabled={hands === 0 || !firstRollDone || !ready}
        onClick={() => { playHaptic('tap'); dispatch({ type: 'SCORE_HAND' }); }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <PlayHandGlyph /> Play Hand
        </span>
      </button>
    </div>
  );
}

// Bespoke action-bar glyphs — replace the Unicode ↻ / ⤴ / ✦ with
// SVG primitives so each button has a distinct instrument-feel
// icon that picks up the constellation accent. Sized to match the
// surrounding text (16px tall), drop-shadow for cosmic glow.

function RollGlyph({ color }: { color: string }) {
  // Upward swooping arc with a star at the apex — "the lever pulls
  // and the chamber loads," then the dice fly.
  return (
    <svg width="18" height="18" viewBox="-12 -12 24 24" style={{ overflow: 'visible' }} aria-hidden="true">
      <path
        d="M -8 6 Q -2 -8 8 -6"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        style={{ filter: `drop-shadow(0 0 3px ${color}aa)` }}
      />
      <path
        d="M 0,-9 L 1.5,-3 L 7,-3 L 2.5,0.5 L 4,6 L 0,2.5 L -4,6 L -2.5,0.5 L -7,-3 L -1.5,-3 Z"
        fill={color}
        transform="scale(0.55) translate(14, -10)"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}

function RerollGlyph({ color }: { color: string }) {
  // Orbital arrow — three-quarters of a circle with a small chevron
  // at the tail. Reads as "loop back" without being a generic refresh
  // icon.
  return (
    <svg width="16" height="16" viewBox="-10 -10 20 20" style={{ overflow: 'visible' }} aria-hidden="true">
      <path
        d="M 6 -3 A 7 7 0 1 1 -3 -6"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        style={{ filter: `drop-shadow(0 0 3px ${color}aa)` }}
      />
      <path
        d="M -3 -6 L -6 -3 L -3 -1"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function PlayHandGlyph() {
  // 5-point star with a soft gold outline. The play-hand button is
  // already gold (btn-primary), so the star sits in white-cream so
  // it reads cleanly without competing with the gradient.
  return (
    <svg width="16" height="16" viewBox="-10 -10 20 20" style={{ overflow: 'visible' }} aria-hidden="true">
      <path
        d="M 0,-9 L 2.6,-3 L 9,-3 L 3.8,0.8 L 5.8,7 L 0,3 L -5.8,7 L -3.8,0.8 L -9,-3 L -2.6,-3 Z"
        fill="#fff7e0"
        style={{ filter: 'drop-shadow(0 0 3px rgba(255, 247, 224, 0.8))' }}
      />
    </svg>
  );
}
