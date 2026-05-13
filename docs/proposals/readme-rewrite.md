# Proposal: rewrite README.md for human readers

**Status:** stubbed — skipped from the studio-review quick-wins batch by
direction (the README is the studio's voice; rewriting it deserves a
dedicated, human-authored pass rather than a templated edit).

**Owner:** project lead.
**Effort:** ~30 minutes once you sit down with it.
**Why this matters:** today `README.md:1` says
*"Ordinary Game Jam #1 — Starter Template"* — the GitHub front door for the
project still reads as the unmodified jam template. Anyone landing on the
repo (jam judges, future collaborators, curious players, press) sees the
template's onboarding flow before they see FortuneFallacy. This is the
single highest-leverage perception fix on the entire project.

## What to keep

The current README contains useful jam-template instructions (portal
protocol, how to run locally, GH Pages deploy notes). Those are *true*,
just not *yours*. Move them to `docs/PORTAL.md` — preserves the content
for the jam ecosystem while reclaiming the front door for your game.

## Suggested structure

```markdown
# FortuneFallacy

A Balatro-style dice roguelike. Roll, lock, score; build a deck of
catalysts and mods that change how the dice answer to you.

[ Play in your browser → https://strokacola.github.io/FortuneFallacy/ ]

![FortuneFallacy screenshot](docs/brand/hero.png)

## What this is
- 8 constellations (run-styles) × 6 stakes (difficulty tiers) × 5 challenges
- 60+ catalysts, 57 mods, 8 boss debuffs, 18 voidstorms, deterministic dice
- Daily challenge with a global leaderboard
- Built for browser (jam release); Steam / Godot port planned

## Controls
- Mobile: tap to roll, tap a die to lock, tap Score
- Desktop: TODO once keyboard shortcuts ship (UX dept rec)

## Status
Pre-alpha. See [`ROADMAP.md`](ROADMAP.md) for what's coming.

## Run locally
```bash
npm install
npm run dev   # localhost:5173/FortuneFallacy
npm test      # 1344+ tests
npm run build # production bundle to dist/
```

## License
MIT — see [`LICENSE`](LICENSE).

## Game-jam context
Built for [Ordinary Game Jam #1](https://github.com/CallumHYoung/gamejam).
Portal-protocol details: [`docs/PORTAL.md`](docs/PORTAL.md).
```

## Checklist before merging the rewrite

- [ ] Title + 1-line pitch up top.
- [ ] Live link to the GH Pages build.
- [ ] At least one screenshot (procedural; the brand kit proposal in Art
      Direction's recs covers asset generation).
- [ ] Status / version line.
- [ ] Run-locally section with the actual scripts in `package.json`.
- [ ] License reference.
- [ ] Roadmap link.
- [ ] Move the jam-template content into `docs/PORTAL.md`.

## Who reads this

1. **Jam judges** — first impression in 10 seconds.
2. **Anyone the studio shares a link with** — friends, beta testers, press.
3. **Future-you in 6 months** — "what was the live URL again?"
4. **Future contributors** — "how do I run this?"
