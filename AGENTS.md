# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

FortuneFallacy is a Balatro-style dice roguelike. Core loop: roll 5 dice → lock/reroll → play a hand → score combos → earn shards → upgrade dice / buy oracles / spend on consumables & vouchers → advance through 4 antes × 3 blinds (12 rounds), beating a Boss Blind every third round.

**Stack**: Vite build system. Vanilla JS game logic (no React). Canvas 2D UI + Three.js 3D dice + WebGL nebula background, all layered at 960×540. Tone.js SFX, Howler.js music, Zustand-vanilla store for new-feature state, Rapier3D WASM physics (optional fallback: pure-JS Euler integration). ~6,500 lines in `src/main.js` plus ~12 focused modules under `src/`.

## Running Locally

```bash
npm install       # first time only
npm run dev       # Vite dev server at http://localhost:5173
npm run build     # production bundle into dist/
npm run preview   # serve the built dist/
```

Use `python -m http.server` directly on `dist/` to smoke-test a production build without Node.

## Deploying

Push to `main` — GitHub Actions (`.github/workflows/pages.yml`) runs `npm ci && npm run build` and publishes `dist/` to GitHub Pages.

## Architecture

### File Layout

- `src/main.js` — bulk of the game (state, physics, rendering, UI, scoring). Still the longest file; focused modules below pull out data and new-feature systems.
- `src/state/store.js` — Zustand vanilla store. Owns blind/consumable/voucher/transition state; legacy globals in main.js coexist during migration.
- `src/data/` — pure data tables:
    - `constants.js`   — W, H, layout rects, dice pool caps, tier/combo colours.
    - `blinds.js`      — BLIND_DEFS, ANTE_BASE_TARGETS, BOSS_BLINDS, targetForBlind, shuffleBossBlindPool, skip tags.
    - `consumables.js` — 7 Tarot + 4 Spectral cards with abstract apply(ctx, targets) API.
    - `vouchers.js`    — 8 permanent run upgrades.
- `src/systems/` — behaviour modules that bridge data to main.js state:
    - `blinds.js`      — anteFromGoal, onRoundStart/onRoundCleared, hasBlindDebuff + named helpers.
    - `consumables.js` — wireConsumableBridge, useConsumable, grantRandomConsumable.
    - `vouchers.js`    — getVoucherEffect(key, default), grantRandomVoucher.
    - `audio.js`       — Tone.js SFX (sfxBossReveal, sfxConsumeCard, sfxVoucherBuy, sfxSkipBlind) + Howler.js music helpers.
- `src/rendering/dice3d.js` — Three.js dice renderer (BoxGeometry, PBR materials, PCFSoft shadows, OrthographicCamera). Reads pose from Rapier/legacy physics; falls back silently to Canvas-2D dice on WebGL failure.
- `src/bg-shader.js` — WebGL nebula background. `tickBg(t, screen, intensity)` blends mode→crimson as roundScore approaches target.
- `public/portal.js` — jam Portal Protocol (classic script, not bundled; `window.Portal` is expected).
- `public/rapier/`  — bundled Rapier3D WASM for physics (dynamic import).
- `public/bg-music.mp3`, `public/thumbnail.png`, `public/.nojekyll` — static assets served from site root.
- `index.html` — three-canvas stack: `#bg` (WebGL nebula), `#three` (Three.js dice), `#game` (Canvas 2D UI).
- `style.css` — dark cosmic theme, canvas stack absolutely positioned.
- `physics-editor.html`, `editor.html`, `rune-editor.html`, `anomaly-editor.html`, `dice-model-editor.html` — standalone dev tools (unchanged by the overhaul).

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
// 12 goals: 4 antes × (Small, Big, Boss) — computed from ANTE_BASE_TARGETS
GOAL_TARGETS    = BLIND_GOAL_TARGETS  // alias; see src/systems/blinds.js
HANDS_PER_ROUND = 3
REROLLS_PER_HAND = 2
DICE_COUNT      = 5   // starting pool (Voucher Die Caster raises to 6)
MAX_DICE        = 10  // pool cap
MAX_ORACLES     = 6   // Voucher Astral Plane adds 1
MAX_RUNE_SLOTS  = 2   // Voucher Forged Links raises to 3
```

Canvas: `W = 960`, `H = 540` (hardcoded, not responsive).

### Blind / Ante / Consumable / Voucher Systems

- **Blind** — every 3rd `runGoal` is a Boss. `startRound()` calls
  `blindsOnRoundStart(runGoal)` which sets `activeBlind` in the store.
  `hasBlindDebuff(id)` checks the active blind's debuff flags: `no_rerolls`
  (The Tower), `disable_oracles` (The High Priestess), `auto_unlock_after_roll`
  (The Devil), `hand_size_cap_4` (The Fool), `no_rune_transforms_on_ones`
  (The Serpent). Debuffs are read at their respective call sites in main.js
  (reroll click, oracle-apply loop, post-roll, lock-click, rune-transforms).
- **Consumable** — held in a 4-slot hand (store: `consumables`). Each
  definition has `apply(ctx, targets)`; main.js exposes `ctx` via
  `wireConsumableBridge({ setDieFace, addShards, duplicateOracle, ... })`.
  Targeting cards set `consumableTargeting` in the store; the next matching
  click resolves or Esc cancels.
- **Voucher** — permanent per-run upgrades. Call `getVoucherEffect(key, default)`
  anywhere you need a voucher-modified value (oracle cap, shop price, shards
  per hand). Granted after Boss Blind clears from Ante 2 onwards.

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

Two paths coexist:
- **Legacy `SFX.*`** (main.js) — raw Web Audio API for the core
  roll/lock/combo/tick/bigScore family. Still the primary SFX surface.
- **`src/systems/audio.js`** — Tone.js helpers for richer one-shots
  (sfxBossReveal, sfxConsumeCard, sfxVoucherBuy, sfxSkipBlind) and
  Howler.js music helpers ready to replace the `new Audio()` loop.
  `ensureToneStarted()` is called lazily on first invocation. Each
  one-shot Tone instrument is disposed ~1.5s after trigger.

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
