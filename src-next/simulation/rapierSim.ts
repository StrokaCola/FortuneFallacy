import type { SimulationRequest, SimulationResult, DieFrame } from '../events/types';
import type { DieShape } from '../data/dice';
import { faceCorrection, quatMul } from './faceFromPose';
import { SHAPE_DATA } from '../render/three/polyhedra';
import { mulberry32 } from '../core/rng';

type RapierModule = typeof import('@dimforge/rapier3d');
type World = InstanceType<RapierModule['World']>;
type RigidBody = InstanceType<RapierModule['RigidBody']>;

let RAPIER: RapierModule | null = null;
let loadAttempted = false;

export async function ensureRapier(): Promise<RapierModule | null> {
  if (RAPIER) return RAPIER;
  if (loadAttempted) return null;
  loadAttempted = true;
  try {
    const base = import.meta.env.BASE_URL;
    const url = `${base}rapier/rapier.mjs`;
    const wasmUrl = `${base}rapier/rapier_wasm3d_bg.wasm`;
    const dynamicImport = new Function('u', 'return import(u)') as (u: string) => Promise<unknown>;
    const mod = (await dynamicImport(url)) as RapierModule & { init: (cfg: { module_or_path: string }) => Promise<void> };
    await mod.init({ module_or_path: wasmUrl });
    RAPIER = mod;
    return mod;
  } catch (e) {
    console.warn('[rapier] load failed:', (e as Error).message);
    return null;
  }
}

const TRAY_X = 6.5;
const TRAY_Z = 4;
const FLOOR_Y = 0;

// Per-shape rapier collider. Cube uses cuboid (faster, well-tested); other
// shapes build a convex hull from the polyhedron vertex cloud scaled to
// match the old cube extent. If `convexHull` returns null (degenerate input)
// we fall back to a cuboid of equivalent size — the visible mesh still
// renders as the polyhedron, just with cube-fairness physics.
//
// COLLISION_EVENTS is required: ColliderDesc defaults to ActiveEvents.NONE,
// which silently drops every drainCollisionEvents callback. Without this
// the collision-pack catalysts (kinetic_charge, chain_reaction,
// kindred_clatter) never fire in real physics — the headless seeded
// fallback masks the regression because it synthesizes its own count.
export function colliderForShape(r: RapierModule, shape: DieShape, half: number) {
  const events = r.ActiveEvents.COLLISION_EVENTS;
  if (shape === 'd6') {
    return r.ColliderDesc.cuboid(half, half, half)
      .setRestitution(0.35).setDensity(1.5).setActiveEvents(events);
  }
  const data = SHAPE_DATA[shape];
  const cloud = new Float32Array(data.vertices.length);
  for (let i = 0; i < data.vertices.length; i++) cloud[i] = data.vertices[i]! * half;
  const hull = r.ColliderDesc.convexHull(cloud);
  if (hull) return hull.setRestitution(0.35).setDensity(1.5).setActiveEvents(events);
  return r.ColliderDesc.cuboid(half, half, half)
    .setRestitution(0.35).setDensity(1.5).setActiveEvents(events);
}

export async function runRapierSim(req: SimulationRequest, prevFaces: number[]): Promise<SimulationResult | null> {
  const r = await ensureRapier();
  if (!r) return null;

  const rng = mulberry32(req.seed >>> 0);
  const world: World = new r.World({ x: 0, y: -9.81, z: 0 });

  const floorDesc = r.ColliderDesc.cuboid(TRAY_X + 2, 0.1, TRAY_Z + 2).setTranslation(0, FLOOR_Y - 0.1, 0).setRestitution(0.45);
  world.createCollider(floorDesc);
  for (const w of [
    r.ColliderDesc.cuboid(0.1, 4, TRAY_Z).setTranslation(-TRAY_X, 2, 0),
    r.ColliderDesc.cuboid(0.1, 4, TRAY_Z).setTranslation( TRAY_X, 2, 0),
    r.ColliderDesc.cuboid(TRAY_X, 4, 0.1).setTranslation(0, 2, -TRAY_Z),
    r.ColliderDesc.cuboid(TRAY_X, 4, 0.1).setTranslation(0, 2,  TRAY_Z),
  ]) world.createCollider(w);

  const bodies: RigidBody[] = [];
  // Constellation-driven: dice count tracks the active spec (1 for Argo,
  // 5 for Lyra, 7 for Mensa, etc). Default to 1 if everything's empty.
  const diceCount = Math.max(prevFaces.length, 1);
  const shapes: DieShape[] = req.diceShapes ?? [];
  // Physics scale: the cube collider was 0.4 half-extent → 0.8-side cube.
  // For non-cube shapes the polyhedron lives on a unit sphere; scaling its
  // vertex cloud by HALF (matches old half-extent) keeps similar tray feel.
  const HALF = 0.4;
  // collider-handle → die index map so collision events can be attributed
  // to specific dice. Built alongside body creation. Rapier's
  // drainCollisionEvents callback gets collider handles (not body handles),
  // so this map keys on the collider returned by createCollider.
  const colliderToIdx = new Map<number, number>();
  for (let i = 0; i < diceCount; i++) {
    const x = (i - (diceCount - 1) / 2) * 1.6;
    const z = (rng.next() - 0.5) * 1.5;
    const bodyDesc = r.RigidBodyDesc.dynamic()
      .setTranslation(x, 4 + rng.next() * 1.5, z)
      .setLinvel((rng.next() - 0.5) * 16, -6, (rng.next() - 0.5) * 16)
      .setAngvel({ x: rng.next() * 26 - 13, y: rng.next() * 26 - 13, z: rng.next() * 26 - 13 });
    const body = world.createRigidBody(bodyDesc);
    const shape = shapes[i] ?? 'd6';
    const collider = colliderForShape(r, shape, HALF);
    const created = world.createCollider(collider, body);
    if (created && typeof created.handle === 'number') {
      colliderToIdx.set(created.handle, i);
    }
    bodies.push(body);
  }

  let collisionCount = 0;
  const collisionPairs: Array<[number, number]> = [];
  let peakVelocity = 0;
  const bounceHeights: number[] = bodies.map(() => 0);
  const settleMs: number[] = bodies.map(() => 0);
  const settled: boolean[] = bodies.map(() => false);

  const eventQueue = new r.EventQueue(true);
  const STEP_MS = 1000 / 60;

  const frames: DieFrame[][] = bodies.map(() => []);

  for (let step = 0; step < 240; step++) {
    world.step(eventQueue);
    eventQueue.drainCollisionEvents((h1: number, h2: number, started: boolean) => {
      if (!started) return;
      collisionCount += 1;
      const a = colliderToIdx.get(h1);
      const b = colliderToIdx.get(h2);
      if (a != null && b != null) collisionPairs.push([a, b]);
    });
    bodies.forEach((b, i) => {
      const v = b.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      if (speed > peakVelocity) peakVelocity = speed;
      const t = b.translation();
      if (t.y > bounceHeights[i]!) bounceHeights[i] = t.y;
      const angV = b.angvel();
      const angSpeed = Math.hypot(angV.x, angV.y, angV.z);
      const q = b.rotation();
      frames[i]!.push({ px: t.x, py: t.y, pz: t.z, qx: q.x, qy: q.y, qz: q.z, qw: q.w });
      if (!settled[i] && speed < 0.05 && angSpeed < 0.05 && t.y < 1.0) {
        settled[i] = true;
        settleMs[i] = step * STEP_MS;
      }
    });
    if (settled.every(Boolean) && step > 30) break;
  }

  const restPositions = bodies.map((b, i) => {
    const t = b.translation();
    if (settleMs[i] === 0) settleMs[i] = 4000;
    return { x: t.x, y: t.y, z: t.z };
  });

  // Map each die's physics tumble onto its predetermined face by applying a
  // local-frame correction quaternion to every captured frame. Because the
  // correction is right-multiplied (body frame), the world-space angular
  // velocity at every instant is unchanged — the die tumbles, bounces, and
  // settles exactly like physics produced, but with the cube relabeled so
  // the chosen face is the one that ends up on top. Since the correction
  // between two face normals is always one of the 24 cube symmetries
  // (a 90° or 180° rotation around an axis), the cube also stays flush
  // with the floor at rest. No post-settle flip.
  const targets = req.predeterminedFaces ?? [];
  // Spatial face indices for orientation. When omitted (older callers /
  // tests) we fall back to interpreting `predeterminedFaces` as the spatial
  // index — fine for d6 with faces [1..6] and dN with faces [1..N], where
  // value === spatial index. Constellations with non-standard face arrays
  // (Fibonacci, Eclipse, Ophiuchus) populate this explicitly so the cube
  // lands on the correct spatial face for the rolled value.
  const faceIdxTargets = req.predeterminedFaceIdx ?? targets;
  bodies.forEach((_b, i) => {
    const fr = frames[i];
    if (!fr || fr.length === 0) return;
    const target = faceIdxTargets[i];
    if (target == null) return;
    // Skip wildcard / blank sentinels — they have no physical face axis.
    if (!Number.isInteger(target) || target < 1) return;
    const shape = shapes[i] ?? 'd6';
    const faceCount = shape === 'd6' ? 6 : SHAPE_DATA[shape].faceCenters.length;
    if (target > faceCount) return;
    const restQ = fr[fr.length - 1]!;
    const corr = faceCorrection(
      { x: restQ.qx, y: restQ.qy, z: restQ.qz, w: restQ.qw },
      target,
      shape,
    );
    if (corr.x === 0 && corr.y === 0 && corr.z === 0 && corr.w === 1) return;
    for (let k = 0; k < fr.length; k++) {
      const f = fr[k]!;
      const q = quatMul({ x: f.qx, y: f.qy, z: f.qz, w: f.qw }, corr);
      f.qx = q.x; f.qy = q.y; f.qz = q.z; f.qw = q.w;
    }
  });

  // Final faces come from the predetermined sequence, not from where the
  // physics happened to land. The frame correction above makes sure the
  // visual rest pose matches.
  const finalFaces = bodies.map((_, i) => targets[i] ?? 1);

  world.free();
  eventQueue.free();

  return {
    finalFaces,
    restPositions,
    settleMs,
    peakVelocity,
    collisionCount,
    collisionPairs,
    bounceHeights,
    frames,
  };
}
