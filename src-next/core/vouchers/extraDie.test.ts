// extra_die voucher: round-trip through getDiceSpec to confirm the
// constellation's dice array is extended by one when the voucher is
// owned, and that the appended die mirrors the constellation's last
// die (so Fibonacci stays Fibonacci, Eclipse stays Eclipse).
import { describe, it, expect } from 'vitest';
import { getDiceSpec } from '../run/diceContext';
import { lookupConstellation } from '../../data/constellations';
import type { GameState } from '../../state/store';

function makeState(vouchers: string[], constellationId = 'lyra'): GameState {
  return {
    run: { vouchers, constellationId },
  } as unknown as GameState;
}

describe('extra_die voucher (Sixth Star)', () => {
  it('does nothing when not owned', () => {
    const s = makeState([], 'lyra');
    const spec = getDiceSpec(s);
    const base = lookupConstellation('lyra').dice;
    expect(spec.length).toBe(base.length);
  });

  it('adds one die to lyra (5 → 6)', () => {
    const s = makeState(['extra_die'], 'lyra');
    const base = lookupConstellation('lyra').dice;
    const spec = getDiceSpec(s);
    expect(spec.length).toBe(base.length + 1);
  });

  it('appended die copies the constellation\'s last die (faces match)', () => {
    const s = makeState(['extra_die'], 'fibonacci');
    const base = lookupConstellation('fibonacci').dice;
    const spec = getDiceSpec(s);
    expect(spec[spec.length - 1]?.faces).toEqual(base[base.length - 1]?.faces);
  });

  it('works on argo (1-die constellation: 1 → 2)', () => {
    const s = makeState(['extra_die'], 'argo');
    const base = lookupConstellation('argo').dice;
    const spec = getDiceSpec(s);
    expect(spec.length).toBe(base.length + 1);
  });

  it('does not double-apply when other vouchers are also owned', () => {
    const s = makeState(['bench', 'extra_die', 'open_mic'], 'lyra');
    const base = lookupConstellation('lyra').dice;
    const spec = getDiceSpec(s);
    expect(spec.length).toBe(base.length + 1);
  });
});
