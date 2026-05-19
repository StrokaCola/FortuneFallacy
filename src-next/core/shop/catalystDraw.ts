import { CATALYST_META, type CatalystMeta, type CatalystArchetype } from '../../data/catalysts';

// Legendary catalysts are gated by run-meta unlock conditions. Each
// legendary stores its unlock state in `meta.unlocks` under this prefix.
// Today only `legendary_all_band` exists; future legendaries follow suit.
export const LEGENDARY_UNLOCK_PREFIX = 'legendary_';

export function isLegendaryUnlocked(meta: CatalystMeta, unlocks: readonly string[]): boolean {
  if (meta.rarity !== 'legendary') return true;
  return unlocks.includes(`${LEGENDARY_UNLOCK_PREFIX}${meta.id}`);
}

// 2026-05-16 unlock-content roadmap — non-legendary catalysts can also
// be gated behind player accomplishments. Each gated id stores its
// unlock flag in `meta.unlocks` under the `unlock:` prefix.
// See docs/unlock-gated-content-roadmap.md and the
// `checkRoadmapUnlocks` helper in core/round/transitions.ts.
export const UNLOCK_PREFIX = 'unlock:';
const ROADMAP_GATED_CATALYST_IDS: ReadonlySet<string> = new Set([
  'cosmic_compass', 'voidwalker', 'crown_of_skulls', 'the_patient',
  'salt_of_earth', 'stargazer', 'bloodied_coin', 'the_confessor',
  'hourglass', 'the_reckoning',
]);
export function isRoadmapCatalystUnlocked(catalystId: string, unlocks: readonly string[]): boolean {
  if (!ROADMAP_GATED_CATALYST_IDS.has(catalystId)) return true;
  return unlocks.includes(`${UNLOCK_PREFIX}${catalystId}`);
}

// 2026-05-19 mythic tier — each mythic is gated behind a per-id unlock
// in meta.unlocks under the `mythic_` prefix. The unlock conditions
// live in checkMythicUnlocks in core/round/transitions.ts.
export const MYTHIC_UNLOCK_PREFIX = 'mythic_';
export function isMythicUnlocked(meta: CatalystMeta, unlocks: readonly string[]): boolean {
  if (meta.rarity !== 'mythic') return true;
  return unlocks.includes(`${MYTHIC_UNLOCK_PREFIX}${meta.id}`);
}

type RarityWeights = {
  common: number;
  uncommon: number;
  rare: number;
  legendary: number;
  mythic: number;
};

// Per-ante drift. At Ante 1-2 the shop leans heavily common to teach
// archetypes; from Ante 3+ the rare/legendary bands open up. Mythic is
// only available from ante 3 onward and stays scarce — even at ante 4
// the rate is 4%, climbing to 8% in deep Cosmic Laps (+1% per lap,
// capped at +4%). Hand-tuned against blind targets — see balance notes
// in the progression-systems plan.
export function rarityWeightsForAnte(ante: number, lap = 0): RarityWeights {
  if (ante >= 4) {
    const mythicBoost = Math.min(0.04, Math.max(0, lap) * 0.01);
    return { common: 0.38, uncommon: 0.34, rare: 0.20, legendary: 0.04, mythic: 0.04 + mythicBoost };
  }
  if (ante === 3) {
    const mythicBoost = Math.min(0.04, Math.max(0, lap) * 0.01);
    return { common: 0.40, uncommon: 0.36, rare: 0.20, legendary: 0.02, mythic: 0.02 + mythicBoost };
  }
  return { common: 0.55, uncommon: 0.30, rare: 0.13, legendary: 0.02, mythic: 0 };
}

// Pick a single rarity tier from the weighted distribution. Pure function;
// rng is a 0..1 supplier so this is fully reproducible in tests.
export function rollRarity(weights: RarityWeights, rng: () => number): keyof RarityWeights {
  const total = weights.common + weights.uncommon + weights.rare + weights.legendary + weights.mythic;
  let roll = rng() * total;
  if ((roll -= weights.common) <= 0) return 'common';
  if ((roll -= weights.uncommon) <= 0) return 'uncommon';
  if ((roll -= weights.rare) <= 0) return 'rare';
  if ((roll -= weights.legendary) <= 0) return 'legendary';
  return 'mythic';
}

// Probability that a draw biases toward the player's existing archetype set
// when archetype context is available. 70% archetype-aware / 30% uniform keeps
// variety while delivering coherent starter kits — see audit follow-up B5.
const ARCHETYPE_BIAS_RATE = 0.7;

// Resolve a rarity into a catalyst id, with graceful fallback for empty
// pools (e.g. legendary tier rolled but nothing unlocked) — falls through
// rare → uncommon → common so the offer slot is always filled.
//
// `preferredArchetypes` (optional) tilts selection within the rarity pool
// toward catalysts whose archetype matches one in the set. Bias only fires
// 70% of the time so the player still sees variety. Empty intersection or
// missing archetypes fall back to uniform pool selection.
// Face-gated catalysts (2026-05-13 dead-pick audit). When the constellation's
// face universe lacks ALL the required faces, the catalyst is unreachable —
// no scoring die can ever match its trigger. Filtered out of the offer pool
// in the same shape `gateModsByFaceUniverse` uses for face-keyed mods.
//
//   iron_six       — +chips on face 6 → dead on Eclipse [0,1] + Ophiuchus
//                     [1-5, WILD]. WILD substitutes up to 5; never 6.
//   solar_flare    — needs 3+ scoring 5/6 → dead on Eclipse, weak elsewhere
//                     but lets the player still earn it on Ophiuchus via 5s.
//   high_roller    — scoring 5 or 6 grants bonus → dead on Eclipse only.
//
// six_bias is NOT gated: it transforms face 1 into face 6 on reroll, so it
// MAKES face 6 exist where it didn't, which is a genuine Eclipse synergy.
const FACE_GATED_CATALYSTS: Record<string, ReadonlyArray<number>> = {
  iron_six: [6],
  solar_flare: [5, 6],
  high_roller: [5, 6],
};

function pickFromRarity(
  rarity: keyof RarityWeights,
  unlocks: readonly string[],
  excluded: ReadonlySet<string>,
  rng: () => number,
  preferredArchetypes?: ReadonlySet<CatalystArchetype>,
  constellationId?: string,
  faceUniverse?: ReadonlySet<number>,
): string | null {
  // 2026-05-19 — mythic sits at the head of the fallthrough chain so an
  // unlucky roll with no unlocked mythics drops cleanly to legendary, then
  // rare, etc. Empty pools cascade until a non-empty tier is found.
  const order: (keyof RarityWeights)[] = ['mythic', 'legendary', 'rare', 'uncommon', 'common'];
  const startIdx = order.indexOf(rarity);
  for (let i = startIdx; i < order.length; i++) {
    const tier = order[i]!;
    const pool = CATALYST_META.filter(
      (m) =>
        m.rarity === tier &&
        !excluded.has(m.id) &&
        isLegendaryUnlocked(m, unlocks) &&
        // 2026-05-19 — mythics need their per-id unlock flag; locked
        // mythics fall through to legendary via the loop above.
        isMythicUnlocked(m, unlocks) &&
        // 2026-05-16 — roadmap-gated catalysts (Cosmic Compass etc) only
        // appear in the shop once the player has earned the matching
        // unlock flag. Non-roadmap catalysts pass through unchanged.
        isRoadmapCatalystUnlocked(m.id, unlocks) &&
        // Constellation-locked catalysts only spawn when the active
        // constellation matches their requirement. Catalysts without a
        // requirement are universally available.
        (m.requiresConstellation == null || m.requiresConstellation === constellationId) &&
        // Face-gate: drop catalysts whose trigger face never appears in
        // the active universe. No-op when faceUniverse is undefined
        // (preserves the legacy call shape).
        (faceUniverse == null ||
          !(m.id in FACE_GATED_CATALYSTS) ||
          FACE_GATED_CATALYSTS[m.id]!.some((f) => faceUniverse.has(f))),
    );
    if (pool.length === 0) continue;

    if (preferredArchetypes && preferredArchetypes.size > 0 && rng() < ARCHETYPE_BIAS_RATE) {
      const matching = pool.filter((m) => m.archetype && preferredArchetypes.has(m.archetype));
      if (matching.length > 0) {
        return matching[Math.floor(rng() * matching.length)]!.id;
      }
    }
    return pool[Math.floor(rng() * pool.length)]!.id;
  }
  return null;
}

// Build the set of archetypes already represented in the player's owned
// catalysts plus the offers we've already drawn this shop visit. Used to bias
// subsequent draws toward synergistic picks.
function archetypesOf(ids: readonly string[]): Set<CatalystArchetype> {
  const out = new Set<CatalystArchetype>();
  for (const id of ids) {
    const meta = CATALYST_META.find((m) => m.id === id);
    if (meta?.archetype) out.add(meta.archetype);
  }
  return out;
}

// Draw N distinct catalyst ids using rarity weights for the given ante.
// `unlocks` is the player's meta.unlocks list (used to gate legendaries).
// `ownedCatalysts` (optional) seeds the archetype-coherence bias — when the
// player already has catalysts, the shop tilts toward ones that play with
// them. At Ante 1 with empty owned, the first offer seeds the set so the
// remaining offers in the same shop visit still cohere.
export function drawWeightedCatalysts(
  count: number,
  ante: number,
  unlocks: readonly string[],
  rng: () => number,
  ownedCatalysts: readonly string[] = [],
  constellationId?: string,
  // 2026-05-13: optional face universe (e.g. {0,1} for Eclipse) used to
  // filter face-gated catalysts out of the pool when their trigger face
  // can never appear. Caller computes from getComboCtx(state).faceUniverse.
  // Undefined falls back to the legacy "no face gate" behaviour for tests.
  faceUniverse?: ReadonlySet<number>,
  // 2026-05-19: Cosmic Lap depth — mildly boosts mythic-tier weight in
  // endless mode to reward continued play. Pass 0 (or omit) for normal runs.
  lap: number = 0,
): string[] {
  const weights = rarityWeightsForAnte(ante, lap);
  const out: string[] = [];
  const excluded = new Set<string>();
  let preferred = archetypesOf(ownedCatalysts);
  for (let i = 0; i < count; i++) {
    const tier = rollRarity(weights, rng);
    const bias = preferred.size > 0 ? preferred : undefined;
    const id = pickFromRarity(tier, unlocks, excluded, rng, bias, constellationId, faceUniverse);
    if (!id) break;
    out.push(id);
    excluded.add(id);
    // Carry forward: the next offer in this draw should cohere with what
    // we've already shown, even if the player owns nothing yet.
    preferred = archetypesOf([...ownedCatalysts, ...out]);
  }
  return out;
}

// Re-exported for tests / handler imports.
export { CATALYST_META };
