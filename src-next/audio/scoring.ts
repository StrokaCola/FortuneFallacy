import { bus } from '../events/bus';
import { sfxPlay } from './sfx';

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
      case 'hold-breath':
        // Master duck handled by AudioEngine if exposed; otherwise no-op for SFX
        break;
      case 'boom':
        sfxPlay('castBoom', { volume: beat.crossedTarget ? 1.2 : 0.85 });
        break;
      case 'bail':
        sfxPlay('notEnough');
        break;
    }
  });
}
