# Star Forge Mod Visuals — Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the rendering foundation for the Star Forge mod-visuals system: a reusable Three.js `DieView` React component backed by a shared-canvas multi-viewport renderer, swap *only* the Forge central die behind a dev flag, with WebGL fallback to the existing CSS dice.

**Architecture:** A single overlay `<canvas>` mounted on `<body>` hosts one Three.js `WebGLRenderer`. Each `DieView` instance owns its own `Scene`/`Camera`/die mesh and registers with the shared renderer, which draws each registered view into its DOM-anchored viewport rect each frame using `setScissor` + `setViewport`. Existing `Dice3D.ts` is refactored to extract its `buildDie()` and helper textures into a shared `buildDie.ts` module so both the gameplay path (`Dice3D`) and the new `DieView` use identical mesh/material code. WebGL availability is probed once at boot; if unavailable, `DieView` renders as `Die3DCSS` instead.

**Tech Stack:** TypeScript, React 18, Three.js 0.169, Vitest + jsdom for tests. No new deps.

**Spec source:** `docs/superpowers/specs/2026-04-29-star-forge-mod-visuals-design.md` (Foundation phase only).

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src-next/render/three/buildDie.ts` | NEW | Pure factory: builds a Three.js die `Group` with body, edges, pips, per-face lens/halo materials. Exports `STYLES`, `PIPS`, `FACE_DEFS`, `buildDie()`, `getHaloTexture()`. Imported by both `Dice3D.ts` and `DieView.tsx`. |
| `src-next/render/three/buildDie.test.ts` | NEW | Tests `buildDie()` returns a Group with the expected children/material structure. |
| `src-next/render/three/Dice3D.ts` | MODIFY | Removes inline `buildDie`/`STYLES`/`PIPS`/`FACE_DEFS`/`getHaloTexture`; imports them from `buildDie.ts` instead. No behavior change. |
| `src-next/render/three/webglDetect.ts` | NEW | Pure: `hasWebGL(): boolean` — probes for a WebGL context, caches result. |
| `src-next/render/three/webglDetect.test.ts` | NEW | Tests detection cache + handles probe failure gracefully. |
| `src-next/render/three/sharedRenderer.ts` | NEW | Singleton: owns one shared overlay canvas + `WebGLRenderer`. Exports `registerView({scene, camera, getRect}) → dispose` and `getSharedRenderer()`. |
| `src-next/render/three/sharedRenderer.test.ts` | NEW | Tests view registration, dispose, multi-view tracking. |
| `src-next/render/three/DieView.tsx` | NEW | React component. Mounts a placeholder div, builds a die scene/camera, registers with shared renderer. Falls back to `Die3DCSS` if WebGL unavailable. Matches `Die3DCSS` prop surface. |
| `src-next/render/three/DieView.test.tsx` | NEW | Render tests: mount/unmount calls registerView/dispose; CSS fallback engages when `hasWebGL()` is `false`. |
| `src-next/app/screens/Forge.tsx` | MODIFY | Adds dev flag check; central die uses `DieView` when flag enabled, otherwise `Die3DCSS`. Selector strip dice unchanged (still CSS). |

**Decomposition rationale:** `buildDie.ts` is shared between gameplay and the new component → DRY. `webglDetect`, `sharedRenderer`, `DieView` each have one responsibility. `Dice3D.ts` keeps its game-specific logic (hold constellation, score pop, lock/unlock) — only the die mesh factory moves out.

---

## Task 1: WebGL detection probe

**Files:**
- Create: `src-next/render/three/webglDetect.ts`
- Test: `src-next/render/three/webglDetect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src-next/render/three/webglDetect.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { hasWebGL, _resetWebGLCache } from './webglDetect';

describe('webglDetect', () => {
  beforeEach(() => _resetWebGLCache());

  it('returns false when canvas.getContext throws', () => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function () { throw new Error('no'); } as any;
    try {
      expect(hasWebGL()).toBe(false);
    } finally {
      HTMLCanvasElement.prototype.getContext = orig;
    }
  });

  it('returns false when getContext returns null (jsdom default)', () => {
    expect(hasWebGL()).toBe(false);
  });

  it('caches the probe result', () => {
    let calls = 0;
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function () { calls++; return null; } as any;
    try {
      hasWebGL();
      hasWebGL();
      hasWebGL();
      expect(calls).toBe(1);
    } finally {
      HTMLCanvasElement.prototype.getContext = orig;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/render/three/webglDetect.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src-next/render/three/webglDetect.ts
let _cached: boolean | null = null;

export function hasWebGL(): boolean {
  if (_cached !== null) return _cached;
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('webgl2') || c.getContext('webgl');
    _cached = !!ctx;
  } catch {
    _cached = false;
  }
  return _cached;
}

export function _resetWebGLCache(): void {
  _cached = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src-next/render/three/webglDetect.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src-next/render/three/webglDetect.ts src-next/render/three/webglDetect.test.ts
git commit -m "feat(render): add webglDetect probe with caching"
```

---

## Task 2: Extract die builder into shared module

**Files:**
- Create: `src-next/render/three/buildDie.ts`
- Test: `src-next/render/three/buildDie.test.ts`
- Modify: `src-next/render/three/Dice3D.ts:1-256` — remove inline copies, import from `buildDie.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// src-next/render/three/buildDie.test.ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildDie, STYLES, PIPS, FACE_DEFS } from './buildDie';

describe('buildDie', () => {
  it('exports 5 known styles', () => {
    expect(Object.keys(STYLES).sort()).toEqual(
      ['celestial', 'ember', 'glass', 'ivory', 'obsidian'],
    );
  });

  it('exports pip layouts for faces 1..6', () => {
    for (let f = 1; f <= 6; f++) expect(PIPS[f]?.length).toBe(f);
  });

  it('FACE_DEFS lists all 6 faces with axis+sign', () => {
    expect(FACE_DEFS).toHaveLength(6);
    const vals = FACE_DEFS.map((d) => d.val).sort();
    expect(vals).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('returns a Group with body, edge lines, and a pip group', () => {
    const built = buildDie(0.85, 'celestial');
    expect(built.group).toBeInstanceOf(THREE.Group);
    const names = built.group.children.map((c) => c.name);
    expect(names).toContain('Body');
    expect(names).toContain('pips');
    expect(built.faceLensMats[1]).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(built.faceHaloMats[1]).toBeInstanceOf(THREE.SpriteMaterial);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/render/three/buildDie.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `buildDie.ts` by moving lines 8–256 of `Dice3D.ts` into the new file. Keep the file pure (no `store`/`bus`/`dispatch` imports).**

```ts
// src-next/render/three/buildDie.ts
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const DIE_SIZE = 0.85;

export type StyleKey = 'celestial' | 'obsidian' | 'ember' | 'ivory' | 'glass';

export type StyleDef = {
  bodyTint: number; bodyDeep: number;
  edge: number; pip: number; halo: number;
  eIntensity: number;
  transmission: number; thickness: number; ior: number; rough: number;
};

export const STYLES: Record<StyleKey, StyleDef> = {
  celestial: { bodyTint: 0x6b4ad6, bodyDeep: 0x1a0c4a, edge: 0xbba8ff, pip: 0xdcd4ff, halo: 0x7be3ff, eIntensity: 1.9, transmission: 0.50, thickness: 0.65, ior: 1.43, rough: 0.41 },
  obsidian:  { bodyTint: 0x2e1d6b, bodyDeep: 0x07051a, edge: 0xf5c451, pip: 0xf5c451, halo: 0xf5c451, eIntensity: 1.2, transmission: 0.18, thickness: 0.85, ior: 1.52, rough: 0.41 },
  ember:     { bodyTint: 0xff6a3a, bodyDeep: 0x5a1408, edge: 0xffe9c8, pip: 0xfff7e8, halo: 0xff7847, eIntensity: 1.5, transmission: 0.40, thickness: 0.70, ior: 1.46, rough: 0.41 },
  ivory:     { bodyTint: 0xfff7e0, bodyDeep: 0xa89868, edge: 0xffffff, pip: 0x1c1245, halo: 0x5c39c4, eIntensity: 0.0, transmission: 0.25, thickness: 0.80, ior: 1.40, rough: 0.41 },
  glass:     { bodyTint: 0x9be8ff, bodyDeep: 0x0a1422, edge: 0x7be3ff, pip: 0xf3f0ff, halo: 0x7be3ff, eIntensity: 1.8, transmission: 0.80, thickness: 0.55, ior: 1.43, rough: 0.41 },
};

export const PIPS: Record<number, [number, number][]> = {
  1: [[ 0.00,  0.00]],
  2: [[-0.22, -0.22], [ 0.22,  0.22]],
  3: [[-0.24, -0.24], [ 0.00,  0.00], [ 0.24,  0.24]],
  4: [[-0.22, -0.22], [ 0.22, -0.22], [-0.22,  0.22], [ 0.22,  0.22]],
  5: [[-0.24, -0.24], [ 0.24, -0.24], [ 0.00,  0.00], [-0.24,  0.24], [ 0.24,  0.24]],
  6: [[-0.24, -0.28], [ 0.24, -0.28], [-0.24,  0.00], [ 0.24,  0.00], [-0.24,  0.28], [ 0.24,  0.28]],
};

export const FACE_DEFS = [
  { val: 1, axis: 'y' as const, sign:  1 },
  { val: 6, axis: 'y' as const, sign: -1 },
  { val: 2, axis: 'x' as const, sign:  1 },
  { val: 5, axis: 'x' as const, sign: -1 },
  { val: 3, axis: 'z' as const, sign:  1 },
  { val: 4, axis: 'z' as const, sign: -1 },
];

export type FaceMatMap<T> = { 1: T; 2: T; 3: T; 4: T; 5: T; 6: T };

export type BuiltDie = {
  group: THREE.Group;
  faceLensMats: FaceMatMap<THREE.MeshStandardMaterial>;
  faceHaloMats: FaceMatMap<THREE.SpriteMaterial>;
  pipGroup: THREE.Group;
};

let _haloTex: THREE.CanvasTexture | null = null;
export function getHaloTexture(): THREE.CanvasTexture {
  if (_haloTex) return _haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  g.addColorStop(0.15, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.08)');
  g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _haloTex = new THREE.CanvasTexture(c);
  _haloTex.colorSpace = THREE.SRGBColorSpace;
  return _haloTex;
}

export function buildDie(size: number, styleKey: StyleKey): BuiltDie {
  const S = STYLES[styleKey];
  const group = new THREE.Group();
  group.name = `FortuneFallacyDie_${styleKey}`;

  const bodyGeo = new RoundedBoxGeometry(size, size, size, 8, size * 0.18);
  const tint = new THREE.Color(S.bodyTint);
  const deep = new THREE.Color(S.bodyDeep);
  const colors: number[] = [];
  const pos = bodyGeo.attributes.position!;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const corner = (Math.abs(tmp.x) + Math.abs(tmp.y) + Math.abs(tmp.z)) / (size * 1.5);
    const t = Math.pow(Math.min(1, corner), 2.0);
    const c = tint.clone().lerp(deep, t * 0.6);
    colors.push(c.r, c.g, c.b);
  }
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const bodyMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    metalness: 0.0,
    roughness: S.rough,
    transmission: S.transmission,
    thickness: S.thickness,
    ior: S.ior,
    attenuationColor: new THREE.Color(S.bodyDeep),
    attenuationDistance: size * 1.4,
    clearcoat: 0.55,
    clearcoatRoughness: 0.73,
    sheen: 0.28,
    sheenColor: new THREE.Color(S.bodyTint),
    sheenRoughness: 0.6,
    transparent: true,
    opacity: 1.0,
    envMapIntensity: 1.1,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  body.name = 'Body';
  group.add(body);

  const edgeGeo = new THREE.EdgesGeometry(bodyGeo, 25);
  const edgeMat = new THREE.LineBasicMaterial({
    color: S.edge,
    transparent: true,
    opacity: 0.45,
    toneMapped: false,
  });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  edgeLines.scale.setScalar(1.002);
  group.add(edgeLines);

  const orbMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(S.pip).multiplyScalar(2.4),
    toneMapped: false,
  });
  const lensProto = new THREE.MeshStandardMaterial({
    color: S.halo,
    emissive: S.halo,
    emissiveIntensity: Math.max(0.5, S.eIntensity * 0.9),
    metalness: 0.0,
    roughness: 0.18,
    transparent: true,
    opacity: 0,
    toneMapped: false,
  });
  const haloProto = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: S.halo,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });

  const faceLensMats = {
    1: lensProto.clone(), 2: lensProto.clone(), 3: lensProto.clone(),
    4: lensProto.clone(), 5: lensProto.clone(), 6: lensProto.clone(),
  } as FaceMatMap<THREE.MeshStandardMaterial>;
  const faceHaloMats = {
    1: haloProto.clone(), 2: haloProto.clone(), 3: haloProto.clone(),
    4: haloProto.clone(), 5: haloProto.clone(), 6: haloProto.clone(),
  } as FaceMatMap<THREE.SpriteMaterial>;
  lensProto.dispose();
  haloProto.dispose();

  const pipGroup = new THREE.Group();
  pipGroup.name = 'pips';
  group.add(pipGroup);

  const half = size / 2;
  const pipR = size * 0.075;
  const orbDepth = size * 0.10;
  const surfaceOut = size * 0.0015;
  const haloShown = S.eIntensity > 0;

  FACE_DEFS.forEach(({ val, axis, sign }) => {
    const positions = PIPS[val]!;
    const lensMat = faceLensMats[val as 1 | 2 | 3 | 4 | 5 | 6];
    const haloMat = faceHaloMats[val as 1 | 2 | 3 | 4 | 5 | 6];
    positions.forEach(([u, v], i) => {
      const faceGroup = new THREE.Group();
      faceGroup.name = `Pip_face${val}_${i}`;

      const orbGeo = new THREE.SphereGeometry(pipR * 0.85, 18, 14);
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.z = -orbDepth;
      faceGroup.add(orb);

      const lensGeo = new THREE.CircleGeometry(pipR * 1.05, 28);
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.z = surfaceOut;
      faceGroup.add(lens);

      if (haloShown) {
        const halo = new THREE.Sprite(haloMat);
        const haloSize = pipR * 4.0;
        halo.scale.set(haloSize, haloSize, 1);
        halo.position.z = surfaceOut + size * 0.008;
        faceGroup.add(halo);
      }

      if (axis === 'z') {
        faceGroup.position.set(u * size, v * size, sign * half);
        faceGroup.rotation.y = sign > 0 ? 0 : Math.PI;
      } else if (axis === 'x') {
        faceGroup.position.set(sign * half, v * size, -u * size * sign);
        faceGroup.rotation.y = sign * Math.PI / 2;
      } else {
        faceGroup.position.set(u * size, sign * half, -v * size * sign);
        faceGroup.rotation.x = -sign * Math.PI / 2;
      }
      pipGroup.add(faceGroup);
    });
  });

  return { group, faceLensMats, faceHaloMats, pipGroup };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src-next/render/three/buildDie.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Update `Dice3D.ts` to import from `buildDie.ts`**

In `src-next/render/three/Dice3D.ts`, replace the imports + local definitions:

Replace lines 1–7 with:

```ts
import * as THREE from 'three';
import { store } from '../../state/store';
import { bus } from '../../events/bus';
import { dispatch } from '../../actions/dispatch';
import { createCosmicEnv } from './MaterialEnv';
import {
  buildDie, getHaloTexture, FACE_DEFS, STYLES, PIPS,
  type StyleKey, type BuiltDie, type FaceMatMap,
} from './buildDie';
```

Then **delete** lines 8–256 of the original file *except* for the `DIE_SIZE`/`DICE_GAP`/`HOLD_*`/`ROLL_*`/`FACE_ROT` constants (those are gameplay-specific and stay in `Dice3D.ts`). The deleted region is: `STYLES`, `PIPS`, `FACE_DEFS`, `FaceMatMap`, `BuiltDie`, `_haloTex`/`getHaloTexture`, `buildDie`. Each of those is now imported.

Note: `Dice3D.ts` references `StyleKey` in its `buildDie('celestial')` call — that's now imported. The local `DIE_SIZE` already in `Dice3D.ts:8` stays where it is (don't import it, since both files declare it for now — the `buildDie.ts` export is for future external consumers).

- [ ] **Step 6: Run all tests + typecheck**

Run: `npm test`
Expected: All existing tests still pass.

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add src-next/render/three/buildDie.ts src-next/render/three/buildDie.test.ts src-next/render/three/Dice3D.ts
git commit -m "refactor(render): extract buildDie into shared module"
```

---

## Task 3: Shared multi-viewport renderer

**Files:**
- Create: `src-next/render/three/sharedRenderer.ts`
- Test: `src-next/render/three/sharedRenderer.test.ts`

**Design:**
- Singleton; lazy-initialized on first `registerView`.
- Mounts a single overlay canvas to `document.body` (`position: fixed; inset: 0; pointer-events: none; z-index: 80`).
- Each registered view supplies `{ scene, camera, getRect: () => DOMRect }`.
- `registerView` returns a `dispose()` fn that unregisters + auto-stops the loop when no views remain.
- Per-frame loop: for each view, `setScissor(rect)` + `setViewport(rect)` + `render(scene, camera)`.

- [ ] **Step 1: Write the failing test**

```ts
// src-next/render/three/sharedRenderer.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import {
  registerView, _viewCount, _resetSharedRenderer,
} from './sharedRenderer';

// jsdom can't create a real WebGL context — stub the renderer constructor.
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  class FakeRenderer {
    domElement = document.createElement('canvas');
    setPixelRatio() {}
    setSize() {}
    setScissorTest() {}
    setScissor() {}
    setViewport() {}
    render() {}
    dispose() {}
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

describe('sharedRenderer', () => {
  beforeEach(() => _resetSharedRenderer());

  it('starts with zero views', () => {
    expect(_viewCount()).toBe(0);
  });

  it('registerView increments count and dispose decrements it', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const dispose = registerView({
      scene, camera,
      getRect: () => new DOMRect(0, 0, 100, 100),
    });
    expect(_viewCount()).toBe(1);
    dispose();
    expect(_viewCount()).toBe(0);
  });

  it('supports multiple concurrent views', () => {
    const a = registerView({ scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), getRect: () => new DOMRect() });
    const b = registerView({ scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), getRect: () => new DOMRect() });
    expect(_viewCount()).toBe(2);
    a();
    expect(_viewCount()).toBe(1);
    b();
    expect(_viewCount()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/render/three/sharedRenderer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `sharedRenderer.ts`**

```ts
// src-next/render/three/sharedRenderer.ts
import * as THREE from 'three';

type ViewSpec = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  getRect: () => DOMRect;
};

let _renderer: THREE.WebGLRenderer | null = null;
let _canvas: HTMLCanvasElement | null = null;
let _views: ViewSpec[] = [];
let _rafHandle: number | null = null;

function ensureRenderer(): THREE.WebGLRenderer {
  if (_renderer) return _renderer;
  _canvas = document.createElement('canvas');
  _canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:80;width:100vw;height:100vh;';
  _canvas.setAttribute('data-shared-renderer', '1');
  document.body.appendChild(_canvas);
  _renderer = new THREE.WebGLRenderer({ canvas: _canvas, alpha: true, antialias: true });
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _renderer.setSize(window.innerWidth, window.innerHeight, false);
  _renderer.setScissorTest(true);
  return _renderer;
}

function loop(): void {
  if (_views.length === 0 || !_renderer) {
    _rafHandle = null;
    return;
  }
  const W = window.innerWidth;
  const H = window.innerHeight;
  for (const v of _views) {
    const r = v.getRect();
    if (r.width <= 0 || r.height <= 0) continue;
    // viewport y is measured from bottom of canvas
    const y = H - r.bottom;
    _renderer.setScissor(r.left, y, r.width, r.height);
    _renderer.setViewport(r.left, y, r.width, r.height);
    _renderer.render(v.scene, v.camera);
  }
  _rafHandle = requestAnimationFrame(loop);
}

export function registerView(spec: ViewSpec): () => void {
  ensureRenderer();
  _views.push(spec);
  if (_rafHandle == null) _rafHandle = requestAnimationFrame(loop);
  return () => {
    const i = _views.indexOf(spec);
    if (i >= 0) _views.splice(i, 1);
  };
}

// Test-only helpers.
export function _viewCount(): number { return _views.length; }
export function _resetSharedRenderer(): void {
  if (_rafHandle != null) cancelAnimationFrame(_rafHandle);
  _rafHandle = null;
  _views = [];
  if (_canvas?.parentNode) _canvas.parentNode.removeChild(_canvas);
  _canvas = null;
  if (_renderer) _renderer.dispose();
  _renderer = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src-next/render/three/sharedRenderer.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src-next/render/three/sharedRenderer.ts src-next/render/three/sharedRenderer.test.ts
git commit -m "feat(render): add shared multi-viewport Three.js renderer"
```

---

## Task 4: DieView React component

**Files:**
- Create: `src-next/render/three/DieView.tsx`
- Test: `src-next/render/three/DieView.test.tsx`

**Design:** Mounts a placeholder `<div>` of the given `size`. On mount, builds a per-instance `Scene` + `OrthographicCamera` + die mesh via `buildDie`. Registers with `sharedRenderer`. On unmount, disposes geometry/materials and unregisters. Idle tumble via incremental rotation in a local rAF (animation runs even when shared renderer is paused — actually the shared renderer drives draws; this rAF only mutates `group.rotation`). If `hasWebGL()` is false, returns `Die3DCSS` with the same props.

- [ ] **Step 1: Write the failing test**

```tsx
// src-next/render/three/DieView.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as sharedRenderer from './sharedRenderer';
import * as webglDetect from './webglDetect';
import { DieView } from './DieView';

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  class FakeRenderer {
    domElement = document.createElement('canvas');
    setPixelRatio() {} setSize() {} setScissorTest() {}
    setScissor() {} setViewport() {} render() {} dispose() {}
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

describe('DieView', () => {
  beforeEach(() => {
    sharedRenderer._resetSharedRenderer();
    webglDetect._resetWebGLCache();
    cleanup();
  });

  it('renders a placeholder div with the requested size when WebGL is available', () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const { container } = render(<DieView size={140} face={3} />);
    const el = container.querySelector('[data-die-view]') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.width).toBe('140px');
    expect(el.style.height).toBe('140px');
  });

  it('registers a view on mount and disposes on unmount', () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(true);
    const spy = vi.spyOn(sharedRenderer, 'registerView');
    const { unmount } = render(<DieView size={88} />);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(sharedRenderer._viewCount()).toBe(1);
    unmount();
    expect(sharedRenderer._viewCount()).toBe(0);
  });

  it('falls back to Die3DCSS when WebGL is unavailable', () => {
    vi.spyOn(webglDetect, 'hasWebGL').mockReturnValue(false);
    const { container } = render(<DieView size={88} face={2} />);
    expect(container.querySelector('.die3d-wrap')).not.toBeNull();
    expect(container.querySelector('[data-die-view]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/render/three/DieView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `DieView.tsx`**

```tsx
// src-next/render/three/DieView.tsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Die3DCSS, type DieMod } from '../../app/visual/Die3DCSS';
import { buildDie, type StyleKey } from './buildDie';
import { registerView } from './sharedRenderer';
import { hasWebGL } from './webglDetect';

const FACE_ROT_EULER: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [0, 0,  Math.PI / 2],
  3: [-Math.PI / 2, 0, 0],
  4: [ Math.PI / 2, 0, 0],
  5: [0, 0, -Math.PI / 2],
  6: [Math.PI, 0, 0],
};

type Props = {
  face?: number;
  size?: number;
  style?: StyleKey;
  locked?: boolean;
  scoring?: boolean;
  mods?: DieMod[];
  onClick?: () => void;
  label?: string;
  dim?: boolean;
};

export function DieView(props: Props) {
  const { size = 88, face = 1, style = 'celestial' } = props;
  const ref = useRef<HTMLDivElement | null>(null);
  const tumbleHandleRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hasWebGL() || !ref.current) return;
    const placeholder = ref.current;

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2, 4, 3);
    scene.add(dir);

    const built = buildDie(0.85, style);
    // Snap to canonical face rotation so the requested face is up.
    built.group.rotation.set(...(FACE_ROT_EULER[face] ?? FACE_ROT_EULER[1]!));
    // Fade up only the visible face's pip lens for legibility.
    for (let f = 1; f <= 6; f++) {
      const visible = f === face ? 0.78 : 0;
      built.faceLensMats[f as 1 | 2 | 3 | 4 | 5 | 6].opacity = visible;
      built.faceHaloMats[f as 1 | 2 | 3 | 4 | 5 | 6].opacity = f === face ? 1 : 0;
    }
    scene.add(built.group);

    const camera = new THREE.OrthographicCamera(-0.6, 0.6, 0.6, -0.6, 0.1, 100);
    camera.position.set(0, 0, 3);
    camera.lookAt(0, 0, 0);

    const dispose = registerView({
      scene, camera,
      getRect: () => placeholder.getBoundingClientRect(),
    });

    // Idle tumble: gentle wobble around the canonical pose.
    const baseEuler = FACE_ROT_EULER[face] ?? FACE_ROT_EULER[1]!;
    const t0 = performance.now();
    const tick = () => {
      const dt = (performance.now() - t0) / 1000;
      built.group.rotation.set(
        baseEuler[0] + Math.sin(dt * 0.45) * 0.07,
        baseEuler[1] + Math.sin(dt * 0.60 + 1.0) * 0.05,
        baseEuler[2] + Math.sin(dt * 0.50 + 2.1) * 0.07,
      );
      tumbleHandleRef.current = requestAnimationFrame(tick);
    };
    tumbleHandleRef.current = requestAnimationFrame(tick);

    return () => {
      if (tumbleHandleRef.current != null) cancelAnimationFrame(tumbleHandleRef.current);
      dispose();
      // Dispose materials/geometries owned by the die.
      built.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (mesh as any).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
    };
  }, [size, face, style]);

  if (!hasWebGL()) return <Die3DCSS {...props} />;

  return (
    <div
      ref={ref}
      data-die-view
      onClick={props.onClick}
      style={{
        width: size, height: size,
        cursor: props.onClick ? 'pointer' : 'default',
        opacity: props.dim ? 0.45 : 1,
        position: 'relative',
        // Reserve space; actual pixels are drawn by sharedRenderer overlay.
      }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src-next/render/three/DieView.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run all tests + typecheck**

Run: `npm test`
Expected: All tests pass.

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add src-next/render/three/DieView.tsx src-next/render/three/DieView.test.tsx
git commit -m "feat(render): add DieView with shared-renderer + CSS fallback"
```

---

## Task 5: Wire dev flag into Forge central die

**Files:**
- Modify: `src-next/app/screens/Forge.tsx:6` — add `DieView` import.
- Modify: `src-next/app/screens/Forge.tsx:82` — conditional render.

The dev flag is read from `window.localStorage.getItem('ff_dieview_central') === '1'`. Players never set this — it's a developer-only A/B switch evaluated once on screen mount.

- [ ] **Step 1: Add the import**

In `src-next/app/screens/Forge.tsx`, change line 6 from:

```ts
import { Die3DCSS } from '../visual/Die3DCSS';
```

to:

```ts
import { Die3DCSS } from '../visual/Die3DCSS';
import { DieView } from '../../render/three/DieView';
```

- [ ] **Step 2: Add the dev flag inside the `Forge` component**

Inside `export function Forge() { ... }`, after the existing `useState` line (around line 25), add:

```ts
const useDieView = typeof window !== 'undefined'
  && window.localStorage.getItem('ff_dieview_central') === '1';
```

- [ ] **Step 3: Replace the central die render**

In `src-next/app/screens/Forge.tsx`, change line 82 from:

```tsx
<Die3DCSS face={selectedFace} size={140} style="celestial" mods={selectedMods} />
```

to:

```tsx
{useDieView ? (
  <DieView face={selectedFace} size={140} style="celestial" mods={selectedMods} />
) : (
  <Die3DCSS face={selectedFace} size={140} style="celestial" mods={selectedMods} />
)}
```

The selector strip (lines 96–108) and any other `Die3DCSS` use stay unchanged — Phase 1 only swaps the central die.

- [ ] **Step 4: Run all tests + typecheck**

Run: `npm test`
Expected: All tests pass.

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src-next/app/screens/Forge.tsx
git commit -m "feat(forge): central die behind ff_dieview_central dev flag"
```

---

## Task 6: Manual verification + acceptance check

**Acceptance criteria** (from spec — Foundation phase):

- [ ] Forge central die renders at 140px in Three.js.
- [ ] Side-by-side compare with old CSS version (toggle dev flag). No FPS drop on a mid laptop.
- [ ] WebGL fallback path works (force-disable WebGL → CSS dice render).

**Steps:**

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite dev server starts. Default URL `http://localhost:5173` (or as printed).

- [ ] **Step 2: Default check — flag off (CSS path, baseline)**

In the browser console, run:

```js
window.localStorage.removeItem('ff_dieview_central');
location.reload();
```

Navigate into the Forge screen (start a run, reach the Forge / Star Forge step). Confirm:
- Central die renders as before via `Die3DCSS` (CSS 3D, idle tumble, mod badges in corner).
- No console errors.
- DevTools Performance: idle frame rate ~60fps on a mid laptop.

- [ ] **Step 3: Flag on — Three.js path**

In the browser console, run:

```js
window.localStorage.setItem('ff_dieview_central', '1');
location.reload();
```

Navigate to the Forge. Confirm:
- Central die now renders via `DieView` (Three.js material — should look richer: real transmission, halo on lit pip face, gentle 3D tumble).
- Selector strip dice (small 56px row) still render via `Die3DCSS` — Phase 1 doesn't migrate those.
- Mod badges on the central die: not rendered yet (badges live on the CSS path; Three.js mod visuals come in Phase 2). This is expected for Phase 1.
- DevTools Performance: idle frame rate ~60fps.
- No console errors. No WebGL context warnings.

- [ ] **Step 4: WebGL fallback check**

Force-disable WebGL via DevTools:
1. Open DevTools → ⋮ menu → More tools → Rendering.
2. Tick "Disable WebGL".
3. Reload the page.

Confirm:
- App still loads (gameplay roll uses `Dice3D` — that's a separate path; the gameplay will be broken without WebGL but that's pre-existing and outside Phase 1 scope).
- Forge central die renders via `Die3DCSS` (the `DieView` fallback returned the CSS component) even with the flag set.

Re-enable WebGL when done.

- [ ] **Step 5: 12-die perf sanity check**

In the browser console *while in the Forge with the flag on*:

```js
// Stress test: paste extra DieViews into the page via React devtools or ad-hoc
// React mount. If unavailable, skip — record actual FPS at the live count and
// note in the commit message. Worst-case sustained count happens in Phase 7
// migration; foundation only requires the central die.
```

Short of an ad-hoc stress harness, record the observed frame rate with the flag on at the central die and confirm there's no obvious frame drop vs flag off.

- [ ] **Step 6: Final commit (if anything was tweaked)**

If Steps 2–5 surfaced a bug, fix it and commit. Otherwise no commit needed — Phase 1 is complete.

---

## Verification (whole phase, automated)

Run from repo root:

- [ ] `npm test` → all tests pass.
- [ ] `npx tsc --noEmit` → zero TypeScript errors.
- [ ] `npm run build` → production build succeeds.

---

## Out of Scope (deferred to later phases)

- Mod material system (Phase 2): no `materialKey`/`accentColor`/material mutation in this phase.
- Stacking visuals (Phase 3): no orbital satellite / rim overlay.
- Pilot geometry (Phase 4): no Loaded/Backstop/Pip Charge mesh tweaks.
- Generic pulse trigger (Phase 5).
- Pilot trigger phenomena (Phase 6).
- Migration sweep (Phase 7): tray, hold strip, selector strip stay on `Die3DCSS`.
- Mod badge rendering on the Three.js die (waits for Phase 2 once mods drive material).

---

## Notes / Open Risks

- **WebGL context limits:** This phase only opens *one* shared WebGL context on `body`. The existing gameplay `Dice3D` opens its own — that's two contexts at most. Browsers cap around 16; we're well under. Phase 7 migration will validate continued single-context reuse.
- **Test environment:** jsdom can't run real WebGL, so `sharedRenderer.test.ts` and `DieView.test.tsx` mock the `WebGLRenderer` constructor. Real rendering is verified manually in the dev server (Task 6).
- **Bounding-rect timing:** `getBoundingClientRect()` is called every frame. If perf becomes an issue, the rect can be cached and refreshed only on `ResizeObserver` events — but Phase 1 keeps it simple.
- **Dev flag persistence:** `localStorage` flag persists across reloads. Document this in `CLAUDE.md` or a `DEV_FLAGS.md` if the project has one (out of scope for this plan unless such a file already exists).
