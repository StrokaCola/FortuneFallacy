import { bus } from '../events/bus';
import { store } from '../state/store';
import { selectTensionFromState } from '../state/selectors';
import { lookupMod } from '../core/mods';
import { audioEngine, ensureAudioAfterGesture } from './AudioEngine';
import * as sfxModule from './sfx';
import { installScoringRouter } from './scoring';
import { installHeatRouter } from './heat';
import * as audioSettings from './audioSettings';

const { sfxSetMaster, sfxGetMaster, sfxBank } = sfxModule;

export function startAudioBridge(): () => void {
  const subs = [
    installScoringRouter(),
    installHeatRouter(),
    bus.on('onRollStart', () => {
      audioEngine.bumpHeat(0.04);
      const dice = store.getState().round.dice;
      const rolling = dice.filter((d) => !d.locked).length || dice.length;
      for (let i = 0; i < rolling; i++) {
        window.setTimeout(() => sfxModule.sfxPlay('diceClack'), i * (30 + Math.random() * 50));
      }
    }),
    bus.on('onSimulationEnd', ({ result }) => {
      audioEngine.bumpHeat(0.06);
      // Slot-machine settle clatter — one clack per die, reels-stopping
      // stagger so dice "land" sequentially instead of all at once.
      // Slightly heavier and slower than the rolling clatter on onRollStart.
      const count = result?.finalFaces?.length ?? 0;
      for (let i = 0; i < count; i++) {
        const delay = 60 + i * (70 + Math.random() * 40);
        window.setTimeout(() => sfxModule.sfxPlay('diceClack'), delay);
      }
    }),
    bus.on('onComboDetected', ({ tier }) => {
      audioEngine.bumpComboFromTier(tier);
      sfxModule.sfxPlay('combo', { tier });
    }),
    bus.on('onUpgradeTriggered', () => {
      audioEngine.bumpHeat(0.05);
      audioEngine.noteStability(0.03);
      sfxModule.sfxPlay('upgrade');
    }),
    bus.on('onScoreCalculated', ({ total }) => {
      const target = store.getState().round.target;
      audioEngine.bumpHeatFromScore(total, target);
      if (target > 0 && total >= target * 2) {
        audioEngine.triggerBigScore();
        sfxModule.sfxPlay('bigScore');
      }
    }),
    bus.on('onBlindCleared', () => {
      audioEngine.noteStability(0.25);
      sfxModule.sfxPlay('win');
    }),
    bus.on('onBossRevealed', () => {
      audioEngine.enterFail();
      sfxModule.sfxPlay('bossSting');
      window.setTimeout(() => audioEngine.exitFail(), 800);
    }),
    bus.on('onShopOpened', () => {
      audioEngine.setMode('idle');
      sfxModule.sfxPlay('reroll');
    }),
    bus.on('onLockToggled', () => sfxModule.sfxPlay('lockTap')),
    bus.on('onOfferBought', () => sfxModule.sfxPlay('buy')),
    bus.on('onUpgradeSold', () => sfxModule.sfxPlay('buy')),
    // Astral Forge spend — same kind of "transaction confirmed" beat as
    // a shop purchase, just at the meta layer. Reusing 'buy' keeps the
    // soundscape coherent without authoring a new sample.
    bus.on('onAstralPerkBought', () => sfxModule.sfxPlay('buy')),
    // Dust earned at end-of-blind. Quieter than 'win' (which already
    // fires for the clear) so the two cues don't pile on top of each
    // other — comboChime is a softer bell.
    bus.on('onDustEarned', () => sfxModule.sfxPlay('comboChime')),
    bus.on('onModFired', ({ modId }) => {
      const def = lookupMod(modId);
      const trigger = def?.visual?.triggerFx;
      switch (trigger) {
        case 'pulse':     sfxModule.sfxPlay('modPulse'); break;
        case 'loaded':    sfxModule.sfxPlay('modLoaded'); break;
        case 'pipCharge': sfxModule.sfxPlay('modPipCharge'); break;
        case 'backstop':  sfxModule.sfxPlay('modBackstop'); break;
      }
    }),
    // Forge moments. Attach is a louder confirm; detach is the lighter
    // "swap" sound. Both ride the existing modAttach/modDetach voices
    // that were authored but previously unwired.
    bus.on('onModAttached', () => sfxModule.sfxPlay('modAttach')),
    bus.on('onModDetached', () => sfxModule.sfxPlay('modDetach')),
  ];

  let lastTension = -1;
  let lastProgress = -1;
  const offStore = store.subscribe((s, prev) => {
    if (s.ui.screen === 'fail' && prev.ui.screen !== 'fail') {
      audioEngine.enterFail();
      sfxModule.sfxPlay('bust');
    }
    if (prev.ui.screen === 'fail' && s.ui.screen !== 'fail') {
      audioEngine.exitFail();
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

export { audioEngine, ensureAudioAfterGesture, sfxSetMaster, sfxGetMaster, sfxBank };
export const sfxPlay = sfxModule.sfxPlay;

export function getMaster(): number {
  return audioSettings.getMaster();
}
export function setMaster(v: number): void {
  audioSettings.setMaster(v);
}
