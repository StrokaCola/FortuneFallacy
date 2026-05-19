// Wave T Scoring Theater (Batch I, 2026-05-19) — phase orchestrator.
// Subscribes to onScoreBeat and emits onTheaterPhase markers that
// downstream layers (audio crescendo, camera zoom, banner, freeze)
// can react to without each re-implementing the same threshold logic.
//
// Phase machine:
//   IDLE
//     ↓ cast-swell
//   RAMPING ──────────────► (score crosses 50% of target)
//     ↓                            ↓
//     │                       SUSTAINED
//     │                            ↓ hold-breath
//     │                       HELD_BREATH
//     │                            ↓ boom
//     └──────────────────────► RELEASE
//                                  ↓ (any next cast-swell)
//                                IDLE
//
// bail also routes to RELEASE so the audio crescendo collapses
// cleanly when the player busts.

import { bus } from '../../../events/bus';
import { store } from '../../../state/store';
import { audioEngine } from '../../../audio/AudioEngine';

type Phase = 'idle' | 'ramping' | 'sustained' | 'held-breath' | 'release';

const SUSTAINED_RATIO = 0.5;
const CRESCENDO_TARGET_HZ = 2400;

export function installTheaterDirector(): () => void {
  let phase: Phase = 'idle';
  let peakMult = 1;

  const setPhase = (next: Phase): void => {
    if (phase === next) return;
    phase = next;
    if (next === 'sustained') {
      // Begin the audio crescendo sweep — filter cutoff drops to
      // CRESCENDO_TARGET_HZ over ~0.18s time constant.
      audioEngine.crescendoBegin(CRESCENDO_TARGET_HZ);
      bus.emit('onTheaterPhase', { phase: 'sustained', peakMult });
    } else if (next === 'held-breath') {
      bus.emit('onTheaterPhase', { phase: 'held-breath', peakMult });
    } else if (next === 'release') {
      // Release the crescendo so the boom hits with the filter
      // re-opening.
      audioEngine.crescendoEnd();
      bus.emit('onTheaterPhase', { phase: 'release', peakMult });
    } else if (next === 'ramping') {
      // Sanity — ensure no stale crescendo carries across hands.
      audioEngine.crescendoEnd();
      bus.emit('onTheaterPhase', { phase: 'ramping' });
    }
  };

  const off = bus.on('onScoreBeat', ({ beat }) => {
    switch (beat.kind) {
      case 'cast-swell': {
        peakMult = 1;
        setPhase('ramping');
        break;
      }
      case 'die-tick':
      case 'combo-bonus':
      case 'upgrade-chip': {
        if (phase === 'ramping') {
          const target = store.getState().round.target;
          if (target > 0 && beat.runningTotal >= target * SUSTAINED_RATIO) {
            setPhase('sustained');
          }
        }
        break;
      }
      case 'upgrade-mult': {
        if (beat.currentMult > peakMult) peakMult = beat.currentMult;
        if (phase === 'ramping') {
          // Running mult by itself doesn't change runningTotal between
          // beats, so the sustained transition is gated on chip beats
          // above. This branch just tracks peakMult for the banner.
        }
        break;
      }
      case 'mult-slam': {
        if (beat.multiplier > peakMult) peakMult = beat.multiplier;
        break;
      }
      case 'cross-target': {
        // Cross-target hard-promotes to sustained (covers cases where
        // a mult-slam crosses target before any chip beat crosses 50%
        // — rare but possible).
        if (phase === 'ramping') setPhase('sustained');
        break;
      }
      case 'hold-breath': {
        setPhase('held-breath');
        break;
      }
      case 'boom':
      case 'bail': {
        setPhase('release');
        // Stay in release until the next cast-swell promotes back to
        // ramping. No explicit idle reset needed; cast-swell resets.
        break;
      }
    }
  });

  return () => {
    off();
    audioEngine.crescendoEnd();
  };
}
