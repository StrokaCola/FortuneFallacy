export type Beat =
  | { kind: 'cast-swell';   t: number }
  | { kind: 'die-tick';     t: number; dieIdx: number; face: number; chipDelta: number; runningTotal: number; pitchSemis: number }
  | { kind: 'combo-bonus';  t: number; comboLabel: string; chipDelta: number; runningTotal: number }
  | { kind: 'mult-slam';    t: number; label: string; multiplier: number; pitchSemis: number; ampScale: number; tint?: 'gold' | 'magenta' }
  | { kind: 'cross-target'; t: number; runningTotal: number; target: number }
  | { kind: 'hold-breath';  t: number; durMs: number }
  | { kind: 'boom';         t: number; finalTotal: number; crossedTarget: boolean }
  | { kind: 'bail';         t: number; runningTotal: number; target: number };

export type SequenceTier = 'short' | 'mid' | 'full';

export type ScoreSequence = {
  beats: Beat[];
  tier: SequenceTier;
  totalDurMs: number;
};

export type SequenceInput = {
  faces: number[];
  // Original die index (into round.dice) for each entry in `faces`. Lets
  // beat consumers (3D pop, particle floats) target the physical die that
  // actually scored instead of the held-array slot.
  dieIndices?: number[];
  comboLabel: string;
  comboBonus: number;
  mults: { label: string; value: number; tint?: 'gold' | 'magenta' }[];
  finalTotal: number;
};

export type SequenceCtx = {
  target: number;
  bail: boolean;
  reducedMotion: boolean;
};
