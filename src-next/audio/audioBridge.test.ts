import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock heavy dependencies before importing the module under test
vi.mock('./AudioEngine', () => ({
  audioEngine: {
    bumpHeat: vi.fn(),
    bumpCombo: vi.fn(),
    bumpComboFromTier: vi.fn(),
    bumpHeatFromScore: vi.fn(),
    noteStability: vi.fn(),
    triggerBigScore: vi.fn(),
    enterFail: vi.fn(),
    exitFail: vi.fn(),
    setMode: vi.fn(),
    setTension: vi.fn(),
    setProgress: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  },
  ensureAudioAfterGesture: vi.fn(),
}));

vi.mock('./sfx', () => ({
  sfxPlay: vi.fn(),
  sfxSetMaster: vi.fn(),
  sfxGetMaster: vi.fn(() => 1),
  sfxBank: vi.fn(() => null),
}));

vi.mock('./scoring', () => ({
  installScoringRouter: vi.fn(() => vi.fn()),
}));

vi.mock('./heat', () => ({
  installHeatRouter: vi.fn(() => vi.fn()),
}));

vi.mock('./audioSettings', () => ({
  getMaster: vi.fn(() => 1),
  setMaster: vi.fn(),
}));

vi.mock('../core/mods', () => ({
  lookupMod: vi.fn(() => null),
}));

import { startAudioBridge, audioEngine } from './audioBridge';
import { bus } from '../events/bus';
import { sfxPlay } from './sfx';

const mockAudioEngine = audioEngine as {
  bumpComboFromTier: ReturnType<typeof vi.fn>;
  bumpHeat: ReturnType<typeof vi.fn>;
  bumpHeatFromScore: ReturnType<typeof vi.fn>;
  noteStability: ReturnType<typeof vi.fn>;
  triggerBigScore: ReturnType<typeof vi.fn>;
  enterFail: ReturnType<typeof vi.fn>;
  exitFail: ReturnType<typeof vi.fn>;
  setMode: ReturnType<typeof vi.fn>;
};
const mockSfxPlay = sfxPlay as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('startAudioBridge', () => {
  it('returns a cleanup function', () => {
    const unsub = startAudioBridge();
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('cleanup can be called repeatedly without error', () => {
    const unsub = startAudioBridge();
    expect(() => { unsub(); unsub(); }).not.toThrow();
  });

  it('onComboDetected → audioEngine.bumpComboFromTier with the combo tier', () => {
    const unsub = startAudioBridge();
    bus.emit('onComboDetected', { combo: 'one_pair', tier: 2 });
    unsub();
    expect(mockAudioEngine.bumpComboFromTier).toHaveBeenCalledWith(2);
  });

  it('onComboDetected → sfxPlay combo with tier', () => {
    const unsub = startAudioBridge();
    bus.emit('onComboDetected', { combo: 'full_house', tier: 3 });
    unsub();
    expect(mockSfxPlay).toHaveBeenCalledWith('combo', { tier: 3 });
  });

  it('onBlindCleared → audioEngine.noteStability and sfxPlay win', () => {
    const unsub = startAudioBridge();
    bus.emit('onBlindCleared', {
      blindId: 'hydra',
      ante: 1,
      reward: { base: 5, voucher: 0, hands: 1, interest: 0, total: 6 },
    });
    unsub();
    expect(mockAudioEngine.noteStability).toHaveBeenCalled();
    expect(mockSfxPlay).toHaveBeenCalledWith('win');
  });

  it('onShopOpened → audioEngine.setMode idle and sfxPlay reroll', () => {
    const unsub = startAudioBridge();
    bus.emit('onShopOpened', { offers: [] });
    unsub();
    expect(mockAudioEngine.setMode).toHaveBeenCalledWith('idle');
    expect(mockSfxPlay).toHaveBeenCalledWith('reroll');
  });

  it('onLockToggled → sfxPlay lockTap', () => {
    const unsub = startAudioBridge();
    bus.emit('onLockToggled', { dieIdx: 2, locked: true });
    unsub();
    expect(mockSfxPlay).toHaveBeenCalledWith('lockTap');
  });

  it('onOfferBought → sfxPlay buy', () => {
    const unsub = startAudioBridge();
    bus.emit('onOfferBought', { kind: 'catalyst', id: 'conductor', price: 3 });
    unsub();
    expect(mockSfxPlay).toHaveBeenCalledWith('buy');
  });

  it('after cleanup, bus events no longer trigger audio calls', () => {
    const unsub = startAudioBridge();
    unsub();
    vi.clearAllMocks();

    bus.emit('onComboDetected', { combo: 'five_kind', tier: 5 });
    expect(mockAudioEngine.bumpComboFromTier).not.toHaveBeenCalled();
    expect(mockSfxPlay).not.toHaveBeenCalled();
  });
});
