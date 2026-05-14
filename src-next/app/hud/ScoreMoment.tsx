import { useEffect, useRef } from 'react';
import { bus } from '../../events/bus';
import { dispatch } from '../../actions/dispatch';
import type { Beat } from '../../core/scoring/types';
import { store } from '../../state/store';
import { scoringVFX } from './ScoringVFX';
import { lookupConstellation } from '../../data/constellations';

// ScoreMoment is a pure scoring-beat controller — slam / target-beat / bail /
// boom visuals are rendered by ScoringVFX. This component owns:
//   - the bus listener that turns Beat events into scoringVFX.fire* calls,
//   - the mega-boom hit-stop CSS class on #stage-root (the SCORING_VFX_HANDOFF
//     screen-level chromatic aberration is applied to the VFX overlay only;
//     mega-boom adds an extra freeze to the whole stage),
//   - the END_SCORING dispatch that advances the round, timed to land
//     after the boom celebration / bail stamp completes.

// BoomNumber phases (must match ScoringVFX.tsx):
//   pop+hold: 1700ms, fly: 800ms → catch pulse fires at ~2350ms,
//   round advances right after.
const BOOM_FLY_START_MS = 1700;
const BOOM_FLY_MS = 800;
const BAIL_HOLD_MS = 2400;
// Star-trail timing (must match `vfx-star-fly` keyframe in
// ScoringVFX.css). Trails emit when BoomNumber switches to 'fly'
// (BOOM_FLY_START_MS) and each takes STAR_TRAIL_MS to reach the
// counter. We start the counter fill when the FIRST star arrives so
// the meter visibly fills as the trails land on it — the user-facing
// fix for the old behavior where the counter caught ~500ms before
// the trails got there.
const STAR_TRAIL_MS = 820;
const COUNTER_FILL_MS = 360;

function isReducedMotion(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('reduce-motion');
}

// Read viewport-relative pixel positions for the locked (scoring)
// dice. Dice3D is instantiated lazily in app/perf/roundBundle.ts and
// stashed on `window.__dice3d` for cross-module reads (the long-press
// DieTip uses the same pattern). Returns [] if the bundle isn't
// loaded yet, the canvas isn't visible, or no dice are locked.
function readScoringDiePositions(): Array<{ x: number; y: number }> {
  if (typeof window === 'undefined') return [];
  const d3 = (window as unknown as { __dice3d?: { getScoringDieScreenPositions: () => Array<{ x: number; y: number }> } }).__dice3d;
  if (!d3 || typeof d3.getScoringDieScreenPositions !== 'function') return [];
  try { return d3.getScoringDieScreenPositions(); } catch { return []; }
}

function slamColor(crossed: boolean, tint?: 'gold' | 'magenta'): string {
  if (tint === 'magenta') return '#ff52c8';
  if (tint === 'gold' || crossed) return '#f5c451';
  return '#7be3ff';
}

export function ScoreMoment() {
  const timerIdsRef = useRef<number[]>([]);

  useEffect(() => {
    let crossed = false;

    const clearAllTimers = () => {
      for (const id of timerIdsRef.current) clearTimeout(id);
      timerIdsRef.current = [];
    };
    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        timerIdsRef.current = timerIdsRef.current.filter((t) => t !== id);
        fn();
      }, ms);
      timerIdsRef.current.push(id);
    };

    const finishBoom = () => {
      // 2026-05-14 revision: the counter catch-pulse + value tween are
      // now owned by TopBar (driven by the onScoreCounterFill bus event
      // scheduled below). finishBoom is just the round-advance hand-off.
      dispatch({ type: 'END_SCORING' });
    };

    const off = bus.on('onScoreBeat', ({ beat }: { beat: Beat }) => {
      switch (beat.kind) {
        case 'cast-swell': {
          clearAllTimers();
          crossed = false;
          // Conductive arcs — fires at the START of scoring when 3+
          // dice will score. Pulls die positions from the dice canvas
          // via the data-die-rect dataset (set by Dice3D's onScoreBeat
          // listener — see below). Skips silently when fewer than 3
          // positions are available so short hands don't get the
          // "constellation conducting" flourish for a 1-die nudge.
          const positions = readScoringDiePositions();
          if (positions.length >= 3) {
            const constellationId = store.getState().run.constellationId;
            const constellation = lookupConstellation(constellationId);
            scoringVFX.fireConductiveArcs(positions, constellation.color);
          }
          break;
        }
        case 'combo-bonus':
          // The combo's chip/mult deltas already light up ScoreBreakdown;
          // a separate named-constellation label here is noise.
          break;
        case 'mult-slam': {
          const color = slamColor(crossed, beat.tint);
          // Handoff: shake-sm for ×2–4, shake-md for ×6+. Only meaningful
          // slams shake (existing rule preserved: low mults stay silent).
          const shake = beat.multiplier >= 6 || crossed
            ? 'md'
            : beat.multiplier >= 4
              ? 'sm'
              : null;
          scoringVFX.fireSlam(beat.label, color, shake ?? 'sm');
          break;
        }
        case 'cross-target': {
          crossed = true;
          // Target Beat already orchestrates godrays + vignette + flash +
          // time-dilation + medium shake inside ScoringVFX.
          scoringVFX.fireTargetBeat();
          // Constellation seal — replaces the generic gold TARGET BEAT
          // stamp with the run's active constellation glyph. Reuses
          // the same point array the picker uses, so the stamp reads
          // as the run's identity confirming the cross.
          const constellationId = store.getState().run.constellationId;
          const constellation = lookupConstellation(constellationId);
          scoringVFX.fireConstellationSeal(
            constellation.glyph,
            constellation.color,
            constellation.name,
          );
          // Crystalline edge catch — pulse every die's accent edge so
          // the dice themselves acknowledge the moment. Bus-driven so
          // Dice3D handles the actual material animation; this is just
          // a notification.
          bus.emit('onCrystallineEdgeCatch', { color: constellation.color });
          break;
        }
        case 'boom': {
          const gold = beat.crossedTarget;
          const ratio = beat.megaRatio ?? 0;
          const variant: 'normal' | 'gold' | 'mega' =
            ratio >= 3 ? 'mega' : gold ? 'gold' : 'normal';

          // New-best detection — updateRunStats has already mutated peakHand
          // by the time boom fires; this hand is the best when peak equals
          // its total. Pass the flag so BoomNumber renders the NEW BEST stamp
          // (per handoff: shown on mega; we additionally show on any new
          // peak so the existing celebration still fires).
          const peakHandNow = store.getState().run.runStats?.peakHand ?? 0;
          const isNewBest = peakHandNow > 0 && peakHandNow === beat.finalTotal;

          scoringVFX.fireBoom(variant, beat.finalTotal, isNewBest);

          // Star-cluster ripple — fires on every boom (gold and mega
          // get the brighter 'mega' tier). Washes the cosmos starfield
          // with three (or four) screen-blend rings so the boom reads
          // as "the cosmos noticed" rather than a centered burst.
          scoringVFX.fireStarRipple(variant === 'mega' ? 'mega' : 'normal');

          // Meteor shower — only on mega booms. Constellation accent
          // for the streaks; count scales with megaRatio so a 6×
          // crush gets more streaks than a 3×. Rendered in the cosmos
          // background via CosmosBackground.MeteorShowerLayer so the
          // streaks read as actual shooting stars in the game's sky
          // (not a foreground overlay across the play area).
          if (variant === 'mega') {
            const constellation = lookupConstellation(
              store.getState().run.constellationId,
            );
            const streakCount = Math.max(3, Math.min(7, Math.round(2 + ratio)));
            bus.emit('onMeteorShowerTriggered', {
              accent: constellation.color,
              count: streakCount,
            });
          }

          // Mega-boom hit-stop on #stage-root (separate from ScoringVFX's
          // own chromatic-aberration layer). Reduced-motion users skip.
          const reduced = isReducedMotion();
          if (ratio >= 3 && !reduced) {
            const stage = document.getElementById('stage-root');
            if (stage) {
              const tier = ratio >= 8 ? 'mega-boom-deep' : 'mega-boom';
              stage.classList.add(tier);
              const dur = ratio >= 8 ? 720 : 480;
              schedule(() => stage.classList.remove(tier), dur);
            }
          }

          // END_SCORING right as the boom number lands at the counter
          // (the round can advance immediately; visual catch is owned
          // by TopBar via the onScoreCounterFill event below).
          schedule(finishBoom, BOOM_FLY_START_MS + BOOM_FLY_MS - 150);
          // Counter fill — fire exactly when the first star trail
          // reaches the counter. TopBar tweens its displayed total
          // from the pre-boom value to the new round.score over
          // COUNTER_FILL_MS so the meter visually fills under the
          // trailing stars instead of catching ahead of them.
          schedule(
            () => bus.emit('onScoreCounterFill', { durationMs: COUNTER_FILL_MS }),
            BOOM_FLY_START_MS + STAR_TRAIL_MS,
          );
          break;
        }
        case 'bail':
          scoringVFX.fireBail();
          schedule(() => {
            dispatch({ type: 'END_SCORING' });
          }, BAIL_HOLD_MS);
          break;
      }
    });
    return () => {
      off();
      clearAllTimers();
    };
  }, []);

  return null;
}
