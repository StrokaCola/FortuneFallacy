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
// Was: a single 16th-note kick at the beat freq. Sample bank's MembraneSynth
// has a 500ms decay envelope, but a 16n trigger only releases ~60ms of it —
// the body never sounded. Now layered: a low sub-thud an octave below the
// beat freq for weight, the kick at full body, plus the FM bells from
// castBoom riding the same pitch for harmonic ring. Total perceived volume
// rises with `gain` (chain depth) so deeper chains hit harder.
export function multSlam(bank: SynthBank, opts: VoiceOpts & { freq?: number; gain?: number } = {}): void {
  const t = jitteredTime();
  const hz = opts.freq ?? 220;
  const gain = opts.gain ?? 1;
  // Sub thud: octave-down kick that fades into the room. Gives chest impact
  // without crowding the on-pitch attack — its frequency is far enough below
  // the kick that they don't beat against each other.
  bank.castBoom.kick.volume.value = vol('multSlamSub', -14 + Math.log2(gain) * 6);
  bank.castBoom.kick.triggerAttackRelease(Math.max(45, hz / 2), '8n', t);
  // On-pitch kick: slightly louder than before (-10 → -8 base) and 8th-note
  // duration so the pitch decay actually sounds. Triggered 18ms after the
  // sub so the two transients don't smear into one mushy click.
  bank.castBoom.kick.volume.value = vol('multSlam', -8 + Math.log2(gain) * 6);
  bank.castBoom.kick.triggerAttackRelease(hz, '8n', t + 0.018);
  // Harmonic ring: castBoom's FM bells one octave above, soft, so the slam
  // has a sustaining tail rather than just a transient. Gain-scaled so
  // small slams stay percussive and big ones bloom.
  bank.castBoom.bells.volume.value = vol('multSlamRing', -22 + Math.log2(gain) * 4);
  bank.castBoom.bells.triggerAttackRelease(hz * 2, '4n', t + 0.012);
  // Stronger duck so the slam reads as the loudest event in its window.
  triggerDuck(bank.buses, 4, 80, 160);
}

// ---- comboChime -------------------------------------------------------------
// Was: two 8n pings on lockTap (a 50ms decay FMSynth — basically a
// notification blip). Now uses combo.bells, the proper FM bell PolySynth
// authored for this purpose, with a triadic stack and a low fundamental
// octaves below for body. Result feels celebratory rather than terse.
export function comboChime(bank: SynthBank): void {
  const t = jitteredTime();
  const root = pickPent(7) * centsToRatio(jitterCents());
  // Triadic bell stack — root, perfect fifth, octave — plays as one chord
  // rather than two sequential pings. The PolySynth handles voicing.
  bank.combo.bells.volume.value = vol('comboChimeBells', -12);
  bank.combo.bells.triggerAttackRelease([root, root * 1.5, root * 2], '4n', t);
  // Sub fundamental — half the root, much quieter — adds chest body so
  // the chime doesn't float on top of the mix as a thin sparkle.
  bank.castBoom.kick.volume.value = vol('comboChimeSub', -22);
  bank.castBoom.kick.triggerAttackRelease(Math.max(55, root / 4), '8n', t);
  // Tiny lockTap shimmer one beat later for the "second tick" feel of the
  // original, but at lower volume so the bell stack remains the focal point.
  bank.lockTap.ping.volume.value = vol('comboChimeShimmer', -20);
  bank.lockTap.ping.triggerAttackRelease(root * 3, '16n', t + 0.06);
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

// ---- modPulse: short bright chime per generic mod fire -------------------
export function modPulse(bank: SynthBank): void {
  const t = jitteredTime();
  const hz = pickPent(7) * centsToRatio(jitterCents());
  bank.modPulse.chime.volume.value = vol('modPulse', -18);
  bank.modPulse.chime.triggerAttackRelease(hz, '16n', t);
}

// ---- modLoaded: rising bronze chord + whoosh -----------------------------
export function modLoaded(bank: SynthBank): void {
  const t = jitteredTime();
  bank.modLoaded.chord.volume.value = vol('modLoadedChord', -16);
  bank.modLoaded.whoosh.volume.value = vol('modLoadedWhoosh', -22);
  bank.modLoaded.chord.triggerAttackRelease(['C4', 'E4', 'G4'], '4n', t);
  bank.modLoaded.whoosh.triggerAttackRelease('8n', t);
}

// ---- modPipCharge: percussive amber tick ---------------------------------
export function modPipCharge(bank: SynthBank): void {
  const t = jitteredTime();
  const hz = 880 * centsToRatio(jitterCents());
  bank.modPipCharge.tick.volume.value = vol('modPipCharge', -16);
  bank.modPipCharge.tick.triggerAttackRelease(hz, '32n', t);
}

// ---- modBackstop: warm low ding + soft rumble ----------------------------
export function modBackstop(bank: SynthBank): void {
  const t = jitteredTime();
  bank.modBackstop.ding.volume.value = vol('modBackstop', -16);
  bank.modBackstop.rumble.volume.value = vol('modBackstopRumble', -22);
  bank.modBackstop.ding.triggerAttackRelease('A3', '4n', t);
  bank.modBackstop.rumble.triggerAttackRelease('8n', t + 0.02);
}

// ---- modCrown: regal bell + warm thud + tiny sparkle ---------------------
// Fires when Crown lands a 6. Bell carries the melody, warmth grounds it,
// sparkle is the gold-leaf glint.
export function modCrown(bank: SynthBank): void {
  const t = jitteredTime();
  bank.modCrown.bell.volume.value = vol('modCrownBell', -14);
  bank.modCrown.warmth.volume.value = vol('modCrownWarmth', -20);
  bank.modCrown.sparkle.volume.value = vol('modCrownSparkle', -28);
  bank.modCrown.bell.triggerAttackRelease('A5', '4n', t);
  bank.modCrown.warmth.triggerAttackRelease('A2', '16n', t);
  bank.modCrown.sparkle.triggerAttackRelease('32n', t + 0.03);
}

// ---- modShatter: pink-noise crack + downward fifth glide -----------------
// For Brittle. The tone glides A5→D5 over 200ms so the mod reads as
// "fracture, energy dropping" rather than "neutral mod fire."
export function modShatter(bank: SynthBank): void {
  const t = jitteredTime();
  bank.modShatter.crack.volume.value = vol('modShatterCrack', -18);
  bank.modShatter.tone.volume.value = vol('modShatterTone', -22);
  bank.modShatter.crack.triggerAttackRelease('32n', t);
  bank.modShatter.tone.setNote('A5', t);
  bank.modShatter.tone.triggerAttackRelease('A5', '8n', t);
  bank.modShatter.tone.frequency.exponentialRampTo('D5', 0.18, t + 0.01);
}

// ---- modSwirl: three pentatonic notes ascending tightly ------------------
// For Wildcard. Plays as a quick prismatic flick — three notes 40ms
// apart, ascending, lightly detuned.
export function modSwirl(bank: SynthBank): void {
  const t = jitteredTime();
  bank.modSwirl.trio.volume.value = vol('modSwirl', -16);
  const root = pickPent(5) * centsToRatio(jitterCents());
  bank.modSwirl.trio.triggerAttackRelease(root, '16n', t);
  bank.modSwirl.trio.triggerAttackRelease(root * 1.25, '16n', t + 0.04);
  bank.modSwirl.trio.triggerAttackRelease(root * 1.5,  '16n', t + 0.08);
}

// ---- modFlashback: primary chime + delayed detuned ghost -----------------
// For Echo. Audio twin of the visual's primary-pulse + ghost-pulse.
export function modFlashback(bank: SynthBank): void {
  const t = jitteredTime();
  const hz = pickPent(6) * centsToRatio(jitterCents());
  bank.modFlashback.primary.volume.value = vol('modFlashbackPrimary', -16);
  bank.modFlashback.ghost.volume.value = vol('modFlashbackGhost', -22);
  bank.modFlashback.primary.triggerAttackRelease(hz, '16n', t);
  // Ghost: 120ms delay, +5 cents detune so it beats lightly against the primary.
  bank.modFlashback.ghost.triggerAttackRelease(hz * centsToRatio(5), '16n', t + 0.12);
}

// ---- modConduit: spark + ascending tone ----------------------------------
// For Conduit. Quick electric flick that suggests current arriving.
export function modConduit(bank: SynthBank): void {
  const t = jitteredTime();
  const hz = pickPent(4) * centsToRatio(jitterCents());
  bank.modConduit.spark.volume.value = vol('modConduitSpark', -22);
  bank.modConduit.tone.volume.value = vol('modConduitTone', -18);
  bank.modConduit.spark.triggerAttackRelease('64n', t);
  bank.modConduit.tone.triggerAttackRelease(hz, '16n', t + 0.005);
  bank.modConduit.tone.frequency.exponentialRampTo(hz * 1.5, 0.10, t + 0.01);
}

// ---- modCrescendo: pink swell + arriving chord ---------------------------
// For Crescendo. Wave builds, chord lands as it peaks.
// Shortened from '4n' swell + '8n' chord to '8n' + '16n' so a 5-die
// Crescendo wave doesn't trail across the whole next die-tick.
export function modCrescendo(bank: SynthBank): void {
  const t = jitteredTime();
  bank.modCrescendo.swell.volume.value = vol('modCrescendoSwell', -22);
  bank.modCrescendo.chord.volume.value = vol('modCrescendoChord', -16);
  bank.modCrescendo.swell.triggerAttackRelease('8n', t);
  bank.modCrescendo.chord.triggerAttackRelease(['E4', 'G4', 'B4'], '16n', t + 0.10);
}

// ---- modResonance: held chord + harmonic ring ----------------------------
// For Resonance — the legendary double-fire deserves a sustained shimmer.
// Shortened from '2n' to '4n' so multiple Resonance fires in one hand
// don't compound into a 2+ second wash of chord.
export function modResonance(bank: SynthBank): void {
  const t = jitteredTime();
  bank.modResonance.chord.volume.value = vol('modResonanceChord', -14);
  bank.modResonance.harmonic.volume.value = vol('modResonanceHarmonic', -24);
  bank.modResonance.chord.triggerAttackRelease(['D4', 'A4', 'D5'], '4n', t);
  bank.modResonance.harmonic.triggerAttackRelease('8n', t + 0.05);
}

// ---- modPyreMark: ember crackle + tiny ping ------------------------------
// For Pyre Mark. Fires every time the die rolls a 1, so it must stay
// small — pings are at -22 dB so multiples don't pile up.
export function modPyreMark(bank: SynthBank): void {
  const t = jitteredTime();
  const hz = 660 * centsToRatio(jitterCents());
  bank.modPyreMark.ember.volume.value = vol('modPyreMarkEmber', -24);
  bank.modPyreMark.ping.volume.value = vol('modPyreMarkPing', -22);
  bank.modPyreMark.ember.triggerAttackRelease('64n', t);
  bank.modPyreMark.ping.triggerAttackRelease(hz, '32n', t + 0.015);
}

// ---- modTallyMark: pencil scratch + low click ----------------------------
// For Tally Mark. Reads as ink-on-paper — a tick being scribed.
export function modTallyMark(bank: SynthBank): void {
  const t = jitteredTime();
  bank.modTallyMark.scratch.volume.value = vol('modTallyMarkScratch', -22);
  bank.modTallyMark.click.volume.value = vol('modTallyMarkClick', -20);
  bank.modTallyMark.scratch.triggerAttackRelease('32n', t);
  bank.modTallyMark.click.triggerAttackRelease('C2', '32n', t + 0.01);
}

// ---- modTwinGlow: bell + delayed detuned partner -------------------------
// For Mirror Pair. The partner bell at +20 cents and 60ms creates a
// shimmer rather than a clean second strike.
export function modTwinGlow(bank: SynthBank): void {
  const t = jitteredTime();
  const hz = pickPent(5) * centsToRatio(jitterCents());
  bank.modTwinGlow.bell.volume.value = vol('modTwinGlowBell', -16);
  bank.modTwinGlow.partner.volume.value = vol('modTwinGlowPartner', -20);
  bank.modTwinGlow.bell.triggerAttackRelease(hz, '16n', t);
  bank.modTwinGlow.partner.triggerAttackRelease(hz * centsToRatio(20), '16n', t + 0.06);
}

// ---- modShardClink: metallic clink + low thud ----------------------------
// For Tithe. Coins falling onto stone.
export function modShardClink(bank: SynthBank): void {
  const t = jitteredTime();
  bank.modShardClink.clink.volume.value = vol('modShardClinkMetal', -20);
  bank.modShardClink.thud.volume.value = vol('modShardClinkThud', -22);
  bank.modShardClink.clink.triggerAttackRelease('16n', t);
  bank.modShardClink.thud.triggerAttackRelease('A2', '32n', t + 0.02);
}

// ---- modRhythmStack: 3 sequential beats + bell --------------------------
// For Cadence. Three percussive taps at 80ms intervals — the stack
// climbing audibly.
export function modRhythmStack(bank: SynthBank): void {
  const t = jitteredTime();
  bank.modRhythmStack.beat.volume.value = vol('modRhythmStackBeat', -18);
  bank.modRhythmStack.chime.volume.value = vol('modRhythmStackChime', -22);
  const hz = pickPent(5) * centsToRatio(jitterCents());
  bank.modRhythmStack.beat.triggerAttackRelease('C3', '32n', t);
  bank.modRhythmStack.beat.triggerAttackRelease('C3', '32n', t + 0.08);
  bank.modRhythmStack.beat.triggerAttackRelease('C3', '32n', t + 0.16);
  bank.modRhythmStack.chime.triggerAttackRelease(hz, '16n', t + 0.20);
}

// ---- modAppetite: inward whoosh + low gulp -------------------------------
// For Glutton. Whoosh in, gulp lands.
// Whoosh shortened from '4n' → '8n' so back-to-back glutton fires
// don't pile a continuous low-frequency drone.
export function modAppetite(bank: SynthBank): void {
  const t = jitteredTime();
  bank.modAppetite.whoosh.volume.value = vol('modAppetiteWhoosh', -22);
  bank.modAppetite.gulp.volume.value = vol('modAppetiteGulp', -18);
  bank.modAppetite.whoosh.triggerAttackRelease('8n', t);
  bank.modAppetite.gulp.triggerAttackRelease('G2', '16n', t + 0.12);
}

// ---- modAwaken: held drone + bright flash --------------------------------
// For Dormant. Longest mod voice — the once-per-run awakening earns it.
// Drone bounded to '4n' so concurrent awakenings cap at ~0.6s of overlap
// instead of 2+ seconds.
export function modAwaken(bank: SynthBank): void {
  const t = jitteredTime();
  bank.modAwaken.drone.volume.value = vol('modAwakenDrone', -14);
  bank.modAwaken.flash.volume.value = vol('modAwakenFlash', -16);
  bank.modAwaken.drone.triggerAttackRelease(['D3', 'A3', 'D4'], '4n', t);
  bank.modAwaken.flash.triggerAttackRelease('D5', '8n', t + 0.25);
}

// ---- uiClick: short white noise burst ------------------------------------
export function uiClick(bank: SynthBank): void {
  const t = jitteredTime();
  bank.uiClick.click.volume.value = vol('uiClick', -22);
  bank.uiClick.click.triggerAttackRelease('64n', t);
}

// ---- uiHover: brief metallic shimmer -------------------------------------
export function uiHover(bank: SynthBank): void {
  const t = jitteredTime();
  bank.uiHover.shimmer.volume.value = vol('uiHover', -28);
  bank.uiHover.shimmer.triggerAttackRelease('32n', t);
}

// ---- modAttach: chime + soft thud ----------------------------------------
export function modAttach(bank: SynthBank): void {
  const t = jitteredTime();
  const hz = pickPent(5) * centsToRatio(jitterCents());
  bank.modAttach.chime.volume.value = vol('modAttachChime', -18);
  bank.modAttach.thud.volume.value = vol('modAttachThud', -20);
  bank.modAttach.chime.triggerAttackRelease(hz, '8n', t);
  bank.modAttach.thud.triggerAttackRelease('C2', '16n', t + 0.005);
}

// ---- modDetach: descending pluck -----------------------------------------
export function modDetach(bank: SynthBank): void {
  const t = jitteredTime();
  bank.modDetach.pluck.triggerAttackRelease('A4', '8n', t);
}

// ---- scalingTick: soft pentatonic bell, ticks with the stack -------------
// Plays on every scaling-catalyst contribution. opts.idx, when provided,
// picks a higher note from the cosmic pentatonic — Lodestone at idx 0,
// Star Chart at idx 2, Memento Star at idx 4, etc. Keeps a 5-catalyst
// scaling lattice musically distinct from one another.
export function scalingTick(bank: SynthBank, opts: VoiceOpts = {}): void {
  const t = jitteredTime();
  const idx = opts.idx ?? 4;
  const hz = pickPent(8 + idx) * centsToRatio(jitterCents());
  bank.modPulse.chime.volume.value = vol('scalingTick', -22);
  bank.modPulse.chime.triggerAttackRelease(hz, '32n', t);
}

// ---- retriggerEcho: a die's mod echoes — short staccato repeat -----------
// One short FM ping at a high pent index, then a softer echo a 16th later
// at a half-step shift. Reads as "this die just fired again" without
// stepping on the regular score-beat audio.
export function retriggerEcho(bank: SynthBank, opts: VoiceOpts = {}): void {
  const t = jitteredTime();
  const idx = opts.idx ?? 6;
  const hz = pickPent(idx) * centsToRatio(jitterCents());
  bank.lockTap.ping.volume.value = vol('retriggerEcho', -18);
  bank.lockTap.ping.triggerAttackRelease(hz, '32n', t);
  bank.lockTap.ping.volume.value = vol('retriggerEchoTail', -24);
  bank.lockTap.ping.triggerAttackRelease(hz * 1.5, '32n', t + 0.06);
}

// ---- whisperChime: a slow pentatonic bell arpeggio for easter eggs -------
// Three rising bells over 320 ms, low velocity, ends on the octave. The
// shape is intentionally LONGER and SOFTER than combo/comboChime so a
// whisper reads as ambient + numinous rather than victorious.
export function whisperChime(bank: SynthBank, opts: VoiceOpts = {}): void {
  const t = jitteredTime();
  const idx = opts.idx ?? 0; // per-egg base note offset
  const root = pickPent(5 + idx) * centsToRatio(jitterCents());
  bank.combo.bells.volume.value = vol('whisperBells', -18);
  // Three-step rise: root, fifth, octave.
  bank.combo.bells.triggerAttackRelease(root, '4n', t);
  bank.combo.bells.triggerAttackRelease(root * 1.5, '4n', t + 0.11);
  bank.combo.bells.triggerAttackRelease(root * 2, '2n', t + 0.22);
  // A sub-octave shimmer for body, matching how comboChime threads a sub.
  bank.castBoom.kick.volume.value = vol('whisperSub', -26);
  bank.castBoom.kick.triggerAttackRelease(Math.max(55, root / 2), '4n', t);
  lastTime = t + 0.7;
}
