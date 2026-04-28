# Pause Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pause overlay (Esc / corner button) with a Resume action, 3-channel audio mixer (Master/Music/Sfx), inline Portal access, and Back-to-Title.

**Architecture:** New `audioSettings` singleton owns 3 persisted volume values + subscription mechanism. AudioEngine, ScreenMusic, and sfx subscribe to it and recompute applied gain on change. New `<PauseMenu />` component renders top-level overlay when `s.ui.paused === true`. `<PauseButton />` corner icon mounted on play screens. App-level Esc keydown listener and audio pause coupling.

**Tech Stack:** TypeScript, React 18, Zustand (existing), Howler (music), Tone.js (sfx), Vitest.

**Spec:** [docs/superpowers/specs/2026-04-28-pause-screen-design.md](../specs/2026-04-28-pause-screen-design.md)

---

## File Structure

**Created:**
- `src-next/audio/audioSettings.ts` — central singleton: 3 volume values, getters/setters, subscription.
- `src-next/audio/audioSettings.test.ts` — 6 tests.
- `src-next/app/hud/PauseMenu.tsx` — overlay component.
- `src-next/app/hud/PauseButton.tsx` — corner icon button.

**Modified:**
- `src-next/audio/AudioEngine.ts` — drop own `master` field; subscribe to `audioSettings`; multiply `master × music` into applied gain.
- `src-next/audio/ScreenMusic.ts` — same pattern.
- `src-next/audio/sfx/index.ts` — replace direct `loadVolume`/`sfxSetMaster` with `audioSettings`-backed reads + subscription.
- `src-next/app/App.tsx` — mount `<PauseMenu />` top-level + Esc keydown listener + audio pause coupling subscriber.
- `src-next/app/screens/Round.tsx` — mount `<PauseButton />`.
- `src-next/app/screens/Hub.tsx` — mount `<PauseButton />`.
- `src-next/app/screens/Forge.tsx` — mount `<PauseButton />`.
- `src-next/app/screens/Shop.tsx` — mount `<PauseButton />`.

## Conventions

- One commit per task. Each commit must build green + tests green.
- Stage paths explicitly. Do NOT use `git add -A` (`.claude/settings.local.json` is dirty in working tree).
- Tests grow from 188 → ~194 (+6 audioSettings).
- Branch: working on `feat/pause-screen`. PR target: `main`.

---

## Task 1: `audioSettings` module + tests

**Files:**
- Create: `src-next/audio/audioSettings.ts`
- Create: `src-next/audio/audioSettings.test.ts`

This module is the central source of truth for 3 volume values (master/music/sfx) and a subscription mechanism. Subsequent tasks wire engines to it.

- [ ] **Step 1: Create the module**

`src-next/audio/audioSettings.ts`:

```ts
const MASTER_KEY = 'ff_next_masterVol';
const MUSIC_KEY  = 'ff_next_audioVol';   // existing key, repurposed as music-only
const SFX_KEY    = 'ff_next_sfxVol';     // existing key, kept

const DEFAULT_MASTER = 0.7;
const DEFAULT_MUSIC  = 1.0;
const DEFAULT_SFX    = 1.0;

const listeners = new Set<() => void>();

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function readKey(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? clamp(n) : fallback;
  } catch {
    return fallback;
  }
}

function writeKey(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch { /* ignore */ }
}

export function getMaster(): number { return readKey(MASTER_KEY, DEFAULT_MASTER); }
export function getMusic(): number  { return readKey(MUSIC_KEY,  DEFAULT_MUSIC);  }
export function getSfx(): number    { return readKey(SFX_KEY,    DEFAULT_SFX);    }

export function setMaster(v: number): void {
  writeKey(MASTER_KEY, clamp(v));
  notify();
}
export function setMusic(v: number): void {
  writeKey(MUSIC_KEY, clamp(v));
  notify();
}
export function setSfx(v: number): void {
  writeKey(SFX_KEY, clamp(v));
  notify();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify(): void {
  for (const fn of listeners) {
    try { fn(); } catch (e) { console.warn('[audioSettings] listener error:', e); }
  }
}
```

- [ ] **Step 2: Write the failing tests**

`src-next/audio/audioSettings.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as audioSettings from './audioSettings';

describe('audioSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when localStorage empty (master=0.7, music=1.0, sfx=1.0)', () => {
    expect(audioSettings.getMaster()).toBe(0.7);
    expect(audioSettings.getMusic()).toBe(1.0);
    expect(audioSettings.getSfx()).toBe(1.0);
  });

  it('setMaster persists and getMaster reads back', () => {
    audioSettings.setMaster(0.5);
    expect(audioSettings.getMaster()).toBe(0.5);
    expect(localStorage.getItem('ff_next_masterVol')).toBe('0.5');
  });

  it('setMusic and setSfx persist to their respective keys', () => {
    audioSettings.setMusic(0.3);
    audioSettings.setSfx(0.9);
    expect(localStorage.getItem('ff_next_audioVol')).toBe('0.3');
    expect(localStorage.getItem('ff_next_sfxVol')).toBe('0.9');
  });

  it('clamps values to [0, 1]', () => {
    audioSettings.setMaster(-0.5);
    expect(audioSettings.getMaster()).toBe(0);
    audioSettings.setMaster(1.5);
    expect(audioSettings.getMaster()).toBe(1);
  });

  it('subscribers fire on each setter call', () => {
    const fn = vi.fn();
    audioSettings.subscribe(fn);
    audioSettings.setMaster(0.5);
    audioSettings.setMusic(0.5);
    audioSettings.setSfx(0.5);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('unsubscribe stops further notifications', () => {
    const fn = vi.fn();
    const off = audioSettings.subscribe(fn);
    audioSettings.setMaster(0.5);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    audioSettings.setMaster(0.6);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npx vitest run src-next/audio/audioSettings.test.ts
```

Expected: 6/6 pass.

- [ ] **Step 4: Run full suite**

```bash
npm test
```

Expected: 194/194 (was 188 + 6 new).

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src-next/audio/audioSettings.ts src-next/audio/audioSettings.test.ts
git diff --cached --stat
git commit -m "feat(audio): audioSettings singleton + 6 tests"
```

Verify `.claude/settings.local.json` not in staged diff.

---

## Task 2: Wire engines to `audioSettings`

**Files:**
- Modify: `src-next/audio/AudioEngine.ts`
- Modify: `src-next/audio/ScreenMusic.ts`
- Modify: `src-next/audio/sfx/index.ts`

Each engine drops its own localStorage read + setter, subscribes to `audioSettings`, and recomputes its applied gain.

- [ ] **Step 1: Refactor `AudioEngine.ts`**

In `src-next/audio/AudioEngine.ts`:

Replace the imports + `VOLUME_KEY` + `loadVolume()` + the `master = loadVolume()` field + the `setMaster`/`getMaster` methods with audioSettings integration.

Specifically:

(a) At the top, replace:
```ts
const VOLUME_KEY = 'ff_next_audioVol';
```
with:
```ts
import * as audioSettings from './audioSettings';
```

(b) Remove the `loadVolume()` function entirely.

(c) In the class body, replace `private master = loadVolume();` with:
```ts
private audioSettingsUnsub: (() => void) | null = null;
```

(d) Remove `setMaster(v: number): void { ... }` and `getMaster(): number { ... }` methods. Replace any internal use of `this.master` with `audioSettings.getMaster() * audioSettings.getMusic()`.

(e) In the existing `start()` method, AFTER `this.tick()`, subscribe to audioSettings:
```ts
    this.audioSettingsUnsub = audioSettings.subscribe(() => this.applyVolumes());
```

(f) Find the existing `applyVolumes()` method (around line 309) and update the master computation. Find:
```ts
const m = this.master * (this.paused ? 0 : 1);
```
Replace with:
```ts
const m = audioSettings.getMaster() * audioSettings.getMusic() * (this.paused ? 0 : 1);
```

(g) The line `if (audioEngine.getState().master >= 0 && (audioEngine as unknown as { started: boolean }).started) return;` (at the bottom of file in the `ensureAudioAfterGesture` helper) references `getState().master`. Find the `getState()` method and update it to read from audioSettings instead of `this.master`. Replace:
```ts
return { ...this.state, actual: { ...this.actual }, master: this.master };
```
with:
```ts
return { ...this.state, actual: { ...this.actual }, master: audioSettings.getMaster() };
```

- [ ] **Step 2: Refactor `ScreenMusic.ts`**

In `src-next/audio/ScreenMusic.ts`:

(a) At the top, replace:
```ts
const VOLUME_KEY = 'ff_next_audioVol';
```
with:
```ts
import * as audioSettings from './audioSettings';
```

(b) Remove the `loadVolume()` function entirely.

(c) Remove `private master: number = loadVolume();` field.

(d) Remove any line setting `this.master = loadVolume()` in event handlers. Replace usages of `this.master` with `audioSettings.getMaster() * audioSettings.getMusic()`.

(e) In the existing init/start path, subscribe once to audioSettings. Find a stable place in the constructor or start method. Add (where appropriate, e.g. inside an `init()` method or constructor):
```ts
audioSettings.subscribe(() => this.applyVolume());
```

If ScreenMusic doesn't have an `applyVolume()` method, find where it sets the volume on the active Howl track (likely in the fade logic) and create one. Use the existing `target = this.master * (this.paused ? 0 : 1)` pattern.

Read the file first; the structure may differ slightly. If a tighter pattern reveals itself (e.g., recompute on `play()` invocation only), prefer that.

- [ ] **Step 3: Refactor `sfx/index.ts`**

In `src-next/audio/sfx/index.ts`:

(a) Replace:
```ts
const VOLUME_KEY = 'ff_next_sfxVol';
```
with:
```ts
import * as audioSettings from './audioSettings';
```

(b) Remove the `loadVolume()` function entirely.

(c) Update `sfxInit()` — replace `bank.master.gain.value = loadVolume();` with:
```ts
const applyGain = () => {
  if (bank) bank.master.gain.value = audioSettings.getMaster() * audioSettings.getSfx();
};
applyGain();
audioSettings.subscribe(applyGain);
```

Place the apply + subscribe inside the `(async () => { ... })()` block, after `bank = ...;`.

(d) Update `sfxSetMaster(v)` to delegate:
```ts
export function sfxSetMaster(v: number): void {
  audioSettings.setSfx(v);
}
```

(Effective master is now master×sfx; this exported helper preserves the historical API name but writes to the sfx channel — the only thing it actually controlled before.)

(e) Update `sfxGetMaster()`:
```ts
export function sfxGetMaster(): number {
  return audioSettings.getSfx();
}
```

- [ ] **Step 4: Update import path**

`audioSettings.ts` lives at `src-next/audio/audioSettings.ts`. From `src-next/audio/sfx/index.ts`, the relative path is `'../audioSettings'`. Adjust the import line in Step 3(a):
```ts
import * as audioSettings from '../audioSettings';
```

- [ ] **Step 5: Run tests**

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npm test
```

Expected: 194/194 pass. Existing AudioEngine / ScreenMusic / sfx tests should still pass — same effective volume behavior.

- [ ] **Step 6: Build**

```bash
npm run build
```

Expected: green. If errors mention removed `setMaster`/`getMaster` methods on AudioEngine, find callers (likely none outside the file itself + the `getState().master` reference handled in Step 1g) and update them.

- [ ] **Step 7: Commit**

```bash
git add src-next/audio/AudioEngine.ts src-next/audio/ScreenMusic.ts src-next/audio/sfx/index.ts
git diff --cached --stat
git commit -m "refactor(audio): wire AudioEngine/ScreenMusic/sfx to audioSettings"
```

---

## Task 3: PauseMenu + PauseButton components

**Files:**
- Create: `src-next/app/hud/PauseMenu.tsx`
- Create: `src-next/app/hud/PauseButton.tsx`

Two components; pure UI; no state mutations beyond dispatching `TOGGLE_PAUSE` and `SET_SCREEN`.

- [ ] **Step 1: Create `PauseButton.tsx`**

`src-next/app/hud/PauseButton.tsx`:

```tsx
import { dispatch } from '../../actions/dispatch';

export function PauseButton() {
  return (
    <button
      onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
      className="f-mono"
      style={{
        position: 'absolute',
        top: 18,
        right: 110,
        zIndex: 6,
        width: 36,
        height: 36,
        borderRadius: 8,
        background: 'rgba(15,9,37,0.6)',
        border: '1px solid rgba(149,119,255,0.4)',
        color: '#bba8ff',
        fontSize: 16,
        cursor: 'pointer',
        pointerEvents: 'auto',
        display: 'grid',
        placeItems: 'center',
      }}
      title="Pause (Esc)"
      aria-label="Pause"
    >
      ⏸
    </button>
  );
}
```

- [ ] **Step 2: Create `PauseMenu.tsx`**

`src-next/app/hud/PauseMenu.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { PortalGate } from '../portal/PortalGate';
import * as audioSettings from '../../audio/audioSettings';

const selectPaused = (s: GameState) => s.ui.paused;

type Sliders = { master: number; music: number; sfx: number };

function readSliders(): Sliders {
  return {
    master: audioSettings.getMaster(),
    music: audioSettings.getMusic(),
    sfx: audioSettings.getSfx(),
  };
}

export function PauseMenu() {
  const paused = useStore(selectPaused);
  const [sliders, setSliders] = useState<Sliders>(readSliders);

  useEffect(() => {
    if (!paused) return;
    setSliders(readSliders());
    const off = audioSettings.subscribe(() => setSliders(readSliders()));
    return () => off();
  }, [paused]);

  if (!paused) return null;

  const onResume = () => dispatch({ type: 'TOGGLE_PAUSE' });
  const onBackToTitle = () => {
    dispatch({ type: 'TOGGLE_PAUSE' });
    dispatch({ type: 'SET_SCREEN', screen: 'title' });
  };

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: 'rgba(7,5,26,0.75)',
        display: 'grid', placeItems: 'center',
        animation: 'fadein 200ms ease-out',
        pointerEvents: 'auto',
      }}
    >
      <div
        className="panel-strong"
        style={{
          width: 440, padding: 28,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        }}
      >
        <div className="f-display" style={{
          fontSize: 28, color: '#f5c451', letterSpacing: '0.4em',
        }}>
          ◇ PAUSED ◇
        </div>

        <button
          className="btn btn-primary mat-interactive"
          style={{ width: 220 }}
          onClick={onResume}
        >
          Resume
        </button>

        <div style={{ width: '100%', height: 1, background: 'rgba(149,119,255,0.2)', margin: '8px 0' }} />

        <div className="f-mono uc" style={{
          fontSize: 10, letterSpacing: '0.3em', color: '#bba8ff',
        }}>
          ◈ AUDIO MIXER
        </div>

        <SliderRow label="Master" value={sliders.master} onChange={audioSettings.setMaster} />
        <SliderRow label="Music"  value={sliders.music}  onChange={audioSettings.setMusic} />
        <SliderRow label="Sfx"    value={sliders.sfx}    onChange={audioSettings.setSfx} />

        <div style={{ width: '100%', height: 1, background: 'rgba(149,119,255,0.2)', margin: '8px 0' }} />

        <div className="f-mono uc" style={{
          fontSize: 10, letterSpacing: '0.3em', color: '#bba8ff',
        }}>
          ◈ TRAVEL
        </div>

        <PortalGate size={72} label="Travel" />

        <div style={{ width: '100%', height: 1, background: 'rgba(149,119,255,0.2)', margin: '8px 0' }} />

        <button
          className="btn btn-ghost mat-interactive"
          style={{ width: 220 }}
          onClick={onBackToTitle}
        >
          ← Back to Title
        </button>
      </div>
    </div>
  );
}

function SliderRow({ label, value, onChange }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{
      width: '100%', display: 'grid',
      gridTemplateColumns: '60px 1fr 40px',
      alignItems: 'center', gap: 10,
    }}>
      <span className="f-mono uc" style={{
        fontSize: 10, letterSpacing: '0.2em', color: '#bba8ff',
      }}>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#7be3ff' }}
        aria-label={`${label} volume`}
      />
      <span className="f-mono num" style={{
        fontSize: 11, color: '#7be3ff', textAlign: 'right',
      }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npm test
```

Expected: 194/194 (no new tests, two new component files).

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src-next/app/hud/PauseMenu.tsx src-next/app/hud/PauseButton.tsx
git diff --cached --stat
git commit -m "feat(hud): pause menu overlay + corner pause button"
```

---

## Task 4: Wire pause overlay into App + per-screen mounting

**Files:**
- Modify: `src-next/app/App.tsx` — mount `<PauseMenu />` top-level + Esc keydown listener + audio pause coupling subscriber.
- Modify: `src-next/app/screens/Round.tsx` — add `<PauseButton />`.
- Modify: `src-next/app/screens/Hub.tsx` — add `<PauseButton />`.
- Modify: `src-next/app/screens/Forge.tsx` — add `<PauseButton />`.
- Modify: `src-next/app/screens/Shop.tsx` — add `<PauseButton />`.

- [ ] **Step 1: Update `App.tsx`**

In `src-next/app/App.tsx`:

(a) Add imports near other HUD imports:

```tsx
import { PauseMenu } from './hud/PauseMenu';
import { dispatch } from '../actions/dispatch';
import { selectScreen } from '../state/selectors';
import { screenMusic } from '../audio/ScreenMusic';
import { store } from '../state/store';
```

(`selectScreen`, `screenMusic`, `dispatch`, `store` may already be imported — keep imports unique. The vanilla zustand `store` is the one with `.getState()`/`.subscribe()`; the existing `useStore` is a React hook selector and does NOT have those methods.)

(b) Inside the `App` component body, after the existing `useEffect` hooks, add an Esc keydown listener:

```tsx
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const cur = store.getState().ui.screen;
      if (cur === 'round' || cur === 'hub' || cur === 'shop' || cur === 'forge') {
        dispatch({ type: 'TOGGLE_PAUSE' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
```

(c) After the keydown listener, add a `paused` subscriber that pauses/resumes audio engines:

```tsx
  useEffect(() => {
    const unsub = store.subscribe((s) => {
      if (s.ui.paused) {
        audioEngine.pause();
        screenMusic.pause();
      } else {
        audioEngine.resume();
        screenMusic.resume();
      }
    });
    return () => unsub();
  }, []);
```

Note: `store.subscribe(fn)` fires `fn` on every state change; the function reads `s.ui.paused` and calls the appropriate engine method idempotently (engines guard against double-pause/resume internally).

(d) In the JSX, inside the outer `<div>`, add `<PauseMenu />` near the bottom (after `OrientationGate`, before `DevConsole`):

```tsx
      <PauseMenu />
      <OrientationGate />
      {import.meta.env.DEV && <DevConsole />}
```

- [ ] **Step 2: Mount `<PauseButton />` on play screens**

In `src-next/app/screens/Round.tsx`, add the import:

```tsx
import { PauseButton } from '../hud/PauseButton';
```

In the JSX, near the other HUD elements (after `<TopBar />`):

```tsx
<PauseButton />
```

Repeat for `Hub.tsx`, `Forge.tsx`, `Shop.tsx`.

- [ ] **Step 3: Run tests**

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npm test
```

Expected: 194/194 pass.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src-next/app/App.tsx src-next/app/screens/Round.tsx src-next/app/screens/Hub.tsx src-next/app/screens/Forge.tsx src-next/app/screens/Shop.tsx
git diff --cached --stat
git commit -m "feat(app): wire pause overlay — Esc listener + audio pause + per-screen pause button"
```

---

## Task 5: Manual smoke

**Files:** none.

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Smoke checklist**

In the browser:

1. Click "Begin Ascension" on Title → Hub. Verify pause button (`⏸`) appears top-right of HUD.
2. Press Esc → pause overlay appears. Click Resume → overlay closes.
3. Press Esc again → overlay opens. Drag Master slider → audio volume drops/rises in real-time. Repeat for Music and Sfx independently. Verify Sfx slider doesn't affect background music and vice versa.
4. Verify each slider's percentage readout updates as you drag.
5. Click backdrop area outside the modal → should NOT dismiss (intentional).
6. Reload page (`F5`). Press Esc again → sliders should reflect previously-set values from localStorage.
7. With overlay open, click "Travel" Portal Gate → portal flow opens.
8. Close portal flow (escape or Travel doesn't redirect immediately). Click "Back to Title" → overlay closes AND screen transitions to Title.
9. From Title, press Esc → nothing happens (Esc only active on play screens).
10. Start a new run, on Hub, click pause button → overlay opens. Click Back to Title → returns to Title. Click Continue Run → resumes.

If any step fails, document it as a follow-up bug.

- [ ] **Step 3: Optional commit if any inline fixes were needed**

If smoke revealed bugs and you fixed them, stage + commit.

```bash
git add <fixed files>
git diff --cached --stat
git commit -m "fix(pause): <what>"
```

---

## Self-Review

**1. Spec coverage:**

| Spec section | Implemented in |
|---|---|
| audioSettings module + subscription | Task 1 Steps 1-2 |
| 3 sliders Master/Music/Sfx with persistence | Task 1 (module) + Task 3 (PauseMenu UI) |
| AudioEngine integration | Task 2 Step 1 |
| ScreenMusic integration | Task 2 Step 2 |
| sfx integration | Task 2 Step 3 |
| PauseMenu overlay component | Task 3 Step 2 |
| PauseButton corner icon | Task 3 Step 1 |
| Esc keydown listener | Task 4 Step 1(b) |
| Audio pause coupling on `s.ui.paused` flip | Task 4 Step 1(c) |
| Mount overlay top-level in App | Task 4 Step 1(d) |
| Per-screen PauseButton mounting | Task 4 Step 2 |
| Back-to-Title sequence (TOGGLE_PAUSE then SET_SCREEN) | Task 3 Step 2 (`onBackToTitle` handler) |
| Inline PortalGate for Travel | Task 3 Step 2 (PortalGate inline in PauseMenu) |
| 6 audioSettings tests | Task 1 Step 2 |
| Smoke checklist | Task 5 |

All spec requirements covered.

**2. Placeholder scan:** No "TBD"/"TODO"/"implement later"/"fill in details". Each step has full code or commands. Task 5 (smoke) explicitly allows deferring inline fixes — that's documented option, not a placeholder.

**3. Type consistency:**
- `audioSettings.getMaster/setMaster` etc. — defined in Task 1, consumed in Tasks 2 (engines) and 3 (PauseMenu).
- `audioSettings.subscribe` — defined Task 1, consumed Tasks 2 + 3.
- `selectPaused` — defined inline in PauseMenu (Task 3); consistent with other inline-selector patterns in the codebase (e.g. CatalystStrip).
- Existing `TOGGLE_PAUSE` action consumed in PauseMenu, PauseButton, App keydown.
- `dispatch({ type: 'SET_SCREEN', screen: 'title' })` — matches existing Action union shape.

No drift.

---

## Execution Handoff

After saving the plan, offer execution choice.
