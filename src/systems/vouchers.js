// Voucher effect resolution. Phase 6.
//
// Vouchers (src/data/vouchers.js) grant permanent per-run effects. Each
// effect is a key/value pair on the voucher's `effect` object; consumers
// call getVoucherEffect('shopSlots', 3) to compute the combined value
// across all owned vouchers.

import { getState, actions } from '../state/store.js';
import { ALL_VOUCHERS, lookupVoucher } from '../data/vouchers.js';

// Combination rules per key
const COMBINE_MAX  = new Set(['shopSlots', 'runeSlots', 'startingDice', 'rareBias']);
const COMBINE_SUM  = new Set(['shardsPerHand', 'extraOracleSlot']);
const COMBINE_MULT = new Set(['priceMult']);
const COMBINE_OR   = new Set(['freeFirstReroll']);

export function getVoucherEffect(key, defaultValue) {
  const owned = getState().vouchers || [];
  if (owned.length === 0) return defaultValue;

  let val = defaultValue;
  for (const id of owned) {
    const def = lookupVoucher(id);
    if (!def || def.effect == null || !(key in def.effect)) continue;
    const v = def.effect[key];
    if (COMBINE_MAX.has(key))       val = Math.max(val, v);
    else if (COMBINE_SUM.has(key))  val = val + v;
    else if (COMBINE_MULT.has(key)) val = val * v;
    else if (COMBINE_OR.has(key))   val = val || !!v;
    else                            val = v;  // plain override
  }
  return val;
}

// Grant a random voucher the player doesn't already own.
export function grantRandomVoucher(anteCutoff = 2) {
  const owned = new Set(getState().vouchers || []);
  const pool = ALL_VOUCHERS.filter(v =>
    !owned.has(v.id) && (v.availableFromAnte || 1) <= anteCutoff
  );
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  actions.addVoucher(pick.id);
  return pick;
}

// Attempt to claim the free-first-reroll effect in a single shop visit.
// The flag is store-state so multiple voucher copies don't double-claim.
export function tryClaimFreeFirstReroll() {
  const st = getState();
  if (!getVoucherEffect('freeFirstReroll', false)) return false;
  if (st.freeRerollClaimedThisShop) return false;
  actions.setState?.({ freeRerollClaimedThisShop: true }); // noop if absent
  return true;
}
