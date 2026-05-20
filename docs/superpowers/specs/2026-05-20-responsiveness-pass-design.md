# Responsiveness pass + Night Market rename — design

**Date:** 2026-05-20
**Owner:** lkonjevich
**Goal:** UX-specialist pass making the game feel more responsive and
satisfying at every interaction surface the player touches frequently,
without rewriting working systems. Bundle the Celestial Bazaar →
The Night Market rename into the same pass.

## Why now

Wave U landed scoring theater + living cosmos + a whole-game UI pass,
and ad81a5a swept mysticism out of player-visible copy. The button
feedback system (`buttonJuice.ts`) is well-engineered — per-tier SFX,
haptics, shockwave on pointerup, disabled-press deflection. Most of
the work the player touches is already wired up.

The remaining "dead" feel sits in the cracks between systems: places
where a non-`.btn` element is tapped, a screen transitions without a
fade, a modal pops in, or a sound fires without a matching visual.
This pass is targeted at those gaps — not a feedback-layer rewrite.

## Scope

### In scope (player picks)

1. **Rename Celestial Bazaar → The Night Market** in player-visible
   copy only. Code identifiers stay (file `Shop.tsx`, `blind="Bazaar"`
   prop, internal data keys).
2. **Round screen** — die tap, lock toggle, long-press tip, roll
   button press, hand-name update, score commit, hands/rerolls
   counter ticks, action bar pin/unpin. Passive feedback: catalyst
   strip pulses, heat meter ticks.
3. **Score moment / theater** — chip tick cadence, mult slam, payout
   reveal, voice-steal throttle verification, pause-button overlap
   during theater.
4. **Screen transitions + modals** — Hub↔Round↔Shop↔Forge cross-fade,
   Pause / Pack / SkipBounty / Collection sheet open+close, time-to-
   interactive after nav.

### Out of scope

- Shop / Forge surfaces (not picked by user).
- Layout, hierarchy, copy rewrites beyond the literal Bazaar→Night
  Market substitution.
- New SFX, new art, new haptic patterns. Existing palette only.
- Scoring math, dice physics, RNG, store shape.
- Audio mixing levels, music.
- New abstractions / refactors. No "while I'm here".
- Accessibility audit beyond the reduce-motion respect already in
  `buttonJuice`.
- Performance tuning beyond "did this change cause a regression".

## Approach — dead-spot triage pass

For each in-scope surface:

1. Run the game in preview at a desktop viewport.
2. Walk every interaction the player can perform on that surface.
3. Score each interaction against the dead-spot taxonomy below.
   Missing channels = dead spot.
4. Fix dead spots in source using **existing** systems (`buttonJuice`,
   `sfxPlay`, `triggerHaptic`, CSS keyframes already in `index.css`
   and the per-component `*.css` files). No new abstractions.
5. Re-screenshot, verify, commit per surface.

### Dead-spot taxonomy

What counts. Each interaction is scored against this table:

| Channel | Tap (instant) | Commit (action lands) | Denied (blocked) |
|---|---|---|---|
| Visual | <16ms press state (scale/border/glow) | <80ms reaction (settle, ripple, badge update) | shake or X overlay |
| Audio | <50ms SFX cue | layer cue (e.g. chip→commit) | denied SFX |
| Haptic (touch) | 6–10ms tap | 15–25ms commit | 30ms double-buzz |
| Motion | release ease-out | follow-through (toast/particle/number tick) | reset bounce |

Dead spot = interaction missing ≥1 of {press visual, commit audio,
commit visual} for the relevant class. Touch class also needs
haptic. Reduce-motion mode keeps audio/haptic, suppresses motion.

### Fix vocabulary

Use existing systems only:

- **`.btn` element** → covered by `buttonJuice.ts`. If a `.btn` feels
  dead, fix the CSS keyframe (`btn-shockwave-*`) or add a missing
  tier classification, not new code paths.
- **Non-`.btn` interactives** (dice, slots, cards) → add per-element
  `onPointerDown` that calls `sfxPlay(...)` + (touch) `triggerHaptic`
  + sets a `[data-pressed=true]` attribute styled in CSS. Mirror the
  shockwave/ripple pattern from `buttonJuice` where appropriate.
- **Screen transitions** → CSS `opacity` + `transform` keyframes on
  the screen root, 180–240ms ease-out. Mount with `key={screen}` so
  React replays the entry.
- **Modal enter/exit** → backdrop fade 120ms, content scale 0.96→1
  + opacity 200ms.

## Rename plan

Code identifiers stay; player-visible strings flip.

| Source pattern | Replacement |
|---|---|
| `The Celestial Bazaar` | `The Night Market` |
| `Celestial Bazaar` (standalone, no "The") | `Night Market` |
| `the Bazaar` (in flow copy) | `the Night Market` |
| `Bazaar` (start-of-sentence or standalone in player copy) | `Night Market` |
| Code comments mentioning Bazaar | leave alone (dev-only) |
| `blind="Bazaar"` prop, `blind: 'Bazaar'` data values | keep |

### Files touched (14)

Player-visible string changes:

- `src-next/app/screens/Shop.tsx` line 149 (title) + line 249 (Next
  Trial tooltip "Leave the Bazaar")
- `src-next/app/screens/Hub.tsx` line 163 ("admittance to the Bazaar")
- `src-next/app/screens/Forge.tsx` line 814 ("Buy mods at the Bazaar")
- `src-next/app/screens/Codex.tsx` lines 443, 501, 553 (three undiscovered tooltips)
- `src-next/app/screens/SkipBountyOverlay.tsx` line 241 ("next visit the bazaar")
- `src-next/app/hud/EmptySlot.tsx` line 28 ("Buy them at the Bazaar")
- `src-next/app/hud/TopBar.tsx` lines 500, 547 (shards / vouchers tooltips)
- `src-next/data/events.ts` line 163 ("in your next bazaar")
- `src-next/data/stakes.ts` line 75 ("The bazaar grows greedy.")
- `src-next/data/challenges.ts` line 43 ("No bazaar.")
- `src-next/data/catalysts.ts` line 183 ("bazaar dust")

Test update:

- `src-next/app/hud/EmptySlot.test.tsx` lines 13, 27 — expect strings
  flip to `Night Market`.

Dev-only / kept:

- `src-next/app/screens/Shop.tsx` line 1 comment — refresh wording for
  accuracy (`// Shop screen — the Night Market between blinds.`).
- `src-next/app/hud/PauseButton.tsx` line 63 comment — same.
- `src-next/core/round/transitions.ts` line 676 comment — leave
  (refers to phase semantics, not the player-facing name).

### Display safety

`Shop.tsx` title uses `clamp(20px, 6vw, 36px)` with `whiteSpace: nowrap`.
"The Night Market" is 16 chars vs "The Celestial Bazaar" at 19 — no
overflow risk at any viewport. `◇ exchange ◇` decoration label above
the title kept as-is; reads cleanly with the new name.

`TopBar` `blind` prop will still pass `"Bazaar"` internally — this is
a phase identifier the TopBar can label however it likes. The TopBar
will render the player-visible label via a small lookup so the rename
is consistent without changing the prop contract. If the TopBar
currently writes `Bazaar` directly to the DOM, update its display
mapping during the rename commit.

## Verification workflow

Per surface, with `mcp__Claude_Preview__*`:

1. `preview_start` if no server. Reuse across surfaces.
2. Baseline pass — walk surface, `preview_screenshot` at each state.
   `preview_console_logs` checked for warnings/errors.
3. Build dead-spot list inline (no separate doc — list lives in
   commit body).
4. Fix pass — edit source. HMR catches React/TSX. CSS keyframe edits
   may need `preview_eval window.location.reload()`.
5. Verify pass — replay same interactions, `preview_screenshot`,
   compare to baseline. Each fix has at least one before/after pair.
6. Click-test with `preview_click` on actual buttons/dice/cards so
   press states fire. `preview_console_logs` re-checked.
7. Commit per surface. Commit body lists fixed dead spots, screenshot
   paths/embeds, residuals deferred.

### Risk gates per commit

- `npm test` green (with rename test strings updated).
- `npm run typecheck` clean.
- No touch to scoring math, dice physics, RNG, store shape. Pure
  presentation layer.
- Reduce-motion spot-check: shockwaves + shake suppressed, SFX still
  fires.

### Residuals

Anything that needs new art, new SFX, or layout rework — log as
`// TODO(uxpass-2026-05-20):` at the call site and capture in a
"Residuals" section of the postmortem (optional 5th commit). Don't
fix scope drift inline.

## Done criteria

1. Rename: grep `-i bazaar src-next/` returns only code identifiers
   (`blind="Bazaar"` and similar) plus dev comments listed in the
   "kept" section above.
2. Round surface: die tap, die lock, roll, score-commit each produce
   visual + audio reaction within taxonomy budget.
3. Score theater: chip tick + mult slam + payout reveal — no missing
   cues, no voice-steal regression (audio caption check).
4. Transitions + modals: each Hub↔Round↔Shop↔Forge nav has fade; each
   modal has enter+exit anim; nothing pops in.
5. `npm run typecheck` clean.
6. `npm test` green.
7. Reduce-motion mode: shockwaves + shake suppressed, SFX still fires.
8. Before/after screenshots in commit bodies or attached to this spec.

## Commit slice

1. `ux: rename Celestial Bazaar to The Night Market`
2. `ux: fix Round screen dead spots (dice/lock/roll/score)`
3. `ux: fix score theater pacing residuals`
4. `ux: add screen transition + modal feedback`
5. (optional) `ux: postmortem + residual TODOs`

## References

- `src-next/app/hud/buttonJuice.ts` — existing per-tier button feedback.
- `src-next/audio/sfx/` — SFX cue library.
- `src-next/app/haptics/haptics.ts` — haptic API.
- `docs/superpowers/specs/2026-04-30-alive-feel-sweep-design.md` —
  prior alive-feel pass; this design respects its decisions.
- `docs/superpowers/specs/2026-05-19-bespoke-scoring-theater-design.md`
  — recent scoring theater design; this pass only polishes residuals.
