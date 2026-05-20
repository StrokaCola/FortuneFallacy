// Wave T+1 (2026-05-19) bespoke theater — Move 4 — per-mod audio
// signature.
//
// Each mod that fires during scoring (sourceType='mod' on upgrade
// beats) can carry a bespoke audio cue beyond the default chipTick.
// This map identifies which mod fired and returns the audio params
// the scoring router should layer on top of the base chip pop.
//
// Top common/uncommon mods (highest play time): differentiate via
// pitch + voice + gain so the player learns "Amplify sounds like
// THIS" vs "Sharpened sounds like THAT" through repetition.
//
// Legendary+ mods: stronger signature (often louder, layered, or
// using a different voice like multSlam / comboChime so the moment
// reads as Something Big.

import { sfxPlay } from '../audio/sfx';

type Cue = {
  voice: 'chipTick' | 'comboChime' | 'multSlam' | 'castSwell' | 'castBoom';
  freq?: number;
  gain?: number;
  delayMs?: number;
};

const MOD_AUDIO_CUES: Record<string, Cue | Cue[]> = {
  // ─── Common / uncommon — gentle differentiation ──────────────────
  amplify:     { voice: 'multSlam',  freq: 165, gain: 0.4 },                  // low whoomp
  sharpened:   { voice: 'chipTick',  freq: 1320, gain: 0.45 },                // bright blade glint
  gilded:      [{ voice: 'comboChime', freq: 880, gain: 0.4 }, { voice: 'comboChime', freq: 1175, gain: 0.3, delayMs: 60 }], // shimmer
  loaded:      { voice: 'chipTick',  freq: 220, gain: 0.5 },                  // chamber clack
  snake_eyes:  { voice: 'comboChime', freq: 1568, gain: 0.4 },                // bright sneer
  high_roller: { voice: 'comboChime', freq: 740, gain: 0.5 },                 // mid bell
  vanguard:    { voice: 'chipTick',  freq: 587, gain: 0.45 },                 // forward bugle
  capstone:    { voice: 'chipTick',  freq: 392, gain: 0.5 },                  // closing knock
  even_keel:   { voice: 'comboChime', freq: 523, gain: 0.35 },                // balance chime
  mirror_pair: [{ voice: 'comboChime', freq: 587, gain: 0.4 }, { voice: 'comboChime', freq: 587, gain: 0.3, delayMs: 120 }], // mirrored
  tithe:       { voice: 'comboChime', freq: 1175, gain: 0.45 },               // coin clink
  pip_charge:  { voice: 'chipTick',  freq: 880, gain: 0.5 },                  // bright spark
  backstop:    { voice: 'multSlam',  freq: 196, gain: 0.55 },                 // deep stop
  // ─── Rare ────────────────────────────────────────────────────────
  conduit:     [{ voice: 'comboChime', freq: 740, gain: 0.5 }, { voice: 'chipTick', freq: 1480, gain: 0.4, delayMs: 80 }], // arc
  crescendo:   [{ voice: 'chipTick', freq: 440, gain: 0.4 }, { voice: 'chipTick', freq: 587, gain: 0.45, delayMs: 70 }, { voice: 'chipTick', freq: 740, gain: 0.5, delayMs: 140 }], // rising
  // ─── Legendary — bigger sigil signatures ──────────────────────────
  crown:       [{ voice: 'castSwell', gain: 0.5 }, { voice: 'comboChime', freq: 1175, gain: 0.7, delayMs: 80 }], // fanfare
  resonance:   [{ voice: 'comboChime', freq: 587, gain: 0.6 }, { voice: 'comboChime', freq: 587, gain: 0.5, delayMs: 80 }], // double-strike
  wildcard:    [{ voice: 'comboChime', freq: 392, gain: 0.4 }, { voice: 'comboChime', freq: 523, gain: 0.4, delayMs: 50 }, { voice: 'comboChime', freq: 659, gain: 0.4, delayMs: 100 }, { voice: 'comboChime', freq: 880, gain: 0.4, delayMs: 150 }], // kaleidoscope
  singularity: [{ voice: 'castBoom', gain: 0.4 }, { voice: 'multSlam', freq: 110, gain: 0.7, delayMs: 60 }], // gravity well
  echo:        [{ voice: 'chipTick', freq: 880, gain: 0.5 }, { voice: 'chipTick', freq: 880, gain: 0.35, delayMs: 150 }, { voice: 'chipTick', freq: 880, gain: 0.22, delayMs: 280 }], // delayed copies
  voidlock:    [{ voice: 'multSlam', freq: 87, gain: 0.7 }, { voice: 'comboChime', freq: 174, gain: 0.5, delayMs: 100 }], // dark spiral
  sun_forged:  [{ voice: 'castBoom', gain: 0.5 }, { voice: 'comboChime', freq: 1568, gain: 0.7, delayMs: 60 }, { voice: 'comboChime', freq: 2093, gain: 0.5, delayMs: 130 }], // solar flare
};

export function playModAudio(modId: string): boolean {
  const cue = MOD_AUDIO_CUES[modId];
  if (!cue) return false;
  const cues = Array.isArray(cue) ? cue : [cue];
  for (const c of cues) {
    const fire = () => sfxPlay(c.voice, {
      ...(c.freq != null ? { freq: c.freq } : {}),
      ...(c.gain != null ? { gain: c.gain } : {}),
    });
    if (c.delayMs && c.delayMs > 0) setTimeout(fire, c.delayMs);
    else fire();
  }
  return true;
}
