// Pure scoring helpers. Imported by main.js. Side-effect free.
//
// Phase: initial extraction. Currently exports combo detection and the
// Constellation Chain layer. Remaining live-scoring math still lives in
// main.js — only what's safely pure has moved.

export const COMBOS = [
  { id:'five_kind',   name:'Five of a Kind',  tier:8, chips:100, mult:20,
    test: v => v[0] >= 5 },
  { id:'four_kind',   name:'Four of a Kind',  tier:7, chips:60,  mult:12,
    test: v => v[0] >= 4 },
  { id:'lg_straight', name:'Large Straight',  tier:6, chips:40,  mult:7,
    test: (_,seq) => seq >= 5 },
  { id:'full_house',  name:'Full House',      tier:5, chips:35,  mult:8,
    test: v => (v[0]===3 && v[1]===2) },
  { id:'sm_straight', name:'Small Straight',  tier:4, chips:30,  mult:5,
    test: (_,seq) => seq >= 4 },
  { id:'three_kind',  name:'Three of a Kind', tier:3, chips:30,  mult:5,
    test: v => v[0] >= 3 },
  { id:'two_pair',    name:'Two Pair',        tier:2, chips:20,  mult:3,
    test: v => v[0] >= 2 && v[1] >= 2 },
  { id:'one_pair',    name:'One Pair',        tier:1, chips:10,  mult:2,
    test: v => v[0] >= 2 },
  { id:'chance',      name:'Chance',          tier:0, chips:0,   mult:1,
    test: () => true },
];

export function detectCombo(faces) {
  const counts = [0,0,0,0,0,0,0];
  for (const f of faces) counts[f]++;
  const vals = counts.filter(c => c > 0).sort((a,b) => b - a);

  const present = [...new Set(faces)].sort((a,b) => a - b);
  let seq = 1, best = 1;
  for (let i = 1; i < present.length; i++) {
    seq = present[i] === present[i-1] + 1 ? seq + 1 : 1;
    best = Math.max(best, seq);
  }

  for (const c of COMBOS) {
    if (c.test(vals, best)) return { ...c };
  }
  return { ...COMBOS[COMBOS.length - 1] };
}

// ─── Constellation Chain ──────────────────────────────────────────────
// Consecutive same-or-higher tier hands extend the chain. Lower tier or
// bust resets to 0. chainMult = 1 + 0.25 * chainLen, capped at chainLen 8.
const CHAIN_MAX  = 8;
const CHAIN_STEP = 0.25;

export function applyChain(currentTier, prevChainLen, prevChainTier) {
  let chainLen, chainTier;
  if (prevChainLen > 0 && currentTier >= prevChainTier) {
    chainLen  = Math.min(CHAIN_MAX, prevChainLen + 1);
    chainTier = currentTier;
  } else if (prevChainLen === 0) {
    chainLen  = 1;
    chainTier = currentTier;
  } else {
    chainLen  = 0;
    chainTier = -1;
  }
  const chainMult = 1 + CHAIN_STEP * Math.max(0, chainLen - 1);
  return { chainLen, chainTier, chainMult, broke: chainLen === 0 && prevChainLen >= 2 };
}

export function chainBreakRefund(prevChainLen) {
  return Math.max(0, prevChainLen) * 2;
}
