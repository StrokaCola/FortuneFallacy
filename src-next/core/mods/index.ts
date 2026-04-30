import type { ModMaterialKey } from '../../render/three/dieMaterials';

// Canonical ordered list of mod ids. Source of truth for cross-module linkage:
// dieMaterials.ts derives ModMaterialKey from this list, so adding a mod here
// without a matching entry in MOD_MATERIALS is a TypeScript error.
export const MOD_IDS = [
  'amplify',
  'sharpened',
  'gilded',
  'loaded',
  'snake_eyes',
  'high_roller',
  'backstop',
  'pip_charge',
  'even_keel',
  'mirror_pair',
] as const;

export type ModId = typeof MOD_IDS[number];

export type ModVisual = {
  materialKey: ModMaterialKey;
  accentColor: string;                                       // #rrggbb
  geometricVariant?: 'asymmetric' | 'plated' | 'recessed';   // pilot 3 only; used by Phase 4
  triggerFx: 'loaded' | 'pipCharge' | 'backstop' | 'pulse';  // pilot or generic; used by Phase 5/6
};

export type ModDef = {
  id: ModId;
  name: string;
  icon: string;
  desc: string;
  scoreBonus?: number;
  multBonus?: number;
  shardsBonus?: number;
  faceRemap?: { from: number; to: number };
  highFaceMult?: number;
  snakeEyes?: number;
  scoreMin?: number;
  chipPerPip?: number;
  evenFaceMult?: number;
  pairBonus?: number;
  visual?: ModVisual;
};

export const MODS: ModDef[] = [
  {
    id: 'amplify', name: 'Amplify', icon: '⬆',
    desc: '+2 chips per scoring die', scoreBonus: 2,
    visual: { materialKey: 'amplify', accentColor: '#f5c451', triggerFx: 'pulse' },
  },
  {
    id: 'sharpened', name: 'Sharpened', icon: '▲',
    desc: '+1 mult per scoring die', multBonus: 1,
    visual: { materialKey: 'sharpened', accentColor: '#a4d4ff', triggerFx: 'pulse' },
  },
  {
    id: 'gilded', name: 'Gilded', icon: '◆',
    desc: '+1 shard on score', shardsBonus: 1,
    visual: { materialKey: 'gilded', accentColor: '#f5c451', triggerFx: 'pulse' },
  },
  {
    id: 'loaded', name: 'Loaded', icon: '⚔',
    desc: '1s count as 6', faceRemap: { from: 1, to: 6 },
    visual: { materialKey: 'loaded', accentColor: '#c87a4a', geometricVariant: 'asymmetric', triggerFx: 'loaded' },
  },
  {
    id: 'snake_eyes', name: 'Snake Eyes', icon: '①',
    desc: '+2 mult if face is 1', snakeEyes: 2,
    visual: { materialKey: 'snake_eyes', accentColor: '#7be3ff', triggerFx: 'pulse' },
  },
  {
    id: 'high_roller', name: 'High Roller', icon: '🎯',
    desc: '+1 mult if face is 5 or 6', highFaceMult: 1,
    visual: { materialKey: 'high_roller', accentColor: '#ff7847', triggerFx: 'pulse' },
  },
  {
    id: 'backstop', name: 'Backstop', icon: '✦',
    desc: 'Scores at least 4', scoreMin: 4,
    visual: { materialKey: 'backstop', accentColor: '#9bd0a8', geometricVariant: 'plated', triggerFx: 'backstop' },
  },
  {
    id: 'pip_charge', name: 'Pip Charge', icon: '⫶',
    desc: '+chips equal to face × 2 per scoring die', chipPerPip: 2,
    visual: { materialKey: 'pip_charge', accentColor: '#ffd84a', geometricVariant: 'recessed', triggerFx: 'pipCharge' },
  },
  {
    id: 'even_keel', name: 'Even Keel', icon: '⚖',
    desc: '+2 mult if face is even (2/4/6)', evenFaceMult: 2,
    visual: { materialKey: 'even_keel', accentColor: '#c0c8d8', triggerFx: 'pulse' },
  },
  {
    id: 'mirror_pair', name: 'Mirror Pair', icon: '⚉',
    desc: '+3 mult per other die in hand sharing this face', pairBonus: 3,
    visual: { materialKey: 'mirror_pair', accentColor: '#e0c8ff', triggerFx: 'pulse' },
  },
];

export const MAX_MOD_SLOTS = 2;

export function lookupMod(id: string): ModDef | undefined {
  return MODS.find((m) => m.id === id);
}

/**
 * Resolve a DieMod-shaped object (typically `{ id, name, ... }`) to its full
 * `ModDef`. Prefers stable `id` lookup; falls back to case-insensitive name
 * match if `id` is absent or doesn't resolve. Used by `DieView` to look up
 * primary/secondary/tertiary mods consistently.
 */
export function resolveMod(
  m: { id?: ModId; name: string } | undefined,
): ModDef | undefined {
  if (!m) return undefined;
  return (m.id ? MODS.find((mm) => mm.id === m.id) : undefined)
    ?? MODS.find((mm) => mm.name.toLowerCase() === m.name.toLowerCase());
}

export type FaceRemapResult = {
  faces: number[];
  events: { dieIdx: number; modId: string; faceValue: number }[];
};

export function applyFaceRemaps(
  faces: number[],
  diceMods: string[][],
  lockOnes = false,
): FaceRemapResult {
  const events: { dieIdx: number; modId: string; faceValue: number }[] = [];
  const remapped = faces.map((face, i) => {
    const mods = diceMods[i] ?? [];
    let f = face;
    for (const id of mods) {
      const def = lookupMod(id);
      if (def?.faceRemap && f === def.faceRemap.from) {
        if (lockOnes && def.faceRemap.from === 1) continue;
        // Emit before transforming so faceValue is the pre-remap value.
        events.push({ dieIdx: i, modId: id, faceValue: f });
        f = def.faceRemap.to;
      }
    }
    // Backstop: raise sub-min faces. Emit only if a raise actually happens.
    const minModEntry = mods
      .map((id) => ({ id, def: lookupMod(id) }))
      .find((m) => m.def?.scoreMin != null);
    if (minModEntry?.def?.scoreMin != null && f < minModEntry.def.scoreMin) {
      events.push({ dieIdx: i, modId: minModEntry.id, faceValue: f });
      f = minModEntry.def.scoreMin;
    }
    return f;
  });
  return { faces: remapped, events };
}
