// Blind/Ante progression systems. Phase 4.
//
// Provides debuff checks and round-start logic. Hooks into main.js at a few
// key call-sites; all checks are pure reads of the Zustand store so they're
// cheap to call.

import { getState, setState } from '../state/store.js';
import {
  BLIND_DEFS, BOSS_BLINDS, ANTE_BASE_TARGETS,
  targetForBlind, shuffleBossBlindPool, lookupBossBlind, getBlindDef,
} from '../data/blinds.js';

// ─── Goal ↔ (ante, blindIndex) mapping ────────────────────────────────────
// The legacy main.js uses a single integer `runGoal` (0..N-1) to track
// progress. We reinterpret it as 3 blinds per ante:
//   goal 0..2  → ante 1, blinds 0..2
//   goal 3..5  → ante 2, blinds 0..2
//   ...
export function anteFromGoal(goal)       { return Math.floor(goal / 3) + 1; }
export function blindIndexFromGoal(goal) { return goal % 3; }

// Full 12-entry goal target array for Antes 1..4, replacing the original 8.
export const BLIND_GOAL_TARGETS = (() => {
  const out = [];
  for (let ante = 1; ante <= ANTE_BASE_TARGETS.length; ante++) {
    for (let bi = 0; bi < 3; bi++) {
      out.push(targetForBlind(ante, bi, false));
    }
  }
  return out;
})();

export function endlessTarget(goal) {
  // Past the designed antes, scale exponentially
  const anteIdx = Math.floor(goal / 3); // 0-based
  const bi = goal % 3;
  return targetForBlind(anteIdx + 1, bi, true);
}

// ─── Round-start: set activeBlind based on the current goal ───────────────
// Called by main.js when entering a new round (before the first roll).
export function onRoundStart(runGoal) {
  const blindIdx = blindIndexFromGoal(runGoal);
  const blindDef = getBlindDef(blindIdx);

  if (!blindDef.isBoss) {
    // Small/Big Blind: no debuff. Store the blind meta for HUD.
    setState({
      activeBlind: {
        id:       blindIdx === 0 ? 'small_blind' : 'big_blind',
        name:     blindDef.name,
        icon:     blindIdx === 0 ? '○' : '◐',
        color:    blindIdx === 0 ? '#b8a874' : '#ffcc44',
        debuffs:  [],
        isBoss:   false,
      },
      currentBlindIndex: blindIdx,
      currentAnte: anteFromGoal(runGoal),
    });
    return;
  }

  // Boss Blind: pull from the pool, refill if empty.
  let pool = getState().bossBlindPool;
  if (!pool || pool.length === 0) pool = shuffleBossBlindPool();
  const nextId  = pool[0];
  const nextPool = pool.slice(1);
  const boss = lookupBossBlind(nextId) || BOSS_BLINDS[0];

  setState({
    activeBlind: {
      id:       boss.id,
      name:     boss.name,
      icon:     boss.icon,
      color:    boss.color,
      description: boss.description,
      debuffs:  boss.debuffs,
      isBoss:   true,
    },
    bossBlindPool:     nextPool,
    currentBlindIndex: blindIdx,
    currentAnte:       anteFromGoal(runGoal),
  });
}

// Called by main.js after a round clears.
export function onRoundCleared() {
  const st = getState();
  setState({
    activeBlind:    null,
    blindsCleared:  st.blindsCleared + 1,
  });
}

// ─── Debuff checks ────────────────────────────────────────────────────────
export function hasBlindDebuff(debuffId) {
  const b = getState().activeBlind;
  return !!(b && b.debuffs && b.debuffs.includes(debuffId));
}

// Convenience wrappers used by main.js integration points.
export function bossDisablesOracles()   { return hasBlindDebuff('disable_oracles'); }
export function bossForbidsRerolls()    { return hasBlindDebuff('no_rerolls'); }
export function bossAutoUnlocks()       { return hasBlindDebuff('auto_unlock_after_roll'); }
export function bossCapsHandSizeTo4()   { return hasBlindDebuff('hand_size_cap_4'); }
export function bossBlocksOneRuneXforms() { return hasBlindDebuff('no_rune_transforms_on_ones'); }

// Blind-clear shard reward (bonus on top of base).
export function blindClearReward(runGoal, overshoot = 0) {
  const bi = blindIndexFromGoal(runGoal);
  const def = getBlindDef(bi);
  const base = bi === 0 ? 3 : bi === 1 ? 5 : 8;
  const overshootBonus = Math.floor(overshoot / 500);
  return base + overshootBonus;
}

// Reset blind state at run start.
export function resetBlindRun() {
  setState({
    activeBlind:       null,
    bossBlindPool:     shuffleBossBlindPool(),
    currentAnte:       1,
    currentBlindIndex: 0,
    blindsCleared:     0,
    pendingTags:       [],
  });
}
