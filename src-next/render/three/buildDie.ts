// src-next/render/three/buildDie.ts
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ModMaterialOverride } from './dieMaterials';

export type StyleKey = 'celestial' | 'obsidian' | 'ember' | 'ivory' | 'glass';

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

export type GeometricVariant = 'asymmetric' | 'plated' | 'recessed';

export const STYLES: Record<StyleKey, StyleDef> = {
  celestial: { bodyTint: 0x6b4ad6, bodyDeep: 0x1a0c4a, edge: 0xbba8ff, pip: 0xdcd4ff, halo: 0x7be3ff, eIntensity: 1.9, transmission: 0.50, thickness: 0.65, ior: 1.43, rough: 0.41 },
  obsidian:  { bodyTint: 0x2e1d6b, bodyDeep: 0x07051a, edge: 0xf5c451, pip: 0xf5c451, halo: 0xf5c451, eIntensity: 1.2, transmission: 0.18, thickness: 0.85, ior: 1.52, rough: 0.41 },
  ember:     { bodyTint: 0xff6a3a, bodyDeep: 0x5a1408, edge: 0xffe9c8, pip: 0xfff7e8, halo: 0xff7847, eIntensity: 1.5, transmission: 0.40, thickness: 0.70, ior: 1.46, rough: 0.41 },
  ivory:     { bodyTint: 0xfff7e0, bodyDeep: 0xa89868, edge: 0xffffff, pip: 0x1c1245, halo: 0x5c39c4, eIntensity: 0.0, transmission: 0.25, thickness: 0.80, ior: 1.40, rough: 0.41 },
  glass:     { bodyTint: 0x9be8ff, bodyDeep: 0x0a1422, edge: 0x7be3ff, pip: 0xf3f0ff, halo: 0x7be3ff, eIntensity: 1.8, transmission: 0.80, thickness: 0.55, ior: 1.43, rough: 0.41 },
};

// Pip layouts (face-local UV in [-0.5, 0.5]) — matches Physics Dice mockup.
export const PIPS: Record<number, [number, number][]> = {
  1: [[ 0.00,  0.00]],
  2: [[-0.22, -0.22], [ 0.22,  0.22]],
  3: [[-0.24, -0.24], [ 0.00,  0.00], [ 0.24,  0.24]],
  4: [[-0.22, -0.22], [ 0.22, -0.22], [-0.22,  0.22], [ 0.22,  0.22]],
  5: [[-0.24, -0.24], [ 0.24, -0.24], [ 0.00,  0.00], [-0.24,  0.24], [ 0.24,  0.24]],
  6: [[-0.24, -0.28], [ 0.24, -0.28], [-0.24,  0.00], [ 0.24,  0.00], [-0.24,  0.28], [ 0.24,  0.28]],
};

// Face → local outward normal. Matches simulation/faceFromPose.ts FACE_AXES
// so the brightly-lit pip face is the one physics chose as the rolled value.
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

// Cached radial-gradient sprite texture — shared by all die halos and the
// constellation anchor stars. Built lazily on first die construction.
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

export function buildDie(
  size: number,
  styleKey: StyleKey,
  modOverride?: ModMaterialOverride,
  geometricVariant?: GeometricVariant,
): BuiltDie {
  const baseS = STYLES[styleKey];
  const S: StyleDef = modOverride ? { ...baseS, ...modOverride } : baseS;
  const group = new THREE.Group();
  group.name = `FortuneFallacyDie_${styleKey}`;

  // Body — translucent crystal cube with vertex-color gradient (tint→deep at
  // corners) so transmission shows the soft inner colour while edges fall to
  // the deep tone.
  // Plated variant: bigger chamfer hints at a ceramic-plate softness.
  const chamfer = size * (geometricVariant === 'plated' ? 0.26 : 0.18);
  const bodyGeo = new RoundedBoxGeometry(size, size, size, 8, chamfer);
  // Store the chamfer radius on parameters so tests can inspect it.
  (bodyGeo as any).parameters.radius = chamfer;
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

  // Asymmetric variant (Loaded): nudge +Y face vertices inward to create a
  // visible weighted-mass bowl. Subtle — the spec calls for "subtle, not
  // exaggerated" so the displacement is gated and capped at ~3% of size.
  if (geometricVariant === 'asymmetric') {
    const threshold = size * 0.45;
    const maxBow = size * 0.03;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > threshold) {
        const t = Math.min(1, (y - threshold) / (size / 2 - threshold));
        pos.setY(i, y - maxBow * t);
      }
    }
    pos.needsUpdate = true;
  }

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
  edgeLines.scale.setScalar(1.002); // hair-line outset to avoid z-fighting
  group.add(edgeLines);

  // Pips — three layers per pip:
  //   1. emissive orb sunk into the body (refracts through transmission)
  //   2. surface lens disc (per-face material — drives reveal/conceal)
  //   3. additive halo sprite for bloom flare (per-face material)
  // Per-face materials let us fade only the up-face after settle so the
  // landed value reads cleanly while the other 5 faces dim away.
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
  // protos aren't used directly — dispose so they don't linger.
  lensProto.dispose();
  haloProto.dispose();

  const pipGroup = new THREE.Group();
  pipGroup.name = 'pips';
  group.add(pipGroup);

  const half = size / 2;
  const pipR = size * 0.075;
  // Recessed variant (Pip Charge): orbs sit deeper, looking like contact points.
  const orbDepth = size * (geometricVariant === 'recessed' ? 0.16 : 0.10);
  const surfaceOut = size * 0.0015;
  const haloShown = S.eIntensity > 0;

  FACE_DEFS.forEach(({ val, axis, sign }) => {
    const positions = PIPS[val]!;
    const lensMat = faceLensMats[val as 1 | 2 | 3 | 4 | 5 | 6];
    const haloMat = faceHaloMats[val as 1 | 2 | 3 | 4 | 5 | 6];
    positions.forEach(([u, v], i) => {
      const faceGroup = new THREE.Group();
      faceGroup.name = `Pip_face${val}_${i}`;

      // 1. Glowing orb sunk inside the crystal.
      const orbGeo = new THREE.SphereGeometry(pipR * 0.85, 18, 14);
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.z = -orbDepth;
      faceGroup.add(orb);

      // 2. Surface lens — flush translucent disc (per-face material).
      const lensGeo = new THREE.CircleGeometry(pipR * 1.05, 28);
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.z = surfaceOut;
      faceGroup.add(lens);

      // 3. Halo sprite for bloom flare (per-face material).
      if (haloShown) {
        const halo = new THREE.Sprite(haloMat);
        const haloSize = pipR * 4.0;
        halo.scale.set(haloSize, haloSize, 1);
        halo.position.z = surfaceOut + size * 0.008;
        faceGroup.add(halo);
      }

      // Place + orient so faceGroup-local +Z aligns with the outward face normal.
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
