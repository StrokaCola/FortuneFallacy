import { describe, it, expect } from 'vitest';
import { EVENTS, lookupEvent, getEventForBlind } from './events';

describe('events registry (Pillar C)', () => {
  it('contains at least 8 entries', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(8);
  });

  it('all ids are unique', () => {
    const ids = EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every event has at least 2 choices', () => {
    for (const e of EVENTS) {
      expect(e.choices.length, `${e.id} too few choices`).toBeGreaterThanOrEqual(2);
    }
  });

  it('every choice has an effects array (possibly empty)', () => {
    for (const e of EVENTS) {
      for (const c of e.choices) {
        expect(Array.isArray(c.effects)).toBe(true);
      }
    }
  });
});

describe('getEventForBlind', () => {
  it('returns null for boss blinds', () => {
    expect(getEventForBlind(1234, 5, 2, true)).toBeNull();
  });

  it('returns null on ante 1', () => {
    expect(getEventForBlind(1234, 0, 1, false)).toBeNull();
    expect(getEventForBlind(1234, 1, 1, false)).toBeNull();
  });

  it('returns null on ante 4', () => {
    expect(getEventForBlind(1234, 9, 4, false)).toBeNull();
  });

  it('may return an event id on antes 2 or 3', () => {
    let hit = false;
    for (let i = 0; i < 200; i++) {
      const id = getEventForBlind(i * 9001, i % 6 + 3, 2, false);
      if (id) {
        hit = true;
        expect(EVENTS.find((e) => e.id === id)).toBeTruthy();
        break;
      }
    }
    expect(hit, 'expected at least one event spawn across 200 seeds').toBe(true);
  });

  it('is deterministic for the same inputs', () => {
    const a = getEventForBlind(1234, 4, 2, false);
    const b = getEventForBlind(1234, 4, 2, false);
    expect(a).toBe(b);
  });
});

describe('lookupEvent', () => {
  it('finds an event by id', () => {
    expect(lookupEvent('wandering_oracle')?.name).toBe('The Wandering Oracle');
  });

  it('returns undefined for unknown / nullish ids', () => {
    expect(lookupEvent(null)).toBeUndefined();
    expect(lookupEvent('not_an_event')).toBeUndefined();
  });
});
