import type { SimulationRequest, SimulationResult, DieFrame } from '../events/types';
import { faceCorrection, quatMul } from './faceFromPose';
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

const TRAY_MIN = -4;
const TRAY_MAX =  4;
const FLOOR_Y  = 0;

export async function runRapierSim(req: SimulationRequest, prevFaces: number[]): Promise<SimulationResult | null> {
  const r = await ensureRapier();
  if (!r) return null;

  const rng = mulberry32(req.seed >>> 0);
  const world: World = new r.World({ x: 0, y: -9.81, z: 0 });

  const floorDesc = r.ColliderDesc.cuboid(10, 0.1, 8).setTranslation(0, FLOOR_Y - 0.1, 0).setRestitution(0.45);
  world.createCollider(floorDesc);
  for (const w of [
    r.ColliderDesc.cuboid(0.1, 4, 8).setTranslation(TRAY_MIN, 2, 0),
    r.ColliderDesc.cuboid(0.1, 4, 8).setTranslation(TRAY_MAX, 2, 0),
    r.ColliderDesc.cuboid(10, 4, 0.1).setTranslation(0, 2, TRAY_MIN),
    r.ColliderDesc.cuboid(10, 4, 0.1).setTranslation(0, 2, TRAY_MAX),
  ]) world.createCollider(w);

  const bodies: RigidBody[] = [];
  const diceCount = Math.max(prevFaces.length, 5);
  for (let i = 0; i < diceCount; i++) {
    const x = TRAY_MIN + 0.8 + i * 1.6;
    const z = (rng.next() - 0.5) * 1.5;
    const bodyDesc = r.RigidBodyDesc.dynamic()
      .setTranslation(x, 4 + rng.next() * 1.5, z)
      .setLinvel((rng.next() - 0.5) * 11, -4, (rng.next() - 0.5) * 11)
      .setAngvel({ x: rng.next() * 20 - 10, y: rng.next() * 20 - 10, z: rng.next() * 20 - 10 });
    const body = world.createRigidBody(bodyDesc);
    const cube = r.ColliderDesc.cuboid(0.4, 0.4, 0.4).setRestitution(0.35).setDensity(1.5);
    world.createCollider(cube, body);
    bodies.push(body);
  }

  let collisionCount = 0;
  let peakVelocity = 0;
  const bounceHeights: number[] = bodies.map(() => 0);
  const settleMs: number[] = bodies.map(() => 0);
  const settled: boolean[] = bodies.map(() => false);

  const eventQueue = new r.EventQueue(true);
  const STEP_MS = 1000 / 60;

  const frames: DieFrame[][] = bodies.map(() => []);

  for (let step = 0; step < 240; step++) {
    world.step(eventQueue);
    eventQueue.drainCollisionEvents(() => { collisionCount += 1; });
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
  bodies.forEach((_b, i) => {
    const fr = frames[i];
    if (!fr || fr.length === 0) return;
    const target = targets[i];
    if (target == null) return;
    const restQ = fr[fr.length - 1]!;
    const corr = faceCorrection(
      { x: restQ.qx, y: restQ.qy, z: restQ.qz, w: restQ.qw },
      target,
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
    bounceHeights,
    frames,
  };
}
