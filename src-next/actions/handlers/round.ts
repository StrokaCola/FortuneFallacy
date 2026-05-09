import type { ActionHandler } from './types';
import { startBlind, clearBlind, bustBlind, skipBlind } from '../../core/round/transitions';
import { initialRunSlice } from '../../state/slices/run';
import { initialRoundSlice } from '../../state/slices/round';
import { initialShopSlice } from '../../state/slices/shop';
import { applyConstellation } from '../../core/run/applyConstellation';
import { applyAstralPerksToNewRun } from '../../core/run/applyAstralPerks';
import { lookupConstellation } from '../../data/constellations';
import { getDailyChallenge } from '../../online/dailyChallenge';

export const roundHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'START_BLIND':
      return startBlind(s);
    case 'CLEAR_BLIND':
      return clearBlind(s);
    case 'BUST_BLIND':
      return bustBlind(s);
    case 'SKIP_BLIND':
      return skipBlind(s);
    case 'NEW_RUN': {
      // Daily challenge: deterministic seed + constellation + stake derived
      // from today's UTC date so every player gets the same run on the same
      // day. Astral perks are skipped on daily runs so leaderboards stay
      // fair across players with different meta progression.
      const daily = a.daily ? getDailyChallenge() : null;
      const constellationId = daily?.constellationId ?? a.constellationId;
      const constellation = lookupConstellation(constellationId);
      const baseRun = applyConstellation(initialRunSlice(), constellation);
      const withStake = {
        ...baseRun,
        seed: daily?.seed ?? baseRun.seed,
        stakeId: daily?.stakeId ?? a.stakeId ?? 'spark',
        challengeId: a.challengeId ?? '',
        dailyDate: daily?.date ?? null,
      };
      // Apply any owned Astral Perk start-of-run effects (extra shards,
      // starting consumable, etc.). Read-side perks (reroll discount, slot
      // capacity, first-blind hands, boss reveal) resolve at compute time
      // from meta.astralPerks — they don't mutate the run slice here.
      // Daily runs skip perk application entirely for fair comparison.
      const run = daily
        ? withStake
        : applyAstralPerksToNewRun(withStake, s.meta.astralPerks);
      return {
        state: {
          ...s,
          run,
          round: initialRoundSlice(),
          shop: initialShopSlice(),
          ui: { ...s.ui, screen: 'hub' },
        },
        events: [],
      };
    }
    default:
      return { state: s, events: [] };
  }
};
