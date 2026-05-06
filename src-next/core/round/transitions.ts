import type { GameState } from '../../state/store';
import type { GameEventEmission, DieSnapshot } from '../../events/types';
import { BLIND_DEFS, BOSS_BLINDS, targetForBlind } from '../../data/blinds';
import { initialRoundSlice } from '../../state/slices/round';
import { blindClearShardBonus, extraHandsPerRound, maxConsumableSlots } from '../vouchers';
import { lookupMod } from '../mods';
import { getDiceSpec } from '../run/diceContext';
import { lookupPack, rollPackContents } from '../consumables/galaxies';
import { CONSUMABLES } from '../consumables';

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

export function startBlind(s: GameState): { state: GameState; events: GameEventEmission[] } {
  const ante = s.run.ante;
  const blindIndex = s.run.goalIdx % 3;
  const def = BLIND_DEFS[blindIndex]!;
  const target = targetForBlind(ante, blindIndex);
  const isBoss = def.isBoss;
  const blindId = isBoss
    ? BOSS_BLINDS[Math.floor(Math.random() * BOSS_BLINDS.length)]!.id
    : def.name.toLowerCase().replace(/\s+/g, '_');
  const baseHandsMax = 3;
  const handsMax = baseHandsMax + extraHandsPerRound(s);
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
  // equal to the current ante. Pure round-start grant; the score-time spend
  // half is handled by the catalyst's apply in core/upgrades/catalysts/shardLung.ts.
  const shardLungBonus = s.run.catalysts.includes('shard_lung') ? ante : 0;
  return {
    state: {
      ...s,
      ui: { ...s.ui, screen: 'round' },
      run: { ...s.run, shards: s.run.shards + shardLungBonus },
      round: {
        ...initialRoundSlice(),
        active: true,
        blindId,
        blindIndex,
        isBoss,
        target,
        handsMax,
        handsLeft: handsMax,
        dice,
        scoringOrder,
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
  const reward = baseAmount + voucherBonus + handsBonus + interest;
  const nextGoal = s.run.goalIdx + 1;
  const nextAnte = Math.floor(nextGoal / 3) + 1;
  const won = nextGoal >= 12;
  const highScores = won ? pushHighScore(s, s.round.score) : s.meta.highScores;
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
          total: reward,
        },
      },
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
  return {
    state: {
      ...s,
      run: {
        ...s.run,
        shards: s.run.shards + reward,
        goalIdx: nextGoal,
        ante: nextAnte,
        compoundingStacks: s.run.compoundingStacks + 1,
      },
      round: { ...s.round, active: false },
      // Empty offers so Shop's useEffect dispatches OPEN_SHOP and rolls fresh.
      shop: { ...s.shop, offers: [] },
      ui: { ...s.ui, screen: won ? 'win' : 'shop' },
      meta: won ? { ...s.meta, highScores } : s.meta,
    },
    events,
  };
}

export function bustBlind(s: GameState): { state: GameState; events: GameEventEmission[] } {
  const highScores = pushHighScore(s, s.round.score);
  const dropped = dropBrittleMods(s.run.diceMods, s.run.diceModEditions ?? []);
  return {
    state: {
      ...s,
      ui: { ...s.ui, screen: 'fail' },
      round: { ...s.round, active: false },
      run: {
        ...s.run,
        compoundingStacks: 0,
        diceMods: dropped.diceMods,
        diceModEditions: dropped.diceModEditions,
      },
      meta: { ...s.meta, highScores },
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
    ],
  };
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
const SKIP_TAGS = [
  { id: 'shard',   label: '+5 shards' },
  { id: 'reroll',  label: '+1 reroll next round' },
  { id: 'hand',    label: '+1 hand next round' },
  // Skip-blind sometimes drops a free Celestial Pack into the next shop
  // visit. Implemented by pre-staging shop.pendingPack here; the shop UI
  // already renders the overlay whenever pendingPack is set.
  { id: 'pack',    label: 'Free Celestial Pack' },
];

export function skipBlind(s: GameState): { state: GameState; events: GameEventEmission[] } {
  const blindIdx = s.run.goalIdx % 3;
  const def = DEFS[blindIdx]!;
  if (def.isBoss) return { state: s, events: [] };
  const reward = def.skipReward;
  const tag = SKIP_TAGS[Math.floor(Math.random() * SKIP_TAGS.length)]!;
  let nextState: GameState = {
    ...s,
    run: { ...s.run, shards: s.run.shards + reward, goalIdx: s.run.goalIdx + 1 },
  };
  const events: GameEventEmission[] = [];
  if (tag.id === 'shard') {
    nextState = { ...nextState, run: { ...nextState.run, shards: nextState.run.shards + 5 } };
  } else if (tag.id === 'reroll') {
    nextState = { ...nextState, round: { ...nextState.round, rerollsLeft: s.round.rerollsLeft + 1 } };
  } else if (tag.id === 'hand') {
    nextState = { ...nextState, round: { ...nextState.round, handsLeft: s.round.handsLeft + 1 } };
  } else if (tag.id === 'pack') {
    const def = lookupPack('celestial')!;
    const galaxyIds = rollPackContents(def.showCount, Math.random, def.quasarWeightMultiplier ?? 1);
    const newUnlocks = new Set(nextState.meta.unlocks);
    for (const gid of galaxyIds) {
      if (!newUnlocks.has(gid)) {
        newUnlocks.add(gid);
        events.push({ type: 'onGalaxyDiscovered', payload: { galaxyId: gid } });
      }
    }
    nextState = {
      ...nextState,
      meta: { ...nextState.meta, unlocks: [...newUnlocks] },
      shop: {
        ...nextState.shop,
        pendingPack: {
          kind: 'celestial',
          galaxyIds,
          picksLeft: def.pickCount,
          pickedSoFar: [],
        },
      },
    };
    events.push({
      type: 'onPackOpened',
      payload: { kind: 'celestial', galaxyIds, picksAllowed: def.pickCount },
    });
  }
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
