// 2026-05-11 polish — audio class for the scaling pack.
//
// Classifies onUpgradeTriggered events into four SFX channels:
//   * Scaling-catalyst contributions  → scalingTick (soft cyan bell)
//   * Retrigger-catalyst fires         → retriggerEcho (short staccato)
//   * Collision-catalyst fires         → multSlam (percussive impact;
//     reuses the existing slam voice so the tray-physics origin reads
//     in the moment without authoring a new sample).
//   * Easter egg discoveries           → whisperChime (the WhisperToast
//     component plays this directly on first show — we DON'T double-play
//     here. The classifier skips easter_egg:* events.)
//
// The listener stays decoupled from CatalystStrip so the audio class
// keeps firing even when the strip is offscreen (during the scoring
// animation, post-hand result reveal, etc.).
//
// Throttle: scalingTick has a 60 ms gap in sfxPlay's SPAMMABLE_GAP_MS
// (see src-next/audio/sfx/index.ts), so a 5-catalyst hand reads as a
// 4-note arpeggio rather than a single thick chord.

import { bus } from '../../events/bus';
import { sfxPlay } from '../sfx';
import { catalystIdFromEvent } from '../../core/upgrades/eventId';
import {
  SCALING_CATALYST_IDS,
  RETRIGGER_CATALYST_IDS,
  COLLISION_CATALYST_IDS,
} from '../../data/catalysts';

// Per-scaling-catalyst pent-index offset so each catalyst plays a
// distinguishable note. Repeating offsets get the same note, which
// is fine — players hearing "two of the same bell" reads as "this is
// the same catalyst firing twice this hand", which is true.
const SCALING_NOTE_IDX: Record<string, number> = {
  lodestone: 0,
  comet_trail: 1,
  star_chart: 2,
  tide: 3,
  memento_star: 4,
  ouroboros: 5,
  highwater: 6,
  event_horizon: 7,
  lunar_phases: 8,
  heirloom_locket: 9,
  compounding_bias: 1,
  momentum: 5,
};

// Per-retrigger-catalyst pent-index offset for the echo voice. Higher
// indices = brighter ping; saved for the more "exciting" retriggers.
const RETRIGGER_NOTE_IDX: Record<string, number> = {
  encore: 5,
  gilding_press: 6,
  polaris: 7,
  refrain: 8,
  mirror_edge: 4,
  curtain_call: 9,
  stutter: 3,
  recursion_lens: 10,
  cardinal_compass: 5,
  echo_chamber: 6,
  mirrored_hand: 11,
};

export function startScalingSfxListener(): () => void {
  const off = bus.on('onUpgradeTriggered', (payload: { id: string }) => {
    // Easter eggs are handled by WhisperToast (one-time, dedup'd, plays
    // whisperChime there). Skip them here to avoid double-playing.
    if (payload.id.startsWith('easter_egg:')) return;

    const id = catalystIdFromEvent(payload.id);
    if (!id) return;

    if (SCALING_CATALYST_IDS.has(id)) {
      sfxPlay('scalingTick', { idx: SCALING_NOTE_IDX[id] ?? 4 });
      return;
    }
    if (RETRIGGER_CATALYST_IDS.has(id)) {
      sfxPlay('retriggerEcho', { idx: RETRIGGER_NOTE_IDX[id] ?? 6 });
      return;
    }
    if (COLLISION_CATALYST_IDS.has(id)) {
      // Kindred Clatter is the rare/headliner — give it the heavier slam;
      // kinetic_charge and chain_reaction land on softer-but-still-punchy
      // settings so a single tumble doesn't auditorily over-promise.
      const gain = id === 'kindred_clatter' ? 0.9 : 0.6;
      sfxPlay('multSlam', { gain });
      return;
    }
  });
  return off;
}
