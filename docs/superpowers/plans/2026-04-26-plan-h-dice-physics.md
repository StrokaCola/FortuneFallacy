# Plan H — Dice Physics Visual Sync Implementation Plan

> Subagent-driven. `- [ ]` checkboxes.

**Goal:** Dice3D renderer plays back actual Rapier physics transforms instead of scripted tumble. Result: every roll visually unique, real bounces, natural settle.

**Architecture:** Existing `rapierSim.ts` already runs the deterministic Rapier simulation and produces final faces. Extend `SimulationResult` to optionally carry `frames: { positions: Vec3[]; quaternions: Quat[] }[]` (one entry per physics step). Renderer subscribes to `onSimulationEnd` and plays the frames at 60Hz, then smoothly rotates each die to the canonical face orientation matching the determined face value.

Existing code: `runRapierSim` runs 240 steps capturing only collisions/peakVelocity/restPositions. We add per-step capture, gated by a simple flag (so headless contexts don't pay cost).

---

## Task 1 — Stream physics transforms from rapierSim

**Files:**
- Modify: `src-next/events/types.ts` — extend `SimulationResult` with optional `frames`.
- Modify: `src-next/simulation/rapierSim.ts` — capture per-step transforms.
- Modify: `src-next/simulation/runSimulation.ts` — pass through frames.

- [ ] **Step 1: Extend `SimulationResult`**

In `src-next/events/types.ts`, extend the type:

```ts
export type DieFrame = { px: number; py: number; pz: number; qx: number; qy: number; qz: number; qw: number };

export type SimulationResult = {
  finalFaces: number[];
  restPositions: { x: number; y: number; z: number }[];
  settleMs: number[];
  peakVelocity: number;
  collisionCount: number;
  bounceHeights: number[];
  cameraShake?: number;
  frames?: DieFrame[][]; // [perDie][perStep]
};
```

- [ ] **Step 2: Capture transforms in `runRapierSim`**

In `src-next/simulation/rapierSim.ts`, before the main step loop, declare:

```ts
  const frames: DieFrame[][] = bodies.map(() => []);
```

Replace the existing `bodies.forEach` block inside the loop with:

```ts
    bodies.forEach((b, i) => {
      const t = b.translation();
      const q = b.rotation();
      const v = b.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      if (speed > peakVelocity) peakVelocity = speed;
      if (t.y > bounceHeights[i]!) bounceHeights[i] = t.y;
      const angV = b.angvel();
      const angSpeed = Math.hypot(angV.x, angV.y, angV.z);
      frames[i]!.push({ px: t.x, py: t.y, pz: t.z, qx: q.x, qy: q.y, qz: q.z, qw: q.w });
      if (!settled[i] && speed < 0.05 && angSpeed < 0.05 && t.y < 1.0) {
        settled[i] = true;
        settleMs[i] = step * STEP_MS;
      }
    });
```

Add `DieFrame` to the import:
```ts
import type { SimulationRequest, SimulationResult, DieFrame } from '../events/types';
```

In the return value, include frames:
```ts
  return {
    finalFaces,
    restPositions,
    settleMs,
    peakVelocity,
    collisionCount,
    bounceHeights,
    frames,
  };
```

- [ ] **Step 3: `runSimulation.ts` mergeWithLocks preserves frames**

The existing `mergeWithLocks` spreads `...result`, which already preserves `frames`. No change needed unless the frames list needs trimming for locked dice — it doesn't (locked dice were never simulated dynamically; they keep prevFaces). Confirm by inspection.

- [ ] **Step 4: tsc/test/build clean.**

- [ ] **Step 5: Commit**

```bash
git add src-next/events/types.ts src-next/simulation/rapierSim.ts
git commit -m "feat(sim): capture per-step physics frames for renderer playback"
```

---

## Task 2 — Dice3D plays back real physics frames

**Files:**
- Modify: `src-next/render/three/Dice3D.ts`

- [ ] **Step 1: Add a frames-playback path**

In `src-next/render/three/Dice3D.ts`, add new state on each `DieAnim`:

```ts
type DieAnim = {
  // ...existing fields...
  playback: { frames: import('../../events/types').DieFrame[]; startedAt: number; stepMs: number } | null;
};
```

Initialize `playback: null` in `buildDice`.

In the `unsubscribers.push(...)` block in the constructor, replace the existing `bus.on('onSimulationStart', ...)` with:

```ts
      bus.on('onSimulationEnd', ({ result }) => this.startPlayback(result.frames, result.finalFaces)),
```

Remove the `kickAll` method (or keep it as a fallback when `frames` are missing; cleaner to keep it).

Add a new method:

```ts
  private startPlayback(frames: import('../../events/types').DieFrame[][] | undefined, finalFaces: number[]): void {
    if (!frames || frames.length === 0) {
      // No frames — fallback to scripted tumble.
      this.kickAll();
      return;
    }
    const now = performance.now();
    const STEP_MS = 1000 / 60;
    this.dice.forEach((d, i) => {
      if (d.locked) return;
      const f = frames[i];
      if (!f || f.length === 0) return;
      d.playback = { frames: f, startedAt: now, stepMs: STEP_MS };
      d.rolling = false;
      // Set determined face target so we smoothly snap after playback.
      const face = finalFaces[i];
      if (face != null) {
        d.targetQuat.setFromEuler(new THREE.Euler(...FACE_ROT[face]!));
      }
    });
  }
```

In the main `start()`/`loop()` function body, before the existing `if (d.rolling) {` branch, add a playback branch:

```ts
        if (d.playback) {
          const elapsed = now - d.playback.startedAt;
          const idx = Math.min(d.playback.frames.length - 1, Math.floor(elapsed / d.playback.stepMs));
          const fr = d.playback.frames[idx]!;
          // Convert sim coords to renderer coords. Sim has y-up, world origin at tray floor;
          // renderer uses similar — pass through as-is. Adjust scale if dice look small.
          const SIM_TO_RENDER = 1.0;
          d.group.position.set(fr.px * SIM_TO_RENDER, fr.py * SIM_TO_RENDER, fr.pz * SIM_TO_RENDER);
          d.group.quaternion.set(fr.qx, fr.qy, fr.qz, fr.qw);
          if (idx >= d.playback.frames.length - 1) {
            // Playback finished — start a short corrective tween to canonical face orientation.
            d.playback = null;
            d.startQuat.copy(d.group.quaternion);
            d.startPos.copy(d.group.position);
            d.targetPos.copy(d.homePos);
            d.targetScale = 1;
            d.startScale = d.group.scale.x;
            d.t0 = now;
            d.duration = 240;
          }
          continue;
        }
```

(The existing `if (d.rolling)` and the `else` lerp branch run unchanged after playback completes.)

- [ ] **Step 2: tsc/test/build clean.**

- [ ] **Step 3: Manual smoke**

If browser available: dev server, Cast Hand. Verify dice tumble looks natural (no two rolls identical, real bounces, dice ricochet off tray walls). After settle, dice smoothly orient to the final face.

- [ ] **Step 4: Commit**

```bash
git add src-next/render/three/Dice3D.ts
git commit -m "feat(render): play back rapier per-step transforms in Dice3D (real physics tumble)"
```

---

## Verification

1. tsc/test/build clean.
2. Dev preview: cast multiple hands; verify each tumble is unique, dice bounce realistically off walls, settle on flat faces, then smoothly orient to the determined face. Listen for `diceClack` SFX (driven by `onRollStart`). No two rolls look identical.
