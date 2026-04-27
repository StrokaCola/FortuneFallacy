/**
 * Fortune Fallacy — Physics-ready Die for Three.js + Rapier
 * ----------------------------------------------------------
 * Builds a die as TWO things, by design:
 *
 *   1. VISUAL  — a high-poly RoundedBoxGeometry mesh group with materials
 *                that match the celestial CSS look (radial gradient body,
 *                halo'd pips, soft astral edge glow).
 *
 *   2. COLLIDER — a clean unit cuboid Rapier collider (size matched), plus
 *                 a rigid body, plus mass / damping tuned so dice tumble and
 *                 settle predictably without endless wobble.
 *
 * The visual mesh is `.userData.isVisual` and is what you `.add()` to the
 * scene; the collider/body live in the Rapier world. Sync them each frame
 * with `die.sync()`.
 *
 * After dice come to rest, call `die.readFace()` — it inspects the body's
 * orientation matrix, projects each canonical face normal into world space,
 * and returns whichever face has the largest +Y component. This is the
 * "up face" — the value the die rolled.
 *
 * Usage (pseudocode):
 *
 *   import RAPIER from '@dimforge/rapier3d-compat';
 *   await RAPIER.init();
 *   const world = new RAPIER.World({ x: 0, y: -30, z: 0 });
 *
 *   const die = new PhysicsDie({
 *     RAPIER, world, scene,
 *     size: 1, style: 'celestial',
 *     position: [0, 6, 0],
 *   });
 *
 *   // each frame:
 *   world.step();
 *   die.sync();
 *
 *   // when the body has come to rest:
 *   if (die.isResting()) {
 *     const face = die.readFace();   // 1..6
 *   }
 *
 * Also exports `buildDieVisual()` and `buildDieCollider()` separately if
 * you'd rather wire physics yourself.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ────────────────────────────────────────────────────────────────────────────
// Style presets — match the celestial CSS dice
// ────────────────────────────────────────────────────────────────────────────
// Style presets — match the celestial CSS dice. Each style now has a glass
// "crystal" appearance via MeshPhysicalMaterial transmission. eIntensity
// controls how brightly the embedded pip orbs glow through the body.
export const DIE_STYLES = {
  celestial: { bodyTint: 0x6b4ad6, bodyDeep: 0x1a0c4a, edge: 0xbba8ff, pip: 0xdcd4ff, halo: 0x7be3ff, eIntensity: 1.9, transmission: 0.50, thickness: 0.65, ior: 1.43, rough: 0.41 },
  obsidian:  { bodyTint: 0x2e1d6b, bodyDeep: 0x07051a, edge: 0xf5c451, pip: 0xf5c451, halo: 0xf5c451, eIntensity: 1.2, transmission: 0.18, thickness: 0.85, ior: 1.52, rough: 0.41 },
  ember:     { bodyTint: 0xff6a3a, bodyDeep: 0x5a1408, edge: 0xffe9c8, pip: 0xfff7e8, halo: 0xff7847, eIntensity: 1.5, transmission: 0.40, thickness: 0.7, ior: 1.46, rough: 0.41 },
  ivory:     { bodyTint: 0xfff7e0, bodyDeep: 0xa89868, edge: 0xffffff, pip: 0x1c1245, halo: 0x5c39c4, eIntensity: 0.0, transmission: 0.25, thickness: 0.8, ior: 1.40, rough: 0.41 },
  glass:     { bodyTint: 0x9be8ff, bodyDeep: 0x0a1422, edge: 0x7be3ff, pip: 0xf3f0ff, halo: 0x7be3ff, eIntensity: 1.8, transmission: 0.80, thickness: 0.55, ior: 1.43, rough: 0.41 },
};

// Pip layouts (face-local UV in [-0.5, 0.5])
const PIPS = {
  1: [[ 0.00,  0.00]],
  2: [[-0.22, -0.22], [ 0.22,  0.22]],
  3: [[-0.24, -0.24], [ 0.00,  0.00], [ 0.24,  0.24]],
  4: [[-0.22, -0.22], [ 0.22, -0.22], [-0.22,  0.22], [ 0.22,  0.22]],
  5: [[-0.24, -0.24], [ 0.24, -0.24], [ 0.00,  0.00], [-0.24,  0.24], [ 0.24,  0.24]],
  6: [[-0.24, -0.28], [ 0.24, -0.28], [-0.24,  0.00], [ 0.24,  0.00], [-0.24,  0.28], [ 0.24,  0.28]],
};

// Procedurally-built radial-gradient sprite texture for halos.
// Cached at module scope so we share one texture across all dice/pips.
let _haloTex = null;
function getHaloTexture() {
  if (_haloTex) return _haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.0,  'rgba(255,255,255,1.0)');
  g.addColorStop(0.15, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.4,  'rgba(255,255,255,0.35)');
  g.addColorStop(0.7,  'rgba(255,255,255,0.08)');
  g.addColorStop(1.0,  'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _haloTex = new THREE.CanvasTexture(c);
  _haloTex.colorSpace = THREE.SRGBColorSpace;
  return _haloTex;
}

// Canonical face → outward normal in DIE-LOCAL space.
// Standard d6: opposite faces sum to 7. front=1 (+Z), back=6 (-Z),
// right=2 (+X), left=5 (-X), top=3 (+Y), bottom=4 (-Y).
export const FACE_NORMALS = {
  1: new THREE.Vector3( 0,  0,  1),
  2: new THREE.Vector3( 1,  0,  0),
  3: new THREE.Vector3( 0,  1,  0),
  4: new THREE.Vector3( 0, -1,  0),
  5: new THREE.Vector3(-1,  0,  0),
  6: new THREE.Vector3( 0,  0, -1),
};

const FACE_DEFS = [
  { val: 1, axis: 'z', sign:  1 },
  { val: 6, axis: 'z', sign: -1 },
  { val: 2, axis: 'x', sign:  1 },
  { val: 5, axis: 'x', sign: -1 },
  { val: 3, axis: 'y', sign:  1 },
  { val: 4, axis: 'y', sign: -1 },
];

// ────────────────────────────────────────────────────────────────────────────
// Visual mesh
// ────────────────────────────────────────────────────────────────────────────
export function buildDieVisual({ size = 1, style = 'celestial', pipStyle = 'indent' } = {}) {
  const S = DIE_STYLES[style] ?? DIE_STYLES.celestial;
  const group = new THREE.Group();
  group.name = `Die_${style}`;
  group.userData.isVisual = true;
  group.userData.style = style;

  // Body — translucent crystal cube. MeshPhysicalMaterial with transmission
  // gives true light-through-glass refraction so embedded pip orbs read as
  // glowing inclusions, not stickers.
  const bodyGeo = new RoundedBoxGeometry(size, size, size, 8, size * 0.18);

  // Subtle vertex-color gradient — tints the deep edges, leaves the bulk
  // closer to bodyTint so transmission shows through.
  const tint = new THREE.Color(S.bodyTint);
  const deep = new THREE.Color(S.bodyDeep);
  const colors = [];
  const pos = bodyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const corner = (Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z)) / (size * 1.5);
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
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  body.name = 'Body';
  group.add(body);

  // Edge highlight — derived from the ROUNDED geometry so the line follows
  // the chamfered silhouette, not a sharp box. thresholdAngle filters out
  // the dense chamfer-mesh seams and leaves only the 12 main edge curves.
  const edgeGeo = new THREE.EdgesGeometry(bodyGeo, 25);
  const edgeMat = new THREE.LineBasicMaterial({
    color: S.edge, transparent: true, opacity: 0.45,
    toneMapped: false,
  });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  edgeLines.scale.setScalar(1.002); // hair-line outset so edges aren't z-fought by the body
  group.add(edgeLines);

  // Pips — glowing-from-within. Each pip is built as:
  //   1. A bright emissive core BENEATH the surface (acts as the light source)
  //   2. A translucent frosted disc AT the surface, slightly raised, that the
  //      core glow shines through — like a lantern window.
  //   3. A thin dark rim around the disc, etched into the surface, so it
  //      reads as a real inset, not a sticker.
  //   4. An additive billboard sprite OUTSIDE the surface for the bloom flare.
  //
  // Because of the deep chamfer (.18) the pips on edge-positions can clip
  // into the rounded corner. We push pips to surface +1.5% of size, and the
  // halo sprite sits another 0.8% out, so nothing intersects the body geometry.
  // Pips — embedded glowing orbs visible THROUGH the translucent body.
  //   1. Bright unlit sphere sunk into the body — refracts through transmission.
  //   2. Thin emissive surface lens flush with the face for a defined "well".
  //   3. Additive billboard halo sprite for bloom flare.
  const orbMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(S.pip).multiplyScalar(2.4),
    toneMapped: false,
  });
  const lensMat = new THREE.MeshStandardMaterial({
    color: S.halo,
    emissive: S.halo,
    emissiveIntensity: Math.max(0.5, S.eIntensity * 0.9),
    metalness: 0.0,
    roughness: 0.18,
    transparent: true,
    opacity: 0.78,
    toneMapped: false,
  });
  const haloMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: S.halo,
    transparent: true,
    opacity: S.eIntensity > 0 ? 1.0 : 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });

  const half = size / 2;
  const pipR = size * 0.075;
  const orbDepth = size * 0.10;
  const surfaceOut = size * 0.0015;

  FACE_DEFS.forEach(({ val, axis, sign }) => {
    const positions = PIPS[val];
    positions.forEach(([u, v], i) => {
      const faceGroup = new THREE.Group();
      faceGroup.name = `Pip_face${val}_${i}`;

      // 1. Glowing orb sunk inside the crystal — true light source.
      const orbGeo = new THREE.SphereGeometry(pipR * 0.85, 18, 14);
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.z = -orbDepth;
      faceGroup.add(orb);

      // 2. Surface lens — flush translucent disc.
      const lensGeo = new THREE.CircleGeometry(pipR * 1.05, 28);
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.z = surfaceOut;
      faceGroup.add(lens);

      // 3. Halo sprite for bloom flare.
      if (S.eIntensity > 0) {
        const halo = new THREE.Sprite(haloMat);
        const haloSize = pipR * 4.0;
        halo.scale.set(haloSize, haloSize, 1);
        halo.position.z = surfaceOut + size * 0.008;
        faceGroup.add(halo);
      }

      // Place + orient so faceGroup-local +Z aligns with the outward face
      // normal of the cube.
      if (axis === 'z') {
        faceGroup.position.set(u * size, v * size, sign * half);
        faceGroup.rotation.y = sign > 0 ? 0 : Math.PI;
      } else if (axis === 'x') {
        faceGroup.position.set(sign * half, v * size, -u * size * sign);
        faceGroup.rotation.y = sign * Math.PI / 2;
      } else { // y
        faceGroup.position.set(u * size, sign * half, -v * size * sign);
        faceGroup.rotation.x = -sign * Math.PI / 2;
      }
      group.add(faceGroup);
    });
  });

  return group;
}

// ────────────────────────────────────────────────────────────────────────────
// Collider + rigid body
// ────────────────────────────────────────────────────────────────────────────
/**
 * Creates a Rapier dynamic rigid body + cuboid collider tuned for d6 dice.
 * Mass/density chosen so a `size=1` die settles in roughly 1.5–2.5s under
 * `gravity.y = -30`. Tweak via opts.density / opts.linearDamping.
 *
 * Crucially the collider is a perfect axis-aligned cube of half-extent size/2;
 * we deliberately do NOT add the rounded-corner bevel to the physics shape —
 * Rapier's contact manifolds are stable on cuboid-cuboid, and the visual
 * bevel is small enough that the discrepancy is invisible.
 */
export function buildDieCollider({ RAPIER, world, size = 1, position = [0, 4, 0], rotation, density = 1.4, restitution = 0.2, friction = 0.7, linearDamping = 0.25, angularDamping = 0.55, ccd = true } = {}) {
  const half = size / 2;

  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(position[0], position[1], position[2])
    .setLinearDamping(linearDamping)
    .setAngularDamping(angularDamping)
    .setCcdEnabled(ccd);

  // optional initial spin / rotation
  if (rotation) {
    if (rotation.length === 4) {
      bodyDesc.setRotation({ x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] });
    }
  }

  const body = world.createRigidBody(bodyDesc);

  const colDesc = RAPIER.ColliderDesc.cuboid(half, half, half)
    .setDensity(density)
    .setRestitution(restitution)
    .setFriction(friction);

  const collider = world.createCollider(colDesc, body);
  return { body, collider };
}

// ────────────────────────────────────────────────────────────────────────────
// Combined PhysicsDie
// ────────────────────────────────────────────────────────────────────────────
export class PhysicsDie {
  constructor({ RAPIER, world, scene, size = 1, style = 'celestial', pipStyle = 'indent', position = [0, 4, 0], rotation, density, linearDamping, angularDamping, restitution, friction, ccd } = {}) {
    this.RAPIER = RAPIER;
    this.world = world;
    this.size = size;
    this.style = style;

    this.visual = buildDieVisual({ size, style, pipStyle });
    if (scene) scene.add(this.visual);

    const { body, collider } = buildDieCollider({
      RAPIER, world, size, position, rotation,
      density, restitution, friction, linearDamping, angularDamping, ccd,
    });
    this.body = body;
    this.collider = collider;

    // scratch
    this._q = new THREE.Quaternion();
    this._n = new THREE.Vector3();
    this._restFrames = 0;
  }

  /** Copy body transform → visual mesh. Call every frame after world.step(). */
  sync() {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.visual.position.set(t.x, t.y, t.z);
    this.visual.quaternion.set(r.x, r.y, r.z, r.w);
  }

  /** True when linear+angular velocities are below threshold for ~30 frames. */
  isResting(threshold = 0.05) {
    const lv = this.body.linvel();
    const av = this.body.angvel();
    const mag = Math.sqrt(lv.x*lv.x + lv.y*lv.y + lv.z*lv.z + av.x*av.x + av.y*av.y + av.z*av.z);
    if (mag < threshold) {
      this._restFrames++;
    } else {
      this._restFrames = 0;
    }
    return this._restFrames > 30;
  }

  /**
   * Determine the upward-facing value (1..6) by projecting each canonical
   * face normal through the body's current rotation and picking the one
   * whose world-space +Y component is largest.
   */
  readFace() {
    const r = this.body.rotation();
    this._q.set(r.x, r.y, r.z, r.w);
    let best = 1, bestY = -Infinity;
    for (const [face, n] of Object.entries(FACE_NORMALS)) {
      this._n.copy(n).applyQuaternion(this._q);
      if (this._n.y > bestY) { bestY = this._n.y; best = +face; }
    }
    return best;
  }

  /** Reset the die to a target face, position, with random spin. */
  rollTo({ face, position = [0, 6, 0], force = 8, torque = 12 } = {}) {
    // pre-rotate so the desired face starts roughly up — useful for "loaded" dice
    // (rune effect). Random fall + random spin ensures it still tumbles naturally.
    const target = FACE_NORMALS[face] || FACE_NORMALS[1];
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(target.clone(), up);
    // add a small random tilt so it doesn't look canned
    const jitter = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.4,
    ));
    q.multiply(jitter);

    this.body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.body.setLinvel({
      x: (Math.random() - 0.5) * force,
      y: -Math.abs(Math.random()) * force * 0.4,
      z: (Math.random() - 0.5) * force,
    }, true);
    this.body.setAngvel({
      x: (Math.random() - 0.5) * torque,
      y: (Math.random() - 0.5) * torque,
      z: (Math.random() - 0.5) * torque,
    }, true);
    this._restFrames = 0;
  }

  /** Plain free roll — random spin & toss. */
  roll({ position = [0, 6, 0], force = 10, torque = 15 } = {}) {
    this.body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
    this.body.setRotation({
      x: Math.random(), y: Math.random(), z: Math.random(), w: Math.random(),
    }, true);
    this.body.setLinvel({
      x: (Math.random() - 0.5) * force,
      y: -Math.abs(Math.random()) * force * 0.4,
      z: (Math.random() - 0.5) * force,
    }, true);
    this.body.setAngvel({
      x: (Math.random() - 0.5) * torque,
      y: (Math.random() - 0.5) * torque,
      z: (Math.random() - 0.5) * torque,
    }, true);
    this._restFrames = 0;
  }

  /** Free GPU + physics resources. */
  dispose({ scene } = {}) {
    if (scene) scene.remove(this.visual);
    this.visual.traverse((o) => {
      o.geometry?.dispose?.();
      const m = o.material;
      if (Array.isArray(m)) m.forEach(x => x.dispose?.());
      else m?.dispose?.();
    });
    this.world.removeCollider(this.collider, false);
    this.world.removeRigidBody(this.body);
  }
}
