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
  it('clears seen and dismissed', () => {
    const dirty = baseState({
      meta: { ...initialMetaSlice(), onboarding: { seen: ['round_roll', 'shop_offers'], dismissed: true } },
    });
    const r = metaHandler({ type: 'RESET_ONBOARDING' }, dirty);
    expect(r.state.meta.onboarding).toEqual({ seen: [], dismissed: false });
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
