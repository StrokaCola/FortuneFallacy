import { describe, it, expect } from 'vitest';
import { grantStipend, STIPEND_CAP } from './stipend';
import type { GameState } from '../../../state/store';

function makeState(catalysts: string[], shards: number): GameState {
  return { run: { catalysts, shards } } as unknown as GameState;
}

describe('grantStipend', () => {
  it('does nothing when stipend not owned', () => {
    expect(grantStipend(makeState([], 0)).run.shards).toBe(0);
  });

  it('grants +1 shard when owned and below cap', () => {
    expect(grantStipend(makeState(['stipend'], 0)).run.shards).toBe(1);
    expect(grantStipend(makeState(['stipend'], 4)).run.shards).toBe(5);
  });

  it('skips when shards already at or above cap', () => {
    expect(grantStipend(makeState(['stipend'], STIPEND_CAP)).run.shards).toBe(STIPEND_CAP);
    expect(grantStipend(makeState(['stipend'], STIPEND_CAP + 5)).run.shards).toBe(STIPEND_CAP + 5);
  });
});
