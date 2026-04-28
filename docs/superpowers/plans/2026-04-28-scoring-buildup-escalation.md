# Scoring Buildup Escalation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every scored hand emit the same beat arc (cast-swell → die-ticks → combo-bonus → optional mult-slams → hold-breath → boom). Only timing scales with tier. Eliminates the flat 1.5s small-hand experience.

**Architecture:** Single function rewrite of `buildScoreSequence` in `src-next/core/scoring/sequence.ts`. All three tiers (`short`/`mid`/`full`) emit identical beat lists; pacing constants per-tier control the feel. Reduced-motion and bail paths kept as-is. Adapter, controller, ScoreMoment, AudioEngine — untouched.

**Tech Stack:** TypeScript, Vitest. No new dependencies, no new files.

**Spec:** [docs/superpowers/specs/2026-04-28-scoring-buildup-escalation-design.md](../specs/2026-04-28-scoring-buildup-escalation-design.md)

---

## File Structure

**Modified:**
- `src-next/core/scoring/sequence.ts` — `buildScoreSequence` rewrite + new pacing constants block at top.
- `src-next/core/scoring/sequence.test.ts` — update 2 existing tests (broken by new beat list), add 8 new tests.

**Untouched:**
- `src-next/core/scoring/types.ts` — `Beat` union, `ScoreSequence`, `SequenceCtx`, `SequenceInput` unchanged.
- `src-next/core/scoring/adapter.ts` — still produces `mults: []` for no-mult hands.
- `src-next/app/hud/scoreSequenceController.ts`, `useScoreSequence.ts`, `ScoreMoment.tsx` — consume sequence; no API change.
- `src-next/audio/AudioEngine.ts` — same beat router.

## Conventions

- **Single commit** at end. Title: `feat(scoring): universal beat arc + tier-scaled pacing`.
- **Stage paths explicitly.** Do NOT use `git add -A` (pattern from previous sub-projects: `.claude/settings.local.json` is dirty in working tree and should not be swept in).
- Run `npm run build` + `npm test` before committing. Both must be green.
- Total tests should go from 132 to 140 (132 existing + 8 new).

---

## Task 1: TDD red — update existing tests + add new tests

**Files:**
- Modify: `src-next/core/scoring/sequence.test.ts`

This task only touches the test file. After it lands, the test suite should fail because `buildScoreSequence` doesn't yet implement the new behavior. Task 2 will make the tests green.

- [ ] **Step 1: Update existing tests broken by the new beat list**

Two existing tests assert behavior that will change:

1. `'emits short tier when finalTotal/target < 0.25'` (line 23-36) — currently asserts short tier produces exactly 7 beats (cast-swell + 5 die-ticks + boom). After this change, short tier also emits combo-bonus + hold-breath, so beat count and ordering change.

2. `'emits mid tier when 0.25 <= ratio < 1.0'` (line 38-49) — currently asserts mid tier does NOT contain `hold-breath`. After this change, mid tier always emits `hold-breath`.

Replace those two test bodies in `src-next/core/scoring/sequence.test.ts`. Use Edit (find the existing `it(...)` block, replace its body):

```ts
  it('emits short tier when finalTotal/target < 0.25', () => {
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 18 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('short');
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds[0]).toBe('cast-swell');
    expect(kinds.filter((k) => k === 'die-tick')).toHaveLength(5);
    expect(kinds).toContain('combo-bonus');
    expect(kinds).toContain('hold-breath');
    expect(kinds[kinds.length - 1]).toBe('boom');
  });

  it('emits mid tier when 0.25 <= ratio < 1.0', () => {
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 50, comboBonus: 10, mults: [{ label: 'mult', value: 2 }, { label: 'chain', value: 1 }] }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('mid');
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).toContain('combo-bonus');
    expect(kinds.filter((k) => k === 'mult-slam')).toHaveLength(2);
    expect(kinds).toContain('hold-breath');
    expect(kinds[kinds.length - 1]).toBe('boom');
  });
```

- [ ] **Step 2: Add new test — combo-bonus emitted on every tier including Chance hand**

Add this `it(...)` block inside the existing `describe('buildScoreSequence — tier selection', () => { ... })` block, after the last existing test. Use Edit with a unique `old_string` (e.g. the closing `});` of the describe block, prepending the new tests):

```ts
  it('emits combo-bonus beat on every non-reduced-motion tier including Chance hand', () => {
    for (const total of [18, 50, 200]) {
      const seq = buildScoreSequence(
        baseInput({ comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: total }),
        baseCtx({ target: 100 }),
      );
      expect(seq.beats.some((b) => b.kind === 'combo-bonus')).toBe(true);
    }
  });
```

- [ ] **Step 3: Add test — hold-breath always before boom on non-reduced-motion**

```ts
  it('emits hold-breath before boom on every non-reduced-motion tier', () => {
    for (const total of [18, 50, 200]) {
      const seq = buildScoreSequence(
        baseInput({ comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: total }),
        baseCtx({ target: 100 }),
      );
      const breathIdx = seq.beats.findIndex((b) => b.kind === 'hold-breath');
      const boomIdx = seq.beats.findIndex((b) => b.kind === 'boom');
      expect(breathIdx).toBeGreaterThanOrEqual(0);
      expect(breathIdx).toBeLessThan(boomIdx);
    }
  });
```

- [ ] **Step 4: Add test — short tier total duration ≥ 2000ms**

```ts
  it('short tier total duration is at least 2000ms for typical 5-die no-mult hand', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: 18 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('short');
    expect(seq.totalDurMs).toBeGreaterThanOrEqual(2000);
  });
```

- [ ] **Step 5: Add test — mid tier total duration ≥ 3000ms**

```ts
  it('mid tier total duration is at least 3000ms', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'TWO_PAIR', comboBonus: 20, mults: [], finalTotal: 50 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('mid');
    expect(seq.totalDurMs).toBeGreaterThanOrEqual(3000);
  });
```

- [ ] **Step 6: Add test — full tier total duration ≥ 3500ms**

```ts
  it('full tier total duration is at least 3500ms', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'FULL_HOUSE', comboBonus: 35, mults: [{ label: 'mult', value: 2 }], finalTotal: 200 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('full');
    expect(seq.totalDurMs).toBeGreaterThanOrEqual(3500);
  });
```

- [ ] **Step 7: Add test — reduced-motion path emits NO combo-bonus and NO hold-breath**

```ts
  it('reduced-motion path emits no combo-bonus and no hold-breath', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: 18 }),
      baseCtx({ target: 100, reducedMotion: true }),
    );
    expect(seq.beats.some((b) => b.kind === 'combo-bonus')).toBe(false);
    expect(seq.beats.some((b) => b.kind === 'hold-breath')).toBe(false);
    expect(seq.beats.some((b) => b.kind === 'boom')).toBe(true);
  });
```

- [ ] **Step 8: Add test — bail path unchanged**

```ts
  it('bail path emits no combo-bonus and no hold-breath (unchanged behavior)', () => {
    const seq = buildScoreSequence(
      baseInput({ faces: [1,1,1,1,1], comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: 5 }),
      baseCtx({ target: 100, isLastHand: true, maxRemaining: 5 }),
    );
    expect(seq.beats[0]?.kind).toBe('cast-swell');
    expect(seq.beats.some((b) => b.kind === 'die-tick')).toBe(true);
    expect(seq.beats[seq.beats.length - 1]?.kind).toBe('bail');
    expect(seq.beats.some((b) => b.kind === 'combo-bonus')).toBe(false);
    expect(seq.beats.some((b) => b.kind === 'hold-breath')).toBe(false);
  });
```

- [ ] **Step 9: Run tests, expect failures**

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npx vitest run src-next/core/scoring/sequence.test.ts
```

Expected: multiple failures. Specifically:
- The two updated existing tests should fail because current short tier doesn't emit combo-bonus / hold-breath.
- The 6 new universal-beat / duration tests should fail (combo-bonus/hold-breath missing on short tier; durations too small).
- `'reduced-motion path emits no combo-bonus and no hold-breath'` should pass already (current short tier doesn't emit those).
- `'bail path...'` should pass already (current bail branch doesn't emit those).

Some existing tests should still pass (cross-target tests, full-tier tests, tier classification).

Do NOT proceed to Task 2 until you've confirmed the expected failure pattern. If the failures don't match this list, investigate before continuing — the existing behavior may differ from what the spec assumes.

---

## Task 2: TDD green — rewrite buildScoreSequence

**Files:**
- Modify: `src-next/core/scoring/sequence.ts`

- [ ] **Step 1: Replace `src-next/core/scoring/sequence.ts` with the rewrite**

Replace the entire file content with:

```ts
import type { Beat, ScoreSequence, SequenceCtx, SequenceInput, SequenceTier } from './types';

// Pacing constants per tier. All ms. Tunable in dev.
const PACING = {
  short: {
    castSwellMs: 200,
    dieGapMs: 350,
    comboGapMs: 250,
    multGapMs: 350,
    holdBreathMs: 200,
  },
  mid: {
    castSwellMs: 200,
    dieGapMs: 500,
    comboGapMs: 300,
    multGapMs: 400,
    holdBreathMs: 300,
  },
  full: {
    castSwellMs: 200,
    dieGapStartMs: 700,
    dieGapEndMs: 480,
    comboGapMs: 350,
    multGapMs: 450,
    holdBreathMs: 400,
  },
} as const;

const REDUCED_MOTION_DIE_GAP_MS = 220;
const BAIL_DIE_GAP_MS = 60;
const BAIL_LEAD_IN_MS = 200;
const BAIL_LEAD_OUT_MS = 200;

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

/**
 * Builds a deterministic beat list for a scored hand.
 *
 * Contract: `input.mults` must be the ordered list of multipliers actually
 * applied by the scoring engine, so the internally-accumulated `running`
 * total converges to `input.finalTotal`. The adapter (`adapter.ts`) is
 * responsible for honoring this contract. Cross-target detection and the
 * boom's `crossedTarget` flag are derived from `running`, not `finalTotal`.
 *
 * Universal-beat contract (non-reduced-motion, non-bail paths): every tier
 * emits cast-swell → die-ticks → combo-bonus → [0..N mult-slams] → hold-breath
 * → boom. Only pacing scales with tier. combo-bonus is emitted even when
 * comboBonus === 0 so the player always sees the constellation announced.
 */
export function buildScoreSequence(
  input: SequenceInput,
  ctx: SequenceCtx,
): ScoreSequence {
  const tier = pickTier(input, ctx);
  const beats: Beat[] = [];
  let t = 0;
  let running = 0;
  let crossEmitted = false;

  // Bail branch: last hand, target out of reach. Stripped sequence ending in bail.
  if (ctx.isLastHand && ctx.maxRemaining < ctx.target) {
    beats.push({ kind: 'cast-swell', t });
    t += BAIL_LEAD_IN_MS;
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
      t += BAIL_DIE_GAP_MS;
    }
    t += BAIL_LEAD_OUT_MS;
    beats.push({ kind: 'bail', t, runningTotal: bailRunning, target: ctx.target });
    return { beats, tier, totalDurMs: t };
  }

  // Reduced-motion branch: stripped sequence — cast-swell + die ticks + boom.
  // No combo announce, no mult slams, no hold-breath. A11y fallback.
  if (ctx.reducedMotion) {
    beats.push({ kind: 'cast-swell', t });
    t += PACING.short.castSwellMs;
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
      if (!crossEmitted && before < ctx.target && running >= ctx.target) {
        beats.push({ kind: 'cross-target', t: t + 80, runningTotal: running, target: ctx.target });
        crossEmitted = true;
      }
      t += REDUCED_MOTION_DIE_GAP_MS;
    }
    t += 150;
    beats.push({ kind: 'boom', t, finalTotal: input.finalTotal, crossedTarget: running >= ctx.target });
    return { beats, tier, totalDurMs: t };
  }

  const checkCross = (beforeRunning: number) => {
    if (!crossEmitted && beforeRunning < ctx.target && running >= ctx.target) {
      beats.push({ kind: 'cross-target', t: t + 80, runningTotal: running, target: ctx.target });
      crossEmitted = true;
    }
  };

  // Cast-swell
  beats.push({ kind: 'cast-swell', t });
  t += tier === 'full' ? PACING.full.castSwellMs : PACING[tier].castSwellMs;

  // Die ticks
  const dieGaps =
    tier === 'full'
      ? lerpGaps(PACING.full.dieGapStartMs, PACING.full.dieGapEndMs, input.faces.length)
      : input.faces.map(() => PACING[tier].dieGapMs);

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
    t += dieGaps[i]!;
  }

  // Combo-bonus — ALWAYS emitted (even when comboBonus === 0)
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
    const comboGap = tier === 'full' ? PACING.full.comboGapMs : PACING[tier].comboGapMs;
    t += comboGap;
  }

  // Mult-slams — data-driven (no fake slams when mults array is empty)
  const multGap = tier === 'full' ? PACING.full.multGapMs : PACING[tier].multGapMs;
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

  // Hold-breath — ALWAYS emitted before boom on non-reduced-motion / non-bail paths
  const breathMs = tier === 'full' ? PACING.full.holdBreathMs : PACING[tier].holdBreathMs;
  beats.push({ kind: 'hold-breath', t, durMs: breathMs });
  t += breathMs;

  // Boom — terminal
  beats.push({ kind: 'boom', t, finalTotal: input.finalTotal, crossedTarget: running >= ctx.target });
  return { beats, tier, totalDurMs: t };
}
```

- [ ] **Step 2: Run sequence tests**

```bash
cd C:/Users/lkonj/OneDrive/Documents/GitHub/FortuneFallacy2
npx vitest run src-next/core/scoring/sequence.test.ts
```

Expected: all tests in this file pass. If any fail:
- `cross-target` tests broken? Check the `checkCross` calls — they should fire after each running-total mutation (die-tick, combo-bonus, each mult-slam).
- Duration tests broken? Verify the constants in `PACING` match the spec. Short floor = 200 (cast) + 5×350 (dice) + 250 (combo) + 200 (breath) = 2400ms. Mid floor = 200 + 5×500 + 300 + 300 = 3300ms. Full floor = 200 + ~2900 (lerp avg) + 350 + 400 = ~3850ms.
- Bail test broken? Verify the bail branch is reached when `isLastHand && maxRemaining < target` and ALSO that combo-bonus / hold-breath are NOT emitted in that branch.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: 140/140 pass (132 existing + 8 new). If any non-sequence test fails, that's a downstream consumer issue worth investigating — likely a test that hard-codes beat counts.

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: green.

---

## Task 3: Manual smoke + commit

**Files:** none (verification + commit only)

- [ ] **Step 1: Manual visual smoke (dev server)**

If practical:

```bash
npm run dev
```

Open the localhost URL. Walk through:

1. Start a new run (Begin Ascension).
2. Score a small hand against a small blind (e.g. roll all-low dice into "Wandering Star" Chance combo).
3. Confirm: constellation name "Wandering Star" appears, dice tick out individually, brief pause, then the boom number lands. Total ~2.5-3s. No flat 1.5s blip.
4. Score a target-cross hand (full house with Stratifier catalyst, or any hand that triples the target).
5. Confirm: longer ceremony with mult slams, hold-breath visibly longer, gold "TARGET BEAT" stamp, boom in gold.
6. Compare feel: small hand and big hand both feel ceremonial, big hand feels bigger.

If dev-server inspection isn't practical in this environment, document this step as deferred and skip to Step 2.

- [ ] **Step 2: Verify staged diff is clean**

```bash
git status -sb
git add src-next/core/scoring/sequence.ts src-next/core/scoring/sequence.test.ts
git diff --cached --stat
```

Expected: 2 files staged, no `.claude/settings.local.json`. If the cached diff includes anything else, investigate before committing.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(scoring): universal beat arc + tier-scaled pacing

Every scored hand now emits the same beat list (cast-swell ->
die-ticks -> combo-bonus -> [optional mult-slams] -> hold-breath
-> boom). Only pacing scales with tier. combo-bonus emitted even
when comboBonus=0 so Chance hands always announce the constellation.
hold-breath always emitted before boom (was full-tier-only).

Reduced-motion + bail paths unchanged. Adapter, controller,
ScoreMoment, AudioEngine untouched - they already handle every
beat type, just receive more of them now.

Total tests: 140 (was 132, +8 new)."
```

(Use a HEREDOC in the actual command if your shell needs it; the message above is the literal commit text.)

- [ ] **Step 4: Verify the commit**

```bash
git log --oneline -3
git show --stat HEAD
```

Expected: most recent commit is the new feat commit, touches exactly 2 files (sequence.ts + sequence.test.ts).

---

## Self-Review

**1. Spec coverage:**

| Spec section | Implemented in |
|---|---|
| Q1 (c) — same beats every tier | Task 2 Step 1 (universal beat emission in `buildScoreSequence`) |
| Q2 (c) — floored scale (small ≥2.4s, full ≥3.85s) | Task 2 Step 1 (PACING constants) + Task 1 Steps 4-6 (duration tests) |
| Q3 (a) — combo-bonus always, mult-slam data-driven, hold-breath always | Task 2 Step 1 + Task 1 Steps 2-3 |
| Reduced-motion path stripped | Task 2 Step 1 (`if (ctx.reducedMotion) { ... return; }` branch) + Task 1 Step 7 |
| Bail path unchanged | Task 2 Step 1 (bail branch identical to current) + Task 1 Step 8 |
| Cross-target during combo-bonus / mult-slam | Task 2 Step 1 (`checkCross` after each mutation); existing test at sequence.test.ts:115-130 still validates |
| Tier classification (`< 0.25` → short, etc.) | Task 2 Step 1 (`pickTier` unchanged) |

All spec sections covered.

**2. Placeholder scan:** No "TBD", no "TODO", no "implement later". Every code block is complete and runnable. The manual smoke step (Task 3 Step 1) explicitly allows deferral if dev-server inspection isn't practical — that's a documented option, not a placeholder.

**3. Type consistency:**

- `PACING` table has `short`/`mid`/`full` keys. Each branch reads the right key.
- `tier` enum value (`'short' | 'mid' | 'full'`) used uniformly.
- `Beat` union members all already exist in `types.ts` — no new beat kinds introduced.
- `SequenceCtx.reducedMotion` boolean read consistently (line 14 of new sequence.ts uses `ctx.reducedMotion`).
- `dieGapStartMs`/`dieGapEndMs` only on `full` tier; `dieGapMs` on `short`/`mid`. Code branches accordingly.

No type drift.

**4. Tunability:** All pacing constants live as named keys in the `PACING` const at the top of `sequence.ts`. Future tuning passes can edit those numbers without touching logic.

---

## Execution Handoff

After saving the plan, offer execution choice.
