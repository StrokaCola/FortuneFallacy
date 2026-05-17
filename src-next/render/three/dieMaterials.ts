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
    // eIntensity 2.4→2.8 — plasma corona pushed brighter so the
    // "high roller" identity reads as visibly hotter than baseline
    // mods even at gameplay distance. Brightness is the fastest
    // visual cue when 12 mods otherwise share the same colour skeleton.
    bodyTint: 0xff6a3a, bodyDeep: 0x5a1408,
    edge: 0xff7847, halo: 0xff7847,
    transmission: 0.40, eIntensity: 2.8,
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
  // 14. Tithe — Coin-press; warm gold accents on a deep merchant-burgundy body.
  tithe: {
    bodyTint: 0x6a2a3e, bodyDeep: 0x2a0e18,
    edge: 0xf5c451, halo: 0xf5c451,
    transmission: 0.10, rough: 0.40, eIntensity: 1.4,
    metalness: 0.55, sheen: 0.35, sheenColor: 0xf5c451,
  },
  // 15. Resonance — Echo chamber; pearlescent purple, doubled inner halo.
  resonance: {
    bodyTint: 0x8a6ad4, bodyDeep: 0x2e1d6b,
    edge: 0xbba8ff, halo: 0xbba8ff,
    transmission: 0.32, rough: 0.22, ior: 1.55, eIntensity: 2.2,
  },
  // 16. Crescendo — Wave swell; jade body brightening to mint at edges.
  crescendo: {
    bodyTint: 0x2e8a6a, bodyDeep: 0x0e3a2a,
    edge: 0x9bf0c8, halo: 0x5be8a4,
    transmission: 0.28, rough: 0.30, eIntensity: 1.8,
  },
  // 17. Crown — Royal gold-leaf with regal saturation, only awake on 6s.
  crown: {
    bodyTint: 0xffd84a, bodyDeep: 0x6a4a08,
    edge: 0xfff7e0, halo: 0xffd84a,
    transmission: 0.08, rough: 0.30, ior: 1.55, eIntensity: 1.6,
    metalness: 0.78, sheen: 0.50, sheenColor: 0xffd84a,
  },
  // 18. Brittle — Cracked obsidian; high-contrast crimson fissures.
  brittle: {
    // eIntensity 2.0→2.5 — fracture energy crackling louder. The
    // "destroyed on bust" lore deserves a die that visibly hums with
    // tension; pair with the new spiked geometric variant for the
    // dramatic destroy-able feel.
    bodyTint: 0x4a0e10, bodyDeep: 0x1a0405,
    edge: 0xff7847, halo: 0xff7847,
    transmission: 0.05, rough: 0.55, eIntensity: 2.5,
  },
  // 19. Wildcard — Prismatic; high IOR, near-mirror, color shifts on view.
  wildcard: {
    bodyTint: 0xe0c8ff, bodyDeep: 0x6a4a8a,
    edge: 0xffffff, halo: 0xe0c8ff,
    transmission: 0.30, rough: 0.10, ior: 1.75, metalness: 0.60,
  },
  // ─── Phase 5b — Combo / round / ante / galaxy aware mods ──────────────
  // These reuse base material vocab — body deep + edge accent — until the
  // bespoke material work for them lands. Picked by feel.
  // 20. Anchor — Heavy steel band; subdued cyan glow.
  anchor: {
    bodyTint: 0x2a4a6a, bodyDeep: 0x0a1a30,
    edge: 0x88ddff, halo: 0x88ddff,
    transmission: 0.12, rough: 0.45, eIntensity: 1.2,
  },
  // 21. Keystone — Apex gold; sister to crown, brighter halo.
  keystone: {
    bodyTint: 0xfff0a0, bodyDeep: 0x6a4a08,
    edge: 0xffd84a, halo: 0xfff7e0,
    transmission: 0.10, rough: 0.28, ior: 1.55, eIntensity: 1.7,
    metalness: 0.70, sheen: 0.60, sheenColor: 0xffd84a,
  },
  // 22. Astrolabe — Constellation copper; warm violet edge.
  astrolabe: {
    bodyTint: 0x6a3a8a, bodyDeep: 0x1a0a30,
    edge: 0xcc88ff, halo: 0xe0c8ff,
    transmission: 0.22, rough: 0.30, eIntensity: 1.6,
  },
  // 23. Pressure — Industrial brass; tense orange sheen.
  pressure: {
    bodyTint: 0xc04a2a, bodyDeep: 0x300a05,
    edge: 0xff7847, halo: 0xff7847,
    transmission: 0.10, rough: 0.50, eIntensity: 1.5,
  },
  // 24. Risk — High-volt yellow with deep arcs.
  risk: {
    bodyTint: 0xffd84a, bodyDeep: 0x4a3a08,
    edge: 0xfff7e0, halo: 0xffd84a,
    transmission: 0.12, rough: 0.30, eIntensity: 2.0,
  },
  // 25. Singularity — Void-black with violet event-horizon halo.
  singularity: {
    bodyTint: 0x05030a, bodyDeep: 0x000000,
    edge: 0xcc88ff, halo: 0xcc88ff,
    transmission: 0.04, rough: 0.20, ior: 2.10, eIntensity: 2.2,
  },
  // 26. Refinery — Polished bullion gold, sister to gilded.
  refinery: {
    bodyTint: 0xf5c451, bodyDeep: 0x6a4a08,
    edge: 0xfff7e0, halo: 0xf5c451,
    transmission: 0.08, rough: 0.40, ior: 1.55, eIntensity: 1.0,
    metalness: 0.80, sheen: 0.45, sheenColor: 0xf5c451,
  },
  // 27. Polarize — Half-moon violet split: bright crown, dark base.
  polarize: {
    bodyTint: 0x6a4a8a, bodyDeep: 0x1a0a30,
    edge: 0xbba8ff, halo: 0xe0c8ff,
    transmission: 0.18, rough: 0.30, eIntensity: 1.6,
  },
  // 28. Telescope — Smoky lens; high IOR with cyan rim glow.
  telescope: {
    bodyTint: 0x2a2a4a, bodyDeep: 0x07051a,
    edge: 0xcc88ff, halo: 0xa4d4ff,
    transmission: 0.30, rough: 0.18, ior: 1.85, eIntensity: 1.5,
  },
  // 29. Engraved — Etched basalt; matte, low halo, deeply textured.
  engraved: {
    bodyTint: 0x4a4a4a, bodyDeep: 0x0a0a0a,
    edge: 0xa4d4ff, halo: 0xa4d4ff,
    transmission: 0.04, rough: 0.70, eIntensity: 0.7,
  },
  // 30. Echo — Translucent quartz with cyan ripple, doubled rim glow.
  echo: {
    bodyTint: 0x2a4a8a, bodyDeep: 0x0a1a30,
    edge: 0x88ddff, halo: 0x88ddff,
    transmission: 0.42, rough: 0.18, ior: 1.65, eIntensity: 1.7,
  },
  // 31. Tally Mark — Scribed slate; thin cool emissive marks accumulate.
  tally_mark: {
    bodyTint: 0x2a2a3a, bodyDeep: 0x07051a,
    edge: 0x88ddff, halo: 0x88ddff,
    transmission: 0.06, rough: 0.60, eIntensity: 1.0,
  },
  // 32. Cadence — Pulsing teal; rhythmic emissive pattern.
  cadence: {
    bodyTint: 0x1a4a3a, bodyDeep: 0x07261a,
    edge: 0x5be8a4, halo: 0x5be8a4,
    transmission: 0.20, rough: 0.30, eIntensity: 1.6,
  },
  // 33. Veteran — Tarnished steel with violet rim; battle-worn.
  veteran: {
    bodyTint: 0x3a3a4a, bodyDeep: 0x10101a,
    edge: 0xbba8ff, halo: 0xbba8ff,
    transmission: 0.08, rough: 0.55, eIntensity: 1.0,
    metalness: 0.55,
  },
  // 34. Glutton — Deep amber/orange; consumption-pulse on six.
  glutton: {
    bodyTint: 0x6a3a1a, bodyDeep: 0x2a0a08,
    edge: 0xff7847, halo: 0xff7847,
    transmission: 0.16, rough: 0.40, eIntensity: 1.5,
  },
  // 35. Dormant — Cold lavender, low emissive — awakens to bright bloom.
  dormant: {
    // eIntensity 0.5→0.3 — push lower so a sleeping Dormant die reads
    // as visibly dim against the brighter mods around it. The
    // awakening visual (haloed-theatrical bloom on threshold cross)
    // does the heavy lifting once the player earns it; pre-awaken
    // should feel asleep, not "slightly less bright."
    bodyTint: 0x3a2a4a, bodyDeep: 0x10081a,
    edge: 0xa080c0, halo: 0xa080c0,
    transmission: 0.12, rough: 0.50, eIntensity: 0.3,
  },
  // 36. Ballast — Deep cyan stone, heavy and grounded.
  ballast: {
    bodyTint: 0x1a3a4a, bodyDeep: 0x07101a,
    edge: 0x88ddff, halo: 0x88ddff,
    transmission: 0.10, rough: 0.65, eIntensity: 0.9,
  },
  // 37. Pyre Mark — Charred crimson with orange ember edge.
  pyre_mark: {
    bodyTint: 0x4a1a1a, bodyDeep: 0x1a0707,
    edge: 0xff7847, halo: 0xffb47a,
    transmission: 0.12, rough: 0.45, eIntensity: 1.8,
  },
  // ─── Banish-face family (2026-05-13) ────────────────────────────────────
  // Shared visual language: cool blue/violet "void-glass" body; the mods'
  // re-tumble identity is carried by the Dice3D pop-up animation rather
  // than by the idle material. Bespoke shaders can ship later; these
  // borrow the family closest in vibe so the dice still read distinctly.
  // 38. Aversion — Pale void-glass; subtle rejection.
  aversion: {
    bodyTint: 0x2a3a5a, bodyDeep: 0x0a1228,
    edge: 0xa4d4ff, halo: 0xa4d4ff,
    transmission: 0.30, rough: 0.25, ior: 1.55, eIntensity: 1.4,
  },
  // 39. Anti-One Sigil — Brighter cyan halo, +chip payoff signal.
  anti_one_sigil: {
    bodyTint: 0x1a3a5a, bodyDeep: 0x07121a,
    edge: 0x7be3ff, halo: 0x7be3ff,
    transmission: 0.28, rough: 0.22, ior: 1.55, eIntensity: 1.7,
  },
  // 40. Restless Die — Phasing violet; never settles on the same face.
  restless_die: {
    bodyTint: 0x4a2a6a, bodyDeep: 0x1a0a30,
    edge: 0xcc88ff, halo: 0xcc88ff,
    transmission: 0.35, rough: 0.25, eIntensity: 1.8,
  },
  // 41. Wide Net — Deep emerald with wider rim; many faces banished.
  wide_net: {
    bodyTint: 0x1a4a3a, bodyDeep: 0x072a1a,
    edge: 0x5be8a4, halo: 0x5be8a4,
    transmission: 0.20, rough: 0.30, eIntensity: 1.5,
  },
  // 42. High Tide — Twilight blue, dual-edge halo (banishes both extremes).
  high_tide: {
    bodyTint: 0x1a3a5a, bodyDeep: 0x07111a,
    edge: 0x88ddff, halo: 0x88ddff,
    transmission: 0.28, rough: 0.25, eIntensity: 1.6,
  },
  // 43. Mirror Banish — Lavender prism; reads the other dice.
  mirror_banish: {
    bodyTint: 0x5a3a8a, bodyDeep: 0x1a0a30,
    edge: 0xe0c8ff, halo: 0xe0c8ff,
    transmission: 0.32, rough: 0.18, ior: 1.70, metalness: 0.45,
  },
  // 44. Pyre Pact — Crimson contract with cold gold accent (milestone reward).
  pyre_pact: {
    bodyTint: 0x5a1010, bodyDeep: 0x1a0404,
    edge: 0xff7847, halo: 0xffd84a,
    transmission: 0.10, rough: 0.45, eIntensity: 2.0,
  },
  // 45. Three Banished — Tri-tone violet with shifting emissive; gambler's pick.
  three_banished: {
    bodyTint: 0x4a3a6a, bodyDeep: 0x1a0a30,
    edge: 0xbba8ff, halo: 0xbba8ff,
    transmission: 0.28, rough: 0.30, eIntensity: 1.4,
  },
  // 46. Voidlock — Sealed gold-on-black; only one face survives.
  voidlock: {
    bodyTint: 0x1a1a1a, bodyDeep: 0x000000,
    edge: 0xffd84a, halo: 0xffd84a,
    transmission: 0.05, rough: 0.20, ior: 1.75, eIntensity: 2.2,
    metalness: 0.65, sheen: 0.55, sheenColor: 0xffd84a,
  },
  // 2026-05-16 unlock-content roadmap — 5 mods.
  // 47. Calibrated — Cool cyan-on-bone calibration etching.
  calibrated: {
    bodyTint: 0x4a6a8a, bodyDeep: 0x1a2a40,
    edge: 0x7be3ff, halo: 0x7be3ff,
    transmission: 0.15, rough: 0.30, eIntensity: 1.6,
  },
  // 48. Reckless — Cracked crimson glass with fault lines.
  reckless: {
    bodyTint: 0x6a1a2a, bodyDeep: 0x2a0008,
    edge: 0xff4d6d, halo: 0xff4d6d,
    transmission: 0.20, rough: 0.55, eIntensity: 2.0,
  },
  // 49. Sun-Forged — Heavy gilt with corona ring; the Supernova reward.
  sun_forged: {
    bodyTint: 0xf5c451, bodyDeep: 0x8a4a10,
    edge: 0xffeaa0, halo: 0xffd84a,
    transmission: 0.08, rough: 0.18, ior: 1.55, eIntensity: 2.4,
    metalness: 0.7, sheen: 0.45, sheenColor: 0xffd84a,
  },
  // 50. Heirbound — Engraved violet with bone-ivory inlay.
  heirbound: {
    bodyTint: 0x5a4a6a, bodyDeep: 0x1c1245,
    edge: 0xbba8ff, halo: 0xbba8ff,
    transmission: 0.12, rough: 0.40, eIntensity: 1.4,
  },
  // 51. Veiled — Muted aurora-violet under a quiet matte veil.
  veiled: {
    bodyTint: 0x4a4a6a, bodyDeep: 0x1a1a30,
    edge: 0x9577ff, halo: 0x9577ff,
    transmission: 0.10, rough: 0.65, eIntensity: 1.0,
  },
};
