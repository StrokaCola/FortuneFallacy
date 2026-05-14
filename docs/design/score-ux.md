# Score UX — component map

The studio review flagged a 5-component score stack (`ScoreFloat`,
`ScoreMoment`, `ScorePanel`, `ScoreBreakdown`, `ScoreExplain` — 855 LoC
total) and asked for a firing-order audit + dead-code prune. This is
the audit.

**Result: 4 live components, 1 dead. Dead file removed in the same
commit; the remaining four are documented below.**

## Removed in this audit

| File | Status | Action |
|---|---|---|
| `ScorePanel.tsx` (34 lines) | Exported but imported by zero callers. Looks like an early-version top-left score panel that the `TopBar` redesign replaced. | **Deleted.** Verified with `grep -rn "ScorePanel\\b" src-next/`. |

## The four live score components

Sorted by lifecycle: which one fires when during a scoring sequence.

### 1. `ScoreFloat` (140 lines) — the live counter

**Role:** the visible score number on the HUD. Permanently mounted on
the Round screen. Reads `selectScore` / `selectTarget` from the store.

**Trigger:** mounts on Round screen entry; updates on every `score`
store change. On `onScoreBeat` (kind `boom`), runs an "explosion"
animation for `EXPLOSION_DURATION_MS = 720ms` (scale-punch + chromatic
split + outward ring).

**Visible duration:** always-on while in Round.

**Owns:** the headline score readout. Nobody else paints score
numbers in this size band.

### 2. `ScoreMoment` (142 lines) — the beat controller (headless)

**Role:** *no DOM output.* This is a pure bus-listener bridge that
translates `onScoreBeat` events into `scoringVFX.fireSlam` /
`fireTargetBeat` / `fireBail` / `fireBoom` calls, plus dispatches the
`END_SCORING` action that advances the round after the boom
celebration completes.

**Trigger:** mounts on Round screen entry. Listens forever; no
self-state.

**Visible duration:** none. The visual goes through `ScoringVFX` (a
separate, intentionally heavyweight VFX layer, ~714 lines).

**Owns:** the round-advance handshake. The hand-tuned timings
(`BOOM_FLY_START_MS = 1700`, `BOOM_FLY_MS = 800`, `BAIL_HOLD_MS =
2400`) gate when `END_SCORING` fires.

### 3. `ScoreBreakdown` (292 lines) — the live tween popup

**Role:** the chips × mult × chain × total breakdown that animates
during a scoring sequence. Slot-spin tween from previous mult to new
mult over `MULT_TWEEN_MS = 240ms`; back-to-back slams chain visually.

**Trigger:** mounts always; opacity-driven visibility on `onScoreBeat`
events. Fades out over `FADE_OUT_MS = 1200ms` after the sequence ends.

**Visible duration:** ~scoring duration + 1200ms tail.

**Owns:** the live math reveal while the score number is climbing.

### 4. `ScoreExplain` (247 lines) — the "?" post-mortem

**Role:** the *post-score* tooltip that lets a player open a detailed
itemised breakdown of where the chips/mult/chain numbers came from.
Reads `state.round.lastScoringCtx` (the most recently completed scoring
context) and renders a multi-line explanation.

**Trigger:** mounts always; auto-collapses when `onScoreCalculated`
fires (so the live animation isn't blocked by the popup). Player
re-opens via the in-HUD `?` affordance once the new score lands.

**Visible duration:** while the player has it open. Auto-collapses on
the next `onScoreCalculated`.

**Owns:** the "wait, why did I get this much?" interaction. Reference
material for analysis, not part of the live show.

## Firing-order diagram

```
hand → SCORE_HAND dispatched
        │
        ▼
core/phases/scoring.ts emits a sequence of `onScoreBeat` events
        │
        ▼
ScoreMoment (headless)  →  triggers scoringVFX (slam / target-beat / boom)
        │                                │
        ▼                                ▼
ScoreFloat (counter rises)        ScoringVFX (visual fireworks)
        │
        ▼
ScoreBreakdown (tweens chips/mult/chain)  → fades after FADE_OUT_MS
        │
        ▼
END_SCORING dispatched (after BOOM_FLY_START_MS + BOOM_FLY_MS)
        │
        ▼
round advances
        │
        ▼
ScoreExplain auto-collapses on onScoreCalculated
(player may re-open via in-HUD `?`)
```

## Overlap policy

| If this fires… | …it does NOT block | …it DOES collapse |
|---|---|---|
| `onScoreBeat` (slam) | anything | nothing |
| `onScoreBeat` (target-beat) | next slam | nothing |
| `onScoreBeat` (boom) | anything in current sequence | `ScoreExplain` (auto-close) |
| `onScoreBeat` (bail) | next sequence's `END_SCORING` for `BAIL_HOLD_MS` | `ScoreExplain` (auto-close) |
| `onScoreCalculated` | nothing | `ScoreExplain` (auto-close) |

No two of the four components paint into the same screen region — they
share the score area via *time slicing* (live counter → tweened
breakdown → settled value), not Z-stacking.

## Touch points if changing this surface

- Tween durations are in `ScoreBreakdown.tsx` (`MULT_TWEEN_MS`,
  `FADE_OUT_MS`).
- Boom/Bail handshake timing is in `ScoreMoment.tsx`
  (`BOOM_FLY_START_MS`, `BOOM_FLY_MS`, `BAIL_HOLD_MS`).
- Explosion celebration in `ScoreFloat.tsx` (`EXPLOSION_DURATION_MS`).
- VFX layer (`ScoringVFX.tsx` + `ScoringVFX.css`, ~714 + ~600 lines)
  owns the screen-shake / chromatic-aberration / vignette / god-rays
  treatments. It's a separate concern from the four components above;
  changes there affect the *style* of the show, not the *timing*.
