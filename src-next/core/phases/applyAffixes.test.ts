import { describe, it, expect } from 'vitest';
import { applyAffixes, applyAffixesPhase } from './applyAffixes';
import { mulberry32 } from '../rng';
import { generateAffixedItem } from '../../voidmode/affixGenerator';
import { BLIND_AFFIX_DEFS } from '../../voidmode/blindAffixes';
import type { CatalystMeta } from '../../data/catalysts';
import type { BlindDef } from '../../data/blinds';
import type { AffixContext, BlindRule } from '../../voidmode/types';
import type { PipelineCtx } from '../pipeline/types';
import type { GameState } from '../../state/store';
import { scoring } from './scoring';

const BASE: CatalystMeta = {
  id: 'burst_card', name: 'Burst Card', rarity: 'uncommon',
  archetypeTags: ['combo', 'scaling'],
} as unknown as CatalystMeta;

function makeCtx(overrides: Partial<AffixContext> = {}): AffixContext {
  return {
    chipsBonus: 0,
    multBonus: 0,
    goldBonus: 0,
    hand: { comboId: 'pair', diceValues: [3, 3, 1, 2, 4], isWild: [false, false, false, false, false] },
    run: { discardsRemaining: 3, handsRemaining: 4, catalystsOwned: 2, goldHeld: 12, seedDigit: 7 },
    trial: { rollsThisTrial: 1, isBossBlind: false },
    scratch: {},
    ...overrides,
  };
}

describe('applyAffixes', () => {
  it('is a no-op when no affixed items are present', () => {
    const ctx = makeCtx();
    applyAffixes(ctx, []);
    expect(ctx.chipsBonus).toBe(0);
    expect(ctx.multBonus).toBe(0);
    expect(ctx.goldBonus).toBe(0);
  });

  it('runs each affix effect on the context', () => {
    const item = generateAffixedItem(mulberry32(42), BASE);
    const ctx = makeCtx({ hand: { comboId: 'pair', diceValues: [3,3,1,2,4], isWild: [false,false,false,false,false] }});
    applyAffixes(ctx, [item]);
    // The generated item should have at least one affix attached given
    // archetypeTags: ['combo','scaling']. We don't pin a specific delta —
    // some affixes only fire on specific comboIds — but applying multiple
    // seeded items shouldn't leave the context entirely untouched across
    // multiple seeds. See the "across seeds" test below.
    expect(item.affixes.length).toBeGreaterThan(0);
  });

  it('produces non-zero context deltas for at least some seeds', () => {
    let anyChanged = false;
    for (let s = 0; s < 30; s++) {
      const item = generateAffixedItem(mulberry32(s), BASE);
      const ctx = makeCtx();
      applyAffixes(ctx, [item]);
      if (ctx.chipsBonus !== 0 || ctx.multBonus !== 0 || ctx.goldBonus !== 0) {
        anyChanged = true;
        break;
      }
    }
    expect(anyChanged).toBe(true);
  });

  it('does not throw for any affix family on a pair combo', () => {
    for (let s = 0; s < 30; s++) {
      const item = generateAffixedItem(mulberry32(s), BASE);
      const ctx = makeCtx();
      expect(() => applyAffixes(ctx, [item])).not.toThrow();
    }
  });

  it('applies a blind affix alongside catalyst affixes', () => {
    // Blind affix is the same shape (AffixedItem), so applyAffixes
    // iterates it identically. We confirm a blind-pool roll produces
    // non-zero deltas across some seeds — parallel to the catalyst case.
    const FAKE_BLIND: BlindDef & { id: string } = {
      id: 'lesser_trial',
      index: 0,
      name: 'Lesser Trial',
      targetMult: 1.0,
      isBoss: false,
      skipReward: 3,
      archetypeTags: ['timing', 'combo'],
    };
    let anyChanged = false;
    for (let s = 0; s < 30; s++) {
      const item = generateAffixedItem(mulberry32(s), FAKE_BLIND, { pool: BLIND_AFFIX_DEFS });
      const ctx = makeCtx({
        hand: { comboId: 'three_kind', diceValues: [3, 3, 3, 2, 4], isWild: [false, false, false, false, false] },
      });
      applyAffixes(ctx, [item]);
      if (ctx.chipsBonus !== 0 || ctx.multBonus !== 0 || ctx.goldBonus !== 0) {
        anyChanged = true;
        break;
      }
    }
    expect(anyChanged).toBe(true);
  });
});

// Phase 2B.2 — pipeline-level integration for banCombo. The phase
// adapter consults state.run.activeBlindRules and forces chips/mult to
// zero on a matching banned combo. The downstream scoring phase keeps
// the final total at 0 even if catalyst fires would otherwise add
// chips. Outside void mode the gate is a strict no-op.
function makePipelineCtx(opts: {
  mode: 'normal' | 'void';
  comboId: string;
  rules: BlindRule[];
  startChips?: number;
  startMult?: number;
}): PipelineCtx {
  return {
    state: {
      run: {
        mode: opts.mode,
        catalysts: [],
        catalystAffixes: {},
        consumableAffixes: {},
        blindAffixes: {},
        activeBlindRules: opts.rules,
        shards: 0,
        seed: 1,
        rollCounter: 0,
      },
      round: {
        active: true,
        blindId: 'lesser_trial',
        isBoss: false,
        rerollsLeft: 2,
        handsLeft: 3,
        scoringOrder: [0, 1, 2, 3, 4],
        chainLen: 0,
        chainTier: -1,
      },
    } as unknown as GameState,
    chips: opts.startChips ?? 30,
    mult: opts.startMult ?? 5,
    total: 0,
    events: [],
    rng: { next: () => 0 } as unknown as PipelineCtx['rng'],
    combo: { id: opts.comboId, tier: 1, baseChips: 0, baseMult: 0, scoringFaces: [] },
    sim: {
      finalFaces: [3, 3, 1, 2, 4],
      restPositions: [],
      settleMs: [],
      peakVelocity: 0,
      collisionCount: 0,
      bounceHeights: [],
    } as unknown as PipelineCtx['sim'],
  };
}

describe('applyAffixesPhase — banCombo rule (Phase 2B.2)', () => {
  it('is a strict no-op outside void mode', () => {
    const ctx = makePipelineCtx({
      mode: 'normal',
      comboId: 'one_pair',
      rules: [{ kind: 'banCombo', comboId: 'one_pair' }],
    });
    const next = applyAffixesPhase(ctx);
    // Outside void: phase doesn't run the rule check at all; ctx flows through.
    expect(next.chips).toBe(30);
    expect(next.mult).toBe(5);
  });

  it('zeros chips + mult when the detected combo is banned', () => {
    const ctx = makePipelineCtx({
      mode: 'void',
      comboId: 'one_pair',
      rules: [{ kind: 'banCombo', comboId: 'one_pair' }],
    });
    const next = applyAffixesPhase(ctx);
    expect(next.chips).toBe(0);
    expect(next.mult).toBe(0);
  });

  it('passes a non-banned combo through unchanged (no items, no rule match)', () => {
    const ctx = makePipelineCtx({
      mode: 'void',
      comboId: 'three_kind',
      rules: [{ kind: 'banCombo', comboId: 'one_pair' }],
    });
    const next = applyAffixesPhase(ctx);
    expect(next.chips).toBe(30);
    expect(next.mult).toBe(5);
  });

  it('scoring phase forces total to 0 for a banned combo even if catalysts added chips downstream', () => {
    // Simulate the state where applyAffixesPhase already zero'd chips/mult,
    // then a catalyst would have added 100 chips downstream. Scoring still
    // suppresses the hand.
    const ctx = makePipelineCtx({
      mode: 'void',
      comboId: 'one_pair',
      rules: [{ kind: 'banCombo', comboId: 'one_pair' }],
      startChips: 100,
      startMult: 4,
    });
    const next = scoring(ctx);
    expect(next.total).toBe(0);
  });

  it('scoring phase passes through normally for a non-banned combo', () => {
    const ctx = makePipelineCtx({
      mode: 'void',
      comboId: 'three_kind',
      rules: [{ kind: 'banCombo', comboId: 'one_pair' }],
      startChips: 30,
      startMult: 5,
    });
    const next = scoring(ctx);
    expect(next.total).toBeGreaterThan(0);
  });
});
