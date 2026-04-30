// src-next/render/three/dieMaterials.ts

import type { ModId } from '../../core/mods';

// Mod material keys are exactly the mod ids. Deriving from ModId means a new
// mod added to MOD_IDS without an entry in MOD_MATERIALS is a TypeScript error.
export type ModMaterialKey = ModId;

// Partial StyleDef override applied on top of the base die-style. Anything
// not specified inherits from the player's chosen base style. Hex colors are
// numbers (Three.js convention); use `0xff7847` form.
export type ModMaterialOverride = {
  bodyTint?: number;
  bodyDeep?: number;
  edge?: number;
  pip?: number;
  halo?: number;
  eIntensity?: number;
  transmission?: number;
  thickness?: number;
  ior?: number;
  rough?: number;
  metalness?: number;
  sheen?: number;
  sheenColor?: number;
};

// Each mod's phenomenological material — see spec Section "Per-Mod Idle
// Material" for the source-of-truth descriptions.
export const MOD_MATERIALS: Record<ModMaterialKey, ModMaterialOverride> = {
  // 1. Amplify — Sound-wave amplifier; brushed brass, low transmission, ringing edge.
  amplify: {
    bodyTint: 0xc89042, bodyDeep: 0x4a2e10,
    edge: 0xf5c451, halo: 0xf5c451,
    transmission: 0.18, rough: 0.55, ior: 1.45, eIntensity: 1.4,
  },
  // 2. Sharpened — Honed obsidian; mirror-polish edges, cool steel emissive.
  sharpened: {
    bodyTint: 0x4a4d6b, bodyDeep: 0x07051a,
    edge: 0xa4d4ff, halo: 0xa4d4ff,
    transmission: 0.12, rough: 0.20, ior: 1.60, eIntensity: 1.6,
  },
  // 3. Gilded — Gold leaf plating; high metalness, gold sheen, warm IOR.
  gilded: {
    bodyTint: 0xf5c451, bodyDeep: 0xa07820,
    edge: 0xfff7e0, halo: 0xf5c451,
    transmission: 0.08, rough: 0.35, ior: 1.55, eIntensity: 1.0,
    metalness: 0.85, sheen: 0.55, sheenColor: 0xf5c451,
  },
  // 4. Loaded — Asymmetric mass; bronze-shifted, deep sheen.
  loaded: {
    bodyTint: 0xc87a4a, bodyDeep: 0x4a1e08,
    edge: 0xc87a4a, halo: 0xc87a4a,
    transmission: 0.20, rough: 0.45, thickness: 0.95,
  },
  // 5. Snake Eyes — Paired stars; deep midnight blue, cyan pinpricks.
  snake_eyes: {
    bodyTint: 0x1a1f4a, bodyDeep: 0x07051a,
    edge: 0x7be3ff, halo: 0x7be3ff,
    transmission: 0.20, eIntensity: 1.7,
  },
  // 6. High Roller — Plasma corona; higher emissive, faint outer halo.
  high_roller: {
    bodyTint: 0xff6a3a, bodyDeep: 0x5a1408,
    edge: 0xff7847, halo: 0xff7847,
    transmission: 0.40, eIntensity: 2.4,
  },
  // 7. Backstop — Ceramic safety plate; matte ceramic, milky transmission.
  backstop: {
    bodyTint: 0xb8d4be, bodyDeep: 0x3e5a45,
    edge: 0x9bd0a8, halo: 0x9bd0a8,
    transmission: 0.50, rough: 0.70, eIntensity: 0.8,
  },
  // 8. Pip Charge — Capacitor / electric charge; dark glassy body, amber pulse.
  pip_charge: {
    bodyTint: 0x1a1a3a, bodyDeep: 0x07051a,
    edge: 0xffd84a, halo: 0xffd84a,
    transmission: 0.05, eIntensity: 1.5, rough: 0.25,
  },
  // 9. Even Keel — Gyroscopic balance; polished symmetric, cool neutral.
  even_keel: {
    bodyTint: 0xc0c8d8, bodyDeep: 0x6a7080,
    edge: 0xdde2ec, halo: 0xc0c8d8,
    transmission: 0.15, rough: 0.20, metalness: 0.4, eIntensity: 1.0,
  },
  // 10. Mirror Pair — Reflective twin; glassy chrome, mirror IOR, ghost silhouette.
  mirror_pair: {
    bodyTint: 0xe0c8ff, bodyDeep: 0x6a4a8a,
    edge: 0xe0c8ff, halo: 0xe0c8ff,
    transmission: 0.20, rough: 0.05, ior: 1.70, metalness: 0.95,
  },
  // 11. Vanguard — Bright orange flame finish (urgency, lead).
  vanguard: {
    bodyTint: 0xff7847, bodyDeep: 0x6b1f08,
    edge: 0xffb074, halo: 0xff7847,
    transmission: 0.30, rough: 0.35, eIntensity: 1.8,
  },
  // 12. Capstone — Deep teal/jade plated (capping, completion).
  capstone: {
    bodyTint: 0x5be8a4, bodyDeep: 0x1f5a3e,
    edge: 0x9bf0c8, halo: 0x5be8a4,
    transmission: 0.25, rough: 0.40, eIntensity: 1.4,
    metalness: 0.3,
  },
  // 13. Conduit — Purple electric thread finish (chain, energy flow).
  conduit: {
    bodyTint: 0x8a6ad4, bodyDeep: 0x2e1d6b,
    edge: 0xe0c8ff, halo: 0xbba8ff,
    transmission: 0.18, rough: 0.30, eIntensity: 2.0,
  },
};
