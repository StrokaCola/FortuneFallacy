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
  'echo',
  // 2026-05-11 scaling pack — die-level mods with per-instance stack counters.
  // Per-slot stack count lives in run.diceModStacks (parallel array to diceMods).
  'tally_mark',
  'cadence',
  'veteran',
  'glutton',
  'dormant',
  'ballast',
  'pyre_mark',
  // 2026-05-13 banish-face family — die literally pops up and re-tumbles
  // when it would settle on a banned face. See ModDef.banishFaces /
  // banishFaceResolver fields and core/phases/initSimulation.ts retry loop.
  'aversion',
  'anti_one_sigil',
  'restless_die',
  'wide_net',
  'high_tide',
  'mirror_banish',
  'pyre_pact',
  'three_banished',
  'voidlock',
] as const;

export type ModId = typeof MOD_IDS[number];

export type ModVisual = {
  materialKey: ModMaterialKey;
  accentColor: string;                                       // #rrggbb
  // 2026-05-11 Forge overhaul — variant union now mirrors GeometricVariant
  // in render/three/buildDie.ts. The d6 build path uses these to drive
  // body geometry (asymmetric/plated/recessed/crystalline/spiked), face
  // decals (etched), or attached decorations (haloed/gilded/pulsing).
  geometricVariant?:
    | 'asymmetric'
    | 'plated'
    | 'recessed'
    | 'crystalline'
    | 'etched'
    | 'orbital'
    | 'haloed'
    | 'haloed-dark'
    | 'haloed-theatrical'
    | 'spiked'
    | 'gilded'
    | 'pulsing'
    | 'pulsing-theatrical';
  triggerFx:
    | 'loaded'
    | 'pipCharge'
    | 'backstop'
    | 'pulse'
    // 2026-05-14 fifth pass — bespoke FX for the four mods whose
    // mechanics most justified a custom animation. See
    // `src-next/render/three/modFx/{crown,shatter,swirl,flashback}.ts`.
    | 'crown'
    | 'shatter'
    | 'swirl'
    | 'flashback'
    // 2026-05-14 sixth pass — chain / legendary / stack-accrual FX.
    // See `src-next/render/three/modFx/{conduit,crescendo,resonance,pyreMark,tallyMark}.ts`.
    | 'conduit'
    | 'crescendo'
    | 'resonance'
    | 'pyreMark'
    | 'tallyMark'
    // 2026-05-14 seventh pass — twin/cost/rhythm/appetite/awaken FX.
    | 'twinGlow'
    | 'shardClink'
    | 'rhythmStack'
    | 'appetite'
    | 'awaken';
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
  // Echo: marker — when this slot fires, it copies the prior NON-Echo
  // mod's chips/mult/multMul on this die. No-ops on the first slot.
  echo?: boolean;
  // ─── Phase 6 — per-instance scaling mods (2026-05-11) ───────────────────
  // These mods accumulate state per attachment in run.diceModStacks (parallel
  // to diceMods). applyDieModStep reads the current stack via StepCtx and
  // returns updated stacks alongside its chip/mult delta.
  //
  // Tally Mark — +1 chip per stack. +1 stack each time this die scores.
  tallyChipPerStack?: number;
  // Cadence — +1 mult per stack THIS BLIND ONLY. +1 stack each time this
  // die scores in the current blind. Stack resets on START_BLIND.
  cadenceMultPerStack?: number;
  cadencePerBlind?: boolean;
  // Veteran — +0.5 mult per blind survived (1 stack per blind cleared while
  // this mod is attached to this die). +1 stack on clearBlind.
  veteranMultPerStack?: number;
  // Glutton — when this die rolls a 6, +1 stack permanent. +N chips per stack.
  gluttonChipPerStack?: number;
  // Dormant — silent until N fires, then a free holo edition is granted.
  // Reads as +0 chips/mult until the awaken threshold; after, +X mult bonus.
  dormantAwakenAt?: number;
  dormantMultAfter?: number;
  // Ballast — +1 stack each time this die is locked when scoring. +N chips per stack.
  ballastChipPerStack?: number;
  // Pyre Mark — face 1 re-rolls (via the face-remap flow handled elsewhere)
  // AND grants +1 chip permanent. +N chips per stack.
  pyreChipPerStack?: number;
  // ─── Banish-face family (2026-05-13) ──────────────────────────────────
  // Banished faces: integers (or WILD sentinel -1) that this mod prevents
  // the die from landing on. When a die's roll picks one of these values,
  // the value is re-picked (initSimulation retry loop, cap 8). If the
  // banish list would empty the die's face universe, the ban is ignored
  // for that die (Eclipse [0,1] + Aversion → die rolls 0 deterministically;
  // attaching enough banishes to cover all faces falls back to unrestricted).
  banishFaces?: ReadonlyArray<number>;
  // Dynamic banish: when present, called PER-ROLL with the current run
  // state + die context to compute the banish set for this attachment.
  // Used by mods whose banish depends on the prior hand (Restless Die),
  // other dice's current rolls (Mirror Banish), or randomization at
  // blind start (Three Banished). When both `banishFaces` and
  // `banishFaceResolver` are present, results union.
  banishFaceResolver?: (input: BanishResolverInput) => ReadonlyArray<number>;
  // Banish-trigger payoff: when this mod's banish list fires (i.e. the
  // retry loop substituted a value on this die), grants +N chips and/or
  // +N mult on this die when it next scores. Lets the Anti-One Sigil
  // and Pyre Pact pay players for the re-tumble moment.
  banishTriggerChips?: number;
  banishTriggerMult?: number;
  // Pyre-Pact-style threshold: when the cumulative banish trigger count
  // this blind crosses `banishMilestone`, grant `banishMilestoneMult`
  // mult on the next hand played. Implemented in actions/handlers/roll.ts
  // SCORE_HAND.
  banishMilestone?: number;
  banishMilestoneMult?: number;
  visual?: ModVisual;
};

// Inputs available to a banishFaceResolver. Pure read shape — resolvers
// must not mutate. `prevHandFaces` is the per-die face values from the
// LAST scored hand of this blind (length matches dice count; 0 = not
// scored last hand). `currentDieFaces` is the values of OTHER dice
// already settled this roll (Mirror Banish reads this).
export type BanishResolverInput = {
  dieIdx: number;
  faceUniverse: ReadonlyArray<number>;
  prevHandFaces: ReadonlyArray<number>;
  currentDieFaces: ReadonlyArray<number>;
  // RNG for resolvers that bake their banish list at blind start
  // (Three Banished). Returns a value in [0, 1).
  rng: () => number;
};

export const MODS: ModDef[] = [
  {
    id: 'amplify', name: 'Amplify', icon: '⬆',
    desc: '+2 chips per scoring die', scoreBonus: 2, rarity: 'common',
    visual: { materialKey: 'amplify', accentColor: '#f5c451', triggerFx: 'pulse', geometricVariant: 'gilded' },
  },
  {
    id: 'sharpened', name: 'Sharpened', icon: '▲',
    desc: '+1 mult per scoring die', multBonus: 1, rarity: 'common',
    visual: { materialKey: 'sharpened', accentColor: '#a4d4ff', triggerFx: 'pulse', geometricVariant: 'crystalline' },
  },
  {
    id: 'gilded', name: 'Gilded', icon: '◆',
    desc: '+1 shard on score', shardsBonus: 1, rarity: 'common',
    visual: { materialKey: 'gilded', accentColor: '#f5c451', triggerFx: 'pulse', geometricVariant: 'gilded' },
  },
  {
    id: 'loaded', name: 'Loaded', icon: '⚔',
    desc: '1s count as 6', faceRemap: { from: 1, to: 6 }, rarity: 'uncommon',
    visual: { materialKey: 'loaded', accentColor: '#c87a4a', geometricVariant: 'asymmetric', triggerFx: 'loaded' },
  },
  {
    id: 'snake_eyes', name: 'Snake Eyes', icon: '①',
    desc: '+2 mult if face is 1', snakeEyes: 2, rarity: 'common',
    visual: { materialKey: 'snake_eyes', accentColor: '#7be3ff', triggerFx: 'pulse', geometricVariant: 'etched' },
  },
  {
    id: 'high_roller', name: 'High Roller', icon: '🎯',
    desc: '+1 mult if face is 5 or 6', highFaceMult: 1, rarity: 'common',
    visual: { materialKey: 'high_roller', accentColor: '#ff7847', triggerFx: 'pulse', geometricVariant: 'gilded' },
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
    visual: { materialKey: 'even_keel', accentColor: '#c0c8d8', triggerFx: 'pulse', geometricVariant: 'crystalline' },
  },
  {
    id: 'mirror_pair', name: 'Mirror Pair', icon: '⚉',
    desc: '+3 mult per other die in hand sharing this face', pairBonus: 3, rarity: 'rare',
    visual: { materialKey: 'mirror_pair', accentColor: '#e0c8ff', triggerFx: 'twinGlow', geometricVariant: 'orbital' },
  },
  {
    id: 'vanguard', name: 'Vanguard', icon: '◀',
    desc: '+5 chips if scored first',
    firstBonus: 5, rarity: 'common',
    visual: { materialKey: 'vanguard', accentColor: '#ff7847', triggerFx: 'pulse', geometricVariant: 'haloed' },
  },
  {
    id: 'capstone', name: 'Capstone', icon: '▶',
    desc: '+10 chips if scored last',
    lastBonus: 10, rarity: 'common',
    visual: { materialKey: 'capstone', accentColor: '#5be8a4', triggerFx: 'pulse', geometricVariant: 'plated' },
  },
  {
    id: 'conduit', name: 'Conduit', icon: '⫸',
    desc: '+1 mult per die scored before this one',
    chainMult: 1, rarity: 'uncommon',
    visual: { materialKey: 'conduit', accentColor: '#bba8ff', triggerFx: 'conduit', geometricVariant: 'orbital' },
  },
  {
    id: 'tithe', name: 'Tithe', icon: '⛁',
    desc: '+5 chips, +2 mult per scoring die. Costs 1 shard per scored die (skipped if 0).',
    titheChips: 5, titheMult: 2, rarity: 'rare',
    visual: { materialKey: 'tithe', accentColor: '#f5c451', triggerFx: 'shardClink', geometricVariant: 'gilded' },
  },
  {
    id: 'resonance', name: 'Resonance', icon: '♺',
    desc: 'The other mod on this die fires a second time (chips/mult only).',
    resonate: true, rarity: 'legendary',
    visual: { materialKey: 'resonance', accentColor: '#bba8ff', triggerFx: 'resonance', geometricVariant: 'pulsing-theatrical' },
  },
  {
    id: 'crescendo', name: 'Crescendo', icon: '⫷',
    desc: '+1 mult per die scored after this one',
    chainMultPost: 1, rarity: 'uncommon',
    visual: { materialKey: 'crescendo', accentColor: '#5be8a4', triggerFx: 'crescendo', geometricVariant: 'pulsing' },
  },
  {
    id: 'crown', name: 'Crown', icon: '♛',
    desc: 'If face is 6: ×1.5 mult on this die (multiplicative)',
    crownMult: 1.5, crownFace: 6, rarity: 'legendary',
    visual: { materialKey: 'crown', accentColor: '#ffd84a', triggerFx: 'crown', geometricVariant: 'haloed-theatrical' },
  },
  {
    id: 'brittle', name: 'Brittle', icon: '☄',
    desc: '+5 mult per scoring die. Destroyed if the hand busts.',
    multBonus: 5, loseOnBust: true, rarity: 'rare',
    visual: { materialKey: 'brittle', accentColor: '#ff7847', triggerFx: 'shatter', geometricVariant: 'spiked' },
  },
  {
    id: 'wildcard', name: 'Wildcard', icon: '✱',
    desc: 'Counts as any face for combo detection (chooses best).',
    wildcard: true, rarity: 'legendary',
    visual: { materialKey: 'wildcard', accentColor: '#e0c8ff', triggerFx: 'swirl', geometricVariant: 'etched' },
  },
  // ─── Phase 5b: combo / round / ante / galaxy aware mods ────────────────
  // Visuals reuse existing materialKeys so the renderer doesn't need new
  // assets — picked by feel (anchor uses backstop's vault feel, keystone
  // borrows crown's gold). New material/triggerFx work tracked separately.
  {
    id: 'anchor', name: 'Anchor', icon: '⚓',
    desc: '+15 chips when this die is part of a combo set.',
    pairedFaceChips: 15, rarity: 'uncommon',
    visual: { materialKey: 'anchor', accentColor: '#88ddff', triggerFx: 'pulse', geometricVariant: 'plated' },
  },
  {
    id: 'keystone', name: 'Keystone', icon: '◆',
    desc: '×1.4 mult when this die has the highest face among scoring dice.',
    keystoneMult: 1.4, rarity: 'rare',
    visual: { materialKey: 'keystone', accentColor: '#ffd84a', triggerFx: 'pulse', geometricVariant: 'crystalline' },
  },
  {
    id: 'astrolabe', name: 'Astrolabe', icon: '✺',
    desc: '+3 chips per combo level on the played hand.',
    chipsPerComboLevel: 3, rarity: 'uncommon',
    visual: { materialKey: 'astrolabe', accentColor: '#cc88ff', triggerFx: 'pulse', geometricVariant: 'etched' },
  },
  {
    id: 'pressure', name: 'Pressure', icon: '⏲',
    desc: '+5 chips per remaining hand this round.',
    chipsPerHandLeft: 5, rarity: 'common',
    visual: { materialKey: 'pressure', accentColor: '#ff7847', triggerFx: 'pulse', geometricVariant: 'spiked' },
  },
  {
    id: 'risk', name: 'Risk', icon: '⚡',
    desc: '+6 mult on face 6. -3 mult on face 1.',
    riskHighMult: 6, riskLowMult: 3, rarity: 'uncommon',
    visual: { materialKey: 'risk', accentColor: '#ffd84a', triggerFx: 'pulse', geometricVariant: 'spiked' },
  },
  {
    id: 'singularity', name: 'Singularity', icon: '●',
    desc: '×2 mult — but only on Ante 4 or higher.',
    singularityAnte: 4, singularityMult: 2, rarity: 'legendary',
    visual: { materialKey: 'singularity', accentColor: '#cc88ff', triggerFx: 'pulse', geometricVariant: 'haloed' },
  },
  {
    id: 'refinery', name: 'Refinery', icon: '◇',
    desc: '+1 shard when scored as part of Two Pair or Full House.',
    refineryComboIds: ['two_pair', 'full_house'], refineryShards: 1, rarity: 'uncommon',
    visual: { materialKey: 'refinery', accentColor: '#f5c451', triggerFx: 'pulse', geometricVariant: 'gilded' },
  },
  // Phase 5d — mod-density / first-die / utility mods.
  {
    id: 'polarize', name: 'Polarize', icon: '◐',
    desc: '×1.4 mult when 3 mods are attached to this die.',
    polarizeMult: 1.4, polarizeMinSlots: 3, rarity: 'rare',
    visual: { materialKey: 'polarize', accentColor: '#bba8ff', triggerFx: 'pulse', geometricVariant: 'haloed' },
  },
  {
    id: 'telescope', name: 'Telescope', icon: '⌖',
    desc: '×1.3 mult on the first scoring die when the combo has ≥1 galaxy level.',
    telescopeMult: 1.3, rarity: 'rare',
    // Telescope's "lens satellite" silhouette is rendered via the orbital variant.
    // The existing 2nd-mod orbital satellite handles the actual sphere; this
    // entry's variant marker is descriptive — buildDie reads it for any future
    // orbital-specific decorations and the player sees it as the lens reading.
    visual: { materialKey: 'telescope', accentColor: '#cc88ff', triggerFx: 'pulse', geometricVariant: 'orbital' },
  },
  {
    id: 'engraved', name: 'Engraved', icon: '⌑',
    desc: 'This die\'s Brittle mods survive the bust cleanup.',
    engraved: true, rarity: 'uncommon',
    visual: { materialKey: 'engraved', accentColor: '#a4d4ff', triggerFx: 'pulse', geometricVariant: 'etched' },
  },
  {
    id: 'echo', name: 'Echo', icon: '⤳',
    desc: 'Repeats the previous mod\'s effect on this die.',
    echo: true, rarity: 'legendary',
    visual: { materialKey: 'echo', accentColor: '#88ddff', triggerFx: 'flashback', geometricVariant: 'pulsing-theatrical' },
  },
  // ─── Scaling die-mods (2026-05-11) ────────────────────────────────────
  // Each has a per-instance counter (run.diceModStacks[dieIdx][slotIdx]).
  // The counter is surfaced in DieView's mod tooltip + as a small "+N" badge
  // beside the icon (see app/visual/upgradeKindFrames if you wire the
  // badge there). Counters reset only on bust (matches existing scaling
  // catalyst semantics) — survive across blinds and re-attachments to the
  // same die.
  {
    id: 'tally_mark', name: 'Tally Mark', icon: '|',
    desc: '+1 chip per time this die has ever scored.',
    tallyChipPerStack: 1, rarity: 'common',
    visual: { materialKey: 'tally_mark', accentColor: '#88ddff', triggerFx: 'tallyMark', geometricVariant: 'etched' },
  },
  {
    id: 'cadence', name: 'Cadence', icon: '♪',
    desc: '+1 mult per time this die has scored in the current blind. Resets between blinds.',
    cadenceMultPerStack: 1, cadencePerBlind: true, rarity: 'uncommon',
    visual: { materialKey: 'cadence', accentColor: '#5be8a4', triggerFx: 'rhythmStack', geometricVariant: 'pulsing' },
  },
  {
    id: 'veteran', name: 'Veteran', icon: '⚔',
    desc: '+0.5 mult per blind survived while attached.',
    veteranMultPerStack: 0.5, rarity: 'uncommon',
    visual: { materialKey: 'veteran', accentColor: '#bba8ff', triggerFx: 'pulse', geometricVariant: 'gilded' },
  },
  {
    id: 'glutton', name: 'Glutton', icon: '◉',
    desc: 'When this die rolls a 6: +1 stack. +3 chips per stack.',
    gluttonChipPerStack: 3, rarity: 'uncommon',
    visual: { materialKey: 'glutton', accentColor: '#ff7847', triggerFx: 'appetite', geometricVariant: 'spiked' },
  },
  {
    id: 'dormant', name: 'Dormant', icon: '◌',
    desc: 'Silent until this die scores 10 times. Then +20 mult permanently.',
    dormantAwakenAt: 10, dormantMultAfter: 20, rarity: 'rare',
    // Dormant ships with NO variant by default; once the die has accrued
    // 10 stacks (awakening complete) the DieView upgrades it to 'haloed-
    // theatrical' so the awakening reads as a visual unlock. See DieView.
    visual: { materialKey: 'dormant', accentColor: '#a080c0', triggerFx: 'awaken' },
  },
  {
    id: 'ballast', name: 'Ballast', icon: '⚓',
    desc: '+5 chips per time this die was locked when scoring.',
    ballastChipPerStack: 5, rarity: 'common',
    visual: { materialKey: 'ballast', accentColor: '#88ddff', triggerFx: 'pulse', geometricVariant: 'plated' },
  },
  {
    id: 'pyre_mark', name: 'Pyre Mark', icon: '🔥',
    desc: 'When this die rolls a 1: +1 stack. +2 chips per stack.',
    pyreChipPerStack: 2, rarity: 'common',
    visual: { materialKey: 'pyre_mark', accentColor: '#ff7847', triggerFx: 'pyreMark', geometricVariant: 'etched' },
  },
  // ─── Banish-face family (2026-05-13) ────────────────────────────────────
  // A die wearing one of these mods literally pops up and re-tumbles when
  // it would settle on a banned face. Mechanically: the roll's predetermined
  // value is re-picked in initSimulation until it falls outside the banish
  // set, capped at 8 retries (Eclipse degenerate guard). Visuals layered in
  // Dice3D via onDieBanishTriggered.
  //
  // 8 ship across all four rarities; reserve pool documented in the plan.
  {
    id: 'aversion', name: 'Aversion', icon: '✥',
    desc: 'This die cannot land on face 1. It pops up and re-tumbles.',
    banishFaces: [1], rarity: 'common',
    visual: { materialKey: 'aversion', accentColor: '#a4d4ff', triggerFx: 'pulse', geometricVariant: 'etched' },
  },
  {
    id: 'anti_one_sigil', name: 'Anti-One Sigil', icon: '✦',
    desc: 'This die cannot land on face 1. +2 chips on this die when the banish fires.',
    banishFaces: [1], banishTriggerChips: 2, rarity: 'common',
    visual: { materialKey: 'anti_one_sigil', accentColor: '#7be3ff', triggerFx: 'pulse', geometricVariant: 'crystalline' },
  },
  {
    id: 'restless_die', name: 'Restless Die', icon: '↻',
    desc: 'This die cannot land on the same face it scored last hand.',
    rarity: 'common',
    banishFaceResolver: ({ dieIdx, prevHandFaces }) => {
      const f = prevHandFaces[dieIdx];
      return typeof f === 'number' && f > 0 ? [f] : [];
    },
    visual: { materialKey: 'restless_die', accentColor: '#cc88ff', triggerFx: 'pulse', geometricVariant: 'pulsing' },
  },
  {
    id: 'wide_net', name: 'Wide Net', icon: '⊞',
    desc: 'This die cannot land on faces 1 or 2. Re-tumbles until midrange or higher.',
    banishFaces: [1, 2], rarity: 'uncommon',
    visual: { materialKey: 'wide_net', accentColor: '#5be8a4', triggerFx: 'pulse', geometricVariant: 'plated' },
  },
  {
    id: 'high_tide', name: 'High Tide', icon: '≈',
    desc: 'This die cannot land on the extremes (faces 1 or 6).',
    banishFaces: [1, 6], rarity: 'uncommon',
    visual: { materialKey: 'high_tide', accentColor: '#88ddff', triggerFx: 'pulse', geometricVariant: 'orbital' },
  },
  {
    id: 'mirror_banish', name: 'Mirror Banish', icon: '◇',
    desc: 'This die cannot land on a face another scoring die already shows this hand.',
    rarity: 'uncommon',
    banishFaceResolver: ({ dieIdx, currentDieFaces }) => {
      const others: number[] = [];
      for (let i = 0; i < currentDieFaces.length; i++) {
        if (i === dieIdx) continue;
        const f = currentDieFaces[i];
        if (typeof f === 'number' && f > 0) others.push(f);
      }
      return others;
    },
    visual: { materialKey: 'mirror_banish', accentColor: '#e0c8ff', triggerFx: 'pulse', geometricVariant: 'recessed' },
  },
  {
    // Pyre Pact's banish-trigger milestone reward (+20 mult next hand
    // after 3 banishes fire this blind) is structurally authored via
    // `banishMilestone` / `banishMilestoneMult` but the upgrades-phase
    // hook that READS the threshold isn't wired yet — tracked as the
    // first banish-family follow-up. Today Pyre Pact behaves as a
    // pure rare banish mod with thematic intent for the reward;
    // shipping the data fields now keeps the storyline in the codex.
    id: 'pyre_pact', name: 'Pyre Pact', icon: '☄',
    desc: 'This die cannot land on face 1.',
    banishFaces: [1], banishMilestone: 3, banishMilestoneMult: 20, rarity: 'rare',
    visual: { materialKey: 'pyre_pact', accentColor: '#ff7847', triggerFx: 'pulse', geometricVariant: 'spiked' },
  },
  {
    id: 'three_banished', name: 'Three Banished', icon: '☰',
    desc: 'At blind start, three random faces are banished from this die.',
    rarity: 'rare',
    banishFaceResolver: ({ faceUniverse, rng }) => {
      // Sample 3 distinct faces from the die's universe, leaving at least
      // one face available so the initSimulation degenerate guard
      // doesn't have to bail. Drawn once per blind via the rng input,
      // which is seeded from (run.seed ^ goalIdx ^ dieIdx) at blind start.
      const pool = [...faceUniverse];
      const picks: number[] = [];
      const sampleCount = Math.min(3, Math.max(0, pool.length - 1));
      for (let i = 0; i < sampleCount; i++) {
        const idx = Math.floor(rng() * pool.length);
        picks.push(pool[idx]!);
        pool.splice(idx, 1);
      }
      return picks;
    },
    visual: { materialKey: 'three_banished', accentColor: '#bba8ff', triggerFx: 'pulse', geometricVariant: 'asymmetric' },
  },
  {
    id: 'voidlock', name: 'Voidlock', icon: '⌬',
    desc: 'This die can ONLY land on the highest face in its universe.',
    rarity: 'legendary',
    banishFaceResolver: ({ faceUniverse }) => {
      // Banish everything except the maximum face. Pins the die at max
      // value (face 6 on d6, face 12 on d12, etc.). Cap-N retry guard
      // in initSimulation handles the unlikely loop budget overflow.
      if (faceUniverse.length === 0) return [];
      const max = Math.max(...faceUniverse);
      return faceUniverse.filter((f) => f !== max);
    },
    visual: { materialKey: 'voidlock', accentColor: '#ffd84a', triggerFx: 'pulse', geometricVariant: 'haloed-theatrical' },
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
