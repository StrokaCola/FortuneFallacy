import { buildBank, type SynthBank } from './synthBank';
import { buildLegacyBank, type LegacySynthBank } from './synthBank.legacy';
import * as voices from './voices';
import * as legacyVoices from './voices.legacy';
import * as audioSettings from '../audioSettings';

export type SfxId =
  | 'diceClack' | 'lockTap' | 'reroll' | 'buy'
  | 'combo' | 'upgrade' | 'bossSting' | 'bigScore' | 'win' | 'bust'
  | 'chipTick' | 'castSwell' | 'castBoom' | 'sigilDraw' | 'cardFlip' | 'nodePulse' | 'transitionWipe'
  | 'multSlam' | 'comboChime' | 'targetCross' | 'notEnough'
  | 'modPulse' | 'modLoaded' | 'modPipCharge' | 'modBackstop'
  | 'modAttach' | 'modDetach' | 'uiClick' | 'uiHover';

export type SfxOpts = { tier?: number; volume?: number; idx?: number; freq?: number; gain?: number };

const LEGACY_KEY = 'ff_sfx_legacy';

let bank: SynthBank | LegacySynthBank | null = null;
let legacyMode = false;
let initPromise: Promise<void> | null = null;
let sfxSettingsUnsub: (() => void) | null = null;

function checkLegacyFlag(): boolean {
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get('sfx');
    if (param === 'legacy') {
      localStorage.setItem(LEGACY_KEY, '1');
      return true;
    }
    if (param === 'modern' || param === 'new') {
      localStorage.removeItem(LEGACY_KEY);
      return false;
    }
  } catch { /* SSR or no window */ }
  return localStorage.getItem(LEGACY_KEY) === '1';
}

export async function sfxInit(): Promise<void> {
  if (bank) return;
  if (initPromise) return initPromise;
  legacyMode = checkLegacyFlag();
  initPromise = (async () => {
    bank = legacyMode ? await buildLegacyBank() : await buildBank();
    const applyGain = () => {
      if (bank) bank.master.gain.value = audioSettings.getMaster() * audioSettings.getSfx();
    };
    applyGain();
    sfxSettingsUnsub?.();
    sfxSettingsUnsub = audioSettings.subscribe(applyGain);
  })();
  return initPromise;
}

import.meta.hot?.dispose(() => {
  sfxSettingsUnsub?.();
  sfxSettingsUnsub = null;
});

// Per-cue minimum gap (ms) before another play is allowed. Only listed
// cues are throttled; everything else fires immediately. Hover/sweep
// cues need this — sliding the mouse across N offers in a row was
// queueing N cardFlips that auditioned as a stutter. Click and
// transactional cues stay un-throttled because the player triggered
// them deliberately.
const SPAMMABLE_GAP_MS: Partial<Record<SfxId, number>> = {
  uiHover: 80,
  cardFlip: 90,
};
const lastPlayedAt: Partial<Record<SfxId, number>> = {};

// Test-only escape hatch so specs can reset internal throttle state and
// bypass the bank-init guard without exporting a public reset.
export const __sfxTestHooks = {
  resetThrottle(): void {
    for (const k of Object.keys(lastPlayedAt) as SfxId[]) {
      delete lastPlayedAt[k];
    }
  },
  getLastPlayedAt(): Partial<Record<SfxId, number>> {
    return { ...lastPlayedAt };
  },
};

// Test-only: lets specs install a stub bank so sfxPlay's `if (!bank)`
// guard doesn't short-circuit in unit tests. Production paths go
// through sfxInit which mutates `bank` from null on its own.
export function __setBankForTest(b: SynthBank | LegacySynthBank | null): void {
  bank = b;
}

export function sfxPlay(id: SfxId, opts: SfxOpts = {}): void {
  if (!bank) return;
  // Throttle gate — drops the second of two close-together plays of the
  // same cue. Doesn't queue them; the second sound is just cancelled.
  const gap = SPAMMABLE_GAP_MS[id];
  if (gap != null) {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const last = lastPlayedAt[id] ?? 0;
    if (now - last < gap) return;
    lastPlayedAt[id] = now;
  }
  const v = legacyMode ? legacyVoices : voices;
  try {
    switch (id) {
      case 'diceClack':       v.diceClack(bank as never); break;
      case 'lockTap':         v.lockTap(bank as never); break;
      case 'reroll':          v.reroll(bank as never); break;
      case 'buy':             v.buy(bank as never); break;
      case 'combo':           v.combo(bank as never, opts); break;
      case 'upgrade':         v.upgrade(bank as never); break;
      case 'bossSting':       v.bossSting(bank as never); break;
      case 'bigScore':        v.bigScore(bank as never); break;
      case 'win':             v.winFanfare(bank as never); break;
      case 'bust':            v.bust(bank as never); break;
      case 'chipTick':        v.chipTick(bank as never, opts); break;
      case 'castSwell':       v.castSwell(bank as never); break;
      case 'castBoom':        v.castBoom(bank as never, opts); break;
      case 'sigilDraw':       v.sigilDraw(bank as never); break;
      case 'cardFlip':        v.cardFlip(bank as never); break;
      case 'nodePulse':       v.nodePulse(bank as never); break;
      case 'transitionWipe':  v.transitionWipe(bank as never); break;
      case 'multSlam':        (v as typeof voices).multSlam(bank as never, opts); break;
      case 'comboChime':      (v as typeof voices).comboChime(bank as never); break;
      case 'targetCross':     (v as typeof voices).targetCross(bank as never); break;
      case 'notEnough':       (v as typeof voices).notEnough(bank as never); break;
      case 'modPulse':        (v as typeof voices).modPulse(bank as never); break;
      case 'modLoaded':       (v as typeof voices).modLoaded(bank as never); break;
      case 'modPipCharge':    (v as typeof voices).modPipCharge(bank as never); break;
      case 'modBackstop':     (v as typeof voices).modBackstop(bank as never); break;
      case 'modAttach':       (v as typeof voices).modAttach(bank as never); break;
      case 'modDetach':       (v as typeof voices).modDetach(bank as never); break;
      case 'uiClick':         (v as typeof voices).uiClick(bank as never); break;
      case 'uiHover':         (v as typeof voices).uiHover(bank as never); break;
    }
  } catch (e) {
    console.warn('[sfx] play failed:', id, e);
  }
}

export function sfxSetMaster(v: number): void {
  audioSettings.setSfx(v);
}

export function sfxGetMaster(): number {
  return audioSettings.getSfx();
}

export function sfxBank(): SynthBank | LegacySynthBank | null {
  return bank;
}

export function sfxIsLegacy(): boolean {
  return legacyMode;
}
