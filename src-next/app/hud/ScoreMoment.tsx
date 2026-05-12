import { useEffect, useRef } from 'react';
import { bus } from '../../events/bus';
import { dispatch } from '../../actions/dispatch';
import type { Beat } from '../../core/scoring/types';
import { store } from '../../state/store';
import { scoringVFX } from './ScoringVFX';

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

function isReducedMotion(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('reduce-motion');
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
      // Catch pulse on the score counter when the star trails arrive, then
      // advance the round.
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
        case 'cross-target':
          crossed = true;
          // Target Beat already orchestrates godrays + vignette + flash +
          // time-dilation + medium shake inside ScoringVFX.
          scoringVFX.fireTargetBeat();
          break;
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

          // Counter catch + END_SCORING right as the number lands.
          schedule(finishBoom, BOOM_FLY_START_MS + BOOM_FLY_MS - 150);
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
