import type { ActionHandler } from './types';
import { lookupAstralPerk } from '../../data/astralPerks';
import { lookupAchievement } from '../../data/achievements';

export const metaHandler: ActionHandler = (a, s) => {
  switch (a.type) {
    case 'PING':
      return {
        state: { ...s, pingCount: s.pingCount + 1 },
        events: [{ type: 'onPing', payload: { msg: a.msg } }],
      };
    case 'SET_SCREEN':
      return { state: { ...s, ui: { ...s.ui, screen: a.screen } }, events: [] };
    case 'SET_PLAYER_NAME':
      return { state: { ...s, meta: { ...s.meta, playerName: a.name } }, events: [] };
    case 'TOGGLE_PAUSE':
      return { state: { ...s, ui: { ...s.ui, paused: !s.ui.paused } }, events: [] };
    case 'BUY_ASTRAL_PERK': {
      const perk = lookupAstralPerk(a.perkId);
      if (!perk) return { state: s, events: [] };
      // Already owned — silent no-op.
      const owned = s.meta.astralPerks ?? [];
      if (owned.includes(a.perkId)) return { state: s, events: [] };
      // Affordability check.
      const dust = s.meta.cosmicDust ?? 0;
      if (dust < perk.cost) return { state: s, events: [] };
      return {
        state: {
          ...s,
          meta: {
            ...s.meta,
            cosmicDust: dust - perk.cost,
            astralPerks: [...owned, a.perkId],
          },
        },
        events: [{ type: 'onAstralPerkBought', payload: { perkId: a.perkId, cost: perk.cost } }],
      };
    }
    case 'SEE_COACHMARK': {
      const onb = s.meta.onboarding ?? { seen: [], dismissed: false };
      if (onb.seen.includes(a.id)) return { state: s, events: [] };
      return {
        state: {
          ...s,
          meta: { ...s.meta, onboarding: { ...onb, seen: [...onb.seen, a.id] } },
        },
        events: [],
      };
    }
    case 'SKIP_ONBOARDING': {
      const onb = s.meta.onboarding ?? { seen: [], dismissed: false };
      if (onb.dismissed) return { state: s, events: [] };
      return {
        state: { ...s, meta: { ...s.meta, onboarding: { ...onb, dismissed: true } } },
        events: [],
      };
    }
    case 'RESET_ONBOARDING':
      return {
        state: { ...s, meta: { ...s.meta, onboarding: { seen: [], dismissed: false } } },
        events: [],
      };
    case 'UNLOCK_ACHIEVEMENT': {
      const def = lookupAchievement(a.achievementId);
      if (!def) return { state: s, events: [] };
      const ach = s.meta.achievements ?? { unlocked: [], unlockedAt: {} };
      // Already unlocked — silent no-op. The listener fires speculatively
      // on every event, so this is the dedupe gate.
      if (ach.unlocked.includes(a.achievementId)) return { state: s, events: [] };
      const dustGained = def.dust;
      const dustTotal = (s.meta.cosmicDust ?? 0) + dustGained;
      return {
        state: {
          ...s,
          meta: {
            ...s.meta,
            achievements: {
              unlocked: [...ach.unlocked, a.achievementId],
              unlockedAt: { ...ach.unlockedAt, [a.achievementId]: Date.now() },
            },
            cosmicDust: dustTotal,
            cosmicDustLifetime: (s.meta.cosmicDustLifetime ?? 0) + dustGained,
          },
        },
        events: [
          {
            type: 'onAchievementUnlocked',
            payload: {
              achievementId: a.achievementId,
              dust: dustGained,
              name: def.name,
            },
          },
          // The dust grant rides the standard onDustEarned channel so the
          // existing audio bridge plays the dust-earned chime. Reason
          // 'win' is the closest existing variant for an unlock — a
          // separate 'achievement' reason could come later if we want a
          // distinct SFX.
          {
            type: 'onDustEarned',
            payload: { delta: dustGained, total: dustTotal, reason: 'win' },
          },
        ],
      };
    }
    default:
      return { state: s, events: [] };
  }
};
