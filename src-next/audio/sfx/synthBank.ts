import * as Tone from 'tone';
import { Howler } from 'howler';

const POOL_SIZE = 4;

export type SynthBank = {
  diceClack: Tone.NoiseSynth;
  lockTap: Tone.MembraneSynth;
  rerollPool: Tone.MetalSynth[];
  buyPool: Tone.MetalSynth[];
  combo: Tone.PolySynth;
  upgrade: Tone.PluckSynth;
  bossSting: Tone.MonoSynth;
  bigScore: Tone.NoiseSynth;
  winFanfare: Tone.PolySynth;
  bust: Tone.MonoSynth;
  reverb: Tone.Reverb;
  delay: Tone.PingPongDelay;
  master: Tone.Gain;
  rerollIdx: { i: number };
  buyIdx: { i: number };
};

function makeMetal(freq: number, harmonicity: number, modIdx: number, resonance: number, master: Tone.Gain, vol = -22): Tone.MetalSynth[] {
  const arr: Tone.MetalSynth[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const m = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.16, release: 0.05 },
      harmonicity,
      modulationIndex: modIdx,
      resonance,
      octaves: 1.5,
    });
    m.volume.value = vol;
    m.frequency.value = freq;
    m.connect(master);
    arr.push(m);
  }
  return arr;
}

export async function buildBank(): Promise<SynthBank> {
  const ctx = Howler.ctx as unknown as AudioContext | null;
  if (ctx) {
    try { Tone.setContext(ctx); } catch { /* fallback */ }
  }
  await Tone.start();

  const master = new Tone.Gain(0.7).toDestination();
  const reverb = new Tone.Reverb({ decay: 1.6, wet: 0.35 }).connect(master);
  await reverb.generate();
  const delay = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.3, wet: 0.35 }).connect(master);

  const diceClack = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.05 },
  });
  diceClack.volume.value = -18;
  diceClack.connect(master);

  const lockTap = new Tone.MembraneSynth({
    pitchDecay: 0.008,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
  });
  lockTap.volume.value = -16;
  lockTap.connect(master);

  const rerollPool = makeMetal(880, 5.1, 32, 4000, master, -22);
  const buyPool = makeMetal(1320, 8, 16, 5000, master, -20);

  const combo = new Tone.PolySynth(Tone.FMSynth, {
    oscillator: { type: 'sine' },
    modulation: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.4 },
  });
  combo.volume.value = -14;
  combo.connect(reverb);

  const upgrade = new Tone.PluckSynth({ attackNoise: 0.5, dampening: 4000, resonance: 0.5 });
  upgrade.volume.value = -16;
  upgrade.connect(master);

  const bossSting = new Tone.MonoSynth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.02, decay: 0.4, sustain: 0.3, release: 0.5 },
    filterEnvelope: { attack: 0.05, decay: 0.5, sustain: 0.2, baseFrequency: 100, octaves: 2 },
  });
  bossSting.volume.value = -10;
  bossSting.connect(reverb);

  const bigScore = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.2 },
  });
  bigScore.volume.value = -10;
  bigScore.connect(reverb);

  const winFanfare = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.3 },
  });
  winFanfare.volume.value = -12;
  winFanfare.connect(delay);
  winFanfare.connect(master);

  const bust = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.02, decay: 0.5, sustain: 0.0, release: 0.4 },
    filterEnvelope: { attack: 0.01, decay: 0.5, sustain: 0, baseFrequency: 800, octaves: -3 },
  });
  bust.volume.value = -12;
  bust.connect(master);

  return {
    diceClack, lockTap, rerollPool, buyPool, combo, upgrade,
    bossSting, bigScore, winFanfare, bust,
    reverb, delay, master,
    rerollIdx: { i: 0 },
    buyIdx: { i: 0 },
  };
}
