// src-next/render/three/dieMaterials.test.ts
import { describe, it, expect } from 'vitest';
import { MOD_MATERIALS, type ModMaterialKey } from './dieMaterials';

const ALL_KEYS: ModMaterialKey[] = [
  'amplify', 'sharpened', 'gilded', 'loaded', 'snake_eyes',
  'high_roller', 'backstop', 'pip_charge', 'even_keel', 'mirror_pair',
  'vanguard', 'capstone', 'conduit',
];

describe('MOD_MATERIALS', () => {
  it('has an entry for every mod material key', () => {
    for (const k of ALL_KEYS) {
      expect(MOD_MATERIALS[k], `missing entry for ${k}`).toBeDefined();
    }
  });

  it('every entry sets bodyTint and bodyDeep', () => {
    for (const k of ALL_KEYS) {
      const m = MOD_MATERIALS[k];
      expect(typeof m.bodyTint).toBe('number');
      expect(typeof m.bodyDeep).toBe('number');
    }
  });

  it('numeric overrides fall in expected ranges', () => {
    for (const k of ALL_KEYS) {
      const m = MOD_MATERIALS[k];
      if (m.transmission != null) expect(m.transmission).toBeGreaterThanOrEqual(0);
      if (m.transmission != null) expect(m.transmission).toBeLessThanOrEqual(1);
      if (m.rough != null) expect(m.rough).toBeGreaterThanOrEqual(0);
      if (m.rough != null) expect(m.rough).toBeLessThanOrEqual(1);
      if (m.metalness != null) expect(m.metalness).toBeGreaterThanOrEqual(0);
      if (m.metalness != null) expect(m.metalness).toBeLessThanOrEqual(1);
      if (m.ior != null) expect(m.ior).toBeGreaterThanOrEqual(1);
      if (m.ior != null) expect(m.ior).toBeLessThanOrEqual(2.5);
    }
  });

  it('has exactly 19 entries (one per mod)', () => {
    expect(Object.keys(MOD_MATERIALS).length).toBe(19);
  });
});
