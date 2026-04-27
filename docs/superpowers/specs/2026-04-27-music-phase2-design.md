# Music — Phase 2 Design

## Context
Phase 1 (SFX upgrade) is complete and shipped. The `AudioEngine` adaptive 4-layer system has been wired since before this work but has never had audio files — `public/audio/` is empty. Phase 2 fills that gap and adds per-screen tracks for the menu screens (Title, Hub, Shop, Forge, Boss).

The aesthetic anchor from Phase 1 stays: cosmic celestial + synthwave-arcane, less "fortune teller", with C# minor pentatonic anchoring melodic content. Phase 2 leans this toward **cosmic ambient + lofi-lounge with warm sub bass at ~90 BPM** — adds depth without replacing the cool/electronic palette.

## Goals
- 4 sample-accurate stems for the existing Round adaptive system in `AudioEngine.ts`.
- 5 per-screen tracks (Title / Hub / Shop / Forge / Boss) — same song family, different mixes.
- Smooth crossfade (~1.5 s) when switching screen tracks.
- Round vs screen-track mutex: only one music sub-mix audible at any time, with overlap during the 1.5 s crossfade.
- Minimal additive change to `AudioEngine.ts` (one new `setActive` method); add a new `ScreenMusic.ts` module.

## Architecture

### Round (minimal additive change)
`AudioEngine` already creates four `Howl` instances at construction (`base/combo/peak/fail-loop.wav` from `/FortuneFallacy/audio/`), plays them all silently in lockstep, and lerps each layer's volume according to `heat`, `combo`, `stability`, `fail`, `tension`, and `bigScoreTimer` state. The biquad master filter and `bigScore` 300 ms duck-and-handoff are already wired and tested. Phase 2 delivers the four WAV files into `public/audio/`.

One additive change to `AudioEngine.ts`: a new `setActive(active: boolean)` method. When `false`, all layer target volumes clamp to 0 inside `tick()` regardless of state, so the round layers silence cleanly when the player leaves Round. State (heat / combo / stability) keeps decaying as today — only the volume mapping is gated. `ScreenMusic` calls `audioEngine.setActive(false)` on every screen except `round`. No other AudioEngine logic changes.

Critical constraint: the four stems MUST be sample-accurate, identical-length loops with phase-aligned downbeats. Any drift between stems causes a phasing-comb effect when layers cross-fade in/out. Suno Studio's stem export satisfies this constraint — stems come from a single rendered song, so they are sample-locked by definition.

### Screen tracks (new code)
A new `src-next/audio/ScreenMusic.ts` module manages a single `Howl` per screen. Public API:

```ts
type ScreenId = 'title' | 'hub' | 'shop' | 'forge' | 'boss';

export const screenMusic = {
  start(screen: ScreenId): void;   // crossfade-in this screen's loop
  stop(durationMs?: number): void; // fade out the active loop (default 1500 ms)
  setMaster(v: number): void;
  pause(): void;
  resume(): void;
};
```

Behavior:
- Lazy loading: only the active screen's `Howl` is instantiated. On `start(s)`, if the previous screen had a different loop, fade it out over 1.5 s while the new one fades in.
- Mutex with Round: when the screen state machine transitions INTO `round`, `screenMusic.stop()` is called and `audioEngine.setActive(true)` is called (the existing tick handles state-driven mixing from there). When transitioning OUT of `round`, `audioEngine.setActive(false)` clamps all four round layers to volume 0 (existing per-layer 0.12 lerpK gives a ~250 ms perceptual fade) and `screenMusic.start(<next>)` fades the new track in over 1.5 s in parallel.
- `pause` / `resume` mirror AudioEngine's `visibilitychange` strategy. Master volume reads from the existing `ff_next_audioVol` localStorage so the DebugPanel slider controls everything in one go.

Wiring point: `src-next/app/App.tsx` already reads `selectScreen`. Add a `useEffect` that calls `screenMusic.start(screen)` when the screen changes (and `screenMusic.stop()` on unmount). Round entry uses `screenMusic.stop()`.

## Round adaptive stems

All four stems: 16 bars × 4 beats × (60 / 90) s = **42.667 s**, in **C# minor**, **90 BPM**, identical sample length, phase-locked downbeat.

| Stem | Contents | Volume drivers (existing in AudioEngine) |
|---|---|---|
| `base` | lofi drum bed (kick, brushed snare, hat with vinyl crackle), warm sub bass, sustained pad | `0.55 + 0.25 * stability + 0.15 * heat` |
| `combo` | Rhodes-style chord progression, soft arp, light shaker | `combo * (0.6 + 0.4 * heat) + tension * 0.12` |
| `peak` | tape-delay lead synth, cymbal swells, glock/bell ostinato | `smoothstep(heat, 0.7, 1.0) * 0.85 + tension * 0.08` |
| `fail` | detuned drone, reverse swoosh accents, tape-stop, low rumble | `fail * 0.7` |

`bigScore` moment retains its current behavior: 300 ms duck of base + combo, then `peak` ramps to 0.95 for ~600 ms, then a 1300 ms blend back. The `peak` stem must have musical material that reads as "moment" not just "more loud" — that's why it includes the bell ostinato.

## Per-screen tracks

Same C#m, ~90 BPM, 60–90 s loops. All five share melodic DNA so the game scores like one piece — palette shifts only.

| Screen | Mix character |
|---|---|
| `title` | sparse intro mix: pad + sub + occasional arp. Reads as "main theme, open". |
| `hub` | the "main theme" — full lofi bed, warm bass, light groove. Most-played loop. |
| `shop` | jazz-lounge tilt: Rhodes lead foregrounded, brushed kit louder, slower-feeling pulse. |
| `forge` | darker: minor-substitution chords, hammered metal accents, slower swing. |
| `boss` | intensity: distorted sub bass, faster hat, brooding lead synth, +1–2 BPM tolerable. |

## Suno workflow

### Round stems
1. In Suno Studio, generate one cohesive song with the seed prompt below.
2. Iterate until the result has clean loopability and clear instrumentation separation.
3. Export stems (drums / bass / melody / pad).
4. In a DAW (Audacity is sufficient), recombine stems into the four target layers:
   - `base.wav` = drums + sub bass + pad
   - `combo.wav` = Rhodes/keys + arp + shaker (mute everything else; render only this)
   - `peak.wav` = lead + cymbals + bell (render only this)
   - `fail.wav` = detuned drone + reversed FX (this layer is largely a separate render — see below)
5. For `fail`, generate a **second** Suno gen using "detuned, reversed, tape-stop, ambient drone, no drums" seed at the same BPM/key. Trim to exactly 42.667 s aligned to the master downbeat.
6. All four stems exported as 16-bit PCM WAV @ 44.1 kHz, looped at zero-crossings.

### Per-screen tracks
- Suno V5 single tracks (no stem export needed).
- 5 separate generations using the seed prompt with one phrase swapped per screen.
- 60–90 s outputs, trimmed to a clean loop at zero-crossings.

### Suno prompt seed
> "Cosmic ambient lofi-lounge, 90 BPM, C# minor, warm sub bass, dusty Rhodes keys, brushed kit with vinyl crackle, sustained pad, occasional bell shimmer, no vocals, evening lounge in space, peaceful but with depth."

Per-screen prompt swaps:
- `title`: replace "evening lounge in space, peaceful but with depth" → "wide open intro, sparse, anticipating".
- `hub`: keep seed as-is — this is the canonical mix.
- `shop`: append "jazz-lounge feel, prominent Rhodes, brushed kit forward".
- `forge`: replace "peaceful" → "smoldering, minor-key substitution, hammered metal accents".
- `boss`: replace "peaceful but with depth" → "intense, distorted bass, faster hat, brooding".

## File layout

```
public/audio/
├── base-loop.wav    ← Round stem 1 (path already wired in AudioEngine.ts)
├── combo-loop.wav   ← Round stem 2
├── peak-loop.wav    ← Round stem 3
├── fail-loop.wav    ← Round stem 4
├── title-loop.wav   ← screen tracks
├── hub-loop.wav
├── shop-loop.wav
├── forge-loop.wav
└── boss-loop.wav
```

```
src-next/audio/
├── AudioEngine.ts            ← unchanged
├── ScreenMusic.ts            ← NEW: ~80 lines, lazy Howl loader + crossfade
└── audioBridge.ts            ← optional: thin re-export so App.tsx imports one name
```

## Verification

1. **Round seamless loop**: drop the four Round stems, start a Round, let it run two full loop cycles (~85 s). Confirm no audible click/seam at the 42.7 s mark, and that all four layers stay phase-aligned (no comb-filter swirl).
2. **Layer crossfade**: trigger a `combo` event of increasing tier; confirm `combo` stem audibly rises smoothly. Trigger heat by scoring near target; confirm `peak` rises. Force a fail; confirm `fail` rises and the master filter sweeps as designed.
3. **bigScore moment**: cast a hand >= 10 000 score. Confirm the existing 300 ms duck → peak ramp → blend-back behavior reads cleanly with real audio.
4. **Screen track crossfade**: navigate Title → Hub → Shop → Forge → Boss → Hub. Confirm 1.5 s crossfade between every transition, no clicks, no double-stack.
5. **Round mutex**: enter Round from Hub. Confirm `hub-loop` fades out as `base-loop` fades in. Exit Round to Shop. Confirm Round layers fade out as `shop-loop` fades in.
6. **Visibility pause**: tab away during Round, then back. Confirm music resumes in phase.
7. **Master volume**: move the DebugPanel master slider; confirm Round layers AND screen tracks all scale.
8. **No-files fallback**: temporarily rename `hub-loop.wav` to simulate a missing asset. Confirm `screenMusic.start('hub')` fails silently (Howler logs a warning) and the rest of the game keeps running.

## Out of scope

- Per-boss music (one boss track covers all five bosses).
- Stem-locked screen tracks (only Round needs that).
- Generative or runtime composition.
- New SFX work (Phase 1, complete).
- Modifying `AudioEngine.ts` beyond the additive `setActive` method described above.
- Tooling/automation around Suno gens (manual one-time mixdown is fine).
- License or distribution path beyond ensuring the chosen Suno tier permits the project's release model.
- Sample-rate / format negotiation: spec mandates 16-bit 44.1 kHz WAV; non-conforming files will be rejected at QA.
