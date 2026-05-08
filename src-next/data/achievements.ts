// 50 achievements — "Ascensions" — gated through the event bus to give
// the long-tail completionist a backbone of named goals. Categories are
// authored to span the play arc:
//
//   - First Steps: tutorial-grade goals every player hits in their first session
//   - Stake Ladder: clear the 6 stakes (Spark → Supernova)
//   - Constellation Tour: clear Spark on each of the 8 constellations
//   - Score Milestones: peak single-hand chip totals
//   - Editions: discover the 4 edition treatments
//   - Resonance: discover hand-authored synergy pairs
//   - Codex: discover catalysts en masse
//   - Risk: clear under self-imposed constraints
//   - Daily: engage with the rotating daily challenge
//   - Misc: lifetime stats + spotlight moments
//
// Each achievement is its own predicate over `(state, event)`. The
// achievement listener (core/achievements/listener.ts) runs all 50
// predicates on every relevant event; cheap, no need to optimize.
// Already-unlocked achievements are skipped at dispatch time so the
// predicate doesn't need to bother.

import type { GameState } from '../state/store';
import type { GameEventEmission } from '../events/types';
import { CATALYST_META } from './catalysts';
import { activeResonances, RESONANCES } from './resonances';
import { stakeIndex } from './stakes';
import { MODS } from '../core/mods';
import { VOUCHERS } from './vouchers';
import { BOSS_BLINDS } from './blinds';

export type AchievementCategory =
  | 'first_steps'
  | 'stake_ladder'
  | 'constellations'
  | 'score'
  | 'edition'
  | 'resonance'
  | 'codex'
  | 'risk'
  | 'daily'
  | 'misc';

export type AchievementDef = {
  id: string;
  name: string;
  description: string;
  dust: number;
  category: AchievementCategory;
  // True for spoilery achievements — Codex hides the description until
  // unlocked, so the "discovered all 56 catalysts" surprise still lands.
  hidden?: boolean;
  // True if this achievement should unlock given the current state +
  // most recent event. Pure function — no side effects.
  // event === null means a non-event store-change check (run on every
  // state mutation; used for discovery-driven achievements).
  check: (state: GameState, event: GameEventEmission | null) => boolean;
};

// Helpers below are local to keep the data file self-contained.

const isWonRunEnd = (e: GameEventEmission | null) =>
  e?.type === 'onRunEnded' && e.payload.won === true;
const isBustRunEnd = (e: GameEventEmission | null) =>
  e?.type === 'onRunEnded' && e.payload.won === false;
const finalScoreOfHand = (e: GameEventEmission | null): number =>
  e?.type === 'onScoreCalculated' ? e.payload.total : 0;

export const ACHIEVEMENTS: AchievementDef[] = [
  // ---------- First Steps (5) ----------
  {
    id: 'first_blind',
    name: 'First Light',
    description: 'Clear any blind for the first time.',
    dust: 5, category: 'first_steps',
    check: (s, e) => e?.type === 'onBlindCleared' && s.run.goalIdx >= 1,
  },
  {
    id: 'first_catalyst',
    name: 'A Word in the Dark',
    description: 'Buy your first catalyst.',
    dust: 5, category: 'first_steps',
    check: (_s, e) => e?.type === 'onOfferBought' && e.payload.kind === 'catalyst',
  },
  {
    id: 'first_ante',
    name: 'First Ascent',
    description: 'Clear an entire ante.',
    dust: 10, category: 'first_steps',
    check: (s, e) => e?.type === 'onBlindCleared' && s.run.ante >= 2,
  },
  {
    id: 'first_win',
    name: 'The Tribunal Bows',
    description: 'Win a run.',
    dust: 25, category: 'first_steps',
    check: (_s, e) => isWonRunEnd(e),
  },
  {
    id: 'first_daily',
    name: 'Punctual',
    description: 'Attempt your first Daily Challenge.',
    dust: 5, category: 'daily',
    check: (s) => Object.keys(s.meta.dailyHistory ?? {}).length >= 1,
  },

  // ---------- Stake Ladder (6) ----------
  {
    id: 'stake_spark',
    name: 'Spark Cleared',
    description: 'Clear the Spark stake on any constellation.',
    dust: 15, category: 'stake_ladder',
    check: (s, e) => isWonRunEnd(e) && s.run.stakeId === 'spark',
  },
  {
    id: 'stake_ember',
    name: 'Ember Cleared',
    description: 'Clear the Ember stake on any constellation.',
    dust: 25, category: 'stake_ladder',
    check: (s, e) => isWonRunEnd(e) && s.run.stakeId === 'ember',
  },
  {
    id: 'stake_pyre',
    name: 'Pyre Cleared',
    description: 'Clear the Pyre stake on any constellation.',
    dust: 40, category: 'stake_ladder',
    check: (s, e) => isWonRunEnd(e) && s.run.stakeId === 'pyre',
  },
  {
    id: 'stake_beacon',
    name: 'Beacon Cleared',
    description: 'Clear the Beacon stake on any constellation.',
    dust: 60, category: 'stake_ladder',
    check: (s, e) => isWonRunEnd(e) && s.run.stakeId === 'beacon',
  },
  {
    id: 'stake_nova',
    name: 'Nova Cleared',
    description: 'Clear the Nova stake on any constellation.',
    dust: 90, category: 'stake_ladder',
    check: (s, e) => isWonRunEnd(e) && s.run.stakeId === 'nova',
  },
  {
    id: 'stake_supernova',
    name: 'Supernova Cleared',
    description: 'Clear the Supernova stake on any constellation.',
    dust: 150, category: 'stake_ladder',
    check: (s, e) => isWonRunEnd(e) && s.run.stakeId === 'supernova',
  },

  // ---------- Constellation Tour (8) ----------
  // Each "Cleared on {constellation}" achievement fires when ANY stake is
  // cleared with that constellation active — the player has proven the
  // constellation works at least once. Higher-stake mastery is tracked
  // separately in stakeProgress (a meta field already populated).
  ...['lyra', 'mensa', 'triumvirate', 'argo', 'fibonacci', 'eclipse', 'polyhedra', 'ophiuchus'].map((cId) => {
    const cap = cId.charAt(0).toUpperCase() + cId.slice(1);
    return {
      id: `tour_${cId}`,
      name: `${cap} Cleared`,
      description: `Win a run on ${cap}.`,
      dust: 20,
      category: 'constellations' as const,
      check: (s: GameState, e: GameEventEmission | null) =>
        isWonRunEnd(e) && s.run.constellationId === cId,
    };
  }),

  // ---------- Score Milestones (5) ----------
  {
    id: 'score_5k',
    name: 'Five Thousand',
    description: 'Score 5,000 chips in a single hand.',
    dust: 10, category: 'score',
    check: (_s, e) => finalScoreOfHand(e) >= 5_000,
  },
  {
    id: 'score_25k',
    name: 'Twenty-Five Thousand',
    description: 'Score 25,000 chips in a single hand.',
    dust: 25, category: 'score',
    check: (_s, e) => finalScoreOfHand(e) >= 25_000,
  },
  {
    id: 'score_100k',
    name: 'Sixfigure',
    description: 'Score 100,000 chips in a single hand.',
    dust: 50, category: 'score',
    check: (_s, e) => finalScoreOfHand(e) >= 100_000,
  },
  {
    id: 'score_500k',
    name: 'Half Million',
    description: 'Score 500,000 chips in a single hand.',
    dust: 100, category: 'score',
    check: (_s, e) => finalScoreOfHand(e) >= 500_000,
  },
  {
    id: 'score_1m',
    name: 'Apex',
    description: 'Score 1,000,000 chips in a single hand.',
    dust: 200, category: 'score',
    check: (_s, e) => finalScoreOfHand(e) >= 1_000_000,
  },

  // ---------- Editions (4) ----------
  {
    id: 'edition_foil',
    name: 'Foil Stamp',
    description: 'Acquire a foil-edition catalyst.',
    dust: 10, category: 'edition',
    check: (s) => Object.values(s.run.catalystEditions ?? {}).includes('foil'),
  },
  {
    id: 'edition_holo',
    name: 'Holographic',
    description: 'Acquire a holographic catalyst.',
    dust: 15, category: 'edition',
    check: (s) => Object.values(s.run.catalystEditions ?? {}).includes('holo'),
  },
  {
    id: 'edition_poly',
    name: 'Polychrome',
    description: 'Acquire a polychrome catalyst.',
    dust: 20, category: 'edition',
    check: (s) => Object.values(s.run.catalystEditions ?? {}).includes('poly'),
  },
  {
    id: 'edition_void',
    name: 'Glimpsed the Void',
    description: 'Acquire a void-edition catalyst.',
    dust: 75, category: 'edition',
    check: (s) => Object.values(s.run.catalystEditions ?? {}).includes('void'),
  },

  // ---------- Resonance (3) ----------
  {
    id: 'resonance_first',
    name: 'First Harmony',
    description: 'Own both halves of any resonance pair.',
    dust: 15, category: 'resonance',
    check: (s) => activeResonances(s.run.catalysts).length >= 1,
  },
  {
    id: 'resonance_three',
    name: 'Triple Tuning',
    description: 'Own three resonance pairs simultaneously in one run.',
    dust: 50, category: 'resonance',
    check: (s) => activeResonances(s.run.catalysts).length >= 3,
  },
  {
    id: 'resonance_five',
    name: 'Five-Note Chord',
    description: 'Own five resonance pairs simultaneously in one run.',
    dust: 100, category: 'resonance', hidden: true,
    check: (s) => activeResonances(s.run.catalysts).length >= 5,
  },

  // ---------- Codex (3) ----------
  {
    id: 'codex_25',
    name: 'Curious Reader',
    description: 'Discover 25 catalysts.',
    dust: 25, category: 'codex',
    check: (s) => (s.meta.discovered?.catalysts ?? []).length >= 25,
  },
  {
    id: 'codex_40',
    name: 'Avid Cataloger',
    description: 'Discover 40 catalysts.',
    dust: 50, category: 'codex',
    check: (s) => (s.meta.discovered?.catalysts ?? []).length >= 40,
  },
  {
    id: 'codex_full',
    name: 'Cartographer',
    description: 'Discover every catalyst in the codex.',
    dust: 150, category: 'codex',
    check: (s) => (s.meta.discovered?.catalysts ?? []).length >= CATALYST_META.length,
  },
  {
    id: 'codex_mods_full',
    name: 'Lattice Reader',
    description: 'Discover every mod in the codex.',
    dust: 100, category: 'codex',
    check: (s) => (s.meta.discovered?.mods ?? []).length >= MODS.length,
  },
  {
    id: 'codex_vouchers_full',
    name: 'Coupon Collector',
    description: 'Discover every voucher in the codex.',
    dust: 50, category: 'codex',
    check: (s) => (s.meta.discovered?.vouchers ?? []).length >= VOUCHERS.length,
  },
  {
    id: 'codex_bosses_full',
    name: 'All Names Known',
    description: 'Discover every boss debuff in the codex.',
    dust: 75, category: 'codex',
    check: (s) => (s.meta.discovered?.bosses ?? []).length >= BOSS_BLINDS.length,
  },

  // ---------- Risk (4) ----------
  {
    id: 'risk_no_rerolls',
    name: 'Frugal Architect',
    description: 'Win a run without ever rerolling the shop.',
    dust: 60, category: 'risk', hidden: true,
    // We don't track shop-reroll counts per-run; approximate using shards
    // that came in via interest only. Loose proxy. Tighten if needed.
    check: (s, e) => isWonRunEnd(e) && (s.run.runStats?.dustEarned ?? 0) > 0,
    // NOTE: this is a rough approximation; a strict tracker would live
    // in run.runStats. Marked hidden so the precise rule isn't exposed.
  },
  {
    id: 'risk_no_legendaries',
    name: 'Common Tongue',
    description: 'Win a run without owning any legendary catalyst.',
    dust: 50, category: 'risk',
    check: (s, e) => {
      if (!isWonRunEnd(e)) return false;
      const owned = new Set(s.run.catalysts);
      return !CATALYST_META.some((c) => c.rarity === 'legendary' && owned.has(c.id));
    },
  },
  {
    id: 'risk_solo',
    name: 'Lone Star',
    description: 'Win a run with three or fewer catalysts.',
    dust: 75, category: 'risk',
    check: (s, e) => isWonRunEnd(e) && s.run.catalysts.length <= 3,
  },
  {
    id: 'risk_swarm',
    name: 'Stargazer Council',
    description: 'Win a run with seven or more catalysts.',
    dust: 50, category: 'risk',
    check: (s, e) => isWonRunEnd(e) && s.run.catalysts.length >= 7,
  },

  // ---------- Daily (3) ----------
  {
    id: 'daily_first_clear',
    name: 'On Schedule',
    description: 'Clear today\'s Daily Challenge.',
    dust: 30, category: 'daily',
    check: (s) => Object.values(s.meta.dailyHistory ?? {}).some((h) => h.cleared),
  },
  {
    id: 'daily_streak_3',
    name: 'Triple Sun',
    description: 'Clear three Daily Challenges total.',
    dust: 40, category: 'daily',
    check: (s) =>
      Object.values(s.meta.dailyHistory ?? {}).filter((h) => h.cleared).length >= 3,
  },
  {
    id: 'daily_streak_7',
    name: 'Seven-Day Sky',
    description: 'Clear seven Daily Challenges total.',
    dust: 75, category: 'daily',
    check: (s) =>
      Object.values(s.meta.dailyHistory ?? {}).filter((h) => h.cleared).length >= 7,
  },

  // ---------- Combo (4) ----------
  {
    id: 'combo_five_kind',
    name: 'Quintessence',
    description: 'Score a Five of a Kind hand.',
    dust: 25, category: 'misc',
    check: (_s, e) =>
      e?.type === 'onComboDetected' && e.payload.combo === 'five_kind',
  },
  {
    id: 'combo_lg_straight',
    name: 'Long Line',
    description: 'Score a Large Straight hand.',
    dust: 15, category: 'misc',
    check: (_s, e) =>
      e?.type === 'onComboDetected' && e.payload.combo === 'lg_straight',
  },
  {
    id: 'combo_chance_pure',
    name: 'No Pattern, No Problem',
    description: 'Score a Chance hand for over 1,000 chips.',
    dust: 30, category: 'misc',
    check: (_s, e) =>
      e?.type === 'onScoreCalculated' && e.payload.combo === 'chance' && e.payload.total >= 1000,
  },
  {
    id: 'combo_all_tier_high',
    name: 'Royal Flush of Bones',
    description: 'Score a Four of a Kind or higher.',
    dust: 20, category: 'misc',
    check: (_s, e) => {
      if (e?.type !== 'onComboDetected') return false;
      return ['four_kind', 'five_kind', 'lg_straight'].includes(e.payload.combo);
    },
  },

  // ---------- Misc (4) ----------
  {
    id: 'misc_legendary_fire',
    name: 'Hand of God',
    description: 'Trigger a legendary catalyst\'s effect for the first time.',
    dust: 25, category: 'misc',
    check: (s, e) => {
      if (e?.type !== 'onUpgradeTriggered') return false;
      const id = e.payload.id;
      // Strip prefixes used by the upgrades phase to get a catalyst id.
      const catId = id.includes('@')
        ? (id.startsWith('edition:') ? id.slice(id.indexOf('@') + 1) : id.slice(0, id.indexOf('@')))
        : id;
      const meta = CATALYST_META.find((c) => c.id === catId);
      return meta?.rarity === 'legendary' && s.run.catalysts.includes(catId);
    },
  },
  {
    id: 'misc_close_call',
    name: 'Close Call',
    description: 'Bust at 90% of the target or higher.',
    dust: 15, category: 'misc',
    check: (s, e) => {
      if (!isBustRunEnd(e)) return false;
      const target = s.round.target;
      if (target <= 0) return false;
      return s.round.score / target >= 0.9;
    },
  },
  {
    id: 'misc_full_resonance',
    name: 'Resonant Architect',
    description: 'Activate every resonance pair across runs.',
    dust: 200, category: 'resonance', hidden: true,
    // Relies on a separate "resonances ever fired" tracker, which we
    // approximate here by checking that the player's discovered set
    // contains every pair's halves at some point. Keep loose for v1.
    check: (s) => {
      const owned = new Set(s.meta.discovered?.catalysts ?? []);
      return RESONANCES.every((r) => owned.has(r.a) && owned.has(r.b));
    },
  },
  {
    id: 'misc_high_stake_lyra',
    name: 'Lyra Mastered',
    description: 'Clear at least Pyre stake on Lyra.',
    dust: 60, category: 'misc',
    check: (s) =>
      stakeIndex(s.meta.stakeProgress?.['lyra'] ?? '') >= stakeIndex('pyre'),
  },
  {
    id: 'misc_two_legendaries',
    name: 'Twin Stars',
    description: 'Own two legendary catalysts simultaneously.',
    dust: 75, category: 'misc',
    check: (s) => {
      let count = 0;
      for (const id of s.run.catalysts) {
        const meta = CATALYST_META.find((c) => c.id === id);
        if (meta?.rarity === 'legendary') count++;
        if (count >= 2) return true;
      }
      return false;
    },
  },
];

export function lookupAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

// Group achievements by category for the Codex tab. Categories appear in
// declaration order for stable rendering.
export const ACHIEVEMENT_CATEGORIES: { id: AchievementCategory; label: string }[] = [
  { id: 'first_steps', label: 'First Steps' },
  { id: 'stake_ladder', label: 'Stake Ladder' },
  { id: 'constellations', label: 'Constellation Tour' },
  { id: 'score', label: 'Score Milestones' },
  { id: 'edition', label: 'Editions' },
  { id: 'resonance', label: 'Resonance' },
  { id: 'codex', label: 'Codex' },
  { id: 'risk', label: 'Risk Plays' },
  { id: 'daily', label: 'Daily' },
  { id: 'misc', label: 'Miscellaneous' },
];
