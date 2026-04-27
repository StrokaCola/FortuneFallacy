import { describe, it, expect } from 'vitest';
import { detectCombo } from './detectCombo';

describe('detectCombo', () => {
  const cases: { faces: number[]; id: string; chips: number; mult: number }[] = [
    { faces: [5, 5, 5, 5, 5], id: 'five_kind',   chips: 100, mult: 20 },
    { faces: [6, 6, 6, 6, 1], id: 'four_kind',   chips: 60,  mult: 12 },
    { faces: [1, 2, 3, 4, 5], id: 'lg_straight', chips: 40,  mult: 7  },
    { faces: [2, 3, 4, 5, 6], id: 'lg_straight', chips: 40,  mult: 7  },
    { faces: [3, 3, 3, 2, 2], id: 'full_house',  chips: 35,  mult: 8  },
    { faces: [1, 2, 3, 4, 6], id: 'sm_straight', chips: 30,  mult: 5  },
    { faces: [4, 4, 4, 1, 2], id: 'three_kind',  chips: 30,  mult: 5  },
    { faces: [5, 5, 3, 3, 1], id: 'two_pair',    chips: 20,  mult: 3  },
    { faces: [6, 6, 1, 2, 3], id: 'one_pair',    chips: 10,  mult: 2  },
    { faces: [3, 4, 5, 6, 2], id: 'lg_straight', chips: 40,  mult: 7  },
    { faces: [1, 2, 3, 4, 6], id: 'sm_straight', chips: 30,  mult: 5  },
    { faces: [3, 4, 5, 6, 1], id: 'sm_straight', chips: 30,  mult: 5  },
  ];

  for (const c of cases) {
    it(`[${c.faces.join(',')}] → ${c.id}`, () => {
      const r = detectCombo(c.faces);
      expect(r.id).toBe(c.id);
      expect(r.chips).toBe(c.chips);
      expect(r.mult).toBe(c.mult);
    });
  }

  it('falls back to chance for empty', () => {
    const r = detectCombo([]);
    expect(r.id).toBe('chance');
  });

  it('two_pair beats one_pair', () => {
    const r = detectCombo([2, 2, 5, 5, 6]);
    expect(r.id).toBe('two_pair');
  });

  it('full_house beats three_kind', () => {
    const r = detectCombo([4, 4, 4, 2, 2]);
    expect(r.id).toBe('full_house');
  });
});
