// Zustand vanilla store — single source of truth for new gameplay systems
// (blinds, consumables, vouchers). Legacy globals in main.js remain untouched
// during the overhaul and will be migrated opportunistically in Phase 9.
//
// Import in any module:
//   import { getState, setState, subscribe, actions } from './state/store.js'
//
// This store is non-reactive (no React). Consumers that need to react to
// changes call `subscribe(selector, callback)` and drive their own redraw.

import { createStore } from 'zustand/vanilla';

// ─── Default state ────────────────────────────────────────────────────────
const defaultState = {
  // Blind / Ante (Phase 4)
  currentAnte:        1,          // 1..4 (Endless extends past 4)
  currentBlindIndex:  0,          // 0=Small, 1=Big, 2=Boss
  activeBlind:        null,       // { id, name, icon, debuffs[], targetMult }
  bossBlindPool:      [],         // [id, id, id, ...] shuffled deck
  blindsCleared:      0,          // total across run
  blindSkipped:       false,      // last blind was skipped (Small/Big only)
  pendingTags:        [],         // tag bonuses granted by skipping blinds

  // Consumables (Phase 5)
  consumables:        [],         // array of { id, type }
  consumableSlots:    4,          // max holdable (may grow via Voucher)
  consumableTargeting: null,      // { index, targetType } when in targeting mode

  // Pending per-hand effect flags (set by consumables, consumed in playHand)
  doubleChipsPending: false,
  starActive:         false,
  freeRerollPending:  false,
  lockAllNextRoll:    false,

  // Vouchers (Phase 6)
  vouchers:           [],         // array of voucher ids

  // Three.js renderer state (Phase 3)
  useThreeDice:       false,      // flips true after initDice3D succeeds

  // Transitions (Phase 8)
  transitionState:    null,       // { progress, direction, to, from }
  slideBlocking:      false,      // blocks input during a transition

  // Constellation Chain (scoring layer)
  chainLen:           0,          // consecutive-same-or-higher combo count
  chainTier:         -1,          // tier of the last scored combo (-1 = none)

  // Stake (pre-roll combo prediction)
  stakeTier:         -1,          // -1 = no stake; 0..8 = predicted combo tier

  // Overcharge (post-target push)
  overchargeShards:   0,          // accumulated shards earned past the goal
};

export const gameStore = createStore(() => ({ ...defaultState }));

// ─── Public API ───────────────────────────────────────────────────────────
export const getState = () => gameStore.getState();
export const setState = (partial) => gameStore.setState(partial);
export const subscribe = gameStore.subscribe;
export const resetStore = () => gameStore.setState({ ...defaultState });

// ─── Action helpers (kept thin; business logic lives in system modules) ───
export const actions = {
  // Blind
  setActiveBlind: (blind) => setState({ activeBlind: blind }),
  advanceBlindIndex: () => {
    const { currentBlindIndex, currentAnte } = getState();
    const next = currentBlindIndex + 1;
    if (next > 2) {
      setState({ currentAnte: currentAnte + 1, currentBlindIndex: 0 });
    } else {
      setState({ currentBlindIndex: next });
    }
  },
  clearBlindSkip: () => setState({ blindSkipped: false }),

  // Consumables
  addConsumable: (c) => {
    const { consumables, consumableSlots } = getState();
    if (consumables.length >= consumableSlots) return false;
    setState({ consumables: [...consumables, c] });
    return true;
  },
  removeConsumable: (index) => {
    const { consumables } = getState();
    const next = consumables.slice();
    next.splice(index, 1);
    setState({ consumables: next });
  },
  startTargeting: (index, targetType) =>
    setState({ consumableTargeting: { index, targetType } }),
  cancelTargeting: () => setState({ consumableTargeting: null }),

  // Vouchers
  addVoucher: (id) => {
    const { vouchers } = getState();
    if (vouchers.includes(id)) return false;
    setState({ vouchers: [...vouchers, id] });
    return true;
  },
  hasVoucher: (id) => getState().vouchers.includes(id),

  // Transitions
  startTransition: (to) =>
    setState({ transitionState: { progress: 0, direction: 'in', to }, slideBlocking: true }),
  endTransition: () =>
    setState({ transitionState: null, slideBlocking: false }),
};

// ─── Serialization (for save/load) ────────────────────────────────────────
// Only persistable slices. Rendering/transition state is not serialized.
export function serializeStoreSlice() {
  const s = getState();
  return {
    currentAnte:       s.currentAnte,
    currentBlindIndex: s.currentBlindIndex,
    activeBlindId:     s.activeBlind?.id ?? null,
    bossBlindPool:     s.bossBlindPool,
    blindsCleared:     s.blindsCleared,
    pendingTags:       s.pendingTags,
    consumables:       s.consumables,
    vouchers:          s.vouchers,
  };
}

export function hydrateStoreSlice(data, bossBlindLookup) {
  if (!data) return;
  const blind = data.activeBlindId && bossBlindLookup
    ? bossBlindLookup(data.activeBlindId)
    : null;
  setState({
    currentAnte:       data.currentAnte ?? 1,
    currentBlindIndex: data.currentBlindIndex ?? 0,
    activeBlind:       blind,
    bossBlindPool:     Array.isArray(data.bossBlindPool) ? data.bossBlindPool : [],
    blindsCleared:     data.blindsCleared ?? 0,
    pendingTags:       Array.isArray(data.pendingTags) ? data.pendingTags : [],
    consumables:       Array.isArray(data.consumables) ? data.consumables : [],
    vouchers:          Array.isArray(data.vouchers) ? data.vouchers : [],
  });
}

// Dev affordance — only in dev builds
if (import.meta.env && import.meta.env.DEV) {
  if (typeof window !== 'undefined') window.__gameStore = gameStore;
}
