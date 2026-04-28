# Pause Screen — Design

**Status**: Approved (design phase)
**Date**: 2026-04-28
**Sub-project**: C (of 4 — see decomposition)

## Goal

Add a pause overlay accessible from any active gameplay screen (Round / Hub / Forge / Shop) with: a Resume button, a 3-channel audio mixer (Master / Music / Sfx), inline Portal access, and a Back-to-Title button. Triggered by Esc key or a corner pause button.

## Sibling sub-projects

C is sub-project 3 of 4. Siblings:
- B — re-theme (shipped to main).
- A — scoring buildup escalation (shipped, pushed).
- D-1 — catalyst vertical slice (PR open: feat/catalyst-vertical-slice-d1).
- D-2 — content breadth (queued).
- D-3 — additional juice (queued).

## Locked design decisions

- **Audio mixer scope** (Q1 b): 3 channels — Master / Music / Sfx.
- **Back-to-Title behavior** (Q2 a): plain navigate; run state preserved via existing localStorage persistence; Title's "Continue Run" picks up.
- **Trigger + render** (Q3 b): Esc key + corner pause button + modal overlay.
- **Architecture** (Approach A): minimal — central `audioSettings` singleton with subscribers; mixer state stays out of Zustand; pause state stays as `s.ui.paused` boolean.

## Architecture

### `src-next/audio/audioSettings.ts` (NEW)

Central singleton owning 3 persisted volume values + subscription mechanism.

```ts
const MASTER_KEY = 'ff_next_masterVol';
const MUSIC_KEY  = 'ff_next_audioVol';   // existing key, repurposed as music-only
const SFX_KEY    = 'ff_next_sfxVol';     // existing key, kept

const DEFAULT_MASTER = 0.7;
const DEFAULT_MUSIC  = 1.0;
const DEFAULT_SFX    = 1.0;

let listeners = new Set<() => void>();

export function getMaster(): number { ... }     // reads localStorage, falls back to 0.7
export function setMaster(v: number): void { ... }   // clamps [0,1], persists, notifies
export function getMusic(): number { ... }
export function setMusic(v: number): void { ... }
export function getSfx(): number { ... }
export function setSfx(v: number): void { ... }
export function subscribe(fn: () => void): () => void { ... }
```

### Engine integration

| Engine | Existing key | Subscribed to | Applied volume |
|--------|--------------|---------------|----------------|
| `AudioEngine` (background layers) | reads `ff_next_audioVol` | master + music | `layerVol × music × master` |
| `ScreenMusic` (screen tracks) | reads `ff_next_audioVol` | master + music | `trackVol × music × master` |
| `sfx/index.ts` (Tone.js bank) | reads `ff_next_sfxVol` | master + sfx | `bankGain × sfx × master` |

Each engine subscribes via `audioSettings.subscribe(() => recomputeVolumes())` once during init. Inside `recomputeVolumes()`, the engine reads current master + (music | sfx) and reapplies its scaling.

The existing engines' direct `localStorage.getItem(VOLUME_KEY)` reads + their `setMaster(v)` setters get retired in favor of pulling from `audioSettings` instead. Net effect: still backed by localStorage (via audioSettings), still equivalent volume on first install, but now respects a separate master.

### Pause state

Stays as `s.ui.paused` boolean (existing). `TOGGLE_PAUSE` action exists. No new state shape.

### Pause overlay component (`src-next/app/hud/PauseMenu.tsx`)

Renders centered modal over dimmed full-screen backdrop when `s.ui.paused === true`. Subscribes to `audioSettings` for live slider readouts. Cleans up subscription on unmount.

```
┌─────────────────────────────┐
│         ◇ PAUSED ◇          │
│                              │
│       [ Resume ]             │
│                              │
│   ── Audio Mixer ──          │
│   Master ▓▓▓▓▓░░░  70%       │
│   Music  ▓▓▓▓▓▓▓░  85%       │
│   Sfx    ▓▓▓▓▓▓▓▓ 100%       │
│                              │
│   ── Travel ──               │
│   [ Portal Gate ]            │
│                              │
│       [ Back to Title ]      │
└─────────────────────────────┘
```

- Modal: ~440×600px, `panel-strong` style, fadein 200ms.
- Backdrop: full-screen `rgba(7,5,26,0.75)`. Click on backdrop = no dismiss (avoid accidental).
- Sliders: `<input type="range" min="0" max="1" step="0.01">`. `onChange` → `audioSettings.set*(v)`.
- Travel: renders `<PortalGate size={72} label="Travel" />`. PortalGate handles its own click flow.
- Back to Title: dispatches `TOGGLE_PAUSE` then `SET_SCREEN: 'title'` (in that order — overlay unmounts before screen changes).

### Pause button component (`src-next/app/hud/PauseButton.tsx`)

Small icon button (top-right of HUD), visible on play screens (Round/Hub/Forge/Shop). Hidden on Title/Win/Scores. `onClick` → `dispatch({ type: 'TOGGLE_PAUSE' })`.

### Esc key wiring

Single global listener in `src-next/app/App.tsx` `useEffect`. On `keydown`, if `key === 'Escape'` AND current `s.ui.screen` is one of `'round' | 'hub' | 'shop' | 'forge'`, dispatch `TOGGLE_PAUSE`. Cleanup on unmount.

### Audio engine pause coupling

`s.ui.paused` is the source of truth. A subscriber (likely added in `App.tsx` or `audio/audioBridge.ts`) listens to store changes; when `paused` flips, calls `audioEngine.pause()/resume()` and `screenMusic.pause()/resume()`. The pause/resume methods exist on both engines already.

### Files touched

| Path | Change |
|------|--------|
| `src-next/audio/audioSettings.ts` | NEW — central singleton |
| `src-next/audio/audioSettings.test.ts` | NEW — 6 tests |
| `src-next/audio/AudioEngine.ts` | retire own `master` field; subscribe to audioSettings; recompute applied gain |
| `src-next/audio/ScreenMusic.ts` | same |
| `src-next/audio/sfx/index.ts` | replace direct `loadVolume()/setVolume()` with audioSettings; subscribe |
| `src-next/app/hud/PauseMenu.tsx` | NEW — overlay component |
| `src-next/app/hud/PauseButton.tsx` | NEW — corner pause icon |
| `src-next/app/App.tsx` | mount `<PauseMenu />` top-level + Esc keydown listener + audio-pause subscriber |
| `src-next/app/screens/Round.tsx` | mount `<PauseButton />` |
| `src-next/app/screens/Hub.tsx` | mount `<PauseButton />` |
| `src-next/app/screens/Forge.tsx` | mount `<PauseButton />` |
| `src-next/app/screens/Shop.tsx` | mount `<PauseButton />` |

## Tests

### `src-next/audio/audioSettings.test.ts` (~6 tests)

- `getMaster()` returns 0.7 default when localStorage empty.
- `getMusic()` / `getSfx()` return 1.0 default similarly.
- `setMaster(0.5)` persists to localStorage AND `getMaster()` returns 0.5 immediately.
- `setMaster()` clamps `[0, 1]` (e.g. -0.5 → 0; 1.5 → 1).
- `subscribe(fn)` fires `fn` on each setter call.
- `subscribe()` returns an unsubscribe function that stops further calls.

### Pause integration test (optional — deferred)

Simulating Esc keydown on `App` would require jsdom + `@testing-library/dom` setup. Existing test suite uses vitest. Add only if straightforward; otherwise rely on smoke test.

### No new tests for AudioEngine / ScreenMusic refactor

The change is structural (data source swap from local field → audioSettings). Existing tests verify no regression in pause/resume behavior and gain scaling.

## Non-goals

- Per-track muting / individual SFX category sliders (only Master/Music/Sfx groups).
- Settings panel from Title screen (mixer only via pause).
- Keyboard shortcuts beyond Esc.
- Custom slider thumb styling beyond basic theme tokens.
- Per-channel EQ / reverb / compressor controls.
- Migrating mixer state into Zustand.
- Touch gestures for pause (long-press, swipe).
- Pause-during-scoring-sequence visual freeze (sequence audio pauses via engine; visuals continue per existing timers).
- Pause from Title / Win / Scores screens.

## Risks

| Risk | Mitigation |
|------|-----------|
| Esc collides with browser default (fullscreen exit) | Standard UX; user has corner button as alternative |
| Audio engine subscription leak on hot-reload | Engines store unsubscribe ref; clean on teardown; minor dev-only concern |
| Slider drag during rapid-fire scoring beats glitches audio | applyVolumes is just gain math, cheap; no ramp or scheduling |
| `audioSettings` singleton + SSR concerns | Browser-only bundle; existing pattern wraps localStorage in try/catch |
| Back-to-Title order (dispatch toggle then screen) | Documented; tested |
| Initial `audioSettings.getMaster()` before localStorage hydrates | Sync default returned (0.7); no race |
| Existing `ff_next_audioVol` semantics shift from "effective master" to "music only" | Pre-v0.x users: their saved value carries to music; master defaults to 0.7 fresh. Net effective volume may change for them. Documented; acceptable for early-access |
| Multiple subscribers wired across 3 engines + UI — order of `recomputeVolumes` calls | Setter notifies in registration order; no ordering dependency between engines (each owns its own state) |
| PortalGate rendered inline in pause overlay vs full-screen | Existing `<PortalGate size={72} label="Travel" />` works in any container; verified by Title screen mount |

## Acceptance

- `audioSettings` tests pass (~6 new, total 188+6=194).
- Build green.
- Manual smoke: Esc opens overlay; sliders move audio in real-time; persistence holds across reload; Travel button opens portal flow; Back to Title navigates + clears pause.
- No regression in existing 188 tests.
