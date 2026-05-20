// Wave T Scoring Theater (2026-05-19) — `sourceType` + `sourceId` +
// optional `dieIdx` let the theater layer attribute each upgrade beat
// to a specific catalyst / mod / resonance / die so attribution UI
// (fly-to-counter floaters, running hand rail, member-pair light-up)
// can resolve the right anchor. Optional so the legacy code path (no
// `baseMult` set) still type-checks; new theater code reads them
// defensively.
export type BeatSourceType = 'catalyst' | 'mod' | 'resonance' | 'combo' | 'chain' | 'unknown';

// Wave T+1 (2026-05-19) — theatrical beat metadata. Every beat now
// carries an importance tier that consumers (FlyToCounter, audio
// router, catalyst pulse, BeatTracer) read to scale their visual /
// audio intensity. `triggerReason` is a human-readable explanation
// of WHY the beat fired (shown in floaters + breakdown). `targetId`
// names which scoreboard panel the contribution lands on so
// BeatTracer can draw a source→target arc. `retrigger` flags
// repeat-fires for distinct visual treatment.
export type BeatImportance = 'minor' | 'moderate' | 'major' | 'finale';
export type BeatTarget = 'pips' | 'mult' | 'score';

// Shared optional metadata fields. Beat type unions narrow further
// on top of this — kept here so a generic consumer can read importance
// without exhaustive switch on every kind.
export type BeatMeta = {
  importance?: BeatImportance;
  triggerReason?: string;
  targetId?: BeatTarget;
  retrigger?: boolean;
};

export type Beat =
  | ({ kind: 'cast-swell';    t: number; initialMult?: number } & BeatMeta)
  | ({ kind: 'die-tick';      t: number; dieIdx: number; face: number; chipDelta: number; runningTotal: number; pitchSemis: number } & BeatMeta)
  | ({ kind: 'combo-detect';  t: number; comboLabel: string; baseChips: number; baseMult: number } & BeatMeta)
  | ({ kind: 'combo-bonus';   t: number; comboLabel: string; chipDelta: number; runningTotal: number; sourceType?: BeatSourceType; sourceId?: string } & BeatMeta)
  | ({ kind: 'upgrade-chip';  t: number; label: string; chipDelta: number; runningTotal: number; sourceType?: BeatSourceType; sourceId?: string; dieIdx?: number } & BeatMeta)
  | ({ kind: 'upgrade-mult';  t: number; label: string; multDelta: number; currentMult: number; tint?: 'gold' | 'magenta'; sourceType?: BeatSourceType; sourceId?: string; dieIdx?: number } & BeatMeta)
  | ({ kind: 'mult-slam';     t: number; label: string; multiplier: number; pitchSemis: number; ampScale: number; tint?: 'gold' | 'magenta'; sourceType?: BeatSourceType; sourceId?: string } & BeatMeta)
  | ({ kind: 'cross-target';  t: number; runningTotal: number; target: number } & BeatMeta)
  | ({ kind: 'hold-breath';   t: number; durMs: number } & BeatMeta)
  | ({ kind: 'boom';          t: number; finalTotal: number; crossedTarget: boolean; megaRatio?: number } & BeatMeta)
  | ({ kind: 'bail';          t: number; runningTotal: number; target: number } & BeatMeta);

// Importance → 0-1 intensity scale. Consumers (animation duration,
// audio gain, floater size punch) read this for consistent scaling
// across the theater layer. Default 'minor' for any beat that didn't
// set an importance explicitly — keeps legacy code paths working.
export function beatIntensity(b: Beat | BeatMeta): number {
  switch (b.importance ?? 'minor') {
    case 'minor':    return 0.25;
    case 'moderate': return 0.55;
    case 'major':    return 0.85;
    case 'finale':   return 1.0;
  }
}

export function classifyUpgradeImportance(absDelta: number): BeatImportance {
  if (absDelta >= 200) return 'major';
  if (absDelta >= 40)  return 'moderate';
  return 'minor';
}

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
