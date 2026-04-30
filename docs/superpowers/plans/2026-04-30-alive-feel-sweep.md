# Alive Feel Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill SFX gaps (mod-fired listener + Forge attach/detach + UI button feedback), replace linear score-popup motion with loop-around orbital path, animate Forge codex chips on hover, add unified press juice to all primary buttons.

**Architecture:** Extend existing audio infrastructure (`src-next/audio/sfx/`) with 4 new synth voices for mod-fired sounds + a small Howler-based sample loader for 4 UI/Forge impact sounds. Replace `flyToCounter` CSS keyframe with a JS rAF animator (`orbitalFly.ts`). Hover/press effects via CSS keyframes + a lightweight global event delegate (`buttonJuice.ts`).

**Tech Stack:** TypeScript + React 18 + Tone.js (existing synth) + Howler (existing audio context, will newly host samples) + Vitest + jsdom. No new dependencies — Howler already present.

**Spec source:** `docs/superpowers/specs/2026-04-30-alive-feel-sweep-design.md`.

**Phases 1-7 of Star Forge mod-visuals already shipped on `main`.** Reuse: `bus`, `lookupMod`, Phase 5/6 `onModFired` event with `{ dieIdx, modId, faceValue }` payload.

**Discovery during brainstorm:** SFX is much more wired than spec initially assumed. ~13 sounds already play via `audioBridge.ts` + `scoring.ts`. This plan only fills the actual gaps (mod-fired sounds + Forge interactions + UI buttons), not the whole game.

**Discovery during plan-write:** `data-score-counter` attribute already exists on the score counter element (used by `Particles.tsx`). No ScoreFloat.tsx change needed.

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `public/sfx/` | NEW dir | Holds 4 sample WAVs (`uiClick.wav`, `uiHover.wav`, `modAttach.wav`, `modDetach.wav`) sourced from kenney.nl Interface Sounds Pack (CC0). |
| `src-next/audio/sfx/sampleBank.ts` | NEW | Tiny module: builds `Howl` instances for the 4 samples, exposes `playSample(id)` and `unlockSamples()`. |
| `src-next/audio/sfx/index.ts` | MODIFY | Extend `SfxId` union with 8 new ids; extend `sfxPlay` switch to dispatch to either synth voice (mod-*) or sample (ui-* / modAttach / modDetach). |
| `src-next/audio/sfx/synthBank.ts` | MODIFY | Add 4 new synth chains for `modPulse`, `modLoaded`, `modPipCharge`, `modBackstop`. |
| `src-next/audio/sfx/voices.ts` | MODIFY | Add 4 new voice functions (`modPulse`, `modLoaded`, `modPipCharge`, `modBackstop`) that play those synth chains. |
| `src-next/audio/audioBridge.ts` | MODIFY | Add one new `bus.on('onModFired', ...)` listener that switches on `def.visual.triggerFx` to play correct mod-* SFX. |
| `src-next/app/screens/Forge.tsx` | MODIFY | Add `sfxPlay('modAttach')` to chip-click handler (when attach succeeds) + `sfxPlay('modDetach')` to detach-button handler. |
| `src-next/app/hud/buttonJuice.ts` | NEW | Singleton: exports `installButtonJuice(): () => void`. Installs document-level `mousedown`/`mouseup`/`mouseenter` event delegate for `.btn-primary`. Spawns shockwave element on release; plays `uiClick` on press; plays `uiHover` on enter. Respects `.reduce-motion`. |
| `src-next/app/hud/buttonJuice.test.ts` | NEW | Unit tests: install delegate, simulate click, assert shockwave element added + auto-removed; assert `sfxPlay` called. |
| `src-next/app/hud/orbitalFly.ts` | NEW | Pure rAF animator: `animateOrbital(el, opts) → { dispose }`. 3-stage path (arc-up, orbit, dock). Respects `.reduce-motion`. |
| `src-next/app/hud/orbitalFly.test.ts` | NEW | Unit tests: position interpolation hits expected coords at t=0.2 (arc), t=0.5 (orbit midpoint), t=0.95 (dock). Reduced-motion path skips arc. |
| `src-next/app/hud/Particles.tsx` | MODIFY | Replace `FlyingNumber` component's CSS-keyframe-based animation with `animateOrbital` JS-driven path. Component becomes ref-based + effect-driven. |
| `src-next/styles/index.css` | MODIFY | Add `mod-chip-pulse` keyframe + `:hover` rules for `.forge-mod-row`; `.btn-primary:active` scale rule + `.btn-shockwave` styles. |
| `src-next/app/App.tsx` (or `src-next/main.tsx`) | MODIFY | Call `installButtonJuice()` once at app mount. |

**Decomposition rationale:** Sample loader is its own module (~30 lines) — keeps synth bank focused. Voice + sfxPlay extension is one cohesive change. `buttonJuice` and `orbitalFly` are independent leaf utilities. CSS additions are scoped to the single `index.css` file.

**Phasing per spec:** Tasks 1-2 = foundation (assets + voices). Task 3 = mod-fired SFX listener. Task 4 = Forge SFX. Tasks 5-7 = visual changes (button juice, chip hover, orbital popup). Visual changes ship last so SFX changes land cleanly first.

---

## Task 1: Sample assets + Howler sampleBank

**Files:**
- New dir: `public/sfx/`
- New files: `public/sfx/uiClick.wav`, `public/sfx/uiHover.wav`, `public/sfx/modAttach.wav`, `public/sfx/modDetach.wav`
- Create: `src-next/audio/sfx/sampleBank.ts`
- Test: `src-next/audio/sfx/__tests__/sampleBank.test.ts`

### Step 1: Source 4 sample files

Visit https://kenney.nl/assets/interface-sounds (CC0 license, no attribution required but appreciated). Pack contains ~70 WAVs. Pick 4:

- `uiClick.wav` — bright crisp click. Suggestions: `interface_click_001.ogg` or similar punchy short click. Convert to WAV if needed (any bitrate ≤ 24-bit / 48 kHz fine for Howler).
- `uiHover.wav` — soft swish, very short (~80ms). Suggestions: `interface_select_001.ogg` or hover variant.
- `modAttach.wav` — satisfying lock-in / connect feel. Suggestions: `confirmation_001.ogg`, `bong_001.ogg`.
- `modDetach.wav` — soft disconnect / sigh. Suggestions: `error_001.ogg` reversed, or quick swoosh.

Place all 4 under `public/sfx/`. Keep file sizes < 30KB each (compress to mono if needed).

### Step 2: Write the failing test

```ts
// src-next/audio/sfx/__tests__/sampleBank.test.ts
import { describe, it, expect, vi } from 'vitest';
import { buildSampleBank, playSample, type SampleId } from '../sampleBank';

vi.mock('howler', () => ({
  Howl: vi.fn().mockImplementation(({ src }: { src: string[] }) => ({
    src,
    play: vi.fn(),
    unload: vi.fn(),
  })),
}));

describe('sampleBank', () => {
  it('exposes 4 sample ids', () => {
    const ids: SampleId[] = ['uiClick', 'uiHover', 'modAttach', 'modDetach'];
    expect(ids.length).toBe(4);
  });

  it('buildSampleBank loads 4 Howl instances', () => {
    const bank = buildSampleBank();
    expect(Object.keys(bank).length).toBe(4);
    expect((bank as Record<string, { src: string[] }>).uiClick.src[0]).toMatch(/uiClick\.wav$/);
  });

  it('playSample calls .play() on the matching Howl', () => {
    const bank = buildSampleBank();
    playSample(bank, 'uiClick');
    expect((bank as Record<string, { play: ReturnType<typeof vi.fn> }>).uiClick.play).toHaveBeenCalled();
  });
});
```

### Step 3: Run test to verify it fails

Run: `npm test -- src-next/audio/sfx/__tests__/sampleBank.test.ts`
Expected: FAIL — module not found.

### Step 4: Implement `sampleBank.ts`

```ts
// src-next/audio/sfx/sampleBank.ts
import { Howl } from 'howler';

export type SampleId = 'uiClick' | 'uiHover' | 'modAttach' | 'modDetach';

export type SampleBank = Record<SampleId, Howl>;

const SAMPLE_PATHS: Record<SampleId, string> = {
  uiClick: '/sfx/uiClick.wav',
  uiHover: '/sfx/uiHover.wav',
  modAttach: '/sfx/modAttach.wav',
  modDetach: '/sfx/modDetach.wav',
};

const SAMPLE_VOLUMES: Record<SampleId, number> = {
  uiClick: 0.5,
  uiHover: 0.25,
  modAttach: 0.6,
  modDetach: 0.5,
};

export function buildSampleBank(): SampleBank {
  const bank = {} as SampleBank;
  for (const id of Object.keys(SAMPLE_PATHS) as SampleId[]) {
    bank[id] = new Howl({
      src: [SAMPLE_PATHS[id]],
      volume: SAMPLE_VOLUMES[id],
      preload: true,
    });
  }
  return bank;
}

export function playSample(bank: SampleBank, id: SampleId): void {
  const howl = bank[id];
  if (!howl) return;
  howl.play();
}
```

### Step 5: Run test to verify it passes

Run: `npm test -- src-next/audio/sfx/__tests__/sampleBank.test.ts`
Expected: PASS, 3 tests.

### Step 6: Commit

```bash
git add public/sfx/ src-next/audio/sfx/sampleBank.ts src-next/audio/sfx/__tests__/sampleBank.test.ts
git commit -m "feat(audio): add Howler-based sample bank for UI/Forge impact sounds"
```

---

## Task 2: New synth voices + SfxId extension

**Files:**
- Modify: `src-next/audio/sfx/synthBank.ts`
- Modify: `src-next/audio/sfx/voices.ts`
- Modify: `src-next/audio/sfx/index.ts`

### Step 1: Extend `SynthBank` type in `synthBank.ts`

Find the existing `SynthBank` type (around line 7-29). Add 4 new entries before `buses` and `master`:

```ts
  modPulse: { chime: Tone.FMSynth };
  modLoaded: { chord: Tone.PolySynth; whoosh: Tone.NoiseSynth };
  modPipCharge: { tick: Tone.FMSynth };
  modBackstop: { ding: Tone.FMSynth; rumble: Tone.NoiseSynth };
```

### Step 2: Build the 4 new synth chains in `buildBank()`

Find `buildBank()` function. Before the `return { ... };` statement at the end, add:

```ts
  // ---- modPulse: bright single chime ----
  const modPulse = {
    chime: new Tone.FMSynth({
      modulationIndex: 6,
      envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.12 },
      modulationEnvelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    }),
  };
  modPulse.chime.connect(buses.melody.input);

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
  modLoaded.chord.connect(buses.melody.input);
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
  modBackstop.ding.connect(buses.melody.input);
  modBackstop.rumble.connect(buses.perc.input);
```

Also add the 4 keys to the `return` object at the end:

```ts
    modPulse,
    modLoaded,
    modPipCharge,
    modBackstop,
```

### Step 3: Add 4 voice functions to `voices.ts`

Append at the end of `voices.ts`:

```ts
// ---- modPulse: short bright chime per generic mod fire -------------------
export function modPulse(bank: SynthBank): void {
  const t = jitteredTime();
  const hz = pickPent(7) * centsToRatio(jitterCents());
  bank.modPulse.chime.volume.value = vol('modPulse', -18);
  bank.modPulse.chime.triggerAttackRelease(hz, '16n', t);
}

// ---- modLoaded: rising bronze chord + whoosh -----------------------------
export function modLoaded(bank: SynthBank): void {
  const t = jitteredTime();
  bank.modLoaded.chord.volume.value = vol('modLoadedChord', -16);
  bank.modLoaded.whoosh.volume.value = vol('modLoadedWhoosh', -22);
  bank.modLoaded.chord.triggerAttackRelease(['C4', 'E4', 'G4'], '4n', t);
  bank.modLoaded.whoosh.triggerAttackRelease('8n', t);
}

// ---- modPipCharge: percussive amber tick ---------------------------------
export function modPipCharge(bank: SynthBank): void {
  const t = jitteredTime();
  const hz = 880 * centsToRatio(jitterCents());
  bank.modPipCharge.tick.volume.value = vol('modPipCharge', -16);
  bank.modPipCharge.tick.triggerAttackRelease(hz, '32n', t);
}

// ---- modBackstop: warm low ding + soft rumble ----------------------------
export function modBackstop(bank: SynthBank): void {
  const t = jitteredTime();
  bank.modBackstop.ding.volume.value = vol('modBackstop', -16);
  bank.modBackstop.rumble.volume.value = vol('modBackstopRumble', -22);
  bank.modBackstop.ding.triggerAttackRelease('A3', '4n', t);
  bank.modBackstop.rumble.triggerAttackRelease('8n', t + 0.02);
}
```

### Step 4: Extend SfxId + sfxPlay in `index.ts`

Find the `SfxId` type (around line 7-11). Replace with:

```ts
export type SfxId =
  | 'diceClack' | 'lockTap' | 'reroll' | 'buy'
  | 'combo' | 'upgrade' | 'bossSting' | 'bigScore' | 'win' | 'bust'
  | 'chipTick' | 'castSwell' | 'castBoom' | 'sigilDraw' | 'cardFlip' | 'nodePulse' | 'transitionWipe'
  | 'multSlam' | 'comboChime' | 'targetCross' | 'notEnough'
  | 'modPulse' | 'modLoaded' | 'modPipCharge' | 'modBackstop'
  | 'modAttach' | 'modDetach' | 'uiClick' | 'uiHover';
```

At the top of the file, add the sample bank import:

```ts
import { buildSampleBank, playSample, type SampleBank } from './sampleBank';
```

Add a module-level sample bank variable next to the existing `bank` variable (around line 17):

```ts
let sampleBank: SampleBank | null = null;
```

In `sfxInit()`, after `bank = legacyMode ? ... : await buildBank();`, add:

```ts
    sampleBank = buildSampleBank();
```

Extend the `sfxPlay` switch statement. Find the closing `}` of the switch (around line 91) and add 8 new cases right before it:

```ts
      case 'modPulse':       (v as typeof voices).modPulse(bank as never); break;
      case 'modLoaded':      (v as typeof voices).modLoaded(bank as never); break;
      case 'modPipCharge':   (v as typeof voices).modPipCharge(bank as never); break;
      case 'modBackstop':    (v as typeof voices).modBackstop(bank as never); break;
      case 'modAttach':      if (sampleBank) playSample(sampleBank, 'modAttach'); break;
      case 'modDetach':      if (sampleBank) playSample(sampleBank, 'modDetach'); break;
      case 'uiClick':        if (sampleBank) playSample(sampleBank, 'uiClick'); break;
      case 'uiHover':        if (sampleBank) playSample(sampleBank, 'uiHover'); break;
```

### Step 5: Run all tests + typecheck

Run: `npm test`
Expected: All 287 tests still pass. (No new tests in this task — voice functions are exercised by the integration test in Task 3.)

Run: `npx tsc --noEmit`
Expected: No new error categories.

### Step 6: Commit

```bash
git add src-next/audio/sfx/synthBank.ts src-next/audio/sfx/voices.ts src-next/audio/sfx/index.ts
git commit -m "feat(audio): add 8 new SfxIds (mod-* synth + sample-based UI/Forge)"
```

---

## Task 3: `onModFired` SFX listener

**Files:**
- Modify: `src-next/audio/audioBridge.ts`

### Step 1: Add the listener to `startAudioBridge()`

In `src-next/audio/audioBridge.ts`, find the existing `subs` array (around line 11-55). Add a new entry to the array, after the existing `bus.on('onLockToggled', ...)` line:

```ts
    bus.on('onModFired', ({ modId }) => {
      const def = lookupMod(modId);
      const trigger = def?.visual?.triggerFx;
      switch (trigger) {
        case 'pulse':     sfxPlay('modPulse'); break;
        case 'loaded':    sfxPlay('modLoaded'); break;
        case 'pipCharge': sfxPlay('modPipCharge'); break;
        case 'backstop':  sfxPlay('modBackstop'); break;
      }
    }),
```

Also add the `lookupMod` import at the top of the file:

```ts
import { lookupMod } from '../core/mods';
```

### Step 2: Write a test

```ts
// src-next/audio/__tests__/modFiredSfx.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bus } from '../../events/bus';
import * as sfxModule from '../sfx';

describe('onModFired → sfxPlay routing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('plays modPulse for triggerFx=pulse mods (e.g. amplify)', async () => {
    const playSpy = vi.spyOn(sfxModule, 'sfxPlay');
    const { startAudioBridge } = await import('../audioBridge');
    const stop = startAudioBridge();
    bus.emit('onModFired', { dieIdx: 0, modId: 'amplify', faceValue: 3 });
    expect(playSpy).toHaveBeenCalledWith('modPulse');
    stop();
  });

  it('plays modLoaded for triggerFx=loaded (loaded mod)', async () => {
    const playSpy = vi.spyOn(sfxModule, 'sfxPlay');
    const { startAudioBridge } = await import('../audioBridge');
    const stop = startAudioBridge();
    bus.emit('onModFired', { dieIdx: 0, modId: 'loaded', faceValue: 1 });
    expect(playSpy).toHaveBeenCalledWith('modLoaded');
    stop();
  });

  it('plays modBackstop for triggerFx=backstop (backstop mod)', async () => {
    const playSpy = vi.spyOn(sfxModule, 'sfxPlay');
    const { startAudioBridge } = await import('../audioBridge');
    const stop = startAudioBridge();
    bus.emit('onModFired', { dieIdx: 0, modId: 'backstop', faceValue: 1 });
    expect(playSpy).toHaveBeenCalledWith('modBackstop');
    stop();
  });

  it('plays modPipCharge for triggerFx=pipCharge (pip_charge mod)', async () => {
    const playSpy = vi.spyOn(sfxModule, 'sfxPlay');
    const { startAudioBridge } = await import('../audioBridge');
    const stop = startAudioBridge();
    bus.emit('onModFired', { dieIdx: 0, modId: 'pip_charge', faceValue: 4 });
    expect(playSpy).toHaveBeenCalledWith('modPipCharge');
    stop();
  });
});
```

Note: this test relies on `vi.spyOn(sfxModule, 'sfxPlay')` working with the namespace import in `audioBridge.ts`. If audioBridge imports `sfxPlay` directly via named import (line 5: `import { sfxPlay, ... } from './sfx'`), the spy won't intercept. To fix that during this task, change the import in `audioBridge.ts` to namespace form:

```ts
import * as sfxModule from './sfx';
const { sfxSetMaster, sfxGetMaster, sfxBank } = sfxModule;
```

And replace direct `sfxPlay(...)` calls inside the listeners with `sfxModule.sfxPlay(...)`. This mirrors the pattern used in Phase 5/6's `Dice3D.ts` for the same reason.

### Step 3: Run test to verify it fails

Run: `npm test -- src-next/audio/__tests__/modFiredSfx.test.ts`
Expected: FAIL — listener not yet added.

### Step 4: Run test to verify it passes (after edits in Step 1)

Run: `npm test -- src-next/audio/__tests__/modFiredSfx.test.ts`
Expected: PASS, 4 tests.

### Step 5: Run full suite

Run: `npm test`
Expected: All tests pass (287 + 4 new = **291 expected**).

### Step 6: Commit

```bash
git add src-next/audio/audioBridge.ts src-next/audio/__tests__/modFiredSfx.test.ts
git commit -m "feat(audio): route onModFired events to per-trigger mod-* SFX"
```

---

## Task 4: Forge SFX hooks for mod attach/detach

**Files:**
- Modify: `src-next/app/screens/Forge.tsx`

### Step 1: Add `sfxPlay` import

In `src-next/app/screens/Forge.tsx`, find the existing imports at the top. Add:

```ts
import { sfxPlay } from '../../audio/sfx';
```

### Step 2: Wrap the attach handler

Find the existing chip onClick handler (around line 138-140 — the `dispatch({ type: 'ATTACH_MOD', ... })` call). It currently looks like:

```tsx
                  onClick={() => canAttach && dispatch({ type: 'ATTACH_MOD', dieIdx: selectedDie, modId: r.id })}
```

Replace with:

```tsx
                  onClick={() => {
                    if (!canAttach) return;
                    dispatch({ type: 'ATTACH_MOD', dieIdx: selectedDie, modId: r.id });
                    sfxPlay('modAttach');
                  }}
```

### Step 3: Wrap the detach handler

Find the existing detach button onClick (search for `'DETACH_MOD'`). Currently looks like:

```tsx
                onClick={() => dispatch({ type: 'DETACH_MOD', dieIdx: selectedDie, modIdx: idx })}
```

Replace with:

```tsx
                onClick={() => {
                  dispatch({ type: 'DETACH_MOD', dieIdx: selectedDie, modIdx: idx });
                  sfxPlay('modDetach');
                }}
```

### Step 4: Run all tests + typecheck

Run: `npm test`
Expected: All tests pass.

Run: `npx tsc --noEmit`
Expected: No new errors.

### Step 5: Commit

```bash
git add src-next/app/screens/Forge.tsx
git commit -m "feat(forge): play modAttach/modDetach SFX on mod toggle"
```

---

## Task 5: `buttonJuice.ts` — global press juice + UI SFX delegate

**Files:**
- Create: `src-next/app/hud/buttonJuice.ts`
- Create: `src-next/app/hud/buttonJuice.test.ts`
- Modify: `src-next/styles/index.css`
- Modify: `src-next/main.tsx` (or `App.tsx` if installed there)

### Step 1: Write the failing test

```ts
// src-next/app/hud/buttonJuice.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { installButtonJuice } from './buttonJuice';
import * as sfxModule from '../../audio/sfx';

describe('buttonJuice', () => {
  let teardown: (() => void) | null = null;

  beforeEach(() => {
    document.body.innerHTML = '<button class="btn-primary">Roll</button>';
    vi.spyOn(sfxModule, 'sfxPlay').mockImplementation(() => {});
  });

  afterEach(() => {
    teardown?.();
    teardown = null;
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('plays uiClick on .btn-primary mousedown', () => {
    teardown = installButtonJuice();
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(sfxModule.sfxPlay).toHaveBeenCalledWith('uiClick');
  });

  it('plays uiHover on .btn-primary mouseenter', () => {
    teardown = installButtonJuice();
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    expect(sfxModule.sfxPlay).toHaveBeenCalledWith('uiHover');
  });

  it('spawns a .btn-shockwave element on mouseup', () => {
    teardown = installButtonJuice();
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    const shockwave = document.querySelector('.btn-shockwave');
    expect(shockwave).not.toBeNull();
  });

  it('teardown removes all delegated listeners', () => {
    teardown = installButtonJuice();
    teardown();
    teardown = null;
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(sfxModule.sfxPlay).not.toHaveBeenCalled();
  });

  it('skips shockwave when reduce-motion is set', () => {
    document.documentElement.classList.add('reduce-motion');
    teardown = installButtonJuice();
    const btn = document.querySelector('.btn-primary')! as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    const shockwave = document.querySelector('.btn-shockwave');
    expect(shockwave).toBeNull();
    document.documentElement.classList.remove('reduce-motion');
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- src-next/app/hud/buttonJuice.test.ts`
Expected: FAIL — module not found.

### Step 3: Implement `buttonJuice.ts`

```ts
// src-next/app/hud/buttonJuice.ts
import * as sfxModule from '../../audio/sfx';

const SHOCKWAVE_DURATION_MS = 400;

function isPrimaryButton(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const btn = target.closest('.btn-primary');
  return btn instanceof HTMLElement ? btn : null;
}

function reducedMotion(): boolean {
  return document.documentElement.classList.contains('reduce-motion');
}

function spawnShockwave(btn: HTMLElement): void {
  const rect = btn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const wave = document.createElement('div');
  wave.className = 'btn-shockwave';
  // Read accent from button's computed border-color (fallback cyan).
  const computed = window.getComputedStyle(btn).borderColor;
  const accent = computed && computed !== 'rgba(0, 0, 0, 0)' ? computed : '#7be3ff';
  wave.style.setProperty('--wave-accent', accent);
  wave.style.left = `${cx}px`;
  wave.style.top = `${cy}px`;
  document.body.appendChild(wave);
  const cleanup = () => {
    wave.removeEventListener('animationend', cleanup);
    if (wave.parentNode) wave.parentNode.removeChild(wave);
  };
  wave.addEventListener('animationend', cleanup);
  // Fallback removal in case animationend doesn't fire.
  setTimeout(cleanup, SHOCKWAVE_DURATION_MS + 200);
}

export function installButtonJuice(): () => void {
  const onMouseDown = (ev: MouseEvent): void => {
    if (!isPrimaryButton(ev.target)) return;
    sfxModule.sfxPlay('uiClick');
  };
  const onMouseUp = (ev: MouseEvent): void => {
    const btn = isPrimaryButton(ev.target);
    if (!btn) return;
    if (reducedMotion()) return;
    spawnShockwave(btn);
  };
  const onMouseEnter = (ev: MouseEvent): void => {
    if (!isPrimaryButton(ev.target)) return;
    sfxModule.sfxPlay('uiHover');
  };
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  // mouseenter doesn't bubble; use mouseover with closest() filter instead.
  document.addEventListener('mouseover', onMouseEnter);
  return () => {
    document.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('mouseover', onMouseEnter);
  };
}
```

Note: for `mouseenter` test compatibility, the implementation listens to `mouseover` (which bubbles) and filters by `closest('.btn-primary')`. The test dispatches `mouseenter` but jsdom will also receive `mouseenter` as a `mouseover` for delegation purposes — verify this works in the test run; if not, change the test to dispatch `mouseover` instead.

### Step 4: Add CSS keyframes/styles

In `src-next/styles/index.css`, append:

```css
/* Button juice — press scale + accent shockwave on release. */
.btn-primary {
  transition: transform 180ms ease-out;
}
.btn-primary:active {
  transform: scale(0.96);
  transition: transform 60ms ease-out;
}
.btn-shockwave {
  position: fixed;
  pointer-events: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--wave-accent, #7be3ff);
  box-shadow: 0 0 16px var(--wave-accent, #7be3ff);
  transform: translate(-50%, -50%) scale(0.4);
  animation: ringExpand 400ms ease-out forwards;
  z-index: 999;
}
.reduce-motion .btn-primary { transition: none; }
.reduce-motion .btn-primary:active { transform: none; }
```

(The `ringExpand` keyframe already exists in `index.css:127`.)

### Step 5: Run test to verify it passes

Run: `npm test -- src-next/app/hud/buttonJuice.test.ts`
Expected: PASS, 5 tests. If `mouseenter` doesn't bubble correctly in jsdom, change the test's `'mouseenter'` to `'mouseover'`.

### Step 6: Wire `installButtonJuice()` at app root

Find `src-next/main.tsx` (or `src-next/app/App.tsx` — check which one mounts the React tree). At the top-level effect or main body, after `startAudioBridge()` is called, add:

```ts
installButtonJuice();
```

Add the import at the top:

```ts
import { installButtonJuice } from './app/hud/buttonJuice';
// (adjust relative path based on caller location)
```

If the install is in a long-lived singleton (no cleanup needed), the returned teardown can be discarded. If the install is in a React effect, return the teardown.

### Step 7: Run all tests + typecheck

Run: `npm test`
Expected: All tests pass.

Run: `npx tsc --noEmit`
Expected: No new errors.

### Step 8: Commit

```bash
git add src-next/app/hud/buttonJuice.ts src-next/app/hud/buttonJuice.test.ts src-next/styles/index.css src-next/main.tsx
git commit -m "feat(hud): global button juice — press scale + shockwave + UI SFX"
```

---

## Task 6: Codex chip hover CSS

**Files:**
- Modify: `src-next/styles/index.css`

### Step 1: Add hover keyframes/rules

In `src-next/styles/index.css`, append:

```css
/* Forge codex chip — hover pulse + accent ring overlay. */
@keyframes mod-chip-pulse {
  0%, 100% {
    filter: drop-shadow(0 0 4px var(--mod-c, #7be3ff));
  }
  50% {
    filter: drop-shadow(0 0 10px var(--mod-c, #7be3ff)) brightness(1.3);
  }
}
.forge-mod-row {
  position: relative;
}
.forge-mod-row:hover {
  border-color: var(--mod-c, rgba(149,119,255,0.4));
  box-shadow: 0 0 12px var(--mod-c, transparent);
  transition: border-color 200ms, box-shadow 200ms;
}
.forge-mod-row:hover > div:first-child {
  /* Targets the icon-tile (first child div per Forge.tsx structure). */
  animation: mod-chip-pulse 1200ms ease-in-out infinite;
  transform: rotate(5deg) scale(1.1);
  transition: transform 200ms ease-out;
}
.reduce-motion .forge-mod-row:hover > div:first-child {
  animation: none;
  transform: none;
}
```

### Step 2: Verify visually (no automated test)

Run: `npm run dev`. Open the Forge in the browser. Hover any codex chip — confirm:
- Border lights up in the mod's accent color
- Icon glows + scales up slightly + rotates 5deg
- Outer chip has a brief drop-shadow
- Reduced-motion (OS toggle) → hover state still works but without animation

### Step 3: Run automated tests + typecheck

Run: `npm test`
Expected: All tests pass (CSS-only change; no test impact).

Run: `npm run build`
Expected: Production build succeeds.

### Step 4: Commit

```bash
git add src-next/styles/index.css
git commit -m "feat(forge): codex chip hover — accent pulse + ring overlay"
```

---

## Task 7: `orbitalFly.ts` + `Particles.tsx` integration

**Files:**
- Create: `src-next/app/hud/orbitalFly.ts`
- Create: `src-next/app/hud/orbitalFly.test.ts`
- Modify: `src-next/app/hud/Particles.tsx`

### Step 1: Write the failing test

```ts
// src-next/app/hud/orbitalFly.test.ts
import { describe, it, expect } from 'vitest';
import { computeOrbitalPosition } from './orbitalFly';

describe('computeOrbitalPosition', () => {
  const opts = { startX: 200, startY: 300, endX: 50, endY: 50 };

  it('at t=0 returns start position', () => {
    const p = computeOrbitalPosition(opts, 0);
    expect(p.x).toBeCloseTo(200, 1);
    expect(p.y).toBeCloseTo(300, 1);
  });

  it('at t=0.2 (arc-up stage), y is between start and a point above end', () => {
    const p = computeOrbitalPosition(opts, 0.2);
    expect(p.y).toBeLessThan(opts.startY);
    expect(p.y).toBeGreaterThan(opts.endY - 200);
  });

  it('at t=0.5 (orbit stage), distance from end is ~orbit radius', () => {
    const p = computeOrbitalPosition(opts, 0.5);
    const dx = p.x - opts.endX;
    const dy = p.y - opts.endY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeGreaterThan(15);
    expect(dist).toBeLessThan(50);
  });

  it('at t=1 (dock stage end), is at end position', () => {
    const p = computeOrbitalPosition(opts, 1);
    expect(p.x).toBeCloseTo(opts.endX, 1);
    expect(p.y).toBeCloseTo(opts.endY, 1);
  });

  it('opacity at t=0.95 (dock late) is fading', () => {
    const p = computeOrbitalPosition(opts, 0.95);
    expect(p.opacity).toBeLessThan(0.5);
    expect(p.opacity).toBeGreaterThanOrEqual(0);
  });

  it('opacity at t=0.5 (orbit) is full', () => {
    const p = computeOrbitalPosition(opts, 0.5);
    expect(p.opacity).toBeCloseTo(1, 1);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- src-next/app/hud/orbitalFly.test.ts`
Expected: FAIL — module not found.

### Step 3: Implement `orbitalFly.ts`

```ts
// src-next/app/hud/orbitalFly.ts

export type OrbitalOpts = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  durationMs?: number;
};

export type OrbitalPosition = {
  x: number;
  y: number;
  scale: number;
  opacity: number;
};

const DEFAULT_DURATION_MS = 1100;
const ORBIT_RADIUS = 30;
const ARC_APEX_HEIGHT = 80; // px above end position the arc passes through

const STAGE_ARC_END = 0.4;
const STAGE_ORBIT_END = 0.75;

export function computeOrbitalPosition(opts: OrbitalOpts, t: number): OrbitalPosition {
  const tt = Math.max(0, Math.min(1, t));
  const { startX, startY, endX, endY } = opts;

  if (tt <= STAGE_ARC_END) {
    // Arc-up stage: bezier from start to (endX, endY - ARC_APEX_HEIGHT).
    const apexX = endX;
    const apexY = endY - ARC_APEX_HEIGHT;
    const u = tt / STAGE_ARC_END;
    // Quadratic bezier control point above midline for upward arc.
    const ctrlX = (startX + apexX) / 2;
    const ctrlY = Math.min(startY, apexY) - 60;
    const x = (1 - u) * (1 - u) * startX + 2 * (1 - u) * u * ctrlX + u * u * apexX;
    const y = (1 - u) * (1 - u) * startY + 2 * (1 - u) * u * ctrlY + u * u * apexY;
    return { x, y, scale: 1, opacity: 1 };
  }

  if (tt <= STAGE_ORBIT_END) {
    // Orbit stage: full circle around (endX, endY) at radius ORBIT_RADIUS.
    const u = (tt - STAGE_ARC_END) / (STAGE_ORBIT_END - STAGE_ARC_END);
    const angle = -Math.PI / 2 + u * Math.PI * 2; // start at top, full revolution
    const x = endX + ORBIT_RADIUS * Math.cos(angle);
    const y = endY + ORBIT_RADIUS * Math.sin(angle);
    return { x, y, scale: 1, opacity: 1 };
  }

  // Dock stage: spiral inward from orbit end-point to (endX, endY) with fade.
  const u = (tt - STAGE_ORBIT_END) / (1 - STAGE_ORBIT_END);
  // At STAGE_ORBIT_END the angle was top of circle (-PI/2); we contract from
  // (endX + 0, endY - ORBIT_RADIUS) to (endX, endY).
  const radius = ORBIT_RADIUS * (1 - u);
  const angle = -Math.PI / 2;
  const x = endX + radius * Math.cos(angle);
  const y = endY + radius * Math.sin(angle);
  const scale = 1 - u * 0.5;
  const opacity = 1 - u;
  return { x, y, scale, opacity };
}

export function animateOrbital(
  el: HTMLElement,
  opts: OrbitalOpts,
): { dispose: () => void } {
  const reduced = document.documentElement.classList.contains('reduce-motion');
  const duration = opts.durationMs ?? DEFAULT_DURATION_MS;
  const t0 = performance.now();
  let raf: number | null = null;
  let disposed = false;

  if (reduced) {
    // Reduced-motion: snap to end with quick fade.
    el.style.transform = `translate(${opts.endX}px, ${opts.endY}px) scale(0.6)`;
    el.style.opacity = '0';
    el.style.transition = 'opacity 100ms';
    return { dispose: () => { /* nothing to cancel */ } };
  }

  const tick = () => {
    if (disposed) return;
    const dt = performance.now() - t0;
    const t = dt / duration;
    if (t >= 1) {
      const p = computeOrbitalPosition(opts, 1);
      el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${p.scale})`;
      el.style.opacity = `${p.opacity}`;
      return;
    }
    const p = computeOrbitalPosition(opts, t);
    el.style.transform = `translate(${p.x}px, ${p.y}px) scale(${p.scale})`;
    el.style.opacity = `${p.opacity}`;
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);

  return {
    dispose: () => {
      disposed = true;
      if (raf != null) cancelAnimationFrame(raf);
    },
  };
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- src-next/app/hud/orbitalFly.test.ts`
Expected: PASS, 6 tests.

### Step 5: Replace `FlyingNumber` in `Particles.tsx`

Find the existing `FlyingNumber` component (around lines 113-128). Replace with a ref-based version using `animateOrbital`:

```tsx
function FlyingNumber({ from, to, text, color }: { from: { x: number; y: number }; to: { x: number; y: number }; text: string; color: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Initial position is at "from".
    ref.current.style.transform = `translate(${from.x}px, ${from.y}px)`;
    ref.current.style.opacity = '1';
    const handle = animateOrbital(ref.current, {
      startX: from.x,
      startY: from.y,
      endX: to.x,
      endY: to.y,
      durationMs: 1100,
    });
    return () => handle.dispose();
  }, [from.x, from.y, to.x, to.y]);

  return (
    <div ref={ref} style={{
      position: 'absolute',
      left: 0, top: 0,
      color, fontFamily: '"Cinzel Decorative", serif',
      fontSize: 24, fontWeight: 700,
      textShadow: `0 0 10px ${color}`,
      transform: `translate(${from.x}px, ${from.y}px)`,
      willChange: 'transform, opacity',
    }}>{text}</div>
  );
}
```

Add the import at the top of `Particles.tsx`:

```ts
import { animateOrbital } from './orbitalFly';
```

### Step 6: Update the fly's auto-removal timeout

In the existing `useEffect` setting up `bus.on('onScoreBeat', ...)` (around line 35-61), find the `die-tick` handler. The current `setTimeout` to remove flies is 600ms — bump it to 1200ms so the orbital animation has time to complete:

Change:

```ts
        setTimeout(() => setFlies((f) => f.filter((v) => v.id !== id)), 600);
```

to:

```ts
        setTimeout(() => setFlies((f) => f.filter((v) => v.id !== id)), 1200);
```

### Step 7: Run all tests + typecheck

Run: `npm test`
Expected: All tests pass.

Run: `npx tsc --noEmit`
Expected: No new errors.

### Step 8: Manual verify

Run: `npm run dev`. Reach a round, attach a mod (e.g. Amplify) to die 0, roll, play hand. During score sequence:
- Each die-tick spawns a `+chips` token
- Token shoots up, loops once around the score counter, then docks
- ~1.1s total per token

If multiple tokens overlap visually, that's expected — score sequence ticks dice in rapid succession.

### Step 9: Commit

```bash
git add src-next/app/hud/orbitalFly.ts src-next/app/hud/orbitalFly.test.ts src-next/app/hud/Particles.tsx
git commit -m "feat(hud): orbital score-popup motion — loop-around path replaces linear"
```

---

## Verification (whole phase, automated)

Run from the repo root:

- [ ] `npm test` → all tests pass (existing 287 + 3 sample + 4 modFiredSfx + 5 buttonJuice + 6 orbitalFly = **305 expected**).
- [ ] `npx tsc --noEmit` → no new TypeScript error categories.
- [ ] `npm run build` → production build succeeds.

---

## Out of Scope (future)

- Tension-driven music shifts (`screenMusic.ts` infrastructure ready; just needs hooking).
- Per-screen SFX themes (different button-click sound on Forge vs Round vs Hub).
- Settings panel SFX volume slider (existing `audioSettings` infra supports this; UI not yet built).
- Per-button-class custom juice (e.g. `.btn-danger` red shockwave).
- Tuning new synth voice timbres beyond first-pass values — opportunistic follow-up.
- Forge selector strip per-die mod material flow (pre-existing limitation).

---

## Notes / Open Risks

- **Sample license tracking.** kenney.nl Interface Sounds Pack is CC0 (no attribution required). Adding a credit line in README is good practice — not blocking.
- **`vi.spyOn` interception in `audioBridge.ts`.** Task 3 changes `audioBridge.ts` to use `import * as sfxModule from './sfx'` so the spy works. This is the same workaround pattern used for Phase 1's webglDetect and Phase 5's buildDie. Keeps tests reliable.
- **`mouseover` vs `mouseenter` in jsdom.** Task 5 tests `mouseenter` but the implementation listens to `mouseover` (since mouseenter doesn't bubble). jsdom should fire both; if test fails, change test to dispatch `mouseover`.
- **Shockwave color resolution.** Pulls from button's computed `border-color`. For buttons with no border, falls back to `#7be3ff`. `Forge.tsx` Done button uses `.btn-primary .mat-interactive` — check that it has a discernible accent during manual verification.
- **Particle count on round-clear ceremony.** A 5-die round-clear could produce 5+ orbital tokens in rapid succession. Each is rAF-driven; visual clutter possible but `setFlies` setTimeout already removes them after 1.2s. If clutter feels bad, throttle in Particles.tsx (only spawn one orbital per beat).
- **Score counter element selector dependency.** `[data-score-counter]` already exists in `ScoreFloat.tsx`. If that screen is unmounted mid-score animation, target lookup falls back to default coords (handled by existing `Particles.tsx` code path). No new failure modes.
