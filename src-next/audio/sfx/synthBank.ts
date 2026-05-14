import * as Tone from 'tone';
import { Howler } from 'howler';
import { buildBuses, type Buses } from './buses';

const POOL_SIZE = 4;

export type SynthBank = {
  diceClack: { body: Tone.PluckSynth; click: Tone.NoiseSynth; sub: Tone.MembraneSynth };
  lockTap: { tap: Tone.MembraneSynth; ping: Tone.FMSynth };
  rerollPool: Array<{ shimmer: Tone.MetalSynth[]; sweep: Tone.NoiseSynth }>;
  rerollIdx: { i: number };
  buyPool: Array<{ chimeA: Tone.FMSynth; chimeB: Tone.FMSynth; rustle: Tone.NoiseSynth }>;
  buyIdx: { i: number };
  combo: { bells: Tone.PolySynth };
  upgrade: { bell: Tone.FMSynth; sparkle: Tone.PolySynth };
  bossSting: { brass: Tone.MonoSynth; sub: Tone.MonoSynth };
  bigScore: { kick: Tone.MembraneSynth; bells: Tone.PolySynth; swell: Tone.NoiseSynth };
  winFanfare: { pluck: Tone.PluckSynth; bell: Tone.FMSynth };
  bust: { saw: Tone.MonoSynth; rumble: Tone.NoiseSynth; tear: Tone.NoiseSynth };
  chipTick: { fm: Tone.FMSynth };
  castSwell: { rise: Tone.NoiseSynth; drone: Tone.PolySynth; arp: Tone.FMSynth };
  castBoom: { kick: Tone.MembraneSynth; bells: Tone.PolySynth; tail: Tone.NoiseSynth };
  sigilDraw: { scratch: Tone.NoiseSynth; chime: Tone.FMSynth };
  cardFlip: { paper: Tone.NoiseSynth; whoosh: Tone.NoiseSynth; chime: Tone.FMSynth };
  nodePulse: { bell: Tone.FMSynth; shimmer: Tone.MetalSynth };
  transitionWipe: { sweep: Tone.NoiseSynth; pad: Tone.PolySynth; arrive: Tone.FMSynth };
  modPulse: { chime: Tone.FMSynth };
  modLoaded: { chord: Tone.PolySynth; whoosh: Tone.NoiseSynth };
  modPipCharge: { tick: Tone.FMSynth };
  modBackstop: { ding: Tone.FMSynth; rumble: Tone.NoiseSynth };
  // 2026-05-14 fifth pass — bespoke voices for crown/shatter/swirl/flashback.
  modCrown: { bell: Tone.FMSynth; warmth: Tone.MembraneSynth; sparkle: Tone.MetalSynth };
  modShatter: { crack: Tone.NoiseSynth; tone: Tone.MonoSynth };
  modSwirl: { trio: Tone.PolySynth };
  modFlashback: { primary: Tone.FMSynth; ghost: Tone.FMSynth };
  // 2026-05-14 sixth pass — bespoke voices for conduit/crescendo/resonance/pyreMark/tallyMark.
  modConduit: { spark: Tone.NoiseSynth; tone: Tone.FMSynth };
  modCrescendo: { swell: Tone.NoiseSynth; chord: Tone.PolySynth };
  modResonance: { chord: Tone.PolySynth; harmonic: Tone.MetalSynth };
  modPyreMark: { ember: Tone.NoiseSynth; ping: Tone.FMSynth };
  modTallyMark: { scratch: Tone.NoiseSynth; click: Tone.MembraneSynth };
  uiClick: { click: Tone.NoiseSynth };
  uiHover: { shimmer: Tone.MetalSynth };
  modAttach: { chime: Tone.FMSynth; thud: Tone.MembraneSynth };
  modDetach: { pluck: Tone.PluckSynth };
  buses: Buses;
  master: Tone.Gain;
};

function connectAll(nodes: Tone.ToneAudioNode[], dest: Tone.ToneAudioNode): void {
  nodes.forEach((n) => n.connect(dest));
}

export async function buildBank(): Promise<SynthBank> {
  const ctx = Howler.ctx as unknown as AudioContext | null;
  if (ctx) {
    try { Tone.setContext(ctx); } catch { /* fallback */ }
  }
  await Tone.start();

  const buses = await buildBuses();

  // ---- diceClack: wood + click + sub --------------------------------------
  const diceClack = {
    body: new Tone.PluckSynth({ attackNoise: 0.3, dampening: 1200, resonance: 0.4 }),
    click: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.0005, decay: 0.012, sustain: 0, release: 0.01 } }),
    sub: new Tone.MembraneSynth({ pitchDecay: 0.012, octaves: 3, envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.04 } }),
  };
  diceClack.body.volume.value = -16;
  diceClack.click.volume.value = -22;
  diceClack.sub.volume.value = -18;
  const diceBodyHP = new Tone.Filter(200, 'lowpass');
  diceClack.body.connect(diceBodyHP); diceBodyHP.connect(buses.perc.input);
  const diceClickHP = new Tone.Filter(4000, 'highpass');
  diceClack.click.connect(diceClickHP); diceClickHP.connect(buses.perc.input);
  diceClack.sub.connect(buses.perc.input);

  // ---- lockTap: tap + ping ------------------------------------------------
  const lockTap = {
    tap: new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.04 } }),
    ping: new Tone.FMSynth({ harmonicity: 3.01, modulationIndex: 6, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 } }),
  };
  lockTap.tap.volume.value = -16;
  lockTap.ping.volume.value = -22;
  connectAll([lockTap.tap, lockTap.ping], buses.perc.input);

  // ---- reroll pool --------------------------------------------------------
  const rerollPool: SynthBank['rerollPool'] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const shimmer = [880, 1100, 1320].map((f) => {
      const m = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.14, release: 0.05 },
        harmonicity: 5.1, modulationIndex: 28, resonance: 4000, octaves: 1.2,
      });
      m.frequency.value = f;
      m.volume.value = -26;
      m.connect(buses.ui.input);
      return m;
    });
    const sweep = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.02, decay: 0.18, sustain: 0, release: 0.05 } });
    sweep.volume.value = -28;
    sweep.connect(buses.ui.input);
    rerollPool.push({ shimmer, sweep });
  }

  // ---- buy pool -----------------------------------------------------------
  const buyPool: SynthBank['buyPool'] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const chimeA = new Tone.FMSynth({ harmonicity: 3.01, modulationIndex: 12, envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 } });
    const chimeB = new Tone.FMSynth({ harmonicity: 3.01, modulationIndex: 12, envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 } });
    const rustle = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.04 } });
    chimeA.volume.value = -20;
    chimeB.volume.value = -22;
    rustle.volume.value = -28;
    connectAll([chimeA, chimeB, rustle], buses.ui.input);
    buyPool.push({ chimeA, chimeB, rustle });
  }

  // ---- combo bells --------------------------------------------------------
  const combo = {
    bells: new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01, modulationIndex: 14,
      envelope: { attack: 0.005, decay: 0.45, sustain: 0.1, release: 0.6 },
    }),
  };
  combo.bells.volume.value = -16;
  combo.bells.connect(buses.mag.input);

  // ---- upgrade ------------------------------------------------------------
  const upgrade = {
    bell: new Tone.FMSynth({ harmonicity: 3.01, modulationIndex: 14, envelope: { attack: 0.003, decay: 0.5, sustain: 0, release: 0.4 } }),
    sparkle: new Tone.PolySynth(Tone.FMSynth, { harmonicity: 5.1, modulationIndex: 8, envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.1 } }),
  };
  upgrade.bell.volume.value = -16;
  upgrade.sparkle.volume.value = -24;
  connectAll([upgrade.bell, upgrade.sparkle], buses.mag.input);

  // ---- bossSting ----------------------------------------------------------
  const bossSting = {
    brass: new Tone.MonoSynth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.08, decay: 0.5, sustain: 0.3, release: 0.6 },
      filterEnvelope: { attack: 0.05, decay: 0.5, sustain: 0.2, baseFrequency: 90, octaves: 2 },
    }),
    sub: new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.6, sustain: 0, release: 0.3 },
    }),
  };
  bossSting.brass.volume.value = -10;
  bossSting.sub.volume.value = -14;
  connectAll([bossSting.brass, bossSting.sub], buses.impact.input);

  // ---- bigScore -----------------------------------------------------------
  const bigScore = {
    kick: new Tone.MembraneSynth({ pitchDecay: 0.12, octaves: 6, envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.4 } }),
    bells: new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3.01, modulationIndex: 14, envelope: { attack: 0.005, decay: 0.8, sustain: 0.05, release: 0.7 } }),
    swell: new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.3, decay: 0.05, sustain: 0, release: 0.05 } }),
  };
  bigScore.kick.volume.value = -8;
  bigScore.bells.volume.value = -14;
  bigScore.swell.volume.value = -20;
  connectAll([bigScore.kick, bigScore.bells, bigScore.swell], buses.impact.input);

  // ---- winFanfare ---------------------------------------------------------
  const winFanfare = {
    pluck: new Tone.PluckSynth({ attackNoise: 0.4, dampening: 5000, resonance: 0.7 }),
    bell:  new Tone.FMSynth({ harmonicity: 3.01, modulationIndex: 12, envelope: { attack: 0.003, decay: 0.4, sustain: 0, release: 0.3 } }),
  };
  winFanfare.pluck.volume.value = -10;
  winFanfare.bell.volume.value = -16;
  connectAll([winFanfare.pluck, winFanfare.bell], buses.impact.input);

  // ---- bust ---------------------------------------------------------------
  const bust = {
    saw: new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.02, decay: 0.5, sustain: 0, release: 0.4 }, filterEnvelope: { attack: 0.01, decay: 0.5, sustain: 0, baseFrequency: 800, octaves: -3 } }),
    rumble: new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.05, decay: 0.6, sustain: 0, release: 0.3 } }),
    tear: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.04 } }),
  };
  bust.saw.volume.value = -12;
  bust.rumble.volume.value = -18;
  bust.tear.volume.value = -22;
  connectAll([bust.saw, bust.rumble, bust.tear], buses.impact.input);

  // ---- chipTick -----------------------------------------------------------
  const chipTick = {
    fm: new Tone.FMSynth({ harmonicity: 3.2, modulationIndex: 14, envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.05 }, modulationEnvelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.05 } }),
  };
  chipTick.fm.volume.value = -16;
  chipTick.fm.connect(buses.perc.input);

  // ---- castSwell ----------------------------------------------------------
  const castSwell = {
    rise: new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.5, decay: 0.4, sustain: 0, release: 0.2 } }),
    drone: new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.4, decay: 0.4, sustain: 0.5, release: 0.6 } }),
    arp: new Tone.FMSynth({ harmonicity: 3.01, modulationIndex: 8, envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 } }),
  };
  castSwell.rise.volume.value = -22;
  castSwell.drone.volume.value = -22;
  castSwell.arp.volume.value = -28;
  connectAll([castSwell.rise, castSwell.drone, castSwell.arp], buses.mag.input);

  // ---- castBoom -----------------------------------------------------------
  const castBoom = {
    kick: new Tone.MembraneSynth({ pitchDecay: 0.12, octaves: 6, envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.3 } }),
    bells: new Tone.PolySynth(Tone.FMSynth, { harmonicity: 3.01, modulationIndex: 12, envelope: { attack: 0.003, decay: 0.6, sustain: 0, release: 0.4 } }),
    tail: new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.15, decay: 0.05, sustain: 0, release: 0.05 } }),
  };
  castBoom.kick.volume.value = -10;
  castBoom.bells.volume.value = -16;
  castBoom.tail.volume.value = -22;
  connectAll([castBoom.kick, castBoom.bells, castBoom.tail], buses.impact.input);

  // ---- sigilDraw ----------------------------------------------------------
  const sigilDraw = {
    scratch: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 } }),
    chime: new Tone.FMSynth({ harmonicity: 3.01, modulationIndex: 10, envelope: { attack: 0.05, decay: 0.4, sustain: 0, release: 0.3 } }),
  };
  sigilDraw.scratch.volume.value = -22;
  sigilDraw.chime.volume.value = -22;
  connectAll([sigilDraw.scratch, sigilDraw.chime], buses.mag.input);

  // ---- cardFlip -----------------------------------------------------------
  const cardFlip = {
    paper: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.0005, decay: 0.012, sustain: 0, release: 0.008 } }),
    whoosh: new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.04, decay: 0.05, sustain: 0, release: 0.04 } }),
    chime: new Tone.FMSynth({ harmonicity: 3.01, modulationIndex: 10, envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.04 } }),
  };
  cardFlip.paper.volume.value = -22;
  cardFlip.whoosh.volume.value = -28;
  cardFlip.chime.volume.value = -24;
  connectAll([cardFlip.paper, cardFlip.whoosh, cardFlip.chime], buses.perc.input);

  // ---- nodePulse ----------------------------------------------------------
  const nodePulse = {
    bell: new Tone.FMSynth({ harmonicity: 3.01, modulationIndex: 10, envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.1 } }),
    shimmer: new Tone.MetalSynth({ envelope: { attack: 0.002, decay: 0.2, release: 0.05 }, harmonicity: 5.1, modulationIndex: 24, resonance: 3500, octaves: 1.5 }),
  };
  nodePulse.bell.volume.value = -22;
  nodePulse.shimmer.frequency.value = 1200;
  nodePulse.shimmer.volume.value = -30;
  connectAll([nodePulse.bell, nodePulse.shimmer], buses.mag.input);

  // ---- transitionWipe -----------------------------------------------------
  const transitionWipe = {
    sweep: new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.1, decay: 0.3, sustain: 0, release: 0.2 } }),
    pad: new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.2, decay: 0.4, sustain: 0.4, release: 0.5 } }),
    arrive: new Tone.FMSynth({ harmonicity: 3.01, modulationIndex: 10, envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.1 } }),
  };
  transitionWipe.sweep.volume.value = -22;
  transitionWipe.pad.volume.value = -26;
  transitionWipe.arrive.volume.value = -22;
  connectAll([transitionWipe.sweep, transitionWipe.pad, transitionWipe.arrive], buses.ui.input);

  // ---- modPulse: bright single chime ----
  const modPulse = {
    chime: new Tone.FMSynth({
      modulationIndex: 6,
      envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.12 },
      modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    }),
  };
  modPulse.chime.connect(buses.mag.input);

  // ---- modLoaded: rising chord + whoosh ----
  const modLoaded = {
    chord: new Tone.PolySynth(Tone.FMSynth, {
      envelope: { attack: 0.04, decay: 0.4, sustain: 0.0, release: 0.3 },
    }),
    whoosh: new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0, release: 0.2 },
    }),
  };
  modLoaded.chord.connect(buses.mag.input);
  modLoaded.whoosh.connect(buses.perc.input);

  // ---- modPipCharge: percussive electrical tick ----
  const modPipCharge = {
    tick: new Tone.FMSynth({
      modulationIndex: 12,
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
    }),
  };
  modPipCharge.tick.connect(buses.perc.input);

  // ---- modBackstop: warm low ding + soft rumble ----
  const modBackstop = {
    ding: new Tone.FMSynth({
      envelope: { attack: 0.005, decay: 0.25, sustain: 0.05, release: 0.4 },
    }),
    rumble: new Tone.NoiseSynth({
      noise: { type: 'brown' },
      envelope: { attack: 0.02, decay: 0.5, sustain: 0, release: 0.3 },
    }),
  };
  modBackstop.ding.connect(buses.mag.input);
  modBackstop.rumble.connect(buses.perc.input);

  // ---- modCrown: regal bell + soft warmth + a small sparkle ----
  // Plays when Crown fires on a 6. Brighter and longer than modBackstop;
  // sparkle layered for the "legendary moment" flavour.
  const modCrown = {
    bell: new Tone.FMSynth({
      modulationIndex: 4,
      envelope: { attack: 0.002, decay: 0.32, sustain: 0.06, release: 0.45 },
    }),
    warmth: new Tone.MembraneSynth({
      pitchDecay: 0.04, octaves: 4,
      envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.12 },
    }),
    sparkle: new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.04 },
      harmonicity: 5.1, modulationIndex: 32, resonance: 4200, octaves: 1.5,
    }),
  };
  modCrown.bell.connect(buses.mag.input);
  modCrown.warmth.connect(buses.perc.input);
  modCrown.sparkle.connect(buses.ui.input);

  // ---- modShatter: short pink-noise crack + descending tone -----
  // The tone glides down a fifth quickly — sounds like fracture energy
  // dissipating. Used by Brittle.
  const modShatter = {
    crack: new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.04 },
    }),
    tone: new Tone.MonoSynth({
      envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.12 },
      filterEnvelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.12, baseFrequency: 200, octaves: 3 },
    }),
  };
  modShatter.crack.connect(buses.perc.input);
  modShatter.tone.connect(buses.mag.input);

  // ---- modSwirl: 3-note chord arpeggiated tightly --------------
  // The Wildcard's "face cycling" resolved sonically as three quick
  // notes flicking by.
  const modSwirl = {
    trio: new Tone.PolySynth(Tone.FMSynth, {
      envelope: { attack: 0.001, decay: 0.10, sustain: 0, release: 0.08 },
    }),
  };
  modSwirl.trio.connect(buses.mag.input);

  // ---- modFlashback: primary chime + delayed ghost chime --------
  // Echo's double-pulse visual gets its audio twin — same note, 120ms
  // later, slightly detuned.
  const modFlashback = {
    primary: new Tone.FMSynth({
      modulationIndex: 5,
      envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.10 },
    }),
    ghost: new Tone.FMSynth({
      modulationIndex: 8,
      envelope: { attack: 0.003, decay: 0.22, sustain: 0, release: 0.16 },
    }),
  };
  modFlashback.primary.connect(buses.mag.input);
  modFlashback.ghost.connect(buses.mag.input);

  // ---- modConduit: brief electric spark + ascending tone --------
  // Sparkle-up that fits the "chain triggering forward" visual.
  const modConduit = {
    spark: new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    }),
    tone: new Tone.FMSynth({
      modulationIndex: 8,
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 },
    }),
  };
  modConduit.spark.connect(buses.perc.input);
  modConduit.tone.connect(buses.mag.input);

  // ---- modCrescendo: pink swell + soft chord ---------------------
  // Wave swelling forward — long attack on the noise, chord arrives
  // 60ms later as the wave peaks.
  const modCrescendo = {
    swell: new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.12, decay: 0.18, sustain: 0, release: 0.12 },
    }),
    chord: new Tone.PolySynth(Tone.FMSynth, {
      envelope: { attack: 0.02, decay: 0.24, sustain: 0, release: 0.16 },
    }),
  };
  modCrescendo.swell.connect(buses.perc.input);
  modCrescendo.chord.connect(buses.mag.input);

  // ---- modResonance: held chord + harmonic shimmer ---------------
  // For Resonance (legendary double-fire). Beat-frequency feel.
  const modResonance = {
    chord: new Tone.PolySynth(Tone.FMSynth, {
      modulationIndex: 6,
      envelope: { attack: 0.005, decay: 0.32, sustain: 0.10, release: 0.40 },
    }),
    harmonic: new Tone.MetalSynth({
      envelope: { attack: 0.005, decay: 0.20, sustain: 0, release: 0.12 },
      harmonicity: 3.1, modulationIndex: 18, resonance: 3500, octaves: 1.2,
    }),
  };
  modResonance.chord.connect(buses.mag.input);
  modResonance.harmonic.connect(buses.ui.input);

  // ---- modPyreMark: short ember crackle + tiny ping --------------
  // One-stack accrual — small, frequent, doesn't hog the mix.
  const modPyreMark = {
    ember: new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    }),
    ping: new Tone.FMSynth({
      modulationIndex: 10,
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
    }),
  };
  modPyreMark.ember.connect(buses.perc.input);
  modPyreMark.ping.connect(buses.mag.input);

  // ---- modTallyMark: pencil scratch + low click ------------------
  // Tally Mark scribes a new tick. Reads like ink-on-paper.
  const modTallyMark = {
    scratch: new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    }),
    click: new Tone.MembraneSynth({
      pitchDecay: 0.01, octaves: 2,
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 },
    }),
  };
  modTallyMark.scratch.connect(buses.ui.input);
  modTallyMark.click.connect(buses.perc.input);

  // ---- uiClick: very short white noise burst ----
  const uiClick = {
    click: new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.002, decay: 0.012, sustain: 0, release: 0.008 },
    }),
  };
  const uiClickHP = new Tone.Filter(2500, 'highpass');
  uiClick.click.connect(uiClickHP);
  uiClickHP.connect(buses.ui.input);

  // ---- uiHover: brief metallic shimmer ----
  const uiHover = {
    shimmer: new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }),
  };
  uiHover.shimmer.connect(buses.ui.input);

  // ---- modAttach: chime + soft thud ----
  const modAttach = {
    chime: new Tone.FMSynth({
      modulationIndex: 4,
      envelope: { attack: 0.005, decay: 0.18, sustain: 0, release: 0.12 },
    }),
    thud: new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
    }),
  };
  modAttach.chime.connect(buses.mag.input);
  modAttach.thud.connect(buses.perc.input);

  // ---- modDetach: descending pluck ----
  const modDetach = {
    pluck: new Tone.PluckSynth({ attackNoise: 0.4, dampening: 1500, resonance: 0.5 }),
  };
  modDetach.pluck.connect(buses.mag.input);

  return {
    diceClack, lockTap, rerollPool, rerollIdx: { i: 0 },
    buyPool, buyIdx: { i: 0 }, combo, upgrade, bossSting, bigScore, winFanfare, bust, chipTick,
    castSwell, castBoom, sigilDraw, cardFlip, nodePulse, transitionWipe,
    modPulse,
    modLoaded,
    modPipCharge,
    modBackstop,
    modCrown,
    modShatter,
    modSwirl,
    modFlashback,
    modConduit,
    modCrescendo,
    modResonance,
    modPyreMark,
    modTallyMark,
    uiClick,
    uiHover,
    modAttach,
    modDetach,
    buses, master: buses.master,
  };
}
