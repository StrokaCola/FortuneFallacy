# Satisfying Dice Scoring — Design Spec

**Date:** 2026-04-27
**Branch:** feat/dev-console
**Status:** Design approved, awaiting implementation plan

## Goal

Make the dice scoring sequence feel satisfying — buildable tension, rhythmic dopamine, decisive payoff. Replace the current single-shot `cascade → boom → fade` ScoreMoment with a Balatro-style itemized tally where each die contributes individually, multipliers slam in one at a time, and a running counter visibly climbs toward the round target.

## Core Decisions

| Decision | Choice |
|---|---|
| Structural pattern | Balatro-style itemized tally (per-die ticks → combo bonus → mult slams → boom) |
| Granularity | Per-die + full breakdown (~8–10 beats max) |
| Tension levers | Rising pitch + accelerating tempo + live running counter + bass rumble buildup + held-breath silence before boom |
| Length scaling | By score / target ratio: short <25%, mid 25–99%, full ≥100% |
| Skip | Smart length keeps it tight — no in-sequence skip |
| Layout | Cinematic dice spotlight, numbers fly off die into running counter |
| Target crossing | Counter color shift to gold + amplified mult slams after crossing |
| Failure | Mid-tier ceremony (no hold-breath, no overshoot reward). Last-hand impossibility bails mid-tally with "NOT ENOUGH" stamp |

## Architecture

```
scoring phase (core/phases/scoring.ts) — unchanged
   │   produces { totalChips, totalMult, chainMult, faces, comboLabel, mults[] }
   ▼
buildScoreSequence(scoreResult, ctx)             NEW MODULE
   │   src-next/core/scoring/sequence.ts
   │   pure fn → ScoreSequence { beats, tier, totalDurMs }
   │   decides tier, bakes timing curves, pitch indices, hold-breath, bail
   ▼
useScoreSequence(seq) hook drives single rAF loop
   │   emits beats on event bus when t crosses
   ▼
   ┌──────────────┬──────────────┬──────────────┐
   ScoreMoment    DiceScene      AudioEngine
   (counter,      (spotlight,    (SFX router
    mult slams,   float numbers  per beat kind)
    stamps)       off die)
```

Single beat list, three consumers, perfect A/V sync.

## Beat Schema

```ts
// src-next/core/scoring/types.ts
export type Beat =
  | { kind: 'cast-swell';   t: number }
  | { kind: 'die-tick';     t: number; dieIdx: number; face: number; chipDelta: number; runningTotal: number; pitchSemis: number }
  | { kind: 'combo-bonus';  t: number; comboLabel: string; chipDelta: number; runningTotal: number }
  | { kind: 'mult-slam';    t: number; label: string; multiplier: number; pitchSemis: number; ampScale: number }
  | { kind: 'cross-target'; t: number; runningTotal: number; target: number }
  | { kind: 'hold-breath';  t: number; durMs: number }
  | { kind: 'boom';         t: number; finalTotal: number; crossedTarget: boolean }
  | { kind: 'bail';         t: number; runningTotal: number; target: number };

export type ScoreSequence = {
  beats: Beat[];
  tier: 'short' | 'mid' | 'full';
  totalDurMs: number;
};
```

## Tier Rules

`ratio = result.finalTotal / ctx.target`

| Tier | Condition | Beats | Total Dur |
|---|---|---|---|
| short | ratio < 0.25 | swell + 5×die-tick (60ms gap) + boom | ~600ms |
| mid | 0.25 ≤ ratio < 1.0 | swell + 5×die-tick (140→80ms accel) + combo-bonus + mult-slam[…] + boom | ~1.8s |
| full | ratio ≥ 1.0 | swell + 5×die-tick (200→60ms accel) + combo-bonus + mult-slam[…] (450ms gaps) + cross-target + hold-breath 400ms + boom | ~2.8–3.5s |

Failure (counter never reaches target) caps at mid tier — no hold-breath, no overshoot gold. Player feels short.

## Sequence Builder

The current scoring phase (`core/phases/scoring.ts`) emits a single base+chainMult pair. The sequence builder needs an itemized mult list, so its input is an **adapted** view of the scoring output:

```ts
// src-next/core/scoring/types.ts
export type SequenceInput = {
  faces: number[];                          // dice face values used by combo, length usually 5
  comboLabel: string;                       // e.g. "FULL HOUSE"
  comboBonus: number;                       // chips added by combo (separate from face sum)
  mults: { label: string; value: number }[]; // ordered: combo mult first, chain mult last; future-proof for stacked multipliers
  finalTotal: number;                       // for tier ratio (matches existing scoring.ts result)
};

export type SequenceCtx = {
  target: number;                           // round target chips
  isLastHand: boolean;                      // last scoring hand of round
  maxRemaining: number;                     // max chips this hand could still produce if scoring stops now (used for last-hand bail check)
  reducedMotion: boolean;                   // from useMotion / prefers-reduced-motion
};

// adapter — lives next to sequence.ts, called by roll.ts after scoring phase
export function adaptScoringResult(result: ScoringResult): SequenceInput;

export function buildScoreSequence(
  input: SequenceInput,
  ctx: SequenceCtx
): ScoreSequence
```

**`maxRemaining`** definition: best-case chips the player could still produce from the dice currently uncommitted (caller computes from remaining dice + best possible combo bonus + max mult stack). Used only for last-hand impossibility check.

**Step 1 — early bail:** if `ctx.isLastHand && ctx.maxRemaining < ctx.target`, emit `[cast-swell, die-tick…, bail]` and return. Bail beat carries running total + target for "NOT ENOUGH" stamp.

**Step 2 — tier select:** by `ratio` per table above.

**Step 3 — emit beats:**

```ts
let t = 0;
push('cast-swell', { t });
t += 200;

const gaps = tier === 'full' ? lerp(200, 60, 5)
           : tier === 'mid'  ? lerp(140, 80, 5)
           :                   [60,60,60,60,60];
let running = 0;
const checkCross = (before: number) => {
  if (before < ctx.target && running >= ctx.target) {
    push('cross-target', { t: t + 80, runningTotal: running, target: ctx.target });
  }
};
for (let i = 0; i < input.faces.length; i++) {
  const before = running;
  running += input.faces[i];
  push('die-tick', { t, dieIdx: i, face: input.faces[i], chipDelta: input.faces[i],
                     runningTotal: running, pitchSemis: i });
  checkCross(before);
  t += gaps[i];
}

if (tier === 'short') {
  push('boom', { t: t+150, finalTotal: result.finalTotal, crossedTarget: false });
  return finalize();
}

{
  const before = running;
  running += input.comboBonus;
  push('combo-bonus', { t, comboLabel: input.comboLabel, chipDelta: input.comboBonus, runningTotal: running });
  checkCross(before);
  t += 300;
}

const multGap = tier === 'full' ? 450 : 250;
let multSemis = 12;
for (const m of input.mults) {
  const before = running;
  running = Math.round(running * m.value);
  push('mult-slam', { t, label: m.label, multiplier: m.value,
                      pitchSemis: multSemis, ampScale: 1 + (multSemis-12)*0.1 });
  checkCross(before);
  multSemis += 2;
  t += multGap;
}

if (tier === 'full') {
  push('hold-breath', { t, durMs: 400 });
  t += 400;
}

push('boom', { t, finalTotal: input.finalTotal, crossedTarget: running >= ctx.target });
```

**Reduced motion:** when `ctx.reducedMotion`, all tiers collapse to short variant (cast-swell + 5 die-ticks + boom). Audio still plays full per-beat audio palette.

## UI Consumers

### `useScoreSequence(seq)` hook

`src-next/app/hud/useScoreSequence.ts` — single rAF loop, emits beats on event bus when `performance.now() - start ≥ beat.t`. Cancels rAF on unmount or new sequence prop.

### `ScoreMoment.tsx` (refactor)

Subscribes to emitted beats. Renders:
- Combo name overlay — mounts on `combo-bonus`, fades 200ms
- Mult slam overlays — mount on `mult-slam`, scale-pop 180ms, color tinted gold once `cross-target` fired earlier
- Boom screen — existing `boomPop` keyframe, gain x1.2 if `crossedTarget`
- Stamps — "TARGET BEAT" on `cross-target`, "NOT ENOUGH" on `bail`
- Counter color — flips white→gold class on first `cross-target`

### DiceScene listener

Existing THREE/Pixi dice scene subscribes:
- `cast-swell`: dim non-scoring dice to 0.3 alpha
- `die-tick`: spotlight die at `dieIdx` (scale 1.15, glow 80ms-in / 200ms-out), spawn floating `+N` text from die world position toward counter via `Particles.tsx::floatNumberFromTo`
- `boom`: full-screen flash, restore alpha

### `Particles.tsx` extensions

- `floatNumberFromTo(from, to, value, color)` — flying number from die to counter
- `multSlamShockwave(scale)` — radial ring expansion, scaled by `ampScale`

### `ScoreFloat.tsx`

Already uses `--snap` CSS var for animated counter. Update target value on each beat with `runningTotal` field (ease-out 80ms). Toggle gold color class on `cross-target`.

## Audio Consumer

`src-next/audio/scoring.ts` (NEW) — registered by AudioEngine, subscribes `score:beat`:

```ts
const SEMI = 2 ** (1/12);
const BASE_HZ = 440;

case 'cast-swell':
  sfx.castSwell.trigger();
  buses.bass.gain.rampTo(0, 100);
  break;

case 'die-tick': {
  const hz = BASE_HZ * Math.pow(SEMI, b.pitchSemis);
  sfx.chipTick.trigger({ freq: hz, idx: b.dieIdx });
  buses.bass.gain.rampTo(-12 + b.dieIdx * 1.5, 60);
  break;
}

case 'combo-bonus':
  sfx.comboChime.trigger();
  break;

case 'mult-slam': {
  const hz = BASE_HZ * Math.pow(SEMI, b.pitchSemis);
  sfx.multSlam.trigger({ freq: hz, gain: b.ampScale });
  buses.impact.duck(120);
  break;
}

case 'cross-target':
  sfx.targetCross.trigger();
  buses.bass.gain.rampTo(0, 40);
  break;

case 'hold-breath':
  buses.master.gain.rampTo(-18, 80);
  break;

case 'boom':
  buses.master.gain.rampTo(0, 20);
  sfx.castBoom.trigger({ gain: b.crossedTarget ? 1.2 : 0.85 });
  buses.bass.gain.rampTo(-Infinity, 800);
  break;

case 'bail':
  sfx.notEnough.trigger();
  buses.bass.gain.rampTo(-Infinity, 200);
  break;
```

**New SFX entries** in `src-next/audio/sfx/`:
- `comboChime` — Tone FMSynth bell, +7 semis from base
- `multSlam` — MembraneSynth + impact bus send, configurable freq + gain
- `targetCross` — NoiseSynth filter sweep (HP 200→4000Hz) + sub MembraneSynth -24 semis
- `notEnough` — two-note FMSynth minor-third descend + low thud MembraneSynth

**chipTick** — extend existing entry with `freq` override param.

**Heat system** (`audio/heat.ts`) — listens `cross-target` to trigger heat-tier bump, carries dopamine into next round.

## Edge Cases

- **Zero-mult result** — empty `mults` array; loop skipped, hold-breath still fires for full tier.
- **Faces shorter than 5** — loop iterates `faces.length`; pitch index rises per actual die.
- **Concurrent sequences** — `useScoreSequence` cancels prior rAF on new seq prop. Audio bus fades existing rumble before new sequence starts.
- **Audio context locked** — `sfx.*.trigger()` no-ops safely (existing AudioEngine guard). Visuals play unaffected.
- **Non-last-hand miss** — mid-tier ends naturally without bail. Round HUD shows hands remaining.

## Testing

`vitest`:

- **`sequence.test.ts`**:
  - short tier: low-score input → exactly 7 beats (swell + 5 ticks + boom)
  - mid tier: ratio=0.5 → no hold-breath, no cross-target
  - full tier: ratio≥1 → includes hold-breath + cross-target
  - last-hand bail: `isLastHand=true, maxRemaining<target` → truncates to bail
  - cross-target placement: emitted on the FIRST beat that pushes running across target (die-tick, combo-bonus, or mult-slam), never twice
  - adapter: scoring.ts result with single chainMult correctly maps to mults=[{label:'mult', value:comboMult}, {label:'chain', value:chainMult}]
  - reduced-motion flag collapses all tiers to short
- **`useScoreSequence.test.ts`** — vitest fake timers, advance time, assert beat emission order matches `t`.

## Dev Console

`src-next/devtools/tabs/ScoringTab.tsx` (NEW):
- Tier badge (short / mid / full)
- Beat list table (kind, t, payload)
- "Replay" button — re-emits last beat list against bus
- "Force tier" toggle — full / mid / short override for next score (tuning)

## File Changes

**New**
- `src-next/core/scoring/sequence.ts`
- `src-next/core/scoring/types.ts`
- `src-next/app/hud/useScoreSequence.ts`
- `src-next/audio/scoring.ts`
- `src-next/audio/sfx/comboChime.ts`
- `src-next/audio/sfx/multSlam.ts`
- `src-next/audio/sfx/targetCross.ts`
- `src-next/audio/sfx/notEnough.ts`
- `src-next/devtools/tabs/ScoringTab.tsx`
- `src-next/core/scoring/sequence.test.ts`
- `src-next/app/hud/useScoreSequence.test.ts`

**Modified**
- `src-next/app/hud/ScoreMoment.tsx` — refactor to consume hook
- `src-next/app/hud/Particles.tsx` — add `floatNumberFromTo`, `multSlamShockwave`
- `src-next/app/hud/ScoreFloat.tsx` — gold color shift on cross-target
- `src-next/audio/AudioEngine.ts` — register scoring.ts subscriber
- `src-next/audio/sfx/chipTick.ts` — add freq override param
- `src-next/actions/handlers/roll.ts` — call `buildScoreSequence` after scoring phase, dispatch sequence to ScoreMoment
- `src-next/audio/heat.ts` — listen `cross-target` for heat bump

## Open Questions

None blocking implementation. Tuning constants (gaps, pitch base, bass ramp targets) start as listed and refine via dev console ScoringTab during playtest.
