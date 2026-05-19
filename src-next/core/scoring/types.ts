// Wave T Scoring Theater (2026-05-19) — `sourceType` + `sourceId` +
// optional `dieIdx` let the theater layer attribute each upgrade beat
// to a specific catalyst / mod / resonance / die so attribution UI
// (fly-to-counter floaters, running hand rail, member-pair light-up)
// can resolve the right anchor. Optional so the legacy code path (no
// `baseMult` set) still type-checks; new theater code reads them
// defensively.
export type BeatSourceType = 'catalyst' | 'mod' | 'resonance' | 'combo' | 'chain' | 'unknown';

export type Beat =
  | { kind: 'cast-swell';    t: number; initialMult?: number }
  | { kind: 'die-tick';      t: number; dieIdx: number; face: number; chipDelta: number; runningTotal: number; pitchSemis: number }
  | { kind: 'combo-bonus';   t: number; comboLabel: string; chipDelta: number; runningTotal: number; sourceType?: BeatSourceType; sourceId?: string }
  | { kind: 'upgrade-chip';  t: number; label: string; chipDelta: number; runningTotal: number; sourceType?: BeatSourceType; sourceId?: string; dieIdx?: number }
  | { kind: 'upgrade-mult';  t: number; label: string; multDelta: number; currentMult: number; tint?: 'gold' | 'magenta'; sourceType?: BeatSourceType; sourceId?: string; dieIdx?: number }
  | { kind: 'mult-slam';     t: number; label: string; multiplier: number; pitchSemis: number; ampScale: number; tint?: 'gold' | 'magenta'; sourceType?: BeatSourceType; sourceId?: string }
  | { kind: 'cross-target';  t: number; runningTotal: number; target: number }
  | { kind: 'hold-breath';   t: number; durMs: number }
  | { kind: 'boom';          t: number; finalTotal: number; crossedTarget: boolean; megaRatio?: number }
  | { kind: 'bail';          t: number; runningTotal: number; target: number };

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
  // When provided, activates the per-event upgrade-beat path. baseMult is the
  // combo's evaluation mult (before any upgrades); upgrades are the ordered
  // per-event chip+mult deltas from die mods and catalysts. mults then contains
  // only chain mult (not the full ctx.mult).
  baseMult?: number;
  upgrades?: {
    label: string;
    chipDelta: number;
    multDelta: number;
    tint?: 'gold' | 'magenta';
    // Wave T Theater (2026-05-19) — attribution metadata. Threaded
    // through to upgrade-chip/upgrade-mult beats so the theater layer
    // can fly the floater from the correct anchor (catalyst card,
    // resonance pair members, mod-bearing die).
    sourceType?: BeatSourceType;
    sourceId?: string;
    dieIdx?: number;
  }[];
};

export type SequenceCtx = {
  target: number;
  bail: boolean;
  reducedMotion: boolean;
};
