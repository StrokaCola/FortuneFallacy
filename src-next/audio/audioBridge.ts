import { bus } from '../events/bus';
import { store } from '../state/store';
import { selectTensionFromState } from '../state/selectors';
import { lookupMod } from '../core/mods';
import { audioEngine, ensureAudioAfterGesture } from './AudioEngine';
import * as sfxModule from './sfx';
import { installScoringRouter } from './scoring';
import { installHeatRouter } from './heat';
import * as audioSettings from './audioSettings';
import { triggerShake } from '../app/visual/screenShake';
import { makeSfxScheduler } from './sfxScheduler';

// Wave T (2026-05-19) — used to defer achievement audio if it would
// collide with a still-ringing win fanfare. Set on onRunEnded(won=true).
let lastRunWinAt = 0;
const ACHIEVEMENT_AFTER_WIN_DELAY_MS = 600;
const ACHIEVEMENT_COLLISION_WINDOW_MS = 1500;

const { sfxSetMaster, sfxGetMaster, sfxBank } = sfxModule;

export function startAudioBridge(): () => void {
  // 2026-05-22 — round-bound SFX scheduler. Wraps setTimeouts for
  // dice clack stagger, hot-streak ticks, storm rumble, meteor shower,
  // and critical-shard follow-up so they all get cancelled on round end
  // (onBlindCleared, onRunEnded, screen→fail transition). Pre-fix these
  // were `window.setTimeout(...)` with no handle, so a clack scheduled
  // 200ms into a roll would still fire after a bust transition.
  const roundSched = makeSfxScheduler();

  const subs = [
    installScoringRouter(),
    installHeatRouter(),
    bus.on('onRollStart', () => {
      audioEngine.bumpHeat(0.04);
      const dice = store.getState().round.dice;
      const rolling = dice.filter((d) => !d.locked).length || dice.length;
      for (let i = 0; i < rolling; i++) {
        roundSched.schedule(() => sfxModule.sfxPlay('diceClack'), i * (30 + Math.random() * 50));
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
        roundSched.schedule(() => sfxModule.sfxPlay('diceClack'), delay);
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
      // 2026-05-22 — flush any round-bound scheduled SFX (dice clack
      // tail, hot-streak ticks, shard-threshold follow-ups) so they
      // don't ghost into the shop transition.
      roundSched.cancelAll();
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
    bus.on('onLockToggled', () => {
      sfxModule.sfxPlay('lockTap');
      // 2026-05-19 tuning — dropped the `triggerShake('tiny')` that
      // fired on every lock. Lock is a high-frequency action (many
      // times per hand) and the repeated stage-translate shake read
      // as noisy. The lockTap SFX + the lock visual state on the die
      // are sufficient feedback for the commitment.
    }),
    bus.on('onOfferBought', () => sfxModule.sfxPlay('buy')),
    bus.on('onUpgradeSold', () => sfxModule.sfxPlay('buy')),
    // Astral Forge spend — same kind of "transaction confirmed" beat as
    // a shop purchase, just at the meta layer. Reusing 'buy' keeps the
    // soundscape coherent without authoring a new sample.
    bus.on('onAstralPerkBought', () => sfxModule.sfxPlay('buy')),
    // Dust earned at end-of-blind. Quieter than 'win' (which already
    // fires for the clear) so the two cues don't pile on top of each
    // other — comboChime is a softer bell.
    bus.on('onDustEarned', ({ delta, total }) => {
      sfxModule.sfxPlay('comboChime');
      // Wave T (Batch F) — milestone chimes. retriggerEcho at ascending
      // pitch on lifetime-dust threshold crossings (10/25/50/100). idx
      // bumps the harmonic up per bracket so each milestone reads as
      // a fresh "you climbed a tier" beat.
      const DUST_MILESTONES = [10, 25, 50, 100];
      const before = total - delta;
      for (let i = 0; i < DUST_MILESTONES.length; i++) {
        const m = DUST_MILESTONES[i]!;
        if (before < m && total >= m) {
          window.setTimeout(() => {
            sfxModule.sfxPlay('retriggerEcho', { idx: i, gain: 0.85 });
          }, 220 + i * 80);
        }
      }
    }),
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
    bus.on('onModAttached', () => {
      sfxModule.sfxPlay('modAttach');
      // Wave T — physical lock-in for the mod commitment beat. ForgeVFX
      // plays the stellar ritual but the action itself was previously
      // shake-less.
      triggerShake('tiny');
    }),
    bus.on('onModDetached', () => sfxModule.sfxPlay('modDetach')),
    // Sell-trigger payoff — castSwell + comboChime layered, same motif
    // as the achievement-unlock toast since they're both "free reward
    // landed" beats. Quieter on the chime so it doesn't clobber the
    // shard-clink scheduler that fires alongside on the gain.
    bus.on('onSellTrigger', () => {
      sfxModule.sfxPlay('castSwell', { gain: 0.5 });
      window.setTimeout(() => sfxModule.sfxPlay('comboChime', { gain: 0.85 }), 80);
    }),
    // Wave T — banish-face retrigger. initSimulation re-rolled a die's
    // predetermined value (Pyre Pact family). The visual is a brief
    // pop-up + re-tumble; whisperChime at low gain reads as "the engine
    // intervened" without competing with the rolling clatter.
    bus.on('onDieBanishTriggered', () => {
      sfxModule.sfxPlay('whisperChime', { gain: 0.5 });
    }),
    // Wave T — reorder rejected. Validation failure on REORDER_HOLD;
    // disabled buttons elsewhere use uiDenied so the rejection sounds
    // consistent with other blocked interactions.
    bus.on('onReorderRejected', () => {
      sfxModule.sfxPlay('uiDenied');
    }),
    // Wave T — pack pick + skip differentiation. Pick is a satisfying
    // chime; skip is the lighter cardFlip so the player still hears the
    // close but it doesn't feel rewarded.
    bus.on('onPackPicked', () => {
      sfxModule.sfxPlay('comboChime', { gain: 0.7 });
    }),
    bus.on('onPackClosed', ({ pickedCount }) => {
      if (pickedCount === 0) sfxModule.sfxPlay('cardFlip', { gain: 0.4 });
    }),
    // Wave T — track win moments to defer overlapping achievement audio.
    bus.on('onRunEnded', ({ won }) => {
      // 2026-05-22 — drain any leftover round-bound timers on run end
      // so they don't fire into the postmortem screen.
      roundSched.cancelAll();
      if (won) lastRunWinAt = Date.now();
    }),
    // Wave T — achievement unlock fanfare. Reuses the sell-trigger motif
    // (castSwell → comboChime) since both are "free reward landed"
    // beats. Sequenced after the win fanfare when the run just ended
    // so the two cues don't pile on top of each other on the
    // postmortem screen.
    bus.on('onAchievementUnlocked', () => {
      const sinceWin = Date.now() - lastRunWinAt;
      const delay = sinceWin < ACHIEVEMENT_COLLISION_WINDOW_MS
        ? ACHIEVEMENT_AFTER_WIN_DELAY_MS
        : 0;
      window.setTimeout(() => {
        sfxModule.sfxPlay('castSwell', { gain: 0.5 });
        window.setTimeout(() => sfxModule.sfxPlay('comboChime', { gain: 0.85 }), 80);
      }, delay);
    }),
    // Wave T (Batch C) — pack reveal shimmer. Distinct from onPackPicked
    // (which fires when a galaxy is taken) — this is the moment the
    // pack opens, before the player has chosen anything.
    bus.on('onPackOpened', () => {
      sfxModule.sfxPlay('sigilDraw', { gain: 0.35 });
    }),
    // Wave T (Batch C) — Hot Streak audio surge. Three rising chipTicks
    // in rapid succession + a brief combo-stem boost via the audio
    // engine. The banner already fires from BannerListener; this is
    // just the audible payoff to match the visual celebration.
    bus.on('onHotStreak', () => {
      const ticks = 3;
      for (let i = 0; i < ticks; i++) {
        roundSched.schedule(() => {
          // Pitch rises across the three ticks via the freq option.
          sfxModule.sfxPlay('chipTick', { idx: i, freq: 600 + i * 200, gain: 0.7 });
        }, i * 110);
      }
      // Brief combo-stem boost — uses the existing bigScore trigger at
      // reduced effect so the music perks up without the full peak
      // mode. Lasts ~1.5s before naturally relaxing.
      audioEngine.bumpHeat(0.20);
    }),
    // Wave T (Batch C) — Voidstorm telegraph rumble. One blind before
    // a storm lands. AudioEngine's duck envelope dips the music briefly
    // and a low chipTick at low freq simulates a rumble bed without
    // authoring a new voice.
    bus.on('onStormIncoming', () => {
      // Sub-bass thud + slow fade. Low frequency + long sustain on
      // chipTick approximates a "something's coming" rumble.
      sfxModule.sfxPlay('chipTick', { idx: 0, freq: 60, gain: 0.5 });
      roundSched.schedule(() => sfxModule.sfxPlay('chipTick', { idx: 0, freq: 80, gain: 0.4 }), 400);
      roundSched.schedule(() => sfxModule.sfxPlay('chipTick', { idx: 0, freq: 50, gain: 0.45 }), 1100);
    }),
    // Wave T (Batch C) — mega-boom audio accent. Meteor shower fires
    // its own downward gliss; crystalline edge catch a higher sparkle.
    // Both ride on top of the existing castBoom / win cues so they
    // layer rather than replace.
    bus.on('onMeteorShowerTriggered', () => {
      // Three quick descending multSlam-like hits — sounds like
      // streaks tearing across the sky.
      for (let i = 0; i < 3; i++) {
        roundSched.schedule(() => {
          sfxModule.sfxPlay('multSlam', { idx: i, gain: 0.4 - i * 0.05 });
        }, i * 90);
      }
    }),
    bus.on('onCrystallineEdgeCatch', () => {
      // Single bright targetCross — the dice catching the boom on
      // their accent edges has a "ting" feel.
      sfxModule.sfxPlay('targetCross', { gain: 0.6 });
    }),
    // Wave T (Batch C) — last-hand-of-blind tension shift. AudioEngine
    // duck dips the master ~50% for ~1.6s; the player rolls into the
    // last hand with quieter music so the moment feels focused.
    bus.on('onLastHandOfBlind', () => {
      audioEngine.duck({ attackMs: 220, holdMs: 1100, releaseMs: 400, depth: 0.55 });
      // Subtle chime so the music dip isn't the only signal.
      sfxModule.sfxPlay('whisperChime', { gain: 0.35, idx: 1 });
    }),
    // Wave T (Batch E) — phase-2 incoming telegraph. Quick filtered
    // duck + low whisperChime so the player audibly registers "the
    // boss is about to escalate" before the banner lands. Quieter
    // than onBossSecondWind itself so the warning reads as different
    // from the actual transition.
    bus.on('onBossPhase2Incoming', () => {
      audioEngine.duck({ attackMs: 140, holdMs: 360, releaseMs: 280, depth: 0.7 });
      sfxModule.sfxPlay('whisperChime', { gain: 0.5, idx: 2 });
    }),
    // Wave T (Batch F) — Blind→Blind transition cue. Quiet sigilDraw
    // signals "you're stepping into a new trial". Non-boss only;
    // boss blinds run the full reveal cinematic.
    bus.on('onBlindAboutToStart', () => {
      sfxModule.sfxPlay('sigilDraw', { gain: 0.25 });
      // Brief vignette pulse on stage-root for the same 700ms the
      // sound lingers. Reuses the boss-phase-flare style but at lower
      // intensity (different class).
      if (typeof document !== 'undefined') {
        const stage = document.getElementById('stage-root');
        if (stage) {
          stage.classList.add('blind-about-to-start');
          window.setTimeout(() => stage.classList.remove('blind-about-to-start'), 700);
        }
      }
    }),
  ];

  let lastTension = -1;
  let lastProgress = -1;
  // Wave T (Batch F) — shard threshold audio. Tracks last-seen shard
  // count so crossings (rich/poor/critical) play discrete cues. Only
  // fires during active rounds so the meta layer (Forge spending, etc.)
  // doesn't audibly nag.
  let lastShards = -1;
  let lastShardScreen: string | null = null;
  const RICH_THRESHOLD = 6;
  const POOR_THRESHOLD = 2;
  const offStore = store.subscribe((s, prev) => {
    if (s.ui.screen === 'fail' && prev.ui.screen !== 'fail') {
      // 2026-05-22 — bust transition cancels any queued round-bound
      // SFX before the bust sting lands. Without this a late diceClack
      // could fire right after the bust sting and read as a stray pop.
      roundSched.cancelAll();
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
    // Wave T (Batch F) — shard threshold audio. Only fires during
    // round screen and on real crossings (not screen-swap resets).
    const shards = s.run.shards;
    const inRound = s.ui.screen === 'round';
    const screenChanged = s.ui.screen !== lastShardScreen;
    if (inRound && !screenChanged && lastShards >= 0 && shards !== lastShards) {
      const crossedRich = lastShards < RICH_THRESHOLD && shards >= RICH_THRESHOLD;
      const crossedPoor = lastShards > POOR_THRESHOLD && shards <= POOR_THRESHOLD && shards > 0;
      const crossedCritical = lastShards > 0 && shards === 0;
      if (crossedRich) {
        sfxModule.sfxPlay('comboChime', { gain: 0.55, idx: 2 });
      } else if (crossedCritical) {
        sfxModule.sfxPlay('chipTick', { freq: 65, gain: 0.55 });
        roundSched.schedule(() => sfxModule.sfxPlay('chipTick', { freq: 50, gain: 0.45 }), 220);
      } else if (crossedPoor) {
        sfxModule.sfxPlay('chipTick', { freq: 200, gain: 0.4 });
      }
    }
    lastShards = shards;
    lastShardScreen = s.ui.screen;
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
    // 2026-05-22 — drain leftover timers on teardown (test harness, HMR).
    roundSched.cancelAll();
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
