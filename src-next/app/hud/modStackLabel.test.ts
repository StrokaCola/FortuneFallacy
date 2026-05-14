// Coverage for the per-mod stack-label formatter. Each branch is a
// distinct scaling-mod family; the formatter is small enough that a
// regression here is the clearest signal something drifted in the
// mod data shape.

import { describe, it, expect } from 'vitest';
import { lookupMod } from '../../core/mods';
import { formatModStackLabel } from './modStackLabel';

function defOf(id: string) {
  const m = lookupMod(id);
  if (!m) throw new Error(`missing mod fixture ${id}`);
  return m;
}

describe('formatModStackLabel', () => {
  it('returns null when stack is zero (badge hides)', () => {
    expect(formatModStackLabel(defOf('tally_mark'), 0)).toBeNull();
  });

  it('tally_mark: chips-per-stack', () => {
    expect(formatModStackLabel(defOf('tally_mark'), 4)).toBe('+4c');
  });

  it('cadence: mult-per-stack with (blind) qualifier', () => {
    expect(formatModStackLabel(defOf('cadence'), 3)).toBe('+3m (blind)');
  });

  it('veteran: half-mult-per-stack to 1 decimal', () => {
    expect(formatModStackLabel(defOf('veteran'), 5)).toBe('+2.5m');
  });

  it('glutton: chips-per-stack', () => {
    expect(formatModStackLabel(defOf('glutton'), 2)).toBe('+6c');
  });

  it('ballast: chips-per-stack', () => {
    expect(formatModStackLabel(defOf('ballast'), 3)).toBe('+15c');
  });

  it('pyre_mark: chips-per-stack', () => {
    expect(formatModStackLabel(defOf('pyre_mark'), 4)).toBe('+8c');
  });

  it('dormant: pre-awakening shows N/threshold', () => {
    expect(formatModStackLabel(defOf('dormant'), 7)).toBe('7/10');
  });

  it('dormant: post-awakening shows ★ awake', () => {
    expect(formatModStackLabel(defOf('dormant'), 10)).toBe('★ awake');
    expect(formatModStackLabel(defOf('dormant'), 15)).toBe('★ awake');
  });

  it('returns null for non-scaling mods (e.g. gilded)', () => {
    expect(formatModStackLabel(defOf('gilded'), 5)).toBeNull();
  });
});
