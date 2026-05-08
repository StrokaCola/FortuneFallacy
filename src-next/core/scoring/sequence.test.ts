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
  bail: false,
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

  it('mult-slam chain accelerates: each successive slam has a shorter gap', () => {
    // Four mults so the accelerando is visible. Use mid tier (predictable
    // gap) — the per-iteration formula is `baseGap * 0.9^index`, floored
    // at 65% of base. With baseGap=400 this gives 400, 360, 324, 292.
    const seq = buildScoreSequence(
      baseInput({
        finalTotal: 50,
        comboBonus: 10,
        mults: [
          { label: 'a', value: 2 }, { label: 'b', value: 2 },
          { label: 'c', value: 2 }, { label: 'd', value: 2 },
        ],
      }),
      baseCtx({ target: 100 }),
    );
    const slams = seq.beats.filter((b) => b.kind === 'mult-slam');
    expect(slams).toHaveLength(4);
    // Gaps between consecutive slam timestamps must be monotonically
    // non-increasing (each ≤ previous). Some equality is fine if the
    // floor kicks in.
    const gaps = slams.slice(1).map((s, i) => s.t - slams[i]!.t);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]!).toBeLessThanOrEqual(gaps[i - 1]!);
    }
    // Last slam should be strictly faster than first (no degenerate flat
    // chain). Tolerate small rounding noise.
    expect(gaps[gaps.length - 1]!).toBeLessThan(gaps[0]!);
  });

  it('mult-slam ampScale rises with chain index (deeper slams hit harder)', () => {
    const seq = buildScoreSequence(
      baseInput({
        mults: [{ label: 'a', value: 2 }, { label: 'b', value: 2 }, { label: 'c', value: 2 }],
      }),
      baseCtx({ target: 100 }),
    );
    const slams = seq.beats.filter((b) => b.kind === 'mult-slam') as Array<{ ampScale: number }>;
    expect(slams).toHaveLength(3);
    expect(slams[1]!.ampScale).toBeGreaterThan(slams[0]!.ampScale);
    expect(slams[2]!.ampScale).toBeGreaterThan(slams[1]!.ampScale);
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

  it('emits bail beat when ctx.bail is true', () => {
    const seq = buildScoreSequence(
      baseInput({ faces: [1, 1, 1, 1, 1], comboBonus: 0, mults: [], finalTotal: 5 }),
      baseCtx({ target: 100, bail: true }),
    );
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).toContain('bail');
    expect(kinds).not.toContain('boom');
    // bail terminates sequence
    expect(kinds[kinds.length - 1]).toBe('bail');
  });

  it('does NOT bail when ctx.bail is false', () => {
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 5 }),
      baseCtx({ target: 100, bail: false }),
    );
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).not.toContain('bail');
  });

  it('does not bail on a clutch clear (last hand, finalTotal alone < target, but engine cleared)', () => {
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 250 }),
      baseCtx({ target: 1000, bail: false }),
    );
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).not.toContain('bail');
    expect(kinds[kinds.length - 1]).toBe('boom');
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

  it('emits cross-target via mult-slam when dice + combo do not yet cross', () => {
    // dice sum = 15, +combo 10 = 25, ×3 mult = 75, ×2 chain = 150 — crosses at chain mult
    const seq = buildScoreSequence(
      baseInput({
        faces: [3, 3, 3, 3, 3],
        comboBonus: 10,
        mults: [{ label: 'mult', value: 3 }, { label: 'chain', value: 2 }],
        finalTotal: 150,
      }),
      baseCtx({ target: 100 }),
    );
    const idx = seq.beats.findIndex((b) => b.kind === 'cross-target');
    expect(idx).toBeGreaterThan(-1);
    expect(seq.beats[idx - 1]?.kind).toBe('mult-slam');
    expect(seq.beats.filter((b) => b.kind === 'cross-target')).toHaveLength(1);
  });

  it('full tier with empty mults still emits hold-breath and boom', () => {
    const seq = buildScoreSequence(
      baseInput({
        faces: [20, 20, 20, 20, 20],   // dice alone = 100, crosses target
        comboBonus: 50,                 // running = 150
        mults: [],
        finalTotal: 150,
      }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('full');
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds).toContain('hold-breath');
    expect(kinds[kinds.length - 1]).toBe('boom');
    expect(kinds.filter((k) => k === 'mult-slam')).toHaveLength(0);
  });

  it('short tier boom.crossedTarget is always false (target unreachable by construction)', () => {
    // Short tier requires ratio < 0.25, so finalTotal < target/4.
    // Dice sum <= finalTotal < target — dice can never cross target in short tier.
    const seq = buildScoreSequence(
      baseInput({ finalTotal: 18 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('short');
    const boom = seq.beats.find((b) => b.kind === 'boom');
    expect(boom?.kind).toBe('boom');
    if (boom?.kind === 'boom') expect(boom.crossedTarget).toBe(false);
  });

  it('emits combo-bonus beat on every non-reduced-motion tier including Chance hand', () => {
    for (const total of [18, 50, 200]) {
      const seq = buildScoreSequence(
        baseInput({ comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: total }),
        baseCtx({ target: 100 }),
      );
      expect(seq.beats.some((b) => b.kind === 'combo-bonus')).toBe(true);
    }
  });

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

  it('short tier total duration is at least 2000ms for typical 5-die no-mult hand', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: 18 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('short');
    expect(seq.totalDurMs).toBeGreaterThanOrEqual(2000);
  });

  it('short tier total duration is at most 5000ms (sanity ceiling)', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: 18 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('short');
    expect(seq.totalDurMs).toBeLessThan(5000);
  });

  it('mid tier total duration is at least 3000ms', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'TWO_PAIR', comboBonus: 20, mults: [], finalTotal: 50 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('mid');
    expect(seq.totalDurMs).toBeGreaterThanOrEqual(3000);
  });

  it('mid tier total duration is at most 6000ms (sanity ceiling)', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'TWO_PAIR', comboBonus: 20, mults: [], finalTotal: 50 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('mid');
    expect(seq.totalDurMs).toBeLessThan(6000);
  });

  it('full tier total duration is at least 3500ms', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'FULL_HOUSE', comboBonus: 35, mults: [{ label: 'mult', value: 2 }], finalTotal: 200 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('full');
    expect(seq.totalDurMs).toBeGreaterThanOrEqual(3500);
  });

  it('full tier total duration is at most 8000ms (sanity ceiling)', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'FULL_HOUSE', comboBonus: 35, mults: [{ label: 'mult', value: 2 }], finalTotal: 200 }),
      baseCtx({ target: 100 }),
    );
    expect(seq.tier).toBe('full');
    expect(seq.totalDurMs).toBeLessThan(8000);
  });

  it('reduced-motion path emits no combo-bonus and no hold-breath', () => {
    const seq = buildScoreSequence(
      baseInput({ comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: 18 }),
      baseCtx({ target: 100, reducedMotion: true }),
    );
    expect(seq.beats.some((b) => b.kind === 'combo-bonus')).toBe(false);
    expect(seq.beats.some((b) => b.kind === 'hold-breath')).toBe(false);
    expect(seq.beats.some((b) => b.kind === 'boom')).toBe(true);
  });

  it('bail path emits no combo-bonus and no hold-breath (unchanged behavior)', () => {
    const seq = buildScoreSequence(
      baseInput({ faces: [1,1,1,1,1], comboLabel: 'CHANCE', comboBonus: 0, mults: [], finalTotal: 5 }),
      baseCtx({ target: 100, bail: true }),
    );
    expect(seq.beats[0]?.kind).toBe('cast-swell');
    expect(seq.beats.some((b) => b.kind === 'die-tick')).toBe(true);
    expect(seq.beats[seq.beats.length - 1]?.kind).toBe('bail');
    expect(seq.beats.some((b) => b.kind === 'combo-bonus')).toBe(false);
    expect(seq.beats.some((b) => b.kind === 'hold-breath')).toBe(false);
  });

  it('die-tick beats use dieIndices from input (not the held-array slot)', () => {
    // Held dice indices [3, 4] with faces [6, 2]. Beats must target the
    // physical dice (3 and 4), not the held-array slots (0 and 1).
    const seq = buildScoreSequence(
      baseInput({ faces: [6, 2], dieIndices: [3, 4], comboBonus: 0, mults: [], finalTotal: 8 }),
      baseCtx({ target: 100 }),
    );
    const ticks = seq.beats.filter((b) => b.kind === 'die-tick');
    expect(ticks.map((b) => (b.kind === 'die-tick' ? b.dieIdx : -1))).toEqual([3, 4]);
  });

  it('die-tick beats fall back to slot index when dieIndices absent (legacy callers)', () => {
    const seq = buildScoreSequence(
      baseInput({ faces: [1, 2, 3], dieIndices: undefined, comboBonus: 0, mults: [], finalTotal: 6 }),
      baseCtx({ target: 100 }),
    );
    const ticks = seq.beats.filter((b) => b.kind === 'die-tick');
    expect(ticks.map((b) => (b.kind === 'die-tick' ? b.dieIdx : -1))).toEqual([0, 1, 2]);
  });

  it('reduced-motion die-ticks also use dieIndices', () => {
    const seq = buildScoreSequence(
      baseInput({ faces: [6, 2], dieIndices: [3, 4], comboBonus: 0, mults: [], finalTotal: 8 }),
      baseCtx({ target: 100, reducedMotion: true }),
    );
    const ticks = seq.beats.filter((b) => b.kind === 'die-tick');
    expect(ticks.map((b) => (b.kind === 'die-tick' ? b.dieIdx : -1))).toEqual([3, 4]);
  });

  it('bail die-ticks also use dieIndices', () => {
    const seq = buildScoreSequence(
      baseInput({ faces: [6, 2], dieIndices: [3, 4], comboBonus: 0, mults: [], finalTotal: 8 }),
      baseCtx({ target: 100, bail: true }),
    );
    const ticks = seq.beats.filter((b) => b.kind === 'die-tick');
    expect(ticks.map((b) => (b.kind === 'die-tick' ? b.dieIdx : -1))).toEqual([3, 4]);
  });
});

// ---------------------------------------------------------------------------
// Upgrade-beat path (baseMult provided)
// ---------------------------------------------------------------------------

const upgradeInput = (overrides: Partial<SequenceInput> = {}): SequenceInput => ({
  faces: [3, 3, 3],
  comboLabel: 'THREE_KIND',
  comboBonus: 30,       // base combo chips
  baseMult: 5,          // combo evaluation mult
  upgrades: [],
  mults: [],            // no chain
  finalTotal: 195,      // (9 + 30) × 5 = 195
  ...overrides,
});

describe('buildScoreSequence — upgrade-beat path', () => {
  it('cast-swell carries initialMult from baseMult', () => {
    const seq = buildScoreSequence(upgradeInput(), baseCtx({ target: 1000 }));
    const swell = seq.beats.find((b) => b.kind === 'cast-swell');
    expect(swell?.kind).toBe('cast-swell');
    if (swell?.kind === 'cast-swell') expect(swell.initialMult).toBe(5);
  });

  it('emits no mult-slam when upgrades path used and no chain mult', () => {
    const seq = buildScoreSequence(upgradeInput(), baseCtx({ target: 1000 }));
    expect(seq.beats.filter((b) => b.kind === 'mult-slam')).toHaveLength(0);
  });

  it('emits upgrade-chip beat for each upgrade with non-zero chipDelta', () => {
    const seq = buildScoreSequence(
      upgradeInput({
        upgrades: [
          { label: 'mod:scoreBonus@0', chipDelta: 10, multDelta: 0 },
          { label: 'mod:multBonus@1', chipDelta: 0, multDelta: 3 },
          { label: 'mod:scoreBonus@2', chipDelta: 5, multDelta: 0 },
        ],
        finalTotal: (9 + 30 + 10 + 5) * (5 + 3),
      }),
      baseCtx({ target: 10000 }),
    );
    const chipBeats = seq.beats.filter((b) => b.kind === 'upgrade-chip');
    expect(chipBeats).toHaveLength(2);
    expect(chipBeats.map((b) => (b.kind === 'upgrade-chip' ? b.chipDelta : -1))).toEqual([10, 5]);
  });

  it('emits upgrade-mult beat for each upgrade with non-zero multDelta', () => {
    const seq = buildScoreSequence(
      upgradeInput({
        upgrades: [
          { label: 'mod:scoreBonus@0', chipDelta: 10, multDelta: 0 },
          { label: 'mod:multBonus@1', chipDelta: 0, multDelta: 3 },
          { label: 'solar_flare', chipDelta: 0, multDelta: 7 },
        ],
        finalTotal: (9 + 30 + 10) * (5 + 3 + 7),
      }),
      baseCtx({ target: 10000 }),
    );
    const multBeats = seq.beats.filter((b) => b.kind === 'upgrade-mult');
    expect(multBeats).toHaveLength(2);
    expect(multBeats.map((b) => (b.kind === 'upgrade-mult' ? b.multDelta : -1))).toEqual([3, 7]);
  });

  it('emits chip beat before mult beat for the same event (chip-then-mult per event)', () => {
    const seq = buildScoreSequence(
      upgradeInput({
        upgrades: [{ label: 'mod:combined@0', chipDelta: 10, multDelta: 2 }],
        finalTotal: (9 + 30 + 10) * (5 + 2),
      }),
      baseCtx({ target: 10000 }),
    );
    const kinds = seq.beats.map((b) => b.kind);
    const chipIdx = kinds.indexOf('upgrade-chip');
    const multIdx = kinds.indexOf('upgrade-mult');
    expect(chipIdx).toBeGreaterThan(-1);
    expect(multIdx).toBeGreaterThan(-1);
    expect(chipIdx).toBeLessThan(multIdx);
  });

  it('upgrade-mult beats accumulate currentMult from baseMult', () => {
    const seq = buildScoreSequence(
      upgradeInput({
        baseMult: 5,
        upgrades: [
          { label: 'a', chipDelta: 0, multDelta: 3 },
          { label: 'b', chipDelta: 0, multDelta: 2 },
        ],
        finalTotal: 39 * 10, // (9+30) × (5+3+2)
      }),
      baseCtx({ target: 10000 }),
    );
    const multBeats = seq.beats.filter((b) => b.kind === 'upgrade-mult');
    expect(multBeats.map((b) => (b.kind === 'upgrade-mult' ? b.currentMult : -1))).toEqual([8, 10]);
  });

  it('chain mult-slam still fires when chain.mult != 1', () => {
    const seq = buildScoreSequence(
      upgradeInput({
        mults: [{ label: 'chain', value: 2 }],
        finalTotal: 195 * 2,
      }),
      baseCtx({ target: 10000 }),
    );
    const slams = seq.beats.filter((b) => b.kind === 'mult-slam');
    expect(slams).toHaveLength(1);
    if (slams[0]?.kind === 'mult-slam') expect(slams[0].label).toBe('chain');
  });

  it('cross-target fires based on runningChips × runningMult product', () => {
    // baseMult=5, faces=[4,4,4]→runningChips=12 after all dice → product=60 < 100
    // comboBonus=30 → chips=42, product=210 → crosses 100 at combo-bonus
    const seq = buildScoreSequence(
      upgradeInput({
        faces: [4, 4, 4],
        comboBonus: 30,
        baseMult: 5,
        upgrades: [],
        finalTotal: 42 * 5,
      }),
      baseCtx({ target: 100 }),
    );
    const crossings = seq.beats.filter((b) => b.kind === 'cross-target');
    expect(crossings).toHaveLength(1);
    const idx = seq.beats.findIndex((b) => b.kind === 'cross-target');
    expect(seq.beats[idx - 1]?.kind).toBe('combo-bonus');
  });

  it('holds standard structure: cast-swell → die-ticks → combo-bonus → upgrades → hold-breath → boom', () => {
    const seq = buildScoreSequence(
      upgradeInput({
        upgrades: [{ label: 'x', chipDelta: 5, multDelta: 1 }],
        finalTotal: (9 + 30 + 5) * (5 + 1),
      }),
      baseCtx({ target: 10000 }),
    );
    const kinds = seq.beats.map((b) => b.kind);
    expect(kinds[0]).toBe('cast-swell');
    expect(kinds.filter((k) => k === 'die-tick')).toHaveLength(3);
    expect(kinds).toContain('combo-bonus');
    expect(kinds).toContain('upgrade-chip');
    expect(kinds).toContain('upgrade-mult');
    expect(kinds).toContain('hold-breath');
    expect(kinds[kinds.length - 1]).toBe('boom');
  });
});
