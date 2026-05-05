// Shard-economy harness — projects total run income under three player
// efficiency profiles and compares the new (flat + hands + interest) curve
// to the legacy overcharge formula it replaces.
//
// This is a balance-tuning artefact, not a behaviour test. The vitest
// `expect`s are smoke invariants only (totals are non-negative, new curve
// bounds the high end). The interesting output is the printed table —
// re-run with `--reporter=verbose` to see it.

import { describe, it, expect } from 'vitest';

const ANTE_BASE_TARGETS = [
  [300, 600, 1000],
  [600, 1200, 2200],
  [1100, 2200, 4000],
  [2000, 4000, 7000],
  [4000, 6000, 10000],
  [6000, 9000, 14000],
  [8000, 12000, 18000],
  [12000, 16000, 30000],
];
const BLIND_MULT = [1.0, 1.5, 2.0];
const ANTES = 8;
const BLINDS_PER_ANTE = 3;

type Profile = {
  name: string;
  // Hands left at clear: how many of the 3 hands are still available
  // after the player crosses the target.
  handsLeft: number;
  // Score-vs-target ratio at clear time, used by the legacy overcharge
  // formula. 1.0 = exactly hits target; 2.5 = scored 2.5× the target.
  scoreRatio: number;
};

const PROFILES: Profile[] = [
  { name: 'tight   (3 hands, just clears)',  handsLeft: 0, scoreRatio: 1.0 },
  { name: 'average (2 hands used)',           handsLeft: 1, scoreRatio: 1.4 },
  { name: 'lucky   (1-hand clear, big score)', handsLeft: 2, scoreRatio: 2.6 },
  { name: 'high-roll (1-hand, 4× target)',     handsLeft: 2, scoreRatio: 4.0 },
];

// Mirrors the LEGACY overcharge formula at `core/round/transitions.ts:62-66`
// (pre-PR). Kept here so we can compare what the player would have earned
// under the old curve.
function legacyReward(target: number, score: number, isBoss: boolean, _handsLeft: number): number {
  const base = isBoss ? 8 : 5;
  const overflow = score - target;
  let overcharge = 0;
  if (target > 0 && overflow >= Math.floor(target * 0.5)) {
    overcharge = Math.min(20, Math.floor(overflow / Math.max(50, target / 10)));
  }
  return base + overcharge;
}

// Mirrors the new clearBlind math at `core/round/transitions.ts` (post-PR).
function newReward(target: number, _score: number, isBoss: boolean, handsLeft: number, heldShards: number): number {
  void target;
  // Mirrors the constants in `core/round/transitions.ts:clearBlind`.
  const SHARDS_PER_REMAINING_HAND = 1;
  const SHARDS_INTEREST_DIVISOR = 5;
  const SHARDS_INTEREST_CAP = 3;
  const base = isBoss ? 8 : 5;
  const hands = Math.max(0, handsLeft) * SHARDS_PER_REMAINING_HAND;
  const interest = Math.min(SHARDS_INTEREST_CAP, Math.floor(Math.max(0, heldShards) / SHARDS_INTEREST_DIVISOR));
  return base + hands + interest;
}

type Sim = { perBlind: number[]; total: number; finalShards: number };

function simulate(profile: Profile, useNew: boolean, startShards = 0): Sim {
  // Conservative model of spending between blinds: assume the player drops
  // 4 shards per shop visit (one mid-tier offer). This keeps the held
  // balance in a realistic range so the interest tier reflects actual play.
  const SHOP_SPEND_PER_BLIND = 4;

  let held = startShards;
  const perBlind: number[] = [];
  let total = 0;
  for (let ante = 1; ante <= ANTES; ante++) {
    for (let b = 0; b < BLINDS_PER_ANTE; b++) {
      const isBoss = b === 2;
      const target = Math.round((ANTE_BASE_TARGETS[ante - 1]?.[b] ?? 0) * (BLIND_MULT[b] ?? 1));
      const score = Math.round(target * profile.scoreRatio);
      const reward = useNew
        ? newReward(target, score, isBoss, profile.handsLeft, held)
        : legacyReward(target, score, isBoss, profile.handsLeft);
      held += reward;
      total += reward;
      perBlind.push(reward);
      // Player spends some shards between blinds (modeled as flat drain).
      held = Math.max(0, held - SHOP_SPEND_PER_BLIND);
    }
  }
  return { perBlind, total, finalShards: held };
}

describe('shard economy balance', () => {
  it('reports run-total income under the new vs legacy curve', () => {
    const lines: string[] = [];
    lines.push('');
    lines.push('=== Shard income across an 8-ante run ===');
    lines.push('(constants: hands +1/each, interest 1 per 5, cap 3; spend 4/blind)');
    lines.push('');
    lines.push(`  ${'profile'.padEnd(34)}  ${'legacy'.padStart(7)}  ${'new'.padStart(7)}  delta`);
    lines.push('  ' + '-'.repeat(64));

    for (const p of PROFILES) {
      const legacy = simulate(p, false);
      const fresh = simulate(p, true);
      const delta = fresh.total - legacy.total;
      const sign = delta >= 0 ? '+' : '';
      lines.push(
        `  ${p.name.padEnd(34)}  ${String(legacy.total).padStart(7)}  ${String(fresh.total).padStart(7)}  ${sign}${delta}`,
      );
    }

    lines.push('');
    lines.push('Per-blind breakdown for the "average" profile under the new curve:');
    const avg = PROFILES.find((p) => p.name.startsWith('average'))!;
    const avgSim = simulate(avg, true);
    lines.push(`  ${avgSim.perBlind.join(', ')}`);
    lines.push(`  total earned: ${avgSim.total},  final balance: ${avgSim.finalShards}`);
    lines.push('');

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    // Smoke invariants — only catch regressions in the harness/formula itself.
    for (const p of PROFILES) {
      const legacy = simulate(p, false);
      const fresh = simulate(p, true);
      expect(legacy.total).toBeGreaterThan(0);
      expect(fresh.total).toBeGreaterThan(0);
    }
    // The high-roll profile under the new curve must NOT exceed the legacy
    // total — that's the whole point of throttling overcharge.
    const legacyHigh = simulate(PROFILES[3]!, false);
    const newHigh = simulate(PROFILES[3]!, true);
    expect(newHigh.total).toBeLessThan(legacyHigh.total);
  });
});
