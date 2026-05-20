import type { ActionHandler } from './types';
import { startBlind, clearBlind, bustBlind, skipBlind, startCosmicLap, pickBossId } from '../../core/round/transitions';
import { initialRunSlice } from '../../state/slices/run';
import { initialRoundSlice } from '../../state/slices/round';
import { initialShopSlice } from '../../state/slices/shop';
import { applyConstellation } from '../../core/run/applyConstellation';
import { applyAstralPerksToNewRun } from '../../core/run/applyAstralPerks';
import { lookupConstellation } from '../../data/constellations';
import { getDailyChallenge } from '../../online/dailyChallenge';
import { resolveEventChoice } from '../../core/run/resolveEvent';
import { lookupEvent } from '../../data/events';
import type { HandlerResult } from './types';

// Any round transition wipes the long-press die tooltip — the die it pointed
// at may no longer exist, and a stale floating chip would survive scene
// changes and look like a bug.
function clearDieTip(r: HandlerResult): HandlerResult {
  if (r.state.ui.dieTip == null) return r;
  return { ...r, state: { ...r.state, ui: { ...r.state.ui, dieTip: null } } };
}

export const roundHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'START_BLIND':
      return clearDieTip(startBlind(s));
    case 'CLEAR_BLIND':
      return clearDieTip(clearBlind(s));
    case 'BUST_BLIND':
      return clearDieTip(bustBlind(s));
    case 'SKIP_BLIND':
      return clearDieTip(skipBlind(s));
    case 'START_COSMIC_LAP':
      return clearDieTip(startCosmicLap(s));
    case 'RESOLVE_EVENT_CHOICE': {
      const def = lookupEvent(a.eventId);
      if (!def) return { state: s, events: [] };
      return clearDieTip(resolveEventChoice(s, def, a.choiceIdx));
    }
    case 'START_VOID_RUN': {
      // Void Mode entry — mirrors NEW_RUN's reset (round, shop, run slice
      // re-initialized) but flips run.mode to 'void' and seeds the procgen
      // affix generator. Constellation falls back to the default Lyra so
      // the dice count + scoring rules are well-defined. Astral perks are
      // SKIPPED (like daily challenges) so a void run's scoring stays
      // self-contained — the alt-mode telegraphs its own variance and
      // shouldn't get a free start-of-run boost from meta progression.
      const constellation = lookupConstellation('lyra');
      const baseRun = applyConstellation(initialRunSlice(), constellation);
      const seed = (a.seed >>> 0);
      const run = {
        ...baseRun,
        seed,
        seedSource: 'random' as const,
        mode: 'void' as const,
        voidSeed: (a.voidSeed >>> 0),
        runAlias: a.runAlias,
        dailyCertified: a.dailyCertified,
        catalystAffixes: {},
        consumableAffixes: {},
        upcomingBossId: pickBossId(seed, 1),
      };
      return {
        state: {
          ...s,
          run,
          round: initialRoundSlice(),
          shop: initialShopSlice(),
          ui: { ...s.ui, screen: 'hub', dieTip: null },
        },
        events: [],
      };
    }
    case 'END_VOID_RUN': {
      // Wipe all void-specific run state and reset to a fresh normal-run
      // slice. Mirrors the postmortem→title transition for normal runs:
      // resets round + shop + ui screen back to title so the player isn't
      // left mid-state on a now-defunct void run.
      return {
        state: {
          ...s,
          run: initialRunSlice(),
          round: initialRoundSlice(),
          shop: initialShopSlice(),
          ui: { ...s.ui, screen: 'title', dieTip: null },
        },
        events: [],
      };
    }
    case 'NEW_RUN': {
      // Daily challenge: deterministic seed + constellation + stake derived
      // from today's UTC date so every player gets the same run on the same
      // day. Astral perks are skipped on daily runs so leaderboards stay
      // fair across players with different meta progression.
      const daily = a.daily ? getDailyChallenge() : null;
      const constellationId = daily?.constellationId ?? a.constellationId;
      const constellation = lookupConstellation(constellationId);
      const baseRun = applyConstellation(initialRunSlice(), constellation);
      // Seed precedence: daily-challenge UTC seed > player-entered seed >
      // auto-generated. seedSource flags which path was taken so the UI
      // knows whether to show the seed during play (player/daily) or
      // hide it until postmortem (random).
      const seed =
        daily?.seed ??
        (typeof a.seed === 'number' ? (a.seed >>> 0) : baseRun.seed);
      const seedSource: 'random' | 'player' | 'daily' = daily
        ? 'daily'
        : (typeof a.seed === 'number' ? 'player' : 'random');
      const withStake = {
        ...baseRun,
        seed,
        seedSource,
        stakeId: daily?.stakeId ?? a.stakeId ?? 'spark',
        challengeId: a.challengeId ?? '',
        dailyDate: daily?.date ?? null,
      };
      // Apply any owned Astral Perk start-of-run effects (extra shards,
      // starting consumable, etc.). Read-side perks (reroll discount, slot
      // capacity, first-blind hands, boss reveal) resolve at compute time
      // from meta.astralPerks — they don't mutate the run slice here.
      // Daily runs skip perk application entirely for fair comparison.
      const runWithPerks = daily
        ? withStake
        : applyAstralPerksToNewRun(withStake, s.meta.astralPerks);
      // Lock in ante-1's boss id at run-start so the Hub can preview the
      // upcoming curse before the player ever clicks Begin, and so a
      // refresh on the hub doesn't shuffle the boss when startBlind fires.
      // Boss is now seeded — same seed always yields the same boss for
      // the same ante.
      const run = { ...runWithPerks, upcomingBossId: pickBossId(seed, 1) };
      return {
        state: {
          ...s,
          run,
          round: initialRoundSlice(),
          shop: initialShopSlice(),
          ui: { ...s.ui, screen: 'hub', dieTip: null },
        },
        events: [],
      };
    }
    default:
      return { state: s, events: [] };
  }
};
