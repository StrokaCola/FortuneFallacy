import { bus } from '../events/bus';
import { sfxPlay } from './sfx';
import { audioEngine } from './AudioEngine';
import { DUCK_PRESETS } from './duckEnvelope';

const SEMI = Math.pow(2, 1 / 12);
const BASE_HZ = 440;

export function installScoringRouter(): () => void {
  return bus.on('onScoreBeat', ({ beat }) => {
    switch (beat.kind) {
      case 'cast-swell':
        sfxPlay('castSwell');
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
