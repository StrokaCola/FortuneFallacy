import { describe, it, expect, vi } from 'vitest';
import { SPECTRALS } from './spectrals';
import type { GameState } from '../../state/store';

const findSpectral = (id: string) => SPECTRALS.find((c) => c.id === id)!;

function baseState(catalysts: string[] = []): GameState {
  return {
    run: {
      catalysts,
      catalystEditions: {},
    },
  } as unknown as GameState;
}

describe('Void (spectral) — combo level swap', () => {
  it('moves a level from chosen combo to the next-tier combo and grants +5 shards', () => {
    const s: GameState = {
      run: {
        catalysts: [],
        catalystEditions: {},
        comboLevels: { three_kind: 4, sm_straight: 1 },
        shards: 0,
      },
    } as unknown as GameState;
    const def = SPECTRALS.find((c) => c.id === 'void')!;
    // three_kind is index 3 in the tier order; next is sm_straight (idx 4).
    const r = def.apply(s, [3]);
    expect(r.state.run.comboLevels.three_kind).toBe(3);
    expect(r.state.run.comboLevels.sm_straight).toBe(2);
    expect(r.state.run.shards).toBe(5);
  });

  it('refuses on top-tier combo (no adjacent up)', () => {
    const s: GameState = {
      run: {
        comboLevels: { five_kind: 5 },
        shards: 0,
      },
    } as unknown as GameState;
    const def = SPECTRALS.find((c) => c.id === 'void')!;
    // five_kind is index 8 (top); idx === COMBO_TIER_ORDER.length - 1 → refused.
    const r = def.apply(s, [8]);
    expect(r.state).toBe(s);
  });

  it('refuses when chosen combo has 0 levels (nothing to spend)', () => {
    const s: GameState = {
      run: {
        comboLevels: { three_kind: 0 },
        shards: 0,
      },
    } as unknown as GameState;
    const def = SPECTRALS.find((c) => c.id === 'void')!;
    const r = def.apply(s, [3]);
    expect(r.state).toBe(s);
  });
});

describe('Catalyze (spectral) — random edition stamp', () => {
  it('stamps an edition onto the targeted catalyst id', () => {
    const s = baseState(['cold_hand', 'six_bias']);
    // Pin Math.random so the rolled edition is deterministic (idx 0 → foil).
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const r = findSpectral('catalyze').apply(s, [1]);
    expect(r.state.run.catalystEditions.six_bias).toBe('foil');
    expect(r.state.run.catalystEditions.cold_hand).toBeUndefined();
    vi.restoreAllMocks();
  });

  it('replaces an existing edition (player gets a re-roll opportunity)', () => {
    const s: GameState = {
      ...baseState(['cold_hand']),
      run: {
        catalysts: ['cold_hand'],
        catalystEditions: { cold_hand: 'foil' },
      },
    } as unknown as GameState;
    // Pin to land on holo (idx 1 → 0.4).
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    const r = findSpectral('catalyze').apply(s, [0]);
    expect(r.state.run.catalystEditions.cold_hand).toBe('holo');
    vi.restoreAllMocks();
  });

  it('no-op when target index is out of range', () => {
    const s = baseState(['cold_hand']);
    const r = findSpectral('catalyze').apply(s, [99]);
    expect(r.state).toBe(s);
  });

  it('no-op when targets array is empty', () => {
    const s = baseState(['cold_hand']);
    const r = findSpectral('catalyze').apply(s, []);
    expect(r.state).toBe(s);
  });

  it('emits a spectral:catalyze event tagged with the catalyst + edition', () => {
    const s = baseState(['cold_hand']);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const r = findSpectral('catalyze').apply(s, [0]);
    expect(r.events).toHaveLength(1);
    const ev = r.events[0]!;
    expect(ev.type).toBe('onUpgradeTriggered');
    if (ev.type === 'onUpgradeTriggered') {
      expect(ev.payload.id).toBe('spectral:catalyze@cold_hand:foil');
    }
    vi.restoreAllMocks();
  });

  it('definition shape: requires target, type=spectral, targetType=catalyst', () => {
    const def = findSpectral('catalyze');
    expect(def.type).toBe('spectral');
    expect(def.requiresTarget).toBe(true);
    expect(def.targetType).toBe('catalyst');
  });
});
