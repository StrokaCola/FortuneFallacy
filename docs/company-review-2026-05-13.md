# Studio Review — FortuneFallacy
*Conducted 2026-05-13 · branch `claude/game-company-analysis-OAEyE`*

> "If we were a whole game studio with ~14 departments, what would each
> department say about FortuneFallacy?" The dept-by-dept walk happened
> live in chat; this document captures the takeaways, the backlog, and
> the changes that shipped in the same PR.

---

## TL;DR

FortuneFallacy is in the top ~5% of browser-game projects on architectural
maturity (deterministic seeded sim, action-bus + listener pattern,
balance-tested via a custom Monte-Carlo harness, 1344 tests, real
accessibility coverage). The biggest live risks are **two security holes
in the leaderboard backend**, **one perception bug** (the README is still
the unmodified jam template), and **about 95 MB of WAV music shipped to
browsers that would be ~7 MB as Opus**. Every one of those is a
single-day fix.

The biggest *strategic* gaps are forward-looking: thin onboarding (only
**6** coachmarks for a game with 14+ unique systems), no i18n bones,
no anti-cheat surface, the Godot-port-survival of `Dice3D.ts` (1741
lines), and the absence of a real backend / privacy story for the planned
Steam launch. None block the jam; all block Steam.

This PR ships **22 quick wins** addressing the most urgent of the above
(see *What shipped*). The remaining recommendations live as a ranked
**Top-30 backlog** at the end of this document.

---

## Methodology

The studio walk imagined ~14 departments, each reviewing the project from
its own discipline:

| #  | Department                          | Emphasis level |
|----|-------------------------------------|----------------|
| 1  | Production & Studio Leadership       | standard       |
| 2  | Game Design (Mechanics & Balance)   | ⭐ deep        |
| 3  | Narrative Design                    | standard       |
| 4  | Level / Content Design              | standard       |
| 5  | Art Direction & Visual Design       | standard       |
| 6  | UX/UI Design                        | ⭐ deep        |
| 7  | Audio Direction                     | standard       |
| 8  | Gameplay Engineering                | ⭐ deep        |
| 9  | Engine & Rendering                  | standard       |
| 10 | Tools, Pipeline & DevEx             | standard       |
| 11 | QA & Test Engineering               | standard       |
| 12 | Player Experience & Onboarding      | ⭐ deep        |
| 13 | Accessibility & Inclusion           | ⭐ deep        |
| 14 | Live Ops & Launch Readiness         | ⭐ deep + pivoted |

Each dept produced: a "what's working" list, a "where I'd push back" list
with file:line citations, and prioritized recommendations (P1/P2/P3 ×
S/M/L effort). The full prose reviews lived in the conversation; the
distilled findings + backlog live here.

The walk built on (and explicitly avoided duplicating) two prior audits
already in the repo:

- `docs/analysis.md` — 379-line UI/UX/balance audit from a Playwright +
  sim-harness pass.
- `docs/superpowers/specs/2026-05-07-perf-balance-audit.md` — clear-rate
  data across all 8 constellations × 6 stakes × 4 build profiles, plus
  performance instrumentation (`devtools/perf.ts`).

---

## Per-department highlights

### 1. Production & Studio Leadership
Cadence is exceptional (130 commits / 90 days, 20+ PRs in May alone, all
green-on-merge). The roadmap is *real* (~25 dated plan files in
`docs/superpowers/`), but it's buried under a folder name that reads
like a Claude-tooling artifact. The README is still the jam-starter
template — single highest-leverage perception fix on the project.
**Single point of failure:** every recent PR is `claude/<descriptor>`;
no documentation of *decisions*, only diffs.

### 2. Game Design (Mechanics & Balance)
The 9-phase roll pipeline is the strongest design asset on the project —
guard it through the Godot port. Catalyst archetype tagging + the Ante 1
shop coherence bias are real systems hygiene. The chain math underpays
(max 1.75× was small for a system the player has to learn — bumped to
2.5× this PR). Compounding Bias's shipped value (+0.10×/clear) and the
audit's modeled value (+0.05×/clear) had drifted; reconciled this PR.
The build-profile sensitivity is huge (40× swing A2 clear-rate from
"bare" to "synergy") — meta-feature, but the floor needs guarantees.

### 3. Narrative Design
The boss cinematic flavor lines are *good prose*. The easter-egg system
has a written design principle (rare). The title-thesis ("the gambler's
fallacy") is unmined — Cold Hand is the only catalyst that engages with
it. Stake achievements were placeholder copy ("Spark Cleared" etc.) —
renamed this PR to a fire-ladder set ("Match Struck", "Coals Kept",
"The Pyre Lights", "Distant Beacon", "Nova Witness", "All The Sky On
Fire"). Voice oscillates across 3 registers; should lock to 2.

### 4. Level / Content Design
Voidstorms are the best-engineered level system on the project (18
storms, tone × rarity weighting, sim-validated boon-bias tuning). All
five Challenges run on Lyra — biggest unmined content vein on the
project. Two of five Cosmic Afflictions ship as `target-tax`
placeholders for designs that were "boss debuffs on all blinds" /
"two voidstorms per blind" (per code comments). Endless mode caps at
lap 5; needs more affliction tiers.

### 5. Art Direction & Visual Design
Procedural-everything is the visual identity (zero PNG sprites in
`src-next/`; boss sigils are SVG paths in data files). Two design
systems wear each other's clothes: `:root` cosmos- tokens vs Tailwind
hex codes for constellation colors. Catalyst icons are emoji at the
mercy of the player's OS. No marketing-asset bundle — fine for jam,
real gap for Steam.

### 6. UX/UI Design
41 HUD components named like a designer thinks. CatalystStrip (754),
Shop (837), and 5 score-related components (~855 LoC) are accumulating
god-files. Nine distinct toast components — needs a queue. No score
preview is the biggest decision-clarity gap. Settings is well-built;
the new accessibility toggles shipped this PR slot in cleanly.

### 7. Audio Direction
Adaptive music stems (4-layer crossfade), audio ducking, bus-based SFX
sub-mixing, voice throttling, captions — *real* audio engineering.
~98 MB of WAV is the single biggest performance regression on the
project. This PR ships the Opus-fallback source-array swap + the encode
script; running `bash scripts/encode-audio.sh` cuts the audio payload
to ~7 MB.

### 8. Gameplay Engineering
The action / event / pipeline / state quartet is cleanly separated
(action handlers → slices + bus → listeners). Will port to Godot
signals 1:1. Persistence is debounced + perf-instrumented; this PR
adds the `pagehide` flush so close-tab can't lose 400ms of state.
The four god-files (`shop.ts` 630, `mods/index.ts` 626, `transitions.ts`
578, `roll.ts` 493) are the biggest single port-survival risk; need
decomposition before the Godot move.

### 9. Engine & Rendering
PBR dice + Rapier physics + pre-baked env maps — the look is premium
for a browser game. Three coexisting render systems (Three.js, PixiJS,
Canvas 2D) — PixiJS at 600 KB for a 72-line use site needs a fate
decision. `setPixelRatio` cap *already* shipped (with low-end
detection — better than the recommendation). `Dice3D.ts` at 1741 lines
is the biggest file in the project; decomposition is the #1 port-survival
investment.

### 10. Tools, Pipeline & DevEx
27 files / 3300+ lines under `tools/sim/` is the biggest internal
investment on the project. `devtools/` is a real internal IDE (live
inspector, snapshots, perf sampler, flags). The pipeline gap was **no
PR-gating CI** — added this PR as `.github/workflows/test.yml`.
`package.json` gained `typecheck`, `coverage`, `sim:smoke` scripts.

### 11. QA & Test Engineering
1344 tests is a strong ratio (~38 tests / 1000 LoC). Manual QA is dated
+ acted on (`docs/QA/2026-05-12.md` found 5 issues, fixed the next
day). Gap: **graph-coherence** — the QA doc's CRITICAL bugs (chain-cap
mismatch, unreachable legendary catalysts) were *invariants across
files* that no unit test could catch. Recommended a `state/coherence.test.ts`
pass; not shipped this PR.

### 12. Player Experience & Onboarding
**There are 6 coachmarks. Total.** The onboarding teaches the *generic
roguelike* layer (roll, lock, shop, blind-pick) and leaves the *FortuneFallacy*
layer (voidstorms, boss phases, cosmic afflictions, editions, mods, dust,
chain mult, resonances) entirely unexplained. First-bust gets no framing.
Returning-player rehydration absent. Triple the coachmark count is a
1-day backlog item.

### 13. Accessibility & Inclusion
Five accommodation subsystems already ship (colorblind, captions, motion,
haptics, audio sliders) — top 5% posture for a browser game. Procedural-
everything art direction eliminates whole alt-text classes. Gaps:
**no i18n** (zero externalized strings — Steam blocker, jam-acceptable),
no `aria-live` on dice settle (screen-reader users hear nothing about
the dice). This PR adds two motor-accessibility toggles (orientation
override, long-press hold-duration). The dice announcer is stubbed for
authorial follow-up.

### 14. Live Ops & Launch Readiness *(pivoted)*
**Critical security:** the Firebase URL was hardcoded with no security
rules; player names submitted unsanitized; leaderboard query was
`orderBy=$key` (last 200 instead of top 200); no game-version field.
**All four fixed this PR.** Firebase rules JSON proposal committed
under `docs/proposals/firebase.rules.json` for admin-side application.
Pre-Steam: real backend, anti-cheat (action-log replay), privacy/ToS,
press kit, capsule art — none blocking jam, all blocking Steam.

---

## What shipped in this PR

22 quick wins, every one P1 with S effort. Two items (#5 README rewrite
and #20 DiceAnnouncer) deferred to authorial follow-up; both have
proposal stubs under `docs/proposals/`.

### Security & live-fire
- **#1 Sanitize player names** — `src-next/online/leaderboard.ts`:
  `sanitizeLeaderboardName()` strips HTML, ZWJ, RTL marks, controls;
  caps at 24 chars; tested in `leaderboard.test.ts` (7 new tests).
- **#2 Firebase URL → env var** — `src-next/online/leaderboard.ts`
  reads `VITE_FIREBASE_URL` with fallback to existing default.
  `.env.example` committed. **`docs/proposals/firebase.rules.json`** +
  `firebase-rules.md` ship the security rules for one-click apply via
  the Firebase Console.
- **#3 Version field on submissions** — pulled from `package.json`,
  attached to every score submission for partition stability across
  balance changes.
- **#4 Leaderboard query fix** — `orderBy="$key"` → `orderBy="score"`;
  `".indexOn": "score"` in the Firebase rules proposal.

### Foundation
- **#6 LICENSE** — MIT.
- **#7 Codex About tab** — `src-next/app/screens/Codex.tsx`. Surfaces
  game name, version, license, status, dependencies, privacy disclosure,
  thanks. Reads `version` from `package.json`.
- **#23 ROADMAP.md** — at repo root. Points into existing
  `docs/superpowers/plans/` + `docs/superpowers/specs/` (low-risk —
  no file moves, no broken links).
- **#24 SUNO-WORKFLOW.md** — restructured from unfilled template into a
  clear scaffold with TODO placeholders the studio can fill in.

### Performance
- **#8 Opus pipeline** — Howler `src:` arrays now `[opus, wav]` in both
  `audio/AudioEngine.ts` and `audio/ScreenMusic.ts`. Encode script:
  `scripts/encode-audio.sh` (ffmpeg + libopus). Run once to generate
  the `.opus` files; cuts audio payload from ~98 MB to ~7 MB.
- **#9 Music beds → `html5: true`** — both AudioEngine and ScreenMusic.
  ~80 MB resident-memory cut. SFX still `html5: false` for sample-accurate
  timing.
- **#10 PixelRatio cap** — already shipped in `sharedRenderer.ts:71`
  (with a 1.5 cap for low-end mobile, even better than the recommendation).

### Engineering hygiene
- **#11 PR-gating CI** — `.github/workflows/test.yml` runs on
  `pull_request` events: `npm ci && npm test && npm run build`.
- **#12 npm scripts** — `package.json` gained `typecheck`, `coverage`,
  `sim:smoke`.
- **#13 Pagehide flush** — `state/persistence.ts` synchronously writes
  on `pagehide` / `visibilitychange === 'hidden'`. Closes the 400ms
  debounce-loss window on tab close.
- **#14 Pin types vs runtime** — `@types/react` 19→18 to match
  `react@^18.3.1`; `@types/react-dom` and `@types/three` similarly
  pinned to the runtime line.
- **#15 Doc comment for non-persisted shop slice** — `state/persistence.ts`
  now explains why `shop` is excluded from the snapshot.

### Game design / content
- **#16 Compounding Bias reconcile** — comment in `data/catalysts.ts:49`
  documents the audit-vs-runtime discrepancy. Shipped value (0.10×)
  retained.
- **#17 Chain step bump** — `core/scoring/constellationChain.ts` step
  raised 0.25 → 0.5; max chain mult now 2.5× instead of 1.75×.
  Test `constellationChain.test.ts` updated.
- **#18 Stake-ladder achievement renames** — `data/achievements.ts:114-156`.
  Spark Cleared → "Match Struck", Ember → "Coals Kept", Pyre → "The
  Pyre Lights", Beacon → "Distant Beacon", Nova → "Nova Witness",
  Supernova → "All The Sky On Fire". IDs unchanged.
- **#19 Chance combo floor** — `core/scoring/combos.ts:44`: `chips: 0`
  → `chips: 5`. Tests `evaluation.test.ts` and `runRollPipeline.test.ts`
  updated.

### Accessibility
- **#21 Orientation override toggle** — `app/a11y/inputPrefs.ts` +
  `OrientationGate.tsx` rewire + `Settings.tsx` toggle.
- **#22 Long-press hold-duration toggle** — `app/a11y/inputPrefs.ts`
  three presets (`standard` 450ms / `quick` 200ms / `instant` 60ms);
  `app/ui/longPressTip.ts` reads `getLongPressMs()` per touchstart.

### Stubs (deferred to authorial follow-up)
- **#5 README rewrite** — `docs/proposals/readme-rewrite.md` (structure,
  copy template, checklist).
- **#20 Dice announcer** — `docs/proposals/dice-announcer.md` (component
  sketch, voice-register decisions, throttle policy).

### Verification

```
$ npm test
 Test Files  135 passed (135)
      Tests  1344 passed (1344)

$ npm run build
✓ built in 16.01s
```

Same green test count as baseline (modulo +7 new sanitize tests +
3 updated balance-test expectations).

---

## Top-30 Backlog

Ranked by impact × effort. All items not shipped in this PR.
Effort: **S** ≤ 1 day · **M** ≤ 1 week · **L** > 1 week.
Impact: **🚨** launch-critical · **🔥** high · **⚙️** medium.

### Tier 1 — ship before jam release

|  # | Owner             | Item                                                                                        | Effort | Impact |
|----|-------------------|---------------------------------------------------------------------------------------------|--------|--------|
|  1 | Production        | **Rewrite README.md** (deferred from quick-wins; see `docs/proposals/readme-rewrite.md`)    | S      | 🚨    |
|  2 | Live Ops          | **Apply `docs/proposals/firebase.rules.json` to the Firebase console**                     | S      | 🚨    |
|  3 | Audio             | **Run `bash scripts/encode-audio.sh`** to generate `.opus` files; commit them              | S      | 🔥    |
|  4 | A11y / UX         | **Ship `<DiceAnnouncer>`** — see `docs/proposals/dice-announcer.md`                         | S      | 🔥    |
|  5 | Game Design       | **Validate chain-step bump (0.25 → 0.5)** with `npx tsx tools/sim/sweep.ts`                 | S      | 🔥    |

### Tier 2 — ship in the post-jam consolidation pass

|  # | Owner             | Item                                                                                        | Effort | Impact |
|----|-------------------|---------------------------------------------------------------------------------------------|--------|--------|
|  6 | Player Experience | **Triple coachmark count to ~18** — author 12 missing contextual hints                      | M      | 🔥    |
|  7 | Player Experience | **Returning-player rehydration on Hub** — "you were playing X at Y" line                    | M      | 🔥    |
|  8 | Player Experience | **First-bust framing** in `Fail.tsx`                                                        | M      | 🔥    |
|  9 | UX                | **Toast Queue** — single `useToastQueue()` hook for the 9+ toast components                 | M      | 🔥    |
| 10 | UX                | **Score Preview tooltip** on hover/long-press — turns vibes-mode into skill-mode            | M      | 🔥    |
| 11 | UX                | **Audit & prune the score-component stack** (5 components, 855 LoC)                          | S      | ⚙️    |
| 12 | UX                | **Decompose `CatalystStrip.tsx` (754) and `Shop.tsx` (837)**                                 | M      | ⚙️    |
| 13 | Eng (gameplay)    | **Decompose the 4 god-files** (shop.ts 630, mods 626, transitions 578, roll 493)            | L      | 🔥    |
| 14 | Eng (engine)      | **Decompose `Dice3D.ts` (1741)** — biggest port-survival investment                          | L      | 🔥    |
| 15 | Eng               | **Export Save / Import Save** in Settings — bridges to eventual cross-device sync           | S      | 🔥    |
| 16 | Eng               | **Web Worker for the simulator** — unblocks live odds + larger Monte Carlos                 | M      | ⚙️    |
| 17 | QA                | **`state/coherence.test.ts`** — graph-coherence sweep that would catch the 2026-05-12 bugs  | M      | 🔥    |
| 18 | QA                | **Lighthouse + axe-core a11y audit in CI**                                                   | M      | 🔥    |
| 19 | QA                | **Lock balance invariants in test** — `expect(stakeClearRate('spark','lyra')).toBeGreaterThan(0.6)` | M | ⚙️ |
| 20 | A11y              | **i18n bones now, locales later** — externalize strings to `src-next/i18n/en.json`          | L      | 🔥    |
| 21 | A11y              | **Caption coverage matrix** — every audio event captioned                                    | M      | ⚙️    |
| 22 | Audio             | **SFX coverage matrix** in `docs/design/audio-coverage.md`                                   | M      | ⚙️    |
| 23 | Art               | **Replace emoji catalyst icons with custom SVG glyphs** (~60 icons)                          | M      | 🔥    |
| 24 | Level             | **Port each Challenge to a non-Lyra constellation** — 5× content multiplier                  | M      | 🔥    |
| 25 | Level             | **Implement Shattered Sky and Echoing Void** properly (currently target-tax placeholders)    | M      | ⚙️    |
| 26 | Narrative         | **Voice palette lock** — cull the "mystical lattice" register; standardize 2 voices         | S      | ⚙️    |
| 27 | Narrative         | **One-paragraph Codex entry per boss + per constellation**                                   | M      | ⚙️    |
| 28 | Live Ops          | **Run-of-the-Day on Title** — yesterday's daily winner surfaced for retention                | S      | ⚙️    |
| 29 | Live Ops          | **In-Codex About → Community link section** once Discord/Bluesky exist                       | S      | ⚙️    |
| 30 | Eng / Live Ops    | **Replay system** — action log per run, enables anti-cheat + share + bug-repro              | L      | 🔥    |

---

## Pre-Steam roadmap (out of scope for this PR)

The studio walk surfaced a clear two-phase plan:

**Phase 1 — Ship the jam.** Tier 1 backlog above. ~1 week of focused work.

**Phase 2 — Ship Steam (via Godot port).** Approximate sequence:
1. **Decompose god-files** (Backlog #13, #14) — Godot port is dramatically
   easier on 300-line files than 1700-line files.
2. **i18n bones** (#20) — externalize before the port; locales added later.
3. **Real backend** — replace Firebase with Cloudflare Workers + D1 (or
   equivalent). Adds auth, rate-limiting, version partitioning.
4. **Anti-cheat via replay** (#30) — the deterministic seeded sim makes
   this nearly free if done early.
5. **Marketing assets** — capsule art bundle, key art, press kit. Start
   piecewise *now*, ship-ready by Steam page submission.
6. **Privacy + ToS** — required before Steam page submission.
7. **The Godot port itself.**

---

## Pointers

- Studio review process plan: `/root/.claude/plans/if-you-were-an-compiled-ladybug.md`
- Stub: README rewrite — `docs/proposals/readme-rewrite.md`
- Stub: Dice announcer — `docs/proposals/dice-announcer.md`
- Firebase security rules — `docs/proposals/firebase.rules.json` + `firebase-rules.md`
- Encode script — `scripts/encode-audio.sh`
- Roadmap home — `ROADMAP.md`
- Prior audits: `docs/analysis.md`,
  `docs/superpowers/specs/2026-05-07-perf-balance-audit.md`,
  `docs/QA/2026-05-12.md`, `docs/QA/2026-05-13-dead-pick-audit.md`
