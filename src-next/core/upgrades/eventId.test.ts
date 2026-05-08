import { describe, it, expect } from 'vitest';
import { catalystIdFromEvent } from './eventId';

describe('catalystIdFromEvent', () => {
  it('returns the id unchanged for a plain catalyst fire', () => {
    expect(catalystIdFromEvent('stratifier')).toBe('stratifier');
    expect(catalystIdFromEvent('encore')).toBe('encore');
  });

  it('strips the @-suffix for catalyst@dieIdx ids', () => {
    expect(catalystIdFromEvent('gilding_press@2')).toBe('gilding_press');
    expect(catalystIdFromEvent('gilding_press@0')).toBe('gilding_press');
  });

  it('extracts the catalyst id from an edition-prefixed event', () => {
    expect(catalystIdFromEvent('edition:foil@stratifier')).toBe('stratifier');
    expect(catalystIdFromEvent('edition:holo@encore')).toBe('encore');
    expect(catalystIdFromEvent('edition:poly@six_bias')).toBe('six_bias');
  });

  it('returns null for mod-prefixed events (not a catalyst fire)', () => {
    expect(catalystIdFromEvent('mod:loaded@3')).toBe(null);
    expect(catalystIdFromEvent('mod:crownMul@1')).toBe(null);
  });

  it('returns null for empty input', () => {
    expect(catalystIdFromEvent('')).toBe(null);
  });

  it('returns null for malformed edition events without an @', () => {
    expect(catalystIdFromEvent('edition:foil')).toBe(null);
  });
});
