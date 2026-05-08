import { describe, it, expect } from 'vitest';
import { catalystIdFromEvent, resonanceIdFromEvent } from './eventId';

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

  it('returns null for resonance events (those go through resonanceIdFromEvent)', () => {
    expect(catalystIdFromEvent('resonance:symphony')).toBe(null);
    expect(catalystIdFromEvent('resonance:loaded_die')).toBe(null);
  });
});

describe('resonanceIdFromEvent', () => {
  it('extracts the pair id from a resonance fire event', () => {
    expect(resonanceIdFromEvent('resonance:symphony')).toBe('symphony');
    expect(resonanceIdFromEvent('resonance:loaded_die')).toBe('loaded_die');
  });

  it('returns null for non-resonance events', () => {
    expect(resonanceIdFromEvent('stratifier')).toBe(null);
    expect(resonanceIdFromEvent('mod:loaded@3')).toBe(null);
    expect(resonanceIdFromEvent('edition:foil@stratifier')).toBe(null);
    expect(resonanceIdFromEvent('')).toBe(null);
  });
});
