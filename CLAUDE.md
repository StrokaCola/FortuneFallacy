# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FortuneFallacy is a Balatro-style dice roguelike built for Ordinary Game Jam #1. The core loop: roll 5 dice → lock/reroll → play a hand → score combos → earn shards → upgrade dice/buy oracles → repeat across 8 escalating goals.

**Stack**: Vanilla JS, no build step, no bundler, no framework. Canvas 2D rendering at 960×540. Optional Rapier WASM physics (bundled in `rapier/`). Everything lives in `game.js` (~6500 lines).

## Running Locally

```bash
python -m http.server 8000
# then open http://localhost:8000
```

Any static file server works. There is no build, no install, no transpile step.

## Deploying

Push to `main` — GitHub Actions (`.github/workflows/pages.yml`) deploys to GitHub Pages automatically.

## Architecture

### File Layout

- `game.js` — entire game: state, physics, rendering, UI, scoring, audio
- `portal.js` — jam-required Portal Protocol (read URL params on load, redirect out on exit)
- `index.html` — single canvas `#game` (960×540), loads portal.js then game.js as a module
- `style.css` — dark cosmic theme, canvas centered with glow border
- `rapier/` — bundled Rapier3D WASM for physics (imported dynamically)
- `physics-editor.html` — browser tool for tuning `PHYSICS` constants (saves to localStorage)
- `editor.html`, `rune-editor.html`, `anomaly-editor.html`, `dice-model-editor.html` — other browser-based dev tools

### Game Screens (state machine)

`screen` variable drives everything: `'title'` → `'nameentry'` → `'hub'` → `'round'` → `'shop'` | `'forge'` | `'runes'` | `'scores'`

The main `draw(dt)` / `tick(dt)` loop dispatches on `screen`. Mouse clicks are handled in one large `canvas.addEventListener('click', ...)` block that also dispatches on screen.

### Scoring Formula

```
handScore = chips × mult
```

- **chips** = combo base chips + die face values + oracle/rune additive bonuses
- **mult** = combo base mult × oracle multiplicative bonuses

`detectCombo(faces)` walks the `COMBOS` array (highest tier first) and returns the first matching combo. Scoring is animated with `animateTicker()`.

### Oracle / Rune / Upgrade System

Every oracle has `apply(combo, dice, chips, mult, meta) → [newChips, newMult]`. The pipeline chains all held oracles in order — **always return a new `[chips, mult]` pair, never mutate in place**.

`meta` passed to `apply()`:
- `meta.lockedHeld` — number of locked dice included in the hand
- `meta.lastReroll` — whether a reroll was used before this hand
- `meta.streakCount` — consecutive same-combo streak count
- `meta.goalIdx` — current goal index (0-based)
- `meta.handsLeft` — hands remaining this round

Runes are per-die (up to `MAX_RUNE_SLOTS = 2`). Dice upgrades (`diceUpgrades[]`) run parallel to `dice[]` — same index. Rune state lives in `diceRunes[][]`.

### Physics

Two paths, selected at runtime:

1. **Rapier3D** (preferred): `initRapier()` loads the WASM module. Dice get rigid bodies; `settleDie()` reads the final translation/rotation from Rapier and removes the body.
2. **Legacy 2D fallback**: pure JS Euler integration with wall/floor bounce, stagger, and spin coupling — runs when Rapier fails to load.

Physics constants live in the `PHYSICS` object (loaded from `localStorage` key `ff_physics`). Tune them with `physics-editor.html`. To reset to defaults: `localStorage.removeItem('ff_physics')`.

`PHYS_SCALE = 55` converts between physics units and canvas pixels. `PHYS_CX` / `PHYS_CZ` are the physics-space origin (center of the board).

Face detection uses `eulerToFace(rx, ry, rz)` which compares accumulated Euler angles against `FACE_ROT` canonical rotations.

### Key Constants

```js
GOAL_TARGETS    = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000]
HANDS_PER_ROUND = 3
REROLLS_PER_HAND = 2
DICE_COUNT      = 5   // starting pool
MAX_DICE        = 10  // pool cap
MAX_ORACLES     = 6
MAX_RUNE_SLOTS  = 2
```

Canvas: `W = 960`, `H = 540` (hardcoded, not responsive).

### Particle / FX System

All feedback is Canvas 2D:
- `burst(x, y, color, n, speed)` — radial particle cloud
- `spark(x, y, color, n, speed)` — directional streaks with gravity
- `ring(x, y, color, maxR, duration)` — expanding hollow circle
- `shockwave(x, y, color, count, ...)` — rapid ring succession
- `floatText(x, y, text, color, size, opts)` — floating score pop
- `screenShake(amp)` / `screenFlash(alpha)` — global screen effects

Scale feedback intensity with `scoreIntensity(val)` (log10 scale, 0–1 up to ~50k).

### Audio

Web Audio API only — no library. `getMaster()` builds a compressor → gain → sfx-gain → destination chain once. `SFX` object contains named sound functions (`SFX.roll()`, `SFX.lock()`, `SFX.combo(tier)`, etc.). All audio is lazy-initialised on first user interaction.

### Persistence

All state is in `localStorage`:
- `ff_physics` — physics tuning values
- `fortunefallacy_scores` — local high scores (top 10)
- `fortunefallacy_unlocks` — set of unlocked item IDs
- `fortunefallacy_player` — player name
- `ff_musicVol` / `ff_sfxVol` — volume settings

Online leaderboard uses Firebase Realtime Database (`FIREBASE_URL` constant at top of `game.js`).

### Portal Protocol (jam requirement)

`portal.js` is a hard dependency. On load, `Portal.readPortalParams()` reads URL params — if `fromPortal` is true, skip the menu. On exit, `Portal.sendPlayerThroughPortal(target.url, state)` redirects the player. Keep these calls intact.

## Common Pitfalls

- **Don't make scoring additive-only** — the `chips × mult` formula is what creates exponential scaling. Oracle effects that add to `mult` rather than multiply it kill late-game excitement. Prefer `m * factor` over `m + flat`.
- **Don't slow down physics** — dice should feel snappy. `rollDurBase` is 0.65s; keep settle time short.
- **Oracle `apply()` must return `[chips, mult]`** — missing a return or returning `undefined` silently breaks the scoring chain.
- **Rapier is optional** — code paths that touch `rapierWorld` must guard with `if (rapierWorld && RAPIER_LIB)`. The legacy physics must always work.
- **Canvas is 960×540** — all layout math assumes these dimensions. Don't use `canvas.width`/`canvas.height` dynamically; use the `W`/`H` constants.
- **`diceUpgrades[i]` can be `null`** — always null-check before accessing upgrade properties.
- **`screen` is the sole routing mechanism** — changing `screen` immediately switches what `draw()` and the click handler render/respond to. No transition buffer exists.
- **`handInProgress` gate** — check this before triggering any roll or score action; it prevents double-fires during the animated scoring sequence.
