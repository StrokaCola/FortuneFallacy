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
    case 'RESOLVE_AUDIT': {
      // Mid-run risk event at start of ante 3. 'gamble' is a 50/50
      // coin flip: win → +shards (double current), lose → -shards
      // (half current, floor 1). 'skip' costs a flat 5 shards. Pure
      // function here; the modal screen drives the choice.
      if (s.run.auditResolved) return { state: s, events: [] };
      const cur = s.run.shards;
      let nextShards = cur;
      if (a.choice === 'gamble') {
        // Deterministic-ish coin flip seeded from run.seed + handsPlayed
        // so two players gambling on the same seed don't get different
        // results. Mulberry-style hash without pulling in the helper.
        const h = ((s.run.seed ^ (s.run.handsPlayed * 0x9e3779b1) ^ 0xdeadbeef) >>> 0);
        const win = (h % 2) === 0;
        nextShards = win ? cur * 2 : Math.max(1, Math.floor(cur / 2));
      } else {
        nextShards = Math.max(0, cur - 5);
      }
      return {
        state: { ...s, run: { ...s.run, shards: nextShards, auditResolved: true } },
        events: [],
      };
    }
    case 'CLAIM_DAILY_LOGIN': {
      // Idempotent — claiming for the same date twice is a silent no-op
      // so the visual layer doesn't have to track whether it already
      // dispatched. Dust grant rides the standard onDustEarned channel
      // so the audio bridge plays the chime.
      const cur = s.meta.dailyLogin?.lastDate ?? null;
      if (cur === a.date) return { state: s, events: [] };
      const dustGained = 5;
      const dustTotal = (s.meta.cosmicDust ?? 0) + dustGained;
      return {
        state: {
          ...s,
          meta: {
            ...s.meta,
            dailyLogin: { lastDate: a.date },
            cosmicDust: dustTotal,
            cosmicDustLifetime: (s.meta.cosmicDustLifetime ?? 0) + dustGained,
          },
        },
        events: [
          { type: 'onDustEarned', payload: { delta: dustGained, total: dustTotal, reason: 'win' } },
        ],
      };
    }
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
    case 'UNLOCK_CONSTELLATION': {
      // Dedupe gate. The listener fires speculatively on every event, so a
      // constellation already in meta.unlocks short-circuits here. No dust
      // grant or toast — the celebration is the lock visually opening in
      // the picker, mirrored by the Codex transitioning the entry out of
      // its ??? state.
      const unlocks = s.meta.unlocks ?? [];
      if (unlocks.includes(a.constellationId)) return { state: s, events: [] };
      return {
        state: {
          ...s,
          meta: { ...s.meta, unlocks: [...unlocks, a.constellationId] },
        },
        events: [],
      };
    }
    case 'SHOW_DIE_TIP': {
      // Guard against a stale tip for a die that no longer exists (e.g. a
      // race with RESET_ROUND). The tooltip is in-round UI only.
      if (a.dieIdx < 0 || a.dieIdx >= s.round.dice.length) {
        return { state: s, events: [] };
      }
      return {
        state: {
          ...s,
          ui: {
            ...s.ui,
            dieTip: {
              dieIdx: a.dieIdx,
              screenX: a.screenX,
              screenY: a.screenY,
              pointerType: a.pointerType,
            },
          },
        },
        events: [],
      };
    }
    case 'HIDE_DIE_TIP':
      if (s.ui.dieTip == null) return { state: s, events: [] };
      return { state: { ...s, ui: { ...s.ui, dieTip: null } }, events: [] };
    default:
      return { state: s, events: [] };
  }
};
