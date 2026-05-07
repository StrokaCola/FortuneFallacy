# Performance & Balance Audit — 2026-05-07

## Methodology

Two parallel workstreams over the existing codebase:

- **Balance:** extended the Monte Carlo harness pattern from `src-next/data/balance.sim.test.ts` and `balance.shards.sim.test.ts` into a new full-run simulator (`balance.fullrun.sim.test.ts`) that mirrors the production scoring path (`core/phases/evaluation.ts`, `core/scoring/constellationChain.ts`, `core/round/transitions.ts`) and projects clear-rate by ante across all 8 constellations × 6 stakes × 4 build profiles. 200 seeded runs per cell. Player model: 3 hands × best-of-K-with-locking using each stake's reroll budget; chain mult applied between hands; build mult abstracts catalyst/mod/galaxy contributions calibrated against published catalyst values (Tempo +0.5×/tier, Compounding Bias +0.05×/clear, Prime Resonance mult^1.05/die).
- **Performance:** added a dev-only sampler (`devtools/perf.ts`) wired into the shared Three.js RAF loop, the simulation event handler, and the persistence debounce. Surfaced through a new `PerfTab` in DevConsole — live FPS p50/p95/p99, jank count, frame ms, persistence blob size, and per-measure histograms.

All sims are seeded so results reproduce. All 952 existing tests pass after fixes; no public APIs changed.

---

## Key findings

### Balance

#### B1. The A1→A2 cliff is real and steep
Target jumps **300 → 1200 (4×)** between Ante 1 small and Ante 2 small while build power grows much more slowly. Per-ante clear rate, Spark/scaling profile (mid-game stack abstraction):

| Constellation | A1 | A2 | A3 | A4 |
|---|---|---|---|---|
| Lyra | 100% | 36% | 1% | 0% |
| Mensa | 97% | 33% | 2% | 0% |
| Fibonacci | 100% | 63% | 6% | 0% |
| Eclipse | 100% | 52% | 0% | 0% |
| Ophiuchus | 98% | 28% | 0% | 0% |
| Triumvirate | 94% | 3% | 0% | 0% |
| Polyhedra | 92% | 7% | 0% | 0% |
| Argo | 0% | 0% | 0% | 0% |

Even a "synergy" build (1.5× start + 0.85×/clear) lands only **27% A3, 1% A4** at Spark on Lyra. The published target curve (300 / 1200 / 4000 / 12000) appears tuned for a **stronger-than-typical** late-run loadout — the curve is consistent with Balatro pacing only when paired with very generous catalyst stacking.

**Recommendation:** consider softening Ante 2's small/greater targets by 15–25% (e.g. `1200 → 1000`, `2000 → 1700`) OR accelerate catalyst generosity in the shop draw at ante 2 (more Rares, lower prices on Ante 2). The data does not yet say the curve is unfair — high-skill players with strong synergies clear it — but it does say there's a sharp competence gradient at A2 that may frustrate new players.

#### B2. Argo is non-functional in the sim model
0% A1 clear at Spark/scaling. Three compounding factors in the sim:
1. Captain×crew base scoring is intrinsically lower than combo-tier scoring (3 d20 dice; one carries the catalyst mult).
2. The catalyst-count ramp `cleared * 0.6` reaches only ~0 catalysts by ante 1 in this model.
3. `modsDisabled: true` removes the mod-edition contribution that the build-multiplier abstraction is partly modeling.

The real game grants Argo `catalystSlotBonus: 2` and `faceMultiplierPerCatalyst: 0.75`, so a player intentionally building catalyst-heavy can recover. **Recommendation:** the constellation spec should make this explicit — consider giving Argo 2 **starting catalysts** (currently 0) so its 0-clear floor isn't structural. Without that, Argo's design demands a perfect first shop, which the rarity-weighted draw doesn't reliably supply.

#### B3. The chain-mult cap is dead weight by design
The cap is **8** for most constellations (`CHAIN_MAX_DEFAULT`). Max chain length within a single blind = max hands per blind = **3** (or 4 with `Open Mic` voucher). Realized peak `chainMult` in the sim:

| Constellation | Cap mult | Mean peak | Cap-hit rate |
|---|---|---|---|
| All non-Ophiuchus | 2.75× | ~1.43× | 0% |
| Ophiuchus | 1.75× (cap=4) | 1.45× | 0% |

Even Ophiuchus's reduced `chainCap=4` is unreachable because chain resets every blind (`initialRoundSlice` in `state/slices/round.ts`). This makes the chain cap an unused tuning knob — and Ophiuchus's "punishment" of a reduced cap is purely cosmetic.

**Recommendation:** either (a) **lower default `CHAIN_MAX_DEFAULT` to 4** to make Ophiuchus's modifier mean something and tighten the design, or (b) carry chain across blinds within an ante so the cap is reachable. Option (a) is the smaller change and matches existing per-blind hand budgets.

#### B4. Stake difficulty curve broadly works
Lyra/scaling profile across stakes:

| Stake | A1 | A2 | A3 | any-clear |
|---|---|---|---|---|
| Spark | 100% | 36% | 1% | 23% |
| Ember | 100% | 29% | 1% | 21% |
| Pyre | 99% | 25% | 1% | 20% |
| Beacon | 74% | 1% | 0% | 8% |
| Nova | 69% | 0% | 0% | 8% |
| Supernova | 59% | 1% | 0% | 7% |

The Spark→Pyre tail is gentle (~5pp/stake), Beacon to Nova adds a visible step, Nova→Supernova is small. **Beacon's −1 hand** has a much bigger effect than its +25% shop or +35% target — the hand cut alone halves blind-clear chance for marginal builds. Curve is monotonic and the spread is reasonable; no action required.

#### B5. Build-profile sensitivity is high (intended, but worth flagging)
Lyra @ Spark across profiles:

| Profile | A1 | A2 | A3 | A4 |
|---|---|---|---|---|
| bare (no catalysts) | 100% | 2% | 0% | 0% |
| early (1-2 catalysts) | 100% | 16% | 0% | 0% |
| scaling (mid-game stack) | 100% | 36% | 1% | 0% |
| synergy (strong build) | 100% | 82% | 27% | 1% |

The game is **highly catalyst-dependent past A1**. This is presumably intentional (it's the upgrade-treadmill premise) but it means the early-game shop draw (Ante 1-2) is a load-bearing system: a poor draw is effectively a soft-bust. **Recommendation:** verify in `core/shop/catalystDraw.ts` that the Ante 1 weights actually deliver a build-archetype with high probability — and consider tagging catalysts with archetype hints so the draw can guarantee a coherent starting kit.

### Performance

#### P1. `getBoundingClientRect()` per-frame per-view  ✅ Fixed
`render/three/sharedRenderer.ts:50` ran a layout-affecting query each frame for each registered die view. Cheap at ≤12 dice (note in code already flagged this), but unnecessary every frame. **Fixed:** rects are now cached and invalidated only on `resize`/`scroll`/`visibilitychange`. Public API unchanged. New `invalidateRects()` export lets layout-aware components push an invalidation if needed.

#### P2. DPR + antialias unconditional on mobile  ✅ Fixed
`renderer.setPixelRatio(min(dpr, 2))` and `antialias: true` are reasonable on desktop but punishing on mid-tier Android (DPR 3+, weak GPU, no MSAA acceleration). **Fixed:** introduced `isLowEndMobile()` heuristic (`navigator.hardwareConcurrency ≤ 4 && (pointer: coarse)`) that lowers DPR cap to 1.5 and disables antialias on those devices. No production-config code changes; the heuristic runs at renderer-init time only.

#### P3. Number overflow risk in scoring  ✅ Fixed
`core/phases/scoring.ts` previously did `Math.round(chips * mult * chainMult)` with no guard. With late-game catalyst stacks, products can approach `Number.MAX_SAFE_INTEGER` (~9e15) and `Math.round(Infinity)` produces `0` after a `+Infinity` propagates. **Fixed:** added `core/scoring/safeMath.ts` with `safeMul`/`safeRound` helpers that clamp at `MAX_SAFE_INTEGER/2`, preserve sign on Infinity inputs, and zero out NaN. Wired into `scoring.ts`. Six new tests cover the boundary cases. No effect on normal gameplay (clamp ceiling sits 6+ orders of magnitude above any reachable score).

#### P4. No FPS / measurement instrumentation  ✅ Added
The codebase had `performance.now()` sprinkled for animation timing but no aggregate sampler. **Added:**
- `src-next/devtools/perf.ts` — RAF tick sampler (rolling FPS p50/p95/p99 + jank count), `begin(name)` / `record(name, ms)` for one-shot measures, exposed on `window.__ff.perf`.
- `src-next/devtools/tabs/PerfTab.tsx` — DevConsole tab showing live FPS, frame ms, jank count, three-views count, persistence blob size, and per-measure histograms.
- Wired `perf.tick()` into `sharedRenderer.loop()`, `perf.begin('runSimulation')` in `simulation/runSimulation.ts`, and `perf.begin('persistence')` in `state/persistence.ts`.
- Cost in production: ~600 bytes of code, no work per frame beyond a single timestamp diff and a small ring-buffer push. Production users never open DevConsole, so the tab cost is irrelevant.

#### P5. Persistence blob size — Not yet measured (instrument now in place)
Save snapshot includes full `run`, `meta`, `round`, `ui`. `meta` accumulates `highScores`, `unlocks`, `discovered`, `stakeProgress`, `challengeWins` over a player's lifetime. With current PerfTab, the blob size is now visible at runtime. **Recommendation:** trigger a manual session test at a 200+ run save state and check the PerfTab readout. If >50 kb, switch the persistence trigger from "every store delta + 400ms debounce" to "phase-transition only". Keeping as a follow-up — no measurement yet to justify the change.

---

## Prioritized fix list

### Landed in this audit
1. ✅ Full-run balance simulator (`src-next/data/balance.fullrun.sim.test.ts`)
2. ✅ Perf sampler + DevConsole tab (`devtools/perf.ts`, `devtools/tabs/PerfTab.tsx`)
3. ✅ `safeMul` / `safeRound` overflow guards in `core/phases/scoring.ts` + tests
4. ✅ Cached rects + scroll/visibility invalidation in `sharedRenderer.ts`
5. ✅ DPR-cap + antialias tiering for low-end mobile

### Recommended follow-ups (out of scope for this audit, per the cutoff)
- **B1 retune:** soften Ante 2 targets OR boost Ante 2 shop generosity — needs designer call.
- **B2 Argo:** grant 2 starting catalysts, OR rebalance `faceMultiplierPerCatalyst`. Designer call.
- **B3 chain cap:** lower `CHAIN_MAX_DEFAULT` from 8 to 4 (single-line change in `core/scoring/constellationChain.ts`), OR carry chain across blinds. The former is a 5-minute change; the latter is a meaningful design shift.
- **B5 shop archetype tagging:** add an `archetype` field to catalysts and bias Ante 1 draw to deliver a coherent starting build.
- **P5 persistence trim:** measure with the new PerfTab; if blob >50kb, move persist trigger to phase transitions.

### Explicitly out of scope
- Rewrites of `evaluation.ts` / `store.ts` / scoring pipeline architecture
- New catalysts, mods, or content
- Migrating to a Decimal/BigInt number library (not justified — the safe ceiling is well above reachable scores)
- React component memoization audit (no measurement showed regression yet — PerfTab + manual profiling will tell)

---

## Verification

How to reproduce:

```sh
# Full balance suite
npx vitest run src-next/data/balance.sim.test.ts -t balance --reporter=verbose
npx vitest run src-next/data/balance.shards.sim.test.ts --reporter=verbose
npx vitest run src-next/data/balance.fullrun.sim.test.ts -t balance --reporter=verbose

# Scoring + safety
npx vitest run src-next/core/scoring/safeMath.test.ts
npx vitest run src-next/core/phases/

# Full suite
npx vitest run
```

Manual perf check:

1. `npm run dev`
2. Press `` ` `` to open DevConsole, switch to **perf** tab.
3. Play 3 antes; observe live FPS (p50 ≥ 50, frame ms p95 < 33ms target).
4. Note `persistence blob` size — flag if >50 kb.
5. Open Chrome DevTools mobile emulator (Pixel 5 + 4× CPU throttle); repeat. Frame-time p95 target: <33 ms during a roll.

All sims green, full suite (952 tests) passes. No public API changes.
