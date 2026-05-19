export type BlindDef = {
  index: number;
  name: string;
  targetMult: number;
  isBoss: boolean;
  skipReward: number;
};

export const BLIND_DEFS: BlindDef[] = [
  { index: 0, name: 'Lesser Trial',  targetMult: 1.0, isBoss: false, skipReward: 3 },
  { index: 1, name: 'Greater Trial', targetMult: 1.5, isBoss: false, skipReward: 5 },
  { index: 2, name: 'Final Trial',   targetMult: 2.0, isBoss: true,  skipReward: 0 },
];

// 2026-05-08 balance pass — sim showed 0% Spark A4 clear-rate at every
// constellation under the "scaling" build profile; even the "synergy"
// profile only cleared A4 at 1%. Targets dropped across the board to put
// Spark within reach of a competent build (~70% A4 clear target). Higher
// stakes (Ember+) untouched and grow harder via stake.targetMult.
// Iteration 3: A3/A4 dropped further. A4 Final Trial dropped most (was the
// single hardest gate in any run). The exponential targets-per-ante curve
// is preserved (~3× per ante) but starts from a softer floor.
export const ANTE_BASE_TARGETS: number[][] = [
  [250,   500,   800  ],
  [700,   1100,  1800 ],
  [1500,  2500,  4000 ],
  [4500,  6500,  9000 ],
];

export type SigilGroupClass =
  | 'orbit-main'
  | 'orbit-aux'
  | 'body-core'
  | 'satellite'
  | 'mark';

export type SigilGroup = {
  class: SigilGroupClass;
  paths: string[];
  strokeWidth?: number;   // default 1.5
  opacity?: number;       // default 1
  dashed?: boolean;       // applies stroke-dasharray "2 4"
  filled?: boolean;       // when true: fill=boss.color, stroke=none
};

// Boss Phase Escalation (Pillar B) — every boss gains a "Second Wind"
// trigger mid-blind. When fired, additional debuffs union into
// activeDebuffs() and a BossPhaseBanner toasts the new rule. The trigger
// is one of:
//   - 'hand-2'       — promotes after the FIRST scored hand (i.e. the
//                       second hand is about to be played)
//   - 'half-target'  — promotes the instant the running score crosses
//                       50% of target
//   - 'last-hand'    — promotes when only one hand remains
// Bosses that are already run-enders (Callisto) use the half-target
// gate paired with a SOFTENING phase-2 — see BOSS_BLINDS below.
export type BossPhaseTrigger = 'hand-2' | 'half-target' | 'last-hand';

export type BossSecondWind = {
  trigger: BossPhaseTrigger;
  debuffs: string[];
  flavor: string;
  // Some bosses (Callisto) get *softened* in phase 2 rather than harder —
  // their phase-2 step REMOVES one of the base debuffs. Listed by string
  // id to match the entries in `debuffs` above.
  removeDebuffs?: string[];
};

export type BossBlind = {
  id: string;
  name: string;
  iconGlyph: { viewBox: string; paths: string[] };
  color: string;
  description: string;
  debuffs: string[];
  sigil: { viewBox: string; groups: SigilGroup[] };
  // Per-boss flavor line shown during the BossReveal dread phase. Each
  // boss gets its own "the void approaches" — pluto's bones, ceres's
  // belt, etc. Falls back to a generic line if absent.
  cinematicFlavor?: string;
  // Boss Phase Escalation — fires mid-blind to add (or, for Callisto,
  // remove) debuffs and re-engage the player. Optional so saved state
  // from before this field shipped just behaves as the legacy one-phase
  // boss.
  secondWind?: BossSecondWind;
};

// Per-boss cinematic flavor — looked up by id from the BOSS_BLINDS
// table. Kept separate so the table itself stays narrow per row and
// the flavor strings are easy to author without scrolling through the
// SVG path data.
export const BOSS_CINEMATIC_FLAVOR: Record<string, string> = {
  pluto:    'the gambler\'s bones rattle',
  ceres:    'the belt closes around you',
  triton:   'the flyby begins',
  phobos:   'orbit decays · the chain rusts',
  callisto: 'the cratered silence opens',
  eris:     'the unmaker arrives first',
  charon:   'the ferryman holds your shards',
  sedna:    'the slot is wider than you remember',
};

export type TierSigilDef = {
  viewBox: string;
  groups: SigilGroup[];
  color: string;
};

export const TIER_SIGILS: TierSigilDef[] = [
  // Lesser Trial — waxing: lone body in a thin dashed orbit
  { color: '#9577ff', viewBox: '0 0 100 100', groups: [
    { class: 'orbit-aux', dashed: true, opacity: 0.5,
      paths: ['M 50 18 a 32 32 0 1 0 0.01 0'] },
    { class: 'body-core', filled: true,
      paths: ['M 45 50 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0'] },
    { class: 'mark', strokeWidth: 1.5, opacity: 0.8,
      paths: ['M 50 12 L 50 22'] },
  ]},
  // Greater Trial — zenith: body + satellite + orbit ring with cardinal marks
  { color: '#7be3ff', viewBox: '0 0 100 100', groups: [
    { class: 'orbit-main', paths: ['M 50 14 a 36 36 0 1 0 0.01 0'] },
    { class: 'body-core', paths: ['M 39 50 a 11 11 0 1 0 22 0 a 11 11 0 1 0 -22 0'] },
    { class: 'body-core', filled: true,
      paths: ['M 47 50 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0'] },
    { class: 'satellite', filled: true,
      paths: ['M 82 50 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0'] },
    { class: 'mark', opacity: 0.7, paths: [
      'M 50 8 L 50 14', 'M 50 86 L 50 92', 'M 8 50 L 14 50',
    ]},
  ]},
  // Final Trial — eclipse: outer ring with an inner pinpoint and crossed rays
  { color: '#e2334a', viewBox: '0 0 100 100', groups: [
    { class: 'body-core',
      paths: ['M 18 50 a 32 32 0 1 0 64 0 a 32 32 0 1 0 -64 0'] },
    { class: 'body-core', filled: true,
      paths: ['M 47 50 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0'] },
    { class: 'orbit-main', strokeWidth: 1.25, opacity: 0.85, paths: [
      'M 12 50 L 30 50', 'M 70 50 L 88 50',
      'M 50 12 L 50 30', 'M 50 70 L 50 88',
    ]},
    { class: 'mark', opacity: 0.6, paths: [
      'M 22 22 L 28 28', 'M 78 22 L 72 28',
      'M 22 78 L 28 72', 'M 78 78 L 72 72',
    ]},
  ]},
];

export const BOSS_BLINDS: BossBlind[] = [
  {
    id: 'pluto', name: 'Pluto', color: '#44bb66',
    description: 'Demoted. 1s refuse to transform.', debuffs: ['no_mod_transforms_on_ones'],
    secondWind: {
      // Pluto's phase-2: 1s remain inert AND only even faces count for
      // combo + scoring. Forces the player to either re-roll odds away
      // or accept a sparse hand. Hand cap removed so the player still
      // has enough dice to land an even-only hand at all.
      trigger: 'hand-2',
      debuffs: ['only_even_faces'],
      flavor: 'the gambler\'s bones sift — only the even count.',
    },
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 7 12 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0',
      'M 17 12 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
      'M 11 12 L 17 12',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-main', paths: ['M 32 50 L 68 50'] },
        { class: 'body-core',  paths: ['M 21 50 a 11 11 0 1 0 22 0 a 11 11 0 1 0 -22 0'] },
        { class: 'satellite',  paths: ['M 62 50 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0'] },
        { class: 'mark', opacity: 0.7, paths: [
          'M 64 44 L 60 40',
          'M 72 44 L 76 40',
          'M 64 56 L 60 60',
          'M 72 56 L 76 60',
        ]},
        { class: 'mark', filled: true, paths: ['M 29.5 50 a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0'] },
      ],
    },
  },
  {
    id: 'ceres', name: 'Ceres', color: '#ffaa44',
    description: 'Belt-bound. Hand capped at 4.', debuffs: ['hand_size_cap_4'],
    secondWind: {
      trigger: 'half-target',
      debuffs: ['consumables_locked'],
      flavor: 'the belt closes — your provisions are sealed.',
    },
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 12 12 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
      'M 21 12 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0',
      'M 12 3 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0',
      'M 1 12 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0',
      'M 12 21 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-aux', dashed: true, opacity: 0.5, paths: [
          'M 50 12 a 38 38 0 1 0 0 76 a 38 38 0 1 0 0 -76',
        ]},
        { class: 'body-core', filled: true, paths: ['M 45 50 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0'] },
        { class: 'satellite', filled: true, paths: ['M 85 50 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0'] },
        { class: 'mark', filled: true, paths: [
          'M 47 12 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
          'M 9 50 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
          'M 47 88 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
        ]},
      ],
    },
  },
  {
    id: 'triton', name: 'Triton', color: '#aa6644',
    description: 'Single flyby. No rerolls.', debuffs: ['no_rerolls'],
    secondWind: {
      // Triton is already harsh (no rerolls all blind). Half-target gate
      // means the player has to commit to a heavy hand 2 to feel this —
      // it telegraphs that the flyby is leaving.
      trigger: 'half-target',
      debuffs: ['hand_size_cap_4'],
      flavor: 'the flyby pulls away — fewer dice answer the call.',
    },
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 12 4 A 8 8 0 0 0 4 12',
      'M 4 12 A 8 8 0 0 0 12 20',
      'M 12 20 A 8 8 0 0 0 20 12',
      'M 20 12 L 17 9',
      'M 20 12 L 17 15',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-main', paths: [
          'M 50 14 A 36 36 0 0 0 14 50',
          'M 14 50 A 36 36 0 0 0 50 86',
          'M 50 86 A 36 36 0 0 0 86 50',
        ]},
        { class: 'body-core', paths: ['M 41 50 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0'] },
        { class: 'body-core', filled: true, paths: ['M 46.5 50 a 3.5 3.5 0 1 0 7 0 a 3.5 3.5 0 1 0 -7 0'] },
        { class: 'mark', strokeWidth: 2, paths: [
          'M 86 50 L 80 44',
          'M 86 50 L 80 56',
        ]},
      ],
    },
  },
  {
    id: 'phobos', name: 'Phobos', color: '#cc2244',
    description: 'Orbit decays. Locks release on roll.', debuffs: ['auto_unlock_after_roll'],
    secondWind: {
      // Phobos already invalidates locks (auto_unlock_after_roll).
      // Phase-2 doubles down on the timing pressure by sealing
      // consumables — no calibration to pin a face mid-blind, no
      // Spare Reroll bail-out. Lighter than mod_slots_capped_1 which
      // tested as too brutal at Spark.
      trigger: 'hand-2',
      debuffs: ['consumables_locked'],
      flavor: 'orbit fully decayed — your relics drift out of reach.',
    },
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 12 4 a 8 8 0 1 1 -0.01 0',
      'M 12 8 a 4 4 0 1 1 -0.01 0',
      'M 20 12 L 23 9',
      'M 20 12 L 23 15',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-main', opacity: 0.85, paths: [
          'M 50 18 a 32 32 0 1 1 -0.01 0',
          'M 50 24 a 26 26 0 1 1 -0.01 0',
          'M 50 30 a 20 20 0 1 1 -0.01 0',
        ]},
        { class: 'body-core', paths: ['M 39 50 a 11 11 0 1 0 22 0 a 11 11 0 1 0 -22 0'] },
        { class: 'body-core', filled: true, paths: ['M 47 50 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0'] },
        { class: 'mark', strokeWidth: 2, paths: [
          'M 82 50 L 88 44',
          'M 82 50 L 88 56',
        ]},
      ],
    },
  },
  {
    id: 'callisto', name: 'Callisto', color: '#aa66ff',
    description: 'Cratered silence. Catalysts inert.', debuffs: ['disable_catalysts'],
    // Phase 2 RELAXES Callisto. QA flagged Callisto as a run-ender for
    // catalyst-heavy builds (60% of buy power vaporized for a full
    // blind). The half-target gate gives the player a real path to
    // *earn* their catalysts back: hit 50% under silence, the void
    // remembers your voice. Triggered phase-2 REMOVES disable_catalysts
    // so the rest of the blind plays at full power.
    secondWind: {
      trigger: 'half-target',
      debuffs: [],
      removeDebuffs: ['disable_catalysts'],
      flavor: 'the cratered silence breaks — your voice carries again.',
    },
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 12 4 a 8 8 0 1 0 0.01 0',
      'M 8 9 a 1.5 1.5 0 1 0 3 0 a 1.5 1.5 0 1 0 -3 0',
      'M 14 13 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'body-core', paths: ['M 18 50 a 32 32 0 1 0 64 0 a 32 32 0 1 0 -64 0'] },
        { class: 'mark', opacity: 0.7, strokeWidth: 1, paths: [
          'M 33 40 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0',
          'M 59 36 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
          'M 50 62 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0',
          'M 31 62 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
          'M 65.5 58 a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0',
        ]},
        { class: 'mark', strokeWidth: 2, opacity: 0.85, paths: ['M 42 48 L 58 52'] },
      ],
    },
  },
  {
    id: 'eris', name: 'Eris', color: '#ff7847',
    // 2026-05-12 QA pass: Eris was a much weaker version of Callisto
    // (which disables catalysts for the whole blind). Extended to the
    // first two hands so the boss reads as a real speed-bump but not
    // a run-ender like Callisto.
    description: 'Catalysts inert on first 2 hands.', debuffs: ['disable_catalysts_first_2_hands'],
    secondWind: {
      // Eris's whole identity is "catalysts come back, harder fights
      // begin." Phase 2 re-engages with a freshly cinematic shape — the
      // base debuff already expires by hand 3, so phase 2 lands with a
      // *different* threat (mod slot squeeze) rather than re-running
      // the same trick.
      trigger: 'half-target',
      debuffs: ['mod_slots_capped_1'],
      flavor: 'the unmaker returns — marks crumble from the dice.',
    },
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 3 14 A 11 6 -25 1 0 21 10',
      'M 12 12 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-main', paths: ['M 50 14 A 38 22 -25 1 0 86 60'] },
        { class: 'orbit-aux', dashed: true, opacity: 0.4, paths: ['M 86 60 A 38 22 -25 0 0 50 14'] },
        { class: 'body-core', filled: true, paths: ['M 45 50 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0'] },
        { class: 'satellite', filled: true, paths: ['M 83.5 60 a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0'] },
        { class: 'mark', strokeWidth: 2, paths: [
          'M 46 10 L 54 18',
          'M 54 10 L 46 18',
        ]},
      ],
    },
  },
  {
    id: 'charon', name: 'Charon', color: '#8a8aaa',
    description: 'Ferryman\'s tariff. Consumables sealed in stasis.', debuffs: ['consumables_locked'],
    secondWind: {
      // Charon already locks consumables — phase-2 adds the
      // no-transforms-on-1s squeeze. Lyra players keep all 5 dice; the
      // pain shifts to mod synergy. Tested gentler than hand_size_cap_4
      // for Spark.
      trigger: 'hand-2',
      debuffs: ['no_mod_transforms_on_ones'],
      flavor: 'the ferryman silences your marks — 1s stay 1s.',
    },
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 4 16 L 20 16',
      'M 6 16 L 8 10',
      'M 18 16 L 16 10',
      'M 8 10 L 16 10',
      'M 12 6 a 1.5 1.5 0 1 0 3 0 a 1.5 1.5 0 1 0 -3 0',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        // Outer dashed orbit — the river the ferryman crosses.
        { class: 'orbit-aux', dashed: true, opacity: 0.45,
          paths: ['M 14 60 a 36 14 0 1 0 72 0 a 36 14 0 1 0 -72 0'] },
        // Body of the boat (a thin horizontal lozenge).
        { class: 'body-core',
          paths: ['M 30 60 L 70 60 L 64 66 L 36 66 Z'] },
        // Mast.
        { class: 'mark', strokeWidth: 2,
          paths: ['M 50 60 L 50 32'] },
        // Square sail.
        { class: 'mark', strokeWidth: 1.5, opacity: 0.85,
          paths: ['M 50 32 L 64 38 L 50 44 Z'] },
        // Two coins above (the toll).
        { class: 'satellite', filled: true,
          paths: ['M 36 22 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
                  'M 58 22 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0'] },
      ],
    },
  },
  {
    id: 'sedna', name: 'Sedna', color: '#4477cc',
    description: 'Mod slots capped at 1.', debuffs: ['mod_slots_capped_1'],
    secondWind: {
      // Sedna's identity is mod compression. Phase 2 deepens that with
      // the no-transform rule so even the surviving mods can't reshape
      // 1s. Triggers on last-hand so the player makes peace with their
      // squeezed loadout before this lands as the climax.
      trigger: 'last-hand',
      debuffs: ['no_mod_transforms_on_ones'],
      flavor: 'the slot pulls deeper — the dice forget their marks.',
    },
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 12 12 m -10 -2 a 10 4 -15 1 0 20 4 a 10 4 -15 1 0 -20 -4',
      'M 12 12 a 1.5 1.5 0 1 0 3 0 a 1.5 1.5 0 1 0 -3 0',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-main', paths: [
          'M 8 50 a 42 14 -15 1 0 84 0 a 42 14 -15 1 0 -84 0',
        ]},
        { class: 'body-core', filled: true, paths: ['M 46 50 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0'] },
        { class: 'satellite', filled: true, paths: ['M 84 40 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0'] },
        { class: 'mark', strokeWidth: 2.5, paths: ['M 20 50 L 80 50'] },
      ],
    },
  },
];

// 2026-05-19 Cosmic Lap rebalance — replaced the flat 2.25^lap curve with
// a compounding multiplier so each lap punishes meaningfully harder than
// the previous one. Endless players were outpacing the old curve by lap 4
// (scaling catalysts accumulate permanent stacks across laps).
//   lap=0 → 1× (legacy, normal-run target preserved exactly).
//   lap=1 ≈ 2.70×, lap=2 ≈ 8.25×, lap=3 ≈ 26.88×, lap=4 ≈ 89.06×,
//   lap=5 ≈ 292.97×, lap=6 ≈ 947×, lap=7 ≈ 3003×.
export function targetForBlind(ante: number, blindIndex: number, lap = 0): number {
  const row = ANTE_BASE_TARGETS[Math.min(ante, ANTE_BASE_TARGETS.length) - 1]!;
  const base = row[blindIndex]!;
  const lapMul = lap > 0 ? Math.pow(2.5, lap) * (1 + 0.08 * lap * lap) : 1;
  return Math.ceil(base * BLIND_DEFS[blindIndex]!.targetMult * lapMul);
}

export function blindDefAt(idx: number): BlindDef {
  return BLIND_DEFS[idx]!;
}

export function pickBoss(rng: () => number): BossBlind {
  return BOSS_BLINDS[Math.floor(rng() * BOSS_BLINDS.length)]!;
}
