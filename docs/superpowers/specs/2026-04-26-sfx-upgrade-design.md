# SFX Upgrade — Design

## Context
Current SFX in Fortune Fallacy are pure Web Audio synthesis (`src-next/audio/sfx/synthBank.ts` + `voices.ts`, 17 voices on Tone.js). They sound like "random tones and beeps" — no layering, no transient design, generic reverb on everything, no sidechain, no musical key. Music is wired (`AudioEngine.ts` adaptive 4-layer system) but no audio files exist; that work is Phase 2.

This spec covers Phase 1: keep the procedural approach but rebuild every voice to a tactile + analog-synth-tail aesthetic that matches the cosmic-synth visual brand and the future Suno-generated music.

## Diagnosis of current sound
1. **Single-source voices.** Each SFX = one Tone synth + one envelope. Real SFX = transient + body + tail in distinct layers.
2. **No transient design.** `diceClack` is white noise burst; no woody body or pitched click. `lockTap` is a single membrane hit with no high-end ping.
3. **Generic reverb (wet 0.35) on everything.** All events sound trapped in the same plate.
4. **No sidechain.** `bigScore` and `chipTick` mask each other instead of one ducking the other.
5. **No musical coherence.** `combo` triggers a fixed triad; `winFanfare` is a C-major arpeggio. Random pitch choices will clash with future music.

## Goals
- Tactile + analog synth-tail aesthetic (transient + body + atmospheric tail).
- Each SFX layered (1–3 components) with intentional musical motif where pitched.
- All pitched content in **C# minor pentatonic** to never clash with future Suno music.
- Sidechain ducking on impact events.
- Per-trigger variation (pitch / volume / micro-timing) to kill repetition fatigue.
- No public API change — `SfxId` and `sfxPlay()` signatures stay stable.

## Architecture

```
voice layers → category bus (perc | mag | impact | ui)
             → FX sends (plate | hall | delay)
             → master (compressor + limiter + sidechain key)
             → Howler/Tone destination
```

### Category buses (4)
Each bus = `Tone.Gain` → `Tone.EQ3` → `Tone.Compressor` → master.

| Bus | Purpose | EQ shape | Compression |
|---|---|---|---|
| `perc` | dice clack, lock tap, card flip, chip tick | HP 80 Hz, dip 350 Hz, boost 5 kHz | -14 dB thresh, 4:1 |
| `mag` | combo, upgrade, sigil draw, node pulse | HP 200 Hz, boost 3 kHz | -16 dB, 3:1, 25% plate send |
| `impact` | bigScore, castBoom, bossSting, win, bust | full range, low-shelf +2 dB | -12 dB, 6:1, 35% hall send |
| `ui` | reroll, buy, transition wipe | HP 400 Hz | -18 dB, 3:1, 15% plate send |

### FX sends (3)
- `plate`: short reverb, decay 0.8 s, wet 100% on send (bus controls send level)
- `hall`: long reverb, decay 2.4 s, wet 100%
- `delay`: ping-pong tape delay, time `8n`, feedback 0.3, filtered HP 600 Hz / LP 4 kHz

### Sidechain
A control-rate `Tone.Gain` node (`sidechainKey`) sits in the master path. `impact` bus voices that want ducking call `triggerDuck(amount, attackMs, releaseMs)` which ramps `sidechainKey` down briefly. Ducks the entire master signal except the triggering voice (which routes pre-key).

Default duck: 4 dB attenuation, 80 ms attack, 250 ms release. Triggers: `bigScore`, `win`, `bossSting`, `castBoom`.

## Voicing

### Key & scale
- Anchor: **C# minor** (cool minor, matches cyan/violet brand).
- Pentatonic subset for melodic motifs: `C#, D#, F#, G#, B` (across octaves 3–6).
- Bell harmonic content tuned to the same key so polyphony coheres.

### Tier → note maps
- `combo` tier 1–2: single note from pentatonic (root or 5th, octave by tier).
- tier 3–4: 2-note ascending interval.
- tier 5–6: 3-note arpeggio.
- tier 7–8: 5-note flourish (full pentatonic ascent + final 5th).
- `chipTick`: pitch index `i` maps to `pent[i % 5]` in octaves 4 → 6 climbing.

### Variation per trigger
- Pitch jitter: ±25 cents random (uniform).
- Volume jitter: ±1.5 dB. Memory-skewed — last-3 trigger volumes tracked, new draw biased away to avoid same-vol streaks.
- Micro-timing jitter: 0–12 ms uniform delay.
- Pan: ±0.3 random for percussive voices.
- Pool round-robin where multiple voices may overlap (`reroll`, `buy`, future `diceClack` if simultaneous).

## Voice library

| Voice | Bus | Layers | Notes |
|---|---|---|---|
| `diceClack` | perc | wood body (PluckSynth LP @ 200 Hz) + transient click (NoiseSynth HP @ 4 kHz, 8 ms env) + optional sub thump (MembraneSynth G2, only when 5th+ in a salvo) | random pan ±0.3 |
| `lockTap` | perc | soft membrane tap + filter ping (FMSynth +1 oct, 12 ms decay) | snaps "into place" |
| `reroll` | ui | shimmer cloud (3 MetalSynths at adjacent harmonics, 5 ms inter-onset) + filtered noise sweep 200→1200 Hz over 200 ms | round-robin pool 4 |
| `buy` | ui | coin chime (FMSynth pair, perfect-5th interval, harm 3.01) + paper rustle tail (NoiseSynth filtered, 80 ms) | round-robin pool 4 |
| `combo` | mag | tier-scaled musical phrase (see tier map). PolySynth bells. Pre-attack micro-duck on master. | scales with `opts.tier` |
| `upgrade` | mag | natural bell (FMSynth, harm 3.01, modIdx 14) + 3-voice sparkle window (200 ms, randomized pent notes) | |
| `bossSting` | impact | low FM brass (long 80 ms attack, square modulator) + sub fall (110→45 Hz over 600 ms) + hall send 50% | sidechain trigger |
| `bigScore` | impact | sub kick (MembraneSynth A1) + maj7 bell stack on C#m (4 voices, FMSynth) + reversed pink-noise swell pre-roll (300 ms before transient) | hard sidechain trigger |
| `win` | impact | 5-note ascending C# minor pentatonic phrase on PluckSynth + bell layer (FMSynth doubling each note +1 oct) + delay send 30% | sidechain trigger |
| `bust` | impact | detuned saw fall + low rumble (filtered brown noise) + paper-tear noise (HP NoiseSynth burst at end) | |
| `chipTick` | perc | FM bell ping, pitch climbs pentatonic by `idx` | currently chromatic — change |
| `castSwell` | mag | pink-noise rise (existing) + harmonic drone (PolySynth, 5th + octave on C#) + arp ticks every 100 ms | builds tension |
| `castBoom` | impact | sub kick + bell stack (same as bigScore but smaller) + reversed swoosh tail | sidechain trigger |
| `sigilDraw` | mag | granular ink-scratching (8–12 NoiseSynth micro-bursts over 600 ms with stutter pattern) + low chime tail | |
| `cardFlip` | perc | paper transient (HP NoiseSynth, 6 ms env) + tonal whoosh (filtered noise sweep) + chime on land (single FM bell) | |
| `nodePulse` | mag | short bell pulse + high shimmer (existing) + hall tail | |
| `transitionWipe` | ui | filtered brown noise sweep + sustained low pad (PolySynth, C# octave) + arrival chime on close | |

## File structure

```
src-next/audio/sfx/
├── index.ts        ← public API (unchanged signatures)
├── voicing.ts      ← NEW: SCALES, tierToNotes(), jitter helpers
├── buses.ts        ← NEW: buildBuses(), triggerDuck()
├── synthBank.ts    ← REWRITE: layered voice construction wired to buses
└── voices.ts       ← REWRITE: trigger functions with variation
```

`SfxId` union and `sfxPlay()` signature in `index.ts` are unchanged. All callers (`bus.on(...)`, screen components, dispatch handlers) work without modification.

## Verification

1. Walk every screen, fire each `SfxId` via Round / Hub / Boss / Shop / Forge interactions. Confirm no clipping at master, sidechain audible on impact events, no comb-filter masking when combos overlap UI clicks.
2. URL flag `?sfx=legacy` swaps the bank build for the pre-upgrade voices for instant A/B. Implemented as a `localStorage.ff_sfx_legacy` toggle plus URL parser.
3. Use existing hidden `EventLogger` (re-enable temporarily via dev toggle) to verify trigger ordering and rate.
4. Test in Chrome + Safari (different Web Audio quirks); confirm `Tone.start()` gesture path still works.

## Out of scope
- Music (Phase 2 — Suno generation + adaptive layer integration).
- Replacing Tone.js with raw Web Audio or alternative engine.
- Per-screen track selection or screen-music transitions.
- Spatial audio beyond ±0.3 pan jitter.
- AudioWorklet custom DSP.
- Dynamic music response to SFX (existing `AudioEngine.bumpHeat` hooks already cover this).
- Modifying the public `SfxId` set or adding new event triggers.
