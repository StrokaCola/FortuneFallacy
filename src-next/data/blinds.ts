export type BlindDef = {
  index: number;
  name: string;
  targetMult: number;
  isBoss: boolean;
  skipReward: number;
};

export const BLIND_DEFS: BlindDef[] = [
  { index: 0, name: 'Small Blind', targetMult: 1.0, isBoss: false, skipReward: 3 },
  { index: 1, name: 'Big Blind',   targetMult: 1.5, isBoss: false, skipReward: 5 },
  { index: 2, name: 'Boss Blind',  targetMult: 2.0, isBoss: true,  skipReward: 0 },
];

export const ANTE_BASE_TARGETS: number[][] = [
  [300,   600,   1000 ],
  [1200,  2000,  3500 ],
  [4000,  6000,  10000],
  [12000, 16000, 30000],
];

export type BossBlind = {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  debuffs: string[];
};

export const BOSS_BLINDS: BossBlind[] = [
  { id: 'the_serpent', name: 'The Serpent', icon: '🐍', color: '#44bb66',
    description: 'All 1s stay 1s.', debuffs: ['no_rune_transforms_on_ones'] },
  { id: 'the_fool', name: 'The Fool', icon: '🃏', color: '#ffaa44',
    description: 'Hand size capped to 4.', debuffs: ['hand_size_cap_4'] },
  { id: 'the_tower', name: 'The Tower', icon: '🏰', color: '#aa6644',
    description: 'No rerolls.', debuffs: ['no_rerolls'] },
  { id: 'the_devil', name: 'The Devil', icon: '👹', color: '#cc2244',
    description: 'Locks unlock after roll.', debuffs: ['auto_unlock_after_roll'] },
  { id: 'the_high_priestess', name: 'The High Priestess', icon: '⚜', color: '#aa66ff',
    description: 'Oracles disabled.', debuffs: ['disable_oracles'] },
];

export function targetForBlind(ante: number, blindIndex: number): number {
  const row = ANTE_BASE_TARGETS[Math.min(ante, ANTE_BASE_TARGETS.length) - 1]!;
  const base = row[blindIndex]!;
  return Math.ceil(base * BLIND_DEFS[blindIndex]!.targetMult);
}

export function blindDefAt(idx: number): BlindDef {
  return BLIND_DEFS[idx]!;
}

export function pickBoss(rng: () => number): BossBlind {
  return BOSS_BLINDS[Math.floor(rng() * BOSS_BLINDS.length)]!;
}
