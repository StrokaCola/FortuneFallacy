import { describe, it, expect } from 'vitest';
import { applyFaceRemaps, MODS, MOD_IDS, resolveMod } from './index';
import { MOD_MATERIALS, type ModMaterialKey } from '../../render/three/dieMaterials';

describe('applyFaceRemaps', () => {
  it('passes faces through when no mods are attached', () => {
    expect(applyFaceRemaps([1, 2, 3], [[], [], []]).faces).toEqual([1, 2, 3]);
  });

  it('loaded mod remaps 1 to 6 by default', () => {
    expect(applyFaceRemaps([1, 1, 5], [['loaded'], [], []]).faces).toEqual([6, 1, 5]);
  });

  it('lockOnes=true blocks loaded 1->6 remap', () => {
    expect(applyFaceRemaps([1, 1, 5], [['loaded'], ['loaded'], []], true).faces).toEqual([1, 1, 5]);
  });

  it('lockOnes=true does not affect non-1 dice', () => {
    expect(applyFaceRemaps([1, 4, 5], [['loaded'], [], []], true).faces).toEqual([1, 4, 5]);
  });

  it('backstop raises sub-min faces independently of lockOnes', () => {
    expect(applyFaceRemaps([1, 3, 5], [['backstop'], ['backstop'], []]).faces).toEqual([4, 4, 5]);
    expect(applyFaceRemaps([1, 3, 5], [['backstop'], ['backstop'], []], true).faces).toEqual([4, 4, 5]);
  });

  it('emits loaded onModFired event when 1->6 remap fires', () => {
    const result = applyFaceRemaps([1, 2, 5], [['loaded'], [], []]);
    const ev = result.events.find((e) => e.modId === 'loaded' && e.dieIdx === 0);
    expect(ev).toBeDefined();
    expect(ev?.faceValue).toBe(1); // pre-remap value
  });

  it('does NOT emit loaded onModFired when face is not 1', () => {
    const result = applyFaceRemaps([2, 3, 5], [['loaded'], [], []]);
    const ev = result.events.find((e) => e.modId === 'loaded');
    expect(ev).toBeUndefined();
  });

  it('emits backstop onModFired event when sub-min raise fires', () => {
    const result = applyFaceRemaps([1, 4, 5], [['backstop'], ['backstop'], []]);
    const ev = result.events.find((e) => e.modId === 'backstop' && e.dieIdx === 0);
    expect(ev).toBeDefined();
    expect(ev?.faceValue).toBe(1); // pre-raise value
  });

  it('does NOT emit backstop onModFired when face >= scoreMin', () => {
    const result = applyFaceRemaps([4, 5, 6], [['backstop'], ['backstop'], ['backstop']]);
    const ev = result.events.find((e) => e.modId === 'backstop');
    expect(ev).toBeUndefined();
  });
});

describe('D-2 mod entries', () => {
  it('pip_charge entry exists with chipPerPip: 2', () => {
    const m = MODS.find((x) => x.id === 'pip_charge');
    expect(m).toBeDefined();
    expect(m?.chipPerPip).toBe(2);
  });

  it('even_keel entry exists with evenFaceMult: 2', () => {
    const m = MODS.find((x) => x.id === 'even_keel');
    expect(m).toBeDefined();
    expect(m?.evenFaceMult).toBe(2);
  });

  it('mirror_pair entry exists with pairBonus: 3', () => {
    const m = MODS.find((x) => x.id === 'mirror_pair');
    expect(m).toBeDefined();
    expect(m?.pairBonus).toBe(3);
  });
});

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const VALID_TRIGGERS = new Set(['loaded', 'pipCharge', 'backstop', 'pulse']);

describe('MODS visual contract', () => {
  it('every mod has a visual block', () => {
    for (const m of MODS) {
      expect(m.visual, `mod ${m.id} missing visual`).toBeDefined();
    }
  });

  it('every visual.materialKey resolves in MOD_MATERIALS', () => {
    for (const m of MODS) {
      const key = m.visual!.materialKey as ModMaterialKey;
      expect(MOD_MATERIALS[key], `mod ${m.id} -> unknown material ${key}`).toBeDefined();
    }
  });

  it('every visual.accentColor is a #rrggbb hex string', () => {
    for (const m of MODS) {
      expect(m.visual!.accentColor).toMatch(HEX_RE);
    }
  });

  it('every visual.triggerFx is a valid family', () => {
    for (const m of MODS) {
      expect(VALID_TRIGGERS.has(m.visual!.triggerFx)).toBe(true);
    }
  });

  it('MOD_IDS and MODS list the same set of ids in the same order', () => {
    expect(MODS.map((m) => m.id)).toEqual([...MOD_IDS]);
  });
});

describe('order-aware mods', () => {
  it('vanguard mod exists with firstBonus: 5', () => {
    const m = MODS.find((x) => x.id === 'vanguard');
    expect(m).toBeDefined();
    expect(m?.firstBonus).toBe(5);
  });

  it('capstone mod exists with lastBonus: 10', () => {
    const m = MODS.find((x) => x.id === 'capstone');
    expect(m).toBeDefined();
    expect(m?.lastBonus).toBe(10);
  });

  it('conduit mod exists with chainMult: 1', () => {
    const m = MODS.find((x) => x.id === 'conduit');
    expect(m).toBeDefined();
    expect(m?.chainMult).toBe(1);
  });

  it('all 3 new mods have visual blocks with valid materialKey + accent + pulse trigger', () => {
    const ids = ['vanguard', 'capstone', 'conduit'] as const;
    for (const id of ids) {
      const m = MODS.find((x) => x.id === id);
      expect(m?.visual?.materialKey).toBe(id);
      expect(m?.visual?.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(m?.visual?.triggerFx).toBe('pulse');
    }
  });

  it('MODS has 13 entries total (10 prior + 3 new)', () => {
    expect(MODS.length).toBe(13);
  });

  it('MOD_IDS includes the 3 new ids', () => {
    expect(MOD_IDS).toContain('vanguard');
    expect(MOD_IDS).toContain('capstone');
    expect(MOD_IDS).toContain('conduit');
  });
});

describe('resolveMod', () => {
  it('returns undefined for undefined input', () => {
    expect(resolveMod(undefined)).toBeUndefined();
  });

  it('prefers id when both id and name are provided', () => {
    // Name says one mod, id says another — id should win.
    const r = resolveMod({ id: 'gilded', name: 'Renamed' });
    expect(r?.id).toBe('gilded');
  });

  it('falls back to name (case-insensitive) when id is absent', () => {
    const r = resolveMod({ name: 'sharpened' });
    expect(r?.id).toBe('sharpened');
  });

  it('falls back to name when id refers to no known mod', () => {
    const r = resolveMod({ id: 'nonexistent' as never, name: 'Loaded' });
    expect(r?.id).toBe('loaded');
  });

  it('returns undefined when neither id nor name resolves', () => {
    const r = resolveMod({ name: 'no-such-mod' });
    expect(r).toBeUndefined();
  });
});
