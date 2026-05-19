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
    // 2026-05-19 stacking afflictions — the field is now an array; lap 1
    // has exactly one entry (gravity is the only lapTrigger <= 1).
    expect(r.state.run.cosmicAfflictionIds).toEqual(['gravity']);
  });

  it('stacks every eligible affliction for the lap', () => {
    // 2026-05-19 stacking afflictions — lap 5 picks up gravity (1),
    // echoing_void (2), cold_constellation (3), shattered_sky (4), and
    // heat_death (5). Order is ascending by lapTrigger.
    const r = startCosmicLap(mkState({ endlessLap: 4 }));
    expect(r.state.run.cosmicAfflictionIds).toEqual([
      'gravity',
      'echoing_void',
      'cold_constellation',
      'shattered_sky',
      'heat_death',
    ]);
  });

  it('includes the new lap-15 singularity entry at very high laps', () => {
    const r = startCosmicLap(mkState({ endlessLap: 14 }));
    expect(r.state.run.cosmicAfflictionIds).toContain('singularity');
    expect(r.state.run.cosmicAfflictionIds).toContain('oblivion_pull');
    expect(r.state.run.cosmicAfflictionIds).toContain('void_tithe');
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
