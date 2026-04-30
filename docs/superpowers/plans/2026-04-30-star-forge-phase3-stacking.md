# Star Forge Mod Visuals — Phase 3 (Stacking) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a small orbital satellite around the die when a *secondary* mod is attached, and a rim-band around the die's equator when a *tertiary* mod is attached (voucher-only). Plus harden the mod lookup to prefer ids over display names.

**Architecture:** Two new pure mesh builders (`orbitalSatellite.ts`, `rimOverlay.ts`) following the same pattern as `buildDie.ts`: a single function that returns a `THREE.Group` plus disposal handles. `DieView` mounts these into its scene alongside the die, animates the satellite via the existing per-instance rAF loop, and tears them down via the existing cleanup path. `DieMod` gains an optional `id?: ModId` field; `Forge.tsx` now populates it; `DieView` prefers id-based lookup with a name-fallback for safety.

**Tech Stack:** TypeScript + React 18 + Three.js 0.169 + Vitest + jsdom. No new dependencies.

**Spec source:** `docs/superpowers/specs/2026-04-29-star-forge-mod-visuals-design.md` (Section "Stacking Rules" + the per-mod accent colors in Section "Per-Mod Idle Material").

**Phases 1+2 already shipped on `main`:** `webglDetect`, `buildDie`, `sharedRenderer`, `DieView`, `MOD_MATERIALS`, `ModDef.visual`, `buildDie` modOverride, Forge dev flag, Forge codex accent colors.

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src-next/app/visual/Die3DCSS.tsx` | MODIFY | Extend `DieMod` type with optional `id?: ModId` field. Existing `{ icon, name, color }` consumers unchanged (id is optional). |
| `src-next/app/screens/Forge.tsx` | MODIFY | Populate `id: r.id` when building `selectedMods` from looked-up `ModDef`s. |
| `src-next/render/three/DieView.tsx` | MODIFY | Prefer id-based lookup (fall back to name). Build + register orbital satellite when `mods[1]` is present. Build + register rim-overlay when `mods[2]` is present (and shift secondary's role accordingly per spec). Animate satellite via existing rAF. Dispose both on unmount. Hide satellite at `size < 80` px. |
| `src-next/render/three/DieView.test.tsx` | MODIFY | Add tests: id-based lookup wins over name match; satellite group is created when 2 mods present; rim+satellite created when 3 mods; nothing extra when 0–1 mods. |
| `src-next/render/three/orbitalSatellite.ts` | NEW | Pure factory: `buildOrbitalSatellite(opts) → { group, dispose }` returning a `THREE.Group` containing a small chip mesh + halo sprite. Caller drives orbit via `setAngle(t)`. |
| `src-next/render/three/orbitalSatellite.test.ts` | NEW | Tests: returns Group with one mesh + sprite; `setAngle` mutates position correctly; `dispose` releases geometry/material. |
| `src-next/render/three/rimOverlay.ts` | NEW | Pure factory: `buildRimOverlay(opts) → { group, dispose }` returning a `THREE.Group` containing a thin torus welded to the die equator, accent-colored. |
| `src-next/render/three/rimOverlay.test.ts` | NEW | Tests: returns Group with one mesh; geometry is a torus of the right radius; dispose cleans up. |

**Decomposition rationale:** Two pure mesh builders mirror the existing `buildDie.ts` pattern — one responsibility each, no React, no scene mounting. `DieView` is the integration point that consumes both. The carry-over (id-based lookup) is a small change colocated with the integration since both need to coordinate.

**Phase 3 explicitly defers:**
- Geometry tweaks for pilot 3 (Loaded asymmetry, Backstop rim-thicken, Pip Charge pip-recess) — Phase 4. Note: Phase 4's "Backstop rim-thicken" geometry is on the *die body*, distinct from this phase's *secondary-mod rim-overlay*. Both can coexist.
- Trigger FX (Phase 5/6).
- CSS dice migration (Phase 7).
- Glyph rendering on the satellite (deferred — start with a colored chip; SDF text is its own subproject).

---

## Task 1: Extend DieMod with id + update Forge + DieView lookup

**Files:**
- Modify: `src-next/app/visual/Die3DCSS.tsx` (one-line type extension)
- Modify: `src-next/app/screens/Forge.tsx` (one extra field in selectedMods map)
- Modify: `src-next/render/three/DieView.tsx` (prefer id, fallback name)
- Modify: `src-next/render/three/DieView.test.tsx` (add id-lookup test)

- [ ] **Step 1: Add the id-lookup-wins test (failing)**

In `src-next/render/three/DieView.test.tsx`, add this test inside the existing `describe('DieView', () => { ... })` block:

```ts
  it('looks up mod by id when available (preferring id over name)', () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const spy = vi.spyOn(buildDieMod, 'buildDie');
    // Pass a "mismatched name" — name says one thing, id says another. The id
    // should win; the override should be the gilded mod's bodyTint.
    const mods = [{ id: 'gilded' as const, icon: '◆', name: 'Renamed', color: '#f5c451' }];
    const { unmount } = render(<DieView size={140} face={1} mods={mods} />);
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    expect(lastCall[2]?.bodyTint).toBe(0xf5c451);
    unmount();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/render/three/DieView.test.tsx`
Expected: FAIL — `id` field on `DieMod` doesn't exist or isn't preferred by lookup.

- [ ] **Step 3: Extend `DieMod` type in `Die3DCSS.tsx`**

Find:
```ts
export type DieMod = { icon: string; name: string; color: string };
```

Replace with:
```ts
import type { ModId } from '../../core/mods';

export type DieMod = { id?: ModId; icon: string; name: string; color: string };
```

(Add the `import type` at the top of the file alongside existing imports.)

- [ ] **Step 4: Update `DieView.tsx` lookup to prefer id**

Find the existing block:

```ts
    // Phase 2: only the first mod's material is applied. ...
    const firstModName = props.mods?.[0]?.name?.toLowerCase();
    const matchedMod = firstModName
      ? MODS.find((m) => m.name.toLowerCase() === firstModName)
      : undefined;
    const modKey = matchedMod?.visual?.materialKey;
    const modOverride = modKey ? MOD_MATERIALS[modKey] : undefined;
    const built = buildDieMod.buildDie(0.85, style, modOverride);
```

Replace with:

```ts
    // Phase 3: lookup by id (preferred) with name fallback for backward
    // compatibility. Secondary/tertiary mods get orbital satellite + rim-band
    // (built later in this effect).
    const firstMod = props.mods?.[0];
    const matchedMod = firstMod
      ? (firstMod.id ? MODS.find((m) => m.id === firstMod.id) : undefined)
        ?? MODS.find((m) => m.name.toLowerCase() === firstMod.name.toLowerCase())
      : undefined;
    const modKey = matchedMod?.visual?.materialKey;
    const modOverride = modKey ? MOD_MATERIALS[modKey] : undefined;
    const built = buildDieMod.buildDie(0.85, style, modOverride);
```

- [ ] **Step 5: Update `Forge.tsx` selectedMods to populate id**

Find the existing block:

```ts
  const selectedMods = useMemo(
    () => slots
      .map(lookupMod)
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => ({ icon: r.icon, name: r.name, color: '#7be3ff' })),
    [slots],
  );
```

Replace with:

```ts
  const selectedMods = useMemo(
    () => slots
      .map(lookupMod)
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => ({ id: r.id, icon: r.icon, name: r.name, color: r.visual?.accentColor ?? '#7be3ff' })),
    [slots],
  );
```

(Two changes: `id: r.id` is now populated, and the `color` field uses the mod's `visual.accentColor` instead of hard-coded cyan — this addresses the Phase 2 review's M-5 minor about CSS-fallback chip color.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src-next/render/three/DieView.test.tsx`
Expected: PASS, 5 tests (4 prior + 1 new id-lookup test).

- [ ] **Step 7: Run full suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src-next/app/visual/Die3DCSS.tsx src-next/app/screens/Forge.tsx src-next/render/three/DieView.tsx src-next/render/three/DieView.test.tsx
git commit -m "feat(render): DieMod carries optional id, DieView prefers id-based lookup"
```

---

## Task 2: orbitalSatellite builder

**Files:**
- Create: `src-next/render/three/orbitalSatellite.ts`
- Create: `src-next/render/three/orbitalSatellite.test.ts`

**Design:** A pure factory that returns a `THREE.Group` with two children: a small chip (sphere) and a soft halo sprite. The caller drives orbit position by calling `setAngle(radians)` per frame. The group is positioned in a tilted plane so the satellite arcs above/below the die's equator slightly.

- [ ] **Step 1: Write the failing test**

```ts
// src-next/render/three/orbitalSatellite.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as THREE from 'three';
import { buildOrbitalSatellite } from './orbitalSatellite';

// jsdom canvas-2d stub — required because buildOrbitalSatellite uses the same
// halo texture as buildDie via getHaloTexture().
beforeAll(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  (HTMLCanvasElement.prototype as any).__origGetContext = orig;
  HTMLCanvasElement.prototype.getContext = function (type: string) {
    if (type === '2d') {
      return {
        createRadialGradient: () => ({ addColorStop: () => {} }),
        fillRect: () => {},
        set fillStyle(_v: string) {},
      };
    }
    return null;
  } as any;
});

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = (HTMLCanvasElement.prototype as any).__origGetContext;
});

describe('buildOrbitalSatellite', () => {
  it('returns a Group with a chip mesh and a halo sprite', () => {
    const sat = buildOrbitalSatellite({ accentColor: '#7be3ff', dieSize: 0.85 });
    expect(sat.group).toBeInstanceOf(THREE.Group);
    const types = sat.group.children.map((c) => c.type);
    expect(types).toContain('Mesh');
    expect(types).toContain('Sprite');
  });

  it('chip diameter is ~12% of die size', () => {
    const sat = buildOrbitalSatellite({ accentColor: '#7be3ff', dieSize: 0.85 });
    const mesh = sat.group.children.find((c) => c.type === 'Mesh') as THREE.Mesh;
    const sphere = mesh.geometry as THREE.SphereGeometry;
    // SphereGeometry stores its radius parameter on .parameters
    expect(sphere.parameters.radius).toBeCloseTo(0.85 * 0.06, 3);
  });

  it('setAngle moves the chip in a circular orbit at radius ~die size * 0.7', () => {
    const sat = buildOrbitalSatellite({ accentColor: '#7be3ff', dieSize: 1.0 });
    sat.setAngle(0);
    const p0 = sat.group.children[0]!.position.clone();
    sat.setAngle(Math.PI / 2);
    const p1 = sat.group.children[0]!.position.clone();
    // After a 90° rotation the position should differ — distance between
    // the two points on a circle of radius r is r * sqrt(2).
    const dist = p0.distanceTo(p1);
    expect(dist).toBeGreaterThan(0.5);
    expect(dist).toBeLessThan(2.0);
  });

  it('dispose releases mesh geometry and material', () => {
    const sat = buildOrbitalSatellite({ accentColor: '#7be3ff', dieSize: 0.85 });
    const mesh = sat.group.children.find((c) => c.type === 'Mesh') as THREE.Mesh;
    const geomDisposed = vi.fn();
    const matDisposed = vi.fn();
    mesh.geometry.dispose = geomDisposed as any;
    (mesh.material as THREE.Material).dispose = matDisposed as any;
    sat.dispose();
    expect(geomDisposed).toHaveBeenCalled();
    expect(matDisposed).toHaveBeenCalled();
  });
});
```

(`vi` is included in the imports above for the dispose-spy test.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/render/three/orbitalSatellite.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `orbitalSatellite.ts`**

```ts
// src-next/render/three/orbitalSatellite.ts
import * as THREE from 'three';
import { getHaloTexture } from './buildDie';

export type OrbitalSatelliteOpts = {
  accentColor: string;          // hex string, e.g. '#7be3ff'
  glyph?: string;               // reserved for future SDF text; ignored in Phase 3
  dieSize: number;              // world-space size of the parent die
  tilt?: number;                // orbital plane tilt in radians; default 15°
};

export type OrbitalSatellite = {
  group: THREE.Group;
  setAngle: (radians: number) => void;
  dispose: () => void;
};

// Orbit radius is ~70% of die-size away from the die center, putting the
// satellite just outside the die's silhouette.
const ORBIT_RADIUS_FACTOR = 0.7;
// Chip diameter is ~12% of the die size per spec.
const CHIP_DIAMETER_FACTOR = 0.12;

export function buildOrbitalSatellite(opts: OrbitalSatelliteOpts): OrbitalSatellite {
  const { accentColor, dieSize, tilt = (15 * Math.PI) / 180 } = opts;
  const group = new THREE.Group();
  group.name = 'OrbitalSatellite';
  // Tilt the orbital plane around the X axis so the satellite arcs above/below
  // the die equator rather than orbiting flat.
  group.rotation.x = tilt;

  const chipRadius = (dieSize * CHIP_DIAMETER_FACTOR) / 2;
  const orbitRadius = dieSize * ORBIT_RADIUS_FACTOR;

  // Chip — small emissive sphere in the accent color.
  const chipGeo = new THREE.SphereGeometry(chipRadius, 16, 12);
  const chipMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.4,
    metalness: 0.0,
    roughness: 0.4,
    toneMapped: false,
  });
  const chip = new THREE.Mesh(chipGeo, chipMat);
  chip.name = 'Chip';
  group.add(chip);

  // Halo sprite — soft glow behind the chip for visual punch.
  const haloMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: accentColor,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const halo = new THREE.Sprite(haloMat);
  const haloSize = chipRadius * 5.0;
  halo.scale.set(haloSize, haloSize, 1);
  halo.name = 'Halo';
  group.add(halo);

  // Initialize at angle 0.
  setAngle(0);

  function setAngle(radians: number): void {
    const x = orbitRadius * Math.cos(radians);
    const z = orbitRadius * Math.sin(radians);
    chip.position.set(x, 0, z);
    halo.position.set(x, 0, z);
  }

  function dispose(): void {
    chipGeo.dispose();
    chipMat.dispose();
    haloMat.dispose();
    // The shared halo texture is module-cached and not disposed here.
  }

  return { group, setAngle, dispose };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src-next/render/three/orbitalSatellite.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src-next/render/three/orbitalSatellite.ts src-next/render/three/orbitalSatellite.test.ts
git commit -m "feat(render): add buildOrbitalSatellite — chip + halo sprite mesh factory"
```

---

## Task 3: rimOverlay builder

**Files:**
- Create: `src-next/render/three/rimOverlay.ts`
- Create: `src-next/render/three/rimOverlay.test.ts`

**Design:** A thin torus welded to the die's equator (radius ≈ die-size / 2 + a tiny offset to avoid z-fighting), accent-colored, slightly emissive. Pure factory like `orbitalSatellite`.

- [ ] **Step 1: Write the failing test**

```ts
// src-next/render/three/rimOverlay.test.ts
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { buildRimOverlay } from './rimOverlay';

describe('buildRimOverlay', () => {
  it('returns a Group with one TorusGeometry mesh', () => {
    const rim = buildRimOverlay({ accentColor: '#7be3ff', dieSize: 0.85 });
    expect(rim.group).toBeInstanceOf(THREE.Group);
    const meshes = rim.group.children.filter((c) => c.type === 'Mesh');
    expect(meshes).toHaveLength(1);
    const mesh = meshes[0] as THREE.Mesh;
    expect(mesh.geometry).toBeInstanceOf(THREE.TorusGeometry);
  });

  it('torus radius hugs the die equator (~die-size / 2 with small outset)', () => {
    const rim = buildRimOverlay({ accentColor: '#7be3ff', dieSize: 1.0 });
    const mesh = rim.group.children.find((c) => c.type === 'Mesh') as THREE.Mesh;
    const torus = mesh.geometry as THREE.TorusGeometry;
    expect(torus.parameters.radius).toBeGreaterThan(0.50);
    expect(torus.parameters.radius).toBeLessThan(0.60);
  });

  it('dispose releases geometry and material', () => {
    const rim = buildRimOverlay({ accentColor: '#7be3ff', dieSize: 0.85 });
    const mesh = rim.group.children.find((c) => c.type === 'Mesh') as THREE.Mesh;
    const geomDisposed = vi.fn();
    const matDisposed = vi.fn();
    mesh.geometry.dispose = geomDisposed as any;
    (mesh.material as THREE.Material).dispose = matDisposed as any;
    rim.dispose();
    expect(geomDisposed).toHaveBeenCalled();
    expect(matDisposed).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/render/three/rimOverlay.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `rimOverlay.ts`**

```ts
// src-next/render/three/rimOverlay.ts
import * as THREE from 'three';

export type RimOverlayOpts = {
  accentColor: string;     // hex string, e.g. '#7be3ff'
  dieSize: number;         // world-space size of the parent die
};

export type RimOverlay = {
  group: THREE.Group;
  dispose: () => void;
};

// Hair-line outset to avoid z-fighting against the die body.
const RIM_OUTSET = 0.012;
// Tube thickness as fraction of die size.
const RIM_TUBE_FACTOR = 0.022;

export function buildRimOverlay(opts: RimOverlayOpts): RimOverlay {
  const { accentColor, dieSize } = opts;
  const group = new THREE.Group();
  group.name = 'RimOverlay';

  const major = dieSize / 2 + RIM_OUTSET;
  const tube = dieSize * RIM_TUBE_FACTOR;
  const geom = new THREE.TorusGeometry(major, tube, 12, 64);
  const mat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.2,
    metalness: 0.0,
    roughness: 0.45,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  // Lay the torus flat on the die's equator (XZ plane). TorusGeometry's
  // default plane is XY — rotate so the band wraps around the Y axis.
  mesh.rotation.x = Math.PI / 2;
  mesh.name = 'RimBand';
  group.add(mesh);

  function dispose(): void {
    geom.dispose();
    mat.dispose();
  }

  return { group, dispose };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src-next/render/three/rimOverlay.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src-next/render/three/rimOverlay.ts src-next/render/three/rimOverlay.test.ts
git commit -m "feat(render): add buildRimOverlay — thin torus band for tertiary mod slot"
```

---

## Task 4: Wire orbital satellite + rim into DieView

**Files:**
- Modify: `src-next/render/three/DieView.tsx`
- Modify: `src-next/render/three/DieView.test.tsx`

**Design:** Inside the existing `useEffect`, after the die is built and added to the scene:

1. If `props.mods?.[1]` (secondary) is present and `props.mods.length === 2`: build orbital satellite using the secondary mod's accent color, add to scene, drive `setAngle` from the rAF loop.
2. If `props.mods?.[2]` (tertiary) is present and `props.mods.length === 3`: secondary becomes a rim-overlay (built from secondary's accent), tertiary takes the orbital slot (built from tertiary's accent).
3. Hide the orbital satellite when `size < 80` (legibility check from spec — rim still shows).
4. Dispose all in cleanup.

- [ ] **Step 1: Add the satellite-presence test (failing)**

In `src-next/render/three/DieView.test.tsx`, add this test inside the existing `describe('DieView', () => { ... })`:

```ts
  it('builds an orbital satellite when 2 mods are attached', async () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const orbitalMod = await import('./orbitalSatellite');
    const spy = vi.spyOn(orbitalMod, 'buildOrbitalSatellite');
    const mods = [
      { id: 'gilded' as const, icon: '◆', name: 'Gilded', color: '#f5c451' },
      { id: 'sharpened' as const, icon: '▲', name: 'Sharpened', color: '#a4d4ff' },
    ];
    const { unmount } = render(<DieView size={140} face={1} mods={mods} />);
    expect(spy).toHaveBeenCalled();
    // Secondary's accent color should drive the satellite.
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1]!;
    expect(lastCall[0].accentColor).toBe('#a4d4ff');
    unmount();
  });

  it('builds rim+satellite when 3 mods are attached (voucher case)', async () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const orbitalMod = await import('./orbitalSatellite');
    const rimMod = await import('./rimOverlay');
    const orbitalSpy = vi.spyOn(orbitalMod, 'buildOrbitalSatellite');
    const rimSpy = vi.spyOn(rimMod, 'buildRimOverlay');
    const mods = [
      { id: 'gilded' as const, icon: '◆', name: 'Gilded', color: '#f5c451' },
      { id: 'sharpened' as const, icon: '▲', name: 'Sharpened', color: '#a4d4ff' },
      { id: 'loaded' as const, icon: '⚔', name: 'Loaded', color: '#c87a4a' },
    ];
    const { unmount } = render(<DieView size={140} face={1} mods={mods} />);
    // Rim is built from secondary's accent.
    expect(rimSpy).toHaveBeenCalled();
    expect(rimSpy.mock.calls[rimSpy.mock.calls.length - 1]![0].accentColor).toBe('#a4d4ff');
    // Orbital satellite is built from tertiary's accent.
    expect(orbitalSpy).toHaveBeenCalled();
    expect(orbitalSpy.mock.calls[orbitalSpy.mock.calls.length - 1]![0].accentColor).toBe('#c87a4a');
    unmount();
  });

  it('does NOT build a satellite at size < 80', async () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const orbitalMod = await import('./orbitalSatellite');
    const spy = vi.spyOn(orbitalMod, 'buildOrbitalSatellite');
    const mods = [
      { id: 'gilded' as const, icon: '◆', name: 'Gilded', color: '#f5c451' },
      { id: 'sharpened' as const, icon: '▲', name: 'Sharpened', color: '#a4d4ff' },
    ];
    const { unmount } = render(<DieView size={56} face={1} mods={mods} />);
    expect(spy).not.toHaveBeenCalled();
    unmount();
  });
```

(Add `import * as orbitalMod from './orbitalSatellite';` and `import * as rimMod from './rimOverlay';` to the test file's imports if you prefer top-of-file mocking — the inline `await import(...)` pattern above works for spy-based interception without static imports.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/render/three/DieView.test.tsx`
Expected: 3 of the 3 new tests fail (satellite/rim builders aren't called yet).

- [ ] **Step 3: Modify `DieView.tsx`**

(a) Add imports near the top (after the existing imports):

```ts
import * as orbitalMod from './orbitalSatellite';
import * as rimMod from './rimOverlay';
```

(b) Inside `useEffect`, after `scene.add(built.group);` and before the `const camera = ...` line, insert:

```ts
    // Resolve the secondary + tertiary mod definitions (if present) the same
    // way as primary — id preferred, name fallback.
    function resolveMod(m: DieMod | undefined) {
      if (!m) return undefined;
      return (m.id ? MODS.find((mm) => mm.id === m.id) : undefined)
        ?? MODS.find((mm) => mm.name.toLowerCase() === m.name.toLowerCase());
    }
    const secondary = resolveMod(props.mods?.[1]);
    const tertiary = resolveMod(props.mods?.[2]);

    // 2-mod case: secondary drives orbital satellite (hidden at small sizes).
    // 3-mod case: secondary drives rim, tertiary drives orbital satellite.
    const SATELLITE_MIN_SIZE = 80;
    const showSatellite = size >= SATELLITE_MIN_SIZE;

    let orbital: ReturnType<typeof orbitalMod.buildOrbitalSatellite> | null = null;
    let rim: ReturnType<typeof rimMod.buildRimOverlay> | null = null;

    if (props.mods?.length === 2 && secondary?.visual?.accentColor && showSatellite) {
      orbital = orbitalMod.buildOrbitalSatellite({
        accentColor: secondary.visual.accentColor,
        dieSize: 0.85,
      });
      scene.add(orbital.group);
    } else if (props.mods?.length === 3) {
      if (secondary?.visual?.accentColor) {
        rim = rimMod.buildRimOverlay({
          accentColor: secondary.visual.accentColor,
          dieSize: 0.85,
        });
        scene.add(rim.group);
      }
      if (tertiary?.visual?.accentColor && showSatellite) {
        orbital = orbitalMod.buildOrbitalSatellite({
          accentColor: tertiary.visual.accentColor,
          dieSize: 0.85,
        });
        scene.add(orbital.group);
      }
    }
```

(c) Update the existing `tick` function (idle tumble rAF) to also drive the satellite orbit. Find:

```ts
    const tick = () => {
      const dt = (performance.now() - t0) / 1000;
      built.group.rotation.set(
        baseEuler[0] + Math.sin(dt * 0.45) * 0.07,
        baseEuler[1] + Math.sin(dt * 0.60 + 1.0) * 0.05,
        baseEuler[2] + Math.sin(dt * 0.50 + 2.1) * 0.07,
      );
      tumbleHandleRef.current = requestAnimationFrame(tick);
    };
```

Replace with:

```ts
    const ORBIT_PERIOD_S = 8;
    const tick = () => {
      const dt = (performance.now() - t0) / 1000;
      built.group.rotation.set(
        baseEuler[0] + Math.sin(dt * 0.45) * 0.07,
        baseEuler[1] + Math.sin(dt * 0.60 + 1.0) * 0.05,
        baseEuler[2] + Math.sin(dt * 0.50 + 2.1) * 0.07,
      );
      if (orbital) {
        const angle = (dt / ORBIT_PERIOD_S) * Math.PI * 2;
        orbital.setAngle(angle);
      }
      tumbleHandleRef.current = requestAnimationFrame(tick);
    };
```

(d) Update cleanup to dispose the orbital + rim. Find the cleanup block:

```ts
    return () => {
      if (tumbleHandleRef.current != null) cancelAnimationFrame(tumbleHandleRef.current);
      dispose();
      // Dispose materials/geometries owned by the die.
      built.group.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (mesh as any).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
    };
```

Replace with:

```ts
    return () => {
      if (tumbleHandleRef.current != null) cancelAnimationFrame(tumbleHandleRef.current);
      dispose();
      orbital?.dispose();
      rim?.dispose();
      // Dispose materials/geometries owned by the die.
      built.group.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (mesh as any).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
    };
```

(e) Update the comment on the existing Phase 2 block to reflect the new state. Find:

```ts
    // Phase 3: lookup by id (preferred) with name fallback for backward
    // compatibility. Secondary/tertiary mods get orbital satellite + rim-band
    // (built later in this effect).
```

(That comment was added in Task 1 of this phase. It's accurate; leave as-is.)

- [ ] **Step 4: Run test to verify all 8 tests pass**

Run: `npm test -- src-next/render/three/DieView.test.tsx`
Expected: PASS, 8 tests (5 prior + 3 new).

- [ ] **Step 5: Run full suite + typecheck**

Run: `npm test`
Expected: All tests pass.

Run: `npx tsc --noEmit`
Expected: No new error categories beyond pre-existing baseline.

- [ ] **Step 6: Commit**

```bash
git add src-next/render/three/DieView.tsx src-next/render/three/DieView.test.tsx
git commit -m "feat(render): DieView renders orbital satellite + rim overlay for stacked mods"
```

---

## Task 5: Manual verification + acceptance check

**Acceptance criteria** (from spec — Stacking Rules):

- [ ] 2 mods on die → primary material + orbital satellite both visible.
- [ ] 3 mods on die (with `forged_links` voucher active) → primary material + secondary rim-band + tertiary orbital satellite all visible.
- [ ] At `<80` px die size, satellite hides (legibility check from spec).
- [ ] All 5 base styles + all 10 single mods continue rendering identically when 0–1 mods attached.

**Steps:**

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` from the worktree (or via `preview_start` if using the harness — note: launch.json may need a worktree-pointing entry like Phase 1+2).
Expected: Vite dev server prints a localhost URL.

- [ ] **Step 2: Toggle the dev flag and reach Forge with active run**

In the browser console:

```js
window.localStorage.setItem('ff_dieview_central', '1');
location.reload();
```

Open the dev console (`debug` button), click `screen` tab, click `forge`. Confirm the central die renders via DieView (Three.js) at 140px.

- [ ] **Step 3: Attach 2 mods, observe orbital satellite**

In the Forge codex, click two different mods (e.g. Gilded then Sharpened). Confirm:
- The central die's body material reflects the *first* mod (gold for Gilded).
- A small orbital satellite (chip + halo) circles the die in the *second* mod's accent color (cool steel for Sharpened).
- The satellite orbits smoothly at ~8s period.

- [ ] **Step 4: Force-attach 3 mods (voucher case)**

The default `MAX_MOD_SLOTS` is 2. To exercise the 3-mod case, use the dev console to bypass the voucher gate. In the dev console's "state" tab, modify `run.vouchers` to include `'forged_links'`:

Set path: `run.vouchers`
Set value: `["forged_links"]`

(Or use the `flags` tab if `forged_links` is exposed there. If neither path works, hand-attach the third mod via dispatching ATTACH_MOD with `dieIdx: 0, modId: 'loaded'` from the state-tools console, after attaching two mods normally.)

Once the third mod attaches, confirm:
- Body material still reflects the *first* mod.
- A thin accent-colored ring (rim band) is welded around the die's equator in the *second* mod's accent.
- An orbital satellite circles in the *third* mod's accent.
- All three are simultaneously visible, no z-fighting glitches.

- [ ] **Step 5: Resize check**

Reduce the central die size by editing `Forge.tsx` temporarily (or use React devtools to re-render with `size={56}`). Confirm:
- At `size >= 80`: satellite visible.
- At `size < 80`: satellite hidden, rim still visible (in 3-mod case).

(If editing isn't convenient, this is also covered by the unit test added in Task 4 Step 1 — check that test passes as evidence.)

- [ ] **Step 6: Regression check — single mod still works**

Detach all mods. Re-attach just one mod (Gilded). Confirm only the body material changes, no satellite/rim. Compares to Phase 2 baseline screenshot.

- [ ] **Step 7: Run full automated suite**

Run: `npm test`, `npm run build`, `npx tsc --noEmit`.
Expected: tests pass; production build succeeds; no new typecheck errors.

- [ ] **Step 8: No commit needed**

If any visual tuning surfaced (e.g. orbital radius too tight, rim too thick), fix in `orbitalSatellite.ts` / `rimOverlay.ts` and commit separately:

```bash
git add src-next/render/three/orbitalSatellite.ts
git commit -m "tune(render): adjust orbital <param> — <one-line reason>"
```

Otherwise Phase 3 is complete.

---

## Verification (whole phase, automated)

Run from the worktree root:

- [ ] `npm test` → all tests pass (existing 247 + 4 orbitalSatellite + 3 rimOverlay + 4 DieView = **258 expected**).
- [ ] `npx tsc --noEmit` → no new TypeScript error categories.
- [ ] `npm run build` → production build succeeds.

---

## Out of Scope (later phases)

- Pilot 3 geometry tweaks (Phase 4): Loaded asymmetry, Backstop *body* rim-thicken (distinct from this phase's secondary-mod rim-overlay), Pip Charge pip-recess.
- Generic pulse + pilot trigger phenomena (Phase 5+6).
- CSS dice migration to Three.js (Phase 7) — selector strip / tray / hold strip stay CSS.
- Glyph rendering on satellite (deferred — chip-only for now).

---

## Notes / Open Risks

- **Satellite legibility at 88px (Tray default).** The spec sets the threshold at <80px. Tray dice render at 88px (the default `size` for `DieView`), which is above the threshold but only just. If the satellite feels cramped at 88px during manual verification, consider raising the threshold to 96 — or apply a separate "in-tray = no satellite" rule when Phase 7 migrates the tray. Tunable.
- **Rim z-fighting.** The torus is offset by `dieSize * 0.012` to avoid clipping into the body. If a future mod material has high transmission (e.g. Mirror Pair at IOR 1.70), the rim may visually merge with the body's glassy refraction. If this surfaces during verification, increase `RIM_OUTSET` slightly or add the `polygonOffset` material flag.
- **Orbital tilt (~15°) is hard-coded.** Not yet exposed as a per-mod knob. If Phase 5+6's trigger FX wants a per-trigger orbital direction (e.g. counter-rotating for "pulse"), the `tilt` opt is already plumbed through.
- **rAF animation contention.** The same per-instance rAF now drives both die tumble and satellite orbit. With 1 die in Phase 1+2 and Phase 3, this is fine. Phase 7 migration to many dice (tray + hold) should re-evaluate whether to consolidate animations into the shared renderer's main loop.
- **Voucher state bypass for 3-mod testing.** The `MAX_MOD_SLOTS` default of 2 means Task 5 Step 4 needs the `forged_links` voucher active to exercise the rim path. The plan assumes `forged_links` raises the cap; if it does something else, the Step 4 instructions need updating. The Forge.tsx change passing `id` through means the lookup works either way.
