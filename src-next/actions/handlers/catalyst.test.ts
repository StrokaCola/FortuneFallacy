import { describe, it, expect } from 'vitest';
import { catalystHandler } from './catalyst';
import type { GameState } from '../../state/store';

const baseState = (): GameState => ({
  run: {
    seed: 1, shards: 0, ante: 1, goalIdx: 0, catalysts: [],
    vouchers: [], consumables: [], handsPlayed: 0, compoundingStacks: 0,
    constellationId: 'lyra',
  },
  round: { active: false, score: 0, dice: [] },
  shop: { open: false, offers: [], rerollCost: 5 },
  meta: { playerName: '', unlocks: [], highScores: [] },
  ui: { screen: 'hub', paused: false, tooltip: null, transition: 'idle' },
  pingCount: 0,
} as unknown as GameState);

describe('GRANT_CATALYST', () => {
  it('adds a catalyst id to the list', () => {
    const r = catalystHandler({ type: 'GRANT_CATALYST', id: 'conductor' }, baseState());
    expect(r.state.run.catalysts).toContain('conductor');
  });

  it('emits no events', () => {
    const r = catalystHandler({ type: 'GRANT_CATALYST', id: 'conductor' }, baseState());
    expect(r.events).toHaveLength(0);
  });

  it('is a no-op when the catalyst is already present', () => {
    const before = { ...baseState(), run: { ...baseState().run, catalysts: ['conductor'] } };
    const r = catalystHandler({ type: 'GRANT_CATALYST', id: 'conductor' }, before);
    expect(r.state.run.catalysts).toEqual(['conductor']);
    expect(r.state).toBe(before); // same reference — no new object created
  });

  it('can add multiple distinct catalysts', () => {
    let s = baseState();
    s = catalystHandler({ type: 'GRANT_CATALYST', id: 'conductor' }, s).state;
    s = catalystHandler({ type: 'GRANT_CATALYST', id: 'tempo' }, s).state;
    expect(s.run.catalysts).toEqual(['conductor', 'tempo']);
  });

  it('does not touch other state slices', () => {
    const before = baseState();
    const after = catalystHandler({ type: 'GRANT_CATALYST', id: 'quorum' }, before).state;
    expect(after.round).toBe(before.round);
    expect(after.shop).toBe(before.shop);
    expect(after.meta).toBe(before.meta);
  });
});

describe('REVOKE_CATALYST', () => {
  it('removes an existing catalyst', () => {
    const before = { ...baseState(), run: { ...baseState().run, catalysts: ['conductor', 'tempo'] } };
    const r = catalystHandler({ type: 'REVOKE_CATALYST', id: 'conductor' }, before);
    expect(r.state.run.catalysts).toEqual(['tempo']);
    expect(r.state.run.catalysts).not.toContain('conductor');
  });

  it('is a no-op for a catalyst not in the list', () => {
    const r = catalystHandler({ type: 'REVOKE_CATALYST', id: 'missing' }, baseState());
    expect(r.state.run.catalysts).toEqual([]);
  });

  it('emits no events', () => {
    const before = { ...baseState(), run: { ...baseState().run, catalysts: ['tempo'] } };
    const r = catalystHandler({ type: 'REVOKE_CATALYST', id: 'tempo' }, before);
    expect(r.events).toHaveLength(0);
  });
});
