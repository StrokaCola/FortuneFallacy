// One-shot retheme migrator: legacy oracles/runes/tarot ids -> catalysts/mods/planet-moon ids.
// Safe to delete after ~3 releases past v0.2.0 — by then any active save will have round-tripped through this on load.
const CATALYST_ID_MAP: Record<string, string> = {
  the_oracle: 'stratifier',
  prophet: 'six_bias',
  fools_fortune: 'twin_sample',
  silver_tongue: 'cold_hand',
  entropy_stone: 'entropy_index',
  // chaos_theory unchanged
};

const MOD_ID_MAP: Record<string, string> = {
  snake_cult: 'snake_eyes',
  blessed: 'backstop',
};

const VOUCHER_ID_MAP: Record<string, string> = {
  astral_plane: 'bench',
};

const CONSUMABLE_ID_MAP: Record<string, string> = {
  the_moon: 'pin_six',
  the_sun: 'pin_one',
  shard_strike: 'shard_drop',
  the_world: 'roll_token',
};

const BOSS_ID_MAP: Record<string, string> = {
  the_serpent: 'pluto',
  the_fool: 'ceres',
  the_tower: 'triton',
  the_devil: 'phobos',
  the_high_priestess: 'callisto',
};

export function migrateRetheme(saved: unknown): unknown {
  if (!saved || typeof saved !== 'object') return saved;
  const next = { ...(saved as Record<string, unknown>) };

  const run = next.run as Record<string, unknown> | undefined;

  // run.oracles -> run.catalysts
  if (run && Array.isArray(run.oracles) && !Array.isArray(run.catalysts)) {
    const updated: Record<string, unknown> = {
      ...run,
      catalysts: (run.oracles as string[]).map((id) => CATALYST_ID_MAP[id] ?? id),
    };
    delete updated.oracles;
    next.run = updated;
  }

  // run.vouchers — id remap (in place; new ids stay as-is)
  const run2 = next.run as Record<string, unknown> | undefined;
  if (run2 && Array.isArray(run2.vouchers)) {
    next.run = {
      ...run2,
      vouchers: (run2.vouchers as string[]).map((id) => VOUCHER_ID_MAP[id] ?? id),
    };
  }

  // run.consumables — id remap
  const run3 = next.run as Record<string, unknown> | undefined;
  if (run3 && Array.isArray(run3.consumables)) {
    next.run = {
      ...run3,
      consumables: (run3.consumables as string[]).map((id) => CONSUMABLE_ID_MAP[id] ?? id),
    };
  }

  const round = next.round as Record<string, unknown> | undefined;

  // round.diceRunes -> round.diceMods
  if (round && Array.isArray(round.diceRunes) && !Array.isArray(round.diceMods)) {
    const updated: Record<string, unknown> = {
      ...round,
      diceMods: (round.diceRunes as string[][]).map((arr) =>
        arr.map((id) => MOD_ID_MAP[id] ?? id),
      ),
    };
    delete updated.diceRunes;
    next.round = updated;
  }

  // round.blindId — boss id remap (only if it matches a known old id)
  const round2 = next.round as Record<string, unknown> | undefined;
  if (round2 && typeof round2.blindId === 'string' && BOSS_ID_MAP[round2.blindId]) {
    next.round = { ...round2, blindId: BOSS_ID_MAP[round2.blindId] };
  }

  // run.handsPlayed default
  const run5 = next.run as Record<string, unknown> | undefined;
  if (run5 && typeof run5.handsPlayed !== 'number') {
    next.run = { ...run5, handsPlayed: 0 };
  }

  // run.compoundingStacks default
  const run6 = next.run as Record<string, unknown> | undefined;
  if (run6 && typeof run6.compoundingStacks !== 'number') {
    next.run = { ...run6, compoundingStacks: 0 };
  }

  // round.shardSinkPrimedThisHand default
  const round3 = next.round as Record<string, unknown> | undefined;
  if (round3 && typeof round3.shardSinkPrimedThisHand !== 'boolean') {
    next.round = { ...round3, shardSinkPrimedThisHand: false };
  }

  return next;
}
