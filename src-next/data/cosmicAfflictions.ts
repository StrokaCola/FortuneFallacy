// Cosmic Afflictions (Pillar D) — one is applied at the start of each
// endless-mode lap. Different from Voidstorms in two ways:
//
//   1. They persist for the *whole lap* (12 blinds), not per-blind.
//   2. They are *always negative* — the lap multiplier already rewards
//      the player; the affliction is the tax for getting that far.
//
// Each lap picks an affliction by its `lapTrigger` field: lap N >=
// trigger value is eligible. If multiple are eligible, the highest
// `lapTrigger` wins (so later laps escalate to harsher afflictions).
//
// Effect application:
//   - 'hands-delta':    handsMax += delta at every startBlind.
//   - 'voidstorm-force': pickVoidstorm yields a fixed storm id every
//                        blind (overrides the normal 25% gate).
//   - 'target-tax':      target multiplier × value at every startBlind.
//   - 'shop-tax':        shop offer prices × value (applied in shop
//                        pricing). Best-effort — gracefully degrades to
//                        no-op when the shop layer isn't wired for it.
//   - 'compounding-tax': target × (1 + compoundingMul × blinds-cleared-
//                        this-lap). Drives the lap-5+ "Heat Death" beat.

export type CosmicAfflictionEffect =
  | { kind: 'hands-delta'; delta: number }
  | { kind: 'voidstorm-force'; voidstormId: string }
  | { kind: 'target-tax'; multiplier: number }
  | { kind: 'shop-tax'; multiplier: number }
  | { kind: 'compounding-tax'; perBlindMul: number };

export type CosmicAfflictionDef = {
  id: string;
  name: string;
  flavor: string;
  // Lap that this affliction is eligible for. The picker chooses the
  // entry with the highest lapTrigger <= currentLap.
  lapTrigger: number;
  effect: CosmicAfflictionEffect;
};

export const COSMIC_AFFLICTIONS: CosmicAfflictionDef[] = [
  {
    id: 'gravity',
    name: 'Gravity',
    flavor: 'Every blind pulls harder. The storm never lifts.',
    lapTrigger: 1,
    effect: { kind: 'voidstorm-force', voidstormId: 'gravity_well' },
  },
  {
    id: 'echoing_void',
    name: 'Echoing Void',
    flavor: 'A second curse follows the first. Every blind a small darkness.',
    // 2026-05-19 rebalance: 1.15 → 1.20 in concert with the stacking-
    // afflictions change (afflictions now compound; floor lifts so the
    // step-up at each lap stays meaningful).
    lapTrigger: 2,
    effect: { kind: 'target-tax', multiplier: 1.20 },
  },
  {
    id: 'cold_constellation',
    name: 'Cold Constellation',
    flavor: 'The stars run thin. One hand stays behind.',
    lapTrigger: 3,
    effect: { kind: 'hands-delta', delta: -1 },
  },
  {
    id: 'shattered_sky',
    name: 'Shattered Sky',
    flavor: 'Every wind a storm. Every storm a wind.',
    // 2026-05-19 rebalance: 1.25 → 1.40. Stacks with echoing_void (lap-2+),
    // so the player feels a real step-up entering lap 4.
    lapTrigger: 4,
    effect: { kind: 'target-tax', multiplier: 1.40 },
  },
  {
    id: 'heat_death',
    name: 'Heat Death',
    flavor: 'The cosmos cools. Each blind cleared, the next steps deeper.',
    // 2026-05-19 rebalance: 0.15 → 0.20 per blind. With stacking now in,
    // event_horizon (lap-8+) sums into this for a true endless wall.
    lapTrigger: 5,
    effect: { kind: 'compounding-tax', perBlindMul: 0.20 },
  },
  // 2026-05-18 P4 long-tail laps. Pre-audit pool capped escalation at
  // lap 5 (heat_death repeated forever). The lap-6+ entries below give
  // veterans a real difficulty curve into deep endless. Each step
  // intensifies an existing levers, not new mechanics, so the pacing
  // stays predictable for the player.
  {
    id: 'gravity_well_redux',
    name: 'Gravity Redux',
    flavor: 'The pull doubles. Targets bend further with each blind.',
    // 2026-05-19 rebalance: 1.35 → 1.50.
    lapTrigger: 6,
    effect: { kind: 'target-tax', multiplier: 1.50 },
  },
  {
    id: 'frozen_choir',
    name: 'Frozen Choir',
    flavor: 'Two hands taken. The sky stops singing back.',
    lapTrigger: 7,
    effect: { kind: 'hands-delta', delta: -2 },
  },
  {
    id: 'event_horizon',
    name: 'Event Horizon',
    flavor: 'Past this point every step is heavier than the last.',
    // 2026-05-19 rebalance: 0.25 → 0.30 per blind. Sums with heat_death
    // (lap-5+, now 0.20), so a lap-8 player sees +0.50/blind compounding.
    lapTrigger: 8,
    effect: { kind: 'compounding-tax', perBlindMul: 0.30 },
  },
  // 2026-05-19 lap-9 extension. Pairs naturally with frozen_choir (lap-7
  // −2 hands) for a hand-and-target double-tax beat. Gives lap 9 its own
  // identity instead of just inheriting lap 8's wall.
  {
    id: 'void_tithe',
    name: 'Void Tithe',
    flavor: 'Every blind taxes hand and target both.',
    lapTrigger: 9,
    effect: { kind: 'target-tax', multiplier: 1.20 },
  },
  {
    id: 'final_dark',
    name: 'The Final Dark',
    flavor: 'Targets bend. Welcome to the deep cosmos.',
    // 2026-05-19 rebalance: 1.50 → 1.75.
    lapTrigger: 10,
    effect: { kind: 'target-tax', multiplier: 1.75 },
  },
  // 2026-05-19 long-tail laps 12 / 15. Top end of the affliction ladder
  // for veterans who've broken the lap-10 wall. Singularity is run-ending
  // by design — at +0.50/blind it doubles the target every 2 blinds.
  {
    id: 'oblivion_pull',
    name: 'Oblivion',
    flavor: 'Targets double. The pull is the law now.',
    lapTrigger: 12,
    effect: { kind: 'target-tax', multiplier: 2.00 },
  },
  {
    id: 'singularity',
    name: 'Singularity',
    flavor: 'Each blind cleared deepens the gravity well. Run while you can.',
    lapTrigger: 15,
    effect: { kind: 'compounding-tax', perBlindMul: 0.50 },
  },
];

export function lookupCosmicAffliction(id: string | null | undefined): CosmicAfflictionDef | undefined {
  if (!id) return undefined;
  return COSMIC_AFFLICTIONS.find((a) => a.id === id);
}

// Picks the SINGLE active affliction for a given lap index — the
// affliction with the highest lapTrigger <= lap. Kept for back-compat
// callers and UI that want "the headline affliction". The lap resolver
// in core/round/transitions.ts uses pickAfflictionsForLap (plural) so
// multiple eligible afflictions compound.
export function pickAfflictionForLap(lap: number): CosmicAfflictionDef | undefined {
  if (lap < 1) return undefined;
  const eligible = COSMIC_AFFLICTIONS.filter((a) => a.lapTrigger <= lap);
  if (eligible.length === 0) return undefined;
  eligible.sort((a, b) => b.lapTrigger - a.lapTrigger);
  return eligible[0];
}

// 2026-05-19 stacking afflictions — returns EVERY eligible affliction
// for the given lap (lapTrigger <= lap), sorted ascending by lapTrigger
// for stable resolution order. The startBlind resolver applies all of
// them: target-tax effects multiply, compounding-tax perBlindMul sums,
// hands-delta sums, voidstorm-force picks the lowest-trigger entry.
export function pickAfflictionsForLap(lap: number): CosmicAfflictionDef[] {
  if (lap < 1) return [];
  return COSMIC_AFFLICTIONS
    .filter((a) => a.lapTrigger <= lap)
    .sort((a, b) => a.lapTrigger - b.lapTrigger);
}
