# FortuneFallacy roadmap

The active roadmap lives under [`docs/superpowers/`](docs/superpowers/) — one
Markdown file per planned milestone, dated and committed alongside the work
itself:

- [`docs/superpowers/plans/`](docs/superpowers/plans/) — milestone briefs
  (the *what* and *why*).
- [`docs/superpowers/specs/`](docs/superpowers/specs/) — implementation
  designs (the *how*).

Both folders are sorted chronologically by filename
(`YYYY-MM-DD-<slug>.md`). Browse newest-first to see what's actively
shipping; browse oldest-first to see how the project's scope has evolved.

## Recent direction

| Date       | Plan                                                                                                   |
|------------|--------------------------------------------------------------------------------------------------------|
| 2026-05-13 | Studio review (this document family) — see `docs/company-review-2026-05-13.md`                         |
| 2026-05-12 | QA pass + dead-pick audit — see `docs/QA/2026-05-12.md`, `docs/QA/2026-05-13-dead-pick-audit.md`        |
| 2026-05-07 | Performance & balance audit — see `docs/superpowers/specs/2026-05-07-perf-balance-audit.md`             |
| 2026-04-30 | Star Forge phase 3 (mod stacking)                                                                      |
| 2026-04-29 | Star Forge foundation phase                                                                            |
| 2026-04-28 | Catalyst vertical slice + content breadth pass + grounded constellation retheme + scoring escalation    |
| 2026-04-27 | Music phase 2 + satisfying dice scoring                                                                |
| 2026-04-26 | Foundations + Round HUD + score moment + risk telegraphy + dice physics + PBR pass + SFX upgrade        |

## Status

- **Current milestone:** browser game-jam ship (Ordinary Game Jam #1).
- **Next milestone:** Steam release via a Godot port (target window
  intentionally undated; the browser jam ships first).

## How to add a new plan

1. Pick today's date and a short slug.
2. Create `docs/superpowers/plans/<YYYY-MM-DD>-<slug>.md` describing what
   you're going to do and why.
3. (Optional) For larger work, mirror with a
   `docs/superpowers/specs/<YYYY-MM-DD>-<slug>-design.md` describing how.
4. Commit the plan **before** the work, push, and reference the plan in
   commit messages and the PR.
