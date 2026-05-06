import { CATALYST_META, type CatalystMeta } from '../../data/catalysts';

// Legendary catalysts are gated by run-meta unlock conditions. Each
// legendary stores its unlock state in `meta.unlocks` under this prefix.
// Today only `legendary_all_band` exists; future legendaries follow suit.
export const LEGENDARY_UNLOCK_PREFIX = 'legendary_';

export function isLegendaryUnlocked(meta: CatalystMeta, unlocks: readonly string[]): boolean {
  if (meta.rarity !== 'legendary') return true;
  return unlocks.includes(`${LEGENDARY_UNLOCK_PREFIX}${meta.id}`);
}

type RarityWeights = { common: number; uncommon: number; rare: number; legendary: number };

// Per-ante drift. At Ante 1-2 the shop leans heavily common to teach
// archetypes; from Ante 3+ the rare/legendary bands open up. Hand-tuned
// against blind targets — see balance notes in the progression-systems plan.
export function rarityWeightsForAnte(ante: number): RarityWeights {
  if (ante >= 3) return { common: 0.40, uncommon: 0.36, rare: 0.20, legendary: 0.04 };
  return { common: 0.55, uncommon: 0.30, rare: 0.13, legendary: 0.02 };
}

// Pick a single rarity tier from the weighted distribution. Pure function;
// rng is a 0..1 supplier so this is fully reproducible in tests.
export function rollRarity(weights: RarityWeights, rng: () => number): keyof RarityWeights {
  const total = weights.common + weights.uncommon + weights.rare + weights.legendary;
  let roll = rng() * total;
  if ((roll -= weights.common) <= 0) return 'common';
  if ((roll -= weights.uncommon) <= 0) return 'uncommon';
  if ((roll -= weights.rare) <= 0) return 'rare';
  return 'legendary';
}

// Resolve a rarity into a catalyst id, with graceful fallback for empty
// pools (e.g. legendary tier rolled but nothing unlocked) — falls through
// rare → uncommon → common so the offer slot is always filled.
function pickFromRarity(
  rarity: keyof RarityWeights,
  unlocks: readonly string[],
  excluded: ReadonlySet<string>,
  rng: () => number,
): string | null {
  const order: (keyof RarityWeights)[] = ['legendary', 'rare', 'uncommon', 'common'];
  const startIdx = order.indexOf(rarity);
  // Walk down from the requested tier so falling through always yields
  // strictly weaker offers — never bumps the player into a higher tier.
  for (let i = startIdx; i < order.length; i++) {
    const tier = order[i]!;
    const pool = CATALYST_META.filter(
      (m) => m.rarity === tier && !excluded.has(m.id) && isLegendaryUnlocked(m, unlocks),
    );
    if (pool.length > 0) {
      return pool[Math.floor(rng() * pool.length)]!.id;
    }
  }
  return null;
}

// Draw N distinct catalyst ids using rarity weights for the given ante.
// `unlocks` is the player's meta.unlocks list (used to gate legendaries).
export function drawWeightedCatalysts(
  count: number,
  ante: number,
  unlocks: readonly string[],
  rng: () => number,
): string[] {
  const weights = rarityWeightsForAnte(ante);
  const out: string[] = [];
  const excluded = new Set<string>();
  for (let i = 0; i < count; i++) {
    const tier = rollRarity(weights, rng);
    const id = pickFromRarity(tier, unlocks, excluded, rng);
    if (!id) break;
    out.push(id);
    excluded.add(id);
  }
  return out;
}

// Re-exported for tests / handler imports.
export { CATALYST_META };
