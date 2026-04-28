import { buildBank, type SynthBank } from './synthBank';
import { buildLegacyBank, type LegacySynthBank } from './synthBank.legacy';
import * as voices from './voices';
import * as legacyVoices from './voices.legacy';

export type SfxId =
  | 'diceClack' | 'lockTap' | 'reroll' | 'buy'
  | 'combo' | 'upgrade' | 'bossSting' | 'bigScore' | 'win' | 'bust'
  | 'chipTick' | 'castSwell' | 'castBoom' | 'sigilDraw' | 'cardFlip' | 'nodePulse' | 'transitionWipe'
  | 'multSlam' | 'comboChime' | 'targetCross' | 'notEnough';

export type SfxOpts = { tier?: number; volume?: number; idx?: number; freq?: number; gain?: number };

const VOLUME_KEY = 'ff_next_sfxVol';
const LEGACY_KEY = 'ff_sfx_legacy';

let bank: SynthBank | LegacySynthBank | null = null;
let legacyMode = false;
let initPromise: Promise<void> | null = null;

function loadVolume(): number {
  const raw = localStorage.getItem(VOLUME_KEY);
  if (!raw) return 0.7;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.7;
}

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
    bank.master.gain.value = loadVolume();
  })();
  return initPromise;
}

export function sfxPlay(id: SfxId, opts: SfxOpts = {}): void {
  if (!bank) return;
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
    }
  } catch (e) {
    console.warn('[sfx] play failed:', id, e);
  }
}

export function sfxSetMaster(v: number): void {
  const clamped = Math.max(0, Math.min(1, v));
  localStorage.setItem(VOLUME_KEY, String(clamped));
  if (bank) bank.master.gain.value = clamped;
}

export function sfxGetMaster(): number {
  return loadVolume();
}

export function sfxBank(): SynthBank | LegacySynthBank | null {
  return bank;
}

export function sfxIsLegacy(): boolean {
  return legacyMode;
}
