import { describe, it, expect } from 'vitest';
import { store } from '../store';

describe('run slice — void mode defaults', () => {
  it('defaults mode to "normal"', () => {
    expect(store.getState().run.mode).toBe('normal');
  });

  it('defaults voidSeed to 0', () => {
    expect(store.getState().run.voidSeed).toBe(0);
  });
});
