// src-next/render/three/buildDie.ts
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ModMaterialOverride } from './dieMaterials';
import type { DieShape, DieFace } from '../../data/dice';
import { buildPolyhedronGeometry, SHAPE_DATA } from './polyhedra';
import { getDigitTexture } from './digitTexture';

const STANDARD_D6_FACES: readonly DieFace[] = [1, 2, 3, 4, 5, 6];

// True iff the dice spec is "plain d6" — six unique numeric faces 1..6 in
// canonical order. Anything else (Fibonacci's [1,1,2,3,5,8], Eclipse's
// [0,0,0,1,1,1], Ophiuchus's [1..5,WILD]) needs digit textures so the value
// painted on each spatial face matches the rolled value the HUD shows.
function isStandardD6(faces: readonly DieFace[]): boolean {
  if (faces.length !== 6) return false;
  for (let i = 0; i < 6; i++) if (faces[i] !== STANDARD_D6_FACES[i]) return false;
  return true;
}

function describeFace(f: DieFace): string {
  if (f === 'WILD') return '★';
  if (f === 'BLANK') return '';
  if (f === 0) return '0';
  return String(f);
}

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

// Per-face material map indexed by face value (1..N). Use a permissive
// numeric record so non-cube dice (d8, d12, d20…) can extend past 6 keys.
// d6 callers populate keys 1..6; the cube paths still index by literal.
export type FaceMatMap<T> = Record<number, T>;

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
  shape: DieShape = 'd6',
  faceValues?: readonly DieFace[],
): BuiltDie {
  const baseS = STYLES[styleKey];
  const S: StyleDef = modOverride ? { ...baseS, ...modOverride } : baseS;
  if (shape !== 'd6') return buildPolyhedronDie(size, shape, S, styleKey, faceValues);
  // d6 with non-canonical faces (Fibonacci/Eclipse/Ophiuchus) renders digits
  // per spatial face so what the player sees matches the rolled value.
  if (faceValues && !isStandardD6(faceValues)) {
    return buildD6WithDigits(size, S, geometricVariant, faceValues);
  }
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

// d6 with non-canonical face values (Fibonacci/Eclipse/Ophiuchus). Same body
// + edges as the standard cube path, but each face carries a single digit
// lens whose texture matches the rolled VALUE for that spatial face — not
// the pip pattern of the spatial index. Pairs with initSimulation rolling a
// spatial idx + value pair so physics lands the correct face up.
function buildD6WithDigits(
  size: number,
  S: StyleDef,
  geometricVariant: GeometricVariant | undefined,
  faceValues: readonly DieFace[],
): BuiltDie {
  const group = new THREE.Group();
  group.name = `FortuneFallacyDie_d6digits`;

  const chamfer = size * (geometricVariant === 'plated' ? 0.26 : 0.18);
  const bodyGeo = new RoundedBoxGeometry(size, size, size, 8, chamfer);
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
  edgeLines.scale.setScalar(1.002);
  group.add(edgeLines);

  const faceLensMats = {} as FaceMatMap<THREE.MeshStandardMaterial>;
  const faceHaloMats = {} as FaceMatMap<THREE.SpriteMaterial>;
  const pipGroup = new THREE.Group();
  pipGroup.name = 'pips';
  group.add(pipGroup);

  const half = size / 2;
  const haloShown = S.eIntensity > 0;

  // FACE_DEFS: spatial face N (val) maps to dieSpec.faces[N-1]. Render the
  // digit for that value as a single emissive lens on the face.
  FACE_DEFS.forEach(({ val, axis, sign }) => {
    const dieFace = faceValues[val - 1] ?? val;
    const numericValue = dieFace === 'WILD' ? -1 : dieFace === 'BLANK' ? 0 : dieFace;

    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: S.halo,
      emissiveIntensity: Math.max(0.5, S.eIntensity * 0.9),
      map: getDigitTexture(numericValue, S.pip),
      transparent: true,
      opacity: 0,
      toneMapped: false,
      depthWrite: false,
    });
    faceLensMats[val as 1 | 2 | 3 | 4 | 5 | 6] = lensMat;

    const haloMat = new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color: S.halo,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    faceHaloMats[val as 1 | 2 | 3 | 4 | 5 | 6] = haloMat;

    const faceGroup = new THREE.Group();
    faceGroup.name = `Pip_face${val}`;

    // One large lens disc per face — sized to read clearly through CSS
    // scale-down on phone (≈0.49×). Slightly smaller than half the face so
    // the chamfered edge still shows.
    const lensR = size * 0.30;
    const lensGeo = new THREE.CircleGeometry(lensR, 32);
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.z = size * 0.0015;
    faceGroup.add(lens);

    if (haloShown) {
      const halo = new THREE.Sprite(haloMat);
      const haloSize = lensR * 2.2;
      halo.scale.set(haloSize, haloSize, 1);
      halo.position.z = size * 0.01;
      faceGroup.add(halo);
    }

    if (axis === 'z') {
      faceGroup.position.set(0, 0, sign * half);
      faceGroup.rotation.y = sign > 0 ? 0 : Math.PI;
    } else if (axis === 'x') {
      faceGroup.position.set(sign * half, 0, 0);
      faceGroup.rotation.y = sign * Math.PI / 2;
    } else {
      faceGroup.position.set(0, sign * half, 0);
      faceGroup.rotation.x = -sign * Math.PI / 2;
    }

    pipGroup.add(faceGroup);
  });

  return { group, faceLensMats, faceHaloMats, pipGroup };
}

// Non-cube path: builds a flat-shaded polyhedron (d4/d8/d10/d12/d20) with a
// digit label, lens disc, and halo sprite per face. Reuses the same
// `BuiltDie` shape so callers (Dice3D, DieView) don't branch on shape.
function buildPolyhedronDie(
  size: number,
  shape: Exclude<DieShape, 'd6'>,
  S: StyleDef,
  styleKey: StyleKey,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _faceValues?: readonly DieFace[],
): BuiltDie {
  const group = new THREE.Group();
  group.name = `FortuneFallacyDie_${shape}_${styleKey}`;

  const { geometry: bodyGeo } = buildPolyhedronGeometry(shape, size, S.bodyTint, S.bodyDeep);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    metalness: S.metalness ?? 0.0,
    roughness: S.rough,
    transmission: S.transmission * 0.65,    // a touch less translucent so faceted reads cleanly
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
    flatShading: true,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  body.name = 'Body';
  group.add(body);

  const edgeGeo = new THREE.EdgesGeometry(bodyGeo, 1);
  const edgeMat = new THREE.LineBasicMaterial({
    color: S.edge,
    transparent: true,
    opacity: 0.45,
    toneMapped: false,
  });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  edgeLines.scale.setScalar(1.002);
  group.add(edgeLines);

  const data = SHAPE_DATA[shape];
  const faceCount = data.faceCenters.length;
  const half = size / 2;

  const faceLensMats: FaceMatMap<THREE.MeshStandardMaterial> = {} as FaceMatMap<THREE.MeshStandardMaterial>;
  const faceHaloMats: FaceMatMap<THREE.SpriteMaterial> = {} as FaceMatMap<THREE.SpriteMaterial>;
  const pipGroup = new THREE.Group();
  pipGroup.name = 'pips';
  group.add(pipGroup);

  // Per-face label disc: digit texture (1..N) on a circular plane, oriented
  // outward along the face normal. Faceted shapes look cleaner with a single
  // numeral than with cube-style pip patterns.
  const haloShown = S.eIntensity > 0;
  const isD4 = shape === 'd4';
  for (let f = 1; f <= faceCount; f++) {
    const faceIdx = f - 1;
    // d4 axes are stored INWARD so faceFromQuaternion picks the bottom face.
    // For label placement we still want the OUTWARD normal of the face so the
    // numeral sits on the visible surface; recover it by negating.
    const c = data.faceCenters[faceIdx]!;
    const outward = isD4 ? { x: -c.x, y: -c.y, z: -c.z } : c;
    const normalVec = new THREE.Vector3(outward.x, outward.y, outward.z).normalize();

    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: S.halo,
      emissiveIntensity: Math.max(0.5, S.eIntensity * 0.9),
      map: getDigitTexture(f, S.pip),
      transparent: true,
      opacity: 0,
      toneMapped: false,
      depthWrite: false,
    });
    faceLensMats[f] = lensMat;

    const haloMat = new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color: S.halo,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    faceHaloMats[f] = haloMat;

    const faceGroup = new THREE.Group();
    faceGroup.name = `Pip_face${f}`;

    // Lens disc — sits flush on the polyhedron face, centered.
    const lensR = labelRadius(shape) * size;
    const lensGeo = new THREE.CircleGeometry(lensR, 28);
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.copy(normalVec).multiplyScalar(half * 0.92);
    lens.lookAt(normalVec.clone().multiplyScalar(half * 2));
    faceGroup.add(lens);

    if (haloShown) {
      const halo = new THREE.Sprite(haloMat);
      // Tighter than the cube path (4×) because polyhedra stack many halos,
      // and on a d20 a 3.2× sprite per face produced a glowing fog. 2.2×
      // keeps each face lit but stops the halos from fully overlapping.
      const haloSize = lensR * 2.2;
      halo.scale.set(haloSize, haloSize, 1);
      halo.position.copy(normalVec).multiplyScalar(half * 0.95);
      faceGroup.add(halo);
    }

    pipGroup.add(faceGroup);
  }

  return { group, faceLensMats, faceHaloMats, pipGroup };
}

// Inscribed-circle radius of a face on the unit-sphere polyhedron, used to
// size the digit label so it sits inside the face boundary. Approximated;
// good enough for a centered numeral with margin.
function labelRadius(shape: Exclude<DieShape, 'd6'>): number {
  switch (shape) {
    case 'd4':  return 0.18;
    case 'd8':  return 0.18;
    case 'd10': return 0.16;
    case 'd12': return 0.20;
    case 'd20': return 0.14;
  }
}
