import { describe, it, expect } from 'vitest';
import { detectCombo } from './detectCombo';

describe('detectCombo with non-d6 face universe', () => {
  it('detects four-of-a-kind on d12 faces', () => {
    expect(detectCombo([7, 7, 7, 7, 11]).id).toBe('four_kind');
  });

  it('detects straight across face values 8..12 (d12 large straight)', () => {
    expect(detectCombo([8, 9, 10, 11, 12]).id).toBe('lg_straight');
  });

  it('skips non-numeric faces in count buckets', () => {
    // 'WILD' should not bucket; the rest is just chance.
    const r = detectCombo(['WILD' as unknown as number, 1, 2, 3, 4]);
    // No pair, but 1,2,3,4 form a length-4 run → small straight.
    expect(r.id).toBe('sm_straight');
  });
});

describe('detectCombo with raised thresholds (Mensa style)', () => {
  it('refuses Five-of-a-Kind on 5 matching when comboCountBonus=1', () => {
    // 5 matching dice + bonus=1 → needs 6 to qualify. Falls down to four_kind
    // (which needs 5 with bonus). Six dice where 5 match → still four_kind.
    const r = detectCombo([3, 3, 3, 3, 3, 6], { comboCtx: { comboCountBonus: 1, straightLenBonus: 0 } });
    expect(r.id).toBe('four_kind');
  });

  it('still detects Five-of-a-Kind on 6 matching with bonus=1', () => {
    const r = detectCombo([3, 3, 3, 3, 3, 3], { comboCtx: { comboCountBonus: 1, straightLenBonus: 0 } });
    expect(r.id).toBe('five_kind');
  });
});

describe('detectCombo with shifted straight thresholds (Triumvirate style)', () => {
  it('promotes 2-length runs to small straight when straightLenBonus = -2', () => {
    const r = detectCombo([5, 6, 11], { comboCtx: { comboCountBonus: 0, straightLenBonus: -2 } });
    expect(r.id).toBe('sm_straight');
  });
});
