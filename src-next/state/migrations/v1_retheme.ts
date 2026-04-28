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

export function migrateRetheme(saved: any): any {
  if (!saved || typeof saved !== 'object') return saved;
  const next = { ...saved };

  // run.oracles -> run.catalysts
  if (next.run && Array.isArray(next.run.oracles) && !Array.isArray(next.run.catalysts)) {
    next.run = {
      ...next.run,
      catalysts: next.run.oracles.map((id: string) => CATALYST_ID_MAP[id] ?? id),
    };
    delete next.run.oracles;
  }

  // run.vouchers — id remap (in place; new ids stay as-is)
  if (next.run && Array.isArray(next.run.vouchers)) {
    next.run = {
      ...next.run,
      vouchers: next.run.vouchers.map((id: string) => VOUCHER_ID_MAP[id] ?? id),
    };
  }

  // run.consumables — id remap
  if (next.run && Array.isArray(next.run.consumables)) {
    next.run = {
      ...next.run,
      consumables: next.run.consumables.map((id: string) => CONSUMABLE_ID_MAP[id] ?? id),
    };
  }

  // round.diceRunes -> round.diceMods
  if (next.round && Array.isArray(next.round.diceRunes) && !Array.isArray(next.round.diceMods)) {
    next.round = {
      ...next.round,
      diceMods: next.round.diceRunes.map((arr: string[]) =>
        arr.map((id) => MOD_ID_MAP[id] ?? id),
      ),
    };
    delete next.round.diceRunes;
  }

  // round.blindId — boss id remap (only if it matches a known old id)
  if (next.round && typeof next.round.blindId === 'string' && BOSS_ID_MAP[next.round.blindId]) {
    next.round = { ...next.round, blindId: BOSS_ID_MAP[next.round.blindId] };
  }

  return next;
}
