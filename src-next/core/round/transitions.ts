import type { GameState } from '../../state/store';
import type { GameEventEmission, DieSnapshot } from '../../events/types';
import { BLIND_DEFS, BOSS_BLINDS, targetForBlind } from '../../data/blinds';
import { initialRoundSlice } from '../../state/slices/round';
import { makeSeedRng, seededPick } from '../seed/rng';
import { blindClearShardBonus, extraHandsPerRound, maxConsumableSlots } from '../vouchers';
import { lookupMod } from '../mods';
import { getDiceSpec } from '../run/diceContext';
import { stakeContext, rerollsPerHand } from '../run/stakeContext';
import { stakeIndex } from '../../data/stakes';
import { lookupPack, rollPackContents } from '../consumables/galaxies';
import { CONSUMABLES } from '../consumables';
import { firstBlindExtraHands } from '../run/applyAstralPerks';
import { getVoidstormForBlind, lookupVoidstorm } from './voidstorms';
import { lookupCosmicAffliction, pickAfflictionForLap } from '../../data/cosmicAfflictions';
import { accrueBlindCleared, isPalindrome } from './scalingHooks';
import { lookupCatalyst, CATALYST_META } from '../../data/catalysts';
import { LEGENDARY_UNLOCK_PREFIX } from '../shop/catalystDraw';

// Legendary unlock conditions tied to per-blind progression. Run from inside
// clearBlind so the unlock lands the moment the qualifying clear happens.
//   - Eclipse Pact: clear any blind while on the Eclipse constellation
//     ("Sign once. Score forever." — first contact with Eclipse seals it).
//   - Heirloom Locket: cosmic-dust lifetime ≥ 100 (a meta-progression
//     threshold roughly matching ~20 cleared blinds, in keeping with the
//     "bequest" flavor and the catalyst's cross-run carryover effect).
function clearBlindLegendaryUnlocks(
  unlocks: string[],
  constellationId: string,
  cosmicDustLifetime: number,
): string[] {
  const add: string[] = [];
  if (constellationId === 'eclipse' && !unlocks.includes(`${LEGENDARY_UNLOCK_PREFIX}eclipse_pact`)) {
    add.push(`${LEGENDARY_UNLOCK_PREFIX}eclipse_pact`);
  }
  if (cosmicDustLifetime >= 100 && !unlocks.includes(`${LEGENDARY_UNLOCK_PREFIX}heirloom_locket`)) {
    add.push(`${LEGENDARY_UNLOCK_PREFIX}heirloom_locket`);
  }
  return add.length === 0 ? unlocks : [...unlocks, ...add];
}

// 2026-05-16 unlock-content roadmap — checks every unlock condition
// for the new catalysts + mods and returns any newly-earned unlock
// flags to add to meta.unlocks. Called on every blind clear/bust so
// in-run conditions (Salt of the Earth's 50-shard ledger, Hourglass's
// hand-budget) fire the moment they're earned without waiting for the
// run to end.
//
// Unlock flag format: `unlock:<catalyst_or_mod_id>` for non-legendary
// gated content. Legendary catalysts keep the existing
// `legendary_unlocked:` prefix for back-compat with the shop draw.
const UNLOCK_PREFIX = 'unlock:';
function checkRoadmapUnlocks(args: {
  unlocks: string[];
  run: GameState['run'];
  meta: GameState['meta'];
  trigger: 'clear' | 'bust' | 'run-end-win' | 'run-end-bust';
  // For Reckless: which constellation just busted (if trigger === bust).
  // For Crown of Skulls: which stake just busted.
  bustConstellationId?: string;
  bustStakeId?: string;
}): string[] {
  const { unlocks, run, meta, trigger } = args;
  const add: string[] = [];
  const have = new Set(unlocks);
  const grant = (id: string) => {
    const flag = `${UNLOCK_PREFIX}${id}`;
    if (have.has(flag)) return;
    add.push(flag);
    have.add(flag);
  };

  // Salt of the Earth — end any run with 50+ shards in hand. Fires
  // on either run-end branch.
  if ((trigger === 'run-end-win' || trigger === 'run-end-bust') && run.shards >= 50) {
    grant('salt_of_earth');
  }

  // Hourglass — clear Ante 4 in ≤30 hands total this run.
  if (trigger === 'run-end-win' && run.handsPlayed <= 30) {
    grant('hourglass');
  }

  // The Patient — 5+ Patience Counter ×3 fires in a single run.
  if (trigger === 'clear' && (run.patienceCounterFires ?? 0) >= 5) {
    grant('the_patient');
  }

  // The Confessor — equip 4 mods on any single die.
  if (run.diceMods.some((slots) => slots.length >= 4)) {
    grant('the_confessor');
  }

  // Bloodied Coin — clear any blind with 3+ risk-archetype catalysts.
  // Read archetype from catalyst meta; counted at clear time so the
  // unlock fires the moment a player commits to a risk-tribal build.
  if (trigger === 'clear') {
    const riskCount = run.catalysts.filter((cid) => lookupCatalyst(cid)?.archetype === 'risk').length;
    if (riskCount >= 3) grant('bloodied_coin');
  }

  // Voidwalker — reach Cosmic Lap 3 (endless mode).
  if ((run.endlessLap ?? 0) >= 3) {
    grant('voidwalker');
  }

  // The Reckoning — own all 5 easter-egg discovery flags.
  const allEggs = ['answer', 'pi', 'lucky_seven', 'eris_apple', 'mirrored_hand'];
  if (allEggs.every((id) => (meta.easterEggs ?? []).includes(id))) {
    grant('the_reckoning');
  }

  // Stargazer — Codex 100% on catalysts.
  // 92 catalysts shipped; the count check uses the actual lookup count
  // to avoid hardcoding. Defensive on `meta.discovered` — test fixtures
  // may pass a partial meta without the `discovered` field populated.
  const allCatalystIds = new Set([...lookupAllCatalystIds()]);
  const discoveredCatalysts = new Set(meta.discovered?.catalysts ?? []);
  if (allCatalystIds.size > 0 && allCatalystIds.size <= discoveredCatalysts.size) {
    grant('stargazer');
  }

  // Cosmic Compass — clear final trial on 3 different constellations.
  // Check the cross-run accumulator.
  if (trigger === 'run-end-win') {
    const clears = new Set(meta.constellationClears ?? []);
    clears.add(run.constellationId);
    if (clears.size >= 3) grant('cosmic_compass');
  }

  // Sun-Forged — clear Supernova stake on any constellation.
  if (trigger === 'run-end-win' && run.stakeId === 'supernova') {
    grant('sun_forged');
  }

  // Crown of Skulls — 10 cumulative busts on Beacon+ stake.
  {
    const stakeIdsBeaconPlus = ['beacon', 'nova', 'supernova'];
    const byStake = meta.bustCountByStake ?? {};
    const beaconPlusBusts = stakeIdsBeaconPlus.reduce((sum, id) => sum + (byStake[id] ?? 0), 0);
    if (beaconPlusBusts >= 10) grant('crown_of_skulls');
  }

  // Reckless mod — 5+ busts on a single constellation.
  {
    const byConstellation = meta.bustCountByConstellation ?? {};
    if (Object.values(byConstellation).some((n) => n >= 5)) grant('reckless');
  }

  // Calibrated mod — clear without using any Pin consumable this run.
  if (trigger === 'run-end-win' && (run.pinConsumablesUsed ?? 0) === 0) {
    grant('calibrated');
  }

  // Veiled mod — 3+ consecutive locked-hand streak in a single run.
  if ((run.consecutiveLockedHands ?? 0) >= 3) {
    grant('veiled');
  }

  // Heirbound mod — carried a mod from blind 1 to blind 12 of a run.
  // Use the simple proxy: if the player completed the run AND any
  // single die still has at least one mod attached, count it as
  // satisfied. This is a soft proxy because we don't snapshot mod
  // ownership per-blind; the strict implementation would track
  // mod-age per die. Lightweight approximation for v1 ship.
  if (trigger === 'run-end-win' && run.diceMods.some((slots) => slots.length > 0)) {
    grant('heirbound');
  }

  return add.length === 0 ? unlocks : [...unlocks, ...add];
}

// Tiny helper to enumerate every shipped catalyst id without importing
// the entire data table eagerly into the unlock check (keeps the hot
// path lean).
function lookupAllCatalystIds(): string[] {
  // CATALYST_META is already imported via lookupCatalyst's module — we
  // just need its keys. The export uses an array; map to ids.
  return CATALYST_META.map((c) => c.id);
}

// Brittle: any mod with `loseOnBust` is removed when the hand fails to clear
// the blind. Engraved (Phase 5d) protects ALL mods on the same die from this
// pass — pairs naturally with Brittle to keep its +5 mult/die without the
// destroy-on-bust risk.
//
// Returns updated parallel arrays so diceModEditions stays length-synced
// with diceMods when Brittle entries are removed.
function dropBrittleMods(
  diceMods: string[][],
  diceModEditions: ((null | 'foil' | 'holo' | 'poly')[] | undefined)[],
): { diceMods: string[][]; diceModEditions: (null | 'foil' | 'holo' | 'poly')[][] } {
  const nextMods: string[][] = [];
  const nextEditions: (null | 'foil' | 'holo' | 'poly')[][] = [];
  for (let dieIdx = 0; dieIdx < diceMods.length; dieIdx++) {
    const slotIds = diceMods[dieIdx] ?? [];
    const slotEds = diceModEditions[dieIdx] ?? slotIds.map(() => null);
    const hasEngraved = slotIds.some((id) => lookupMod(id)?.engraved);
    if (hasEngraved) {
      nextMods.push(slotIds);
      nextEditions.push(slotEds);
      continue;
    }
    const keptIds: string[] = [];
    const keptEds: (null | 'foil' | 'holo' | 'poly')[] = [];
    for (let j = 0; j < slotIds.length; j++) {
      const id = slotIds[j]!;
      if (lookupMod(id)?.loseOnBust) continue;
      keptIds.push(id);
      keptEds.push(slotEds[j] ?? null);
    }
    nextMods.push(keptIds);
    nextEditions.push(keptEds);
  }
  return { diceMods: nextMods, diceModEditions: nextEditions };
}

/** Pick a boss-blind id deterministically from the run seed + ante.
 * Two players entering the same seed see the same boss on the same
 * ante; a refresh on the hub doesn't shuffle the boss because the
 * scope ('boss:ante2') is stable. NEW_RUN and clearBlind call this
 * to lock the upcoming-ante boss in run.upcomingBossId; the Hub then
 * reveals the chosen curse before the player clicks Begin. */
export function pickBossId(seed: number, ante: number): string {
  const rng = makeSeedRng(seed, `boss:ante${ante}`);
  return seededPick(rng, BOSS_BLINDS).id;
}

export function startBlind(s: GameState): { state: GameState; events: GameEventEmission[] } {
  const ante = s.run.ante;
  const blindIndex = s.run.goalIdx % 3;
  const def = BLIND_DEFS[blindIndex]!;
  const ctx = stakeContext(s);
  const lap = s.run.endlessLap ?? 0;
  // Cosmic Affliction target-tax (Pillar D) — multiplies the base
  // target by the affliction's value. Voidstorm-force is consumed in
  // the voidstorm derivation below; hands-delta in the handsMax calc;
  // compounding-tax in the per-blind ramp.
  const affliction = lookupCosmicAffliction(s.run.cosmicAfflictionId);
  let afflictionTargetMul = 1;
  if (affliction?.effect.kind === 'target-tax') {
    afflictionTargetMul = affliction.effect.multiplier;
  } else if (affliction?.effect.kind === 'compounding-tax') {
    // Blinds cleared this lap = goalIdx since lap start = goalIdx
    // (we reset goalIdx to 0 on lap continue). Each cleared blind
    // adds perBlindMul to the target tax — so the FIRST blind of the
    // lap is at 1x and it compounds from there.
    afflictionTargetMul = 1 + affliction.effect.perBlindMul * s.run.goalIdx;
  }
  // 2026-05-16 unlock-content roadmap — Hourglass: +10% target. Multiplies
  // into the existing target stack so stake / affliction multipliers
  // still apply on top. Crown of Skulls has no target impact.
  const hourglassMul = s.run.catalysts.includes('hourglass') ? 1.1 : 1;
  const target = Math.ceil(
    targetForBlind(ante, blindIndex, lap) * ctx.targetMult * afflictionTargetMul * hourglassMul,
  );
  const isBoss = def.isBoss;
  // Boss id: prefer the value locked in by NEW_RUN / the previous
  // clearBlind (so the Hub's preview and the actual blind match, and
  // a refresh on the hub doesn't shuffle the boss between page loads).
  // Falls back to a fresh roll for legacy saves that don't have
  // upcomingBossId set; the rolled id is mirrored into run state
  // further down so subsequent refreshes inside the boss blind stay
  // stable.
  const lockedBossId = s.run.upcomingBossId ?? null;
  const blindId = isBoss
    ? (lockedBossId ?? pickBossId(s.run.seed, ante))
    : def.name.toLowerCase().replace(/\s+/g, '_');
  // Voidstorm derivation — deterministic so the Hub preview chip and the
  // in-blind storm match exactly. Boss blinds always pass through as null.
  // Computed BEFORE handsMax so `onBlindStart.handsDelta` can apply.
  // Cosmic Affliction "voidstorm-force" (Pillar D) overrides the
  // deterministic pick when active.
  let voidstormId = getVoidstormForBlind(s.run.seed, s.run.goalIdx, isBoss);
  if (!isBoss && affliction?.effect.kind === 'voidstorm-force') {
    voidstormId = affliction.effect.voidstormId;
  }
  const stormDef = lookupVoidstorm(voidstormId);
  const stormBlindStart = stormDef?.onBlindStart?.(s) ?? {};
  const baseHandsMax = 3;
  // First Breath astral perk: +N hands on the very first blind of the run
  // (goalIdx === 0). Stacks with vouchers and stake hands deltas.
  const firstBlindBonus = s.run.goalIdx === 0 ? firstBlindExtraHands(s) : 0;
  const afflictionHandsDelta = affliction?.effect.kind === 'hands-delta' ? affliction.effect.delta : 0;
  // 2026-05-16 unlock-content roadmap — Hourglass: +1 hand per blind.
  // Crown of Skulls: -1 hand per blind. They stack mathematically;
  // owning both nets to zero (and a +10% target — that's intentional).
  const hourglassHandsDelta = s.run.catalysts.includes('hourglass') ? 1 : 0;
  const crownHandsDelta = s.run.catalysts.includes('crown_of_skulls') ? -1 : 0;
  const handsMax = Math.max(
    1,
    baseHandsMax + extraHandsPerRound(s) + ctx.handsDelta + firstBlindBonus + (stormBlindStart.handsDelta ?? 0) + afflictionHandsDelta + hourglassHandsDelta + crownHandsDelta,
  );
  // Build the dice array sized to whatever the active constellation declares.
  // Default Lyra → 5 dice; Mensa → 7; Argo → 1; Polyhedra → 5 mixed.
  const spec = getDiceSpec(s);
  const dice: DieSnapshot[] = spec.map((d, id) => ({
    id,
    face: typeof d.faces[0] === 'number' ? d.faces[0] : 1,
    locked: true,
  }));
  const scoringOrder = spec.map((_, i) => i);
  // Shard Lung (catalyst): when this blind starts, the player gains shards
  // equal to ceil(ante/2). Pure round-start grant; the score-time spend
  // half is handled by the catalyst's apply in core/upgrades/catalysts/shardLung.ts.
  //
  // 2026-05-18 balance audit nerf: pre-audit grant was full `ante` shards
  // (Ante 4 → +4). +173% impact made Shard Lung the single must-buy
  // uncommon that sustained the entire mid-late economy. ceil(ante/2)
  // halves the curve (Ante 4 → +2) — still useful, no longer compulsory.
  const shardLungBonus = s.run.catalysts.includes('shard_lung') ? Math.ceil(ante / 2) : 0;
  // Audit (catalyst, 2026-05-18 audit buff): +1 shard per blind start so
  // the catalyst contributes value DURING the run, not only on bust.
  // The 50% refund-on-bust path stays in bustBlind() — this just gives
  // the player a small steady incentive to keep it around.
  const auditBonus = s.run.catalysts.includes('audit') ? 1 : 0;
  // Mirrored Hand easter egg — set true for the upcoming blind iff the
  // player owns 2+ catalysts whose display names are palindromes
  // (ignoring case/spaces/punctuation). The retrigger only fires on the
  // first hand of each such blind. Discovery hint: a small subtle line
  // appears in the codex once the player has ever owned a palindromic
  // catalyst, suggesting "pairs of names that read both ways tie".
  const palindromicCount = s.run.catalysts.filter((cid) => {
    const meta = lookupCatalyst(cid);
    return meta ? isPalindrome(meta.name) : false;
  }).length;
  const mirroredHandActive = palindromicCount >= 2;
  // Voidstorm onBlindStart hooks for shards / rerolls already collapsed
  // into stormBlindStart above; apply the shard delta to run.shards now.
  // Shards clamp at zero — a Singularity tithe on an empty wallet just
  // sets the player to 0 rather than rolling negative.
  const stormShardsDelta = stormBlindStart.shardsDelta ?? 0;
  const runShards = Math.max(0, s.run.shards + shardLungBonus + auditBonus + stormShardsDelta);
  return {
    state: {
      ...s,
      ui: { ...s.ui, screen: 'round' },
      // Clear upcomingBossId once a boss blind starts — the chosen id
      // now lives on round.blindId for the duration of the round.
      // clearBlind re-picks for the next ante on boss-clear.
      run: {
        ...s.run,
        shards: runShards,
        mirroredHandActive,
        upcomingBossId: isBoss ? null : s.run.upcomingBossId,
      },
      round: {
        ...initialRoundSlice(),
        active: true,
        blindId,
        blindIndex,
        isBoss,
        target,
        handsMax,
        handsLeft: handsMax,
        rerollsLeft: rerollsPerHand(s) + (stormBlindStart.rerollsDelta ?? 0),
        dice,
        scoringOrder,
        voidstormId,
      },
    },
    events: isBoss
      ? [{ type: 'onBossRevealed', payload: { blindId, ante: s.run.ante } }]
      : [],
  };
}

export function clearBlind(s: GameState): { state: GameState; events: GameEventEmission[] } {
  // Per the shard economy rebalance: flat base + bonus per remaining hand +
  // interest on held shards. Replaces the old overcharge mechanic which let a
  // single high-roll fund half a shop. The three constants live here so the
  // tuning curve is in one place. Values picked so a typical player nets
  // roughly the legacy total over an 8-ante run while the high-roll ceiling
  // drops materially — see `data/balance.shards.sim.test.ts`.
  const SHARDS_PER_REMAINING_HAND = 1;
  const SHARDS_INTEREST_DIVISOR = 5;
  const SHARDS_INTEREST_CAP = 3;

  const baseAmount = s.round.isBoss ? 8 : 5;
  const voucherBonus = blindClearShardBonus(s);
  const handsBonus = Math.max(0, s.round.handsLeft) * SHARDS_PER_REMAINING_HAND;
  const interest = Math.min(
    SHARDS_INTEREST_CAP,
    Math.floor(Math.max(0, s.run.shards) / SHARDS_INTEREST_DIVISOR),
  );
  // 2026-05-12 QA pass: overscore bonus. The post-2026-05-08 shard curve
  // capped one-hand high-rollers below the legacy income (see
  // balance.shards.sim.test.ts: "lucky" -266, "high-roll" -367). Restore
  // some of that incentive by paying +1 shard per 100% of target above
  // 200%, capped at +5. So a 3× clear earns +1, a 5× clear earns +3, a
  // 7×+ clear caps at +5. Tight clears (under 2×) get nothing — the
  // curve still rewards the bursty player without unbounded snowballing.
  const SHARDS_OVERSCORE_CAP = 5;
  const overscoreRatio = s.round.target > 0 ? s.round.score / s.round.target : 1;
  const overscoreBonus = overscoreRatio > 2
    ? Math.min(SHARDS_OVERSCORE_CAP, Math.floor(overscoreRatio - 2))
    : 0;
  const reward = baseAmount + voucherBonus + handsBonus + interest + overscoreBonus;
  const nextGoal = s.run.goalIdx + 1;
  const nextAnte = Math.floor(nextGoal / 3) + 1;
  const won = nextGoal >= 12;

  // Cosmic Dust: per-blind award of (1 + currentAnte) so ante 1 → 2, … ante 4
  // → 5 dust. Win bonus of 15 × stakeIndex stacks on top of the final blind
  // award. Conservative starting rate; tune via tools/sim/dustEarn.ts and
  // docs/sim-data/dust_earn.csv.
  const dustForBlind = 1 + s.run.ante;
  const winBonus = won ? 15 * Math.max(1, stakeIndex(s.run.stakeId) + 1) : 0;
  // 2026-05-16 — daily clear bonus. Daily runs are short, deterministic,
  // and intentionally low-variance, so a flat +25 dust on win turns the
  // daily into a real meta-progression beat instead of a flavour mode.
  // Streak hint: today's clear with yesterday's cleared in history adds
  // another +5 per consecutive day, capped at +25 so a long streak can
  // double the daily payout without breaking the dust curve.
  const dailyWinBonus = won && s.run.dailyDate
    ? 25 + dailyStreakBonus(s.meta.dailyHistory ?? {}, s.run.dailyDate)
    : 0;
  const dustGained = dustForBlind + winBonus + dailyWinBonus;
  const highScores = won ? pushHighScore(s, s.round.score) : s.meta.highScores;
  // On a successful run, record the cleared stake for this constellation
  // so the next stake unlocks. Tied per-constellation so stake progress on
  // Lyra doesn't unlock Mensa's harder rungs.
  const stakeProgress = won ? upgradeStakeProgress(s) : s.meta.stakeProgress;
  const challengeWins = won && s.run.challengeId
    ? Array.from(new Set([...s.meta.challengeWins, s.run.challengeId]))
    : s.meta.challengeWins;
  const newDustTotal = (s.meta.cosmicDust ?? 0) + dustGained;
  const events: GameEventEmission[] = [
    {
      type: 'onBlindCleared',
      payload: {
        blindId: s.round.blindId ?? 'unknown',
        ante: s.run.ante,
        reward: {
          base: baseAmount,
          voucher: voucherBonus,
          hands: handsBonus,
          interest,
          overscore: overscoreBonus,
          total: reward,
        },
      },
    },
    {
      type: 'onDustEarned',
      payload: { delta: dustGained, total: newDustTotal, reason: won ? 'win' : 'clear' },
    },
  ];
  if (won) {
    events.push({
      type: 'onRunEnded',
      payload: {
        score: s.round.score,
        won: true,
        ante: s.run.ante,
        constellation: s.run.constellationId,
      },
    });
  }
  // Cross-run accumulator update: when this clear ends the run on the
  // win branch, record the constellation in `constellationClears` so
  // Cosmic Compass can fire at 3+ distinct entries.
  const nextConstellationClears = won
    ? Array.from(new Set([...(s.meta.constellationClears ?? []), s.run.constellationId]))
    : s.meta.constellationClears;
  const baseMeta = won
    ? { ...s.meta, highScores, stakeProgress, challengeWins, constellationClears: nextConstellationClears }
    : s.meta;
  const newDustLifetime = (s.meta.cosmicDustLifetime ?? 0) + dustGained;
  let unlocksAfterClear = clearBlindLegendaryUnlocks(
    baseMeta.unlocks ?? [],
    s.run.constellationId,
    newDustLifetime,
  );
  // 2026-05-16 roadmap unlocks — chain on top of the legendary-only
  // check above so new unlocks land in the same meta write.
  unlocksAfterClear = checkRoadmapUnlocks({
    unlocks: unlocksAfterClear,
    run: s.run,
    meta: baseMeta,
    trigger: won ? 'run-end-win' : 'clear',
  });
  // Cosmic Lap (Pillar D) highwater — if this clear ended the lap (any
  // clear during endlessLap > 0), record the lap/ante/score against the
  // constellation's high-water mark. On a normal-run clear, also record
  // (lap=0) to seed the table so the Codex/Hub can show a "best run"
  // ahead of endless engagement.
  const lapNow = s.run.endlessLap ?? 0;
  let endlessHighwater = s.meta.endlessHighwater ?? {};
  if (won || lapNow > 0) {
    const cid = s.run.constellationId;
    const prev = endlessHighwater[cid];
    const candidate = {
      lap: lapNow,
      ante: s.run.ante,
      score: s.round.score,
      date: Date.now(),
      stake: s.run.stakeId,
    };
    // Sort key (lap, ante, score) — replace only if strictly better.
    const isBetter =
      !prev ||
      candidate.lap > prev.lap ||
      (candidate.lap === prev.lap && candidate.ante > prev.ante) ||
      (candidate.lap === prev.lap && candidate.ante === prev.ante && candidate.score > prev.score);
    if (isBetter) endlessHighwater = { ...endlessHighwater, [cid]: candidate };
  }
  const nextMeta = {
    ...baseMeta,
    unlocks: unlocksAfterClear,
    cosmicDust: newDustTotal,
    cosmicDustLifetime: newDustLifetime,
    endlessHighwater,
    // Daily run completion: only the WON path of a clearBlind ends the run
    // (the player just cleared the final boss). Record/update the daily
    // history entry so the Title screen shows today's status.
    dailyHistory: won && s.run.dailyDate
      ? recordDailyAttempt(s.meta.dailyHistory ?? {}, s, true)
      : (baseMeta.dailyHistory ?? {}),
  };
  // Scaling catalysts that bump per cleared blind: Comet Trail (consumable
  // streak), Memento Star (200%+ overflow), Heirloom Locket (every blind).
  const blindScalingDiff = accrueBlindCleared({
    run: s.run,
    round: s.round,
    blindTarget: s.round.target,
    blindScore: s.round.score,
  });
  // Scaling die-mods at blind boundary:
  // - Veteran: +1 stack per attachment on every cleared blind (perfectly
  //   safe; mod survives bust separately).
  // - Cadence: per-blind counter — reset to 0 between blinds.
  const nextDiceModStacks = s.run.diceMods.map((row, dieIdx) => {
    const stackRow = (s.run.diceModStacks?.[dieIdx] ?? row.map(() => 0)).slice();
    for (let slotIdx = 0; slotIdx < row.length; slotIdx++) {
      const id = row[slotIdx]!;
      const def = lookupMod(id);
      if (!def) continue;
      if (def.cadencePerBlind) stackRow[slotIdx] = 0;
      if (def.veteranMultPerStack) stackRow[slotIdx] = (stackRow[slotIdx] ?? 0) + 1;
      // Pad missing slots up to row length.
      while (stackRow.length < row.length) stackRow.push(0);
    }
    return stackRow;
  });
  // Roll the upcoming ante's boss as soon as the current ante is
  // cleared (ante just advanced because we cleared the boss). The
  // Hub previews this id; startBlind consumes it. Untouched on
  // non-boss clears so a small/big-blind clear doesn't shuffle the
  // boss the player saw on the hub.
  const anteAdvanced = nextAnte > s.run.ante;
  const nextUpcomingBossId = won
    ? null
    : (anteAdvanced ? pickBossId(s.run.seed, nextAnte) : s.run.upcomingBossId ?? null);
  return {
    state: {
      ...s,
      run: {
        ...s.run,
        ...blindScalingDiff.run,
        diceModStacks: nextDiceModStacks,
        shards: s.run.shards + reward,
        goalIdx: nextGoal,
        ante: nextAnte,
        compoundingStacks: s.run.compoundingStacks + 1,
        // Track dust gained THIS run for the postmortem celebration line.
        // Mirrors the meta.cosmicDust grant above so the two stay in sync.
        runStats: addDustToRunStats(s.run.runStats, dustGained),
        upcomingBossId: nextUpcomingBossId,
      },
      round: { ...s.round, active: false },
      // Empty offers so Shop's useEffect dispatches OPEN_SHOP and rolls fresh.
      shop: { ...s.shop, offers: [] },
      // Challenge overlays can disable the bazaar entirely; skip straight to hub.
      ui: { ...s.ui, screen: won ? 'win' : (stakeContext(s).shopDisabled ? 'hub' : 'shop') },
      meta: nextMeta,
    },
    events,
  };
}

// Bump the high-water-mark stake for the constellation that just won. Skipped
// when the player was already on the highest stake. Pure helper.
function upgradeStakeProgress(s: GameState): GameState['meta']['stakeProgress'] {
  const cur = s.meta.stakeProgress[s.run.constellationId];
  const ranOn = s.run.stakeId;
  // Only upgrade if the just-cleared stake is at or above the current record.
  // (Saved progress holds the highest CLEARED stake id; the next stake to play
  // is one rung above. ConstellationSelect filters by progress.)
  if (cur && stakeIndex(cur) >= stakeIndex(ranOn)) return s.meta.stakeProgress;
  return { ...s.meta.stakeProgress, [s.run.constellationId]: ranOn };
}

// Cosmic Lap (Pillar D) — invoked from the Win screen's "Continue"
// button. Resets the run to ante 1 / goalIdx 0, increments endlessLap,
// picks the affliction for the new lap, and routes back to the Hub.
//
// The player keeps EVERYTHING from the prior lap: catalysts, mods,
// vouchers, consumables, shards. Targets ramp via `targetForBlind`'s
// lap arg and the affliction's tax. Bust on a lap busts the WHOLE
// endless attempt — they don't get to retry just the current lap.
export function startCosmicLap(s: GameState): { state: GameState; events: GameEventEmission[] } {
  const nextLap = (s.run.endlessLap ?? 0) + 1;
  const affliction = pickAfflictionForLap(nextLap);
  return {
    state: {
      ...s,
      ui: { ...s.ui, screen: 'hub' },
      run: {
        ...s.run,
        ante: 1,
        goalIdx: 0,
        endlessLap: nextLap,
        cosmicAfflictionId: affliction?.id ?? null,
      },
      round: { ...s.round, active: false },
    },
    events: [],
  };
}

export function bustBlind(s: GameState): { state: GameState; events: GameEventEmission[] } {
  const highScores = pushHighScore(s, s.round.score);
  const dropped = dropBrittleMods(s.run.diceMods, s.run.diceModEditions ?? []);
  // Audit (catalyst): one-shot — refunds 50% of catalyst shard spend
  // back into the player's pocket on bust, then self-destructs (removes
  // itself from run.catalysts so it can't fire again next bust).
  const auditOwned = s.run.catalysts.includes('audit');
  const auditRefund = auditOwned
    ? Math.floor((s.run.catalystShardSpend ?? 0) * 0.5)
    : 0;
  const catalystsAfterAudit = auditOwned
    ? s.run.catalysts.filter((c) => c !== 'audit')
    : s.run.catalysts;
  // Drop audit's edition stamp too so a later GRANT_CATALYST doesn't
  // inherit it.
  let editionsAfterAudit = s.run.catalystEditions ?? {};
  if (auditOwned && editionsAfterAudit.audit) {
    const { audit: _dropped, ...rest } = editionsAfterAudit;
    editionsAfterAudit = rest;
  }
  // Cosmic Dust: small consolation award on bust so even failed runs feel
  // like progress toward the meta layer. Scales mildly with how far the
  // player got: 1 dust + 1 per cleared goal.
  const dustGained = 1 + s.run.goalIdx;
  const newDustTotal = (s.meta.cosmicDust ?? 0) + dustGained;
  // 2026-05-16 unlock roadmap — bust-by-stake / bust-by-constellation
  // counters drive Crown of Skulls (10 Beacon+ busts) and Reckless
  // mod (5 busts on one constellation).
  const bustCountByStake = {
    ...(s.meta.bustCountByStake ?? {}),
    [s.run.stakeId]: ((s.meta.bustCountByStake ?? {})[s.run.stakeId] ?? 0) + 1,
  };
  const bustCountByConstellation = {
    ...(s.meta.bustCountByConstellation ?? {}),
    [s.run.constellationId]: ((s.meta.bustCountByConstellation ?? {})[s.run.constellationId] ?? 0) + 1,
  };
  const baseUnlocks = s.meta.unlocks ?? [];
  const unlocksAfterBust = checkRoadmapUnlocks({
    unlocks: baseUnlocks,
    run: s.run,
    meta: { ...s.meta, bustCountByStake, bustCountByConstellation },
    trigger: 'run-end-bust',
    bustStakeId: s.run.stakeId,
    bustConstellationId: s.run.constellationId,
  });
  return {
    state: {
      ...s,
      ui: { ...s.ui, screen: 'fail' },
      round: { ...s.round, active: false },
      run: {
        ...s.run,
        compoundingStacks: 0,
        // 2026-05-11 scaling pack — same lifecycle as compoundingStacks:
        // permanent within the run, reset on bust. The player has to
        // re-earn every stack on the next attempt; this preserves the
        // existing "death = full reset" social contract.
        catalystStacks: {},
        lunarPhase: 0,
        lunarBakedMult: 0,
        diceMods: dropped.diceMods,
        diceModEditions: dropped.diceModEditions,
        // Reset scaling die-mod stacks to zero rows length-synced with the
        // surviving mods. Bust → fresh start, same as catalystStacks above.
        diceModStacks: dropped.diceMods.map((row) => row.map(() => 0)),
        shards: s.run.shards + auditRefund,
        catalysts: catalystsAfterAudit,
        catalystEditions: editionsAfterAudit,
        // Bust still earns a small consolation dust grant — track it for
        // the postmortem so the player sees they made progress even on a
        // failed run.
        runStats: addDustToRunStats(s.run.runStats, dustGained),
      },
      meta: {
        ...s.meta,
        highScores,
        cosmicDust: newDustTotal,
        cosmicDustLifetime: (s.meta.cosmicDustLifetime ?? 0) + dustGained,
        unlocks: unlocksAfterBust,
        bustCountByStake,
        bustCountByConstellation,
        // Daily bust: record the attempt so the Title shows "today done"
        // even if the player didn't clear. Best-score-of-day semantics.
        dailyHistory: s.run.dailyDate
          ? recordDailyAttempt(s.meta.dailyHistory ?? {}, s, false)
          : (s.meta.dailyHistory ?? {}),
      },
    },
    events: [
      {
        type: 'onRunEnded',
        payload: {
          score: s.round.score,
          won: false,
          ante: s.run.ante,
          constellation: s.run.constellationId,
        },
      },
      {
        type: 'onDustEarned',
        payload: { delta: dustGained, total: newDustTotal, reason: 'bust' },
      },
    ],
  };
}

// Roll dust earned into the run-scoped telemetry block. Tolerant of
// older save shapes that predate the field — defaults missing fields
// to a fresh-baseline rather than crashing the postmortem.
function addDustToRunStats(
  prev: GameState['run']['runStats'] | undefined,
  delta: number,
): GameState['run']['runStats'] {
  const base = prev ?? { peakHand: 0, peakCombo: null, catalystChips: {}, dustEarned: 0, catalystFires: {} };
  return { ...base, catalystFires: base.catalystFires ?? {}, dustEarned: (base.dustEarned ?? 0) + delta };
}

// Daily attempt recorder. Keeps the BEST score for the day and stamps
// `cleared: true` once any attempt clears (so a later sub-clear bust
// doesn't downgrade a prior win). No-op if the run isn't daily.
function recordDailyAttempt(
  history: GameState['meta']['dailyHistory'],
  s: GameState,
  cleared: boolean,
): GameState['meta']['dailyHistory'] {
  const date = s.run.dailyDate;
  if (!date) return history;
  const prev = history[date];
  const score = s.round.score;
  const ante = s.run.ante;
  // Keep best score; preserve a previous clear even on a fresh worse attempt.
  const next = {
    score: Math.max(prev?.score ?? 0, score),
    cleared: prev?.cleared || cleared,
    ante: Math.max(prev?.ante ?? 0, ante),
    constellation: s.run.constellationId,
    stake: s.run.stakeId,
    playedAt: Date.now(),
  };
  return { ...history, [date]: next };
}

// Daily-streak bonus. Walks backward from yesterday in the daily history
// counting consecutive cleared days. Returns +5 per step capped at +25
// (so a 5-day streak doubles the base 25 dust to 50 total). Pure helper —
// no state mutation, no clock reads beyond the date string parsing.
function dailyStreakBonus(
  history: Record<string, { cleared: boolean }>,
  todayUtc: string,
): number {
  // todayUtc format: 'YYYY-MM-DD'. Walk back day-by-day; the helper
  // exits as soon as a missing or unclear day breaks the streak.
  const STEP_DUST = 5;
  const STEP_CAP = 5;
  let streak = 0;
  const cursor = new Date(`${todayUtc}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime())) return 0;
  for (let i = 0; i < STEP_CAP; i++) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const key = cursor.toISOString().slice(0, 10);
    const entry = history[key];
    if (!entry?.cleared) break;
    streak++;
  }
  return streak * STEP_DUST;
}

function pushHighScore(s: GameState, score: number) {
  if (score <= 0) return s.meta.highScores;
  const next = [
    ...s.meta.highScores,
    { name: s.meta.playerName || 'anon', score, date: Date.now() },
  ];
  next.sort((a, b) => b.score - a.score);
  return next.slice(0, 10);
}

import { BLIND_DEFS as DEFS } from '../../data/blinds';
import { rollSkipBountyOptions } from '../run/skipBounty';

export function skipBlind(s: GameState): { state: GameState; events: GameEventEmission[] } {
  const blindIdx = s.run.goalIdx % 3;
  const def = DEFS[blindIdx]!;
  if (def.isBoss) return { state: s, events: [] };
  const reward = def.skipReward;
  // Pillar G — instead of randomly assigning ONE of 4 bonus tags, we roll
  // 3 OPTIONS and let the player pick. The pending bounty blocks the
  // SkipBountyModal until resolved. Base skipReward is still paid up
  // front (legacy contract), the bounty option is the bonus on top.
  const bountyRng = () => Math.random();
  const bountyOptions = rollSkipBountyOptions({
    rng: bountyRng,
    baseShards: reward,
    ownedConsumables: s.run.consumables,
    ownedCatalysts: s.run.catalysts,
  });
  let nextState: GameState = {
    ...s,
    run: { ...s.run, shards: s.run.shards + reward, goalIdx: s.run.goalIdx + 1 },
    shop: {
      ...s.shop,
      pendingSkipBounty: { options: bountyOptions, blindIdx },
    },
  };
  const events: GameEventEmission[] = [];
  // Silver Tongue (catalyst): when the player skips a blind, grant 2 random
  // consumables (drawn from the regular pool — galaxies/spectrals excluded).
  // Stops at the consumable cap so high-end players don't break inventory.
  if (s.run.catalysts.includes('silver_tongue')) {
    const pool = CONSUMABLES.filter((c) => c.type !== 'galaxy' && c.type !== 'spectral');
    if (pool.length > 0) {
      const cap = maxConsumableSlots(nextState);
      let consumables = nextState.run.consumables;
      let granted = 0;
      while (granted < 2 && consumables.length < cap) {
        const pick = pool[Math.floor(Math.random() * pool.length)]!;
        consumables = [...consumables, pick.id];
        granted++;
      }
      nextState = { ...nextState, run: { ...nextState.run, consumables } };
    }
  }

  const nextAnte = Math.floor(nextState.run.goalIdx / 3) + 1;
  nextState = { ...nextState, run: { ...nextState.run, ante: nextAnte } };
  return { state: nextState, events };
}
