import { describe, it, expect } from 'vitest';
import { startCosmicLap } from './transitions';
import { initialRunSlice } from '../../state/slices/run';
import { initialRoundSlice } from '../../state/slices/round';
import { initialShopSlice } from '../../state/slices/shop';
import { initialMetaSlice } from '../../state/slices/meta';
import { initialUiSlice } from '../../state/slices/ui';
import { initialTutorialSlice } from '../../state/slices/tutorial';
import type { GameState } from '../../state/store';

function mkState(overrides: Partial<GameState['run']> = {}): GameState {
  return {
    run: { ...initialRunSlice(), ante: 4, goalIdx: 11, ...overrides },
    round: { ...initialRoundSlice(), active: false },
    shop: initialShopSlice(),
    meta: initialMetaSlice(),
    ui: { ...initialUiSlice(), screen: 'win' },
    tutorial: initialTutorialSlice(),
    pingCount: 0,
  };
}

describe('startCosmicLap (Pillar D)', () => {
  it('increments endlessLap from 0 → 1', () => {
    const s = mkState({ endlessLap: 0 });
    const r = startCosmicLap(s);
    expect(r.state.run.endlessLap).toBe(1);
  });

  it('increments endlessLap from N → N+1', () => {
    const s = mkState({ endlessLap: 3 });
    const r = startCosmicLap(s);
    expect(r.state.run.endlessLap).toBe(4);
  });

  it('resets ante to 1 and goalIdx to 0', () => {
    const s = mkState({ ante: 4, goalIdx: 11 });
    const r = startCosmicLap(s);
    expect(r.state.run.ante).toBe(1);
    expect(r.state.run.goalIdx).toBe(0);
  });

  it('routes the player to the Hub', () => {
    const r = startCosmicLap(mkState());
    expect(r.state.ui.screen).toBe('hub');
  });

  it('assigns the lap-1 cosmic affliction', () => {
    const r = startCosmicLap(mkState({ endlessLap: 0 }));
    expect(r.state.run.cosmicAfflictionId).toBe('gravity');
  });

  it('preserves run-state (catalysts, vouchers, mods, shards)', () => {
    const s = mkState({
      catalysts: ['conductor', 'encore'],
      vouchers: ['bench'],
      shards: 42,
    });
    const r = startCosmicLap(s);
    expect(r.state.run.catalysts).toEqual(['conductor', 'encore']);
    expect(r.state.run.vouchers).toEqual(['bench']);
    expect(r.state.run.shards).toBe(42);
  });
});
