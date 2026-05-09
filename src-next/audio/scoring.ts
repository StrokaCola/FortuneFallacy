import { bus } from '../events/bus';
import { sfxPlay } from './sfx';
import { audioEngine } from './AudioEngine';
import { DUCK_PRESETS } from './duckEnvelope';
import { store } from '../state/store';

const SEMI = Math.pow(2, 1 / 12);
const BASE_HZ = 440;

// Tipping-point tension — when the running total during scoring climbs
// into the [80%, 100%) band relative to the active target, the music
// dips and a low rumble plays so the moment of "is this enough?" lands
// emotionally. Resets when the score sequence starts again (cast-swell).
const TIPPING_POINT_LOWER = 0.80;
const TIPPING_POINT_UPPER = 1.00;

export function installScoringRouter(): () => void {
  let tippingPointArmed = true;
  let crossedTargetThisSequence = false;

  return bus.on('onScoreBeat', ({ beat }) => {
    // Tipping-point check — runs on every beat that carries a
    // runningTotal so the duck arms on whichever beat first lands the
    // score in the [80%, 100%) band. Once armed, no re-fire this
    // sequence; resets on cast-swell.
    if (tippingPointArmed && !crossedTargetThisSequence && 'runningTotal' in beat) {
      const s = store.getState();
      const target = s.round.target;
      const totalSoFar = s.round.score + beat.runningTotal;
      if (target > 0) {
        const ratio = totalSoFar / target;
        if (ratio >= TIPPING_POINT_LOWER && ratio < TIPPING_POINT_UPPER) {
          tippingPointArmed = false;
          audioEngine.duck(DUCK_PRESETS.tippingPoint());
          // Low-frequency rumble — chipTick at sub-bass to give the
          // dread an audible body underneath the music dip. Pure
          // borrowed-voice; no new SFX needed.
          sfxPlay('chipTick', { freq: 110, gain: 0.65 });
        }
      }
    }

    switch (beat.kind) {
      case 'cast-swell':
        sfxPlay('castSwell');
        // Reset tipping-point arming for the new sequence.
        tippingPointArmed = true;
        crossedTargetThisSequence = false;
        break;
      case 'die-tick': {
        const hz = BASE_HZ * Math.pow(SEMI, beat.pitchSemis);
        sfxPlay('chipTick', { idx: beat.dieIdx, freq: hz });
        break;
      }
      case 'combo-bonus':
        sfxPlay('comboChime');
        break;
      case 'upgrade-chip': {
        // Pitch climbs with chip-delta magnitude so a +1000-chip catalyst
        // fires HIGHER than a +10. Log scale so we don't hit dog-whistle
        // territory on big endgame numbers. Capped at +14 semis so the
        // ramp tops out at ~2.4× base frequency.
        const delta = Math.max(1, Math.abs(beat.chipDelta));
        const semis = Math.min(14, Math.floor(Math.log2(delta) * 1.4));
        const hz = BASE_HZ * Math.pow(SEMI, semis);
        sfxPlay('chipTick', { freq: hz, gain: 0.7 });
        break;
      }
      case 'upgrade-mult': {
        // Mult-tier upgrade beat — softer than a full mult-slam so it
        // doesn't compete with the main multiplier crescendo. Pitch
        // tracks the delta size so a +5 mult beat sounds noticeably
        // bigger than a +1.
        const delta = Math.max(0.5, Math.abs(beat.multDelta));
        const semis = Math.min(12, Math.floor(Math.log2(delta + 1) * 4));
        const hz = BASE_HZ * Math.pow(SEMI, 6 + semis);
        sfxPlay('multSlam', { freq: hz, gain: 0.45 });
        break;
      }
      case 'mult-slam': {
        const hz = BASE_HZ * Math.pow(SEMI, beat.pitchSemis);
        sfxPlay('multSlam', { freq: hz, gain: beat.ampScale });
        break;
      }
      case 'cross-target':
        sfxPlay('targetCross');
        crossedTargetThisSequence = true;
        // The cross resolves the tipping-point dread. Layer a small
        // up-pitch chime on top of targetCross so the audio arc reads
        // as "tension → release" rather than just a single cross ping.
        sfxPlay('comboChime', { gain: 0.7 });
        break;
      case 'hold-breath': {
        // Anticipation hush: dim the music bus over the breath duration so
        // the upcoming boom punches through silence.
        const env = DUCK_PRESETS.holdBreath(beat.durMs);
        audioEngine.duck(env);
        break;
      }
      case 'boom':
        sfxPlay('castBoom', { gain: beat.crossedTarget ? 1.2 : 0.85 });
        break;
      case 'bail':
        // Silence-on-bust: cut all music for ~1s so the failure lands in a
        // dead room, then let the fail layer ramp back in via audioBridge.
        sfxPlay('notEnough');
        audioEngine.duck(DUCK_PRESETS.silenceOnBust());
        break;
    }
  });
}
