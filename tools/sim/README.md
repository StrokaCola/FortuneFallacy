# tools/sim

Headless simulation harness for FortuneFallacy. Used to gather balance/pacing
data for `docs/analysis.md`.

The harness boots the Zustand store directly, intercepts the seeded
`onSimulationStart` bus event with a synchronous bridge (no React, no Three.js,
no Rapier WASM, no audio), and dispatches actions through `actions/dispatch.ts`
to play full runs. No source files in `src-next/` are modified.

## Files

- `bootstrap.ts` — RNG override + sim bridge install + store reset
- `driver.ts` — runs one game from NEW_RUN to terminal
- `strategies.ts` — Random, Greedy, EVKeep, HeuristicShop
- `telemetry.ts` — bus subscriber that fills per-blind records
- `runMany.ts` — batch runner for one (constellation, stake, strategy) cell
- `sweep.ts` — full 8 × 6 sweep
- `stackedDeck.ts` — grants curated catalyst loadouts up front
- `catalystImpact.ts` — matched-pair Δ-score per catalyst
- `screenshots.ts` — Playwright walk across 8 viewports
- `htmlReport.ts` — single-file inline-SVG dashboard
- `csv.ts` / `args.ts` — small helpers
- `smoke.ts` — quick sanity check (5 seeds × 4 strategies)

## Quickstart

```bash
# Smoke test
npx tsx tools/sim/smoke.ts

# Full sweep (8 constellations × 6 stakes × 300 runs)
SIM_RUNS_PER_CELL=300 npx tsx tools/sim/sweep.ts

# Catalyst impact (44 catalysts × N pairs on Lyra/Spark)
npx tsx tools/sim/catalystImpact.ts --runs 200 --constellation lyra --stake spark

# Stacked deck balance probe
SIM_RUNS_PER_CELL=100 npx tsx tools/sim/stackedDeck.ts

# Build dashboard
npx tsx tools/sim/htmlReport.ts

# Capture UI screenshots (requires `npm run dev` running)
npx tsx tools/sim/screenshots.ts
```

## Deterministic replay

Every run is seeded by a single `number` (mulberry32). `bootstrapHeadless(seed)`
overrides `Math.random` globally with that seed. Same seed + same constellation +
same stake + same strategy = identical action log.

## Adding a strategy

Implement the `Strategy` interface in `strategies.ts`. Then register a factory
in `runMany.ts:buildStrategy`.

## Outputs

- CSVs: `docs/sim-data/*.csv`
- Dashboard: `docs/sim-data/dashboard.html`
- Screenshots: `docs/audit-screenshots/*.png`
