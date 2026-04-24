// Three.js 3D dice renderer. Phase 3.
//
// Integration pattern:
//   - Rapier/legacy physics in main.js drives die.absX, die.absY, die.rx,
//     die.ry, die.rz each frame. This module READS those values and
//     positions Three.js meshes accordingly.
//   - Canvas 2D UI in main.js continues to draw on top (rune dots, upgrade
//     icons, hover highlights) — see drawGame() gating.
//
// Face layout:
//   Three.js BoxGeometry material slots are ordered +X,-X,+Y,-Y,+Z,-Z.
//   Game dice face numbering (from CUBE_FACES in main.js):
//       +X=2, -X=5, +Y=4, -Y=3, +Z=1, -Z=6
//   Hence BOX_FACE_TO_DIE below.
//
// Rotation convention:
//   main.js rotate3 applies Rx, then Ry, then Rz in world frame (extrinsic
//   XYZ), which equals Three.js intrinsic 'ZYX' Euler order.

import * as THREE from 'three';
import { W, H, DICE_SIZE, CP, BOARD_H, PHYS_SCALE } from '../data/constants.js';

// ─── State ────────────────────────────────────────────────────────────────
let scene     = null;
let camera    = null;
let renderer  = null;
let ambient   = null;
let dirLight  = null;
let rimLight  = null;
let diceMeshes = [];     // THREE.Mesh[], parallel to dice[] in main.js
let diceBaseColors = []; // last-known upgrade color per index (for invalidation)
let faceTextureCache = new Map(); // key `${face}|${color}` -> THREE.CanvasTexture
let ready = false;

// BoxGeometry face-slot → die-face-number
const BOX_FACE_TO_DIE = [2, 5, 4, 3, 1, 6];

// Play-area physics bounds translated to world units.
// In main.js: PHYS_CX = CP.x + CP.w*0.5, PHYS_CZ computed from BOARD_Y.
// Canvas → world uses the same pixel-per-unit as PHYS_SCALE (50 px/unit).
const WORLD_PX_PER_UNIT = PHYS_SCALE;            // 50
const PLAY_HALF_W = (CP.w - 20) / 2 / PHYS_SCALE;
const PLAY_HALF_D = (BOARD_H - 20) / 2 / PHYS_SCALE;

// Canvas center of the play area (pixel coords), derived from CP + BOARD_Y
const PHYS_CX_PX = CP.x + CP.w * 0.5;
const PHYS_CZ_PX_PLACEHOLDER = CP.y + 95 - 33 + BOARD_H * 0.5; // roughly matches main.js

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

  scene = new THREE.Scene();

  // Orthographic camera — frustum sized so 1 world unit ≈ PHYS_SCALE pixels.
  // That keeps dice the right size relative to Canvas-2D UI siblings.
  const halfW = (W / 2) / WORLD_PX_PER_UNIT;    // ≈ 9.6
  const halfH = (H / 2) / WORLD_PX_PER_UNIT;    // ≈ 5.4
  camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 100);
  // Top-down with slight pitch so faces read but dice retain 3D feel.
  camera.position.set(0, 8, 3.2);
  camera.lookAt(0, 0, 0);

  // Lights
  ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  dirLight = new THREE.DirectionalLight(0xfff2d8, 1.25);
  dirLight.position.set(4, 10, 6);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width  = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far  = 40;
  dirLight.shadow.camera.left   = -halfW;
  dirLight.shadow.camera.right  =  halfW;
  dirLight.shadow.camera.top    =  halfH;
  dirLight.shadow.camera.bottom = -halfH;
  dirLight.shadow.bias = -0.0005;
  scene.add(dirLight);

  // Purple rim light toward the score panel — adds the "alive" colour
  rimLight = new THREE.PointLight(0xcc88ff, 0.9, 14, 1.6);
  rimLight.position.set(4.5, 3.5, -1.2);
  scene.add(rimLight);

  // Shadow-catcher plane at y=0 (invisible except receives shadows)
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.35 });
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(halfW * 3, halfH * 3),
    shadowMat
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  ready = true;
  return true;
}

export function isDice3DReady() { return ready; }

export function resizeDice3D(w, h) {
  if (!ready) return;
  renderer.setSize(w, h, false);
}

// ─── Face textures (Canvas 2D → THREE.CanvasTexture) ──────────────────────
function makeFaceTexture(face, dieColor) {
  const key = `${face}|${dieColor}`;
  const cached = faceTextureCache.get(key);
  if (cached) return cached;

  const PIP_POSITIONS = {
    1: [[0.5, 0.5]],
    2: [[0.3, 0.3], [0.7, 0.7]],
    3: [[0.3, 0.3], [0.5, 0.5], [0.7, 0.7]],
    4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
    5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
    6: [[0.3, 0.25], [0.7, 0.25], [0.3, 0.5], [0.7, 0.5], [0.3, 0.75], [0.7, 0.75]],
  };

  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const cx = c.getContext('2d');

  // Base gradient for subtle dimensionality
  const grad = cx.createLinearGradient(0, 0, 0, size);
  const base = dieColor || '#f0ead8';
  grad.addColorStop(0,   base);
  grad.addColorStop(0.5, shade(base, -4));
  grad.addColorStop(1,   shade(base, -14));
  cx.fillStyle = grad;
  cx.fillRect(0, 0, size, size);

  // Subtle inner bevel highlight
  const bevel = cx.createLinearGradient(0, 0, 0, size);
  bevel.addColorStop(0,   'rgba(255,255,240,0.22)');
  bevel.addColorStop(0.2, 'rgba(255,255,240,0)');
  cx.fillStyle = bevel;
  cx.fillRect(0, 0, size, size);

  // Edge darkening for a carved look
  cx.strokeStyle = 'rgba(0,0,0,0.25)';
  cx.lineWidth = 8;
  cx.strokeRect(4, 4, size - 8, size - 8);

  // Pips with inner shadow (carved into the face)
  cx.fillStyle = '#1a0e06';
  for (const [u, v] of (PIP_POSITIONS[face] || [])) {
    const px = u * size;
    const py = v * size;
    const r  = size * 0.085;
    const pipGrad = cx.createRadialGradient(px - r*0.35, py - r*0.35, 0, px, py, r * 1.1);
    pipGrad.addColorStop(0,   '#3a2010');
    pipGrad.addColorStop(0.5, '#1a0e06');
    pipGrad.addColorStop(1,   '#000000');
    cx.fillStyle = pipGrad;
    cx.beginPath();
    cx.arc(px, py, r, 0, Math.PI * 2);
    cx.fill();
    // Tiny specular dot
    cx.fillStyle = 'rgba(255,220,160,0.22)';
    cx.beginPath();
    cx.arc(px - r*0.4, py - r*0.4, r * 0.22, 0, Math.PI * 2);
    cx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  faceTextureCache.set(key, tex);
  return tex;
}

// Tiny colour helper: delta applied to hex `#rrggbb`
function shade(hex, delta) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = Math.max(0, Math.min(255, parseInt(m[1], 16) + delta));
  const g = Math.max(0, Math.min(255, parseInt(m[2], 16) + delta));
  const b = Math.max(0, Math.min(255, parseInt(m[3], 16) + delta));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ─── Mesh creation / update ───────────────────────────────────────────────
function createDieMesh(upgradeColor) {
  const color = upgradeColor || '#f0ead8';
  const geo = new THREE.BoxGeometry(0.78, 0.78, 0.78, 1, 1, 1);
  const mats = BOX_FACE_TO_DIE.map(faceNum =>
    new THREE.MeshStandardMaterial({
      map: makeFaceTexture(faceNum, color),
      roughness: 0.32,
      metalness: 0.12,
    })
  );
  const mesh = new THREE.Mesh(geo, mats);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.userData.upgradeColor = color;
  return mesh;
}

function updateMeshForUpgrade(mesh, upgradeColor) {
  const next = upgradeColor || '#f0ead8';
  if (mesh.userData.upgradeColor === next) return;
  // Swap material textures without recreating the mesh
  for (let i = 0; i < mesh.material.length; i++) {
    const faceNum = BOX_FACE_TO_DIE[i];
    mesh.material[i].map = makeFaceTexture(faceNum, next);
    mesh.material[i].needsUpdate = true;
  }
  mesh.userData.upgradeColor = next;
}

// Canvas-pixel → world-unit conversion (for dice positioning).
// absX is in [0..960], absY in [0..540].
function canvasToWorldX(absX) { return (absX - PHYS_CX_PX) / WORLD_PX_PER_UNIT; }
function canvasToWorldZ(absY) { return (absY - PHYS_CZ_PX_PLACEHOLDER) / WORLD_PX_PER_UNIT; }

// ─── Per-frame tick ───────────────────────────────────────────────────────
// dice:          game's dice array (positions, rotations, flags)
// diceUpgrades:  parallel array of upgrade definitions (may have .color)
// visible:       true when the game-screen is active; otherwise hides dice
export function tickDice3D(dice, diceUpgrades, visible) {
  if (!ready || !dice) return;

  // Sync mesh count
  while (diceMeshes.length < dice.length) {
    const m = createDieMesh(diceUpgrades?.[diceMeshes.length]?.color);
    diceMeshes.push(m);
    scene.add(m);
  }
  while (diceMeshes.length > dice.length) {
    const m = diceMeshes.pop();
    scene.remove(m);
    // Dispose geometry — materials use shared textures, don't dispose maps
    m.geometry.dispose();
    for (const mat of m.material) mat.dispose();
  }

  for (let i = 0; i < dice.length; i++) {
    const d    = dice[i];
    const mesh = diceMeshes[i];
    mesh.visible = !!visible;
    if (!mesh.visible) continue;

    // Upgrade changed? swap textures
    const upgColor = diceUpgrades?.[i]?.color;
    updateMeshForUpgrade(mesh, upgColor);

    // Position (canvas coords → world)
    const wx = canvasToWorldX(d.absX);
    const wz = canvasToWorldZ(d.absY);
    // bounceY (in canvas px, +Y is down) → world +Y is up
    const hopY = (d.bounceY || 0) / WORLD_PX_PER_UNIT;
    // Keep dice sitting just above floor by default (half-height = 0.39)
    mesh.position.set(wx, 0.39 + Math.max(0, -hopY), wz);

    // Rotation — Euler order 'ZYX' matches main.js rotate3's
    // Rx→Ry→Rz extrinsic sequence.
    mesh.rotation.set(d.rx || 0, d.ry || 0, d.rz || 0, 'ZYX');

    // Scale pulse when scoring (match main.js drawDie3D curve)
    let scalePulse = 1;
    if (d.scoring) {
      const t = d.scoringT || 0;
      if (t < 0.08)      scalePulse = 1 + 0.28 * (t / 0.08);
      else if (t < 0.18) scalePulse = 1.28 - 0.18 * ((t - 0.08) / 0.10);
      else               scalePulse = 1.10 - 0.10 * Math.min(1, (t - 0.18) / 0.10);
    }
    mesh.scale.setScalar(scalePulse);
  }

  renderer.render(scene, camera);
}

// Hide all dice (e.g. when switching screens)
export function clearDice3D() {
  for (const m of diceMeshes) m.visible = false;
  if (ready) renderer.render(scene, camera);
}
