# Satisfying Dice Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-shot ScoreMoment with a Balatro-style itemized tally — per-die ticks → combo bonus → mult slams → boom — driven by a tier-scaled beat-list sequence engine that audio, HUD, and dice scene all consume in sync.

**Architecture:** Pure function `buildScoreSequence(input, ctx) → Beat[]` decides tier (short/mid/full) by score-to-target ratio, bakes timing curves and pitch indices into beats. A single `useScoreSequence` rAF loop emits beats on the event bus. ScoreMoment, Particles, DiceScene, and AudioEngine each subscribe.

**Tech Stack:** TypeScript, React 18, Zustand, Tone.js, Howler, vitest. Existing `bus` (`src-next/events/bus.ts`) and `sfxPlay` (`src-next/audio/sfx/index.ts`) infra reused.

**Spec:** [docs/superpowers/specs/2026-04-27-satisfying-dice-scoring-design.md](../specs/2026-04-27-satisfying-dice-scoring-design.md)

---

## Task 1: Beat schema + event registration

**Files:**
- Create: `src-next/core/scoring/types.ts`
- Modify: `src-next/events/types.ts`

- [ ] **Step 1: Create beat schema file**

Write `src-next/core/scoring/types.ts`:

```ts
export type Beat =
  | { kind: 'cast-swell';   t: number }
  | { kind: 'die-tick';     t: number; dieIdx: number; face: number; chipDelta: number; runningTotal: number; pitchSemis: number }
  | { kind: 'combo-bonus';  t: number; comboLabel: string; chipDelta: number; runningTotal: number }
  | { kind: 'mult-slam';    t: number; label: string; multiplier: number; pitchSemis: number; ampScale: number }
  | { kind: 'cross-target'; t: number; runningTotal: number; target: number }
  | { kind: 'hold-breath';  t: number; durMs: number }
  | { kind: 'boom';         t: number; finalTotal: number; crossedTarget: boolean }
  | { kind: 'bail';         t: number; runningTotal: number; target: number };

export type SequenceTier = 'short' | 'mid' | 'full';

export type ScoreSequence = {
  beats: Beat[];
  tier: SequenceTier;
  totalDurMs: number;
};

export type SequenceInput = {
  faces: number[];
  comboLabel: string;
  comboBonus: number;
  mults: { label: string; value: number }[];
  finalTotal: number;
};

export type SequenceCtx = {
  target: number;
  isLastHand: boolean;
  maxRemaining: number;
  reducedMotion: boolean;
};
```

- [ ] **Step 2: Register beat event on game bus**

Modify `src-next/events/types.ts`. After the existing import, add at top of file (after line 1):

```ts
import type { Beat } from '../core/scoring/types';
```

In the `GameEventMap` type (currently lines 44–58), add this line above the closing `};`:

```ts
  onScoreBeat:         { beat: Beat };
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src-next/core/scoring/types.ts src-next/events/types.ts
git commit -m "feat(scoring): add Beat schema and onScoreBeat event"
```

---

## Task 2: Sequence builder — short tier (TDD)

**Files:**
- Create: `src-next/core/scoring/sequence.test.ts`
- Create: `src-next/core/scoring/sequence.ts`

- [ ] **Step 1: Write failing test for short tier**

Write `src-next/core/scoring/sequence.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildScoreSequence } from './sequence';
import type { SequenceInput, SequenceCtx } from './types';

const baseInput = (overrides: Partial<SequenceInput> = {}): SequenceInput => ({
  faces: [1, 1, 2, 2, 3],
  comboLabel: 'TWO_PAIR',
  comboBonus: 10,
  mults: [{ label: 'mult', value: 2 }, { label: 'chain', value: 1 }],
  finalTotal: 18,
  ...overrides,
});

const baseCtx = (overrides: Partial<SequenceCtx> = {}): SequenceCtx => ({
  target: 100,
  isLastHand: false,
  maxRemaining: 100,
  reducedMotion: false,
  ...overrides,
});

describe('buildScoreSequence — tier selection', () => {
  it('emits short tier when finalTotal/target < 0.25', () => {
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 18 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('short');
    // short tier: cast-swell + 5 die-ticks + boom = 7 beats
    expect(seq.beats).toHaveLength(7);
    expect(seq.beats[0]?.kind).toBe('cast-swell');
    expect(seq.beats[6]?.kind).toBe('boom');
    for (let i = 1; i <= 5; i++) {
      expect(seq.beats[i]?.kind).toBe('die-tick');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src-next/core/scoring/sequence.test.ts`
Expected: FAIL — `Cannot find module './sequence'` or similar.

- [ ] **Step 3: Implement minimal sequence builder for short tier**

Write `src-next/core/scoring/sequence.ts`:

```ts
import type { Beat, ScoreSequence, SequenceCtx, SequenceInput, SequenceTier } from './types';

function pickTier(input: SequenceInput, ctx: SequenceCtx): SequenceTier {
  if (ctx.reducedMotion) return 'short';
  const ratio = input.finalTotal / Math.max(1, ctx.target);
  if (ratio >= 1) return 'full';
  if (ratio < 0.25) return 'short';
  return 'mid';
}

function lerpGaps(from: number, to: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(Math.round(from + (to - from) * (i / Math.max(1, n - 1))));
  }
  return out;
}

export function buildScoreSequence(
  input: SequenceInput,
  ctx: SequenceCtx,
): ScoreSequence {
  const tier = pickTier(input, ctx);
  const beats: Beat[] = [];
  let t = 0;
  let running = 0;

  beats.push({ kind: 'cast-swell', t });
  t += 200;

  const gaps = tier === 'full' ? lerpGaps(200, 60, input.faces.length)
             : tier === 'mid'  ? lerpGaps(140, 80, input.faces.length)
             :                   input.faces.map(() => 60);

  for (let i = 0; i < input.faces.length; i++) {
    running += input.faces[i]!;
    beats.push({
      kind: 'die-tick',
      t,
      dieIdx: i,
      face: input.faces[i]!,
      chipDelta: input.faces[i]!,
      runningTotal: running,
      pitchSemis: i,
    });
    t += gaps[i]!;
  }

  if (tier === 'short') {
    t += 150;
    beats.push({ kind: 'boom', t, finalTotal: input.finalTotal, crossedTarget: false });
    return { beats, tier, totalDurMs: t };
  }

  // mid + full handled in subsequent tasks
  beats.push({ kind: 'boom', t, finalTotal: input.finalTotal, crossedTarget: false });
  return { beats, tier, totalDurMs: t };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src-next/core/scoring/sequence.test.ts`
Expected: PASS, 1 test green.

- [ ] **Step 5: Commit**

```bash
git add src-next/core/scoring/sequence.ts src-next/core/scoring/sequence.test.ts
git commit -m "feat(scoring): sequence builder short tier"
```

---

## Task 3: Sequence builder — mid tier (combo-bonus + mult-slams)

**Files:**
- Modify: `src-next/core/scoring/sequence.test.ts`
- Modify: `src-next/core/scoring/sequence.ts`

- [ ] **Step 1: Add failing test for mid tier**

Append to `src-next/core/scoring/sequence.test.ts` inside the `describe` block:

```ts
  it('emits mid tier when 0.25 <= ratio < 1.0', () => {
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 50, comboBonus: 10, mults: [{ label: 'mult', value: 2 }, { label: 'chain', value: 1 }] }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('mid');
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).toContain('combo-bonus');
    expect(kinds.filter((k) => k === 'mult-slam')).toHaveLength(2);
    expect(kinds).not.toContain('hold-breath');
    expect(kinds[kinds.length - 1]).toBe('boom');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src-next/core/scoring/sequence.test.ts`
Expected: FAIL — mid test fails because combo-bonus and mult-slam beats not emitted.

- [ ] **Step 3: Add combo-bonus + mult-slam emission**

In `src-next/core/scoring/sequence.ts`, replace the block starting `if (tier === 'short')` through the end of `buildScoreSequence` with:

```ts
  if (tier === 'short') {
    t += 150;
    beats.push({ kind: 'boom', t, finalTotal: input.finalTotal, crossedTarget: false });
    return { beats, tier, totalDurMs: t };
  }

  running += input.comboBonus;
  beats.push({
    kind: 'combo-bonus',
    t,
    comboLabel: input.comboLabel,
    chipDelta: input.comboBonus,
    runningTotal: running,
  });
  t += 300;

  const multGap = tier === 'full' ? 450 : 250;
  let multSemis = 12;
  for (const m of input.mults) {
    running = Math.round(running * m.value);
    beats.push({
      kind: 'mult-slam',
      t,
      label: m.label,
      multiplier: m.value,
      pitchSemis: multSemis,
      ampScale: 1 + (multSemis - 12) * 0.1,
    });
    multSemis += 2;
    t += multGap;
  }

  beats.push({ kind: 'boom', t, finalTotal: input.finalTotal, crossedTarget: running >= ctx.target });
  return { beats, tier, totalDurMs: t };
}
```

- [ ] **Step 4: Run tests to verify both pass**

Run: `npx vitest run src-next/core/scoring/sequence.test.ts`
Expected: PASS, 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add src-next/core/scoring/sequence.ts src-next/core/scoring/sequence.test.ts
git commit -m "feat(scoring): sequence builder mid tier with combo+mults"
```

---

## Task 4: Sequence builder — full tier with hold-breath + cross-target

**Files:**
- Modify: `src-next/core/scoring/sequence.test.ts`
- Modify: `src-next/core/scoring/sequence.ts`

- [ ] **Step 1: Add failing tests for full tier and cross-target**

Append to `describe` block in `src-next/core/scoring/sequence.test.ts`:

```ts
  it('emits full tier with hold-breath when ratio >= 1.0', () => {
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 200, comboBonus: 25, mults: [{ label: 'mult', value: 3 }, { label: 'chain', value: 2 }] }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('full');
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).toContain('hold-breath');
    expect(kinds).toContain('cross-target');
    // hold-breath sits between last mult-slam (or cross-target) and boom
    const breathIdx = kinds.indexOf('hold-breath');
    const boomIdx = kinds.indexOf('boom');
    expect(breathIdx).toBeLessThan(boomIdx);
  });

  it('emits cross-target on the FIRST beat that crosses target, never twice', () => {
    const seq = buildScoreSequence(
      baseInput({
        faces: [10, 10, 10, 10, 10],         // running after dice = 50
        comboBonus: 60,                      // running after combo = 110, crosses target=100
        mults: [{ label: 'mult', value: 3 }],
        finalTotal: 330,
      }),
      baseCtx({ target: 100 }),
    );
    const crossings = seq.beats.filter((b) => b.kind === 'cross-target');
    expect(crossings).toHaveLength(1);
    // beat just BEFORE cross-target should be combo-bonus (the one that crossed)
    const idx = seq.beats.findIndex((b) => b.kind === 'cross-target');
    expect(seq.beats[idx - 1]?.kind).toBe('combo-bonus');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src-next/core/scoring/sequence.test.ts`
Expected: FAIL — full tier missing hold-breath, cross-target not emitted.

- [ ] **Step 3: Add cross-target check + hold-breath**

In `src-next/core/scoring/sequence.ts`, replace the entire `buildScoreSequence` body with:

```ts
export function buildScoreSequence(
  input: SequenceInput,
  ctx: SequenceCtx,
): ScoreSequence {
  const tier = pickTier(input, ctx);
  const beats: Beat[] = [];
  let t = 0;
  let running = 0;
  let crossEmitted = false;

  const checkCross = (beforeRunning: number) => {
    if (!crossEmitted && beforeRunning < ctx.target && running >= ctx.target) {
      beats.push({ kind: 'cross-target', t: t + 80, runningTotal: running, target: ctx.target });
      crossEmitted = true;
    }
  };

  beats.push({ kind: 'cast-swell', t });
  t += 200;

  const gaps = tier === 'full' ? lerpGaps(200, 60, input.faces.length)
             : tier === 'mid'  ? lerpGaps(140, 80, input.faces.length)
             :                   input.faces.map(() => 60);

  for (let i = 0; i < input.faces.length; i++) {
    const before = running;
    running += input.faces[i]!;
    beats.push({
      kind: 'die-tick',
      t,
      dieIdx: i,
      face: input.faces[i]!,
      chipDelta: input.faces[i]!,
      runningTotal: running,
      pitchSemis: i,
    });
    checkCross(before);
    t += gaps[i]!;
  }

  if (tier === 'short') {
    t += 150;
    beats.push({ kind: 'boom', t, finalTotal: input.finalTotal, crossedTarget: running >= ctx.target });
    return { beats, tier, totalDurMs: t };
  }

  {
    const before = running;
    running += input.comboBonus;
    beats.push({
      kind: 'combo-bonus',
      t,
      comboLabel: input.comboLabel,
      chipDelta: input.comboBonus,
      runningTotal: running,
    });
    checkCross(before);
    t += 300;
  }

  const multGap = tier === 'full' ? 450 : 250;
  let multSemis = 12;
  for (const m of input.mults) {
    const before = running;
    running = Math.round(running * m.value);
    beats.push({
      kind: 'mult-slam',
      t,
      label: m.label,
      multiplier: m.value,
      pitchSemis: multSemis,
      ampScale: 1 + (multSemis - 12) * 0.1,
    });
    checkCross(before);
    multSemis += 2;
    t += multGap;
  }

  if (tier === 'full') {
    beats.push({ kind: 'hold-breath', t, durMs: 400 });
    t += 400;
  }

  beats.push({ kind: 'boom', t, finalTotal: input.finalTotal, crossedTarget: running >= ctx.target });
  return { beats, tier, totalDurMs: t };
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run src-next/core/scoring/sequence.test.ts`
Expected: PASS, 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src-next/core/scoring/sequence.ts src-next/core/scoring/sequence.test.ts
git commit -m "feat(scoring): full tier with hold-breath and cross-target"
```

---

## Task 5: Sequence builder — last-hand bail + reduced motion

**Files:**
- Modify: `src-next/core/scoring/sequence.test.ts`
- Modify: `src-next/core/scoring/sequence.ts`

- [ ] **Step 1: Add failing tests for bail and reduced motion**

Append to `describe` block:

```ts
  it('emits bail beat on last hand when target is mathematically out of reach', () => {
    const seq = buildScoreSequence(
      baseInput({ faces: [1, 1, 1, 1, 1], comboBonus: 0, mults: [], finalTotal: 5 }),
      baseCtx({ target: 100, isLastHand: true, maxRemaining: 5 }),
    );
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).toContain('bail');
    expect(kinds).not.toContain('boom');
    // bail terminates sequence
    expect(kinds[kinds.length - 1]).toBe('bail');
  });

  it('does NOT bail on non-last hand even if target out of reach', () => {
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 5 }),
      baseCtx({ target: 100, isLastHand: false, maxRemaining: 5 }),
    );
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).not.toContain('bail');
  });

  it('reduced motion collapses all tiers to short', () => {
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 5000 }),  // would be full normally
      baseCtx({ target: 100, reducedMotion: true }),
    );
    expect(seq.tier).toBe('short');
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).not.toContain('mult-slam');
    expect(kinds).not.toContain('hold-breath');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src-next/core/scoring/sequence.test.ts`
Expected: FAIL — bail not implemented.

- [ ] **Step 3: Add bail logic at top of buildScoreSequence**

In `src-next/core/scoring/sequence.ts`, immediately after the line `let crossEmitted = false;`, insert:

```ts
  if (ctx.isLastHand && ctx.maxRemaining < ctx.target) {
    beats.push({ kind: 'cast-swell', t });
    t += 200;
    let bailRunning = 0;
    for (let i = 0; i < input.faces.length; i++) {
      bailRunning += input.faces[i]!;
      beats.push({
        kind: 'die-tick',
        t,
        dieIdx: i,
        face: input.faces[i]!,
        chipDelta: input.faces[i]!,
        runningTotal: bailRunning,
        pitchSemis: i,
      });
      t += 60;
    }
    t += 200;
    beats.push({ kind: 'bail', t, runningTotal: bailRunning, target: ctx.target });
    return { beats, tier, totalDurMs: t };
  }
```

(Reduced motion is already handled by `pickTier` returning 'short' when `ctx.reducedMotion`.)

- [ ] **Step 4: Run all sequence tests**

Run: `npx vitest run src-next/core/scoring/sequence.test.ts`
Expected: PASS, 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src-next/core/scoring/sequence.ts src-next/core/scoring/sequence.test.ts
git commit -m "feat(scoring): last-hand bail + reduced motion handling"
```

---

## Task 6: Adapter — convert current ScoringResult to SequenceInput

**Files:**
- Create: `src-next/core/scoring/adapter.ts`
- Create: `src-next/core/scoring/adapter.test.ts`

- [ ] **Step 1: Inspect existing scoring output shape**

Read `src-next/core/pipeline/types.ts` and `src-next/core/phases/scoring.ts` to confirm fields. The pipeline ctx after `scoring` phase carries: `ctx.combo` (id + tier), `ctx.chips`, `ctx.mult`, `ctx.chain` ({ len, tier, mult, broke }), `ctx.total`, and the current dice via `ctx.state.round.dice`.

- [ ] **Step 2: Write failing adapter test**

Write `src-next/core/scoring/adapter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { adaptScoringContext } from './adapter';

describe('adaptScoringContext', () => {
  it('converts pipeline ctx to SequenceInput with itemized mults', () => {
    const fakeCtx = {
      combo: { id: 'full_house', tier: 5 },
      chips: 50,
      mult: 4,
      chain: { mult: 2 },
      total: 400,
      state: { round: { dice: [{ face: 6 }, { face: 6 }, { face: 6 }, { face: 5 }, { face: 5 }] } },
      faceSum: 28,
    } as any;
    const input = adaptScoringContext(fakeCtx);
    expect(input.faces).toEqual([6, 6, 6, 5, 5]);
    expect(input.comboLabel).toBe('FULL_HOUSE');
    expect(input.comboBonus).toBe(50 - 28);     // chips minus face sum = combo bonus
    expect(input.mults).toEqual([
      { label: 'mult', value: 4 },
      { label: 'chain', value: 2 },
    ]);
    expect(input.finalTotal).toBe(400);
  });

  it('omits chain mult when value is 1 (no chain bonus)', () => {
    const fakeCtx = {
      combo: { id: 'one_pair', tier: 1 },
      chips: 12,
      mult: 1.5,
      chain: { mult: 1 },
      total: 18,
      state: { round: { dice: [{ face: 4 }, { face: 4 }, { face: 1 }, { face: 1 }, { face: 2 }] } },
      faceSum: 12,
    } as any;
    const input = adaptScoringContext(fakeCtx);
    expect(input.mults).toEqual([{ label: 'mult', value: 1.5 }]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src-next/core/scoring/adapter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement adapter**

Write `src-next/core/scoring/adapter.ts`:

```ts
import type { SequenceInput } from './types';

type MinimalScoringCtx = {
  combo: { id: string; tier: number } | null;
  chips: number;
  mult: number;
  chain: { mult: number };
  total: number;
  state: { round: { dice: Array<{ face: number }> } };
};

export function adaptScoringContext(ctx: MinimalScoringCtx): SequenceInput {
  const faces = ctx.state.round.dice.map((d) => d.face);
  const faceSum = faces.reduce((a, b) => a + b, 0);
  const comboBonus = Math.max(0, ctx.chips - faceSum);
  const comboLabel = (ctx.combo?.id ?? 'CHANCE').toUpperCase();
  const mults: SequenceInput['mults'] = [];
  if (ctx.mult !== 1) mults.push({ label: 'mult', value: ctx.mult });
  if (ctx.chain.mult !== 1) mults.push({ label: 'chain', value: ctx.chain.mult });
  return {
    faces,
    comboLabel,
    comboBonus,
    mults,
    finalTotal: ctx.total,
  };
}
```

- [ ] **Step 5: Run adapter tests**

Run: `npx vitest run src-next/core/scoring/adapter.test.ts`
Expected: PASS, 2 tests green.

- [ ] **Step 6: Commit**

```bash
git add src-next/core/scoring/adapter.ts src-next/core/scoring/adapter.test.ts
git commit -m "feat(scoring): adapter from pipeline ctx to SequenceInput"
```

---

## Task 7: useScoreSequence hook (TDD with fake timers)

**Files:**
- Create: `src-next/app/hud/useScoreSequence.ts`
- Create: `src-next/app/hud/useScoreSequence.test.ts`

- [ ] **Step 1: Write failing hook test**

Write `src-next/app/hud/useScoreSequence.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { runScoreSequence } from './useScoreSequence';
import type { ScoreSequence } from '../../core/scoring/types';

describe('runScoreSequence', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('emits beats in order at correct times', () => {
    const seq: ScoreSequence = {
      tier: 'short',
      totalDurMs: 800,
      beats: [
        { kind: 'cast-swell', t: 0 },
        { kind: 'die-tick', t: 200, dieIdx: 0, face: 5, chipDelta: 5, runningTotal: 5, pitchSemis: 0 },
        { kind: 'boom', t: 800, finalTotal: 25, crossedTarget: false },
      ],
    };
    const emitted: string[] = [];
    const stop = runScoreSequence(seq, (b) => emitted.push(b.kind));

    // initial frame should fire t=0 beat
    vi.advanceTimersByTime(20);
    expect(emitted).toEqual(['cast-swell']);

    vi.advanceTimersByTime(220);
    expect(emitted).toEqual(['cast-swell', 'die-tick']);

    vi.advanceTimersByTime(700);
    expect(emitted).toEqual(['cast-swell', 'die-tick', 'boom']);

    stop();
  });

  it('stop() cancels pending beats', () => {
    const seq: ScoreSequence = {
      tier: 'short',
      totalDurMs: 800,
      beats: [
        { kind: 'cast-swell', t: 0 },
        { kind: 'boom', t: 800, finalTotal: 0, crossedTarget: false },
      ],
    };
    const emitted: string[] = [];
    const stop = runScoreSequence(seq, (b) => emitted.push(b.kind));
    vi.advanceTimersByTime(20);
    stop();
    vi.advanceTimersByTime(2000);
    expect(emitted).toEqual(['cast-swell']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src-next/app/hud/useScoreSequence.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement runScoreSequence + useScoreSequence**

Write `src-next/app/hud/useScoreSequence.ts`:

```ts
import { useEffect } from 'react';
import type { Beat, ScoreSequence } from '../../core/scoring/types';
import { bus } from '../../events/bus';

export type BeatHandler = (beat: Beat) => void;

export function runScoreSequence(seq: ScoreSequence, onBeat: BeatHandler): () => void {
  const start = performance.now();
  let i = 0;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = () => {
    if (cancelled) return;
    const t = performance.now() - start;
    while (i < seq.beats.length && seq.beats[i]!.t <= t) {
      onBeat(seq.beats[i++]!);
    }
    if (i < seq.beats.length) {
      const next = seq.beats[i]!.t;
      const wait = Math.max(0, next - (performance.now() - start));
      timer = setTimeout(tick, wait);
    }
  };
  timer = setTimeout(tick, 0);

  return () => {
    cancelled = true;
    if (timer != null) clearTimeout(timer);
  };
}

export function useScoreSequence(seq: ScoreSequence | null): void {
  useEffect(() => {
    if (!seq) return;
    return runScoreSequence(seq, (beat) => bus.emit('onScoreBeat', { beat }));
  }, [seq]);
}
```

- [ ] **Step 4: Run hook test**

Run: `npx vitest run src-next/app/hud/useScoreSequence.test.ts`
Expected: PASS, 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add src-next/app/hud/useScoreSequence.ts src-next/app/hud/useScoreSequence.test.ts
git commit -m "feat(hud): runScoreSequence emits beats on timer"
```

---

## Task 8: New SFX voice — multSlam

**Files:**
- Modify: `src-next/audio/sfx/voices.ts`
- Modify: `src-next/audio/sfx/index.ts`

- [ ] **Step 1: Inspect existing castBoom voice for pattern**

Read `src-next/audio/sfx/voices.ts` and find the existing `castBoom` function (search the file for `castBoom`). The new `multSlam` will mirror it: MembraneSynth on impact bus, accepts `{ freq, gain }` opts.

- [ ] **Step 2: Add multSlam voice**

In `src-next/audio/sfx/voices.ts`, after the existing `castBoom` export, add:

```ts
// ---- multSlam ---------------------------------------------------------------
export function multSlam(bank: SynthBank, opts: VoiceOpts & { freq?: number; gain?: number } = {}): void {
  const t = jitteredTime();
  const hz = opts.freq ?? 220;
  const gain = opts.gain ?? 1;
  // reuse castBoom synth but pitched + gain-scaled
  bank.castBoom.body.volume.value = vol('multSlam', -10 + Math.log2(gain) * 6);
  bank.castBoom.body.triggerAttackRelease(hz, '16n', t);
  triggerDuck('impact', 0.12);
}
```

- [ ] **Step 3: Add comboChime voice**

In the same file, after `multSlam`:

```ts
// ---- comboChime -------------------------------------------------------------
export function comboChime(bank: SynthBank): void {
  const t = jitteredTime();
  const root = pickPent(7) * centsToRatio(jitterCents());
  bank.lockTap.ping.volume.value = vol('comboChime', -14);
  bank.lockTap.ping.triggerAttackRelease(root, '8n', t);
  bank.lockTap.ping.triggerAttackRelease(root * 1.5, '8n', t + 0.04);
}
```

- [ ] **Step 4: Add targetCross voice**

Append:

```ts
// ---- targetCross ------------------------------------------------------------
export function targetCross(bank: SynthBank): void {
  const t = jitteredTime();
  // bright sweep + sub chime — reuse rerollPool sweep + lockTap ping for low-cost stand-in
  const slot = bank.rerollPool[bank.rerollIdx.i % bank.rerollPool.length]!;
  bank.rerollIdx.i++;
  slot.sweep.volume.value = vol('targetSweep', -16);
  slot.sweep.triggerAttackRelease('4n', t);
  bank.lockTap.ping.volume.value = vol('targetSubChime', -10);
  bank.lockTap.ping.triggerAttackRelease(110, '4n', t + 0.02);
}
```

- [ ] **Step 5: Add notEnough voice**

Append:

```ts
// ---- notEnough --------------------------------------------------------------
export function notEnough(bank: SynthBank): void {
  const t = jitteredTime();
  bank.lockTap.ping.volume.value = vol('notEnough', -14);
  bank.lockTap.ping.triggerAttackRelease(220, '4n', t);
  bank.lockTap.ping.triggerAttackRelease(174.6, '4n', t + 0.18); // minor third descent
  bank.castBoom.body.volume.value = vol('notEnoughThud', -16);
  bank.castBoom.body.triggerAttackRelease(80, '8n', t + 0.32);
}
```

- [ ] **Step 6: Add chipTick freq override (extend existing)**

Find the existing `chipTick` export in `voices.ts`. Modify its signature and body to accept an optional `freq`:

```ts
// look for existing signature
export function chipTick(bank: SynthBank, opts: VoiceOpts & { freq?: number } = {}): void {
  const t = jitteredTime();
  const idx = opts.idx ?? 0;
  const freq = opts.freq ?? pickPent(idx + 4);   // existing pent fallback if no override
  // ... existing body, replace any hardcoded note arg with `freq`
}
```

(Adapt actual implementation to existing — only change is accepting `freq` and routing it into the synth's `triggerAttackRelease` first arg.)

- [ ] **Step 7: Register new sfx ids in index.ts**

Modify `src-next/audio/sfx/index.ts`. Update the `SfxId` union (line 6–9) to include the four new ids:

```ts
export type SfxId =
  | 'diceClack' | 'lockTap' | 'reroll' | 'buy'
  | 'combo' | 'upgrade' | 'bossSting' | 'bigScore' | 'win' | 'bust'
  | 'chipTick' | 'castSwell' | 'castBoom' | 'sigilDraw' | 'cardFlip' | 'nodePulse' | 'transitionWipe'
  | 'multSlam' | 'comboChime' | 'targetCross' | 'notEnough';
```

Update `SfxOpts` to include freq + gain:

```ts
export type SfxOpts = { tier?: number; volume?: number; idx?: number; freq?: number; gain?: number };
```

In the `sfxPlay` switch (line 58–76), add cases:

```ts
      case 'multSlam':        v.multSlam(bank as never, opts); break;
      case 'comboChime':      v.comboChime(bank as never); break;
      case 'targetCross':     v.targetCross(bank as never); break;
      case 'notEnough':       v.notEnough(bank as never); break;
```

(Update the case for `chipTick` to pass opts unchanged — already does via `opts`.)

- [ ] **Step 8: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 9: Run existing sfx tests to ensure no regression**

Run: `npx vitest run src-next/audio/sfx/__tests__`
Expected: all existing tests still pass.

- [ ] **Step 10: Commit**

```bash
git add src-next/audio/sfx/voices.ts src-next/audio/sfx/index.ts
git commit -m "feat(sfx): multSlam, comboChime, targetCross, notEnough voices"
```

---

## Task 9: Audio scoring router — wire beats to SFX

**Files:**
- Create: `src-next/audio/scoring.ts`
- Modify: `src-next/audio/AudioEngine.ts`

- [ ] **Step 1: Locate AudioEngine init point**

Read `src-next/audio/AudioEngine.ts`. Find where it subscribes to bus events or calls `sfxInit`. The new `installScoringRouter` will be called from there.

- [ ] **Step 2: Write the scoring router**

Write `src-next/audio/scoring.ts`:

```ts
import { bus } from '../events/bus';
import { sfxPlay } from './sfx';

const SEMI = Math.pow(2, 1 / 12);
const BASE_HZ = 440;

export function installScoringRouter(): () => void {
  return bus.on('onScoreBeat', ({ beat }) => {
    switch (beat.kind) {
      case 'cast-swell':
        sfxPlay('castSwell');
        break;
      case 'die-tick': {
        const hz = BASE_HZ * Math.pow(SEMI, beat.pitchSemis);
        sfxPlay('chipTick', { idx: beat.dieIdx, freq: hz });
        break;
      }
      case 'combo-bonus':
        sfxPlay('comboChime');
        break;
      case 'mult-slam': {
        const hz = BASE_HZ * Math.pow(SEMI, beat.pitchSemis);
        sfxPlay('multSlam', { freq: hz, gain: beat.ampScale });
        break;
      }
      case 'cross-target':
        sfxPlay('targetCross');
        break;
      case 'hold-breath':
        // master duck handled in AudioEngine if exposed; otherwise no-op for SFX
        break;
      case 'boom':
        sfxPlay('castBoom', { volume: beat.crossedTarget ? 1.2 : 0.85 });
        break;
      case 'bail':
        sfxPlay('notEnough');
        break;
    }
  });
}
```

- [ ] **Step 3: Wire into AudioEngine init**

Modify `src-next/audio/AudioEngine.ts`. Add import at top:

```ts
import { installScoringRouter } from './scoring';
```

Find the engine's init / start method (likely a function exporting `audioEngineInit` or similar). Add inside its body, after `sfxInit()` resolves:

```ts
installScoringRouter();
```

(If the engine returns a teardown, store the unsubscribe function from `installScoringRouter()` and call it on teardown.)

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src-next/audio/scoring.ts src-next/audio/AudioEngine.ts
git commit -m "feat(audio): scoring beat router wires beats to SFX bank"
```

---

## Task 10: Particles — floatNumberFromTo + multSlamShockwave

**Files:**
- Modify: `src-next/app/hud/Particles.tsx`

- [ ] **Step 1: Add new effect types and listener**

Modify `src-next/app/hud/Particles.tsx`. After the existing `FloatText` type (line 5), add:

```ts
type Shock = { id: number; x: number; y: number; scale: number };
type FlyNum = { id: number; fromX: number; fromY: number; toX: number; toY: number; text: string; color: string };
```

In the `Particles` component state, add alongside `floats`:

```ts
const [shocks, setShocks] = useState<Shock[]>([]);
const [flies, setFlies] = useState<FlyNum[]>([]);
```

- [ ] **Step 2: Subscribe to onScoreBeat**

Inside the existing `useEffect` (after `off3 = bus.on('onUpgradeTriggered'...)`), add:

```ts
const off4 = bus.on('onScoreBeat', ({ beat }) => {
  if (beat.kind === 'mult-slam') {
    const id = nextId++;
    const x = window.innerWidth / 2;
    const y = window.innerHeight / 2;
    setShocks((s) => [...s, { id, x, y, scale: beat.ampScale }]);
    setTimeout(() => setShocks((s) => s.filter((v) => v.id !== id)), 600);
  }
  if (beat.kind === 'die-tick') {
    const id = nextId++;
    const counterEl = document.querySelector('[data-score-counter]') as HTMLElement | null;
    const r = counterEl?.getBoundingClientRect();
    const toX = r ? r.left + r.width / 2 : window.innerWidth / 2;
    const toY = r ? r.top + r.height / 2 : 80;
    // approximate die position by index across bottom of screen
    const fromX = window.innerWidth * (0.2 + 0.15 * beat.dieIdx);
    const fromY = window.innerHeight * 0.65;
    setFlies((f) => [...f, { id, fromX, fromY, toX, toY, text: `+${beat.chipDelta}`, color: '#7be3ff' }]);
    setTimeout(() => setFlies((f) => f.filter((v) => v.id !== id)), 600);
  }
});
```

Update the cleanup return: `return () => { off1(); off2(); off3(); off4(); };`

- [ ] **Step 3: Render Shock and FlyNum elements**

Inside the returned JSX wrapper div, alongside the existing `bursts.map` and `floats.map` calls, add:

```tsx
{shocks.map((s) => (
  <Shockwave key={s.id} x={s.x} y={s.y} scale={s.scale} />
))}
{flies.map((f) => (
  <FlyingNumber key={f.id} from={{ x: f.fromX, y: f.fromY }} to={{ x: f.toX, y: f.toY }} text={f.text} color={f.color} />
))}
```

At the bottom of the file, after the existing `FloatPop` component, add:

```tsx
function Shockwave({ x, y, scale }: { x: number; y: number; scale: number }) {
  const size = 80 * scale;
  return (
    <div style={{
      position: 'absolute',
      left: x - size / 2, top: y - size / 2,
      width: size, height: size, borderRadius: '50%',
      border: '2px solid #ff7847', boxShadow: `0 0 32px #ff7847`,
      animation: 'ringExpand 0.6s ease-out forwards',
    }} />
  );
}

function FlyingNumber({ from, to, text, color }: { from: { x: number; y: number }; to: { x: number; y: number }; text: string; color: string }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (
    <div style={{
      position: 'absolute',
      left: from.x, top: from.y,
      color, fontFamily: '"Cinzel Decorative", serif',
      fontSize: 24, fontWeight: 700,
      textShadow: `0 0 10px ${color}`,
      // CSS variable trick — keyframe in app.css references --dx/--dy
      ['--dx' as never]: `${dx}px`,
      ['--dy' as never]: `${dy}px`,
      animation: 'flyToCounter 0.55s ease-in forwards',
    }}>{text}</div>
  );
}
```

- [ ] **Step 4: Add CSS keyframe**

Find the global stylesheet that defines `ringExpand` and `floatUp` (likely `src-next/app/styles.css` or similar — search the repo for `@keyframes ringExpand`). Append:

```css
@keyframes flyToCounter {
  0%   { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--dx, 0), var(--dy, 0)) scale(0.5); opacity: 0; }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src-next/app/hud/Particles.tsx src-next/app/styles.css
git commit -m "feat(hud): shockwave + flying number particles for score beats"
```

---

## Task 11: Refactor ScoreMoment to consume beat stream

**Files:**
- Modify: `src-next/app/hud/ScoreMoment.tsx`

- [ ] **Step 1: Replace FSM with beat-driven render state**

Rewrite `src-next/app/hud/ScoreMoment.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { dispatch } from '../../actions/dispatch';
import type { Beat } from '../../core/scoring/types';

type SlamOverlay = { id: number; label: string; multiplier: number; gold: boolean };

let slamId = 1;

export function ScoreMoment() {
  const [active, setActive] = useState(false);
  const [comboName, setComboName] = useState('');
  const [slams, setSlams] = useState<SlamOverlay[]>([]);
  const [stamp, setStamp] = useState<'target' | 'bail' | null>(null);
  const [boom, setBoom] = useState<{ total: number; gold: boolean } | null>(null);

  useEffect(() => {
    let crossed = false;
    const off = bus.on('onScoreBeat', ({ beat }: { beat: Beat }) => {
      switch (beat.kind) {
        case 'cast-swell':
          setActive(true);
          setComboName('');
          setSlams([]);
          setStamp(null);
          setBoom(null);
          crossed = false;
          break;
        case 'combo-bonus':
          setComboName(beat.comboLabel);
          break;
        case 'mult-slam': {
          const id = slamId++;
          setSlams((s) => [...s, { id, label: beat.label, multiplier: beat.multiplier, gold: crossed }]);
          setTimeout(() => setSlams((s) => s.filter((x) => x.id !== id)), 600);
          break;
        }
        case 'cross-target':
          crossed = true;
          setStamp('target');
          setTimeout(() => setStamp((cur) => (cur === 'target' ? null : cur)), 700);
          break;
        case 'boom':
          setBoom({ total: beat.finalTotal, gold: beat.crossedTarget });
          setTimeout(() => {
            setActive(false);
            setBoom(null);
            dispatch({ type: 'END_SCORING' });
          }, 1100);
          break;
        case 'bail':
          setStamp('bail');
          setTimeout(() => {
            setActive(false);
            setStamp(null);
            dispatch({ type: 'END_SCORING' });
          }, 1200);
          break;
      }
    });
    return () => off();
  }, []);

  if (!active) return null;

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {comboName && (
        <div className="f-display" style={{
          fontSize: 32, color: '#f5c451',
          textShadow: '0 0 24px rgba(245,196,81,0.7)',
          letterSpacing: '0.18em', marginBottom: 18,
          animation: 'chipPop 200ms ease-out',
        }}>
          {comboName}
        </div>
      )}
      <div style={{ display: 'flex', gap: 18, marginBottom: 18 }}>
        {slams.map((s) => (
          <div key={s.id} className="f-mono" style={{
            padding: '8px 18px', borderRadius: 8,
            background: s.gold ? '#f5c45120' : '#ff784720',
            border: `2px solid ${s.gold ? '#f5c451' : '#ff7847'}`,
            color: s.gold ? '#f5c451' : '#ff7847',
            fontSize: 28, fontWeight: 700,
            boxShadow: `0 0 24px ${s.gold ? '#f5c451' : '#ff7847'}`,
            animation: 'boomPop 250ms cubic-bezier(0.2, 1.4, 0.5, 1)',
          }}>
            ×{s.multiplier}
          </div>
        ))}
      </div>
      {stamp === 'target' && (
        <div style={{
          position: 'absolute', top: '32%',
          fontFamily: '"Cinzel Decorative", serif', fontSize: 48, fontWeight: 900,
          color: '#f5c451', letterSpacing: '0.2em',
          textShadow: '0 0 30px #f5c451',
          animation: 'boomPop 350ms cubic-bezier(0.2, 1.6, 0.5, 1)',
        }}>TARGET BEAT</div>
      )}
      {stamp === 'bail' && (
        <div style={{
          position: 'absolute', top: '32%',
          fontFamily: '"Cinzel Decorative", serif', fontSize: 48, fontWeight: 900,
          color: '#ff4d6d', letterSpacing: '0.2em',
          textShadow: '0 0 30px #ff4d6d',
          animation: 'boomPop 350ms cubic-bezier(0.2, 1.6, 0.5, 1)',
        }}>NOT ENOUGH</div>
      )}
      {boom && (
        <div className="f-mono num" style={{
          fontSize: 96, fontWeight: 700,
          color: boom.gold ? '#f5c451' : '#fff',
          textShadow: boom.gold
            ? '0 0 40px #f5c451, 0 0 80px rgba(245,196,81,0.5)'
            : '0 0 40px #7be3ff, 0 0 80px rgba(123,227,255,0.5)',
          animation: 'boomPop 400ms cubic-bezier(0.2, 1.4, 0.5, 1)',
        }}>
          {boom.total.toLocaleString()}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: all tests pass (no ScoreMoment-specific tests yet, but no regressions).

- [ ] **Step 4: Commit**

```bash
git add src-next/app/hud/ScoreMoment.tsx
git commit -m "refactor(hud): ScoreMoment consumes onScoreBeat stream"
```

---

## Task 12: ScoreFloat counter — gold color shift on cross-target

**Files:**
- Modify: `src-next/app/hud/ScoreFloat.tsx`

- [ ] **Step 1: Inspect current ScoreFloat**

Read `src-next/app/hud/ScoreFloat.tsx` to confirm CSS var name (`--snap`) and how it currently sets counter value.

- [ ] **Step 2: Add cross-target listener and color toggle**

In `src-next/app/hud/ScoreFloat.tsx`, locate the component's `useEffect` block that subscribes to scoring events. Add a new state and listener:

```tsx
const [goldUntil, setGoldUntil] = useState(0);
useEffect(() => {
  const off = bus.on('onScoreBeat', ({ beat }) => {
    if (beat.kind === 'cross-target') {
      setGoldUntil(performance.now() + 4000);
    }
    if ('runningTotal' in beat) {
      // update counter target — adapt to existing snap mechanism
      setCounterTarget(beat.runningTotal);
    }
  });
  return () => off();
}, []);
const isGold = performance.now() < goldUntil;
```

In the rendered counter element, add:

```tsx
<div data-score-counter style={{ color: isGold ? '#f5c451' : '#fff', transition: 'color 200ms ease' }}>
  ...
</div>
```

(`data-score-counter` attr is the anchor `Particles.tsx` queries for fly destinations in Task 10.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src-next/app/hud/ScoreFloat.tsx
git commit -m "feat(hud): score counter goes gold on cross-target"
```

---

## Task 13: Wire roll.ts SCORE_HAND to dispatch sequence

**Files:**
- Modify: `src-next/actions/handlers/roll.ts`
- Create: `src-next/app/hud/scoreSequenceController.ts`

The handler is a pure reducer — it can't dispatch a hook directly. Use a controller component listening to `onScoreCalculated` that builds the sequence and runs `runScoreSequence`.

- [ ] **Step 1: Add maxRemaining helper to round state**

In `src-next/actions/handlers/roll.ts`, no change to the state shape — `maxRemaining` is computed inline. Note for the controller: when `handsLeft === 0` after this score, `isLastHand=true` for THIS hand. Bail check for last-hand needs `maxRemaining` evaluated BEFORE running the sequence; computed in controller via `state.round.target - state.round.score - final.total + maxPossibleNext`. For now, controller uses simple heuristic: `isLastHand = (s.round.handsLeft === 1)` BEFORE this hand resolves; `maxRemaining = final.total` (no further hands).

- [ ] **Step 2: Write the controller**

Write `src-next/app/hud/scoreSequenceController.ts`:

```ts
import { useEffect } from 'react';
import { bus } from '../../events/bus';
import { useGameState } from '../../store/gameState';   // adjust import to actual store hook
import { adaptScoringContext } from '../../core/scoring/adapter';
import { buildScoreSequence } from '../../core/scoring/sequence';
import { runScoreSequence } from './useScoreSequence';

export function useScoreSequenceController() {
  useEffect(() => {
    const off = bus.on('onScoreCalculated', () => {
      const state = useGameState.getState();   // adapt to actual zustand selector API
      const lastCtx = state.round.lastScoringCtx;   // see Step 3 — handler must stash this
      if (!lastCtx) return;
      const input = adaptScoringContext(lastCtx);
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const isLastHand = state.round.handsLeft === 0;   // already decremented after SCORE_HAND
      const maxRemaining = input.finalTotal;            // simplification: no future hands matter once we're tallying THIS one
      const seq = buildScoreSequence(input, {
        target: state.round.target,
        isLastHand,
        maxRemaining,
        reducedMotion,
      });
      const stop = runScoreSequence(seq, (beat) => bus.emit('onScoreBeat', { beat }));
      // auto-cleanup when sequence ends
      setTimeout(stop, seq.totalDurMs + 200);
    });
    return () => off();
  }, []);
}
```

- [ ] **Step 3: Stash scoring ctx in roll handler so controller can read it**

In `src-next/actions/handlers/roll.ts`, find the `SCORE_HAND` case (line 62). Where `final` is built (line 72), add to the constructed `baseState.round`:

```ts
        round: {
          ...s.round,
          score: newScore,
          handsLeft: newHandsLeft,
          rerollsLeft: 2,
          scoring: true,
          chainLen: final.chain?.len ?? s.round.chainLen,
          chainTier: final.chain?.tier ?? s.round.chainTier,
          dice: s.round.dice.map((d) => ({ ...d, locked: false })),
          lastScoringCtx: {
            combo: final.combo ?? null,
            chips: final.chips ?? 0,
            mult: final.mult ?? 1,
            chain: { mult: final.chain?.mult ?? 1 },
            total: final.total ?? 0,
            state: { round: { dice: s.round.dice } },
          },
        },
```

Add `lastScoringCtx` field to round state type. Find `src-next/store/gameState.ts` (or whichever file defines `RoundState`), and add:

```ts
lastScoringCtx?: {
  combo: { id: string; tier: number } | null;
  chips: number;
  mult: number;
  chain: { mult: number };
  total: number;
  state: { round: { dice: Array<{ face: number }> } };
} | null;
```

- [ ] **Step 4: Mount controller in App**

Find the root app component (likely `src-next/app/App.tsx` or similar — search for `<ScoreMoment />`). Add:

```tsx
import { useScoreSequenceController } from './hud/scoreSequenceController';

export function App() {
  useScoreSequenceController();
  // ... existing render
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`
- Start a run, score a hand
- Confirm: cast-swell plays, dice ticks each die, mults slam in sequence, boom fires
- Confirm: counter climbs visibly, target-cross flips counter gold + amplifies later mults
- Confirm: small score (<25% target) plays compressed sequence

- [ ] **Step 7: Commit**

```bash
git add src-next/app/hud/scoreSequenceController.ts src-next/actions/handlers/roll.ts src-next/store/gameState.ts src-next/app/App.tsx
git commit -m "feat(scoring): wire SCORE_HAND to sequence controller"
```

---

## Task 14: Heat hook — heat tier bump on cross-target

**Files:**
- Modify: `src-next/audio/heat.ts`

- [ ] **Step 1: Inspect current heat module**

Read `src-next/audio/heat.ts`. Find the function that bumps heat tier (e.g. `bumpHeatTier()` or similar). If none exists, identify the heat-tier setter.

- [ ] **Step 2: Subscribe to onScoreBeat for cross-target**

At the bottom of `src-next/audio/heat.ts` (or in the existing init function), add:

```ts
import { bus } from '../events/bus';

bus.on('onScoreBeat', ({ beat }) => {
  if (beat.kind === 'cross-target') {
    // bump heat tier or trigger heat surge — adapt to actual API
    bumpHeatTier();
  }
});
```

(If `bumpHeatTier` doesn't exist, create a small wrapper that increments the engine's tier-tracking variable by 1 and clamps to max.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src-next/audio/heat.ts
git commit -m "feat(audio): heat tier bumps on cross-target beat"
```

---

## Task 15: Dev console ScoringTab

**Files:**
- Create: `src-next/devtools/tabs/ScoringTab.tsx`
- Modify: `src-next/devtools/DevConsole.tsx`

- [ ] **Step 1: Inspect existing tab pattern**

Read `src-next/devtools/tabs/AudioTab.tsx` (or any existing tab) for the export and registration pattern.

- [ ] **Step 2: Write ScoringTab**

Write `src-next/devtools/tabs/ScoringTab.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { buildScoreSequence } from '../../core/scoring/sequence';
import { runScoreSequence } from '../../app/hud/useScoreSequence';
import type { Beat, ScoreSequence, SequenceTier } from '../../core/scoring/types';

export function ScoringTab() {
  const [last, setLast] = useState<{ seq: ScoreSequence; emitted: Beat[] } | null>(null);
  const [forceTier, setForceTier] = useState<SequenceTier | 'auto'>('auto');

  useEffect(() => {
    const off = bus.on('onScoreBeat', ({ beat }) => {
      setLast((prev) => prev
        ? { ...prev, emitted: [...prev.emitted, beat] }
        : prev);
    });
    return () => off();
  }, []);

  const replay = () => {
    if (!last) return;
    runScoreSequence(last.seq, (b) => bus.emit('onScoreBeat', { beat: b }));
  };

  const fakeFire = () => {
    const seq = buildScoreSequence(
      { faces: [6, 6, 6, 5, 5], comboLabel: 'FULL_HOUSE', comboBonus: 25,
        mults: [{ label: 'mult', value: 4 }, { label: 'chain', value: 2 }], finalTotal: 424 },
      { target: 100, isLastHand: false, maxRemaining: 1000, reducedMotion: false },
    );
    setLast({ seq, emitted: [] });
    runScoreSequence(seq, (b) => bus.emit('onScoreBeat', { beat: b }));
  };

  return (
    <div style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <strong>Tier:</strong> {last?.seq.tier ?? '—'}{' · '}
        <strong>Beats:</strong> {last?.seq.beats.length ?? 0}{' · '}
        <strong>Dur:</strong> {last?.seq.totalDurMs ?? 0}ms
      </div>
      <div style={{ marginBottom: 8 }}>
        <button onClick={fakeFire}>Fire test sequence</button>{' '}
        <button onClick={replay} disabled={!last}>Replay last</button>
      </div>
      <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #444' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th>t</th><th>kind</th><th>payload</th></tr></thead>
          <tbody>
            {last?.seq.beats.map((b, i) => (
              <tr key={i} style={{ background: last.emitted.includes(b) ? '#234' : 'transparent' }}>
                <td>{b.t}</td>
                <td>{b.kind}</td>
                <td style={{ opacity: 0.7 }}>{JSON.stringify(b).slice(0, 80)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Register tab in DevConsole**

Modify `src-next/devtools/DevConsole.tsx`. Find where existing tabs (`AudioTab`, `StateTab`, etc.) are imported and registered. Add:

```tsx
import { ScoringTab } from './tabs/ScoringTab';
```

In the tab list / switch (locate by searching for `AudioTab` usage), add a `Scoring` entry pointing to `<ScoringTab />`.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`
- Press `` ` `` to open dev console
- Switch to Scoring tab
- Click "Fire test sequence" — confirm full ceremony plays in main game view
- Click "Replay last" — confirm replay works

- [ ] **Step 6: Commit**

```bash
git add src-next/devtools/tabs/ScoringTab.tsx src-next/devtools/DevConsole.tsx
git commit -m "feat(devtools): ScoringTab exposes beat stream + test fire"
```

---

## Task 16: Final verification + manual playtest

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: zero errors.

- [ ] **Step 3: Build production bundle**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual playtest checklist**

Run: `npm run dev`. Play a full run and confirm each:

- [ ] Small score (<25% target) plays compressed sequence (~600ms)
- [ ] Mid score plays mid sequence with combo + mults but no held breath
- [ ] Score that beats target plays full sequence with held-breath silence before boom
- [ ] When counter crosses target mid-sequence, it flips gold and remaining mults amplify
- [ ] Last-hand impossible score truncates with "NOT ENOUGH" stamp
- [ ] Audio: rising pitch on dice ticks, mult slams pitched up, bass rumble builds, master ducks during hold-breath
- [ ] Reduced motion (`prefers-reduced-motion: reduce` in browser devtools) collapses to short tier
- [ ] Dev console ScoringTab shows the beat list for the last sequence and replay works
- [ ] No console errors during scoring

- [ ] **Step 5: Commit any tuning fixes**

If playtest revealed timing/volume issues, tune constants in `sequence.ts` and `scoring.ts` and commit:

```bash
git add -p
git commit -m "chore(scoring): playtest tuning"
```

---

## Self-Review Notes

Spec coverage check:
- ✅ Beat schema (Task 1)
- ✅ Tier rules (Task 2/3/4 — short/mid/full)
- ✅ Sequence builder pure fn (Task 2-5)
- ✅ Adapter (Task 6)
- ✅ useScoreSequence hook (Task 7)
- ✅ New SFX entries (Task 8)
- ✅ Audio router (Task 9)
- ✅ Particles extensions (Task 10)
- ✅ ScoreMoment refactor (Task 11)
- ✅ ScoreFloat color shift (Task 12)
- ✅ roll.ts integration (Task 13)
- ✅ Heat hook (Task 14)
- ✅ Dev console (Task 15)
- ✅ Reduced motion (handled in Task 5 via `pickTier`)
- ✅ Edge cases (zero-mult, faces<5, concurrent sequences via `runScoreSequence` cleanup) — covered by adapter producing empty mults array, sequence loop iterating `faces.length`, controller calling `stop()` after timeout
- ✅ Testing (Tasks 2-7 are TDD; Task 16 is full manual playtest)

Type consistency verified:
- `Beat` discriminated union used identically in types.ts, sequence.ts, useScoreSequence.ts, scoring.ts (audio), Particles.tsx, ScoreMoment.tsx, ScoringTab.tsx
- `SequenceInput` shape matches what `adaptScoringContext` produces and `buildScoreSequence` consumes
- Field names: `runningTotal` (not `running`), `pitchSemis` (not `semis`), `crossedTarget` (not `crossed`) — consistent across schema and consumers
