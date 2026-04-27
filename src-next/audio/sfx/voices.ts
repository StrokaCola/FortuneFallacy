import * as Tone from 'tone';
import type { SynthBank } from './synthBank';

export type VoiceOpts = { tier?: number; volume?: number; idx?: number };

const COMBO_ROOT_HZ = [196, 220, 247, 261, 293, 329, 370, 415];

function rand(min: number, max: number): number { return min + Math.random() * (max - min); }

const STEP = 0.005;
let lastTime = 0;
function nextTime(): number {
  const now = Tone.now();
  const t = Math.max(now + STEP, lastTime + STEP);
  lastTime = t;
  return t;
}

export function diceClack(bank: SynthBank): void {
  bank.diceClack.volume.value = -18 + rand(-2, 2);
  bank.diceClack.triggerAttackRelease('16n', nextTime());
}

export function lockTap(bank: SynthBank): void {
  bank.lockTap.triggerAttackRelease('C4', '32n', nextTime());
}

export function reroll(bank: SynthBank): void {
  const m = bank.rerollPool[bank.rerollIdx.i % bank.rerollPool.length]!;
  bank.rerollIdx.i++;
  m.triggerAttackRelease('16n', nextTime());
}

export function buy(bank: SynthBank): void {
  const m = bank.buyPool[bank.buyIdx.i % bank.buyPool.length]!;
  bank.buyIdx.i++;
  m.triggerAttackRelease('16n', nextTime());
}

export function combo(bank: SynthBank, opts: VoiceOpts): void {
  const tier = Math.max(1, Math.min(8, opts.tier ?? 1));
  const root = COMBO_ROOT_HZ[tier - 1] ?? 261;
  bank.combo.triggerAttackRelease([root, root * 1.26, root * 1.5], '8n', nextTime());
}

export function upgrade(bank: SynthBank): void {
  const notes = ['G4', 'B4', 'D5', 'G5'];
  bank.upgrade.triggerAttackRelease(notes[Math.floor(Math.random() * notes.length)]!, '8n', nextTime());
}

export function bossSting(bank: SynthBank): void {
  const s = bank.bossSting;
  const t = nextTime();
  s.frequency.cancelScheduledValues(t);
  s.frequency.setValueAtTime(110, t);
  s.frequency.exponentialRampToValueAtTime(45, t + 0.6);
  s.triggerAttackRelease('A1', '2n', t);
}

export function bigScore(bank: SynthBank): void {
  bank.bigScore.triggerAttackRelease('4n', nextTime());
}

export function winFanfare(bank: SynthBank): void {
  const notes = ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'];
  let t = nextTime();
  notes.forEach((n) => {
    bank.winFanfare.triggerAttackRelease(n, '16n', t);
    t += 0.12;
  });
  lastTime = t;
}

export function bust(bank: SynthBank): void {
  const s = bank.bust;
  const t = nextTime();
  s.frequency.cancelScheduledValues(t);
  s.frequency.setValueAtTime(440, t);
  s.frequency.exponentialRampToValueAtTime(80, t + 0.8);
  s.triggerAttackRelease('A4', '2n', t);
}

const CHIP_BASE_HZ = 440;

export function chipTick(bank: SynthBank, opts: { idx?: number } = {}): void {
  const idx = opts.idx ?? 0;
  const freq = CHIP_BASE_HZ * Math.pow(1.0594630943592953, idx);
  bank.chipTick.triggerAttackRelease(freq, '32n', nextTime());
}

export function castSwell(bank: SynthBank): void {
  bank.castSwell.triggerAttackRelease('2n', nextTime());
}

export function castBoom(bank: SynthBank): void {
  bank.castBoom.triggerAttackRelease('A1', '2n', nextTime());
}

export function sigilDraw(bank: SynthBank): void {
  bank.sigilDraw.triggerAttackRelease('8n', nextTime());
}

export function cardFlip(bank: SynthBank): void {
  bank.cardFlip.triggerAttackRelease('32n', nextTime());
}

export function nodePulse(bank: SynthBank): void {
  bank.nodePulse.triggerAttackRelease('32n', nextTime());
}

export function transitionWipe(bank: SynthBank): void {
  bank.transitionWipe.triggerAttackRelease('4n', nextTime());
}
