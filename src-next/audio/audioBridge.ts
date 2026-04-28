import { bus } from '../events/bus';
import { store } from '../state/store';
import { selectTensionFromState } from '../state/selectors';
import { audioEngine, ensureAudioAfterGesture } from './AudioEngine';
import { sfxPlay, sfxSetMaster, sfxGetMaster, sfxBank } from './sfx';
import { installScoringRouter } from './scoring';

export function startAudioBridge(): () => void {
  const subs = [
    installScoringRouter(),
    bus.on('onRollStart', () => {
      audioEngine.bumpHeat(0.04);
      const dice = store.getState().round.dice;
      const rolling = dice.filter((d) => !d.locked).length || dice.length;
      for (let i = 0; i < rolling; i++) {
        window.setTimeout(() => sfxPlay('diceClack'), i * (30 + Math.random() * 50));
      }
    }),
    bus.on('onSimulationEnd', () => audioEngine.bumpHeat(0.06)),
    bus.on('onComboDetected', ({ tier }) => {
      audioEngine.bumpComboFromTier(tier);
      sfxPlay('combo', { tier });
    }),
    bus.on('onUpgradeTriggered', () => {
      audioEngine.bumpHeat(0.05);
      audioEngine.noteStability(0.03);
      sfxPlay('upgrade');
    }),
    bus.on('onScoreCalculated', ({ total }) => {
      const target = store.getState().round.target;
      audioEngine.bumpHeatFromScore(total, target);
      if (target > 0 && total >= target * 2) {
        audioEngine.triggerBigScore();
        sfxPlay('bigScore');
      }
    }),
    bus.on('onBlindCleared', () => {
      audioEngine.noteStability(0.25);
      sfxPlay('win');
    }),
    bus.on('onBossRevealed', () => {
      audioEngine.enterFail();
      sfxPlay('bossSting');
      window.setTimeout(() => audioEngine.exitFail(), 800);
    }),
    bus.on('onShopOpened', () => {
      audioEngine.setMode('idle');
      sfxPlay('reroll');
    }),
    bus.on('onLockToggled', () => sfxPlay('lockTap')),
    bus.on('onOfferBought', () => sfxPlay('buy')),
  ];

  let lastTension = -1;
  let lastProgress = -1;
  const offStore = store.subscribe((s, prev) => {
    if (prev.round.active && !s.round.active && s.ui.screen === 'hub') {
      audioEngine.enterFail();
      sfxPlay('bust');
      window.setTimeout(() => audioEngine.exitFail(), 4000);
    }
    if (s.ui.screen !== prev.ui.screen) {
      if (s.ui.screen === 'title') audioEngine.pause();
      else audioEngine.resume();
    }
    const t = selectTensionFromState(s);
    if (Math.abs(t - lastTension) > 0.005) {
      lastTension = t;
      audioEngine.setTension(t);
    }
    const target = s.round.target;
    const p = target > 0 ? Math.min(1, s.round.score / target) : 0;
    if (Math.abs(p - lastProgress) > 0.005) {
      lastProgress = p;
      audioEngine.setProgress(p);
    }
  });

  return () => {
    subs.forEach((u) => u());
    offStore();
  };
}

export { audioEngine, ensureAudioAfterGesture, sfxPlay, sfxSetMaster, sfxGetMaster, sfxBank };

export function getMaster(): number {
  return audioEngine.getMaster();
}
export function setMaster(v: number): void {
  audioEngine.setMaster(v);
}
