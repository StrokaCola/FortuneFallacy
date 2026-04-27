import { buildBank, type SynthBank } from './synthBank';
import * as voices from './voices';

export type SfxId =
  | 'diceClack' | 'lockTap' | 'reroll' | 'buy'
  | 'combo' | 'upgrade' | 'bossSting' | 'bigScore' | 'win' | 'bust'
  | 'chipTick' | 'castSwell' | 'castBoom' | 'sigilDraw' | 'cardFlip' | 'nodePulse' | 'transitionWipe';

export type SfxOpts = { tier?: number; volume?: number; idx?: number };

const VOLUME_KEY = 'ff_next_sfxVol';

let bank: SynthBank | null = null;
let initPromise: Promise<void> | null = null;

function loadVolume(): number {
  const raw = localStorage.getItem(VOLUME_KEY);
  if (!raw) return 0.7;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.7;
}

export async function sfxInit(): Promise<void> {
  if (bank) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    bank = await buildBank();
    bank.master.gain.value = loadVolume();
  })();
  return initPromise;
}

export function sfxPlay(id: SfxId, opts: SfxOpts = {}): void {
  if (!bank) return;
  try {
    switch (id) {
      case 'diceClack': voices.diceClack(bank); break;
      case 'lockTap':   voices.lockTap(bank); break;
      case 'reroll':    voices.reroll(bank); break;
      case 'buy':       voices.buy(bank); break;
      case 'combo':     voices.combo(bank, opts); break;
      case 'upgrade':   voices.upgrade(bank); break;
      case 'bossSting': voices.bossSting(bank); break;
      case 'bigScore':  voices.bigScore(bank); break;
      case 'win':       voices.winFanfare(bank); break;
      case 'bust':           voices.bust(bank); break;
      case 'chipTick':       voices.chipTick(bank, opts); break;
      case 'castSwell':      voices.castSwell(bank); break;
      case 'castBoom':       voices.castBoom(bank); break;
      case 'sigilDraw':      voices.sigilDraw(bank); break;
      case 'cardFlip':       voices.cardFlip(bank); break;
      case 'nodePulse':      voices.nodePulse(bank); break;
      case 'transitionWipe': voices.transitionWipe(bank); break;
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

export function sfxBank(): SynthBank | null {
  return bank;
}
