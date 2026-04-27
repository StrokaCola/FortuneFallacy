# SFX Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the 17 SFX voices in `src-next/audio/sfx/` from single-source synth blips into layered, musically coherent, sidechained voices anchored in C# minor pentatonic — without changing the public `SfxId` API.

**Architecture:** Introduce two new modules (`voicing.ts` for scales/jitter, `buses.ts` for routing) and rewrite `synthBank.ts` + `voices.ts` to use them. Each voice = transient + body + tail layers fed through one of four category buses (`perc | mag | impact | ui`) → FX sends (plate / hall / delay) → master (compressor + limiter + sidechain key). Impact voices duck the master via a control-rate gain ramp.

**Tech Stack:** TypeScript, Tone.js v15, Howler v2 (already installed), Vitest for unit tests. Spec: [docs/superpowers/specs/2026-04-26-sfx-upgrade-design.md](../specs/2026-04-26-sfx-upgrade-design.md).

---

## File Structure

```
src-next/audio/sfx/
├── index.ts        ← public API (unchanged signatures, +legacy toggle)
├── voicing.ts      ← NEW: SCALES, tierToNotes(), jitter(), volumeMemory
├── buses.ts        ← NEW: buildBuses(), triggerDuck()
├── synthBank.ts    ← REWRITE: layered voice construction wired to buses
├── voices.ts       ← REWRITE: layered triggers with variation
└── __tests__/
    ├── voicing.test.ts   ← NEW
    └── buses.test.ts     ← NEW
```

`index.ts`: tiny additive change (read legacy flag, route to legacy bank if set). Public exports `SfxId`, `sfxPlay`, `sfxInit`, `sfxSetMaster`, `sfxGetMaster`, `sfxBank` keep their signatures.

---

## Task 1: Voicing module — scales, tier→notes, jitter helpers

**Files:**
- Create: `src-next/audio/sfx/voicing.ts`
- Test: `src-next/audio/sfx/__tests__/voicing.test.ts`

- [ ] **Step 1.1: Write failing tests for `voicing.ts`**

Create `src-next/audio/sfx/__tests__/voicing.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  PENTATONIC_CSM_HZ, MINOR_CSM_HZ,
  tierToNotes, jitterCents, jitterDb, jitterMs,
  pickPent, makeVolumeMemory,
} from '../voicing';

describe('voicing scales', () => {
  it('exposes 5 pentatonic notes per octave', () => {
    // C# minor pent = C#, D#, F#, G#, B
    expect(PENTATONIC_CSM_HZ.length).toBeGreaterThanOrEqual(5);
    // first 5 entries should be ascending
    for (let i = 1; i < 5; i++) {
      expect(PENTATONIC_CSM_HZ[i]!).toBeGreaterThan(PENTATONIC_CSM_HZ[i - 1]!);
    }
  });

  it('exposes 7 natural-minor notes per octave', () => {
    expect(MINOR_CSM_HZ.length).toBeGreaterThanOrEqual(7);
  });

  it('C#4 ≈ 277.18 Hz appears in MINOR_CSM_HZ', () => {
    const found = MINOR_CSM_HZ.some((f) => Math.abs(f - 277.18) < 1);
    expect(found).toBe(true);
  });
});

describe('tierToNotes', () => {
  it('tier 1 returns a single note', () => {
    expect(tierToNotes(1)).toHaveLength(1);
  });
  it('tier 4 returns 2 notes', () => {
    expect(tierToNotes(4)).toHaveLength(2);
  });
  it('tier 6 returns 3 notes', () => {
    expect(tierToNotes(6)).toHaveLength(3);
  });
  it('tier 8 returns 5 notes', () => {
    expect(tierToNotes(8)).toHaveLength(5);
  });
  it('clamps to [1,8]', () => {
    expect(tierToNotes(-3)).toHaveLength(1);
    expect(tierToNotes(99)).toHaveLength(5);
  });
  it('every returned note is a positive number (Hz)', () => {
    tierToNotes(8).forEach((n) => expect(n).toBeGreaterThan(0));
  });
});

describe('jitter helpers', () => {
  it('jitterCents stays within ±25', () => {
    for (let i = 0; i < 200; i++) {
      const c = jitterCents();
      expect(c).toBeGreaterThanOrEqual(-25);
      expect(c).toBeLessThanOrEqual(25);
    }
  });
  it('jitterDb stays within ±1.5', () => {
    for (let i = 0; i < 200; i++) {
      const d = jitterDb();
      expect(d).toBeGreaterThanOrEqual(-1.5);
      expect(d).toBeLessThanOrEqual(1.5);
    }
  });
  it('jitterMs stays within [0, 12]', () => {
    for (let i = 0; i < 200; i++) {
      const m = jitterMs();
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(12);
    }
  });
});

describe('pickPent', () => {
  it('idx 0 returns root', () => {
    expect(pickPent(0)).toBe(PENTATONIC_CSM_HZ[0]);
  });
  it('idx wraps with octave climb', () => {
    expect(pickPent(5)).toBeGreaterThan(PENTATONIC_CSM_HZ[4]!);
  });
});

describe('volumeMemory', () => {
  it('biases away from recently used volumes', () => {
    const mem = makeVolumeMemory();
    const samples: number[] = [];
    for (let i = 0; i < 30; i++) samples.push(mem.next(-12, 1.5));
    // mean within tolerance of -12
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(Math.abs(mean - -12)).toBeLessThan(0.6);
    // no two consecutive equal-to-many-decimals draws
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).not.toBe(samples[i - 1]);
    }
  });
});
```

- [ ] **Step 1.2: Run tests, confirm they fail**

Run: `npx vitest run src-next/audio/sfx/__tests__/voicing.test.ts`
Expected: FAIL — module `../voicing` cannot be resolved.

- [ ] **Step 1.3: Implement `voicing.ts`**

Create `src-next/audio/sfx/voicing.ts`:

```ts
// C# minor + pentatonic note tables, tier→note maps, per-trigger jitter,
// and a volume-memory helper that biases away from recent draws.

// Hz values for C# minor pentatonic across octaves 3..6.
// Pentatonic notes (C#, D#, F#, G#, B). Octave 3 root = C#3 ≈ 138.59 Hz.
const C_MINUS_1 = 8.1757989156; // standard MIDI A0 anchor for C-1 frequency
function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
// MIDI numbers for C# in octaves 3..6: 49, 61, 73, 85
const PENT_INTERVALS = [0, 2, 5, 7, 10]; // semitones above root for C#m pent
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // C# natural minor
const ROOT_OCTAVES = [49, 61, 73, 85]; // C#3..C#6 MIDI

export const PENTATONIC_CSM_HZ: number[] = ROOT_OCTAVES.flatMap((root) =>
  PENT_INTERVALS.map((iv) => midiToHz(root + iv)),
);

export const MINOR_CSM_HZ: number[] = ROOT_OCTAVES.flatMap((root) =>
  MINOR_INTERVALS.map((iv) => midiToHz(root + iv)),
);

// Tier → number of notes, in pentatonic ascending order from a tier-scaled root octave.
const TIER_LEN: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 5, 8: 5 };

export function tierToNotes(tier: number): number[] {
  const t = Math.max(1, Math.min(8, Math.round(tier)));
  const len = TIER_LEN[t]!;
  // start octave ramps with tier (tier 1-2 → oct 3, 3-4 → 4, 5-6 → 5, 7-8 → 5+climb)
  const startOctIdx = Math.min(2, Math.floor((t - 1) / 2));
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    out.push(pickPent(startOctIdx * 5 + i));
  }
  return out;
}

// idx 0 → PENTATONIC_CSM_HZ[0] (root in lowest octave), wraps to next octave automatically.
export function pickPent(idx: number): number {
  const i = ((idx % PENTATONIC_CSM_HZ.length) + PENTATONIC_CSM_HZ.length) % PENTATONIC_CSM_HZ.length;
  return PENTATONIC_CSM_HZ[i]!;
}

// Per-trigger variation helpers. Uniform random within the spec's bounds.
export function jitterCents(): number {
  return (Math.random() * 2 - 1) * 25;
}
export function jitterDb(): number {
  return (Math.random() * 2 - 1) * 1.5;
}
export function jitterMs(): number {
  return Math.random() * 12;
}

// Convert ±cents to a frequency multiplier.
export function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200);
}

// Memory-biased volume picker: tracks last 3 dB draws and biases new draws to be at
// least 0.4 dB different from any of the recent ones, falling back to a fresh random
// after 4 attempts.
export function makeVolumeMemory(): { next(centerDb: number, spreadDb: number): number } {
  const recent: number[] = [];
  return {
    next(centerDb: number, spreadDb: number): number {
      let pick = 0;
      for (let attempt = 0; attempt < 4; attempt++) {
        pick = centerDb + (Math.random() * 2 - 1) * spreadDb;
        if (recent.every((r) => Math.abs(r - pick) > 0.4)) break;
      }
      recent.push(pick);
      if (recent.length > 3) recent.shift();
      return pick;
    },
  };
}
```

- [ ] **Step 1.4: Run tests, confirm they pass**

Run: `npx vitest run src-next/audio/sfx/__tests__/voicing.test.ts`
Expected: all PASS.

- [ ] **Step 1.5: Commit**

```bash
git add src-next/audio/sfx/voicing.ts src-next/audio/sfx/__tests__/voicing.test.ts
git commit -m "feat(audio): voicing module — C#m scales, tier maps, jitter helpers

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Bus topology — category buses, FX sends, sidechain duck

**Files:**
- Create: `src-next/audio/sfx/buses.ts`
- Test: `src-next/audio/sfx/__tests__/buses.test.ts`

- [ ] **Step 2.1: Write failing tests**

Create `src-next/audio/sfx/__tests__/buses.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import * as Tone from 'tone';
import { buildBuses, triggerDuck, type Buses } from '../buses';

describe('buses', () => {
  let buses: Buses;

  beforeAll(async () => {
    // Vitest runs in jsdom; provide a dummy AudioContext shim if absent.
    if (typeof AudioContext === 'undefined') {
      // @ts-expect-error: minimal shim for unit tests
      globalThis.AudioContext = class { state='running'; currentTime=0; createGain(){return { connect(){}, disconnect(){}, gain:{value:0,setTargetAtTime(){},cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){}} };} };
    }
    buses = await buildBuses();
  });

  it('exposes 4 category buses', () => {
    expect(buses.perc).toBeDefined();
    expect(buses.mag).toBeDefined();
    expect(buses.impact).toBeDefined();
    expect(buses.ui).toBeDefined();
  });

  it('exposes 3 FX send nodes', () => {
    expect(buses.plate).toBeDefined();
    expect(buses.hall).toBeDefined();
    expect(buses.delay).toBeDefined();
  });

  it('exposes a master gain', () => {
    expect(buses.master).toBeDefined();
  });

  it('triggerDuck schedules without throwing', () => {
    expect(() => triggerDuck(buses, 4, 80, 250)).not.toThrow();
  });
});
```

- [ ] **Step 2.2: Run tests, confirm they fail**

Run: `npx vitest run src-next/audio/sfx/__tests__/buses.test.ts`
Expected: FAIL — module `../buses` cannot be resolved.

- [ ] **Step 2.3: Implement `buses.ts`**

Create `src-next/audio/sfx/buses.ts`:

```ts
import * as Tone from 'tone';

export type Bus = {
  input: Tone.Gain;
  eq: Tone.EQ3;
  comp: Tone.Compressor;
  plateSend: Tone.Gain;
  hallSend: Tone.Gain;
  delaySend: Tone.Gain;
  output: Tone.Gain;
};

export type Buses = {
  perc: Bus;
  mag: Bus;
  impact: Bus;
  ui: Bus;
  plate: Tone.Reverb;
  hall: Tone.Reverb;
  delay: Tone.PingPongDelay;
  master: Tone.Gain;
  sidechainKey: Tone.Gain; // control-rate gain used to duck master
  postKey: Tone.Gain;      // signal path that gets ducked
};

type BusSpec = {
  hp: number;
  midDb: number;
  midFreq: number;
  highDb: number;
  highFreq: number;
  compThreshDb: number;
  compRatio: number;
  plate: number;
  hall: number;
  delay: number;
};

const SPECS: Record<'perc' | 'mag' | 'impact' | 'ui', BusSpec> = {
  perc:   { hp: 80,  midDb: -2, midFreq: 350,  highDb: 3, highFreq: 5000, compThreshDb: -14, compRatio: 4, plate: 0.10, hall: 0.05, delay: 0.05 },
  mag:    { hp: 200, midDb:  0, midFreq: 700,  highDb: 3, highFreq: 3000, compThreshDb: -16, compRatio: 3, plate: 0.25, hall: 0.15, delay: 0.10 },
  impact: { hp: 0,   midDb:  0, midFreq: 600,  highDb: 0, highFreq: 5000, compThreshDb: -12, compRatio: 6, plate: 0.10, hall: 0.35, delay: 0.20 },
  ui:     { hp: 400, midDb:  0, midFreq: 1500, highDb: 0, highFreq: 6000, compThreshDb: -18, compRatio: 3, plate: 0.15, hall: 0.0,  delay: 0.05 },
};

function makeBus(spec: BusSpec, plate: Tone.Reverb, hall: Tone.Reverb, delay: Tone.PingPongDelay, master: Tone.Gain): Bus {
  const input = new Tone.Gain(1);
  // Tone.EQ3 has low/mid/high bands; we configure with our hp + mid + high spec.
  const eq = new Tone.EQ3(0, spec.midDb, spec.highDb);
  eq.lowFrequency.value = spec.hp;
  eq.highFrequency.value = spec.highFreq;
  // Tone.EQ3 doesn't expose midFrequency in v15; we approximate with low/high only.
  const comp = new Tone.Compressor(spec.compThreshDb, spec.compRatio);

  const plateSend = new Tone.Gain(spec.plate);
  const hallSend = new Tone.Gain(spec.hall);
  const delaySend = new Tone.Gain(spec.delay);
  const output = new Tone.Gain(1);

  input.connect(eq);
  eq.connect(comp);
  comp.connect(output);
  comp.connect(plateSend);
  comp.connect(hallSend);
  comp.connect(delaySend);
  plateSend.connect(plate);
  hallSend.connect(hall);
  delaySend.connect(delay);
  output.connect(master);

  return { input, eq, comp, plateSend, hallSend, delaySend, output };
}

export async function buildBuses(): Promise<Buses> {
  const master = new Tone.Gain(0.7);

  // Sidechain path: any signal routed through `postKey` gets multiplied by sidechainKey.
  const sidechainKey = new Tone.Gain(1); // 1 = no duck, 0 = full duck
  const postKey = new Tone.Gain(1);
  postKey.connect(sidechainKey);
  sidechainKey.connect(master);

  // Final master limiter to catch any peaks; -1 dBFS ceiling.
  const limiter = new Tone.Limiter(-1);
  master.connect(limiter);
  limiter.toDestination();

  const plate = new Tone.Reverb({ decay: 0.8, wet: 1.0 });
  const hall = new Tone.Reverb({ decay: 2.4, wet: 1.0 });
  await plate.generate();
  await hall.generate();
  const delay = new Tone.PingPongDelay({ delayTime: '8n', feedback: 0.3, wet: 1.0 });

  // Reverb / delay outputs feed into the post-key path so they also duck.
  plate.connect(postKey);
  hall.connect(postKey);
  delay.connect(postKey);

  const perc   = makeBus(SPECS.perc,   plate, hall, delay, postKey);
  const mag    = makeBus(SPECS.mag,    plate, hall, delay, postKey);
  const impact = makeBus(SPECS.impact, plate, hall, delay, postKey);
  const ui     = makeBus(SPECS.ui,     plate, hall, delay, postKey);

  return { perc, mag, impact, ui, plate, hall, delay, master, sidechainKey, postKey };
}

// Ducks the `sidechainKey` gain by `dB` over `attackMs`, then releases over `releaseMs`.
export function triggerDuck(buses: Buses, dB: number, attackMs: number, releaseMs: number): void {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const now = ctx.currentTime;
  const attackS = attackMs / 1000;
  const releaseS = releaseMs / 1000;
  const target = Math.pow(10, -Math.abs(dB) / 20);
  const param = buses.sidechainKey.gain;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(target, now + attackS);
  param.linearRampToValueAtTime(1, now + attackS + releaseS);
}
```

- [ ] **Step 2.4: Run tests, confirm they pass**

Run: `npx vitest run src-next/audio/sfx/__tests__/buses.test.ts`
Expected: all PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src-next/audio/sfx/buses.ts src-next/audio/sfx/__tests__/buses.test.ts
git commit -m "feat(audio): bus topology with category buses, FX sends, sidechain key

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Rewrite `synthBank.ts` to layered voices wired to buses

**Files:**
- Modify (full rewrite): `src-next/audio/sfx/synthBank.ts`

This task changes runtime behavior; tests are integration-light (build-doesn't-throw + voice exists). Sound quality verified manually in Task 6.

- [ ] **Step 3.1: Add a build-smoke test**

Append to `src-next/audio/sfx/__tests__/buses.test.ts` (same file is fine — bank build depends on buses):

```ts
import { buildBank } from '../synthBank';

describe('synthBank build', () => {
  it('builds without throwing and exposes all voice keys', async () => {
    const bank = await buildBank();
    const required = [
      'diceClack','lockTap','rerollPool','buyPool','combo','upgrade',
      'bossSting','bigScore','winFanfare','bust','chipTick',
      'castSwell','castBoom','sigilDraw','cardFlip','nodePulse','transitionWipe',
      'master','buses',
    ] as const;
    for (const key of required) {
      expect(bank).toHaveProperty(key);
    }
  });
});
```

Run: `npx vitest run src-next/audio/sfx/__tests__/buses.test.ts`
Expected: FAIL on the new test (`../synthBank` still has old shape — `buses` key missing).

- [ ] **Step 3.2: Rewrite `synthBank.ts`**

Replace `src-next/audio/sfx/synthBank.ts` entirely with:

```ts
import * as Tone from 'tone';
import { Howler } from 'howler';
import { buildBuses, type Buses } from './buses';

const POOL_SIZE = 4;

export type LayeredVoice = {
  // Trigger function takes optional opts and the voices module schedules layers.
  // Stored as a tag — layer construction lives here, trigger logic in voices.ts.
  layers: Tone.ToneAudioNode[];
};

export type SynthBank = {
  // Per-voice handles. voices.ts triggers them with bank-aware scheduling.
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
  // body LP via filter inserted before bus
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

  return {
    diceClack, lockTap, rerollPool, rerollIdx: { i: 0 },
    buyPool, buyIdx: { i: 0 }, combo, upgrade, bossSting, bigScore, winFanfare, bust, chipTick,
    castSwell, castBoom, sigilDraw, cardFlip, nodePulse, transitionWipe,
    buses, master: buses.master,
  };
}
```

- [ ] **Step 3.3: Run tests, confirm they pass**

Run: `npx vitest run src-next/audio/sfx/__tests__/`
Expected: all PASS.

- [ ] **Step 3.4: Run full type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

If `voices.ts` or `index.ts` errors due to changed `SynthBank` shape, that's expected — fix them in Tasks 4 & 5 (they reference the new shape).

If errors are from the old `voices.ts` shape mismatch, leave them for now and proceed; they will resolve in Task 4. Don't commit yet.

- [ ] **Step 3.5: Commit (after Task 4 lands too)**

Skip commit here — synthBank rewrite without matching voices.ts breaks the bank's consumers. Commit jointly at end of Task 4.

---

## Task 4: Rewrite `voices.ts` to layered triggers with variation

**Files:**
- Modify (full rewrite): `src-next/audio/sfx/voices.ts`

- [ ] **Step 4.1: Rewrite `voices.ts`**

Replace `src-next/audio/sfx/voices.ts` entirely with:

```ts
import * as Tone from 'tone';
import type { SynthBank } from './synthBank';
import {
  PENTATONIC_CSM_HZ, MINOR_CSM_HZ,
  tierToNotes, jitterCents, jitterDb, jitterMs, centsToRatio, makeVolumeMemory, pickPent,
} from './voicing';
import { triggerDuck } from './buses';

export type VoiceOpts = { tier?: number; volume?: number; idx?: number };

const STEP = 0.005;
let lastTime = 0;
function nextTime(): number {
  const now = Tone.now();
  const t = Math.max(now + STEP, lastTime + STEP);
  lastTime = t;
  return t;
}

function jitteredTime(): number {
  return nextTime() + jitterMs() / 1000;
}

const memMap = new Map<string, ReturnType<typeof makeVolumeMemory>>();
function vol(key: string, centerDb: number, spreadDb = 1.5): number {
  let mem = memMap.get(key);
  if (!mem) { mem = makeVolumeMemory(); memMap.set(key, mem); }
  return mem.next(centerDb, spreadDb);
}

// ---- diceClack -------------------------------------------------------------
export function diceClack(bank: SynthBank): void {
  const t = jitteredTime();
  const baseHz = 220 * centsToRatio(jitterCents()); // wood body pitch
  bank.diceClack.body.triggerAttackRelease(baseHz, '32n', t);
  bank.diceClack.body.volume.value = vol('diceBody', -16);
  bank.diceClack.click.volume.value = vol('diceClick', -22);
  bank.diceClack.click.triggerAttackRelease('64n', t + 0.001);
  // Sub thump only ~25% of the time so it doesn't overload busy salvos.
  if (Math.random() < 0.25) {
    bank.diceClack.sub.triggerAttackRelease('G2', '16n', t + 0.002);
  }
}

// ---- lockTap ---------------------------------------------------------------
export function lockTap(bank: SynthBank): void {
  const t = jitteredTime();
  bank.lockTap.tap.volume.value = vol('lockTap', -16);
  bank.lockTap.tap.triggerAttackRelease('C4', '32n', t);
  // Ping at +1 oct above pent root, slightly delayed.
  const pingHz = pickPent(7) * centsToRatio(jitterCents());
  bank.lockTap.ping.volume.value = vol('lockPing', -22);
  bank.lockTap.ping.triggerAttackRelease(pingHz, '32n', t + 0.012);
}

// ---- reroll ----------------------------------------------------------------
export function reroll(bank: SynthBank): void {
  const slot = bank.rerollPool[bank.rerollIdx.i % bank.rerollPool.length]!;
  bank.rerollIdx.i++;
  const t = jitteredTime();
  slot.shimmer.forEach((m, i) => {
    m.volume.value = vol(`rerollShim${i}`, -26);
    m.triggerAttackRelease('32n', t + i * 0.005);
  });
  slot.sweep.volume.value = vol('rerollSweep', -28);
  slot.sweep.triggerAttackRelease('8n', t);
}

// ---- buy -------------------------------------------------------------------
export function buy(bank: SynthBank): void {
  const slot = bank.buyPool[bank.buyIdx.i % bank.buyPool.length]!;
  bank.buyIdx.i++;
  const t = jitteredTime();
  const root = pickPent(5) * centsToRatio(jitterCents());
  slot.chimeA.volume.value = vol('buyA', -20);
  slot.chimeB.volume.value = vol('buyB', -22);
  slot.chimeA.triggerAttackRelease(root, '8n', t);
  slot.chimeB.triggerAttackRelease(root * 1.5, '8n', t + 0.004); // perfect 5th
  slot.rustle.volume.value = vol('buyRustle', -28);
  slot.rustle.triggerAttackRelease('16n', t + 0.04);
}

// ---- combo (tier-scaled phrase) -------------------------------------------
export function combo(bank: SynthBank, opts: VoiceOpts): void {
  const tier = opts.tier ?? 1;
  const notes = tierToNotes(tier).map((hz) => hz * centsToRatio(jitterCents()));
  let t = jitteredTime();
  const stepS = tier >= 5 ? 0.07 : 0.10;
  bank.combo.bells.volume.value = vol('combo', -16);
  notes.forEach((hz) => {
    bank.combo.bells.triggerAttackRelease(hz, '8n', t);
    t += stepS;
  });
  lastTime = t;
}

// ---- upgrade ---------------------------------------------------------------
export function upgrade(bank: SynthBank): void {
  const t = jitteredTime();
  const root = pickPent(7) * centsToRatio(jitterCents());
  bank.upgrade.bell.volume.value = vol('upgradeBell', -16);
  bank.upgrade.bell.triggerAttackRelease(root, '4n', t);
  // 3 sparkle notes randomized across pent in upper octaves.
  for (let i = 0; i < 3; i++) {
    const hz = pickPent(10 + Math.floor(Math.random() * 5));
    bank.upgrade.sparkle.triggerAttackRelease(hz, '32n', t + 0.04 + i * 0.06);
  }
}

// ---- bossSting -------------------------------------------------------------
export function bossSting(bank: SynthBank): void {
  const t = jitteredTime();
  const s = bank.bossSting;
  s.brass.frequency.cancelScheduledValues(t);
  s.brass.frequency.setValueAtTime(110, t);
  s.brass.frequency.exponentialRampToValueAtTime(45, t + 0.6);
  s.brass.volume.value = vol('bossBrass', -10);
  s.brass.triggerAttackRelease('A1', '2n', t);
  s.sub.frequency.setValueAtTime(55, t);
  s.sub.triggerAttackRelease('A1', '2n', t);
  triggerDuck(bank.buses, 4, 80, 250);
}

// ---- bigScore --------------------------------------------------------------
export function bigScore(bank: SynthBank): void {
  const t = jitteredTime();
  // Pre-roll swell starts 0.3s earlier, but Tone scheduling needs absolute time;
  // we schedule swell first then kick at +0.3s.
  bank.bigScore.swell.volume.value = vol('bigSwell', -20);
  bank.bigScore.swell.triggerAttackRelease('4n', t);
  bank.bigScore.kick.volume.value = vol('bigKick', -8);
  bank.bigScore.kick.triggerAttackRelease('A1', '2n', t + 0.3);
  // Maj7 bell stack on C# minor root: C#, E, G#, C (omit C natural for cleaner cluster — use C#, E, G#, B as min7).
  const stack = [PENTATONIC_CSM_HZ[0]!, MINOR_CSM_HZ[2]!, MINOR_CSM_HZ[4]!, MINOR_CSM_HZ[6]!];
  bank.bigScore.bells.triggerAttackRelease(stack, '2n', t + 0.3);
  triggerDuck(bank.buses, 6, 80, 350);
  lastTime = t + 0.5;
}

// ---- winFanfare ------------------------------------------------------------
export function winFanfare(bank: SynthBank): void {
  const t0 = jitteredTime();
  const phrase = tierToNotes(8); // 5 ascending pent notes
  bank.winFanfare.pluck.volume.value = vol('winPluck', -10);
  bank.winFanfare.bell.volume.value = vol('winBell', -16);
  let t = t0;
  for (const hz of phrase) {
    bank.winFanfare.pluck.triggerAttackRelease(hz, '8n', t);
    bank.winFanfare.bell.triggerAttackRelease(hz * 2, '8n', t); // bell doubles +1 oct
    t += 0.13;
  }
  triggerDuck(bank.buses, 4, 80, 250);
  lastTime = t;
}

// ---- bust ------------------------------------------------------------------
export function bust(bank: SynthBank): void {
  const t = jitteredTime();
  bank.bust.saw.frequency.cancelScheduledValues(t);
  bank.bust.saw.frequency.setValueAtTime(440, t);
  bank.bust.saw.frequency.exponentialRampToValueAtTime(80, t + 0.8);
  bank.bust.saw.volume.value = vol('bustSaw', -12);
  bank.bust.saw.triggerAttackRelease('A4', '2n', t);
  bank.bust.rumble.volume.value = vol('bustRumble', -18);
  bank.bust.rumble.triggerAttackRelease('2n', t);
  bank.bust.tear.volume.value = vol('bustTear', -22);
  bank.bust.tear.triggerAttackRelease('16n', t + 0.6);
}

// ---- chipTick (idx → pent climb) ------------------------------------------
export function chipTick(bank: SynthBank, opts: { idx?: number } = {}): void {
  const idx = opts.idx ?? 0;
  const hz = pickPent(idx) * centsToRatio(jitterCents());
  bank.chipTick.fm.volume.value = vol('chipTick', -16);
  bank.chipTick.fm.triggerAttackRelease(hz, '32n', jitteredTime());
}

// ---- castSwell -------------------------------------------------------------
export function castSwell(bank: SynthBank): void {
  const t = jitteredTime();
  bank.castSwell.rise.volume.value = vol('swellRise', -22);
  bank.castSwell.rise.triggerAttackRelease('2n', t);
  bank.castSwell.drone.volume.value = vol('swellDrone', -22);
  const root = PENTATONIC_CSM_HZ[0]!;
  bank.castSwell.drone.triggerAttackRelease([root, root * 1.5, root * 2], '2n', t);
  bank.castSwell.arp.volume.value = vol('swellArp', -28);
  for (let i = 0; i < 8; i++) {
    bank.castSwell.arp.triggerAttackRelease(pickPent(i), '32n', t + 0.05 + i * 0.1);
  }
  lastTime = t + 1.0;
}

// ---- castBoom --------------------------------------------------------------
export function castBoom(bank: SynthBank): void {
  const t = jitteredTime();
  bank.castBoom.kick.volume.value = vol('boomKick', -10);
  bank.castBoom.kick.triggerAttackRelease('A1', '2n', t);
  const stack = [PENTATONIC_CSM_HZ[0]!, MINOR_CSM_HZ[2]!, MINOR_CSM_HZ[4]!];
  bank.castBoom.bells.triggerAttackRelease(stack, '2n', t);
  bank.castBoom.tail.volume.value = vol('boomTail', -22);
  bank.castBoom.tail.triggerAttackRelease('4n', t + 0.05);
  triggerDuck(bank.buses, 5, 80, 300);
}

// ---- sigilDraw -------------------------------------------------------------
export function sigilDraw(bank: SynthBank): void {
  const t = jitteredTime();
  bank.sigilDraw.scratch.volume.value = vol('sigilScratch', -22);
  // 8-12 stutter bursts spread over 600ms.
  const n = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < n; i++) {
    bank.sigilDraw.scratch.triggerAttackRelease('64n', t + (i / n) * 0.6 + Math.random() * 0.02);
  }
  bank.sigilDraw.chime.volume.value = vol('sigilChime', -22);
  bank.sigilDraw.chime.triggerAttackRelease(pickPent(2), '4n', t + 0.55);
}

// ---- cardFlip --------------------------------------------------------------
export function cardFlip(bank: SynthBank): void {
  const t = jitteredTime();
  bank.cardFlip.paper.volume.value = vol('flipPaper', -22);
  bank.cardFlip.paper.triggerAttackRelease('64n', t);
  bank.cardFlip.whoosh.volume.value = vol('flipWhoosh', -28);
  bank.cardFlip.whoosh.triggerAttackRelease('16n', t + 0.005);
  bank.cardFlip.chime.volume.value = vol('flipChime', -24);
  bank.cardFlip.chime.triggerAttackRelease(pickPent(3 + Math.floor(Math.random() * 4)), '32n', t + 0.06);
}

// ---- nodePulse -------------------------------------------------------------
export function nodePulse(bank: SynthBank): void {
  const t = jitteredTime();
  bank.nodePulse.bell.volume.value = vol('nodeBell', -22);
  bank.nodePulse.bell.triggerAttackRelease(pickPent(6 + Math.floor(Math.random() * 5)), '16n', t);
  bank.nodePulse.shimmer.volume.value = vol('nodeShim', -30);
  bank.nodePulse.shimmer.triggerAttackRelease('32n', t + 0.02);
}

// ---- transitionWipe -------------------------------------------------------
export function transitionWipe(bank: SynthBank): void {
  const t = jitteredTime();
  bank.transitionWipe.sweep.volume.value = vol('wipeSweep', -22);
  bank.transitionWipe.sweep.triggerAttackRelease('2n', t);
  const root = PENTATONIC_CSM_HZ[0]!;
  bank.transitionWipe.pad.volume.value = vol('wipePad', -26);
  bank.transitionWipe.pad.triggerAttackRelease([root, root * 2], '2n', t);
  bank.transitionWipe.arrive.volume.value = vol('wipeArrive', -22);
  bank.transitionWipe.arrive.triggerAttackRelease(pickPent(7), '8n', t + 0.45);
  lastTime = t + 0.55;
}
```

- [ ] **Step 4.2: Run type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to `voices.ts` or `synthBank.ts`. If `index.ts` errors due to bank shape, fix in Task 5.

- [ ] **Step 4.3: Run all tests**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 4.4: Commit Tasks 3 + 4 jointly**

```bash
git add src-next/audio/sfx/synthBank.ts src-next/audio/sfx/voices.ts src-next/audio/sfx/__tests__/buses.test.ts
git commit -m "feat(audio): layered SFX voices with sidechain ducking + C#m anchor

Replaces single-source synth voices with transient+body+tail layers,
routes through category buses + FX sends, ducks master on impact events.
All pitched content in C# minor pentatonic.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Add `?sfx=legacy` toggle in `index.ts`

**Files:**
- Modify: `src-next/audio/sfx/index.ts`
- Optionally retain old bank: `src-next/audio/sfx/synthBank.legacy.ts` (copy of pre-rewrite)

- [ ] **Step 5.1: Save legacy bank for A/B**

Recover the pre-rewrite `synthBank.ts` content from git history and save it as `src-next/audio/sfx/synthBank.legacy.ts`:

```bash
git show HEAD~1:src-next/audio/sfx/synthBank.ts > src-next/audio/sfx/synthBank.legacy.ts
```

Wait — the previous commit (Tasks 3+4) is `HEAD`. The legacy version is `HEAD~1`. Verify:

```bash
git log --oneline -n 3 src-next/audio/sfx/synthBank.ts
```

Expected: top-of-list commit is "feat(audio): layered SFX voices...". The one below is the original. Use that hash:

```bash
git show <legacy-hash>:src-next/audio/sfx/synthBank.ts > src-next/audio/sfx/synthBank.legacy.ts
```

Open `synthBank.legacy.ts` and rename the exported types/functions:
- `SynthBank` → `LegacySynthBank`
- `buildBank` → `buildLegacyBank`

This avoids name collisions when both modules import simultaneously.

- [ ] **Step 5.2: Save legacy voices for A/B**

Same procedure for `voices.ts`:

```bash
git show <legacy-hash>:src-next/audio/sfx/voices.ts > src-next/audio/sfx/voices.legacy.ts
```

Then in `voices.legacy.ts`:
- Rename `import type { SynthBank } from './synthBank'` → `import type { LegacySynthBank as SynthBank } from './synthBank.legacy'`

Keep all other voice function names — the legacy module is self-contained.

- [ ] **Step 5.3: Update `index.ts` to support `?sfx=legacy`**

Replace `src-next/audio/sfx/index.ts` with:

```ts
import { buildBank, type SynthBank } from './synthBank';
import { buildLegacyBank, type LegacySynthBank } from './synthBank.legacy';
import * as voices from './voices';
import * as legacyVoices from './voices.legacy';

export type SfxId =
  | 'diceClack' | 'lockTap' | 'reroll' | 'buy'
  | 'combo' | 'upgrade' | 'bossSting' | 'bigScore' | 'win' | 'bust'
  | 'chipTick' | 'castSwell' | 'castBoom' | 'sigilDraw' | 'cardFlip' | 'nodePulse' | 'transitionWipe';

export type SfxOpts = { tier?: number; volume?: number; idx?: number };

const VOLUME_KEY = 'ff_next_sfxVol';
const LEGACY_KEY = 'ff_sfx_legacy';

let bank: SynthBank | LegacySynthBank | null = null;
let legacyMode = false;
let initPromise: Promise<void> | null = null;

function loadVolume(): number {
  const raw = localStorage.getItem(VOLUME_KEY);
  if (!raw) return 0.7;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.7;
}

function checkLegacyFlag(): boolean {
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get('sfx');
    if (param === 'legacy') {
      localStorage.setItem(LEGACY_KEY, '1');
      return true;
    }
    if (param === 'modern' || param === 'new') {
      localStorage.removeItem(LEGACY_KEY);
      return false;
    }
  } catch { /* SSR or no window */ }
  return localStorage.getItem(LEGACY_KEY) === '1';
}

export async function sfxInit(): Promise<void> {
  if (bank) return;
  if (initPromise) return initPromise;
  legacyMode = checkLegacyFlag();
  initPromise = (async () => {
    bank = legacyMode ? await buildLegacyBank() : await buildBank();
    bank.master.gain.value = loadVolume();
  })();
  return initPromise;
}

export function sfxPlay(id: SfxId, opts: SfxOpts = {}): void {
  if (!bank) return;
  const v = legacyMode ? legacyVoices : voices;
  try {
    switch (id) {
      case 'diceClack':       v.diceClack(bank as never); break;
      case 'lockTap':         v.lockTap(bank as never); break;
      case 'reroll':          v.reroll(bank as never); break;
      case 'buy':             v.buy(bank as never); break;
      case 'combo':           v.combo(bank as never, opts); break;
      case 'upgrade':         v.upgrade(bank as never); break;
      case 'bossSting':       v.bossSting(bank as never); break;
      case 'bigScore':        v.bigScore(bank as never); break;
      case 'win':             v.winFanfare(bank as never); break;
      case 'bust':            v.bust(bank as never); break;
      case 'chipTick':        v.chipTick(bank as never, opts); break;
      case 'castSwell':       v.castSwell(bank as never); break;
      case 'castBoom':        v.castBoom(bank as never); break;
      case 'sigilDraw':       v.sigilDraw(bank as never); break;
      case 'cardFlip':        v.cardFlip(bank as never); break;
      case 'nodePulse':       v.nodePulse(bank as never); break;
      case 'transitionWipe':  v.transitionWipe(bank as never); break;
    }
  } catch (e) {
    console.warn('[sfx] play failed:', id, e);
  }
}

export function sfxSetMaster(v: number): void {
  const clamped = Math.max(0, Math.min(1, v));
  localStorage.setItem(VOLUME_KEY, String(clamped));
  if (bank) bank.master.gain.value = clamped;
}

export function sfxGetMaster(): number {
  return loadVolume();
}

export function sfxBank(): SynthBank | LegacySynthBank | null {
  return bank;
}

export function sfxIsLegacy(): boolean {
  return legacyMode;
}
```

- [ ] **Step 5.4: Run type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5.5: Run all tests**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 5.6: Commit**

```bash
git add src-next/audio/sfx/index.ts src-next/audio/sfx/synthBank.legacy.ts src-next/audio/sfx/voices.legacy.ts
git commit -m "feat(audio): legacy SFX A/B toggle via ?sfx=legacy URL flag

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Manual verification in browser

**Files:**
- (None modified — verification only)

- [ ] **Step 6.1: Start dev server**

Use `preview_start` MCP tool with launch config name `fortune-fallacy`. (Outside agent context: `npm run dev`.)

- [ ] **Step 6.2: Walk every screen and trigger every event**

For each event below, perform the action that fires it in-game and listen:

| SfxId | How to trigger | Expected character |
|---|---|---|
| `diceClack` | Trigger a roll on Round | woody body + crisp click + occasional sub thump; varies pitch/vol per roll |
| `lockTap` | Click a die to lock | tap + filter ping +1 oct; metallic snap |
| `reroll` | Click Reroll button | shimmer cloud + sub whoosh sweep |
| `buy` | Click "buy" on a Shop offer | coin chime perfect-5th interval + paper rustle |
| `combo` | Score a hand of varying tiers | tier 1 = single bell; tier 8 = 5-note pentatonic flourish |
| `upgrade` | Forge attach a rune | natural bell + sparkle |
| `bossSting` | Open Boss Reveal | low FM brass + sub fall, ducks UI |
| `bigScore` | Cast a >= 10000 hand | sub kick + maj7 bell stack + reversed swell pre-roll |
| `win` | Complete final boss | 5-note ascending C#m phrase, bell-doubled |
| `bust` | Fail a blind | detuned saw fall + brown rumble + paper-tear noise |
| `chipTick` | Score breakdown | pings climb pentatonic, not chromatic |
| `castSwell` | Pre-cast (Cast Hand button hold or anim) | pink rise + drone + arp ticks |
| `castBoom` | Confirm cast | sub kick + bell stack + reversed swoosh tail |
| `sigilDraw` | Boss reveal sigil draws | granular ink-scratching + low chime |
| `cardFlip` | Tarot card use | paper transient + whoosh + chime on land |
| `nodePulse` | Hover Hub blind nodes | short bell + high shimmer |
| `transitionWipe` | Screen change | brown sweep + low pad + arrival chime |

- [ ] **Step 6.3: A/B against legacy**

Append `?sfx=legacy` to the URL, reload, repeat the same checks. Confirm:
- Modern bank sounds layered + spatial, legacy sounds bare and centered.
- No console errors in either mode.

Append `?sfx=modern` to flip back; confirm `localStorage.ff_sfx_legacy` is cleared.

- [ ] **Step 6.4: Confirm sidechain audibly**

While `chipTick` salvo plays mid-score breakdown, trigger a `bigScore`. Confirm chip ticks duck briefly under the kick.

- [ ] **Step 6.5: Confirm no clipping**

Open Chrome DevTools → Performance → Web Audio panel (or use Tone.Meter inserted on master temporarily). Master peaks should not exceed -1 dBFS thanks to the limiter. If any voice repeatedly hits the limiter, lower its volume value in `synthBank.ts` by 2 dB and re-test.

- [ ] **Step 6.6: Final commit (if any tweaks made)**

```bash
git add src-next/audio/sfx/
git commit -m "tweak(audio): SFX volume balance after manual verification

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

If no tweaks needed, skip.

---

## Self-Review Notes

- Spec coverage: every voice in the spec table has a trigger function in Task 4. Every bus in the spec architecture is built in Task 2. Sidechain duck values match spec (4 dB / 80 ms / 250 ms default, with `bigScore` at 6 dB / 350 ms release for impact priority).
- Type consistency: `SynthBank` shape declared in Task 3 is consumed without changes in Task 4. `Buses` exposed by `buildBuses` (Task 2) is referenced in Task 3 and 4 via `bank.buses`.
- Public API stable: `SfxId`, `sfxPlay`, `sfxInit`, `sfxSetMaster`, `sfxGetMaster`, `sfxBank` all unchanged.
- Legacy toggle adds `sfxIsLegacy` (additive only, no breakage).
- Vitest runs in jsdom. `Tone.start()` and `Tone.Reverb.generate()` may throw without a real `AudioContext`; the buses test includes a minimal shim. If tests still fail in CI due to Web Audio absence, gate the `buildBank` smoke test with `if (typeof AudioContext !== 'undefined')`.
