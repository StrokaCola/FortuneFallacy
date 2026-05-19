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
  // 2026-05-14 fifth + sixth pass — bespoke voices for the 9 mods
  // whose mechanics warrant a custom audio moment.
  | 'modCrown' | 'modShatter' | 'modSwirl' | 'modFlashback'
  | 'modConduit' | 'modCrescendo' | 'modResonance'
  | 'modPyreMark' | 'modTallyMark'
  // 2026-05-14 seventh pass — twin/cost/rhythm/appetite/awaken voices.
  | 'modTwinGlow' | 'modShardClink' | 'modRhythmStack'
  | 'modAppetite' | 'modAwaken'
  | 'modAttach' | 'modDetach' | 'uiClick' | 'uiHover'
  // Wave K — graded press tier voices. uiHoverSoft is a quieter shimmer
  // for ghost-tier hover; uiCommit weights destructive presses; uiDenied
  // confirms a blocked tap so disabled doesn't feel dead.
  | 'uiHoverSoft' | 'uiCommit' | 'uiDenied'
  // 2026-05-11 polish pass — scaling pack stings. scalingTick fires on every
  // scaling-catalyst contribution (very quiet, throttled). retriggerEcho
  // fires once per retrigger catalyst hit (Polaris/Refrain/etc). whisperChime
  // fires once when an easter egg is discovered for the first time.
  | 'scalingTick' | 'retriggerEcho' | 'whisperChime'
  // 2026-05-16 polish — near-miss sting played from RunPostmortem when
  // the player busts within 10% of the target. Falling minor third on
  // the lockTap ping with a sub-thud tail, distinct from `notEnough`
  // (which fires on a per-hand bail) so the postmortem moment reads
  // as "you almost had it" rather than "wrong hand".
  | 'nearMiss';

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
  // Wave K — mirror uiHover's throttle so the ghost-tier hover doesn't
  // stutter on a fast mouse sweep, and gate denied/commit so spam-clicks
  // on a disabled button don't pile up.
  uiHoverSoft: 80,
  uiDenied: 220,
  uiCommit: 120,
  cardFlip: 90,
  // scalingTick is intentionally throttled aggressively — a 5-die hand with
  // 6 scaling catalysts could otherwise queue dozens of bells. 60ms gap
  // lets a chain READ as a chain without auditioning as a stutter.
  scalingTick: 60,
  // 2026-05-14 audio polish — bound every mod voice so a 5-mod hand
  // doesn't pile 5 simultaneous tails on top of each other. The
  // long-sustain voices (Crescendo / Resonance / Awaken / Appetite)
  // get aggressive gaps; the short percussive ones a lighter touch.
  // Numbers picked to match each voice's natural decay time so the
  // throttle is inaudible on isolated fires but bounds the worst case.
  modPulse:       40,
  modLoaded:      90,
  modPipCharge:   40,
  modBackstop:   100,
  modCrown:      120,
  modShatter:     90,
  modSwirl:       80,
  modFlashback:   90,
  modConduit:     60,
  modCrescendo:  220,
  modResonance:  260,
  modPyreMark:    40,
  modTallyMark:   40,
  modTwinGlow:   100,
  modShardClink:  90,
  modRhythmStack:240,
  modAppetite:   200,
  modAwaken:     500,
  // Wave T Scoring Theater (Batch I, 2026-05-19) — voice-steal
  // throttle for scoring beats. Without this, a 5-die hand with 4
  // catalysts and 3 mods piled 12 chipTicks + 4 multSlams into a
  // ~400ms window and the mix washed. Gaps tuned to roughly match
  // the existing pacing's beat duration so isolated fires are
  // inaudible-throttled but a wash collapses to a clean cadence.
  chipTick:  50,
  multSlam:  80,
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
      case 'bossSting':       v.bossSting(bank as never, opts); break;
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
      case 'modCrown':        (v as typeof voices).modCrown(bank as never); break;
      case 'modShatter':      (v as typeof voices).modShatter(bank as never); break;
      case 'modSwirl':        (v as typeof voices).modSwirl(bank as never); break;
      case 'modFlashback':    (v as typeof voices).modFlashback(bank as never); break;
      case 'modConduit':      (v as typeof voices).modConduit(bank as never); break;
      case 'modCrescendo':    (v as typeof voices).modCrescendo(bank as never); break;
      case 'modResonance':    (v as typeof voices).modResonance(bank as never); break;
      case 'modPyreMark':     (v as typeof voices).modPyreMark(bank as never); break;
      case 'modTallyMark':    (v as typeof voices).modTallyMark(bank as never); break;
      case 'modTwinGlow':     (v as typeof voices).modTwinGlow(bank as never); break;
      case 'modShardClink':   (v as typeof voices).modShardClink(bank as never); break;
      case 'modRhythmStack':  (v as typeof voices).modRhythmStack(bank as never); break;
      case 'modAppetite':     (v as typeof voices).modAppetite(bank as never); break;
      case 'modAwaken':       (v as typeof voices).modAwaken(bank as never); break;
      case 'modAttach':       (v as typeof voices).modAttach(bank as never); break;
      case 'modDetach':       (v as typeof voices).modDetach(bank as never); break;
      case 'uiClick':         (v as typeof voices).uiClick(bank as never); break;
      case 'uiHover':         (v as typeof voices).uiHover(bank as never); break;
      case 'uiHoverSoft':     (v as typeof voices).uiHoverSoft(bank as never); break;
      case 'uiCommit':        (v as typeof voices).uiCommit(bank as never); break;
      case 'uiDenied':        (v as typeof voices).uiDenied(bank as never); break;
      case 'scalingTick':     (v as typeof voices).scalingTick(bank as never, opts); break;
      case 'retriggerEcho':   (v as typeof voices).retriggerEcho(bank as never, opts); break;
      case 'whisperChime':    (v as typeof voices).whisperChime(bank as never, opts); break;
      case 'nearMiss':        (v as typeof voices).nearMiss(bank as never); break;
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
