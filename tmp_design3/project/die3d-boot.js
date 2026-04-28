// Boot file: imports three.js + physics-die.js as ES modules, then exposes
// what the React Die3D component needs as globals on `window`. Resolves the
// `window.__diceReady` promise once everything is wired up.
//
// This file MUST be loaded as <script type="module"> AFTER an importmap that
// maps "three" and "three/addons/" to unpkg.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildDieVisual, DIE_STYLES, FACE_NORMALS } from './physics-die.js?v=6';

// PMREM textures are tied to the WebGL context they were baked on. We can't
// pre-bake on a throwaway renderer and reuse it on per-die renderers — the
// texture handle won't translate. Instead, hand React a factory it can call
// to build a per-renderer env map.
function makeEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return tex;
}

window.THREE = THREE;
window.__makeEnvMap = makeEnvMap;
window.__buildDieVisual = buildDieVisual;
window.__DIE_STYLES = DIE_STYLES;
window.__FACE_NORMALS = FACE_NORMALS;

// Resolve the ready promise that React waits on
if (window.__diceReadyResolve) window.__diceReadyResolve();
