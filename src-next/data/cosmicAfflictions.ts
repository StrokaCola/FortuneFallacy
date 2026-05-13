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
    // 2026-05-13: target-tax is the deliverable for this affliction in
    // the v1 lap pass. The "boss debuffs on all blinds" design is a
    // follow-up (requires a debuff layer that doesn't gate on isBoss).
    lapTrigger: 2,
    effect: { kind: 'target-tax', multiplier: 1.15 },
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
    // Currently mapped to target-tax; the "two voidstorms per blind"
    // design lands in a later pass (requires a multi-storm picker).
    lapTrigger: 4,
    effect: { kind: 'target-tax', multiplier: 1.25 },
  },
  {
    id: 'heat_death',
    name: 'Heat Death',
    flavor: 'The cosmos cools. Each blind cleared, the next steps deeper.',
    lapTrigger: 5,
    effect: { kind: 'compounding-tax', perBlindMul: 0.15 },
  },
];

export function lookupCosmicAffliction(id: string | null | undefined): CosmicAfflictionDef | undefined {
  if (!id) return undefined;
  return COSMIC_AFFLICTIONS.find((a) => a.id === id);
}

// Picks the active affliction for a given lap index. Returns the
// affliction with the highest lapTrigger <= lap, falling back to the
// lap-1 entry. Returns undefined when lap is 0 (normal run).
export function pickAfflictionForLap(lap: number): CosmicAfflictionDef | undefined {
  if (lap < 1) return undefined;
  const eligible = COSMIC_AFFLICTIONS.filter((a) => a.lapTrigger <= lap);
  if (eligible.length === 0) return undefined;
  // Highest trigger wins (escalation).
  eligible.sort((a, b) => b.lapTrigger - a.lapTrigger);
  return eligible[0];
}
