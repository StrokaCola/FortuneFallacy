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
      // Audio engine "fail mode" ducks for the dread vignette; the
      // bossSting cue itself is now driven by BossReveal.tsx with the
      // boss-index variant (Wave L), so we DON'T re-fire it here.
      // Firing twice stacked two brass voices an octave apart.
      audioEngine.enterFail();
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
        // 2026-05-14 fifth + sixth pass — every bespoke trigger family
        // routes to its dedicated synth voice (see audio/sfx/voices.ts
        // and synthBank.ts for the per-voice definitions).
        case 'crown':     sfxModule.sfxPlay('modCrown'); break;
        case 'shatter':   sfxModule.sfxPlay('modShatter'); break;
        case 'swirl':     sfxModule.sfxPlay('modSwirl'); break;
        case 'flashback': sfxModule.sfxPlay('modFlashback'); break;
        case 'conduit':   sfxModule.sfxPlay('modConduit'); break;
        case 'crescendo': sfxModule.sfxPlay('modCrescendo'); break;
        case 'resonance': sfxModule.sfxPlay('modResonance'); break;
        case 'pyreMark':  sfxModule.sfxPlay('modPyreMark'); break;
        case 'tallyMark': sfxModule.sfxPlay('modTallyMark'); break;
        case 'twinGlow':    sfxModule.sfxPlay('modTwinGlow'); break;
        case 'shardClink':  sfxModule.sfxPlay('modShardClink'); break;
        case 'rhythmStack': sfxModule.sfxPlay('modRhythmStack'); break;
        case 'appetite':    sfxModule.sfxPlay('modAppetite'); break;
        case 'awaken':      sfxModule.sfxPlay('modAwaken'); break;
      }
    }),
    // Forge moments. Attach is a louder confirm; detach is the lighter
    // "swap" sound. Both ride the existing modAttach/modDetach voices
    // that were authored but previously unwired.
    bus.on('onModAttached', () => sfxModule.sfxPlay('modAttach')),
    bus.on('onModDetached', () => sfxModule.sfxPlay('modDetach')),
    // Sell-trigger payoff — castSwell + comboChime layered, same motif
    // as the achievement-unlock toast since they're both "free reward
    // landed" beats. Quieter on the chime so it doesn't clobber the
    // shard-clink scheduler that fires alongside on the gain.
    bus.on('onSellTrigger', () => {
      sfxModule.sfxPlay('castSwell', { gain: 0.5 });
      window.setTimeout(() => sfxModule.sfxPlay('comboChime', { gain: 0.85 }), 80);
    }),
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
      // Wave N — per-screen entry cue. Each screen gets a distinct
      // signature so the player can identify the screen by sound after
      // a few sessions, without authoring full ambient beds. Cues are
      // existing voices played at low gain so they punctuate the screen
      // arrival without competing with the music crossfade.
      playScreenEnterCue(s.ui.screen);
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
    // Wave O — color-temperature ramp. Stage-root carries a
    // data-score-warmth attribute keyed off the current score / target
    // ratio. CSS layers (see styles/index.css "Wave O score warmth"
    // block) add a stepped warmth tint to the screen as the player
    // approaches and crosses the trial target. Bypassed under
    // .reduce-motion; ring-buffered so we don't thrash setAttribute.
    if (typeof document !== 'undefined' && s.ui.screen === 'round' && target > 0) {
      const ratio = s.round.score / target;
      const next =
        ratio >= 1.5 ? '4' :
        ratio >= 1.0 ? '3' :
        ratio >= 0.7 ? '2' :
        ratio >= 0.35 ? '1' :
        '0';
      const stage = document.getElementById('stage-root');
      if (stage && stage.getAttribute('data-score-warmth') !== next) {
        stage.setAttribute('data-score-warmth', next);
      }
    } else if (typeof document !== 'undefined' && prev.ui.screen === 'round' && s.ui.screen !== 'round') {
      const stage = document.getElementById('stage-root');
      if (stage) stage.removeAttribute('data-score-warmth');
    }
  });

  return () => {
    subs.forEach((u) => u());
    offStore();
  };
}

export { audioEngine, ensureAudioAfterGesture, sfxSetMaster, sfxGetMaster, sfxBank };
export const sfxPlay = sfxModule.sfxPlay;

// Wave N — per-screen entry cue. Maps each Screen enum value to an
// existing SFX voice + gain so the screen arrival has a quiet
// signature without authoring new audio assets. Returns silently if
// the screen has no cue assigned (e.g. round, which has its own
// dedicated entry beats from castSwell). Throttles via the cue's
// own SPAMMABLE_GAP_MS — rapid back-and-forth navigation between
// two screens doesn't pile cues.
type ScreenCue = { id: sfxModule.SfxId; gain?: number; delay?: number };
const SCREEN_ENTER_CUES: Partial<Record<string, ScreenCue>> = {
  hub:               { id: 'comboChime', gain: 0.55 },
  shop:              { id: 'buy',        gain: 0.35 },
  forge:             { id: 'modAttach',  gain: 0.45 },
  codex:             { id: 'cardFlip',   gain: 0.8  },
  astral_forge:      { id: 'sigilDraw',  gain: 0.55 },
  challenges:        { id: 'cardFlip',   gain: 0.55 },
  scores:            { id: 'whisperChime', gain: 0.6 },
  constellation_select: { id: 'sigilDraw', gain: 0.45 },
  settings:          { id: 'cardFlip',   gain: 0.45 },
  // title / nameentry / round / win / fail intentionally skipped —
  // they already have their own arrival beats (boot splash chime,
  // castSwell on the first roll, win fanfare, bust sting).
};
export function playScreenEnterCue(screen: string): void {
  const cue = SCREEN_ENTER_CUES[screen];
  if (!cue) return;
  if (cue.delay && cue.delay > 0) {
    window.setTimeout(() => sfxModule.sfxPlay(cue.id, { gain: cue.gain }), cue.delay);
  } else {
    sfxModule.sfxPlay(cue.id, { gain: cue.gain });
  }
}

export function getMaster(): number {
  return audioSettings.getMaster();
}
export function setMaster(v: number): void {
  audioSettings.setMaster(v);
}
