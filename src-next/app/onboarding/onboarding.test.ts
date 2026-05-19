import { describe, it, expect } from 'vitest';
import { metaHandler } from '../../actions/handlers/meta';
import { pickActiveCoachmark, COACHMARKS } from './coachmarks';
import type { GameState } from '../../state/store';
import { initialMetaSlice } from '../../state/slices/meta';
import { initialUiSlice } from '../../state/slices/ui';
import { initialRoundSlice } from '../../state/slices/round';
import { initialRunSlice } from '../../state/slices/run';
import { initialShopSlice } from '../../state/slices/shop';

const baseState = (over: Partial<GameState> = {}): GameState => ({
  run: initialRunSlice(),
  round: initialRoundSlice(),
  shop: initialShopSlice(),
  meta: initialMetaSlice(),
  ui: initialUiSlice(),
  pingCount: 0,
  ...over,
} as GameState);

describe('SEE_COACHMARK', () => {
  it('appends a coachmark id to seen', () => {
    const r = metaHandler({ type: 'SEE_COACHMARK', id: 'round_roll' }, baseState());
    expect(r.state.meta.onboarding.seen).toEqual(['round_roll']);
  });

  it('is idempotent — second mark is a no-op', () => {
    const after1 = metaHandler({ type: 'SEE_COACHMARK', id: 'round_roll' }, baseState()).state;
    const after2 = metaHandler({ type: 'SEE_COACHMARK', id: 'round_roll' }, after1).state;
    expect(after2.meta.onboarding.seen).toEqual(['round_roll']);
  });
});

describe('SKIP_ONBOARDING', () => {
  it('sets dismissed=true', () => {
    const r = metaHandler({ type: 'SKIP_ONBOARDING' }, baseState());
    expect(r.state.meta.onboarding.dismissed).toBe(true);
  });

  it('preserves seen entries when dismissing', () => {
    const seenFirst = metaHandler({ type: 'SEE_COACHMARK', id: 'round_roll' }, baseState()).state;
    const r = metaHandler({ type: 'SKIP_ONBOARDING' }, seenFirst);
    expect(r.state.meta.onboarding.seen).toEqual(['round_roll']);
    expect(r.state.meta.onboarding.dismissed).toBe(true);
  });
});

describe('RESET_ONBOARDING', () => {
  it('clears seen, dismissed, and re-arms firstLaunch for the guided tour', () => {
    const dirty = baseState({
      meta: { ...initialMetaSlice(), onboarding: { seen: ['round_roll', 'shop_offers'], dismissed: true, firstLaunch: false } },
    });
    const r = metaHandler({ type: 'RESET_ONBOARDING' }, dirty);
    expect(r.state.meta.onboarding).toEqual({ seen: [], dismissed: false, firstLaunch: true });
  });
});

describe('pickActiveCoachmark', () => {
  it('returns the round_roll coachmark on the round screen for a fresh player', () => {
    const s = baseState({ ui: { ...initialUiSlice(), screen: 'round' } });
    const c = pickActiveCoachmark(s);
    expect(c?.id).toBe('round_roll');
  });

  it('returns null when onboarding is dismissed', () => {
    const s = baseState({
      ui: { ...initialUiSlice(), screen: 'round' },
      meta: { ...initialMetaSlice(), onboarding: { seen: [], dismissed: true } },
    });
    expect(pickActiveCoachmark(s)).toBeNull();
  });

  it('skips coachmarks already in seen[]', () => {
    const s = baseState({
      ui: { ...initialUiSlice(), screen: 'round' },
      meta: { ...initialMetaSlice(), onboarding: { seen: ['round_roll'], dismissed: false } },
      // round_lock requires firstRollDone, so without it we should fall through.
      round: { ...initialRoundSlice(), firstRollDone: false },
    });
    expect(pickActiveCoachmark(s)).toBeNull();
  });

  it('returns round_lock once firstRollDone is true and round_roll has been seen', () => {
    const s = baseState({
      ui: { ...initialUiSlice(), screen: 'round' },
      meta: { ...initialMetaSlice(), onboarding: { seen: ['round_roll'], dismissed: false } },
      round: { ...initialRoundSlice(), firstRollDone: true },
    });
    expect(pickActiveCoachmark(s)?.id).toBe('round_lock');
  });

  it('returns shop_offers on the shop screen', () => {
    const s = baseState({ ui: { ...initialUiSlice(), screen: 'shop' } });
    expect(pickActiveCoachmark(s)?.id).toBe('shop_offers');
  });

  it('returns hub_blinds on the hub screen', () => {
    const s = baseState({ ui: { ...initialUiSlice(), screen: 'hub' } });
    expect(pickActiveCoachmark(s)?.id).toBe('hub_blinds');
  });

  it('returns null on screens with no coachmark (e.g. title)', () => {
    const s = baseState({ ui: { ...initialUiSlice(), screen: 'title' } });
    expect(pickActiveCoachmark(s)).toBeNull();
  });

  it('handles a legacy save with no onboarding field at all', () => {
    const s = baseState({ ui: { ...initialUiSlice(), screen: 'round' } });
    // Simulate the field missing entirely — should fall through to default.
    (s.meta as { onboarding?: unknown }).onboarding = undefined;
    expect(pickActiveCoachmark(s)?.id).toBe('round_roll');
  });

  // 2026-05-14 expansion — new coachmarks added by the studio review's
  // Player Experience dept. Each predicate should be queryable in
  // isolation; firing order is "most fundamental first" so each only
  // wins when the earlier ones are seen.
  describe('2026-05-14 expansion entries', () => {
    const seenAll = (...ids: string[]) => ({ seen: ids, dismissed: false });

    it('fires constellation_select on the picker screen', () => {
      const s = baseState({ ui: { ...initialUiSlice(), screen: 'constellation_select' } });
      expect(pickActiveCoachmark(s)?.id).toBe('constellation_select');
    });

    it('fires first_voidstorm when a voidstorm is active and round basics are seen', () => {
      const s = baseState({
        ui: { ...initialUiSlice(), screen: 'round' },
        meta: { ...initialMetaSlice(), onboarding: seenAll('round_roll', 'round_lock') },
        round: { ...initialRoundSlice(), firstRollDone: true, voidstormId: 'gravity_well' },
      });
      expect(pickActiveCoachmark(s)?.id).toBe('first_voidstorm');
    });

    it('fires first_chain when chainLen >= 2', () => {
      const s = baseState({
        ui: { ...initialUiSlice(), screen: 'round' },
        meta: { ...initialMetaSlice(), onboarding: seenAll('round_roll', 'round_lock') },
        round: { ...initialRoundSlice(), firstRollDone: true, chainLen: 2 },
      });
      expect(pickActiveCoachmark(s)?.id).toBe('first_chain');
    });

    it('does NOT fire first_chain when chainLen < 2', () => {
      const s = baseState({
        ui: { ...initialUiSlice(), screen: 'round' },
        meta: { ...initialMetaSlice(), onboarding: seenAll('round_roll', 'round_lock') },
        round: { ...initialRoundSlice(), firstRollDone: true, chainLen: 1 },
      });
      const c = pickActiveCoachmark(s);
      expect(c?.id).not.toBe('first_chain');
    });

    it('fires first_edition when at least one catalyst has an edition stamp', () => {
      const s = baseState({
        ui: { ...initialUiSlice(), screen: 'round' },
        meta: { ...initialMetaSlice(), onboarding: seenAll('round_roll', 'round_lock') },
        round: { ...initialRoundSlice(), firstRollDone: true },
        run: { ...initialRunSlice(), catalysts: ['stratifier'], catalystEditions: { stratifier: 'foil' } },
      });
      expect(pickActiveCoachmark(s)?.id).toBe('first_edition');
    });

    it('fires first_voucher when the player owns at least one voucher', () => {
      const s = baseState({
        ui: { ...initialUiSlice(), screen: 'round' },
        meta: { ...initialMetaSlice(), onboarding: seenAll('round_roll', 'round_lock') },
        round: { ...initialRoundSlice(), firstRollDone: true },
        run: { ...initialRunSlice(), vouchers: ['bench'] },
      });
      expect(pickActiveCoachmark(s)?.id).toBe('first_voucher');
    });

    it('fires first_consumable when the tray has at least one item', () => {
      const s = baseState({
        ui: { ...initialUiSlice(), screen: 'round' },
        meta: { ...initialMetaSlice(), onboarding: seenAll('round_roll', 'round_lock') },
        round: { ...initialRoundSlice(), firstRollDone: true },
        run: { ...initialRunSlice(), consumables: ['galaxy_pair'] },
      });
      expect(pickActiveCoachmark(s)?.id).toBe('first_consumable');
    });

    it('fires first_resonance once a resonance has been discovered', () => {
      const meta = initialMetaSlice();
      const s = baseState({
        ui: { ...initialUiSlice(), screen: 'round' },
        meta: {
          ...meta,
          onboarding: seenAll('round_roll', 'round_lock'),
          discovered: { ...meta.discovered, resonances: ['stratifier+twin_sample'] },
        },
        round: { ...initialRoundSlice(), firstRollDone: true },
      });
      expect(pickActiveCoachmark(s)?.id).toBe('first_resonance');
    });

    it('fires first_boss_debuff on a boss round', () => {
      const s = baseState({
        ui: { ...initialUiSlice(), screen: 'round' },
        meta: { ...initialMetaSlice(), onboarding: seenAll('round_roll', 'round_lock') },
        round: { ...initialRoundSlice(), firstRollDone: true, isBoss: true },
      });
      expect(pickActiveCoachmark(s)?.id).toBe('first_boss_debuff');
    });

    it('fires first_skip_bounty on the hub once hub_blinds is seen', () => {
      const s = baseState({
        ui: { ...initialUiSlice(), screen: 'hub' },
        meta: { ...initialMetaSlice(), onboarding: seenAll('hub_blinds') },
      });
      expect(pickActiveCoachmark(s)?.id).toBe('first_skip_bounty');
    });

    it('fires astral_forge_first on the astral_forge screen', () => {
      const s = baseState({ ui: { ...initialUiSlice(), screen: 'astral_forge' } });
      expect(pickActiveCoachmark(s)?.id).toBe('astral_forge_first');
    });

    it('fires first_dust_earned on the FAIL screen when dust was earned', () => {
      const run = initialRunSlice();
      const s = baseState({
        ui: { ...initialUiSlice(), screen: 'fail' },
        run: { ...run, runStats: { ...run.runStats, dustEarned: 12 } },
      });
      expect(pickActiveCoachmark(s)?.id).toBe('first_dust_earned');
    });

    it('fires first_dust_earned on the WIN screen when dust was earned (multi-screen)', () => {
      const run = initialRunSlice();
      const s = baseState({
        ui: { ...initialUiSlice(), screen: 'win' },
        run: { ...run, runStats: { ...run.runStats, dustEarned: 50 } },
      });
      expect(pickActiveCoachmark(s)?.id).toBe('first_dust_earned');
    });

    it('does NOT fire first_dust_earned when dustEarned === 0', () => {
      const s = baseState({ ui: { ...initialUiSlice(), screen: 'fail' } });
      expect(pickActiveCoachmark(s)).toBeNull();
    });
  });
});

describe('COACHMARKS catalog integrity', () => {
  it('has unique ids', () => {
    const ids = COACHMARKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has non-empty text and anchors', () => {
    for (const c of COACHMARKS) {
      expect(c.text.length).toBeGreaterThan(10);
      expect(c.anchor.length).toBeGreaterThan(0);
    }
  });
});
