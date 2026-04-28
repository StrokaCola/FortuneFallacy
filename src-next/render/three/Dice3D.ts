import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { store } from '../../state/store';
import { bus } from '../../events/bus';
import { dispatch } from '../../actions/dispatch';
import { createCosmicEnv } from './MaterialEnv';

const DIE_SIZE = 0.85;
const DICE_GAP = 1.7;
// Top-down camera: rolling tray sits at world Y=0 in upper half of screen
// (Z>0), holding strip below at world Z=HOLD_Z (lower half of screen).
const HOLD_Y = 0.0;
const HOLD_Z = 5.2;            // hold strip just above the action bar
const HOLD_SCALE = 1.1;        // bring locked dice closer to camera (bigger)
const ROLL_TRAY_Z = 0.0;       // tray centred on rapier sim tray (TRAY_MIN..TRAY_MAX)
const ROLL_TRAY_W = 14;        // visual frame stretches past playable area to fill side margins
const ROLL_TRAY_H = 8;         // matches rapierSim TRAY_MIN/TRAY_MAX = ±4 in Z

// Lock-snap rotations: orient face value N so its local outward normal lands
// at world +Y (toward the top-down camera). Local face normals come from
// FACE_DEFS (matches faceFromPose convention): 1=+Y, 6=-Y, 2=+X, 5=-X, 3=+Z, 4=-Z.
const FACE_ROT: Record<number, [number, number, number]> = {
  1: [0, 0, 0],                  // +Y identity
  2: [0, 0,  Math.PI / 2],       // +X → +Y
  3: [-Math.PI / 2, 0, 0],       // +Z → +Y
  4: [ Math.PI / 2, 0, 0],       // -Z → +Y
  5: [0, 0, -Math.PI / 2],       // -X → +Y
  6: [Math.PI, 0, 0],            // -Y → +Y
};

type StyleKey = 'celestial' | 'obsidian' | 'ember' | 'ivory' | 'glass';

type StyleDef = {
  bodyTint: number; bodyDeep: number;
  edge: number; pip: number; halo: number;
  eIntensity: number;
  transmission: number; thickness: number; ior: number; rough: number;
};

const STYLES: Record<StyleKey, StyleDef> = {
  celestial: { bodyTint: 0x6b4ad6, bodyDeep: 0x1a0c4a, edge: 0xbba8ff, pip: 0xdcd4ff, halo: 0x7be3ff, eIntensity: 1.9, transmission: 0.50, thickness: 0.65, ior: 1.43, rough: 0.41 },
  obsidian:  { bodyTint: 0x2e1d6b, bodyDeep: 0x07051a, edge: 0xf5c451, pip: 0xf5c451, halo: 0xf5c451, eIntensity: 1.2, transmission: 0.18, thickness: 0.85, ior: 1.52, rough: 0.41 },
  ember:     { bodyTint: 0xff6a3a, bodyDeep: 0x5a1408, edge: 0xffe9c8, pip: 0xfff7e8, halo: 0xff7847, eIntensity: 1.5, transmission: 0.40, thickness: 0.70, ior: 1.46, rough: 0.41 },
  ivory:     { bodyTint: 0xfff7e0, bodyDeep: 0xa89868, edge: 0xffffff, pip: 0x1c1245, halo: 0x5c39c4, eIntensity: 0.0, transmission: 0.25, thickness: 0.80, ior: 1.40, rough: 0.41 },
  glass:     { bodyTint: 0x9be8ff, bodyDeep: 0x0a1422, edge: 0x7be3ff, pip: 0xf3f0ff, halo: 0x7be3ff, eIntensity: 1.8, transmission: 0.80, thickness: 0.55, ior: 1.43, rough: 0.41 },
};

// Pip layouts (face-local UV in [-0.5, 0.5]) — matches Physics Dice mockup.
const PIPS: Record<number, [number, number][]> = {
  1: [[ 0.00,  0.00]],
  2: [[-0.22, -0.22], [ 0.22,  0.22]],
  3: [[-0.24, -0.24], [ 0.00,  0.00], [ 0.24,  0.24]],
  4: [[-0.22, -0.22], [ 0.22, -0.22], [-0.22,  0.22], [ 0.22,  0.22]],
  5: [[-0.24, -0.24], [ 0.24, -0.24], [ 0.00,  0.00], [-0.24,  0.24], [ 0.24,  0.24]],
  6: [[-0.24, -0.28], [ 0.24, -0.28], [-0.24,  0.00], [ 0.24,  0.00], [-0.24,  0.28], [ 0.24,  0.28]],
};

// Face → local outward normal. Matches simulation/faceFromPose.ts FACE_AXES
// so the brightly-lit pip face is the one physics chose as the rolled value.
const FACE_DEFS = [
  { val: 1, axis: 'y' as const, sign:  1 },
  { val: 6, axis: 'y' as const, sign: -1 },
  { val: 2, axis: 'x' as const, sign:  1 },
  { val: 5, axis: 'x' as const, sign: -1 },
  { val: 3, axis: 'z' as const, sign:  1 },
  { val: 4, axis: 'z' as const, sign: -1 },
];

type FaceMatMap<T> = { 1: T; 2: T; 3: T; 4: T; 5: T; 6: T };

type BuiltDie = {
  group: THREE.Group;
  faceLensMats: FaceMatMap<THREE.MeshStandardMaterial>;
  faceHaloMats: FaceMatMap<THREE.SpriteMaterial>;
  pipGroup: THREE.Group;
};

// Cached radial-gradient sprite texture — shared by all die halos and the
// constellation anchor stars. Built lazily on first die construction.
let _haloTex: THREE.CanvasTexture | null = null;
function getHaloTexture(): THREE.CanvasTexture {
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

function buildDie(size: number, styleKey: StyleKey): BuiltDie {
  const S = STYLES[styleKey];
  const group = new THREE.Group();
  group.name = `FortuneFallacyDie_${styleKey}`;

  // Body — translucent crystal cube with vertex-color gradient (tint→deep at
  // corners) so transmission shows the soft inner colour while edges fall to
  // the deep tone.
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

  // Edge highlight — 12 main chamfer curves traced from the rounded geometry.
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

type DieAnim = {
  group: THREE.Group;
  homePos: THREE.Vector3;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  startScale: number;
  targetScale: number;
  startQuat: THREE.Quaternion;
  targetQuat: THREE.Quaternion;
  t0: number;
  duration: number;
  rolling: boolean;            // true while tumble in progress
  rollAxis: THREE.Vector3;
  rollSpeed: number;            // radians per second total
  bouncePeak: number;           // max y displacement during roll
  locked: boolean;
  playback: { frames: import('../../events/types').DieFrame[]; startedAt: number; stepMs: number } | null;
  holdBobPhase: number;
  faceLensMats: FaceMatMap<THREE.MeshStandardMaterial>;
  faceHaloMats: FaceMatMap<THREE.SpriteMaterial>;
  // Per-face fade state. Index 0 unused; faces are 1..6.
  faceCur: number[];                      // length 7
  faceTarget: number[];                   // length 7
  faceFrom: number[];                     // length 7
  faceFadeStart: number;                  // ms; 0 = idle
  faceFadeDurMs: number;
  upFace: number;                         // last known up-face from store
  scorePopStart: number;                  // ms timestamp when this die last scored a beat; 0 = idle
};

const PIP_FADE_IN_MS = 520;
const PIP_FADE_OUT_MS = 650;
const PIP_REVEAL_DELAY_MS = 120;

// Rectangular frosted-glass tray texture: linear gradient body + dashed gold
// border + violet inner border + four ornate corner flourishes + scattered
// stars. Aspect 2:1 matches the plane geometry (ROLL_TRAY_W:ROLL_TRAY_H).
function buildTrayTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  // Body — radial gradient anchored at centre, fades to deeper edge tone.
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55);
  g.addColorStop(0, '#1c1245');
  g.addColorStop(0.55, '#0f0925');
  g.addColorStop(1, '#07051a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Inner solid violet border.
  const inset = 16;
  ctx.strokeStyle = 'rgba(149,119,255,.40)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);

  // Outer dashed gold border.
  ctx.strokeStyle = 'rgba(245,196,81,.38)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 10]);
  ctx.strokeRect(inset - 8, inset - 8, W - (inset - 8) * 2, H - (inset - 8) * 2);
  ctx.setLineDash([]);

  // Four corner flourishes — short L brackets in gold.
  const armLen = 38;
  const corners = [
    [inset + 4, inset + 4, +1, +1],
    [W - inset - 4, inset + 4, -1, +1],
    [inset + 4, H - inset - 4, +1, -1],
    [W - inset - 4, H - inset - 4, -1, -1],
  ] as const;
  ctx.strokeStyle = 'rgba(245,196,81,.65)';
  ctx.lineWidth = 1.6;
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * armLen, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * armLen);
    ctx.stroke();
  }

  // Faint central sigil — small dashed circle at midpoint for ornament.
  ctx.strokeStyle = 'rgba(123,227,255,.20)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 7]);
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Scattered field stars.
  for (let i = 0; i < 140; i++) {
    ctx.fillStyle = Math.random() < 0.15 ? '#7be3ff' : (Math.random() < 0.10 ? '#f5c451' : '#dcd4ff');
    ctx.globalAlpha = 0.25 + Math.random() * 0.55;
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.4 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRadialGradientTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Dice3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private dice: DieAnim[] = [];
  private holdGlow: THREE.Mesh | null = null;
  private holdLinks: THREE.LineSegments | null = null;          // bright core strand
  private holdLinksGlow: THREE.LineSegments | null = null;      // wide additive halo strand
  private holdAnchors: THREE.Points | null = null;              // legacy (hidden)
  private holdAnchorL: THREE.Sprite | null = null;
  private holdAnchorR: THREE.Sprite | null = null;
  private holdShimmer: THREE.Points | null = null;              // shimmer points riding the path
  private holdShimmerCount = 0;
  private holdGradTex: THREE.Texture | null = null;
  private prevHoldCount = -1;
  private holdLinksFadeStart = 0;     // ms; 0 = idle
  private rafHandle: number | null = null;
  private unsubscribers: (() => void)[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private canvas: HTMLCanvasElement;
  private onPointerDown: ((ev: PointerEvent) => void) | null = null;
  private scoringActive = false;
  private activeScoringDie = -1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setSize(960, 540, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene = new THREE.Scene();
    try {
      this.scene.environment = createCosmicEnv(this.renderer);
    } catch (e) {
      console.warn('[Dice3D] env map init failed:', e);
    }
    const ortho = 7.5;
    this.camera = new THREE.OrthographicCamera(-ortho * 1.78, ortho * 1.78, ortho, -ortho, 0.1, 100);
    // Top-down. up=(0,0,-1) maps screen-Y onto world -Z so the rolling tray
    // (Z=+1) reads in the upper half of canvas and the hold strip
    // (Z=HOLD_Z) reads in the lower half.
    this.camera.position.set(0, 14, 0.001);
    this.camera.up.set(0, 0, -1);    // screen +Y → world -Z (rolling tray at -Z = upper)
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0x9577ff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(4, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x7be3ff, 1.4, 24);
    rim.position.set(-3, 2, -4);
    this.scene.add(rim);
    const fill = new THREE.PointLight(0xff7847, 0.6, 20);
    fill.position.set(3, -1, 4);
    this.scene.add(fill);

    // Frosted-glass rectangular rolling tray — linear gradient body with
    // dashed gold border, corner flourishes, and scattered stars.
    const trayDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(ROLL_TRAY_W, ROLL_TRAY_H),
      new THREE.MeshStandardMaterial({
        map: buildTrayTexture(),
        roughness: 0.85,
        metalness: 0.05,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    trayDisc.rotation.x = -Math.PI / 2;
    trayDisc.position.set(0, -DIE_SIZE / 2 - 0.01, ROLL_TRAY_Z);
    trayDisc.receiveShadow = true;
    this.scene.add(trayDisc);

    // Constellation hold visuals — glow halo + linking lines + anchor stars.
    this.holdGradTex = makeRadialGradientTexture();
    const glowMat = new THREE.MeshBasicMaterial({
      map: this.holdGradTex,
      color: 0x7be3ff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.holdGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
    this.holdGlow.rotation.x = -Math.PI / 2;
    this.holdGlow.position.set(0, HOLD_Y - DIE_SIZE / 2 - 0.05, HOLD_Z);
    this.holdGlow.visible = false;
    this.scene.add(this.holdGlow);

    // Cinematic constellation — two-strand line:
    //   • holdLinksGlow: wide soft halo (additive, low opacity, astral tint)
    //   • holdLinks:     thin bright core (additive, high opacity, near-white)
    // Both share the same per-frame vertex buffer.
    const linkGlowMat = new THREE.LineBasicMaterial({
      color: 0x7be3ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.holdLinksGlow = new THREE.LineSegments(new THREE.BufferGeometry(), linkGlowMat);
    this.holdLinksGlow.visible = false;
    this.scene.add(this.holdLinksGlow);

    const linkMat = new THREE.LineBasicMaterial({
      color: 0xeaf6ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.holdLinks = new THREE.LineSegments(new THREE.BufferGeometry(), linkMat);
    this.holdLinks.visible = false;
    this.scene.add(this.holdLinks);

    // Anchor stars — sprites using the cached halo texture, additive-blended.
    const anchorMatBase = new THREE.SpriteMaterial({
      map: getHaloTexture(),
      color: 0xf3f0ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    this.holdAnchorL = new THREE.Sprite(anchorMatBase);
    this.holdAnchorL.scale.set(0.6, 0.6, 1);
    this.holdAnchorL.visible = false;
    this.scene.add(this.holdAnchorL);
    this.holdAnchorR = new THREE.Sprite(anchorMatBase.clone());
    this.holdAnchorR.scale.set(0.6, 0.6, 1);
    this.holdAnchorR.visible = false;
    this.scene.add(this.holdAnchorR);

    // Shimmer points — small bright stars that ride along the path.
    const shimmerMat = new THREE.PointsMaterial({
      color: 0xeaf6ff,
      size: 0.13,
      map: getHaloTexture(),
      alphaTest: 0.02,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: false,
    });
    this.holdShimmer = new THREE.Points(new THREE.BufferGeometry(), shimmerMat);
    this.holdShimmer.visible = false;
    this.scene.add(this.holdShimmer);

    // Legacy unused Points node (kept null to satisfy old refs).
    this.holdAnchors = null;

    this.buildDice();

    this.unsubscribers.push(
      store.subscribe((s, prev) => {
        if (s.round.dice !== prev.round.dice) this.syncDice(s.round.dice);
      }),
      bus.on('onSimulationEnd', ({ result }) => this.startPlayback(result.frames, result.finalFaces)),
      bus.on('onScoreBeat', ({ beat }) => {
        if (beat.kind === 'cast-swell') {
          this.scoringActive = true;
          this.activeScoringDie = -1;
        } else if (beat.kind === 'die-tick') {
          const d = this.dice[beat.dieIdx];
          if (d) d.scorePopStart = performance.now();
          this.activeScoringDie = beat.dieIdx;
        } else if (beat.kind === 'boom' || beat.kind === 'bail') {
          this.scoringActive = false;
          this.activeScoringDie = -1;
        }
      }),
    );
    this.syncDice(store.getState().round.dice);
    this.attachClick();
    this.start();
  }

  private attachClick(): void {
    this.onPointerDown = (ev: PointerEvent) => {
      // Skip if any die is mid-roll/playback — no locking during animation.
      if (this.dice.some((d) => d.playback != null || d.rolling)) return;

      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);

      const groups = this.dice.map((d) => d.group);
      const hits = this.raycaster.intersectObjects(groups, true);
      if (hits.length === 0) return;

      // Find the top-level group ancestor matching one of our dice.
      let obj: THREE.Object3D | null = hits[0]!.object;
      while (obj && !groups.includes(obj as THREE.Group)) obj = obj.parent;
      if (!obj) return;

      const idx = groups.indexOf(obj as THREE.Group);
      if (idx < 0) return;
      dispatch({ type: 'TOGGLE_LOCK', dieIdx: idx });
    };
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
  }

  destroy(): void {
    if (this.rafHandle != null) cancelAnimationFrame(this.rafHandle);
    this.unsubscribers.forEach((u) => u());
    if (this.onPointerDown) this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.dispose();
  }

  private buildDice() {
    const count = 5;
    const startX = -((count - 1) * DICE_GAP) / 2;
    for (let i = 0; i < count; i++) {
      const built = buildDie(DIE_SIZE, 'celestial');
      const home = new THREE.Vector3(startX + i * DICE_GAP, 0, ROLL_TRAY_Z);
      built.group.position.copy(home);
      this.scene.add(built.group);
      this.dice.push({
        group: built.group,
        homePos: home,
        startPos: home.clone(),
        targetPos: home.clone(),
        startScale: 1,
        targetScale: 1,
        startQuat: new THREE.Quaternion(),
        targetQuat: new THREE.Quaternion(),
        t0: 0,
        duration: 350,
        rolling: false,
        rollAxis: new THREE.Vector3(1, 0, 0),
        rollSpeed: 0,
        bouncePeak: 0,
        locked: false,
        playback: null,
        holdBobPhase: Math.random() * Math.PI * 2,
        faceLensMats: built.faceLensMats,
        faceHaloMats: built.faceHaloMats,
        faceCur: [0, 0, 0, 0, 0, 0, 0],
        faceTarget: [0, 0, 0, 0, 0, 0, 0],
        faceFrom: [0, 0, 0, 0, 0, 0, 0],
        faceFadeStart: 0,
        faceFadeDurMs: PIP_FADE_IN_MS,
        upFace: 1,
        scorePopStart: 0,
      });
    }
  }

  /**
   * Drive per-face pip opacity toward `targets[1..6]`. Three modes used:
   *   - all 6 → 1: pips glow on every face during the roll.
   *   - up=1, others=0: after settle, only the landed face stays lit.
   *   - all 6 → 0: not currently used (pre-roll initial state is already 0).
   */
  private setFaceFade(d: DieAnim, targets: number[], durMs: number, delayMs = 0): void {
    for (let f = 1; f <= 6; f++) {
      d.faceFrom[f] = d.faceCur[f]!;
      d.faceTarget[f] = targets[f]!;
    }
    d.faceFadeStart = performance.now() + delayMs;
    d.faceFadeDurMs = durMs;
  }

  private faceTargetsAllOn(): number[] { return [0, 1, 1, 1, 1, 1, 1]; }
  private faceTargetsOnlyUp(up: number): number[] {
    const t = [0, 0, 0, 0, 0, 0, 0];
    if (up >= 1 && up <= 6) t[up] = 1;
    return t;
  }

  private holdSlotX(holdIdx: number, total: number): number {
    if (total <= 0) return 0;
    const gap = DICE_GAP * 0.85;
    const startX = -((total - 1) * gap) / 2;
    return startX + holdIdx * gap;
  }

  private syncDice(diceState: { face: number; locked?: boolean }[]) {
    // Compute hold-area indices (sequential among locked dice)
    const lockedIndices: number[] = [];
    diceState.forEach((d, i) => { if (d.locked) lockedIndices.push(i); });
    const holdCount = lockedIndices.length;

    diceState.forEach((d, i) => {
      const die = this.dice[i];
      if (!die) return;

      const wasLocked = die.locked;
      const isLocked = !!d.locked;
      die.locked = isLocked;

      // Track latest up-face from store; used by settle to dim non-up faces.
      // If the face changed while the die is at rest (not rolling/playback),
      // re-target the fade so the new up-face glows alone.
      const prevUp = die.upFace;
      const newUp = d.face;
      die.upFace = newUp;
      if (newUp !== prevUp && !die.rolling && !die.playback) {
        this.setFaceFade(die, this.faceTargetsOnlyUp(newUp), PIP_FADE_OUT_MS);
      }

      // Position target
      let newTargetPos: THREE.Vector3;
      let newTargetScale: number;
      if (isLocked) {
        // Locked dice slide down into the holding tray, organized into slots.
        const holdIdx = lockedIndices.indexOf(i);
        newTargetPos = new THREE.Vector3(this.holdSlotX(holdIdx, holdCount), HOLD_Y, HOLD_Z);
        newTargetScale = HOLD_SCALE;
      } else if (wasLocked) {
        // Unlocking: send the die back into the rolling tray to a random
        // empty spot so it can be re-rolled. Stay inside the sim tray walls.
        const margin = 1.0;
        const rx = (Math.random() - 0.5) * (ROLL_TRAY_W - margin * 2);
        const rz = ROLL_TRAY_Z + (Math.random() - 0.5) * (ROLL_TRAY_H - margin * 2);
        newTargetPos = new THREE.Vector3(rx, 0, rz);
        newTargetScale = 1;
      } else {
        // Settle-in-place: keep the physics-resolved position.
        newTargetPos = die.group.position.clone();
        newTargetScale = 1;
      }

      // Reposition all locked dice when count changes
      const positionChanged = !die.targetPos.equals(newTargetPos) || die.targetScale !== newTargetScale;
      const lockChanged = wasLocked !== isLocked;

      if (positionChanged) {
        die.startPos.copy(die.group.position);
        die.targetPos.copy(newTargetPos);
        die.startScale = die.group.scale.x;
        die.targetScale = newTargetScale;
      }

      // Face rotation target: only force canonical FACE_ROT when locked
      // (so dice sit cleanly face-up on the hold shelf). Active dice keep
      // whatever rotation physics produced — that orientation already shows
      // the correct face per faceFromQuaternion.
      if (!die.rolling && isLocked) {
        const newRot = new THREE.Quaternion();
        newRot.setFromEuler(new THREE.Euler(...FACE_ROT[d.face]!));
        if (!die.targetQuat.equals(newRot) || lockChanged) {
          die.startQuat.copy(die.group.quaternion);
          die.targetQuat.copy(newRot);
        }
      }

      if (positionChanged || lockChanged) {
        die.t0 = performance.now();
        die.duration = 380;
      }
    });

    if (holdCount !== this.prevHoldCount) {
      this.rebuildHoldVisuals(holdCount);
      this.prevHoldCount = holdCount;
    }
  }

  private rebuildHoldVisuals(holdCount: number): void {
    if (!this.holdGlow || !this.holdLinks || !this.holdLinksGlow ||
        !this.holdAnchorL || !this.holdAnchorR || !this.holdShimmer) return;

    // Holding tray itself is invisible — only constellation strands +
    // anchor sprites + shimmer remain. Geometry is allocated here per
    // holdCount and refreshed each animation frame from live die positions.
    this.holdGlow.visible = false;

    if (holdCount === 0) {
      this.holdLinks.visible = false;
      this.holdLinksGlow.visible = false;
      this.holdAnchorL.visible = false;
      this.holdAnchorR.visible = false;
      this.holdShimmer.visible = false;
      this.holdShimmerCount = 0;
      this.holdLinksFadeStart = 0;
      return;
    }

    // segments = (holdCount - 1) inner pairs + 2 outer anchor extensions
    const segCount = (holdCount - 1) + 2;
    const vertFloats = segCount * 2 * 3;

    // Both strands share an identical layout but get their own buffer so
    // we can scale opacity independently if needed later.
    const coreGeo = new THREE.BufferGeometry();
    coreGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertFloats), 3));
    this.holdLinks.geometry.dispose();
    this.holdLinks.geometry = coreGeo;
    this.holdLinks.visible = true;

    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertFloats), 3));
    this.holdLinksGlow.geometry.dispose();
    this.holdLinksGlow.geometry = glowGeo;
    this.holdLinksGlow.visible = true;

    // Shimmer points — 3 per segment, ride along path with t in [0, 1].
    const shimmerPerSeg = 3;
    this.holdShimmerCount = segCount * shimmerPerSeg;
    const shimmerGeo = new THREE.BufferGeometry();
    shimmerGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(this.holdShimmerCount * 3), 3),
    );
    this.holdShimmer.geometry.dispose();
    this.holdShimmer.geometry = shimmerGeo;
    this.holdShimmer.visible = true;

    this.holdAnchorL.visible = true;
    this.holdAnchorR.visible = true;

    // Trigger draw-on fade.
    this.holdLinksFadeStart = performance.now();
    (this.holdLinks.material as THREE.LineBasicMaterial).opacity = 0;
    (this.holdLinksGlow.material as THREE.LineBasicMaterial).opacity = 0;
    (this.holdAnchorL.material as THREE.SpriteMaterial).opacity = 0;
    (this.holdAnchorR.material as THREE.SpriteMaterial).opacity = 0;
    (this.holdShimmer.material as THREE.PointsMaterial).opacity = 0;
  }

  private updateHoldConstellation(): void {
    if (!this.holdLinks || !this.holdLinksGlow || !this.holdAnchorL ||
        !this.holdAnchorR || !this.holdShimmer || !this.holdLinks.visible) return;

    const lockedDice: DieAnim[] = [];
    for (const d of this.dice) if (d.locked) lockedDice.push(d);
    const n = lockedDice.length;
    if (n === 0) return;

    const coreAttr = this.holdLinks.geometry.getAttribute('position') as THREE.BufferAttribute;
    const coreArr = coreAttr.array as Float32Array;
    const expectedLinkLen = ((n - 1) + 2) * 2 * 3;
    if (coreArr.length !== expectedLinkLen) return; // mid-rebuild

    const glowAttr = this.holdLinksGlow.geometry.getAttribute('position') as THREE.BufferAttribute;
    const glowArr = glowAttr.array as Float32Array;

    const anchorPad = 0.85;
    const firstP = lockedDice[0]!.group.position;
    const lastP = lockedDice[n - 1]!.group.position;
    const anchorL = { x: firstP.x - anchorPad, y: firstP.y + 0.05, z: firstP.z };
    const anchorR = { x: lastP.x + anchorPad,  y: lastP.y + 0.05,  z: lastP.z };

    // segment endpoints (start, end) for shimmer interpolation
    const segStarts: { x: number; y: number; z: number }[] = [];
    const segEnds: { x: number; y: number; z: number }[] = [];

    let o = 0;
    const push = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
    ) => {
      coreArr[o] = ax; coreArr[o + 1] = ay; coreArr[o + 2] = az;
      coreArr[o + 3] = bx; coreArr[o + 4] = by; coreArr[o + 5] = bz;
      glowArr[o] = ax; glowArr[o + 1] = ay; glowArr[o + 2] = az;
      glowArr[o + 3] = bx; glowArr[o + 4] = by; glowArr[o + 5] = bz;
      o += 6;
      segStarts.push({ x: ax, y: ay, z: az });
      segEnds.push({ x: bx, y: by, z: bz });
    };

    push(anchorL.x, anchorL.y, anchorL.z, firstP.x, firstP.y, firstP.z);
    for (let i = 0; i < n - 1; i++) {
      const a = lockedDice[i]!.group.position;
      const b = lockedDice[i + 1]!.group.position;
      push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    push(lastP.x, lastP.y, lastP.z, anchorR.x, anchorR.y, anchorR.z);

    coreAttr.needsUpdate = true;
    glowAttr.needsUpdate = true;

    // Anchor sprites — pulse softly.
    const now = performance.now();
    const ts = now / 1000;
    this.holdAnchorL.position.set(anchorL.x, anchorL.y, anchorL.z);
    this.holdAnchorR.position.set(anchorR.x, anchorR.y, anchorR.z);
    const anchorPulse = 0.55 + 0.18 * Math.sin(ts * 2.4);
    this.holdAnchorL.scale.setScalar(anchorPulse);
    this.holdAnchorR.scale.setScalar(anchorPulse * (0.95 + 0.07 * Math.sin(ts * 2.0 + 1.3)));

    // Shimmer points — ride each segment with cycling t.
    const shimmerAttr = this.holdShimmer.geometry.getAttribute('position') as THREE.BufferAttribute;
    const shimmerArr = shimmerAttr.array as Float32Array;
    const segCount = segStarts.length;
    const perSeg = 3;
    const cycle = 2.4; // seconds per loop
    let s = 0;
    for (let segI = 0; segI < segCount; segI++) {
      const a = segStarts[segI]!;
      const b = segEnds[segI]!;
      for (let p = 0; p < perSeg; p++) {
        const phase = (segI * 0.13 + p / perSeg);
        const t = ((ts / cycle) + phase) % 1;
        shimmerArr[s++] = a.x + (b.x - a.x) * t;
        shimmerArr[s++] = a.y + (b.y - a.y) * t + Math.sin(ts * 3 + phase * 6) * 0.015;
        shimmerArr[s++] = a.z + (b.z - a.z) * t;
      }
    }
    shimmerAttr.needsUpdate = true;

    // Draw-on fade — eases line + anchor + shimmer opacity from 0 to target
    // over ~700ms after each lock-count rebuild.
    if (this.holdLinksFadeStart > 0) {
      const dt = now - this.holdLinksFadeStart;
      const T = 700;
      const tF = Math.min(1, dt / T);
      const eased = 1 - Math.pow(1 - tF, 3);
      const breathe = 1 + 0.06 * Math.sin(ts * 1.6);
      (this.holdLinks.material as THREE.LineBasicMaterial).opacity = 0.85 * eased * breathe;
      (this.holdLinksGlow.material as THREE.LineBasicMaterial).opacity = 0.32 * eased * breathe;
      (this.holdAnchorL.material as THREE.SpriteMaterial).opacity = 0.95 * eased;
      (this.holdAnchorR.material as THREE.SpriteMaterial).opacity = 0.95 * eased;
      (this.holdShimmer.material as THREE.PointsMaterial).opacity = 0.85 * eased;
      if (tF >= 1) this.holdLinksFadeStart = -1; // -1 = settled, keep breathing
    } else if (this.holdLinksFadeStart === -1) {
      const breathe = 1 + 0.08 * Math.sin(ts * 1.6);
      (this.holdLinks.material as THREE.LineBasicMaterial).opacity = 0.85 * breathe;
      (this.holdLinksGlow.material as THREE.LineBasicMaterial).opacity = 0.32 * breathe;
    }
  }

  private kickAll() {
    const now = performance.now();
    this.dice.forEach((d, i) => {
      if (d.locked) return;
      // Pips glow on every face during the roll — set all 6 → 1.
      this.setFaceFade(d, this.faceTargetsAllOn(), PIP_FADE_IN_MS);
      // Random tumble axis + rotational speed
      const ax = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ).normalize();
      d.rollAxis = ax;
      d.rollSpeed = 8 + Math.random() * 6;     // ~8-14 rad/s
      d.bouncePeak = 1.6 + Math.random() * 0.8;
      d.startQuat.copy(d.group.quaternion);
      d.startPos.copy(d.group.position);
      // Stay roughly at home X but drift slightly during roll for liveliness
      d.targetPos.set(d.homePos.x + (Math.random() * 0.4 - 0.2), 0, ROLL_TRAY_Z + (Math.random() * 0.4 - 0.2));
      d.targetScale = 1;
      d.startScale = d.group.scale.x;
      d.t0 = now + i * 30;                     // tiny stagger
      d.duration = 1100 + Math.random() * 250; // 1.1-1.35s tumble
      d.rolling = true;
    });
  }

  private startPlayback(frames: import('../../events/types').DieFrame[][] | undefined, _finalFaces: number[]): void {
    if (!frames || frames.length === 0) {
      this.kickAll();
      return;
    }
    const now = performance.now();
    const STEP_MS = 1000 / 60;
    this.dice.forEach((d, i) => {
      if (d.locked) return;
      const f = frames[i];
      if (!f || f.length === 0) return;
      // Pips glow on every face during physics playback — set all 6 → 1.
      this.setFaceFade(d, this.faceTargetsAllOn(), PIP_FADE_IN_MS);
      d.playback = { frames: f, startedAt: now, stepMs: STEP_MS };
      d.rolling = false;
      // Do NOT set targetQuat from FACE_ROT here — physics rest pose already
      // shows the correct face. Setting canonical here would cause a visible
      // post-playback spin. Final pose will be captured at end of playback.
    });
  }

  private start() {
    const loop = () => {
      this.rafHandle = requestAnimationFrame(loop);
      const now = performance.now();
      for (const d of this.dice) {
        const elapsed = now - d.t0;
        if (elapsed < 0) {
          // pre-stagger; stay at start
          d.group.position.copy(d.startPos);
          d.group.quaternion.copy(d.startQuat);
          continue;
        }
        const tRaw = Math.min(1, Math.max(0, elapsed / d.duration));

        if (d.playback) {
          const elapsed2 = now - d.playback.startedAt;
          const idx = Math.min(d.playback.frames.length - 1, Math.floor(elapsed2 / d.playback.stepMs));
          const fr = d.playback.frames[idx]!;
          d.group.position.set(fr.px, fr.py, fr.pz);
          d.group.quaternion.set(fr.qx, fr.qy, fr.qz, fr.qw);
          if (idx >= d.playback.frames.length - 1) {
            d.playback = null;
            d.startQuat.copy(d.group.quaternion);
            d.targetQuat.copy(d.group.quaternion); // keep physics rest rotation, no canonical snap
            d.startPos.copy(d.group.position);
            d.targetPos.copy(d.group.position);   // settle in place — no snap to homePos
            d.targetScale = 1;
            d.startScale = d.group.scale.x;
            d.t0 = now;
            d.duration = 1;
            // Settle: dim all non-up faces, leave up-face glowing.
            this.setFaceFade(d, this.faceTargetsOnlyUp(d.upFace), PIP_FADE_OUT_MS, PIP_REVEAL_DELAY_MS);
          }
          continue;
        }

        if (d.rolling) {
          // Active tumble: spin around rollAxis at rollSpeed
          const angle = d.rollSpeed * (elapsed / 1000) * (1 - tRaw * 0.6); // slows over time
          const spin = new THREE.Quaternion().setFromAxisAngle(d.rollAxis, angle);
          d.group.quaternion.copy(d.startQuat).multiply(spin);

          // Position lerp + bounce stack (3 bounces decaying)
          const easeT = 1 - Math.pow(1 - tRaw, 2);
          d.group.position.lerpVectors(d.startPos, d.targetPos, easeT);
          const bounceY = d.bouncePeak * Math.abs(Math.sin(tRaw * Math.PI * 3)) * (1 - tRaw);
          d.group.position.y = bounceY;

          if (tRaw >= 1) {
            d.rolling = false;
            // After tumble, sync orientation to target face on next syncDice tick
            // (faces will be snapped via store update from ROLL_SETTLED)
            d.startQuat.copy(d.group.quaternion);
            // Settle: dim all non-up faces, leave up-face glowing.
            this.setFaceFade(d, this.faceTargetsOnlyUp(d.upFace), PIP_FADE_OUT_MS, PIP_REVEAL_DELAY_MS);
          }
        } else {
          // Position + scale + face-quat smooth lerp
          const t = 1 - Math.pow(1 - tRaw, 3);
          d.group.position.lerpVectors(d.startPos, d.targetPos, t);
          const sc = d.startScale + (d.targetScale - d.startScale) * t;
          let popMul = 1;
          const dieIdx = this.dice.indexOf(d);
          const isActiveScoring = this.scoringActive && this.activeScoringDie === dieIdx;
          // Pop animation when this die just ticked. Scale ramps to 1.55 in 120ms,
          // holds while still the active die, then falls off after handoff.
          if (d.scorePopStart > 0) {
            const popDt = now - d.scorePopStart;
            const RAMP_MS = 120;
            const FALL_MS = 320;
            if (popDt < RAMP_MS) {
              popMul = 1 + 0.55 * (popDt / RAMP_MS);
            } else if (isActiveScoring) {
              popMul = 1.55;
            } else if (popDt < RAMP_MS + FALL_MS) {
              const k = 1 - (popDt - RAMP_MS) / FALL_MS;
              popMul = 1 + 0.55 * Math.max(0, k);
            } else {
              d.scorePopStart = 0;
            }
          }
          // While scoring, dim non-active dice slightly to draw focus to the active one.
          if (this.scoringActive && !isActiveScoring && d.scorePopStart === 0) {
            popMul *= 0.85;
          }
          d.group.scale.setScalar(sc * popMul);
          d.group.quaternion.slerpQuaternions(d.startQuat, d.targetQuat, t);

          // Floaty held-die idle: bob + drift + gentle rotational shimmer once
          // the lerp into the hold slot has settled.
          if (d.locked && tRaw >= 1) {
            const ts = now / 1000;
            // Top-down camera: bob in Z (screen-Y) + drift in X. Keeps the
            // motion readable from above without lifting dice toward camera.
            d.group.position.z = HOLD_Z + Math.sin(ts * 1.2 + d.holdBobPhase) * 0.08;
            d.group.position.x += Math.sin(ts * 0.7 + d.holdBobPhase) * 0.015;
            // Slow 3-axis tilt + wobble. Frequencies are incommensurate so
            // multiple dice never sync to the same pose. Amplitudes ~4° keep
            // the lit face clearly readable.
            const wob = new THREE.Quaternion().setFromEuler(new THREE.Euler(
              Math.sin(ts * 0.45 + d.holdBobPhase)         * 0.07,   // X tilt
              Math.sin(ts * 0.60 + d.holdBobPhase + 1.0)   * 0.05,   // Y yaw
              Math.sin(ts * 0.50 + d.holdBobPhase + 2.1)   * 0.07,   // Z roll
            ));
            d.group.quaternion.copy(d.targetQuat).multiply(wob);
          }
        }

        // Per-face pip fade driver — drives each face's lens + halo opacity
        // toward its independent target. Lens opacity is capped so emissive
        // doesn't blow out the bloom.
        if (d.faceFadeStart > 0) {
          const dt = now - d.faceFadeStart;
          if (dt >= 0) {
            const t = Math.min(1, dt / d.faceFadeDurMs);
            for (let f = 1; f <= 6; f++) {
              const tgt = d.faceTarget[f]!;
              const eased = tgt >= d.faceFrom[f]!
                ? 1 - Math.pow(1 - t, 3)   // fade-in: ease-out cubic
                : t;                        // fade-out: linear
              const next = d.faceFrom[f]! + (tgt - d.faceFrom[f]!) * eased;
              d.faceCur[f] = next;
              d.faceLensMats[f as 1 | 2 | 3 | 4 | 5 | 6].opacity = Math.min(0.78, next);
              d.faceHaloMats[f as 1 | 2 | 3 | 4 | 5 | 6].opacity = next;
            }
            if (t >= 1) {
              d.faceFadeStart = 0;
              for (let f = 1; f <= 6; f++) {
                d.faceCur[f] = d.faceTarget[f]!;
                d.faceLensMats[f as 1 | 2 | 3 | 4 | 5 | 6].opacity = Math.min(0.78, d.faceTarget[f]!);
                d.faceHaloMats[f as 1 | 2 | 3 | 4 | 5 | 6].opacity = d.faceTarget[f]!;
              }
            }
          }
        }
      }
      this.updateHoldConstellation();
      this.renderer.render(this.scene, this.camera);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }
}
