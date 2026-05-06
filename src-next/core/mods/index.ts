import type { ModMaterialKey } from '../../render/three/dieMaterials';

// Canonical ordered list of mod ids. Source of truth for cross-module linkage:
// dieMaterials.ts derives ModMaterialKey from this list, so adding a mod here
// without a matching entry in MOD_MATERIALS is a TypeScript error.
export const MOD_IDS = [
  'amplify',
  'sharpened',
  'gilded',
  'loaded',
  'snake_eyes',
  'high_roller',
  'backstop',
  'pip_charge',
  'even_keel',
  'mirror_pair',
  'vanguard',
  'capstone',
  'conduit',
  'tithe',
  'resonance',
  'crescendo',
  'crown',
  'brittle',
  'wildcard',
  // Phase 5b — combo / round / ante / galaxy aware mods.
  'anchor',
  'keystone',
  'astrolabe',
  'pressure',
  'risk',
  'singularity',
  'refinery',
  'polarize',
  'telescope',
  'engraved',
] as const;

export type ModId = typeof MOD_IDS[number];

export type ModVisual = {
  materialKey: ModMaterialKey;
  accentColor: string;                                       // #rrggbb
  geometricVariant?: 'asymmetric' | 'plated' | 'recessed';   // pilot 3 only; used by Phase 4
  triggerFx: 'loaded' | 'pipCharge' | 'backstop' | 'pulse';  // pilot or generic; used by Phase 5/6
};

export type ModRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type ModDef = {
  id: ModId;
  name: string;
  icon: string;
  desc: string;
  rarity: ModRarity;
  scoreBonus?: number;
  multBonus?: number;
  shardsBonus?: number;
  faceRemap?: { from: number; to: number };
  highFaceMult?: number;
  snakeEyes?: number;
  scoreMin?: number;
  chipPerPip?: number;
  evenFaceMult?: number;
  pairBonus?: number;
  firstBonus?: number;
  lastBonus?: number;
  chainMult?: number;
  // Tithe: per-die cost-gated chips/mult. Cost is 1 shard per scoring die,
  // drawn from `round.tithePrimedThisHand` budget set in SCORE_HAND.
  titheChips?: number;
  titheMult?: number;
  // Resonance: marker mod. The OTHER mod on the same die fires twice
  // (chips/mult only). See `applyDieModStep`.
  resonate?: boolean;
  // Crescendo: inverse of chainMult — +X mult per die scored AFTER this one.
  chainMultPost?: number;
  // Crown: multiplicative ×mult applied at end of die's scoring when face
  // matches `crownFace` (default 6). Applied AFTER additive mods on the die.
  crownMult?: number;
  crownFace?: number;
  // Brittle: mod is destroyed when the hand busts the blind. Handled in
  // `bustBlind` (transitions.ts).
  loseOnBust?: boolean;
  // Wildcard: face is replaced (in postRollModifiers) with whatever value
  // maximizes the resulting combo tier.
  wildcard?: boolean;
  // ─── Phase 5b additions ─────────────────────────────────────────────────
  // Anchor: +chips when this die's face appears 2+ times in scoringFaces
  // (a soft "part of a combo" detector — fires on Pair / Two Pair /
  // Three of a Kind etc).
  pairedFaceChips?: number;
  // Keystone: ×mult when this die's face is the strict max of scoringFaces.
  keystoneMult?: number;
  // Astrolabe: +chips per combo level on the PLAYED combo. Reads
  // run.comboLevels[combo.id] via StepCtx.comboLevelOnPlayed.
  chipsPerComboLevel?: number;
  // Pressure: +chips per remaining hand this round (handsLeft).
  chipsPerHandLeft?: number;
  // Risk: face-conditional bonus on 6 AND penalty on 1.
  riskHighMult?: number;   // applies on face 6
  riskLowMult?: number;    // negative magnitude applied on face 1
  // Singularity: ×mult that only fires at or above `singularityAnte`.
  singularityAnte?: number;
  singularityMult?: number;
  // Refinery: +shards when this die scores in one of `refineryComboIds`.
  refineryComboIds?: string[];
  refineryShards?: number;
  // ─── Phase 5d additions ─────────────────────────────────────────────────
  // Polarize: ×mult when 3 mods are attached to this die (mod-density payoff).
  polarizeMult?: number;
  polarizeMinSlots?: number;
  // Telescope: ×mult when this die is the FIRST scoring die AND the played
  // combo has at least one galaxy level. Pays off Galaxy investment on the
  // opening die of every hand.
  telescopeMult?: number;
  // Engraved: utility flag — protects the OWN die's Brittle (and other
  // loseOnBust mods) from the bust-cleanup pass in transitions.ts.
  // Has no scoring contribution.
  engraved?: boolean;
  visual?: ModVisual;
};

export const MODS: ModDef[] = [
  {
    id: 'amplify', name: 'Amplify', icon: '⬆',
    desc: '+2 chips per scoring die', scoreBonus: 2, rarity: 'common',
    visual: { materialKey: 'amplify', accentColor: '#f5c451', triggerFx: 'pulse' },
  },
  {
    id: 'sharpened', name: 'Sharpened', icon: '▲',
    desc: '+1 mult per scoring die', multBonus: 1, rarity: 'common',
    visual: { materialKey: 'sharpened', accentColor: '#a4d4ff', triggerFx: 'pulse' },
  },
  {
    id: 'gilded', name: 'Gilded', icon: '◆',
    desc: '+1 shard on score', shardsBonus: 1, rarity: 'common',
    visual: { materialKey: 'gilded', accentColor: '#f5c451', triggerFx: 'pulse' },
  },
  {
    id: 'loaded', name: 'Loaded', icon: '⚔',
    desc: '1s count as 6', faceRemap: { from: 1, to: 6 }, rarity: 'uncommon',
    visual: { materialKey: 'loaded', accentColor: '#c87a4a', geometricVariant: 'asymmetric', triggerFx: 'loaded' },
  },
  {
    id: 'snake_eyes', name: 'Snake Eyes', icon: '①',
    desc: '+2 mult if face is 1', snakeEyes: 2, rarity: 'common',
    visual: { materialKey: 'snake_eyes', accentColor: '#7be3ff', triggerFx: 'pulse' },
  },
  {
    id: 'high_roller', name: 'High Roller', icon: '🎯',
    desc: '+1 mult if face is 5 or 6', highFaceMult: 1, rarity: 'common',
    visual: { materialKey: 'high_roller', accentColor: '#ff7847', triggerFx: 'pulse' },
  },
  {
    id: 'backstop', name: 'Backstop', icon: '✦',
    desc: 'Scores at least 4', scoreMin: 4, rarity: 'uncommon',
    visual: { materialKey: 'backstop', accentColor: '#9bd0a8', geometricVariant: 'plated', triggerFx: 'backstop' },
  },
  {
    id: 'pip_charge', name: 'Pip Charge', icon: '⫶',
    desc: '+chips equal to face × 2 per scoring die', chipPerPip: 2, rarity: 'uncommon',
    visual: { materialKey: 'pip_charge', accentColor: '#ffd84a', geometricVariant: 'recessed', triggerFx: 'pipCharge' },
  },
  {
    id: 'even_keel', name: 'Even Keel', icon: '⚖',
    desc: '+2 mult if face is even (2/4/6)', evenFaceMult: 2, rarity: 'common',
    visual: { materialKey: 'even_keel', accentColor: '#c0c8d8', triggerFx: 'pulse' },
  },
  {
    id: 'mirror_pair', name: 'Mirror Pair', icon: '⚉',
    desc: '+3 mult per other die in hand sharing this face', pairBonus: 3, rarity: 'rare',
    visual: { materialKey: 'mirror_pair', accentColor: '#e0c8ff', triggerFx: 'pulse' },
  },
  {
    id: 'vanguard', name: 'Vanguard', icon: '◀',
    desc: '+5 chips if scored first',
    firstBonus: 5, rarity: 'common',
    visual: { materialKey: 'vanguard', accentColor: '#ff7847', triggerFx: 'pulse' },
  },
  {
    id: 'capstone', name: 'Capstone', icon: '▶',
    desc: '+10 chips if scored last',
    lastBonus: 10, rarity: 'common',
    visual: { materialKey: 'capstone', accentColor: '#5be8a4', triggerFx: 'pulse' },
  },
  {
    id: 'conduit', name: 'Conduit', icon: '⫸',
    desc: '+1 mult per die scored before this one',
    chainMult: 1, rarity: 'uncommon',
    visual: { materialKey: 'conduit', accentColor: '#bba8ff', triggerFx: 'pulse' },
  },
  {
    id: 'tithe', name: 'Tithe', icon: '⛁',
    desc: '+5 chips, +2 mult per scoring die. Costs 1 shard per scored die (skipped if 0).',
    titheChips: 5, titheMult: 2, rarity: 'rare',
    visual: { materialKey: 'tithe', accentColor: '#f5c451', triggerFx: 'pulse' },
  },
  {
    id: 'resonance', name: 'Resonance', icon: '♺',
    desc: 'The other mod on this die fires a second time (chips/mult only).',
    resonate: true, rarity: 'legendary',
    visual: { materialKey: 'resonance', accentColor: '#bba8ff', triggerFx: 'pulse' },
  },
  {
    id: 'crescendo', name: 'Crescendo', icon: '⫷',
    desc: '+1 mult per die scored after this one',
    chainMultPost: 1, rarity: 'uncommon',
    visual: { materialKey: 'crescendo', accentColor: '#5be8a4', triggerFx: 'pulse' },
  },
  {
    id: 'crown', name: 'Crown', icon: '♛',
    desc: 'If face is 6: ×1.5 mult on this die (multiplicative)',
    crownMult: 1.5, crownFace: 6, rarity: 'legendary',
    visual: { materialKey: 'crown', accentColor: '#ffd84a', triggerFx: 'pulse' },
  },
  {
    id: 'brittle', name: 'Brittle', icon: '☄',
    desc: '+5 mult per scoring die. Destroyed if the hand busts.',
    multBonus: 5, loseOnBust: true, rarity: 'rare',
    visual: { materialKey: 'brittle', accentColor: '#ff7847', triggerFx: 'pulse' },
  },
  {
    id: 'wildcard', name: 'Wildcard', icon: '✱',
    desc: 'Counts as any face for combo detection (chooses best).',
    wildcard: true, rarity: 'legendary',
    visual: { materialKey: 'wildcard', accentColor: '#e0c8ff', triggerFx: 'pulse' },
  },
  // ─── Phase 5b: combo / round / ante / galaxy aware mods ────────────────
  // Visuals reuse existing materialKeys so the renderer doesn't need new
  // assets — picked by feel (anchor uses backstop's vault feel, keystone
  // borrows crown's gold). New material/triggerFx work tracked separately.
  {
    id: 'anchor', name: 'Anchor', icon: '⚓',
    desc: '+15 chips when this die is part of a combo set.',
    pairedFaceChips: 15,
    visual: { materialKey: 'backstop', accentColor: '#88ddff', triggerFx: 'pulse' },
  },
  {
    id: 'keystone', name: 'Keystone', icon: '◆',
    desc: '×1.4 mult when this die has the highest face among scoring dice.',
    keystoneMult: 1.4,
    visual: { materialKey: 'crown', accentColor: '#ffd84a', triggerFx: 'pulse' },
  },
  {
    id: 'astrolabe', name: 'Astrolabe', icon: '✺',
    desc: '+3 chips per combo level on the played hand.',
    chipsPerComboLevel: 3,
    visual: { materialKey: 'sharpened', accentColor: '#cc88ff', triggerFx: 'pulse' },
  },
  {
    id: 'pressure', name: 'Pressure', icon: '⏲',
    desc: '+5 chips per remaining hand this round.',
    chipsPerHandLeft: 5,
    visual: { materialKey: 'amplify', accentColor: '#ff7847', triggerFx: 'pulse' },
  },
  {
    id: 'risk', name: 'Risk', icon: '⚡',
    desc: '+6 mult on face 6. -3 mult on face 1.',
    riskHighMult: 6, riskLowMult: 3,
    visual: { materialKey: 'high_roller', accentColor: '#ffd84a', triggerFx: 'pulse' },
  },
  {
    id: 'singularity', name: 'Singularity', icon: '●',
    desc: '×2 mult — but only on Ante 4 or higher.',
    singularityAnte: 4, singularityMult: 2,
    visual: { materialKey: 'crown', accentColor: '#cc88ff', triggerFx: 'pulse' },
  },
  {
    id: 'refinery', name: 'Refinery', icon: '◇',
    desc: '+1 shard when scored as part of Two Pair or Full House.',
    refineryComboIds: ['two_pair', 'full_house'], refineryShards: 1,
    visual: { materialKey: 'gilded', accentColor: '#f5c451', triggerFx: 'pulse' },
  },
  // Phase 5d — mod-density / first-die / utility mods.
  {
    id: 'polarize', name: 'Polarize', icon: '◐',
    desc: '×1.4 mult when 3 mods are attached to this die.',
    polarizeMult: 1.4, polarizeMinSlots: 3,
    visual: { materialKey: 'polarize', accentColor: '#bba8ff', triggerFx: 'pulse' },
  },
  {
    id: 'telescope', name: 'Telescope', icon: '⌖',
    desc: '×1.3 mult on the first scoring die when the combo has ≥1 galaxy level.',
    telescopeMult: 1.3,
    visual: { materialKey: 'telescope', accentColor: '#cc88ff', triggerFx: 'pulse' },
  },
  {
    id: 'engraved', name: 'Engraved', icon: '⌑',
    desc: 'This die\'s Brittle mods survive the bust cleanup.',
    engraved: true,
    visual: { materialKey: 'engraved', accentColor: '#a4d4ff', triggerFx: 'pulse' },
  },
];

export const MAX_MOD_SLOTS = 2;

export function lookupMod(id: string): ModDef | undefined {
  return MODS.find((m) => m.id === id);
}

/**
 * Resolve a DieMod-shaped object (typically `{ id, name, ... }`) to its full
 * `ModDef`. Prefers stable `id` lookup; falls back to case-insensitive name
 * match if `id` is absent or doesn't resolve. Used by `DieView` to look up
 * primary/secondary/tertiary mods consistently.
 */
export function resolveMod(
  m: { id?: ModId; name: string } | undefined,
): ModDef | undefined {
  if (!m) return undefined;
  return (m.id ? MODS.find((mm) => mm.id === m.id) : undefined)
    ?? MODS.find((mm) => mm.name.toLowerCase() === m.name.toLowerCase());
}

export type FaceRemapResult = {
  faces: number[];
  events: { dieIdx: number; modId: string; faceValue: number }[];
};

export function applyFaceRemaps(
  faces: number[],
  diceMods: string[][],
  lockOnes = false,
): FaceRemapResult {
  const events: { dieIdx: number; modId: string; faceValue: number }[] = [];
  const remapped = faces.map((face, i) => {
    const mods = diceMods[i] ?? [];
    let f = face;
    for (const id of mods) {
      const def = lookupMod(id);
      if (def?.faceRemap && f === def.faceRemap.from) {
        if (lockOnes && def.faceRemap.from === 1) continue;
        // Emit before transforming so faceValue is the pre-remap value.
        events.push({ dieIdx: i, modId: id, faceValue: f });
        f = def.faceRemap.to;
      }
    }
    // Backstop: raise sub-min faces. Emit only if a raise actually happens.
    const minModEntry = mods
      .map((id) => ({ id, def: lookupMod(id) }))
      .find((m) => m.def?.scoreMin != null);
    if (minModEntry?.def?.scoreMin != null && f < minModEntry.def.scoreMin) {
      events.push({ dieIdx: i, modId: minModEntry.id, faceValue: f });
      f = minModEntry.def.scoreMin;
    }
    return f;
  });
  return { faces: remapped, events };
}
