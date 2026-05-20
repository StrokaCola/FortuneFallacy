import { bus } from '../events/bus';
import { sfxPlay } from './sfx';
import { audioEngine } from './AudioEngine';
import { DUCK_PRESETS } from './duckEnvelope';
import { store } from '../state/store';
import { beatIntensity } from '../core/scoring/types';
import { playModAudio } from '../data/modAudio';

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
  // Wave T+1 (2026-05-19) Balatro polish — sequence-position pitch
  // ladder for upgrade-chip beats. Resets on cast-swell; each
  // successive chip pop climbs one semitone (capped at +14) so a
  // multi-catalyst hand audibly ladders up the scale instead of
  // pitch-jittering by delta magnitude alone. Magnitude still drives
  // gain so big deltas still feel bigger.
  let chipPopIndex = 0;

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
        chipPopIndex = 0;
        break;
      case 'die-tick': {
        const hz = BASE_HZ * Math.pow(SEMI, beat.pitchSemis);
        sfxPlay('chipTick', { idx: beat.dieIdx, freq: hz });
        break;
      }
      case 'combo-detect': {
        // Wave T+1 — quiet up-pitched chime right when the combo is
        // recognized. Audibly marks the moment the hand is identified
        // BEFORE dice tick in, so the player learns the visual flash
        // is paired with a sonic cue.
        sfxPlay('comboChime', { freq: BASE_HZ * 1.5, gain: 0.45 });
        break;
      }
      case 'combo-bonus':
        sfxPlay('comboChime');
        break;
      case 'upgrade-chip': {
        // Wave T+1 — sequence-position pitch ladder + importance gain.
        // Pitch climbs one semitone per chip pop (capped +14); gain is
        // both magnitude-driven (log10) AND scaled by the beat's
        // importance tier so a major catalyst fire is audibly heavier
        // than a minor mod tick at the same delta.
        const semis = Math.min(14, chipPopIndex);
        const hz = BASE_HZ * Math.pow(SEMI, semis);
        const delta = Math.max(1, Math.abs(beat.chipDelta));
        const magnitudeGain = Math.min(0.95, 0.55 + Math.log10(delta) * 0.1);
        const intensity = beatIntensity(beat);
        const gain = magnitudeGain * (0.7 + intensity * 0.4);
        sfxPlay('chipTick', { freq: hz, gain });
        // Wave T+1 choreography — arrival cue. Major / finale upgrade
        // beats play a quieter, higher-pitched chipTick 360ms later
        // (matches BeatTracer mote arrival) so the sound traces the
        // visual path: launch tick low at source, arrival tick high at
        // target. Reads as directional audio without a new synth voice.
        if (beat.importance === 'major' || beat.importance === 'finale') {
          setTimeout(() => {
            sfxPlay('chipTick', { freq: hz * 1.5, gain: gain * 0.45 });
          }, 360);
        }
        // Wave T+1 (2026-05-19) bespoke theater — Move 4 — per-mod
        // audio cue layered on top of the base chip tick when the
        // beat sources from a mod. Each mod has a unique sound
        // signature so the player learns "Amplify sounds like THIS"
        // through repetition.
        if (beat.sourceType === 'mod' && beat.sourceId) {
          // Strip die-slot suffix from sourceId (e.g. "amplify@0" → "amplify")
          const baseId = beat.sourceId.split('@')[0] ?? beat.sourceId;
          playModAudio(baseId);
        }
        chipPopIndex += 1;
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
        // Wave T+1 (2026-05-19) bespoke theater — Move 4 — per-mod
        // audio cue layered for upgrade-mult beats sourced from mods.
        if (beat.sourceType === 'mod' && beat.sourceId) {
          const baseId = beat.sourceId.split('@')[0] ?? beat.sourceId;
          playModAudio(baseId);
        }
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
        // Wave T+1 (2026-05-19) — chord stack on cross-target. Three
        // comboChimes layered at root + fifth + octave with slight
        // attack offsets so the resolution reads as a major-chord
        // crash rather than a single ping. Heavier audio signature
        // for THE biggest moment of every cleared hand.
        sfxPlay('comboChime', { gain: 0.7 });
        setTimeout(() => sfxPlay('comboChime', { freq: BASE_HZ * 1.5, gain: 0.55 }), 60);
        setTimeout(() => sfxPlay('comboChime', { freq: BASE_HZ * 2.0, gain: 0.4 }), 120);
        break;
      case 'hold-breath': {
        // Anticipation hush: dim the music bus over the breath duration so
        // the upcoming boom punches through silence.
        const env = DUCK_PRESETS.holdBreath(beat.durMs);
        audioEngine.duck(env);
        // Wave T+1 (2026-05-19) bespoke theater — Move 5 — sustained
        // bell tone through the deep-freeze window. Held for the full
        // beat.durMs (variable per tier) so audio + visual freeze
        // duration coincide. Bell pitches up with crossed state so a
        // crossed-target boom inhales toward a brighter tone than a
        // recovery breath.
        const bellFreq = crossedTargetThisSequence ? 660 : 440;
        const bellGain = crossedTargetThisSequence ? 0.55 : 0.4;
        sfxPlay('comboChime', { freq: bellFreq, gain: bellGain });
        // Layer a second bell at the midpoint of the breath for
        // longer durMs values so the freeze never goes silent.
        if (beat.durMs > 500) {
          setTimeout(() => {
            sfxPlay('comboChime', { freq: bellFreq * 1.5, gain: bellGain * 0.7 });
          }, Math.round(beat.durMs * 0.55));
        }
        break;
      }
      case 'boom':
        sfxPlay('castBoom', { gain: beat.crossedTarget ? 1.2 : 0.85 });
        // Wave T+1 — finale chord layer. Crossed-target booms get a
        // major chord (root + third + fifth) stacked just after the
        // castBoom so the release feels resolved, not just loud.
        // Non-crossing booms skip the chord (their boom is recovery,
        // not celebration). megaRatio scales the chord gain so a 3×
        // mega lands harder than a 1.1× normal cross.
        if (beat.crossedTarget) {
          const mega = beat.megaRatio ?? 1;
          const chordGain = Math.min(1.1, 0.6 + Math.log10(Math.max(1, mega)) * 0.5);
          setTimeout(() => sfxPlay('comboChime', { freq: BASE_HZ * 1.26, gain: chordGain * 0.65 }), 40);
          setTimeout(() => sfxPlay('comboChime', { freq: BASE_HZ * 1.5, gain: chordGain * 0.55 }), 90);
          setTimeout(() => sfxPlay('comboChime', { freq: BASE_HZ * 2.0, gain: chordGain * 0.45 }), 150);
        }
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
