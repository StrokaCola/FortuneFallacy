import * as Tone from 'tone';
import type { SynthBank } from './synthBank';
import {
  PENTATONIC_CSM_HZ, MINOR_CSM_HZ,
  tierToNotes, jitterCents, jitterMs, centsToRatio, makeVolumeMemory, pickPent,
} from './voicing';
import { triggerDuck } from './buses';

export type VoiceOpts = { tier?: number; volume?: number; idx?: number };

const STEP = 0.005;
let lastTime = 0;
function nextTime(): number {
  const now = Tone.now();
  const t = Math.max(now + STEP, lastTime + STEP);
  lastTime = t;
  return t;
}

function jitteredTime(): number {
  return nextTime() + jitterMs() / 1000;
}

const memMap = new Map<string, ReturnType<typeof makeVolumeMemory>>();
function vol(key: string, centerDb: number, spreadDb = 1.5): number {
  let mem = memMap.get(key);
  if (!mem) { mem = makeVolumeMemory(); memMap.set(key, mem); }
  return mem.next(centerDb, spreadDb);
}

// ---- diceClack -------------------------------------------------------------
export function diceClack(bank: SynthBank): void {
  const t = jitteredTime();
  const baseHz = 220 * centsToRatio(jitterCents());
  bank.diceClack.body.volume.value = vol('diceBody', -16);
  bank.diceClack.click.volume.value = vol('diceClick', -22);
  bank.diceClack.body.triggerAttackRelease(baseHz, '32n', t);
  bank.diceClack.click.triggerAttackRelease('64n', t + 0.001);
  if (Math.random() < 0.25) {
    bank.diceClack.sub.volume.value = vol('diceSub', -18);
    bank.diceClack.sub.triggerAttackRelease('G2', '16n', t + 0.002);
  }
}

// ---- lockTap ---------------------------------------------------------------
export function lockTap(bank: SynthBank): void {
  const t = jitteredTime();
  bank.lockTap.tap.volume.value = vol('lockTap', -16);
  bank.lockTap.tap.triggerAttackRelease('C4', '32n', t);
  const pingHz = pickPent(7) * centsToRatio(jitterCents());
  bank.lockTap.ping.volume.value = vol('lockPing', -22);
  bank.lockTap.ping.triggerAttackRelease(pingHz, '32n', t + 0.012);
}

// ---- reroll ----------------------------------------------------------------
export function reroll(bank: SynthBank): void {
  const slot = bank.rerollPool[bank.rerollIdx.i % bank.rerollPool.length]!;
  bank.rerollIdx.i++;
  const t = jitteredTime();
  slot.shimmer.forEach((m, i) => {
    m.volume.value = vol(`rerollShim${i}`, -26);
    m.triggerAttackRelease('32n', t + i * 0.005);
  });
  slot.sweep.volume.value = vol('rerollSweep', -28);
  slot.sweep.triggerAttackRelease('8n', t);
  lastTime = t + 0.4;
}

// ---- buy -------------------------------------------------------------------
export function buy(bank: SynthBank): void {
  const slot = bank.buyPool[bank.buyIdx.i % bank.buyPool.length]!;
  bank.buyIdx.i++;
  const t = jitteredTime();
  const root = pickPent(5) * centsToRatio(jitterCents());
  slot.chimeA.volume.value = vol('buyA', -20);
  slot.chimeB.volume.value = vol('buyB', -22);
  slot.chimeA.triggerAttackRelease(root, '8n', t);
  slot.chimeB.triggerAttackRelease(root * 1.5, '8n', t + 0.004);
  slot.rustle.volume.value = vol('buyRustle', -28);
  slot.rustle.triggerAttackRelease('16n', t + 0.04);
  lastTime = t + 0.3;
}

// ---- combo (tier-scaled phrase) -------------------------------------------
export function combo(bank: SynthBank, opts: VoiceOpts): void {
  const tier = opts.tier ?? 1;
  const notes = tierToNotes(tier).map((hz) => hz * centsToRatio(jitterCents()));
  let t = jitteredTime();
  const stepS = tier >= 5 ? 0.07 : 0.10;
  bank.combo.bells.volume.value = vol('combo', -16);
  notes.forEach((hz) => {
    bank.combo.bells.triggerAttackRelease(hz, '8n', t);
    t += stepS;
  });
  lastTime = t;
}

// ---- upgrade ---------------------------------------------------------------
export function upgrade(bank: SynthBank): void {
  const t = jitteredTime();
  const root = pickPent(7) * centsToRatio(jitterCents());
  bank.upgrade.bell.volume.value = vol('upgradeBell', -16);
  bank.upgrade.bell.triggerAttackRelease(root, '4n', t);
  for (let i = 0; i < 3; i++) {
    const hz = pickPent(10 + Math.floor(Math.random() * 5));
    bank.upgrade.sparkle.triggerAttackRelease(hz, '32n', t + 0.04 + i * 0.06);
  }
  lastTime = t + 1.0;
}

// ---- bossSting -------------------------------------------------------------
export function bossSting(bank: SynthBank): void {
  const t = jitteredTime();
  const s = bank.bossSting;
  s.brass.volume.value = vol('bossBrass', -10);
  s.brass.triggerAttackRelease(110, '2n', t);
  // Ramp the frequency down AFTER the trigger sets it, starting one tick later.
  s.brass.frequency.cancelScheduledValues(t + 0.001);
  s.brass.frequency.exponentialRampToValueAtTime(45, t + 0.6);
  s.sub.volume.value = vol('bossSub', -14);
  s.sub.triggerAttackRelease(55, '2n', t);
  triggerDuck(bank.buses, 4, 80, 250);
  lastTime = t + 1.0;
}

// ---- bigScore --------------------------------------------------------------
export function bigScore(bank: SynthBank): void {
  const t = jitteredTime();
  bank.bigScore.swell.volume.value = vol('bigSwell', -20);
  bank.bigScore.swell.triggerAttackRelease('4n', t);
  bank.bigScore.kick.volume.value = vol('bigKick', -8);
  bank.bigScore.kick.triggerAttackRelease('A1', '2n', t + 0.3);
  const stack = [PENTATONIC_CSM_HZ[0]!, MINOR_CSM_HZ[2]!, MINOR_CSM_HZ[4]!, MINOR_CSM_HZ[6]!];
  bank.bigScore.bells.triggerAttackRelease(stack, '2n', t + 0.3);
  triggerDuck(bank.buses, 6, 80, 350);
  lastTime = t + 0.5;
}

// ---- winFanfare ------------------------------------------------------------
export function winFanfare(bank: SynthBank): void {
  const t0 = jitteredTime();
  const phrase = tierToNotes(8);
  bank.winFanfare.pluck.volume.value = vol('winPluck', -10);
  bank.winFanfare.bell.volume.value = vol('winBell', -16);
  let t = t0;
  for (const hz of phrase) {
    bank.winFanfare.pluck.triggerAttackRelease(hz, '8n', t);
    bank.winFanfare.bell.triggerAttackRelease(hz * 2, '8n', t);
    t += 0.13;
  }
  triggerDuck(bank.buses, 4, 80, 250);
  lastTime = t;
}

// ---- bust ------------------------------------------------------------------
export function bust(bank: SynthBank): void {
  const t = jitteredTime();
  bank.bust.saw.volume.value = vol('bustSaw', -12);
  bank.bust.saw.triggerAttackRelease(440, '2n', t);
  bank.bust.saw.frequency.cancelScheduledValues(t + 0.001);
  bank.bust.saw.frequency.exponentialRampToValueAtTime(80, t + 0.8);
  bank.bust.rumble.volume.value = vol('bustRumble', -18);
  bank.bust.rumble.triggerAttackRelease('2n', t);
  bank.bust.tear.volume.value = vol('bustTear', -22);
  bank.bust.tear.triggerAttackRelease('16n', t + 0.6);
  lastTime = t + 1.0;
}

// ---- chipTick (idx → pent climb) ------------------------------------------
export function chipTick(bank: SynthBank, opts: VoiceOpts & { freq?: number } = {}): void {
  const idx = opts.idx ?? 0;
  const hz = opts.freq !== undefined ? opts.freq : pickPent(idx) * centsToRatio(jitterCents());
  bank.chipTick.fm.volume.value = vol('chipTick', -16);
  bank.chipTick.fm.triggerAttackRelease(hz, '32n', jitteredTime());
}

// ---- castSwell -------------------------------------------------------------
export function castSwell(bank: SynthBank): void {
  const t = jitteredTime();
  bank.castSwell.rise.volume.value = vol('swellRise', -22);
  bank.castSwell.rise.triggerAttackRelease('2n', t);
  bank.castSwell.drone.volume.value = vol('swellDrone', -22);
  const root = PENTATONIC_CSM_HZ[0]!;
  bank.castSwell.drone.triggerAttackRelease([root, root * 1.5, root * 2], '2n', t);
  bank.castSwell.arp.volume.value = vol('swellArp', -28);
  for (let i = 0; i < 8; i++) {
    bank.castSwell.arp.triggerAttackRelease(pickPent(i), '32n', t + 0.05 + i * 0.1);
  }
  lastTime = t + 1.0;
}

// ---- castBoom --------------------------------------------------------------
export function castBoom(bank: SynthBank, opts: VoiceOpts & { gain?: number } = {}): void {
  const t = jitteredTime();
  const gain = opts.gain ?? 1;
  bank.castBoom.kick.volume.value = vol('boomKick', -10 + Math.log2(gain) * 6);
  bank.castBoom.kick.triggerAttackRelease('A1', '2n', t);
  const stack = [PENTATONIC_CSM_HZ[0]!, MINOR_CSM_HZ[2]!, MINOR_CSM_HZ[4]!];
  bank.castBoom.bells.triggerAttackRelease(stack, '2n', t);
  bank.castBoom.tail.volume.value = vol('boomTail', -22);
  bank.castBoom.tail.triggerAttackRelease('4n', t + 0.05);
  triggerDuck(bank.buses, 5, 80, 300);
  lastTime = t + 1.0;
}

// ---- sigilDraw -------------------------------------------------------------
export function sigilDraw(bank: SynthBank): void {
  const t = jitteredTime();
  bank.sigilDraw.scratch.volume.value = vol('sigilScratch', -22);
  const n = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < n; i++) {
    bank.sigilDraw.scratch.triggerAttackRelease('64n', t + (i / n) * 0.6 + Math.random() * 0.02);
  }
  bank.sigilDraw.chime.volume.value = vol('sigilChime', -22);
  bank.sigilDraw.chime.triggerAttackRelease(pickPent(2), '4n', t + 0.55);
  lastTime = t + 1.0;
}

// ---- cardFlip --------------------------------------------------------------
export function cardFlip(bank: SynthBank): void {
  const t = jitteredTime();
  bank.cardFlip.paper.volume.value = vol('flipPaper', -22);
  bank.cardFlip.paper.triggerAttackRelease('64n', t);
  bank.cardFlip.whoosh.volume.value = vol('flipWhoosh', -28);
  bank.cardFlip.whoosh.triggerAttackRelease('16n', t + 0.005);
  bank.cardFlip.chime.volume.value = vol('flipChime', -24);
  bank.cardFlip.chime.triggerAttackRelease(pickPent(3 + Math.floor(Math.random() * 4)), '32n', t + 0.06);
  lastTime = t + 0.15;
}

// ---- nodePulse -------------------------------------------------------------
export function nodePulse(bank: SynthBank): void {
  const t = jitteredTime();
  bank.nodePulse.bell.volume.value = vol('nodeBell', -22);
  bank.nodePulse.bell.triggerAttackRelease(pickPent(6 + Math.floor(Math.random() * 5)), '16n', t);
  bank.nodePulse.shimmer.volume.value = vol('nodeShim', -30);
  bank.nodePulse.shimmer.triggerAttackRelease('32n', t + 0.02);
  lastTime = t + 0.20;
}

// ---- transitionWipe -------------------------------------------------------
export function transitionWipe(bank: SynthBank): void {
  const t = jitteredTime();
  bank.transitionWipe.sweep.volume.value = vol('wipeSweep', -22);
  bank.transitionWipe.sweep.triggerAttackRelease('2n', t);
  const root = PENTATONIC_CSM_HZ[0]!;
  bank.transitionWipe.pad.volume.value = vol('wipePad', -26);
  bank.transitionWipe.pad.triggerAttackRelease([root, root * 2], '2n', t);
  bank.transitionWipe.arrive.volume.value = vol('wipeArrive', -22);
  bank.transitionWipe.arrive.triggerAttackRelease(pickPent(7), '8n', t + 0.45);
  lastTime = t + 0.55;
}

// ---- multSlam ---------------------------------------------------------------
export function multSlam(bank: SynthBank, opts: VoiceOpts & { freq?: number; gain?: number } = {}): void {
  const t = jitteredTime();
  const hz = opts.freq ?? 220;
  const gain = opts.gain ?? 1;
  bank.castBoom.kick.volume.value = vol('multSlam', -10 + Math.log2(gain) * 6);
  bank.castBoom.kick.triggerAttackRelease(hz, '16n', t);
  triggerDuck(bank.buses, 4, 60, 120);
}

// ---- comboChime -------------------------------------------------------------
export function comboChime(bank: SynthBank): void {
  const t = jitteredTime();
  const root = pickPent(7) * centsToRatio(jitterCents());
  bank.lockTap.ping.volume.value = vol('comboChime', -14);
  bank.lockTap.ping.triggerAttackRelease(root, '8n', t);
  bank.lockTap.ping.triggerAttackRelease(root * 1.5, '8n', t + 0.04);
}

// ---- targetCross ------------------------------------------------------------
export function targetCross(bank: SynthBank): void {
  const t = jitteredTime();
  const slot = bank.rerollPool[bank.rerollIdx.i % bank.rerollPool.length]!;
  bank.rerollIdx.i++;
  slot.sweep.volume.value = vol('targetSweep', -16);
  slot.sweep.triggerAttackRelease('4n', t);
  bank.lockTap.ping.volume.value = vol('targetSubChime', -10);
  bank.lockTap.ping.triggerAttackRelease(110, '4n', t + 0.02);
}

// ---- notEnough --------------------------------------------------------------
export function notEnough(bank: SynthBank): void {
  const t = jitteredTime();
  bank.lockTap.ping.volume.value = vol('notEnough', -14);
  bank.lockTap.ping.triggerAttackRelease(220, '4n', t);
  bank.lockTap.ping.triggerAttackRelease(174.6, '4n', t + 0.18);
  bank.castBoom.kick.volume.value = vol('notEnoughThud', -16);
  bank.castBoom.kick.triggerAttackRelease(80, '8n', t + 0.32);
}
