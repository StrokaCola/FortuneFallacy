import { useEffect, useRef } from 'react';
import { bus } from '../../events/bus';
import { dispatch } from '../../actions/dispatch';
import { triggerShake } from '../visual/screenShake';
import type { Beat } from '../../core/scoring/types';
import { store } from '../../state/store';
import { scoringVFX } from './ScoringVFX';

// ScoreMoment is now a pure scoring-beat controller — slam / target-beat /
// bail / boom visuals are rendered by ScoringVFX, so this component no
// longer paints anything. It still owns:
//   - the bus listener that turns Beat events into scoringVFX triggers,
//   - the real screen-shake (triggerShake) and mega-boom CSS class on
//     #stage-root (ScoringVFX.shakeScreen + .chromatic don't carry the
//     same visual punch),
//   - the END_SCORING dispatch that advances the round, timed to land
//     after the boom celebration / bail stamp completes.

const HOLD_GOLD_MS = 1500;
const HOLD_BASE_MS = 1400;
const FLY_MS = 800;

function isReducedMotion(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('reduce-motion');
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
      // Fire the catch pulse on the score counter, then end scoring.
      const counter = document.querySelector<HTMLElement>('[data-score-counter]');
      if (counter) {
        counter.style.animation = 'scoreCounterCatch 220ms cubic-bezier(0.2, 1.6, 0.4, 1)';
        schedule(() => {
          if (counter) counter.style.animation = '';
        }, 240);
      }
      dispatch({ type: 'END_SCORING' });
    };

    const off = bus.on('onScoreBeat', ({ beat }: { beat: Beat }) => {
      switch (beat.kind) {
        case 'cast-swell':
          clearAllTimers();
          crossed = false;
          break;
        case 'combo-bonus':
          // The combo's chip/mult deltas already light up ScoreBreakdown;
          // a separate named-constellation label here is noise.
          break;
        case 'mult-slam':
          scoringVFX.triggerSlam(beat.label, beat.multiplier, crossed, beat.tint);
          // Bigger mults punch harder. Threshold tuned so common pair-mults
          // don't shake; only meaningful x4+ slams or post-cross slams do.
          if (beat.multiplier >= 4 || crossed) {
            triggerShake('tiny');
            scoringVFX.shakeScreen('tiny');
          }
          break;
        case 'cross-target':
          crossed = true;
          scoringVFX.triggerTargetBeat();
          scoringVFX.triggerCrossTargetCascade();
          triggerShake('mid');
          scoringVFX.shakeScreen('mid');
          break;
        case 'boom': {
          const gold = beat.crossedTarget;
          if (gold) {
            triggerShake('big');
            scoringVFX.shakeScreen('big');
          }
          const reduced = isReducedMotion();
          // Mega-boom hit-stop: when the final score is ≥ 3× the target,
          // freeze the stage with chromatic aberration for ~480ms so the
          // big number actually LANDS. Above 8× we extend to 720ms.
          // Reduced-motion users skip — the effect is purely cosmetic.
          const ratio = beat.megaRatio ?? 0;
          if (ratio >= 3 && !reduced) {
            const stage = document.getElementById('stage-root');
            if (stage) {
              const tier = ratio >= 8 ? 'mega-boom-deep' : 'mega-boom';
              stage.classList.add(tier);
              const dur = ratio >= 8 ? 720 : 480;
              schedule(() => stage.classList.remove(tier), dur);
            }
            scoringVFX.chromatic(ratio >= 8 ? 720 : 480);
          }
          // New-best detection — updateRunStats has already mutated
          // peakHand by the time boom fires, so we check whether the
          // current peak EQUALS this hand's total. If so, this hand
          // IS the run's best (possibly tied with a prior identical
          // hand — the celebration still fires, which is fine since
          // matching your record is itself a moment).
          const peakHandNow = store.getState().run.runStats?.peakHand ?? 0;
          const isNewBest = peakHandNow > 0 && peakHandNow === beat.finalTotal;
          scoringVFX.triggerBoom(beat.finalTotal, gold, isNewBest, ratio > 0 ? ratio : 1);

          // ScoringVFX's BoomSequence runs pop (400ms) → hold → fly (800ms).
          // Schedule END_SCORING + counter catch-pulse to land at the end
          // of fly so the round doesn't advance while the boom is still
          // celebrating onscreen.
          const hold = gold ? HOLD_GOLD_MS : HOLD_BASE_MS;
          schedule(finishBoom, 400 + hold + FLY_MS);
          break;
        }
        case 'bail':
          scoringVFX.triggerBail();
          triggerShake('mid');
          scoringVFX.shakeScreen('mid');
          schedule(() => {
            dispatch({ type: 'END_SCORING' });
          }, 2400);
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
