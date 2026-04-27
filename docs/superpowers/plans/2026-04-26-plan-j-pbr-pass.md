# Plan J — PBR / Materials Pass Implementation Plan

> Subagent-driven. `- [ ]` checkboxes.

**Goal:** Upgrade dice material reads using a procedural HDR environment generated in-browser (no asset bundling). Dice gain real reflections matching the cosmic palette. Apply CSS material classes to Round HUD action buttons (existing screens already use them via Plan B).

**Architecture:** New `MaterialEnv.ts` module exports `createCosmicEnv(renderer)` returning a PMREM env texture from a procedural cube background (purple→astral gradient). `Dice3D` consumes the env via `scene.environment` so all `MeshStandardMaterial` instances get reflections. No asset additions.

---

## Task 1 — `MaterialEnv` + Dice3D env map

**Files:**
- Create: `src-next/render/three/MaterialEnv.ts`
- Modify: `src-next/render/three/Dice3D.ts`

- [ ] **Step 1: Create MaterialEnv**

```ts
import * as THREE from 'three';

export function createCosmicEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  // Procedural canvas: vertical gradient with purple→astral→ember.
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, '#07051a');
    grad.addColorStop(0.35, '#1c1245');
    grad.addColorStop(0.55, '#2e1d6b');
    grad.addColorStop(0.75, '#7be3ff');
    grad.addColorStop(1.0, '#ff7847');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
    // Sprinkle a few highlights to give specular some structure.
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 256;
      const r = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.5})`;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const eqTex = new THREE.CanvasTexture(canvas);
  eqTex.mapping = THREE.EquirectangularReflectionMapping;
  eqTex.colorSpace = THREE.SRGBColorSpace;
  const env = pmrem.fromEquirectangular(eqTex).texture;
  pmrem.dispose();
  eqTex.dispose();
  return env;
}
```

- [ ] **Step 2: Wire into Dice3D**

In `src-next/render/three/Dice3D.ts`, add import:
```ts
import { createCosmicEnv } from './MaterialEnv';
```

In the constructor, AFTER `this.scene = new THREE.Scene();`, set `this.scene.environment`:
```ts
    this.scene = new THREE.Scene();
    try {
      this.scene.environment = createCosmicEnv(this.renderer);
    } catch (e) {
      console.warn('[Dice3D] env map init failed:', e);
    }
```

In `buildDie`, increase metalness on the body material so reflections show:

Find:
```ts
  const bodyMat = new THREE.MeshStandardMaterial({
    color: S.body,
    metalness: S.metal,
    roughness: S.rough,
    emissive: S.emissive,
    emissiveIntensity: S.eIntensity * 0.4,
  });
```

Replace with:
```ts
  const bodyMat = new THREE.MeshStandardMaterial({
    color: S.body,
    metalness: Math.max(0.4, S.metal),
    roughness: Math.max(0.18, Math.min(0.6, S.rough)),
    emissive: S.emissive,
    emissiveIntensity: S.eIntensity * 0.4,
    envMapIntensity: 0.85,
  });
```

(The clamp ensures env reflections show without making the die look like chrome.)

For pip material likewise:
Find:
```ts
  const pipMat = new THREE.MeshStandardMaterial({
    color: S.pip,
    metalness: 0.4,
    roughness: 0.25,
    emissive: S.emissive,
    emissiveIntensity: S.eIntensity,
  });
```

Replace with:
```ts
  const pipMat = new THREE.MeshStandardMaterial({
    color: S.pip,
    metalness: 0.6,
    roughness: 0.2,
    emissive: S.emissive,
    emissiveIntensity: S.eIntensity,
    envMapIntensity: 1.1,
  });
```

- [ ] **Step 3: Verify**

- `npx tsc --noEmit` — only pre-existing warnings.
- `npm test` — 37 tests pass.
- `npm run build` — succeeds.

- [ ] **Step 4: Commit**

```bash
git add src-next/render/three/MaterialEnv.ts src-next/render/three/Dice3D.ts
git commit -m "feat(render): procedural PBR env map for dice reflections (cosmic palette)"
```

---

## Verification

1. tsc/test/build clean.
2. Dev preview: open Round, observe dice. Surfaces should show subtle purple/astral reflection on their facets, not flat shading. Pips read as more luminous. No visual artifacts.
