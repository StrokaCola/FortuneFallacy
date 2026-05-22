// Drives a single full run from NEW_RUN to terminal (won/fail).
// Bridge in bootstrap.ts dispatches ROLL_SETTLED synchronously, so this
// driver never has to await anything.

import { dispatch, store } from './bootstrap';
import type { GameState } from '../../src-next/state/store';
import type { Action } from '../../src-next/actions/types';
import type { Strategy } from './strategies';
import { attachTelemetry } from './telemetry';

export interface RunRecord {
  seed: number;
  constellationId: string;
  stakeId: string;
  challengeId: string;
  strategyId: string;
  finalAnte: number;
  goalsCleared: number;
  won: boolean;
  finalScore: number;
  totalHandsPlayed: number;
  totalShardsEarned: number;
  catalystsBought: number;
  vouchersBought: number;
  consumablesBought: number;
  modsBought: number;
  packsBought: number;
  shopRerolls: number;
  // 2026-05-21 — captured at run end so non-event-based shard grants
  // (stipend's per-hand +1, audit's bust refund, etc.) show up in
  // catalyst-impact studies. `totalShardsEarned` above only tracks the
  // onBlindCleared bonus channel and misses direct grants.
  finalShards: number;
  bustReason: string;
  combosPlayed: Record<string, number>;
  // Catalyst ids owned at run end. Captured so downstream sims (build
  // diversity index, top-builds report, etc.) can analyse what builds
  // actually clear vs which sit in the long tail.
  finalCatalysts: string[];
  perBlind: Array<{
    ante: number;
    blindIdx: number;
    blindId: string;
    isBoss: boolean;
    target: number;
    score: number;
    handsUsed: number;
    outcome: 'clear' | 'bust';
  }>;
  actionLog: Action[];
}

export interface DriveOptions {
  constellationId: string;
  stakeId: string;
  challengeId?: string;
  strategy: Strategy;
  recordActions?: boolean;
  maxIterations?: number;
  // When true, skip the initial NEW_RUN dispatch (caller has already set up
  // the run + any pre-run catalyst grants). Used by the catalyst impact study.
  skipNewRun?: boolean;
}

const MAX_ITER_DEFAULT = 5000;

export function driveRun(seed: number, opts: DriveOptions): RunRecord {
  const record: RunRecord = {
    seed,
    constellationId: opts.constellationId,
    stakeId: opts.stakeId,
    challengeId: opts.challengeId ?? '',
    strategyId: opts.strategy.id,
    finalAnte: 1,
    goalsCleared: 0,
    won: false,
    finalScore: 0,
    totalHandsPlayed: 0,
    totalShardsEarned: 0,
    catalystsBought: 0,
    vouchersBought: 0,
    consumablesBought: 0,
    modsBought: 0,
    packsBought: 0,
    shopRerolls: 0,
    finalShards: 0,
    bustReason: 'unknown',
    combosPlayed: {},
    finalCatalysts: [],
    perBlind: [],
    actionLog: [],
  };

  const fire = (a: Action) => {
    if (opts.recordActions) record.actionLog.push(a);
    dispatch(a);
  };

  if (!opts.skipNewRun) {
    fire({ type: 'NEW_RUN', constellationId: opts.constellationId, stakeId: opts.stakeId, challengeId: opts.challengeId });
    // Override seed AFTER NEW_RUN (which calls Math.random for seed too)
    store.setState((s) => ({ ...s, run: { ...s.run, seed } }), true);
  } else {
    // Caller has already done NEW_RUN; just align the seed.
    store.setState((s) => ({ ...s, run: { ...s.run, seed } }), true);
  }

  // Attach telemetry to THIS record so per-blind entries land where the
  // bust-reason check reads from.
  const detach = attachTelemetry(record);

  let iter = 0;
  const maxIter = opts.maxIterations ?? MAX_ITER_DEFAULT;
  let prevShards = 0;

  while (iter++ < maxIter) {
    const s = store.getState();
    const screen = s.ui.screen;

    if (screen === 'win' || screen === 'fail') {
      record.won = screen === 'win';
      record.finalScore = s.round.score;
      record.finalAnte = s.run.ante;
      record.goalsCleared = s.run.goalIdx;
      record.bustReason = screen === 'win' ? 'won' : (record.perBlind.at(-1)?.outcome === 'bust' ? 'target_miss' : 'unknown');
      record.finalCatalysts = [...s.run.catalysts];
      record.finalShards = s.run.shards;
      detach();
      return record;
    }

    // Between rounds: hub or post-shop ('round' screen but !round.active).
    if (!s.round.active && (screen === 'hub' || screen === 'round')) {
      fire({ type: 'START_BLIND' });
      continue;
    }

    if (screen === 'shop') {
      runShopPhase(opts.strategy, fire, record);
      continue;
    }

    if (s.round.active) {
      // Round phase
      if (!s.round.firstRollDone) {
        fire({ type: 'ROLL_REQUESTED' });
        continue;
      }
      if (s.round.scoring) {
        // SCORE_HAND emitted earlier; need END_SCORING to transition.
        fire({ type: 'END_SCORING' });
        continue;
      }

      // Strategy decides locks vs current state, then either score or reroll.
      const desired = new Set(opts.strategy.pickDiceToLock(s));
      for (let i = 0; i < s.round.dice.length; i++) {
        const die = s.round.dice[i]!;
        const wantLocked = desired.has(i);
        if (die.locked !== wantLocked) {
          fire({ type: 'TOGGLE_LOCK', dieIdx: i });
        }
      }

      // Re-read state after lock toggles.
      const after = store.getState();
      if (opts.strategy.shouldScore(after)) {
        const comboBefore = after.round.lastScoringCtx?.combo?.id;
        fire({ type: 'SCORE_HAND' });
        const post = store.getState();
        const combo = post.round.lastScoringCtx?.combo?.id ?? 'no_combo';
        record.combosPlayed[combo] = (record.combosPlayed[combo] ?? 0) + 1;
        record.totalHandsPlayed++;
        // Loop iterates → catches scoring=true → dispatches END_SCORING
        // Avoid unused var warning
        void comboBefore;
        continue;
      }
      if (after.round.rerollsLeft > 0) {
        fire({ type: 'REROLL_REQUESTED' });
        continue;
      }
      // No rerolls left and not scoring? Force score.
      fire({ type: 'SCORE_HAND' });
      const post = store.getState();
      const combo = post.round.lastScoringCtx?.combo?.id ?? 'no_combo';
      record.combosPlayed[combo] = (record.combosPlayed[combo] ?? 0) + 1;
      record.totalHandsPlayed++;
      continue;
    }

    // Round inactive but not on hub/shop/win/fail — shouldn't happen, break.
    break;
  }

  // Hit iteration cap — record as aborted
  const s = store.getState();
  record.finalScore = s.round.score;
  record.finalAnte = s.run.ante;
  record.goalsCleared = s.run.goalIdx;
  record.finalShards = s.run.shards;
  record.bustReason = 'iter_cap';
  detach();
  return record;

  // Track shards to backfill totalShardsEarned later via blind-cleared events
  // (we wire this through telemetry.ts when needed).
  void prevShards;
}

function runShopPhase(strategy: Strategy, fire: (a: Action) => void, record: RunRecord): void {
  // OPEN_SHOP not auto-dispatched headlessly — fire it ourselves.
  if (!store.getState().shop.open) fire({ type: 'OPEN_SHOP' });
  let safety = 50;
  while (safety-- > 0) {
    const s = store.getState();
    if (s.ui.screen !== 'shop') return;
    if (s.shop.pendingPack) {
      const a = strategy.pickFromPack(s);
      fire(a);
      // After picking, picksLeft decrements; re-iterate
      const post = store.getState();
      // If pendingPack is gone, fall through to next iteration
      if (!post.shop.pendingPack) continue;
      // Still pending — continue picking
      continue;
    }
    const a = strategy.chooseShopAction(s);
    if (a.type === 'BUY_OFFER') {
      const offer = s.shop.offers[a.offerIdx];
      if (offer) {
        if (offer.kind === 'catalyst') record.catalystsBought++;
        else if (offer.kind === 'voucher') record.vouchersBought++;
        else if (offer.kind === 'consumable') record.consumablesBought++;
        else if (offer.kind === 'mod') record.modsBought++;
        else if (offer.kind === 'pack') record.packsBought++;
      }
    } else if (a.type === 'REROLL_SHOP') {
      record.shopRerolls++;
    }
    fire(a);
    if (a.type === 'CLOSE_SHOP') return;
  }
}
