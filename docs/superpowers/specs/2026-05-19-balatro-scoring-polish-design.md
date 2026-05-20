# Balatro Scoring Polish Design — Wave T+1

**Date:** 2026-05-19
**Status:** Approved — Phase 1 cleared to implement
**Author:** Brainstormed with user (senior audio engineer + game design framing)

## Goal

Make scoring theater feel as clean, polished, understandable, and exciting as possible — taking Balatro as the lodestar. Wave T already shipped attribution arcs (`FlyToCounter`), tier-mapped `CrescendoBanner`, attribution rail (`RunningHandRail`), and the boom celebration. This polish pass closes three concrete gaps the user flagged:

1. **Rhythm/pacing** — beats blur together; Balatro paces card chip pops ~150-250ms apart with a rising pitch ladder.
2. **Number readability** — hard to track what adds what; numbers fly too fast/uniform and lack the punch-scale that says "this matters."
3. **Mult vs chips distinction** — both feel same-weight; Balatro: chips are quiet ticks, mult is screen-shaking slam with weighty boom.

## Engine context (load-bearing)

`src-next/core/scoring/sequence.ts:181-297` already computes the final score as `runningChips * runningMult` — same model as Balatro. The split exists in the engine. The HUD currently displays only the single running total, which is the root cause of the "math hidden" feeling. Phase 2 will surface the split; Phase 1 sharpens the existing layer first so Phase 2 lands on a polished foundation.

## Approach — staged, two phases

Phase 1 (this spec, cleared to implement) targets the three flagged gaps inside the existing system. Phase 2 (separate spec after Phase 1 lands and is preview-verified) adds a visible CHIPS × MULT readout — the Balatro identity move.

---

## Phase 1 — Pacing + Punch + Mult Slam + Audio Ladder

### 1. Beat queue (pacing)

**File:** `src-next/app/hud/theater/FlyToCounter.tsx`

- Add an internal FIFO buffer for `upgrade-chip` / `upgrade-mult` floaters.
- Dequeue at minimum 110ms intervals via a `requestAnimationFrame`/`setTimeout` driver.
- Other beats (`cast-swell`, `mult-slam`, `cross-target`, `boom`, `bail`) bypass the queue — they're already paced by the sequence builder and any throttle would desync them from the VFX layer.
- Flush queue on `cast-swell` so stale floaters never bleed into the next hand.
- Reduce-motion users still bypass entirely.

### 2. Number punch

**Files:** `src-next/app/hud/theater/FlyToCounter.tsx`, `src-next/styles/index.css`

- Replace the fixed 13px floater fontSize with `clamp(12, 12 + log10(|value|) * 4, 22)`:
  - `+5 chips` → ~14px
  - `+50 chips` → ~19px
  - `+500 chips` → ~22px (cap)
- Add a new CSS keyframe `theater-floater-punch`: scale 1.0 → 1.3 → 1.0 over 180ms, ease-out — layered on top of the existing 700ms `theater-fly-to-counter` flight.
- Boost `textShadow` glow on the first ~200ms (via a glow-pulse keyframe) so the floater pops on spawn then settles into its flight glow.

### 3. Mult slam-impact (no arc)

**File:** `src-next/app/hud/theater/FlyToCounter.tsx`

- Branch on `beat.kind === 'upgrade-mult'`:
  - Anchor at the score-counter element (`[data-score-counter]`) center, slightly above so it doesn't visually collide with the running total. If the counter isn't found, fall back to viewport center.
  - Animation: scale 0.3 → 1.4 → 1.0, with a horizontal shake offset (±4px, 2 cycles), hold at scale 1.0 for ~280ms, then fade out. No flight path.
  - For `|multDelta| >= 3`, add a screen-shake-xs (the existing fine shake class on `#stage-root`) to physically punctuate the slam.
- `upgrade-chip` floaters keep current arc behavior unchanged.
- Color signature preserved: mult floater stays coral/gold (mod/resonance/catalyst-mult depending on source).

### 4. Audio pitch ladder

**File:** `src-next/audio/scoring.ts`

- Router holds a `chipPopIndex` counter (closure variable).
- Reset to 0 on `cast-swell`.
- `upgrade-chip` pitch: `semis = min(chipPopIndex, 14)` — one semitone per pop, capped at +14 (≈2.4× base frequency) to stay below ear-piercing.
- Increment `chipPopIndex` after each `upgrade-chip` dispatch.
- Magnitude (chipDelta) still drives **gain** (loud +500, quiet +5), so the position-pitched ladder doesn't lose magnitude expressiveness.
- `upgrade-mult` keeps the existing delta-pitched `multSlam` voice — different timbre + pitch logic = preserved mult/chip contrast.
- Die-tick beats keep their existing per-die pitch (they're the rhythmic floor, not the ladder).

### 5. What stays untouched

- `TheaterDirector` phase machine (`ramping → sustained → held-breath → release`).
- `CrescendoBanner` tier display.
- `BoomNumber` celebration sequence (pop → fly → star trails → counter fill → savor).
- `RunningHandRail` attribution rail.
- Attribution sourceId/sourceType resolution logic.
- VFX overlay layer (`ScoringVFX`).
- Tipping-point duck + sub-bass rumble.

## Verification plan (Phase 1)

1. `preview_start` against the dev server.
2. Trigger three score hands of escalating complexity:
   - Small: 1 die, 0 catalysts, small chip total.
   - Medium: 3 dice, 1-2 catalysts, mult ≥ 2.
   - Large: 5 dice, multiple catalysts, mult ≥ 4, crosses target.
3. `preview_screenshot` mid-sequence and at boom for each.
4. `preview_console_logs` for warnings/errors during beat dispatch.
5. Reduced-motion sanity check (`document.documentElement.classList.add('reduce-motion')` via `preview_eval`).
6. Listen-check (subjective, via running the game locally if dev wants): chipTick ladder rises, multSlam stays heavier/lower timbre.

## Risks / mitigations

- **110ms queue spacing might desync from sequence-builder timing.** Mitigation: the queue only delays floater render, not Beat dispatch — Theater state, audio, and round logic still see beats at their original times. If a queue-driven floater arrives after the screen has transitioned, it self-cancels on cast-swell flush.
- **Punch-scale + size scaling stacking might cause floaters to overflow viewport.** Mitigation: 22px cap on font-size; punch keyframe peaks at 1.3× then settles to 1.0× before the flight starts moving meaningfully.
- **Mult slam-impact might compete with existing `mult-slam` ScoringVFX shake.** Mitigation: `upgrade-mult` (per-event mult upgrade from a single catalyst) and `mult-slam` (final mult roll-up from sequence builder) are distinct beat kinds with distinct visual signatures already. We're adding shake to `upgrade-mult` only when delta ≥ 3, which is rare enough not to wash the final slam.

## Files touched (Phase 1)

| File | Change |
|------|--------|
| `src-next/app/hud/theater/FlyToCounter.tsx` | Queue, mult slam branch, value-scaled fontSize, punch keyframe class |
| `src-next/audio/scoring.ts` | Sequence-position pitch ladder for upgrade-chip |
| `src-next/styles/index.css` | `theater-floater-punch`, mult slam-impact keyframes |

## Out of scope (Phase 1)

- CHIPS × MULT scoreboard (Phase 2).
- Beat dispatch timing changes inside `sequence.ts` (the engine's pacing stays; only the HUD layer is reshaped).
- New SFX assets (everything reuses existing chipTick / multSlam voices).
- Mobile-specific layout adjustments beyond the existing reduced-motion guard.

## Out of scope (Phase 2 — to be specced separately)

Will be drafted after Phase 1 previews cleanly. Sketch only:

- New `ChipsMultScoreboard` component near or replacing the running-total display during scoring.
- `runningChips` / `runningMult` exposed as bus events or beat fields so the HUD can read them per beat.
- Floater destinations re-routed: chip arcs land on chips half, mult slams grow the mult half.
- At boom: product computes visibly (`[chips] × [mult] = [total]`) before the total flies to the corner counter.
