// Three.js 3D dice renderer — improved visuals + skin system.
//
// Integration pattern:
//   - Rapier/legacy physics in main.js drives die.absX, die.absY, die.rx,
//     die.ry, die.rz each frame. This module READS those values and
//     positions Three.js meshes accordingly.
//   - Canvas 2D UI in main.js draws on top (rune dots, upgrade icons, hover
//     highlights) — see drawGame() gating.
//
// Face layout:
//   BoxGeometry / RoundedBoxGeometry material slots: +X,-X,+Y,-Y,+Z,-Z.
//   Game face numbers: +X=2, -X=5, +Y=4, -Y=3, +Z=1, -Z=6  → BOX_FACE_TO_DIE.
//
// Rotation convention:
//   main.js rotate3 applies Rx→Ry→Rz extrinsic XYZ = Three.js intrinsic 'ZYX'.
//
// Skin system:
//   DICE_SKINS holds built-in skins + any registered custom skins.
//   setActiveSkin(id) persists to localStorage 'ff_diceSkin' and rebuilds meshes.
//   loadDiceModel(url) loads a GLB and stores the geometry as a skin override.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFLoader }         from 'three/examples/jsm/loaders/GLTFLoader.js';
import { W, H, CP, BOARD_H, PHYS_SCALE, DICE_MODIFIERS } from '../data/constants.js';

// ─── Modifier visual descriptors ──────────────────────────────────────────
// Renderer reads `d.modifiers[]` (array of ids). For each id, this map
// returns an emissive overlay (color hex + base intensity + pulse rate +
// optional hue-cycle flag). Stack cap = 2; iridescent overrides.
const MODIFIER_FX = {
  flaming: { hex:0xFF8A3C, base:0.42, pulse:6.5, hue:false  },
  cursed:  { hex:0x8A5BFF, base:0.30, pulse:1.8, hue:false  },
  holo:    { hex:0xFFFFFF, base:0.55, pulse:3.2, hue:true   },
  golden:  { hex:0xC9A24A, base:0.28, pulse:2.0, hue:false  },
  astral:  { hex:0x6FA0FF, base:0.34, pulse:1.4, hue:false  },
  bossed:  { hex:0xD33A4A, base:0.36, pulse:5.0, hue:false  },
};

function _hsvToHex(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r=v; g=t; b=p; break;
    case 1: r=q; g=v; b=p; break;
    case 2: r=p; g=v; b=t; break;
    case 3: r=p; g=q; b=v; break;
    case 4: r=t; g=p; b=v; break;
    default: r=v; g=p; b=q;
  }
  return ((r*255|0)<<16) | ((g*255|0)<<8) | (b*255|0);
}

// ─── Skin registry ────────────────────────────────────────────────────────

export const DICE_SKINS = {
  ivory: {
    id: 'ivory', name: 'Ivory',
    baseColor: '#f0ead8', pipColor: '#100a04',
    roughness: 0.38, metalness: 0.08, cornerRadius: 0.10,
    glbUrl: null,
  },
  obsidian: {
    id: 'obsidian', name: 'Obsidian',
    baseColor: '#1a1218', pipColor: '#d4a820',
    roughness: 0.20, metalness: 0.30, cornerRadius: 0.10,
    glbUrl: null,
  },
  crimson: {
    id: 'crimson', name: 'Crimson Casino',
    baseColor: '#6b1010', pipColor: '#f5e8d0',
    roughness: 0.35, metalness: 0.05, cornerRadius: 0.10,
    glbUrl: null,
  },
  jade: {
    id: 'jade', name: 'Jade',
    baseColor: '#0d2b1a', pipColor: '#e8c87a',
    roughness: 0.42, metalness: 0.06, cornerRadius: 0.10,
    glbUrl: null,
  },
  midnight: {
    id: 'midnight', name: 'Midnight Chrome',
    baseColor: '#0e1832', pipColor: '#c0d8f0',
    roughness: 0.18, metalness: 0.48, cornerRadius: 0.10,
    glbUrl: null,
  },
};

export function registerDiceSkin(skin) {
  DICE_SKINS[skin.id] = skin;
  // Flush texture cache entries for this skin
  for (const key of [...faceTextureCache.keys()]) {
    if (key.endsWith(`|${skin.baseColor}`)) {
      faceTextureCache.get(key).dispose();
      faceTextureCache.delete(key);
    }
  }
}

let activeSkinId = 'ivory';

export function setActiveSkin(id) {
  const skin = DICE_SKINS[id] || DICE_SKINS.ivory;
  activeSkinId = skin.id;
  try { localStorage.setItem('ff_diceSkin', skin.id); } catch (_) {}
  if (ready) _rebuildAllMeshes();
}

export function getActiveSkin() {
  return DICE_SKINS[activeSkinId] || DICE_SKINS.ivory;
}

// ─── State ────────────────────────────────────────────────────────────────
let scene      = null;
let camera     = null;
let renderer   = null;
let ambient    = null;
let dirLight   = null;
let rimLight   = null;
let fillLight  = null;
let underLight = null;
let diceMeshes = [];
let faceTextureCache = new Map();
let ready      = false;
let clock      = null;
let trayFloor   = null;
let cameraState = { x: 0, z: 0, zoom: 1.02, lift: 9.6, dolly: 1.7 };

// Custom GLB geometry loaded via loadDiceModel(). When non-null, dice use
// this geometry instead of the procedural RoundedBoxGeometry.
let customDiceGeo = null;
let gltfLoader    = null;

// BoxGeometry face-slot → die-face-number (same layout for RoundedBoxGeometry)
const BOX_FACE_TO_DIE = [2, 5, 4, 3, 1, 6];

// Play-area physics bounds in world units (matches Rapier wall placement)
const WORLD_PX_PER_UNIT = PHYS_SCALE;
const PLAY_HALF_W = (CP.w  - 20) / 2 / PHYS_SCALE;   // ≈5.16
const PLAY_HALF_D = (BOARD_H - 20) / 2 / PHYS_SCALE;  // ≈2.50

// Canvas centre of play area (pixel coords), same formula as main.js
const PHYS_CX_PX = CP.x + CP.w * 0.5;
const PHYS_CZ_PX = CP.y + 95 - 33 + BOARD_H * 0.5;   // matches PHYS_CZ in main.js

// ─── GLB model loading ────────────────────────────────────────────────────
/**
 * Load a GLB dice model as a skin override.
 * The first mesh found in the scene is used as the die geometry.
 * Pass a URL string (e.g. from public/) or an ArrayBuffer for file uploads.
 */
export async function loadDiceModel(urlOrBuffer) {
  if (!gltfLoader) gltfLoader = new GLTFLoader();

  try {
    let gltf;
    if (typeof urlOrBuffer === 'string') {
      gltf = await new Promise((res, rej) => gltfLoader.load(urlOrBuffer, res, undefined, rej));
    } else {
      gltf = await new Promise((res, rej) => gltfLoader.parse(urlOrBuffer, '', res, rej));
    }

    let geo = null;
    gltf.scene.traverse(obj => { if (!geo && obj.isMesh) geo = obj.geometry.clone(); });

    if (geo) {
      if (customDiceGeo) customDiceGeo.dispose();
      customDiceGeo = geo;
      if (ready) _rebuildAllMeshes();
      console.log('FortuneFallacy: custom dice GLB loaded');
    }
  } catch (e) {
    console.warn('FortuneFallacy: GLB load failed:', e.message);
  }
}

/** Clear the custom GLB and revert to procedural RoundedBoxGeometry. */
export function clearDiceModel() {
  if (customDiceGeo) { customDiceGeo.dispose(); customDiceGeo = null; }
  if (ready) _rebuildAllMeshes();
}

// ─── Initialisation ───────────────────────────────────────────────────────
export function initDice3D(canvas) {
  if (ready) return true;
  if (!canvas) return false;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
  } catch (e) {
    console.warn('Three.js WebGL init failed, falling back to Canvas 2D dice:', e.message);
    return false;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace  = THREE.SRGBColorSpace;
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();

  // Orthographic camera — 1 world unit = PHYS_SCALE pixels
  const halfW = (W / 2) / WORLD_PX_PER_UNIT;
  const halfH = (H / 2) / WORLD_PX_PER_UNIT;
  camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 100);
  camera.position.set(0, cameraState.lift, cameraState.dolly);
  camera.zoom = cameraState.zoom;
  camera.lookAt(0, 0, 0);
  // Shift projection so world origin renders at canvas (PHYS_CX_PX, PHYS_CZ_PX)
  // instead of canvas center. Keeps 3D tray aligned with 2D UI hit-tests.
  const _viewOffsetY = H / 2 - PHYS_CZ_PX;
  const _viewOffsetX = W / 2 - PHYS_CX_PX;
  camera.setViewOffset(W, H, _viewOffsetX, _viewOffsetY, W, H);
  camera.updateProjectionMatrix();

  // ── Lights ────────────────────────────────────────────────────────────
  ambient = new THREE.AmbientLight(0xfff5e0, 0.40);
  scene.add(ambient);

  dirLight = new THREE.DirectionalLight(0xfff8e8, 1.45);
  dirLight.position.set(4, 10, 6);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width  = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far  = 40;
  dirLight.shadow.camera.left   = -halfW;
  dirLight.shadow.camera.right  =  halfW;
  dirLight.shadow.camera.top    =  halfH;
  dirLight.shadow.camera.bottom = -halfH;
  dirLight.shadow.bias = -0.0004;
  scene.add(dirLight);

  // Warm bounce light from below/front (off felt floor)
  fillLight = new THREE.PointLight(0xffcc88, 0.45, 12, 2);
  fillLight.position.set(0, -0.5, 2.5);
  scene.add(fillLight);

  // Purple rim toward score panel
  rimLight = new THREE.PointLight(0xcc88ff, 1.0, 14, 1.5);
  rimLight.position.set(4.5, 3.5, -1.2);
  scene.add(rimLight);

  underLight = new THREE.PointLight(0x7f4dff, 0.32, 12, 2);
  underLight.position.set(0, 0.35, 0.5);
  scene.add(underLight);

  // ── 3D Tray ───────────────────────────────────────────────────────────
  _initTray();

  // ── Shadow catcher on felt floor ──────────────────────────────────────
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.42 });
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(PLAY_HALF_W * 2 + 0.4, PLAY_HALF_D * 2 + 0.4),
    shadowMat
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.01;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  // ── Clock ─────────────────────────────────────────────────────────────
  clock = new THREE.Clock();
  clock.start();

  // ── Apply saved skin ──────────────────────────────────────────────────
  ready = true;
  const savedId = (() => { try { return localStorage.getItem('ff_diceSkin'); } catch (_) { return null; } })();
  const customJSON = (() => { try { return localStorage.getItem('ff_diceSkin_custom'); } catch (_) { return null; } })();
  if (customJSON) {
    try { registerDiceSkin(JSON.parse(customJSON)); } catch (_) {}
  }
  if (savedId && DICE_SKINS[savedId]) activeSkinId = savedId;

  return true;
}

export function isDice3DReady() { return ready; }

export function resizeDice3D(w, h) {
  if (!ready) return;
  renderer.setSize(w, h, false);
}

// ─── 3D Tray ─────────────────────────────────────────────────────────────
function _initTray() {
  const HW     = PLAY_HALF_W;
  const HD     = PLAY_HALF_D;
  const WALL_H = 0.10;   // low rolled edge — keeps dice contained without towering
  const WALL_T = 0.10;
  const RIM_H  = 0.030;

  // Felt floor — warm stone tone matching 2D board interior (rgba 30,24,18 ≈ 0x1e1812)
  const feltMat = new THREE.MeshStandardMaterial({
    color: 0x1e1812,
    roughness: 0.92,
    metalness: 0.04,
    emissive: 0x140a06,
    emissiveIntensity: 0.22,
  });
  trayFloor = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, HD * 2), feltMat);
  trayFloor.rotation.x = -Math.PI / 2;
  trayFloor.position.y = -0.01;
  trayFloor.receiveShadow = true;
  scene.add(trayFloor);

  // Stone rim base — matches 2D granite rim (rgba 30,28,34 ≈ 0x1e1c22)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e1c22, roughness: 0.85, metalness: 0.10 });
  // Brass top rim — softer than before
  const rimMat  = new THREE.MeshStandardMaterial({ color: 0x8b6a2a, roughness: 0.42, metalness: 0.55 });

  const wallDefs = [
    { pos: [-(HW + WALL_T * 0.5),  WALL_H * 0.5, 0],              size: [WALL_T, WALL_H, HD * 2 + WALL_T * 2] },
    { pos: [ (HW + WALL_T * 0.5),  WALL_H * 0.5, 0],              size: [WALL_T, WALL_H, HD * 2 + WALL_T * 2] },
    { pos: [0, WALL_H * 0.5, -(HD + WALL_T * 0.5)],               size: [HW * 2 + WALL_T * 2, WALL_H, WALL_T] },
    { pos: [0, WALL_H * 0.5,  (HD + WALL_T * 0.5)],               size: [HW * 2 + WALL_T * 2, WALL_H, WALL_T] },
  ];
  const rimDefs = [
    { pos: [-(HW + WALL_T * 0.5), WALL_H + RIM_H * 0.5, 0],       size: [WALL_T + 0.02, RIM_H, HD * 2 + WALL_T * 2 + 0.02] },
    { pos: [ (HW + WALL_T * 0.5), WALL_H + RIM_H * 0.5, 0],       size: [WALL_T + 0.02, RIM_H, HD * 2 + WALL_T * 2 + 0.02] },
    { pos: [0, WALL_H + RIM_H * 0.5, -(HD + WALL_T * 0.5)],       size: [HW * 2 + WALL_T * 2 + 0.02, RIM_H, WALL_T + 0.02] },
    { pos: [0, WALL_H + RIM_H * 0.5,  (HD + WALL_T * 0.5)],       size: [HW * 2 + WALL_T * 2 + 0.02, RIM_H, WALL_T + 0.02] },
  ];

  for (const d of wallDefs) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...d.size), wallMat);
    m.position.set(...d.pos); m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }
  for (const d of rimDefs) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...d.size), rimMat);
    m.position.set(...d.pos);
    scene.add(m);
  }

  // Faint amber edge ring — subtle torchlight reflection on felt
  const innerGlow = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(HW, HD) * 0.85, Math.max(HW, HD) * 1.02, 96),
    new THREE.MeshBasicMaterial({
      color: 0x4a3210,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  );
  innerGlow.rotation.x = -Math.PI / 2;
  innerGlow.position.y = 0.005;
  scene.add(innerGlow);

  // Inner edge fade — vignette so felt blends into 2D stone rim
  const fadeGeo = new THREE.PlaneGeometry(HW * 2 + 0.4, HD * 2 + 0.4);
  const fadeCanvas = document.createElement('canvas');
  fadeCanvas.width = fadeCanvas.height = 256;
  const fctx = fadeCanvas.getContext('2d');
  const fg = fctx.createRadialGradient(128, 128, 60, 128, 128, 128);
  fg.addColorStop(0,    'rgba(0,0,0,0)');
  fg.addColorStop(0.70, 'rgba(0,0,0,0)');
  fg.addColorStop(1,    'rgba(8,6,4,0.85)');
  fctx.fillStyle = fg;
  fctx.fillRect(0, 0, 256, 256);
  const fadeTex = new THREE.CanvasTexture(fadeCanvas);
  fadeTex.colorSpace = THREE.SRGBColorSpace;
  const fadeMesh = new THREE.Mesh(fadeGeo, new THREE.MeshBasicMaterial({
    map: fadeTex, transparent: true, depthWrite: false,
  }));
  fadeMesh.rotation.x = -Math.PI / 2;
  fadeMesh.position.y = 0.008;
  scene.add(fadeMesh);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(HW, HD) * 0.88, Math.max(HW, HD) * 1.14, 96),
    new THREE.MeshBasicMaterial({
      color: 0x8a54ff,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.012;
  scene.add(halo);
}

// ─── Face textures ────────────────────────────────────────────────────────
function makeFaceTexture(face, skin) {
  const key = `${face}|${skin.baseColor}|${skin.pipColor}`;
  const cached = faceTextureCache.get(key);
  if (cached) return cached;

  // Casino-standard pip positions
  const PIP_POS = {
    1: [[0.50, 0.50]],
    2: [[0.30, 0.28], [0.70, 0.72]],
    3: [[0.30, 0.28], [0.50, 0.50], [0.70, 0.72]],
    4: [[0.30, 0.28], [0.70, 0.28], [0.30, 0.72], [0.70, 0.72]],
    5: [[0.30, 0.28], [0.70, 0.28], [0.50, 0.50], [0.30, 0.72], [0.70, 0.72]],
    6: [[0.30, 0.24], [0.70, 0.24], [0.30, 0.50], [0.70, 0.50], [0.30, 0.76], [0.70, 0.76]],
  };

  const SIZE = 512;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const cx = c.getContext('2d');

  const base = skin.baseColor || '#f0ead8';

  // ── Face background — radial gradient for curved-surface feel ─────────
  const bg = cx.createRadialGradient(SIZE * 0.38, SIZE * 0.34, 0, SIZE * 0.5, SIZE * 0.5, SIZE * 0.72);
  bg.addColorStop(0,    _lighten(base, 22));
  bg.addColorStop(0.40, base);
  bg.addColorStop(0.80, _shade(base, -14));
  bg.addColorStop(1,    _shade(base, -28));
  cx.fillStyle = bg;
  cx.fillRect(0, 0, SIZE, SIZE);

  // ── Top-left bevel highlight ───────────────────────────────────────────
  const bevTL = cx.createLinearGradient(0, 0, SIZE * 0.22, SIZE * 0.22);
  bevTL.addColorStop(0, 'rgba(255,255,255,0.32)');
  bevTL.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = bevTL;
  cx.fillRect(0, 0, SIZE, SIZE);

  // ── Bottom-right shadow ────────────────────────────────────────────────
  const bevBR = cx.createLinearGradient(SIZE, SIZE, SIZE * 0.78, SIZE * 0.78);
  bevBR.addColorStop(0, 'rgba(0,0,0,0.30)');
  bevBR.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = bevBR;
  cx.fillRect(0, 0, SIZE, SIZE);

  // ── Hard thin border ───────────────────────────────────────────────────
  cx.strokeStyle = 'rgba(0,0,0,0.20)';
  cx.lineWidth = 7;
  cx.strokeRect(3.5, 3.5, SIZE - 7, SIZE - 7);

  // ── Pips — deeply carved ───────────────────────────────────────────────
  const PIP_R = SIZE * 0.088;
  const pipBase = skin.pipColor || '#100a04';

  for (const [u, v] of (PIP_POS[face] || [])) {
    const px = u * SIZE, py = v * SIZE;

    // Outer carved groove
    const groove = cx.createRadialGradient(px, py, PIP_R * 0.6, px, py, PIP_R * 1.20);
    groove.addColorStop(0, 'rgba(0,0,0,0)');
    groove.addColorStop(1, 'rgba(0,0,0,0.58)');
    cx.fillStyle = groove;
    cx.beginPath(); cx.arc(px, py, PIP_R * 1.20, 0, Math.PI * 2); cx.fill();

    // Pip body
    const pipGrad = cx.createRadialGradient(
      px - PIP_R * 0.28, py - PIP_R * 0.30, 0,
      px, py, PIP_R
    );
    pipGrad.addColorStop(0,   _lighten(pipBase, 14));
    pipGrad.addColorStop(0.45, pipBase);
    pipGrad.addColorStop(1,   '#000000');
    cx.fillStyle = pipGrad;
    cx.beginPath(); cx.arc(px, py, PIP_R, 0, Math.PI * 2); cx.fill();

    // Specular dot — lacquered highlight
    const spec = cx.createRadialGradient(
      px - PIP_R * 0.38, py - PIP_R * 0.40, 0,
      px - PIP_R * 0.28, py - PIP_R * 0.28, PIP_R * 0.30
    );
    spec.addColorStop(0, 'rgba(255,220,160,0.42)');
    spec.addColorStop(1, 'rgba(255,220,160,0)');
    cx.fillStyle = spec;
    cx.beginPath();
    cx.arc(px - PIP_R * 0.30, py - PIP_R * 0.32, PIP_R * 0.30, 0, Math.PI * 2);
    cx.fill();
  }

  // ── Surface micro-texture (tactile grain) ─────────────────────────────
  cx.globalAlpha = 0.025;
  for (let i = 0; i < 120; i++) {
    const tx = Math.random() * SIZE, ty = Math.random() * SIZE;
    cx.strokeStyle = Math.random() > 0.5 ? 'rgba(255,255,255,1)' : 'rgba(0,0,0,1)';
    cx.lineWidth = 0.5;
    cx.beginPath();
    cx.arc(tx, ty, 10 + Math.random() * 22, 0, Math.PI * (0.5 + Math.random() * 1.5));
    cx.stroke();
  }
  cx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  faceTextureCache.set(key, tex);
  return tex;
}

// ─── Colour helpers ───────────────────────────────────────────────────────
function _shade(hex, delta) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const clamp = v => Math.max(0, Math.min(255, v));
  return `#${[m[1], m[2], m[3]].map(c => clamp(parseInt(c, 16) + delta).toString(16).padStart(2, '0')).join('')}`;
}
function _lighten(hex, d) { return _shade(hex, d); }

// ─── Mesh creation ────────────────────────────────────────────────────────
function _createDieMesh(skin) {
  const s = skin || getActiveSkin();
  const geo = customDiceGeo
    ? customDiceGeo.clone()
    : new RoundedBoxGeometry(0.78, 0.78, 0.78, 3, s.cornerRadius);

  const mats = BOX_FACE_TO_DIE.map(faceNum =>
    new THREE.MeshStandardMaterial({
      map:              makeFaceTexture(faceNum, s),
      roughness:        s.roughness,
      metalness:        s.metalness,
      emissive:         new THREE.Color(0x000000),
      emissiveIntensity: 0,
    })
  );
  const mesh = new THREE.Mesh(geo, mats);
  mesh.castShadow    = true;
  mesh.receiveShadow = false;
  mesh.userData.skinId = s.id;
  return mesh;
}

function _updateMeshSkin(mesh, skin) {
  if (mesh.userData.skinId === skin.id) return;
  for (let i = 0; i < mesh.material.length; i++) {
    const mat = mesh.material[i];
    mat.map        = makeFaceTexture(BOX_FACE_TO_DIE[i], skin);
    mat.roughness  = skin.roughness;
    mat.metalness  = skin.metalness;
    mat.needsUpdate = true;
  }
  mesh.userData.skinId = skin.id;
}

function _rebuildAllMeshes() {
  const skin = getActiveSkin();
  for (let i = 0; i < diceMeshes.length; i++) {
    const old = diceMeshes[i];
    scene.remove(old);
    old.geometry.dispose();
    for (const mat of old.material) mat.dispose();
    const neu = _createDieMesh(skin);
    diceMeshes[i] = neu;
    scene.add(neu);
  }
}

// Canvas pixel → world unit (matches main.js PHYS_CX / PHYS_CZ)
function _toWorldX(absX) { return (absX - PHYS_CX_PX) / WORLD_PX_PER_UNIT; }
function _toWorldZ(absY) { return (absY - PHYS_CZ_PX)  / WORLD_PX_PER_UNIT; }

function _expLerp(current, target, dt, rate) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

function _clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ─── Per-frame tick ───────────────────────────────────────────────────────
export function tickDice3D(dice, diceUpgrades, visible) {
  if (!ready || !dice) return;

  const dt   = Math.min(clock.getDelta(), 0.05);
  const t    = clock.elapsedTime;
  const skin = getActiveSkin();

  // Sync mesh count
  while (diceMeshes.length < dice.length) {
    const m = _createDieMesh(skin);
    diceMeshes.push(m);
    scene.add(m);
  }
  while (diceMeshes.length > dice.length) {
    const m = diceMeshes.pop();
    scene.remove(m);
    m.geometry.dispose();
    for (const mat of m.material) mat.dispose();
  }

  let energy = 0;
  for (let i = 0; i < dice.length; i++) {
    const d = dice[i];
    if (d.rolling) {
      energy += Math.hypot(d.pvx || 0, d.pvy || 0) / WORLD_PX_PER_UNIT;
      energy += Math.max(0, -(d.bounceY || 0)) * 0.12;
    }
  }
  const action = _clamp(energy / Math.max(1, dice.length) / 8, 0, 1);
  // Camera is locked — tray must stay anchored to UI. Only lights respond to action.
  rimLight.intensity = _expLerp(rimLight.intensity, 1.0 + action * 0.35, dt, 4.0);
  fillLight.intensity = _expLerp(fillLight.intensity, 0.45 + action * 0.18, dt, 4.0);
  if (underLight) underLight.intensity = _expLerp(underLight.intensity, 0.32 + action * 0.28, dt, 4.0);
  if (trayFloor) trayFloor.material.emissiveIntensity = _expLerp(trayFloor.material.emissiveIntensity, 0.22 + action * 0.10, dt, 3.5);

  for (let i = 0; i < dice.length; i++) {
    const d    = dice[i];
    const mesh = diceMeshes[i];
    mesh.visible = !!visible;
    if (!mesh.visible) continue;

    // Upgrade colour overrides skin base colour for individual dice
    const upgColor = diceUpgrades?.[i]?.color;
    if (upgColor && upgColor !== (skin.baseColor)) {
      // Per-die upgrade colour: rebuild only if changed
      const perKey = `upg|${upgColor}`;
      if (mesh.userData.skinId !== perKey) {
        const upgSkin = { ...skin, id: perKey, baseColor: upgColor };
        for (let fi = 0; fi < mesh.material.length; fi++) {
          const mat = mesh.material[fi];
          mat.map = makeFaceTexture(BOX_FACE_TO_DIE[fi], upgSkin);
          mat.roughness  = upgSkin.roughness;
          mat.metalness  = upgSkin.metalness;
          mat.needsUpdate = true;
        }
        mesh.userData.skinId = perKey;
      }
    } else {
      _updateMeshSkin(mesh, skin);
    }

    // Position
    const wx   = _toWorldX(d.absX);
    const wz   = _toWorldZ(d.absY);
    const hopY = (d.bounceY || 0) / WORLD_PX_PER_UNIT;

    // Idle float: gentle per-die oscillation when settled
    const idleY = (!d.rolling && !d.scoring)
      ? Math.sin(t * 1.4 + i * 1.1) * 0.018
      : 0;

    mesh.position.set(wx, 0.39 + Math.max(0, -hopY) + idleY, wz);
    mesh.rotation.set(d.rx || 0, d.ry || 0, d.rz || 0, 'ZYX');

    // Emissive: modifiers > locked glow > base.
    // d.modifiers can be an array of ids or a single string id (back-compat).
    const locked = !!d.locked;
    const mods = Array.isArray(d.modifiers)
      ? d.modifiers
      : (d.modifiers ? [d.modifiers] : null);
    if (mods && mods.length) {
      // Top-priority modifier wins for hue; intensities sum (capped).
      let topHex = 0x000000, topIntensity = 0, hueCycle = false;
      for (const id of mods) {
        const fx = MODIFIER_FX[id];
        if (!fx) continue;
        const pulse = fx.base + Math.sin(t * fx.pulse + i * 0.7) * 0.10;
        if (pulse > topIntensity) {
          topIntensity = pulse;
          topHex = fx.hex;
          hueCycle = fx.hue;
        }
      }
      if (hueCycle) {
        topHex = _hsvToHex(((t * 0.25) + i * 0.13) % 1, 0.65, 1.0);
      }
      // Locked dice still pulse a warm wash on top
      if (locked) topIntensity = Math.max(topIntensity, 0.18 + Math.sin(t * 2.8 + i * 0.9) * 0.05);
      for (const mat of mesh.material) {
        mat.emissive.set(topHex);
        mat.emissiveIntensity = Math.min(0.85, topIntensity);
      }
    } else if (locked) {
      for (const mat of mesh.material) {
        mat.emissive.set(0xffaa33);
        mat.emissiveIntensity = 0.12 + Math.sin(t * 2.8 + i * 0.9) * 0.06;
      }
    } else {
      for (const mat of mesh.material) mat.emissiveIntensity = 0;
    }

    // Scale pulse when scoring
    let sp = 1;
    if (d.scoring) {
      const st = d.scoringT || 0;
      if (st < 0.08)      sp = 1 + 0.28 * (st / 0.08);
      else if (st < 0.18) sp = 1.28 - 0.18 * ((st - 0.08) / 0.10);
      else                sp = 1.10 - 0.10 * Math.min(1, (st - 0.18) / 0.10);
    }
    if (!d.rolling && d.revealT != null) {
      const reveal = Math.max(0, 1 - Math.min(1, d.revealT / 0.22));
      sp += Math.sin(reveal * Math.PI) * 0.08;
    }
    mesh.scale.setScalar(sp);
  }

  renderer.render(scene, camera);
}

// Public modifier helpers — main.js mutates d.modifiers directly, but these
// give a stable API in case the data model later moves to a side-table.
export function setDieModifiers(die, mods) {
  die.modifiers = Array.isArray(mods) ? mods.slice(0, 2) : (mods ? [mods] : null);
}
export function getDieModifiers(die) {
  return Array.isArray(die.modifiers) ? die.modifiers : (die.modifiers ? [die.modifiers] : []);
}
export function MODIFIER_BADGE_COLOR(id) {
  return DICE_MODIFIERS[id]?.tint || '#ECDEC8';
}

// Hide all dice (e.g. when switching screens)
export function clearDice3D() {
  for (const m of diceMeshes) m.visible = false;
  if (ready) renderer.render(scene, camera);
}
