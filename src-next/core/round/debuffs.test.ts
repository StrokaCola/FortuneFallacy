import { describe, it, expect } from 'vitest';
import { activeDebuffs } from './debuffs';
import { initialRoundSlice } from '../../state/slices/round';
import { initialRunSlice } from '../../state/slices/run';
import { initialShopSlice } from '../../state/slices/shop';
import { initialMetaSlice } from '../../state/slices/meta';
import { initialUiSlice } from '../../state/slices/ui';
import type { GameState } from '../../state/store';

function mkState(blindId: string, bossPhase: 1 | 2): GameState {
  return {
    run: initialRunSlice(),
    round: { ...initialRoundSlice(), isBoss: true, blindId, bossPhase },
    shop: initialShopSlice(),
    meta: initialMetaSlice(),
    ui: initialUiSlice(),
    pingCount: 0,
  };
}

describe('activeDebuffs — phase escalation (Pillar B)', () => {
  it('phase 1 returns only base boss debuffs (Pluto)', () => {
    const set = activeDebuffs(mkState('pluto', 1));
    expect(set.has('no_mod_transforms_on_ones')).toBe(true);
    expect(set.has('no_rerolls')).toBe(false);
  });

  it('phase 2 unions secondWind.debuffs (Pluto)', () => {
    const set = activeDebuffs(mkState('pluto', 2));
    expect(set.has('no_mod_transforms_on_ones')).toBe(true);
    // Pluto phase-2 caps hand size rather than killing rerolls. The
    // softer escalation was tuned in via the sim sweep.
    expect(set.has('hand_size_cap_4')).toBe(true);
  });

  it('Callisto phase 2 RELAXES — removeDebuffs lifts the silence', () => {
    const phase1 = activeDebuffs(mkState('callisto', 1));
    expect(phase1.has('disable_catalysts')).toBe(true);
    const phase2 = activeDebuffs(mkState('callisto', 2));
    expect(phase2.has('disable_catalysts')).toBe(false);
  });

  it('non-boss blinds return an empty debuff set regardless of phase', () => {
    const s: GameState = {
      run: initialRunSlice(),
      round: { ...initialRoundSlice(), isBoss: false, blindId: 'lesser_trial', bossPhase: 2 },
      shop: initialShopSlice(),
      meta: initialMetaSlice(),
      ui: initialUiSlice(),
      pingCount: 0,
    };
    expect(activeDebuffs(s).size).toBe(0);
  });

  it('Eris phase 2 stacks the mod-cap on top of the catalyst lock', () => {
    const set = activeDebuffs(mkState('eris', 2));
    expect(set.has('disable_catalysts_first_2_hands')).toBe(true);
    expect(set.has('mod_slots_capped_1')).toBe(true);
  });

  it('Sedna phase 2 unions no_mod_transforms_on_ones with the slot cap', () => {
    const set = activeDebuffs(mkState('sedna', 2));
    expect(set.has('mod_slots_capped_1')).toBe(true);
    expect(set.has('no_mod_transforms_on_ones')).toBe(true);
  });
});
