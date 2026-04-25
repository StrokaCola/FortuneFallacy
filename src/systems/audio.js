// Audio overhaul layer. Phase 7.
//
// Builds richer SFX using Tone.js and migrates bg-music playback to
// Howler.js for reliable looping, mobile-autoplay unlock, and smooth
// volume ramps. Existing main.js SFX.* object stays intact; this module
// provides supplementary sounds and can be gradually adopted by migrating
// call sites one at a time.

import * as Tone from 'tone';
import { Howl, Howler } from 'howler';

let toneReady = false;
let bgHowl = null;
let bus = null;  // shared Tone output bus

// ─── Start Tone on first user interaction ─────────────────────────────────
export async function ensureToneStarted() {
  if (toneReady) return true;
  try {
    await Tone.start();
    const compressor = new Tone.Compressor({ threshold: -18, ratio: 4, attack: 0.003, release: 0.12 });
    const gain = new Tone.Gain(0.9);
    compressor.connect(gain).toDestination();
    bus = gain;
    toneReady = true;
  } catch (e) {
    console.warn('Tone.js failed to start:', e.message);
  }
  return toneReady;
}

// ─── Music (Howler) ──────────────────────────────────────────────────────
export function initMusic(initialVolume = 0.5) {
  if (bgHowl) return bgHowl;
  bgHowl = new Howl({
    src: [`${import.meta.env.BASE_URL}bg-music.mp3`],
    loop: true,
    volume: clamp01(initialVolume),
    html5: true,  // stream rather than decode into memory
  });
  return bgHowl;
}

export function playMusic() {
  if (!bgHowl) initMusic();
  if (!bgHowl.playing()) bgHowl.play();
}

export function pauseMusic() {
  if (bgHowl && bgHowl.playing()) bgHowl.pause();
}

export function setMusicVolume(v) {
  const vv = clamp01(v);
  if (bgHowl) bgHowl.volume(vv);
  try { localStorage.setItem('ff_musicVol', String(vv)); } catch {}
}

function clamp01(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }

// ─── New SFX: Boss Blind reveal ───────────────────────────────────────────
export async function sfxBossReveal() {
  if (!await ensureToneStarted()) return;
  const now = Tone.now();
  // Low drum hit
  const drum = new Tone.MembraneSynth({
    pitchDecay: 0.08,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.0, release: 0.3 },
  }).connect(bus);
  drum.triggerAttackRelease('C1', '8n', now);
  // Rising tension chord (minor 2nd dissonance)
  const poly = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.2, release: 0.35 },
  }).connect(bus);
  poly.triggerAttackRelease(['G2', 'Ab2', 'D3'], '4n', now + 0.12);
  // Descending resolve
  const pluck = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.3 },
  }).connect(bus);
  const descend = ['Eb4', 'D4', 'Db4', 'C4'];
  descend.forEach((n, i) => pluck.triggerAttackRelease(n, '16n', now + 0.45 + i * 0.08));
  // Dispose
  setTimeout(() => { drum.dispose(); poly.dispose(); pluck.dispose(); }, 1800);
}

// ─── New SFX: Consumable use ──────────────────────────────────────────────
export async function sfxConsumeCard() {
  if (!await ensureToneStarted()) return;
  const now = Tone.now();
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.1, release: 0.35 },
  }).connect(bus);
  // Shimmery ascending arp
  const notes = ['G4', 'B4', 'D5', 'F#5', 'A5'];
  notes.forEach((n, i) => synth.triggerAttackRelease(n, '16n', now + i * 0.045));
  setTimeout(() => synth.dispose(), 900);
}

// ─── New SFX: Voucher purchase ────────────────────────────────────────────
export async function sfxVoucherBuy() {
  if (!await ensureToneStarted()) return;
  const now = Tone.now();
  const poly = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.03, decay: 0.35, sustain: 0.3, release: 0.7 },
  }).connect(bus);
  // Warm 4-note chord with subtle reverb feel (no Reverb node — decay naturally)
  poly.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], '2n', now);
  // Sparkle on top
  const bell = new Tone.MetalSynth({
    frequency: 1200,
    envelope: { attack: 0.001, decay: 0.3, release: 0.4 },
    harmonicity: 8.5,
    modulationIndex: 40,
    resonance: 4000,
    octaves: 1.2,
  }).connect(bus);
  bell.volume.value = -12;
  bell.triggerAttackRelease('32n', now + 0.2);
  setTimeout(() => { poly.dispose(); bell.dispose(); }, 1500);
}

// ─── New SFX: Skip blind (coin ching) ─────────────────────────────────────
export async function sfxSkipBlind() {
  if (!await ensureToneStarted()) return;
  const now = Tone.now();
  const bell = new Tone.MetalSynth({
    frequency: 880,
    envelope: { attack: 0.001, decay: 0.12, release: 0.15 },
    harmonicity: 5.1,
    modulationIndex: 22,
    resonance: 3600,
    octaves: 1.0,
  }).connect(bus);
  bell.volume.value = -8;
  bell.triggerAttackRelease('16n', now);
  setTimeout(() => bell.dispose(), 600);
}

// ─── New SFX: Combo bell (tier-pitched strike + choir swell) ──────────────
// tier 0..8 (Chance..Five-of-a-Kind). Higher tier = brighter, longer.
export async function sfxComboBell(tier = 0) {
  if (!await ensureToneStarted()) return;
  const now = Tone.now();
  const t   = Math.max(0, Math.min(8, tier|0));
  const pitches = ['C4','D4','E4','G4','A4','C5','E5','G5','C6'];
  const bell = new Tone.MetalSynth({
    frequency: 600 + t * 80,
    envelope: { attack: 0.001, decay: 0.35 + t*0.04, release: 0.4 + t*0.05 },
    harmonicity: 4.5 + t * 0.5,
    modulationIndex: 18 + t * 3,
    resonance: 3200 + t * 200,
    octaves: 1.3,
  }).connect(bus);
  bell.volume.value = -10;
  bell.triggerAttackRelease('16n', now);
  // Choir swell on tier 4+
  if (t >= 4) {
    const choir = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.18, decay: 0.4, sustain: 0.3, release: 0.6 },
    }).connect(bus);
    choir.volume.value = -16;
    choir.triggerAttackRelease([pitches[t], pitches[Math.min(8, t+2)]], '4n', now + 0.04);
    setTimeout(() => choir.dispose(), 1400);
  }
  setTimeout(() => bell.dispose(), 1200);
}

// ─── New SFX: Holographic dice chime ──────────────────────────────────────
export async function sfxHoloChime() {
  if (!await ensureToneStarted()) return;
  const now = Tone.now();
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.45 },
  }).connect(bus);
  synth.volume.value = -14;
  ['E5','A5','C#6','E6'].forEach((n, i) => synth.triggerAttackRelease(n, '32n', now + i * 0.025));
  setTimeout(() => synth.dispose(), 900);
}

// ─── New SFX: Flame crackle on flaming-die land ───────────────────────────
export async function sfxFireCrackle() {
  if (!await ensureToneStarted()) return;
  const now = Tone.now();
  const noise = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.005, decay: 0.18, sustain: 0, release: 0.1 },
  }).connect(bus);
  noise.volume.value = -18;
  noise.triggerAttackRelease('16n', now);
  noise.triggerAttackRelease('32n', now + 0.09);
  setTimeout(() => noise.dispose(), 700);
}

// ─── New SFX: Five-of-a-Kind stinger ──────────────────────────────────────
export async function sfxFiveOfAKindStinger() {
  if (!await ensureToneStarted()) return;
  const now = Tone.now();
  const organ = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.01, decay: 0.6, sustain: 0.4, release: 1.2 },
  }).connect(bus);
  organ.volume.value = -10;
  organ.triggerAttackRelease(['C3','Eb3','G3','Bb3','D4'], '2n', now);
  const bell = new Tone.MetalSynth({
    frequency: 1800,
    envelope: { attack: 0.001, decay: 0.6, release: 0.8 },
    harmonicity: 9, modulationIndex: 50, resonance: 5000, octaves: 1.5,
  }).connect(bus);
  bell.volume.value = -8;
  bell.triggerAttackRelease('8n', now + 0.1);
  setTimeout(() => { organ.dispose(); bell.dispose(); }, 2400);
}
