// Strategies decide what the headless player does each frame.
// Each strategy is a set of pure functions over the GameState.
//
// We deliberately keep the interface small and synchronous: the harness
// calls strategy.* once per game-state transition, dispatches the chosen
// action, then re-asks. No internal state in strategies (yet) — if we need
// memory across decisions we'll add a per-run scratch object later.

import type { GameState } from '../../src-next/state/store';

export type LockSet = number[];

export type ShopAction =
  | { type: 'BUY_OFFER'; offerIdx: number }
  | { type: 'REROLL_SHOP' }
  | { type: 'SELL_UPGRADE'; kind: 'catalyst' | 'voucher' | 'consumable' | 'mod'; index: number }
  | { type: 'CLOSE_SHOP' };

export type PackAction =
  | { type: 'PICK_FROM_PACK'; galaxyIdx: number }
  | { type: 'SKIP_PACK' };

export interface Strategy {
  readonly id: string;
  pickDiceToLock(state: GameState): LockSet;
  shouldScore(state: GameState): boolean;
  chooseShopAction(state: GameState): ShopAction;
  pickFromPack(state: GameState): PackAction;
}

// ---------------------------------------------------------------------------
// Random — the floor strategy. Uses its own seeded RNG independent of
// Math.random so we don't pollute the gameplay RNG stream.

class StratRng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(lo: number, hi: number): number { return lo + Math.floor(this.next() * (hi - lo + 1)); }
}

export function createRandomStrategy(seed: number): Strategy {
  const rng = new StratRng(seed);
  return {
    id: 'random',
    pickDiceToLock(s) {
      const out: number[] = [];
      for (let i = 0; i < s.round.dice.length; i++) {
        if (rng.next() < 0.5) out.push(i);
      }
      return out;
    },
    shouldScore(s) {
      if (s.round.handsLeft <= 1) return true;
      if (s.round.rerollsLeft <= 0) return true;
      return rng.next() < 0.3;
    },
    chooseShopAction(s) {
      const offers = s.shop.offers;
      const affordable = offers
        .map((o, i) => ({ o, i }))
        .filter(({ o }) => s.run.shards >= o.price);
      if (affordable.length > 0 && rng.next() < 0.6) {
        const pick = affordable[rng.int(0, affordable.length - 1)]!;
        return { type: 'BUY_OFFER', offerIdx: pick.i };
      }
      if (s.run.shards >= s.shop.rerollCost && rng.next() < 0.2) {
        return { type: 'REROLL_SHOP' };
      }
      return { type: 'CLOSE_SHOP' };
    },
    pickFromPack(s) {
      const pack = s.shop.pendingPack;
      if (!pack) return { type: 'SKIP_PACK' };
      const choices = pack.galaxyIds
        .map((g, i) => ({ g, i }))
        .filter(({ g }) => !pack.pickedSoFar.includes(g));
      if (choices.length === 0) return { type: 'SKIP_PACK' };
      const pick = choices[rng.int(0, choices.length - 1)]!;
      return { type: 'PICK_FROM_PACK', galaxyIdx: pick.i };
    },
  };
}

// ---------------------------------------------------------------------------
// Greedy — locks dice that match the modal face value. Scores when the hand
// already covers a useful combo, otherwise rerolls.

function modeFace(faces: number[]): number {
  const counts = new Map<number, number>();
  let best = faces[0] ?? 1;
  let bestCount = 0;
  for (const f of faces) {
    const c = (counts.get(f) ?? 0) + 1;
    counts.set(f, c);
    if (c > bestCount) { best = f; bestCount = c; }
  }
  return best;
}

export function createGreedyStrategy(): Strategy {
  return {
    id: 'greedy',
    pickDiceToLock(s) {
      const faces = s.round.dice.map((d) => d.face);
      if (faces.length <= 1) return [0];
      const target = modeFace(faces);
      const out: number[] = [];
      for (let i = 0; i < faces.length; i++) {
        if (faces[i] === target) out.push(i);
      }
      // If only one die matches, keep top-2 highest faces too
      if (out.length === 1) {
        const sorted = faces.map((f, i) => ({ f, i })).sort((a, b) => b.f - a.f);
        for (const { i } of sorted.slice(0, 2)) {
          if (!out.includes(i)) out.push(i);
        }
      }
      return out;
    },
    shouldScore(s) {
      if (s.round.handsLeft <= 1) return true;
      if (s.round.rerollsLeft <= 0) return true;
      const faces = s.round.dice.map((d) => d.face);
      const counts = new Map<number, number>();
      for (const f of faces) counts.set(f, (counts.get(f) ?? 0) + 1);
      const max = Math.max(0, ...counts.values());
      // Score when we have a 3-of-a-kind or better — otherwise reroll.
      return max >= 3;
    },
    chooseShopAction(s) {
      const offers = s.shop.offers;
      // Buy any catalyst we can afford, then any consumable, then voucher.
      const order: Array<'catalyst' | 'voucher' | 'consumable' | 'mod' | 'pack'> = ['catalyst', 'voucher', 'consumable', 'mod', 'pack'];
      for (const kind of order) {
        for (let i = 0; i < offers.length; i++) {
          const o = offers[i]!;
          if (o.kind === kind && s.run.shards >= o.price) {
            return { type: 'BUY_OFFER', offerIdx: i };
          }
        }
      }
      return { type: 'CLOSE_SHOP' };
    },
    pickFromPack(s) {
      const pack = s.shop.pendingPack;
      if (!pack) return { type: 'SKIP_PACK' };
      for (let i = 0; i < pack.galaxyIds.length; i++) {
        const g = pack.galaxyIds[i]!;
        if (!pack.pickedSoFar.includes(g)) return { type: 'PICK_FROM_PACK', galaxyIdx: i };
      }
      return { type: 'SKIP_PACK' };
    },
  };
}

// ---------------------------------------------------------------------------
// EVKeep — for each candidate lock set, estimate expected combo upgrade
// over remaining rerolls. Bounded enumeration; for >6 dice we only consider
// "lock all of face X" sets which is what dice strategy mostly reduces to.
//
// This is the strategy used as the "plays well" baseline for balance studies.

export function createEvKeepStrategy(): Strategy {
  return {
    id: 'evkeep',
    pickDiceToLock(s) {
      const faces = s.round.dice.map((d) => d.face);
      if (faces.length === 0) return [];
      // Build lock-set candidates: per face value, lock all dice showing it.
      // Plus the trivial "lock everything" and "lock the best subset by face".
      const counts = new Map<number, number[]>();
      for (let i = 0; i < faces.length; i++) {
        const f = faces[i]!;
        if (!counts.has(f)) counts.set(f, []);
        counts.get(f)!.push(i);
      }
      // Score each lock set: simulate remaining dice as uniform random over
      // [1..6]. Approximate combo tier of resulting hand.
      let best: number[] = [];
      let bestScore = -Infinity;
      for (const idxs of counts.values()) {
        const score = scoreLockSet(faces, idxs);
        if (score > bestScore) { bestScore = score; best = idxs; }
      }
      // Also consider locking the highest face only (for captain_crew Argo).
      const highIdx = faces.reduce((bi, f, i) => f > (faces[bi] ?? 0) ? i : bi, 0);
      const highScore = scoreLockSet(faces, [highIdx]);
      if (highScore > bestScore) { bestScore = highScore; best = [highIdx]; }
      return best;
    },
    shouldScore(s) {
      if (s.round.handsLeft <= 1) return true;
      if (s.round.rerollsLeft <= 0) return true;
      const faces = s.round.dice.map((d) => d.face);
      const counts = new Map<number, number>();
      for (const f of faces) counts.set(f, (counts.get(f) ?? 0) + 1);
      const sorted = [...counts.values()].sort((a, b) => b - a);
      const max = sorted[0] ?? 0;
      const isFullHouse = sorted[0] === 3 && sorted[1] === 2;
      // Patient: only score on 4oak+ or full-house when rerolls are available.
      // Otherwise reroll — those extra rerolls are how late-game scores get built.
      return max >= 4 || isFullHouse;
    },
    chooseShopAction(s) {
      const offers = s.shop.offers;
      // Prioritise: cheapest unowned voucher, then catalyst, then consumable.
      const ranked = offers
        .map((o, i) => ({ o, i }))
        .filter(({ o }) => s.run.shards >= o.price)
        .sort((a, b) => priceWeight(a.o) - priceWeight(b.o));
      if (ranked[0]) return { type: 'BUY_OFFER', offerIdx: ranked[0].i };
      // Reroll once if affordable and we still have spare shards.
      if (s.run.shards >= s.shop.rerollCost + 5) return { type: 'REROLL_SHOP' };
      return { type: 'CLOSE_SHOP' };
    },
    pickFromPack(s) {
      const pack = s.shop.pendingPack;
      if (!pack) return { type: 'SKIP_PACK' };
      // Always pick first unpicked.
      for (let i = 0; i < pack.galaxyIds.length; i++) {
        const g = pack.galaxyIds[i]!;
        if (!pack.pickedSoFar.includes(g)) return { type: 'PICK_FROM_PACK', galaxyIdx: i };
      }
      return { type: 'SKIP_PACK' };
    },
  };
}

function scoreLockSet(faces: number[], lockedIdxs: number[]): number {
  // Heuristic: combo tier proxy. Bigger groups score higher.
  const lockedFaces = lockedIdxs.map((i) => faces[i]!);
  const counts = new Map<number, number>();
  for (const f of lockedFaces) counts.set(f, (counts.get(f) ?? 0) + 1);
  const sorted = [...counts.values()].sort((a, b) => b - a);
  const top = sorted[0] ?? 0;
  const second = sorted[1] ?? 0;
  // 5oak > 4oak > full > 3oak > 2pair > pair > singles
  if (top >= 5) return 100;
  if (top === 4) return 80;
  if (top === 3 && second === 2) return 70;
  if (top === 3) return 60;
  if (top === 2 && second === 2) return 50;
  if (top === 2) return 40;
  return 10;
}

function priceWeight(o: { kind: string; price: number }): number {
  // Lower = preferred. Vouchers are permanent so heavily preferred per-shard.
  const kindBonus = o.kind === 'voucher' ? -2 : o.kind === 'catalyst' ? 0 : 1;
  return o.price + kindBonus;
}

// ---------------------------------------------------------------------------
// HeuristicShop — wraps EVKeep's round play but layers in archetype-coherent
// shop logic (mirrors the 70/30 shop bias). Used for the "realistic player"
// comparison in balance studies.

import { CATALYST_META } from '../../src-next/data/catalysts';

export function createHeuristicShopStrategy(): Strategy {
  const base = createEvKeepStrategy();
  return {
    id: 'heuristic_shop',
    pickDiceToLock: base.pickDiceToLock,
    shouldScore: base.shouldScore,
    pickFromPack: base.pickFromPack,
    chooseShopAction(s) {
      const offers = s.shop.offers;
      // Compute dominant archetype across owned catalysts.
      const archetypeCounts = new Map<string, number>();
      for (const id of s.run.catalysts) {
        const meta = CATALYST_META.find((m) => m.id === id);
        if (meta?.archetype) archetypeCounts.set(meta.archetype, (archetypeCounts.get(meta.archetype) ?? 0) + 1);
      }
      const dominant = [...archetypeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      // Score every offer.
      const ranked = offers
        .map((o, i) => ({ o, i, score: scoreShopOffer(o, s, dominant) }))
        .filter(({ o }) => s.run.shards >= o.price)
        .sort((a, b) => b.score - a.score);
      if (ranked[0] && ranked[0].score > 0) return { type: 'BUY_OFFER', offerIdx: ranked[0].i };
      // Reroll if shards are healthy and no good offers.
      if (s.run.shards >= s.shop.rerollCost + 8 && offers.length > 0) return { type: 'REROLL_SHOP' };
      return { type: 'CLOSE_SHOP' };
    },
  };
}

function scoreShopOffer(o: { kind: string; id: string; price: number }, s: GameState, dominantArchetype: string | undefined): number {
  let score = 0;
  if (o.kind === 'catalyst') {
    const meta = CATALYST_META.find((m) => m.id === o.id);
    score = 50; // Catalysts are core value — buy aggressively
    if (meta?.archetype && meta.archetype === dominantArchetype) score += 20;
    if (meta?.rarity === 'rare') score += 15;
    if (meta?.rarity === 'legendary') score += 40;
  } else if (o.kind === 'voucher') {
    score = 70; // Permanent — heavily preferred
  } else if (o.kind === 'consumable') {
    score = 10;
  } else if (o.kind === 'mod') {
    score = 25;
  } else if (o.kind === 'pack') {
    score = 35;
  }
  // Mild poverty penalty — only bail if leaving us at 0 with no clear next shop.
  if (s.run.shards - o.price < 0) score = -1000;
  return score;
}
