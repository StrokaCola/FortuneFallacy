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
