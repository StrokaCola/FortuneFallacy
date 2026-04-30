# Star Forge Mod Visuals — Phase 2 (Material System) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all 10 mods to a unique idle material on the Three.js die — when a mod is attached, the central die in the Forge displays a phenomenologically-themed surface that layers over the player's chosen base die-style.

**Architecture:** A new `dieMaterials.ts` module exports `MOD_MATERIALS`, a record mapping each mod's `materialKey` to a partial-StyleDef override (body tint, edge color, halo color, transmission, IOR, roughness, plus newly-exposed metalness/sheen overrides). `ModDef` gains an optional `visual` block describing the mod's render-time identity. `buildDie` is extended to accept an optional override and merges it on top of the base style. `DieView` looks up the first attached mod's visual config (when present) and threads it through.

**Tech Stack:** TypeScript + React 18 + Three.js 0.169 + Vitest + jsdom. No new dependencies.

**Spec source:** `docs/superpowers/specs/2026-04-29-star-forge-mod-visuals-design.md` (Section "Per-Mod Idle Material" + "Architecture > Data shape" + "New modules > dieMaterials.ts").

**Phase 1 already shipped on `main`:** `webglDetect`, `buildDie` (extracted from `Dice3D.ts`), `sharedRenderer`, `DieView`, Forge dev flag (`ff_dieview_central`).

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src-next/render/three/dieMaterials.ts` | NEW | Exports `ModMaterialKey` type, `ModMaterialOverride` type, `MOD_MATERIALS` record. One entry per mod, values copied from spec Section 2. Pure data — no Three.js calls. |
| `src-next/render/three/dieMaterials.test.ts` | NEW | Tests every mod has a material entry, accent colors are valid hex, override values fall in expected numeric ranges. |
| `src-next/core/mods/index.ts` | MODIFY | Extend `ModDef` with optional `visual` field (`{ materialKey, accentColor, geometricVariant?, triggerFx }`). Add `visual` to all 10 entries in `MODS`. |
| `src-next/core/mods/index.test.ts` | NEW | Verify every mod has a visual block; verify materialKey matches a `MOD_MATERIALS` entry; verify accentColor is `#rrggbb`; verify triggerFx is one of the four valid values. |
| `src-next/render/three/buildDie.ts` | MODIFY | Extend `StyleDef` with optional `metalness`, `sheen`, `sheenColor`. Add optional 3rd parameter `modOverride?: ModMaterialOverride` to `buildDie()` — merges over the base style before building. Read `metalness`/`sheen`/`sheenColor` from the merged style instead of hardcoding. |
| `src-next/render/three/buildDie.test.ts` | MODIFY | Add tests: passing `modOverride` changes the body material color; existing 5-style behavior unchanged when no override. |
| `src-next/render/three/DieView.tsx` | MODIFY | Look up `props.mods?.[0]` → `lookupMod` → `mod.visual?.materialKey` → `MOD_MATERIALS[key]`. Pass result as 3rd arg to `buildDie`. Add `mods` to effect deps. |
| `src-next/render/three/DieView.test.tsx` | MODIFY | Add a test asserting `DieView` with a known mod prop builds a die whose body color reflects the mod's tint. |

**Decomposition rationale:** `dieMaterials.ts` is pure data (small, easy to tune). `ModDef.visual` adds one optional field — minimal type churn. `buildDie` extension is additive (existing 5 styles continue to work without modOverride). `DieView` change is a 3-line merge of mod lookup + buildDie call.

**Phase 2 explicitly defers:**
- Geometry tweaks for pilot 3 (Loaded asymmetry, Backstop rim, Pip Charge recess) — Phase 4.
- Orbital satellite for the secondary mod slot — Phase 3.
- Trigger FX (any of the four kinds) — Phases 5 & 6.
- CSS dice changes (the selector strip + tray + hold strip stay unchanged in Phase 2).

---

## Task 1: dieMaterials module

**Files:**
- Create: `src-next/render/three/dieMaterials.ts`
- Test: `src-next/render/three/dieMaterials.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src-next/render/three/dieMaterials.test.ts
import { describe, it, expect } from 'vitest';
import { MOD_MATERIALS, type ModMaterialKey } from './dieMaterials';

const ALL_KEYS: ModMaterialKey[] = [
  'amplify', 'sharpened', 'gilded', 'loaded', 'snake_eyes',
  'high_roller', 'backstop', 'pip_charge', 'even_keel', 'mirror_pair',
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

  it('has exactly 10 entries (one per mod)', () => {
    expect(Object.keys(MOD_MATERIALS).length).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/render/three/dieMaterials.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `dieMaterials.ts`**

```ts
// src-next/render/three/dieMaterials.ts

// Mod material keys — one per mod in src-next/core/mods/index.ts.
// MUST stay in sync with the mod ids there.
export type ModMaterialKey =
  | 'amplify'
  | 'sharpened'
  | 'gilded'
  | 'loaded'
  | 'snake_eyes'
  | 'high_roller'
  | 'backstop'
  | 'pip_charge'
  | 'even_keel'
  | 'mirror_pair';

// Partial StyleDef override applied on top of the base die-style. Anything
// not specified inherits from the player's chosen base style. Hex colors are
// numbers (Three.js convention); use `0xff7847` form.
export type ModMaterialOverride = {
  bodyTint?: number;
  bodyDeep?: number;
  edge?: number;
  pip?: number;
  halo?: number;
  eIntensity?: number;
  transmission?: number;
  thickness?: number;
  ior?: number;
  rough?: number;
  metalness?: number;
  sheen?: number;
  sheenColor?: number;
};

// Each mod's phenomenological material — see spec Section "Per-Mod Idle
// Material" for the source-of-truth descriptions.
export const MOD_MATERIALS: Record<ModMaterialKey, ModMaterialOverride> = {
  // 1. Amplify — Sound-wave amplifier; brushed brass, low transmission, ringing edge.
  amplify: {
    bodyTint: 0xc89042, bodyDeep: 0x4a2e10,
    edge: 0xf5c451, halo: 0xf5c451,
    transmission: 0.18, rough: 0.55, ior: 1.45, eIntensity: 1.4,
  },
  // 2. Sharpened — Honed obsidian; mirror-polish edges, cool steel emissive.
  sharpened: {
    bodyTint: 0x4a4d6b, bodyDeep: 0x07051a,
    edge: 0xa4d4ff, halo: 0xa4d4ff,
    transmission: 0.12, rough: 0.20, ior: 1.60, eIntensity: 1.6,
  },
  // 3. Gilded — Gold leaf plating; high metalness, gold sheen, warm IOR.
  gilded: {
    bodyTint: 0xf5c451, bodyDeep: 0xa07820,
    edge: 0xfff7e0, halo: 0xf5c451,
    transmission: 0.08, rough: 0.35, ior: 1.55, eIntensity: 1.0,
    metalness: 0.85, sheen: 0.55, sheenColor: 0xf5c451,
  },
  // 4. Loaded — Asymmetric mass; bronze-shifted, deep sheen.
  loaded: {
    bodyTint: 0xc87a4a, bodyDeep: 0x4a1e08,
    edge: 0xc87a4a, halo: 0xc87a4a,
    transmission: 0.20, rough: 0.45, thickness: 0.95,
  },
  // 5. Snake Eyes — Paired stars; deep midnight blue, cyan pinpricks.
  snake_eyes: {
    bodyTint: 0x1a1f4a, bodyDeep: 0x07051a,
    edge: 0x7be3ff, halo: 0x7be3ff,
    transmission: 0.20, eIntensity: 1.7,
  },
  // 6. High Roller — Plasma corona; higher emissive, faint outer halo.
  high_roller: {
    bodyTint: 0xff6a3a, bodyDeep: 0x5a1408,
    edge: 0xff7847, halo: 0xff7847,
    transmission: 0.40, eIntensity: 2.4,
  },
  // 7. Backstop — Ceramic safety plate; matte ceramic, milky transmission.
  backstop: {
    bodyTint: 0xb8d4be, bodyDeep: 0x3e5a45,
    edge: 0x9bd0a8, halo: 0x9bd0a8,
    transmission: 0.50, rough: 0.70, eIntensity: 0.8,
  },
  // 8. Pip Charge — Capacitor / electric charge; dark glassy body, amber pulse.
  pip_charge: {
    bodyTint: 0x1a1a3a, bodyDeep: 0x07051a,
    edge: 0xffd84a, halo: 0xffd84a,
    transmission: 0.05, eIntensity: 1.5, rough: 0.25,
  },
  // 9. Even Keel — Gyroscopic balance; polished symmetric, cool neutral.
  even_keel: {
    bodyTint: 0xc0c8d8, bodyDeep: 0x6a7080,
    edge: 0xdde2ec, halo: 0xc0c8d8,
    transmission: 0.15, rough: 0.20, metalness: 0.4, eIntensity: 1.0,
  },
  // 10. Mirror Pair — Reflective twin; glassy chrome, mirror IOR, ghost silhouette.
  mirror_pair: {
    bodyTint: 0xe0c8ff, bodyDeep: 0x6a4a8a,
    edge: 0xe0c8ff, halo: 0xe0c8ff,
    transmission: 0.20, rough: 0.05, ior: 1.70, metalness: 0.95,
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src-next/render/three/dieMaterials.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src-next/render/three/dieMaterials.ts src-next/render/three/dieMaterials.test.ts
git commit -m "feat(render): add MOD_MATERIALS table for all 10 mods"
```

---

## Task 2: Extend ModDef + add visual block to all 10 mods

**Files:**
- Modify: `src-next/core/mods/index.ts`
- Test: `src-next/core/mods/index.test.ts` (NEW)

- [ ] **Step 1: Write the failing test**

```ts
// src-next/core/mods/index.test.ts
import { describe, it, expect } from 'vitest';
import { MODS } from './index';
import { MOD_MATERIALS, type ModMaterialKey } from '../../render/three/dieMaterials';

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/core/mods/index.test.ts`
Expected: FAIL — `m.visual` undefined.

- [ ] **Step 3: Modify `src-next/core/mods/index.ts` — extend ModDef and update all 10 entries.**

Replace the file with this updated version:

```ts
import type { ModMaterialKey } from '../../render/three/dieMaterials';

export type ModVisual = {
  materialKey: ModMaterialKey;
  accentColor: string;                                       // #rrggbb
  geometricVariant?: 'asymmetric' | 'plated' | 'recessed';   // pilot 3 only; used by Phase 4
  triggerFx: 'loaded' | 'pipCharge' | 'backstop' | 'pulse';  // pilot or generic; used by Phase 5/6
};

export type ModDef = {
  id: string;
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

export function applyFaceRemaps(
  faces: number[],
  diceMods: string[][],
  lockOnes = false,
): number[] {
  return faces.map((face, i) => {
    const mods = diceMods[i] ?? [];
    let f = face;
    for (const id of mods) {
      const def = lookupMod(id);
      if (def?.faceRemap && f === def.faceRemap.from) {
        if (lockOnes && def.faceRemap.from === 1) continue;
        f = def.faceRemap.to;
      }
    }
    const minMod = mods.map(lookupMod).find((d) => d?.scoreMin != null);
    if (minMod?.scoreMin != null && f < minMod.scoreMin) f = minMod.scoreMin;
    return f;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src-next/core/mods/index.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run full suite to confirm no regression**

Run: `npm test`
Expected: All tests pass (240 expected: 234 baseline + 4 new mods tests + 4 new dieMaterials tests if Task 1 already ran in this branch; otherwise 238 new = 234 + 4).

- [ ] **Step 6: Commit**

```bash
git add src-next/core/mods/index.ts src-next/core/mods/index.test.ts
git commit -m "feat(mods): add visual block to ModDef + entries for all 10 mods"
```

---

## Task 3: Extend StyleDef + buildDie with mod-material override

**Files:**
- Modify: `src-next/render/three/buildDie.ts`
- Modify: `src-next/render/three/buildDie.test.ts`

- [ ] **Step 1: Write the failing test (additive — keep existing 4 tests)**

Add these tests to `src-next/render/three/buildDie.test.ts`. Place them inside the existing `describe('buildDie', () => { ... })` block, after the existing tests:

```ts
  it('respects modOverride bodyTint over base style', () => {
    const built = buildDie(0.85, 'celestial', { bodyTint: 0xff0000, bodyDeep: 0x000000 });
    const body = built.group.children.find((c) => c.name === 'Body') as THREE.Mesh;
    const mat = body.material as THREE.MeshPhysicalMaterial;
    // sheenColor defaults to bodyTint when not overridden — so it should be red.
    expect(mat.sheenColor.getHex()).toBe(0xff0000);
  });

  it('respects modOverride.metalness', () => {
    const built = buildDie(0.85, 'celestial', { metalness: 0.85 });
    const body = built.group.children.find((c) => c.name === 'Body') as THREE.Mesh;
    const mat = body.material as THREE.MeshPhysicalMaterial;
    expect(mat.metalness).toBe(0.85);
  });

  it('without modOverride, base style metalness defaults to 0', () => {
    const built = buildDie(0.85, 'celestial');
    const body = built.group.children.find((c) => c.name === 'Body') as THREE.Mesh;
    const mat = body.material as THREE.MeshPhysicalMaterial;
    expect(mat.metalness).toBe(0);
  });
```

- [ ] **Step 2: Run test to verify the new tests fail**

Run: `npm test -- src-next/render/three/buildDie.test.ts`
Expected: 3 of the 3 new tests fail (function doesn't accept a 3rd parameter; metalness is hardcoded to 0).

- [ ] **Step 3: Modify `buildDie.ts`**

(a) Add the `metalness`/`sheen`/`sheenColor` optional fields to `StyleDef`. Replace lines 7–12 with:

```ts
export type StyleDef = {
  bodyTint: number; bodyDeep: number;
  edge: number; pip: number; halo: number;
  eIntensity: number;
  transmission: number; thickness: number; ior: number; rough: number;
  // Optional — defaults applied in buildDie when not set on the resolved style.
  metalness?: number;
  sheen?: number;
  sheenColor?: number;
};
```

(b) Import the override type from `dieMaterials`. Add this import after the `RoundedBoxGeometry` import on line 3:

```ts
import type { ModMaterialOverride } from './dieMaterials';
```

(c) Change the `buildDie` signature on line 73 to accept an optional 3rd parameter, and resolve the style by merging:

```ts
export function buildDie(
  size: number,
  styleKey: StyleKey,
  modOverride?: ModMaterialOverride,
): BuiltDie {
  const baseS = STYLES[styleKey];
  const S: StyleDef = modOverride ? { ...baseS, ...modOverride } : baseS;
  const group = new THREE.Group();
  group.name = `FortuneFallacyDie_${styleKey}`;
```

(d) Replace the `bodyMat` constructor block (lines 96–112 in the current file) to read `metalness`, `sheen`, and `sheenColor` from `S` with sensible defaults:

```ts
  const bodyMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    metalness: S.metalness ?? 0.0,
    roughness: S.rough,
    transmission: S.transmission,
    thickness: S.thickness,
    ior: S.ior,
    attenuationColor: new THREE.Color(S.bodyDeep),
    attenuationDistance: size * 1.4,
    clearcoat: 0.55,
    clearcoatRoughness: 0.73,
    sheen: S.sheen ?? 0.28,
    sheenColor: new THREE.Color(S.sheenColor ?? S.bodyTint),
    sheenRoughness: 0.6,
    transparent: true,
    opacity: 1.0,
    envMapIntensity: 1.1,
  });
```

(Don't touch anything else — pip materials, edge lines, lens/halo prototypes, face placement loop all stay the same.)

- [ ] **Step 4: Run test to verify all tests pass**

Run: `npm test -- src-next/render/three/buildDie.test.ts`
Expected: PASS, all 7 tests (4 original + 3 new).

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src-next/render/three/buildDie.ts src-next/render/three/buildDie.test.ts
git commit -m "feat(render): buildDie accepts modOverride to layer mod material on base style"
```

---

## Task 4: Wire mod material into DieView

**Files:**
- Modify: `src-next/render/three/DieView.tsx`
- Modify: `src-next/render/three/DieView.test.tsx`

- [ ] **Step 1: Write the failing test (additive)**

Add this import at the top of `src-next/render/three/DieView.test.tsx` (alongside the existing imports):

```ts
import * as buildDieMod from './buildDie';
```

Add this test inside the existing `describe('DieView', () => { ... })` block:

```ts
  it('passes the first mod\'s material override to buildDie', () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const spy = vi.spyOn(buildDieMod, 'buildDie');
    const mods = [{ icon: '◆', name: 'Gilded', color: '#f5c451' }];
    // The component looks up by mod.name (case-insensitive). 'Gilded' resolves to
    // the gilded mod whose materialKey is 'gilded' — its bodyTint is 0xf5c451.
    const { unmount } = render(<DieView size={140} face={1} mods={mods} />);
    expect(spy).toHaveBeenCalled();
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    const override = lastCall[2];
    expect(override?.bodyTint).toBe(0xf5c451);
    unmount();
  });
```

Note 1: the test depends on a small prop convention added in Step 3 below — `DieView` resolves the first mod's `name` (case-insensitive) to a `ModDef` from `MODS`. This avoids changing `Die3DCSS.DieMod` shape (which only carries `{ icon, name, color }`, no `id`).

Note 2: for `vi.spyOn` to actually intercept, `DieView.tsx` must import `buildDie` via a namespace alias (just like Phase 1's `webglDetect`). Step 3 below converts the `buildDie` import to `import * as buildDieMod from './buildDie'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/render/three/DieView.test.tsx`
Expected: 1 of 4 tests fails — `buildDie` was called with no override.

- [ ] **Step 3: Modify `DieView.tsx`**

(a) Convert the `buildDie` import to a namespace alias so `vi.spyOn` can intercept calls. Find:

```ts
import { buildDie, type StyleKey } from './buildDie';
```

Replace with:

```ts
import * as buildDieMod from './buildDie';
import type { StyleKey } from './buildDie';
```

(b) Add new imports near the top (after the existing imports):

```ts
import { MODS } from '../../core/mods';
import { MOD_MATERIALS } from './dieMaterials';
```

(c) Inside `useEffect`, after the `if (!webglDetect.hasWebGL() || !ref.current) return;` line, look up the first mod's material override and thread it into `buildDie`:

Find the line:
```ts
const built = buildDie(0.85, style);
```

Replace with:
```ts
const firstModName = props.mods?.[0]?.name?.toLowerCase();
const matchedMod = firstModName
  ? MODS.find((m) => m.name.toLowerCase() === firstModName)
  : undefined;
const modKey = matchedMod?.visual?.materialKey;
const modOverride = modKey ? MOD_MATERIALS[modKey] : undefined;
const built = buildDieMod.buildDie(0.85, style, modOverride);
```

(d) Update the effect deps array to include `mods` (so a mod attach/detach in Forge triggers a die rebuild). Find:

```ts
}, [face, style]);
```

Change to:

```ts
}, [face, style, props.mods]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src-next/render/three/DieView.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test`
Expected: All tests pass.

Run: `npx tsc --noEmit`
Expected: No new error categories beyond the pre-existing TS7016 baseline.

- [ ] **Step 6: Commit**

```bash
git add src-next/render/three/DieView.tsx src-next/render/three/DieView.test.tsx
git commit -m "feat(render): DieView threads first mod's material override into buildDie"
```

---

## Task 5: Manual verification + acceptance check

**Acceptance criteria** (from spec — Material system):

- [ ] For each of 10 mods: attach to a die in Forge → idle die displays correct material per spec table.
- [ ] Existing 5 die-styles continue to work unchanged when no mod is attached.
- [ ] All 10 mods readable at selector-strip 56px size — out of scope this phase (selector strip stays CSS until Phase 7); record observed behaviour but don't block on it.

**Steps:**

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` from the worktree (or via `preview_start` if using the harness).
Expected: Vite dev server prints a localhost URL.

- [ ] **Step 2: Toggle the dev flag and reach Forge**

In the browser console:

```js
window.localStorage.setItem('ff_dieview_central', '1');
location.reload();
```

Open the dev console (`debug` button), click the `screen` tab, click `forge`. Confirm the central die renders via Three.js (data-die-view present).

- [ ] **Step 3: Cycle through all 10 mods**

For each mod in the codex (right panel of Forge): click to attach, observe the central die material change, click to detach (via the bottom-row detach buttons), confirm the die returns to the celestial base style.

Confirm visually:
- Amplify → brushed brass body, gold accent.
- Sharpened → cool steel/obsidian body, ice-blue edges and halo.
- Gilded → gold metallic body with gold sheen.
- Loaded → bronze body, deep sheen.
- Snake Eyes → midnight blue body, cyan emissive accents.
- High Roller → orange/ember body, plasma corona feel.
- Backstop → matte ceramic green body.
- Pip Charge → near-black glassy body with amber accents.
- Even Keel → cool silver body with mild metallic.
- Mirror Pair → glassy chrome lavender body.

If any mod looks wrong vs the description above, note which one and which property looks off. The numeric overrides in `dieMaterials.ts` are first-pass values and can be tuned in a follow-up commit; flag the mod, don't block.

- [ ] **Step 4: Confirm base styles unchanged**

Detach all mods. Confirm the celestial die looks identical to its Phase 1 appearance. Optionally, in the dev console:

```js
// (after Phase 7 wires up other styles, this would let you swap. For Phase 2,
// the central die hardcodes 'celestial' in Forge.tsx — just visually compare
// to a screenshot of Phase 1's central die.)
```

- [ ] **Step 5: Run full automated suite**

Run: `npm test` and `npm run build` and `npx tsc --noEmit`.
Expected: tests pass; production build succeeds; no new typecheck errors.

- [ ] **Step 6: No commit needed**

If Steps 3 surfaced a value that needs tuning, fix it in `dieMaterials.ts` and commit separately:

```bash
git add src-next/render/three/dieMaterials.ts
git commit -m "tune(render): adjust <mod> material — <one-line reason>"
```

Otherwise, Phase 2 is complete.

---

## Verification (whole phase, automated)

Run from the worktree root:

- [ ] `npm test` → all tests pass (existing 234 + 4 dieMaterials + 4 mods + 3 buildDie + 1 DieView = **246 expected**).
- [ ] `npx tsc --noEmit` → no new TypeScript error categories.
- [ ] `npm run build` → production build succeeds.

---

## Out of Scope (later phases)

- Geometry tweaks for pilot 3 (asymmetric / plated / recessed) — Phase 4.
- Orbital satellite for the secondary mod slot — Phase 3.
- Generic pulse + pilot-3 trigger phenomena — Phase 5 + 6.
- CSS dice migration (selector strip, tray, hold strip) — Phase 7.
- Tuning material parameters beyond first-pass values — opportunistic follow-up.

---

## Notes / Open Risks

- **First-pass material values.** The numeric overrides in `dieMaterials.ts` are educated guesses derived from the spec's phenomenological descriptions. Some mods (especially Gilded with high metalness, and Mirror Pair with mirror IOR) may need visual tuning after the first run. Plan keeps this in Task 5 Step 6 as an opportunistic fix, not a blocker.
- **Stack handling out of scope.** When 2+ mods are attached, `DieView` only applies the *first* mod's material in this phase. The orbital satellite for the secondary mod ships in Phase 3. Until then, the player sees only the primary mod's material — the secondary mod's badge still appears in the corner via the existing badge system.
- **`MOD_MATERIALS` tied to mod ids.** Adding a new mod in `src-next/core/mods/index.ts` requires a matching entry in `MOD_MATERIALS`. The `index.test.ts` cross-check guards this.
- **`mods` in effect deps.** Adding `props.mods` to the deps array means a mod attach/detach in Forge causes a full die rebuild. For a single central die that's fine. The Phase 1 code-quality reviewer flagged this rebuild cost as an issue for many concurrent dice — Phase 7 migration should split DieView's effect into mount/update halves before tray/hold-strip migration. Out of scope here.
