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

// Wave T+1 (2026-05-19) UI/UX refinement — boom celebration tightened
// from ~3.7s total (1700ms pop hold + 800ms fly + 820ms star trails +
// counter fill + savor) to ~1.4s. The old fly-to-corner pattern
// duplicated the work the counter fill already does and held the
// player away from the next decision. The new sequence:
//   t=0       : BoomNumber pops at center, scoring panel highlights formula
//   t=600ms   : onScoreCounterFill emits, counter tweens up to new total
//   t=600+fill: catch pulse + END_SCORING dispatch
// BoomNumber now lives 1200ms total (pop + dissolve) and never flies.
// Star-trails / fly timings retained as constants for backwards-compat
// with any external listener but no longer drive the round advance.
const BOOM_HOLD_MS = 600;
const BAIL_HOLD_MS = 2400;
const COUNTER_FILL_MS = 360;
// Savor pause after the counter fill completes before the screen
// swap fires (clearBlind → ui.screen = 'shop' | 'hub' | 'win'). Gives
// the catch-pulse a moment to settle on the visible counter before
// the entire screen fades out, so the player actually SEES the
// celebration land instead of getting yanked into the shop mid-flight.
// Wave T (2026-05-19): variable by boom variant. Mega/gold booms keep
// the full hold because the celebration earned it; normal booms snap
// to a short hold so a non-crossing hand's energy carries into the
// next decision instead of holding on dead air.
const POST_FILL_SAVOR_MS_BY_VARIANT: Record<'normal' | 'gold' | 'mega', number> = {
  normal: 80,
  gold: 240,
  mega: 240,
};

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
  // 2026-05-16 — Solar Flare particle palette cosmetic shifts the
  // default cyan slam color to a warm coral so every scoring beat
  // picks up the solar tone. Crossed-target and explicit gold/magenta
  // tints override (the player's tier feedback still needs to read).
  const cosmetics = store.getState().meta.cosmeticsUnlocked ?? [];
  if (cosmetics.includes('particles_solar_flare')) return '#ff9d4a';
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
          // Wave T+1 (2026-05-19) choreography — every mult-slam now
          // shakes, scaled by multiplier value. Tier 1 (×2) gets the
          // 'sm' fine shake (was previously silent) so even a small
          // mult-slam reads as physical impact, not just a number
          // change. Bigger mults still escalate to 'md'.
          const shake = beat.multiplier >= 6 || crossed
            ? 'md'
            : 'sm';
          scoringVFX.fireSlam(beat.label, color, shake);
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

          // Wave T+1 (2026-05-19) choreography — boom afterglow.
          // Warm radial vignette pulses across the play area for
          // ~1200ms after a crossed-target boom, leaving an afterimage
          // of the celebration as the player's eye settles. Skipped on
          // bail / non-cross booms (no celebration earned).
          if (!isReducedMotion() && gold) {
            const stage = document.getElementById('stage-root');
            if (stage) {
              stage.classList.add(variant === 'mega' ? 'boom-afterglow-mega' : 'boom-afterglow');
              const dur = variant === 'mega' ? 1600 : 1200;
              schedule(
                () => stage.classList.remove(variant === 'mega' ? 'boom-afterglow-mega' : 'boom-afterglow'),
                dur,
              );
            }
          }

          // Star-cluster ripple — fires on every boom (gold and mega
          // get the brighter 'mega' tier). Washes the cosmos starfield
          // with three (or four) screen-blend rings so the boom reads
          // as "the cosmos noticed" rather than a centered burst.
          scoringVFX.fireStarRipple(variant === 'mega' ? 'mega' : 'normal');

          // Meteor shower — fires on every boom that crossed target
          // (gold) and harder on mega. Rendered in the cosmos
          // background via CosmosBackground.MeteorShowerLayer so the
          // streaks read as actual shooting stars in the game's sky.
          // Constellation accent tints the streaks; count scales by
          // tier so a gold-only boom gets a brief shower while a 6×
          // mega gets the full sky-full.
          if (variant === 'gold' || variant === 'mega') {
            const constellation = lookupConstellation(
              store.getState().run.constellationId,
            );
            const streakCount = variant === 'mega'
              ? Math.max(5, Math.min(8, Math.round(3 + ratio)))
              : 3;
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

          // Wave T+1 — counter fill fires after the brief BOOM_HOLD_MS
          // pop-hold so the BoomNumber stays visible while the counter
          // tweens up underneath. Fill duration still scales with score
          // magnitude so a 50k hand reads as heavier than a 1k hand
          // (floor 240ms, ceiling 900ms). Pitch ramp in
          // audio/scoring.ts upgrade-chip case still scales with delta,
          // so visual + audio ramps stay coherent.
          const total = Math.max(1, beat.finalTotal);
          const scaledFillMs = Math.max(
            240,
            Math.min(900, COUNTER_FILL_MS + (Math.log10(total) - 2) * 165),
          );
          schedule(
            () => bus.emit('onScoreCounterFill', { durationMs: scaledFillMs }),
            BOOM_HOLD_MS,
          );
          // END_SCORING fires AFTER pop hold + counter fill + savor.
          // Trimmed from ~3.7s → ~1.4s vs old fly-to-corner pattern.
          schedule(
            finishBoom,
            BOOM_HOLD_MS + scaledFillMs + POST_FILL_SAVOR_MS_BY_VARIANT[variant],
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
