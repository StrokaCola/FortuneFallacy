// Consumable-card action bridge. Phase 5.
//
// Consumable definitions (src/data/consumables.js) have an abstract
// apply(ctx, targets) API. This module supplies the `ctx` with concrete
// mutators that talk to main.js state via closure-captured setters.
//
// main.js calls wireConsumableBridge(…) once during boot, passing in the
// game's own mutator functions. After that, useConsumable(index, targets)
// executes the consumable and removes it from the hand.

import { getState, setState, actions } from '../state/store.js';
import { lookupConsumable, ALL_CONSUMABLES } from '../data/consumables.js';

let bridge = null;

// Called from main.js boot with a set of closure mutators exposed from
// the legacy state scope. Unwired methods are no-ops.
export function wireConsumableBridge({
  setDieFace,
  addRuneToDie,
  addShards,
  duplicateOracle,
  handsLeft,
  setHandsLeft,
  rerollAllDice,
  destroyDice,
  convertAllDice,
  pickRandomRune,
}) {
  bridge = {
    setDieFace:       setDieFace       || noop,
    addRuneToDie:     addRuneToDie     || noop,
    addShards:        addShards        || noop,
    duplicateOracle:  duplicateOracle  || noFalse,
    handsLeft:        handsLeft        || (() => 0),
    setHandsLeft:     setHandsLeft     || noop,
    rerollAllDice:    rerollAllDice    || noop,
    destroyDice:      destroyDice      || noop,
    convertAllDice:   convertAllDice   || noop,
    pickRandomRune:   pickRandomRune   || (() => null),
  };
}

function noop() {}
function noFalse() { return false; }

// Build the ctx object passed to each consumable's apply().
function makeCtx() {
  if (!bridge) throw new Error('consumable bridge not wired');
  return {
    setDieFace:       bridge.setDieFace,
    addRuneToDie:     bridge.addRuneToDie,
    addShards:        bridge.addShards,
    duplicateOracle:  bridge.duplicateOracle,
    handsLeft:        bridge.handsLeft,
    setHandsLeft:     bridge.setHandsLeft,
    rerollAllDice:    bridge.rerollAllDice,
    destroyDice:      bridge.destroyDice,
    convertAllDice:   bridge.convertAllDice,
    pickRandomRune:   bridge.pickRandomRune,
    setPendingFlag:   (key, val) => setState({ [key]: val }),
  };
}

// Use the consumable at `index` in the hand.
// For targeting consumables, `targets` is an array describing what was
// clicked (die index, rune slot, etc).
// Returns true if the effect applied, false otherwise.
export function useConsumable(index, targets) {
  const state = getState();
  const card  = state.consumables[index];
  if (!card) return false;
  const def = lookupConsumable(card.id);
  if (!def) return false;

  if (def.requiresTarget && (!targets || targets.length === 0)) {
    actions.startTargeting(index, def.targetType);
    return false;
  }

  const ctx = makeCtx();
  let ok = true;
  try {
    const r = def.apply(ctx, targets || []);
    if (r === false) ok = false;
  } catch (err) {
    console.warn('Consumable apply threw:', err);
    ok = false;
  }
  if (ok) {
    actions.removeConsumable(index);
    actions.cancelTargeting();
  }
  return ok;
}

// Grant a random consumable of the given tier. Used as a reward on
// blind-clear. Returns the consumable instance added to the hand or null
// if the hand is full.
export function grantRandomConsumable(preferredTier = null) {
  const pool = preferredTier
    ? ALL_CONSUMABLES.filter(c => c.tier === preferredTier)
    : ALL_CONSUMABLES.filter(c => c.tier === 'common' || c.tier === 'uncommon');
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (!pick) return null;
  const ok = actions.addConsumable({ id: pick.id, type: pick.type });
  return ok ? pick : null;
}

// Click-consume a pending effect flag at scoring time.
export function consumePendingFlag(key) {
  const st = getState();
  if (!st[key]) return false;
  setState({ [key]: false });
  return true;
}
