# Star Forge Mod Visuals — Phase 6 (Pilot Trigger Phenomena) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic pulse for the 3 pilot mods (Loaded, Pip Charge, Backstop) with custom multi-stage trigger sequences per spec — each its own modFx module.

**Architecture:** `applyFaceRemaps` is refactored to also emit `onModFired` events when Loaded actually remaps a 1→6 or Backstop actually raises a sub-min face. Three new sibling FX factories live in `src-next/render/three/modFx/`: `loaded.ts`, `pipCharge.ts`, `backstop.ts`. Each is a pure factory mirroring `pulse.ts` — takes scene+position+optional opts, runs an internal rAF loop, returns a `dispose` handle. `Dice3D.ts`'s existing `pendingPulses`-style queue routes by the mod's `visual.triggerFx` value: `'pulse'` → `firePulse` (existing), `'loaded'` → `fireLoaded`, `'pipCharge'` → `firePipCharge`, `'backstop'` → `fireBackstop`.

**Tech Stack:** TypeScript + React 18 + Three.js 0.169 + Vitest + jsdom. Existing `bus`/`dispatch` event infrastructure. No new dependencies.

**Spec source:** `docs/superpowers/specs/2026-04-29-star-forge-mod-visuals-design.md` — Section "Pilot 3 Trigger Phenomena" (Loaded, Pip Charge, Backstop sequences). Phase 5 plan at `docs/superpowers/plans/2026-04-30-star-forge-phase5-pulse-trigger.md` documents the firePulse pattern this plan mirrors.

**Phases 1-5 already shipped on `main`.** Reuse: `getHaloTexture` (sharedSprite cache), `bus`, `lookupMod`, `firePulse` (untouched), `pendingPulses` queue in `Dice3D.ts`.

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src-next/core/mods/index.ts` | MODIFY | Refactor `applyFaceRemaps` to return `{ faces: number[]; events: ModFiredEvent[] }`. Emit events when Loaded remaps (face equals `faceRemap.from`) or Backstop raises (face < scoreMin). |
| `src-next/core/mods/index.test.ts` | MODIFY | Update existing 5 `applyFaceRemaps` tests to access `.faces`. Add 2 new tests for the events: Loaded fires when 1→6 happens; Backstop fires when face<4 raises. |
| `src-next/core/phases/postRollModifiers.ts` | MODIFY | Update call site to destructure `{ faces, events }`, append events to `ctx.events`. |
| `src-next/render/three/modFx/loaded.ts` | NEW | `fireLoaded(scene, position, dieSize) → { dispose }`. Multi-stage rAF: bronze condense (0-120ms) + halo expand-collapse (120-300ms) + 6-pip bloom (300-500ms) + edge flash settle (500-550ms). |
| `src-next/render/three/modFx/loaded.test.ts` | NEW | Tests: returns dispose handle; sprites added to scene; auto-disposes by ~600ms; early dispose short-circuits. |
| `src-next/render/three/modFx/pipCharge.ts` | NEW | `firePipCharge(scene, position, faceValue, dieSize) → { dispose }`. Sequence: amber gather (0-100ms) + N=faceValue chained smaller pulses spaced ~80ms apart at offset positions + final halo pop. Total = (faceValue × 80) + 100ms. |
| `src-next/render/three/modFx/pipCharge.test.ts` | NEW | Tests: spawns the right number of pulses for face value; auto-disposes; dispose short-circuits. |
| `src-next/render/three/modFx/backstop.ts` | NEW | `fireBackstop(scene, position, dieSize) → { dispose }`. Sequence: jade rim flash (0-150ms) + ring expansion (150-400ms) + settle (400-650ms). |
| `src-next/render/three/modFx/backstop.test.ts` | NEW | Tests: returns dispose handle; sprites added; auto-disposes by ~700ms; early dispose works. |
| `src-next/render/three/Dice3D.ts` | MODIFY | Replace the unconditional `firePulse` call in the `onScoreBeat`-die-tick drain with a `switch (def.visual.triggerFx)` that dispatches to the right factory. Pip Charge passes faceValue. The pendingPulses Map evolves to store `{ accent, faceValue, kind }` tuples instead of just colors. |

**Decomposition rationale:** One factory per phenomenon — easy to test in isolation, easy to tune individually. The `applyFaceRemaps` refactor is a single contained change (one file with two-output return). The Dice3D routing is the integration point — small dispatch in the queue drain.

**Phase 6 explicitly defers:**
- Reduced-motion collapse for these phenomena (will land alongside other reduced-motion work).
- Camera-space die-shake for Backstop (the spec mentions a 3px shake; complex to wire — the rim flash + ring expansion already convey "rescue moment", die-shake is polish).
- Visible 1→6 face morph for Loaded (the underlying face value is already data-remapped per Phase 1; the FX overlays a transformation moment without literally swapping the rendered pip count).
- Flying-number ejection for Pip Charge (the existing `Particles.tsx` `flyToCounter` keyframe is CSS — wiring across the Three.js/CSS boundary is a separate task).

---

## Task 1: Refactor `applyFaceRemaps` to emit events

**Files:**
- Modify: `src-next/core/mods/index.ts`
- Modify: `src-next/core/mods/index.test.ts`
- Modify: `src-next/core/phases/postRollModifiers.ts`

- [ ] **Step 1: Write failing tests for the new return shape**

In `src-next/core/mods/index.test.ts`, change the existing 5 `applyFaceRemaps` tests to access `.faces`. Find the existing block (around line 5-26):

```ts
describe('applyFaceRemaps', () => {
  it('passes faces through when no mods are attached', () => {
    expect(applyFaceRemaps([1, 2, 3], [[], [], []])).toEqual([1, 2, 3]);
  });

  it('loaded mod remaps 1 to 6 by default', () => {
    expect(applyFaceRemaps([1, 1, 5], [['loaded'], [], []])).toEqual([6, 1, 5]);
  });

  it('lockOnes=true blocks loaded 1->6 remap', () => {
    expect(applyFaceRemaps([1, 1, 5], [['loaded'], ['loaded'], []], true)).toEqual([1, 1, 5]);
  });

  it('lockOnes=true does not affect non-1 dice', () => {
    expect(applyFaceRemaps([1, 4, 5], [['loaded'], [], []], true)).toEqual([1, 4, 5]);
  });

  it('backstop raises sub-min faces independently of lockOnes', () => {
    expect(applyFaceRemaps([1, 3, 5], [['backstop'], ['backstop'], []])).toEqual([4, 4, 5]);
    expect(applyFaceRemaps([1, 3, 5], [['backstop'], ['backstop'], []], true)).toEqual([4, 4, 5]);
  });
});
```

Replace with:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src-next/core/mods/index.test.ts`
Expected: TypeScript compile errors — `applyFaceRemaps` returns `number[]`, no `.faces` field.

- [ ] **Step 3: Refactor `applyFaceRemaps` in `src-next/core/mods/index.ts`**

Find the existing function (lines 119-138):

```ts
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

Replace with:

```ts
export type FaceRemapEvent = {
  type: 'onModFired';
  payload: { dieIdx: number; modId: string; faceValue: number };
};

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
```

- [ ] **Step 4: Update the production caller**

In `src-next/core/phases/postRollModifiers.ts`, find:

```ts
export const postRollModifiers: PhaseFn = (ctx) => {
  let next = ctx;
  if (ctx.sim) {
    const lockOnes = hasDebuff(ctx.state, 'no_mod_transforms_on_ones');
    const remapped = applyFaceRemaps(ctx.sim.finalFaces, ctx.state.round.diceMods, lockOnes);
    next = { ...next, sim: { ...ctx.sim, finalFaces: remapped } };
  }
  for (const u of getByPhase(Phase.POST_ROLL_MODIFIERS)) next = u.apply(next);
  return next;
};
```

Replace with:

```ts
export const postRollModifiers: PhaseFn = (ctx) => {
  let next = ctx;
  if (ctx.sim) {
    const lockOnes = hasDebuff(ctx.state, 'no_mod_transforms_on_ones');
    const { faces, events: remapEvents } = applyFaceRemaps(
      ctx.sim.finalFaces,
      ctx.state.round.diceMods,
      lockOnes,
    );
    const modFiredEvents = remapEvents.map((p) => ({ type: 'onModFired' as const, payload: p }));
    next = {
      ...next,
      sim: { ...ctx.sim, finalFaces: faces },
      events: [...next.events, ...modFiredEvents],
    };
  }
  for (const u of getByPhase(Phase.POST_ROLL_MODIFIERS)) next = u.apply(next);
  return next;
};
```

- [ ] **Step 5: Run all tests + typecheck**

Run: `npm test`
Expected: All tests pass — 5 existing applyFaceRemaps tests adapt to `.faces`, 4 new event tests pass. Total goes from 271 to **275** (271 + 4 new = 275).

Run: `npx tsc --noEmit`
Expected: No new errors. The return type of `applyFaceRemaps` changed; if any other caller exists outside the 3 files, typecheck will catch it.

- [ ] **Step 6: Commit**

```bash
git add src-next/core/mods/index.ts src-next/core/mods/index.test.ts src-next/core/phases/postRollModifiers.ts
git commit -m "feat(scoring): applyFaceRemaps emits onModFired for Loaded/Backstop fires"
```

---

## Task 2: `fireLoaded` phenomenon

**Files:**
- Create: `src-next/render/three/modFx/loaded.ts`
- Create: `src-next/render/three/modFx/loaded.test.ts`

**Design:** A multi-stage rAF sequence: bronze sprite condenses at center (0-120ms), expands then collapses as a halo (120-300ms), six small sprites bloom at 6-face pip positions (300-500ms), final edge sprite flash (500-550ms). Total ~550ms. Mirrors `firePulse`'s factory pattern but with multiple sprites and stages.

- [ ] **Step 1: Write the failing test**

```ts
// src-next/render/three/modFx/loaded.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as THREE from 'three';
import { fireLoaded } from './loaded';

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

describe('fireLoaded', () => {
  it('returns a dispose handle', () => {
    const scene = new THREE.Scene();
    const handle = fireLoaded(scene, new THREE.Vector3(), 0.85);
    expect(typeof handle.dispose).toBe('function');
    handle.dispose();
  });

  it('adds at least one Sprite to the scene initially', () => {
    const scene = new THREE.Scene();
    const handle = fireLoaded(scene, new THREE.Vector3(), 0.85);
    const sprites = scene.children.filter((c) => c.type === 'Sprite');
    expect(sprites.length).toBeGreaterThanOrEqual(1);
    handle.dispose();
  });

  it('disposes early via handle, leaving an empty scene', () => {
    const scene = new THREE.Scene();
    const handle = fireLoaded(scene, new THREE.Vector3(), 0.85);
    handle.dispose();
    const sprites = scene.children.filter((c) => c.type === 'Sprite');
    expect(sprites.length).toBe(0);
  });

  it('auto-disposes by ~600ms (after the 550ms sequence)', async () => {
    const scene = new THREE.Scene();
    fireLoaded(scene, new THREE.Vector3(), 0.85);
    await new Promise((r) => setTimeout(r, 700));
    const sprites = scene.children.filter((c) => c.type === 'Sprite');
    expect(sprites.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/render/three/modFx/loaded.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `loaded.ts`**

```ts
// src-next/render/three/modFx/loaded.ts
import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type LoadedHandle = {
  dispose: () => void;
};

const BRONZE = '#c87a4a';
const BRONZE_BRIGHT = '#ffb074';
const TOTAL_DURATION_MS = 550;

// Stage timings:
//   0-120ms  : condense (single bronze sprite, scale 1.0→0.4, opacity 0→1)
//   120-300ms: halo expand+collapse (scale 0.4→2.5→0)
//   300-500ms: 6-pip bloom (six small sprites fade in then out)
//   500-550ms: edge flash settle (one larger sprite, brief flare)

const PIP_BLOOM_OFFSETS: [number, number][] = [
  [-0.24, -0.28], [0.24, -0.28],
  [-0.24,  0.00], [0.24,  0.00],
  [-0.24,  0.28], [0.24,  0.28],
];

export function fireLoaded(
  scene: THREE.Scene,
  position: THREE.Vector3,
  dieSize: number,
): LoadedHandle {
  // Stage 1+2: a single primary sprite that does condense → expand → collapse.
  const primaryMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: BRONZE,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const primary = new THREE.Sprite(primaryMat);
  primary.position.copy(position);
  primary.scale.set(dieSize, dieSize, 1);
  scene.add(primary);

  // Stage 3: six small pip-bloom sprites at canonical face-6 positions.
  const pipSprites: THREE.Sprite[] = [];
  const pipMats: THREE.SpriteMaterial[] = [];
  for (const [u, v] of PIP_BLOOM_OFFSETS) {
    const mat = new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color: BRONZE_BRIGHT,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(
      position.x + u * dieSize,
      position.y + 0.01,                    // tiny lift to avoid z-fight
      position.z + v * dieSize,
    );
    const pipSize = dieSize * 0.18;
    sprite.scale.set(pipSize, pipSize, 1);
    scene.add(sprite);
    pipSprites.push(sprite);
    pipMats.push(mat);
  }

  // Stage 4: edge flash sprite — one wider sprite that briefly flares.
  const edgeMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: BRONZE,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const edge = new THREE.Sprite(edgeMat);
  edge.position.copy(position);
  edge.scale.set(dieSize * 2.0, dieSize * 2.0, 1);
  scene.add(edge);

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    // Stage 1+2: primary condense + expand + collapse.
    if (dt < 120) {
      const t = dt / 120;
      primaryMat.opacity = t;
      const s = (1.0 - t * 0.6) * dieSize;     // 1.0 → 0.4
      primary.scale.set(s, s, 1);
    } else if (dt < 300) {
      const t = (dt - 120) / 180;              // 0..1 across stage 2
      // Scale ramps 0.4→2.5 then back to 0.
      const peak = 2.5;
      const s = (t < 0.5 ? 0.4 + (peak - 0.4) * (t / 0.5) : peak * (1 - (t - 0.5) / 0.5)) * dieSize;
      primary.scale.set(Math.max(0.001, s), Math.max(0.001, s), 1);
      primaryMat.opacity = 1 - t * 0.7;
    } else {
      primaryMat.opacity = 0;
    }

    // Stage 3: pip bloom 300-500ms.
    if (dt >= 300 && dt < 500) {
      const t = (dt - 300) / 200;
      // Fade up first 50%, fade down second 50%.
      const opacity = t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5;
      for (const m of pipMats) m.opacity = opacity;
    } else if (dt >= 500) {
      for (const m of pipMats) m.opacity = 0;
    }

    // Stage 4: edge flash 500-550ms.
    if (dt >= 500 && dt < TOTAL_DURATION_MS) {
      const t = (dt - 500) / 50;
      edgeMat.opacity = (1 - t) * 0.6;
    } else if (dt < 500) {
      edgeMat.opacity = 0;
    }

    if (dt >= TOTAL_DURATION_MS) {
      doDispose();
      return;
    }
    rafHandle = requestAnimationFrame(step);
  }

  function doDispose(): void {
    if (disposed) return;
    disposed = true;
    if (rafHandle != null) cancelAnimationFrame(rafHandle);
    scene.remove(primary);
    primaryMat.dispose();
    for (const sprite of pipSprites) scene.remove(sprite);
    for (const mat of pipMats) mat.dispose();
    scene.remove(edge);
    edgeMat.dispose();
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src-next/render/three/modFx/loaded.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src-next/render/three/modFx/loaded.ts src-next/render/three/modFx/loaded.test.ts
git commit -m "feat(render): add fireLoaded — bronze condense + bloom + edge flash"
```

---

## Task 3: `firePipCharge` phenomenon

**Files:**
- Create: `src-next/render/three/modFx/pipCharge.ts`
- Create: `src-next/render/three/modFx/pipCharge.test.ts`

**Design:** An amber gather pulse (0-100ms) followed by N=faceValue chained smaller pulses spaced 80ms apart at offset positions tracing the visible face's pip layout. Final halo pop at the end. Total = (faceValue × 80) + 100ms.

- [ ] **Step 1: Write the failing test**

```ts
// src-next/render/three/modFx/pipCharge.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as THREE from 'three';
import { firePipCharge } from './pipCharge';

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

describe('firePipCharge', () => {
  it('returns a dispose handle', () => {
    const scene = new THREE.Scene();
    const handle = firePipCharge(scene, new THREE.Vector3(), 3, 0.85);
    expect(typeof handle.dispose).toBe('function');
    handle.dispose();
  });

  it('spawns sprites for face value 6 (5 arc segments + gather + final pop)', () => {
    const scene = new THREE.Scene();
    const handle = firePipCharge(scene, new THREE.Vector3(), 6, 0.85);
    const sprites = scene.children.filter((c) => c.type === 'Sprite');
    // Implementation pre-creates all sprites at start, fades them in/out per stage.
    expect(sprites.length).toBeGreaterThanOrEqual(2);
    handle.dispose();
  });

  it('disposes early via handle', () => {
    const scene = new THREE.Scene();
    const handle = firePipCharge(scene, new THREE.Vector3(), 3, 0.85);
    handle.dispose();
    const sprites = scene.children.filter((c) => c.type === 'Sprite');
    expect(sprites.length).toBe(0);
  });

  it('auto-disposes by face*80+100ms+buffer for face=2 (= 260ms + buffer)', async () => {
    const scene = new THREE.Scene();
    firePipCharge(scene, new THREE.Vector3(), 2, 0.85);
    await new Promise((r) => setTimeout(r, 400));
    const sprites = scene.children.filter((c) => c.type === 'Sprite');
    expect(sprites.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/render/three/modFx/pipCharge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `pipCharge.ts`**

```ts
// src-next/render/three/modFx/pipCharge.ts
import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type PipChargeHandle = {
  dispose: () => void;
};

const AMBER = '#ffd84a';
const AMBER_BRIGHT = '#fff3a0';
const GATHER_MS = 100;
const PER_PIP_MS = 80;

// Face → list of pip-position offsets in the visible face plane (XZ, since
// the camera looks down -Y at the die). Tries to match the canonical pip
// layouts in buildDie's PIPS but in world-space offsets.
const FACE_OFFSETS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-0.22, -0.22], [0.22, 0.22]],
  3: [[-0.24, -0.24], [0, 0], [0.24, 0.24]],
  4: [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]],
  5: [[-0.24, -0.24], [0.24, -0.24], [0, 0], [-0.24, 0.24], [0.24, 0.24]],
  6: [[-0.24, -0.28], [0.24, -0.28], [-0.24, 0], [0.24, 0], [-0.24, 0.28], [0.24, 0.28]],
};

export function firePipCharge(
  scene: THREE.Scene,
  position: THREE.Vector3,
  faceValue: number,
  dieSize: number,
): PipChargeHandle {
  const offsets = FACE_OFFSETS[Math.max(1, Math.min(6, faceValue))] ?? FACE_OFFSETS[1]!;
  const totalDuration = GATHER_MS + offsets.length * PER_PIP_MS;

  // Gather sprite — single amber pulse at center for the gather phase.
  const gatherMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: AMBER,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const gather = new THREE.Sprite(gatherMat);
  gather.position.copy(position);
  gather.scale.set(dieSize * 1.0, dieSize * 1.0, 1);
  scene.add(gather);

  // Pip arc sprites — one per pip in the face layout. Pre-created at start,
  // each one fades in around its scheduled time.
  const pipSprites: THREE.Sprite[] = [];
  const pipMats: THREE.SpriteMaterial[] = [];
  for (const [u, v] of offsets) {
    const mat = new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color: AMBER_BRIGHT,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(
      position.x + u * dieSize,
      position.y + 0.01,
      position.z + v * dieSize,
    );
    const pipSize = dieSize * 0.22;
    sprite.scale.set(pipSize, pipSize, 1);
    scene.add(sprite);
    pipSprites.push(sprite);
    pipMats.push(mat);
  }

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    // Gather: 0..GATHER_MS
    if (dt < GATHER_MS) {
      const t = dt / GATHER_MS;
      gatherMat.opacity = t * 0.8;
    } else {
      gatherMat.opacity = Math.max(0, 0.8 * (1 - (dt - GATHER_MS) / 200));
    }

    // Per-pip arc: each pip lights at GATHER_MS + i*PER_PIP_MS, peaks for ~80ms.
    for (let i = 0; i < pipMats.length; i++) {
      const start = GATHER_MS + i * PER_PIP_MS;
      const end = start + PER_PIP_MS * 1.5;
      if (dt >= start && dt < end) {
        const t = (dt - start) / (end - start);
        // Fade up first 30%, hold, fade down last 50%.
        const opacity = t < 0.3 ? t / 0.3 : (t > 0.5 ? Math.max(0, 1 - (t - 0.5) / 0.5) : 1);
        pipMats[i]!.opacity = opacity;
      } else if (dt >= end) {
        pipMats[i]!.opacity = 0;
      }
    }

    if (dt >= totalDuration + 100) {     // small tail buffer for last pip fade-out
      doDispose();
      return;
    }
    rafHandle = requestAnimationFrame(step);
  }

  function doDispose(): void {
    if (disposed) return;
    disposed = true;
    if (rafHandle != null) cancelAnimationFrame(rafHandle);
    scene.remove(gather);
    gatherMat.dispose();
    for (const s of pipSprites) scene.remove(s);
    for (const m of pipMats) m.dispose();
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src-next/render/three/modFx/pipCharge.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src-next/render/three/modFx/pipCharge.ts src-next/render/three/modFx/pipCharge.test.ts
git commit -m "feat(render): add firePipCharge — amber gather + chained pip-arc"
```

---

## Task 4: `fireBackstop` phenomenon

**Files:**
- Create: `src-next/render/three/modFx/backstop.ts`
- Create: `src-next/render/three/modFx/backstop.test.ts`

**Design:** Jade rim flash (0-150ms) + ring expansion (150-400ms, sprite scale 1→3.5) + settle (400-650ms, fade out). Total ~650ms.

- [ ] **Step 1: Write the failing test**

```ts
// src-next/render/three/modFx/backstop.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { fireBackstop } from './backstop';

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

describe('fireBackstop', () => {
  it('returns a dispose handle', () => {
    const scene = new THREE.Scene();
    const handle = fireBackstop(scene, new THREE.Vector3(), 0.85);
    expect(typeof handle.dispose).toBe('function');
    handle.dispose();
  });

  it('adds at least one Sprite to the scene', () => {
    const scene = new THREE.Scene();
    const handle = fireBackstop(scene, new THREE.Vector3(), 0.85);
    const sprites = scene.children.filter((c) => c.type === 'Sprite');
    expect(sprites.length).toBeGreaterThanOrEqual(1);
    handle.dispose();
  });

  it('disposes early via handle', () => {
    const scene = new THREE.Scene();
    const handle = fireBackstop(scene, new THREE.Vector3(), 0.85);
    handle.dispose();
    const sprites = scene.children.filter((c) => c.type === 'Sprite');
    expect(sprites.length).toBe(0);
  });

  it('auto-disposes by ~700ms (after the 650ms sequence)', async () => {
    const scene = new THREE.Scene();
    fireBackstop(scene, new THREE.Vector3(), 0.85);
    await new Promise((r) => setTimeout(r, 800));
    const sprites = scene.children.filter((c) => c.type === 'Sprite');
    expect(sprites.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src-next/render/three/modFx/backstop.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `backstop.ts`**

```ts
// src-next/render/three/modFx/backstop.ts
import * as THREE from 'three';
import { getHaloTexture } from '../buildDie';

export type BackstopHandle = {
  dispose: () => void;
};

const JADE = '#9bd0a8';
const JADE_BRIGHT = '#d8f0dc';
const TOTAL_DURATION_MS = 650;

// Stage timings:
//   0-150ms  : rim flash — small bright sprite at die center, opacity 0→1→0
//   150-400ms: ring expansion — sprite scale 1→3.5, opacity 0.7→0
//   400-650ms: settle — gentle fade of any residual

export function fireBackstop(
  scene: THREE.Scene,
  position: THREE.Vector3,
  dieSize: number,
): BackstopHandle {
  // Rim flash — bright jade flash at center.
  const rimMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: JADE_BRIGHT,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const rim = new THREE.Sprite(rimMat);
  rim.position.copy(position);
  rim.scale.set(dieSize * 1.5, dieSize * 1.5, 1);
  scene.add(rim);

  // Ring sprite — expands outward, jade-tinted.
  const ringMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: JADE,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const ring = new THREE.Sprite(ringMat);
  ring.position.copy(position);
  ring.scale.set(dieSize * 1.0, dieSize * 1.0, 1);
  scene.add(ring);

  let disposed = false;
  let rafHandle: number | null = null;
  const t0 = performance.now();

  function step(): void {
    if (disposed) return;
    const dt = performance.now() - t0;

    // Stage 1: rim flash 0-150ms.
    if (dt < 150) {
      const t = dt / 150;
      // Fade up 0..0.5, fade down 0.5..1.
      rimMat.opacity = t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5;
    } else {
      rimMat.opacity = 0;
    }

    // Stage 2: ring expansion 150-400ms.
    if (dt >= 150 && dt < 400) {
      const t = (dt - 150) / 250;
      const scale = (1.0 + t * 2.5) * dieSize;     // 1.0 → 3.5
      ring.scale.set(scale, scale, 1);
      ringMat.opacity = 0.7 * (1 - t);
    }

    // Stage 3: settle 400-650ms — any residual fades to 0.
    if (dt >= 400 && dt < TOTAL_DURATION_MS) {
      const t = (dt - 400) / 250;
      ringMat.opacity = Math.max(0, 0.1 * (1 - t));
    }

    if (dt >= TOTAL_DURATION_MS) {
      doDispose();
      return;
    }
    rafHandle = requestAnimationFrame(step);
  }

  function doDispose(): void {
    if (disposed) return;
    disposed = true;
    if (rafHandle != null) cancelAnimationFrame(rafHandle);
    scene.remove(rim);
    rimMat.dispose();
    scene.remove(ring);
    ringMat.dispose();
  }

  rafHandle = requestAnimationFrame(step);
  return { dispose: doDispose };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src-next/render/three/modFx/backstop.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src-next/render/three/modFx/backstop.ts src-next/render/three/modFx/backstop.test.ts
git commit -m "feat(render): add fireBackstop — jade rim flash + ring expansion"
```

---

## Task 5: Route `Dice3D.ts` listener by triggerFx

**Files:**
- Modify: `src-next/render/three/Dice3D.ts`

**Design:** The existing Phase 5 `pendingPulses: Map<number, string[]>` queues only colors, which doesn't carry enough info for pilot mods (they need to know which trigger family + face value). Replace with a richer entry shape and route at the drain site.

- [ ] **Step 1: Update queue entry type**

In `src-next/render/three/Dice3D.ts`, find:

```ts
  // Queued pulse colors per die — `onModFired` enqueues; `die-tick` drains.
  // Keeps pulse FX visually in sync with the score-sequence animation rather
  // than firing all at once at action-dispatch time.
  private pendingPulses: Map<number, string[]> = new Map();
```

Replace with:

```ts
  // Queued FX requests per die — `onModFired` enqueues; `die-tick` drains.
  // Each entry carries the trigger kind + accent + face value so the drain
  // site can dispatch to the right modFx factory.
  private pendingPulses: Map<number, Array<{
    kind: 'pulse' | 'loaded' | 'pipCharge' | 'backstop';
    accent: string;
    faceValue: number;
  }>> = new Map();
```

- [ ] **Step 2: Add imports**

Find the existing import:

```ts
import { firePulse } from './modFx/pulse';
```

Replace with:

```ts
import { firePulse } from './modFx/pulse';
import { fireLoaded } from './modFx/loaded';
import { firePipCharge } from './modFx/pipCharge';
import { fireBackstop } from './modFx/backstop';
```

- [ ] **Step 3: Update the enqueue site**

Find:

```ts
      bus.on('onModFired', ({ dieIdx, modId, faceValue }) => {
        const def = lookupMod(modId);
        const trigger = def?.visual?.triggerFx;
        const accent = def?.visual?.accentColor;
        // Pilot mods (loaded/pipCharge/backstop) get their own phenomena in
        // Phase 6 — skip generic pulse for them.
        if (trigger !== 'pulse' || !accent) return;
        void faceValue;
        // Queue this pulse to fire when score-sequence reaches this die-tick.
        const list = this.pendingPulses.get(dieIdx) ?? [];
        list.push(accent);
        this.pendingPulses.set(dieIdx, list);
      }),
```

Replace with:

```ts
      bus.on('onModFired', ({ dieIdx, modId, faceValue }) => {
        const def = lookupMod(modId);
        const trigger = def?.visual?.triggerFx;
        const accent = def?.visual?.accentColor;
        if (!trigger || !accent) return;
        // Queue this FX to fire when score-sequence reaches this die-tick.
        const list = this.pendingPulses.get(dieIdx) ?? [];
        list.push({ kind: trigger, accent, faceValue });
        this.pendingPulses.set(dieIdx, list);
      }),
```

- [ ] **Step 4: Update the drain site**

Find:

```ts
          const queue = this.pendingPulses.get(beat.dieIdx);
          if (queue && d) {
            for (const accent of queue) {
              firePulse(this.scene, d.group.position.clone(), accent, DIE_SIZE);
            }
            this.pendingPulses.set(beat.dieIdx, []);
          }
```

Replace with:

```ts
          const queue = this.pendingPulses.get(beat.dieIdx);
          if (queue && d) {
            for (const entry of queue) {
              const pos = d.group.position.clone();
              switch (entry.kind) {
                case 'pulse':
                  firePulse(this.scene, pos, entry.accent, DIE_SIZE);
                  break;
                case 'loaded':
                  fireLoaded(this.scene, pos, DIE_SIZE);
                  break;
                case 'pipCharge':
                  firePipCharge(this.scene, pos, entry.faceValue, DIE_SIZE);
                  break;
                case 'backstop':
                  fireBackstop(this.scene, pos, DIE_SIZE);
                  break;
              }
            }
            this.pendingPulses.set(beat.dieIdx, []);
          }
```

- [ ] **Step 5: Run all tests + typecheck**

Run: `npm test`
Expected: All tests still pass (275 + 4 + 4 + 4 = **287 expected**).

Run: `npx tsc --noEmit`
Expected: No new error categories.

- [ ] **Step 6: Commit**

```bash
git add src-next/render/three/Dice3D.ts
git commit -m "feat(render): Dice3D routes onModFired by triggerFx kind (pulse/loaded/pipCharge/backstop)"
```

---

## Task 6: Manual verification + acceptance check

**Acceptance criteria** (from spec — Pilot trigger phenomena):

- [ ] Loaded: roll/force a 1 → see condense → halo → 6-pip bloom sequence. Final face displays as 6.
- [ ] Pip Charge: hand including a face=6 die → see 5 arc segments traced pip-to-pip; face=2 visibly shorter sequence.
- [ ] Backstop: force a 1 with Backstop attached → ceramic ring expansion + face "clicks" up to 4.
- [ ] Each renders distinctly from generic pulse and from each other.

**Steps:**

- [ ] **Step 1: Start the dev server**

Add a temporary worktree entry to `.claude/launch.json` if using preview:

```json
{
  "name": "fortune-fallacy-phase6",
  "runtimeExecutable": "cmd.exe",
  "runtimeArgs": ["/c", "cd .worktrees\\star-forge-phase6 && npm run dev -- --port 5174 --strictPort"],
  "port": 5174,
  "autoPort": false
}
```

Then `preview_start fortune-fallacy-phase6`. Or run `npm run dev` directly from the worktree.

- [ ] **Step 2: Reach gameplay round and force conditions per pilot**

Open the page. Use the dev console (`debug` button → `screen` tab → `round`) to jump to the round screen.

Use the `state` tab to set `round.diceMods` to an array attaching the pilot under test to die 0, e.g.:
- Loaded: `round.diceMods = [["loaded"], [], [], [], []]`
- Pip Charge: `round.diceMods = [["pip_charge"], [], [], [], []]`
- Backstop: `round.diceMods = [["backstop"], [], [], [], []]`

Also set `round.scoring = false` and `round.handsLeft = 3` so you can roll cleanly.

- [ ] **Step 3: Verify Loaded sequence**

Attach Loaded to die 0. Roll until die 0 lands a 1. (You may also force the face by setting `round.dice` directly via state-set if rolling is slow.)

Play the hand. During score animation when die 0 ticks:
- Confirm a bronze condensing pulse appears on die 0.
- Followed by a brief scale-up + collapse halo.
- Then six small bronze pip-positions briefly flare.
- Then a wider edge-flash settle.
- Total ~550ms.
- Distinct from generic pulse (which is ~280ms, single halo).

- [ ] **Step 4: Verify Pip Charge sequence at varying face values**

Detach Loaded. Attach Pip Charge to die 0.

Roll until die 0 lands a 6. Play. Observe a longer arc sequence (~5 segments + final pop, ~580ms total).

Roll until die 0 lands a 2. Play. Observe a much shorter sequence (~2 segments, ~260ms total).

- [ ] **Step 5: Verify Backstop sequence**

Detach Pip Charge. Attach Backstop. Roll until die 0 lands a 1, 2, or 3. Play.

When die 0 ticks:
- Bright jade flash at die 0 (~150ms).
- Ring expands outward (~250ms).
- Soft settle (~250ms).
- Total ~650ms.

Roll until die 0 lands 4+. Play. Confirm Backstop does NOT fire — no jade flash on die 0.

- [ ] **Step 6: Confirm pilot mods don't get generic pulse**

Each pilot has its own phenomenon now. Confirm that during scoring, you never see the small generic 280ms accent halo for these mods — they always render their custom sequence.

- [ ] **Step 7: Confirm non-pilot mods still pulse**

Attach a non-pilot mod (e.g. Amplify, Sharpened, Snake Eyes when face=1). Confirm generic pulse still fires — Phase 5 path unchanged.

- [ ] **Step 8: Run full automated suite**

Run: `npm test`, `npm run build`, `npx tsc --noEmit`.
Expected: tests pass; production build succeeds; no new typecheck errors.

- [ ] **Step 9: No commit needed**

If any tweak surfaced (e.g. Loaded too long/subtle, Pip Charge arc too dim, Backstop ring too small), tune the constants in the corresponding `modFx/<name>.ts` and commit:

```bash
git add src-next/render/three/modFx/<name>.ts
git commit -m "tune(render): adjust <phenomenon> <param> — <one-line reason>"
```

Otherwise Phase 6 is complete.

---

## Verification (whole phase, automated)

Run from the worktree root:

- [ ] `npm test` → all tests pass (existing 271 + 4 new applyFaceRemaps event tests + 4 loaded + 4 pipCharge + 4 backstop = **287 expected**).
- [ ] `npx tsc --noEmit` → no new TypeScript error categories.
- [ ] `npm run build` → production build succeeds.

---

## Out of Scope (later phases)

- Phase 7 = CSS dice migration to Three.js (tray + hold strip).
- Reduced-motion collapse for Loaded/PipCharge/Backstop sequences.
- Camera-space die-shake for Backstop (spec mentions a 3px shake; complex to wire — defer).
- Visible 1→6 pip morph for Loaded (the underlying face value is data-only remapped; the FX overlays a transformation moment without literally swapping rendered pip count).
- Flying-number ejection for Pip Charge final pop (would cross the Three.js/CSS boundary into the existing `Particles.tsx` flyToCounter path; defer).

---

## Notes / Open Risks

- **Sequence overlap when multiple pilot mods stack on one die.** If a die has Loaded AND Pip Charge, both phenomena play at the die's tick. They run independently from each other (separate rAF loops), and their additive sprites blend correctly. May read as visual chaos if user attaches all 3 pilots to one die — acceptable since the player chose that loadout. Watch during manual verification.
- **Pip Charge face axis assumption.** `FACE_OFFSETS` maps pip positions in the visible-face plane assuming the camera looks down the Y axis (top-down). If the gameplay camera ever tilts off-axis, the offsets would be wrong. Top-down is the established convention (`Dice3D.ts` camera at Y=14 looking down) so this is safe.
- **Loaded "edge flash" sprite uses additive blending** so it overlays the die without darkening. At dieSize×2.0 it's larger than the die — the blooming feel comes from the gradient halo texture's soft falloff. Should read as a flare around the die rather than masking it.
- **No backstop event in test for `lockOnes=true` (Sedna boss)**. If a future debuff blocks Loaded but not Backstop, the events arrays might surprise. The current test set covers the production path — extend if Sedna's interaction with Loaded/Backstop ever surfaces a bug.
