# Scoring Buildup Escalation — Design

**Status**: Approved (design phase)
**Date**: 2026-04-28
**Sub-project**: A (of 4 — see decomposition)

## Goal

Make every scored hand feel like a moment, regardless of size. Currently small hands (`ratio < 0.25` of target) emit a stripped-down sequence with no combo announce, no mult slams, and no climactic pause — they finish in ~1.5s with a flat blip. After this change, every hand uses the same beat list (cast-swell → die ticks → combo announce → optional mult slams → hold-breath → boom), with timing scaled to size.

## Background

Sub-project A of 4. Sibling specs:
- B — re-theme (shipped).
- C — pause screen (queued).
- D — modifiers + game juice (queued).

Recent scoring polish landed in PRs #58 and #59 (per-die spotlight, deferred score commit, longer boom hold). This spec extends the same direction: more buildup, more universal, less "size-dependent ceremony quality".

## Locked design decisions

- **Approach**: same beats every tier, scaled timing (Q1 (c) + Approach B).
- **Duration shape**: floored scale — small ≥ ~2.5s, full ≥ ~3.85s (Q2 (c)).
- **Null-data beats**: combo-bonus emits even when `comboBonus = 0`; mult-slam stays data-driven (no fake `×1.0` slams); hold-breath always emitted (Q3 (a)).
- **Implementation**: keep existing `'short' | 'mid' | 'full'` enum, equalize beat list across tiers, scale timing per tier (Approach B).

## Architecture

**Files touched** (single rewrite, no new files):

- `src-next/core/scoring/sequence.ts` — rewrite `buildScoreSequence` per below.
- `src-next/core/scoring/sequence.test.ts` — update existing tests + add new ones.

**Untouched** (continue to work as-is):

- `src-next/core/scoring/adapter.ts` — still produces `mults: []` for no-mult hands.
- `src-next/app/hud/scoreSequenceController.ts` — still consumes `buildScoreSequence`.
- `src-next/app/hud/useScoreSequence.ts` — beat-firing timer.
- `src-next/app/hud/ScoreMoment.tsx` — already handles all beat types; will receive more.
- `src-next/audio/AudioEngine.ts` and SFX bank — same beat router.

## Sequence behavior

`buildScoreSequence(input, ctx)` returns a `ScoreSequence`. Tier still derived from `finalTotal / target`:

- `< 0.25` → `short`
- `0.25 ≤ x < 1.0` → `mid`
- `≥ 1.0` → `full`

Tier governs timing, NOT which beats are emitted. All three tiers emit the same beat list:

1. `cast-swell` (1 beat)
2. `die-tick` (1 per face, 5 total typically)
3. `combo-bonus` (1 beat — always, even when `comboBonus === 0`)
4. `mult-slam` (0..N beats — one per actual mult in `input.mults`)
5. `hold-breath` (1 beat — always, even at short tier)
6. `boom` (1 beat — terminal)

Cross-target detection (`checkCross`) runs after each running-total mutation (die ticks, combo-bonus, each mult-slam). Emits `cross-target` beat once when running first crosses target.

## Pacing constants

Defined as named constants at top of `sequence.ts` for tunability.

| Param | short | mid | full |
|---|---|---|---|
| cast-swell duration | 200ms | 200ms | 200ms |
| die-tick gap (uniform or lerp) | 350ms uniform | 500ms uniform | lerp 700→480ms |
| combo-bonus → next gap | 250ms | 300ms | 350ms |
| mult-slam gap | 350ms | 400ms | 450ms |
| hold-breath duration | 200ms | 300ms | 400ms |
| mult-slam pitch ramp start (semis) | 12 | 12 | 12 |
| mult-slam pitch ramp step | +2 | +2 | +2 |
| mult-slam ampScale base | 1.0 | 1.0 | 1.0 |

Boom hold (consumed by `ScoreMoment` timeout, NOT in sequence): unchanged at 1400ms (no cross) / 2600ms (cross-target).

**Total sequence duration** (excluding boom hold) for a 5-die hand:

| Tier | No mults | 1 mult | 2 mults |
|------|----------|--------|---------|
| short | ~2.4s | ~2.75s | ~3.1s |
| mid | ~3.3s | ~3.7s | ~4.1s |
| full | ~3.85s | ~4.3s | ~4.75s |

## Edge cases

- **Reduced-motion (`ctx.reducedMotion === true`)**: branch early. Emit cast-swell + die ticks (220ms uniform, no spotlight pause) + boom. No combo-bonus, no mult-slam, no hold-breath. Equivalent to the old short tier behavior. Preserved as a11y fallback.
- **Last-hand bail (`ctx.isLastHand && ctx.maxRemaining < ctx.target`)**: existing branch. Cast-swell + die ticks (60ms uniform — fast, urgent) + bail beat. Unchanged.
- **Combo bonus = 0** (Chance hand or any hand without a tier-bonus combo): emit combo-bonus beat with `chipDelta: 0`, `runningTotal: unchanged`. `ScoreMoment.tsx` already shows constellation name from `comboLabel`; no visual flicker because the `comboName && (...)` guard fires once `comboLabel` is set.
- **No mults (`input.mults.length === 0`)**: zero mult-slam beats. Hold-breath fires immediately after combo-bonus + its gap.
- **Cross-target during combo-bonus**: `checkCross` after combo-bonus running-total update. Cross-target fires before next gap.
- **Cross-target during mult-slam**: `checkCross` after each mult application. Cross-target fires once at the threshold.
- **Sequence cancelled mid-flight**: `runScoreSequence` returns a stop fn. Existing safety timeout in `scoreSequenceController` honors it. Unchanged.

## Tests

Add to `src-next/core/scoring/sequence.test.ts`:

```ts
const baseCtx = { target: 1000, isLastHand: false, maxRemaining: 1000, reducedMotion: false };

describe('buildScoreSequence universal beats', () => {
  it('every tier emits combo-bonus beat including Chance hand (comboBonus=0)', () => {
    for (const total of [100, 500, 1500]) {
      const seq = buildScoreSequence(
        { faces: [1,2,3,4,5], comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: total },
        { ...baseCtx, target: 1000 },
      );
      expect(seq.beats.some((b) => b.kind === 'combo-bonus')).toBe(true);
    }
  });

  it('every non-reduced-motion tier emits hold-breath before boom', () => {
    for (const total of [100, 500, 1500]) {
      const seq = buildScoreSequence(
        { faces: [1,2,3,4,5], comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: total },
        { ...baseCtx, target: 1000 },
      );
      const breathIdx = seq.beats.findIndex((b) => b.kind === 'hold-breath');
      const boomIdx = seq.beats.findIndex((b) => b.kind === 'boom');
      expect(breathIdx).toBeGreaterThanOrEqual(0);
      expect(breathIdx).toBeLessThan(boomIdx);
    }
  });

  it('short tier total duration is at least 2000ms', () => {
    const seq = buildScoreSequence(
      { faces: [1,2,3,4,5], comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: 100 },
      { ...baseCtx, target: 1000 },
    );
    expect(seq.tier).toBe('short');
    expect(seq.totalDurMs).toBeGreaterThanOrEqual(2000);
  });

  it('mid tier total duration is at least 3000ms', () => {
    const seq = buildScoreSequence(
      { faces: [1,2,3,4,5], comboLabel: 'TWO_PAIR', comboBonus: 20, mults: [], finalTotal: 500 },
      { ...baseCtx, target: 1000 },
    );
    expect(seq.tier).toBe('mid');
    expect(seq.totalDurMs).toBeGreaterThanOrEqual(3000);
  });

  it('full tier total duration is at least 3500ms', () => {
    const seq = buildScoreSequence(
      { faces: [1,2,3,4,5], comboLabel: 'FULL_HOUSE', comboBonus: 35, mults: [{ label: 'mult', value: 2 }], finalTotal: 1500 },
      { ...baseCtx, target: 1000 },
    );
    expect(seq.tier).toBe('full');
    expect(seq.totalDurMs).toBeGreaterThanOrEqual(3500);
  });

  it('reduced-motion path emits NO combo-bonus and NO hold-breath', () => {
    const seq = buildScoreSequence(
      { faces: [1,2,3,4,5], comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: 100 },
      { ...baseCtx, reducedMotion: true },
    );
    expect(seq.beats.some((b) => b.kind === 'combo-bonus')).toBe(false);
    expect(seq.beats.some((b) => b.kind === 'hold-breath')).toBe(false);
    expect(seq.beats.some((b) => b.kind === 'boom')).toBe(true);
  });

  it('bail path unchanged: cast-swell + die-ticks + bail beat', () => {
    const seq = buildScoreSequence(
      { faces: [1,2,3,4,5], comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: 100 },
      { ...baseCtx, isLastHand: true, maxRemaining: 100 },
    );
    expect(seq.beats[0]?.kind).toBe('cast-swell');
    expect(seq.beats.some((b) => b.kind === 'die-tick')).toBe(true);
    expect(seq.beats[seq.beats.length - 1]?.kind).toBe('bail');
    expect(seq.beats.some((b) => b.kind === 'combo-bonus')).toBe(false);
  });

  it('cross-target can fire during combo-bonus phase', () => {
    // Hand scores under target via dice, combo bonus pushes over.
    const seq = buildScoreSequence(
      { faces: [1,1,1,1,1], comboLabel: 'CHANCE', comboBonus: 999, mults: [], finalTotal: 1004 },
      { ...baseCtx, target: 1000 },
    );
    expect(seq.beats.some((b) => b.kind === 'cross-target')).toBe(true);
  });
});
```

Existing tests preserved; tier classification thresholds unchanged.

## Non-goals

- `ScoreMoment.tsx` visual changes (no new overlays, no new particles, no new stamps).
- `AudioEngine`/SFX bank changes (same beat router, same sounds — just more beats).
- `adapter.ts` changes — still produces `mults: []` for no-mult hands.
- Cross-target visual upgrades.
- Chain-aware intensity (rejected as Approach C — adds coupling).
- New beat types beyond the existing `Beat` union.
- Sequence cancellation rework.
- Boss debuffs affecting sequence behavior.
- Boom hold timing (the post-sequence pause owned by ScoreMoment).

## Acceptance criteria

- All new tests in `sequence.test.ts` pass.
- All existing scoring tests still pass (`adapter.test.ts`, `combos.test.ts`, `detectCombo.test.ts`, `constellationChain.test.ts`).
- `npm run build` green.
- Manual visual smoke (dev server): score a Chance hand against a 1000+ target — should see constellation name "Wandering Star" appear, hold-breath pause before boom number.
- Manual visual smoke: score a Full House against same target with `Stratifier` catalyst — should feel longer/bigger than the Chance hand.

## Risks

| Risk | Mitigation |
|------|-----------|
| Slower small hands feel boring instead of satisfying | Tunable constants; can shorten via dev iteration |
| Combo-bonus beat for Chance hand causes visual clutter | `ScoreMoment.tsx` already handles `comboBonus = 0` cleanly via `comboName && (...)` guard; constellation name displays even when no chip delta |
| Existing tests fail due to changed beat counts | Update assertions; tier classification unchanged so most tier-checking tests still hold |
| Breath duration too long disrupts pacing | Constants exposed; first-pass numbers are intentionally conservative — easy to halve in dev |
| Reduced-motion users still get a flat ceremony | Acceptable — they explicitly opted out of motion. Could add audio-only buildup in a future spec |
