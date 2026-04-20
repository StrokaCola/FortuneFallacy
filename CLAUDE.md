# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FortuneFallacy is a browser-based dice roguelike game (Balatro-style) built for the Ordinary Game Jam #1. Players roll dice, score poker-hand combos, collect oracle upgrades, and progress through 8 difficulty goals. No build tools or npm — pure vanilla JavaScript deployed via GitHub Pages.

## Development

**Run locally:**
```bash
python -m http.server 8002
# Open http://localhost:8002
```

No build step, no compilation. Edit files directly and refresh the browser.

**Deploy:** Push to `main` — GitHub Actions (`.github/workflows/pages.yml`) auto-deploys to GitHub Pages.

## Architecture

### Single-file game engine (`game.js`, ~4300 lines)

The entire game lives in `game.js`, organized with ASCII section markers (`// ─── Section Name`). Navigation depends on these markers. Major sections in order:

1. **Physics Constants** — die throw parameters stored/loaded from `localStorage` under key `ff_physics`
2. **Portal Setup** — reads URL params for game-jam player handoff; `portal.js` handles the protocol
3. **Audio Engine** — Web Audio API synthesis + `<audio>` element for background music; separate gain nodes for SFX vs music
4. **Rapier Init** — async WASM load; sets up physics world (floor + 4 walls); falls back gracefully if unavailable
5. **Combo Detection** — poker-hand pattern matching (`detectCombo(dice)`) returning `{ name, tier, chips, mult }`
6. **Oracle Definitions** — array of 20+ passive ability objects `{ id, name, tier, desc, fn }` applied per hand
7. **Dice Upgrades** — 8 die types with cost/stat overrides (score min, mult bonus, roll range, etc.)
8. **Rune Definitions** — 12 per-die enchantments; max 2 per die
9. **Game State** — single `state` object holds everything: player name, deck, held dice, shards, goals, hands/rerolls remaining, current screen
10. **Run Management** — goal targets `[300, 800, 2000, 5000, 11000, 20000, 35000, 50000]`; 3 hands and 2 rerolls per round
11. **Natural Settle** — Rapier3D physics step loop; resolves die orientation from quaternion after throw
12. **Hand Playing** — core scoring: apply oracle `fn` callbacks, accumulate chips × mult
13. **Screens** — 10+ screens (Title, HowTo, NameEntry, Game, Shop, Hub, Forge, RuneTable, Win, Scores, Pause); each has a dedicated `draw*()` and input handler
14. **Main Loop** — `requestAnimationFrame` at 60 FPS; routes input and draw to the active screen

### Rendering

Canvas 2D only (960×540). 3D dice are drawn with isometric projection computed from Rapier quaternion → Euler angles → rotation matrix. Pip placement is hard-coded per face.

### Persistence

All persistence is `localStorage` — no server-side user state. Keys: `ff_physics`, `fortunefallacy_scores`, volume settings, unlock flags.

### Online Leaderboard

Firebase Realtime Database at `fortunefallacy-9908c-default-rtdb.firebaseio.com/scores`. Scores are written on run completion and read on the Scores screen.

### Portal Protocol (`portal.js`)

Implements the game-jam inter-game player handoff. Reads/writes player state (`username`, `color`, `speed`) via URL query params. Fetches live game registry from an external URL to pick a random next game.

### In-Browser Editors

`editor.html`, `physics-editor.html`, `anomaly-editor.html`, `dice-model-editor.html`, `rune-editor.html` — standalone tools that write to `localStorage`. To update game data from an editor session, export the JSON and paste it into the relevant definition array in `game.js`.

## Key Conventions

- **Section markers are navigation** — always add new code inside the appropriate `// ─── Section` block, or create a clearly named new section.
- **All game state flows through `state`** — avoid module-level mutable variables outside of `state`; keep the single-object pattern.
- **Oracle/rune/dice data is declarative** — define new items as plain objects in their respective arrays; the engine iterates them generically. The `fn` field on oracles is called with `(state, comboResult)` and mutates score in place.
- **No bundler** — ES6 `import` is used only for Rapier (`rapier/rapier.mjs`). Everything else is global within `game.js` loaded as `type="module"`.
- **Physics is async** — Rapier initialization is `async`; code that depends on the physics world must await `rapierReady` or check the `rapier` global.
- **Cache-busting** — `index.html` loads `game.js?v=N`; increment `N` when deploying breaking changes that need hard-refresh.
