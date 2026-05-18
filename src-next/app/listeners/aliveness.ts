// Aliveness listener (2026-05-18). Bridges derived round state to
// the ambient reactions layer:
//
//   * Death's-edge: drives nebula vignette and emits onNearBust /
//     onSafe events (heartbeat haptic rides those). Audio tension
//     is already wired in audio/audioBridge.ts via the same source
//     of truth (selectTensionFromState), so this listener does NOT
//     re-write audioEngine.setTension — that would race with the
//     audio bridge's own writer.
//   * Storm telegraph: dispatches onStormIncoming one blind before
//     a voidstorm is scheduled to spawn.
//
// Respects the ambient-reactions setting: 'off' keeps the vignette
// at zero and suppresses event dispatch; 'subtle' halves the
// visible intensity. Discovery moments live in OfferCard directly
// and are unaffected by this setting.

import { store } from '../../state/store';
import { bus } from '../../events/bus';
import { setNebulaTension, setNebulaProgress } from '../../render/bg/nebula';
import { setStageClutch } from '../../render/stage';
import { selectTensionFromState } from '../../state/selectors';
import { isClutch, peekNextStorm } from '../../core/round/aliveness';
import {
  ambientIntensityScalar,
  subscribeAmbientReactions,
} from '../settings/aliveness';

const NEAR_BUST_ENTER = 0.7;
const NEAR_BUST_EXIT = 0.5;

export function startAlivenessListener(): () => void {
  let nearBustActive = false;
  let lastBlindIdx = store.getState().run.goalIdx;
  let stormAnnouncedForBlind = -1;
  let lastNebulaTension = -1;

  const applyNebulaTension = (t: number) => {
    if (Math.abs(t - lastNebulaTension) < 0.01) return;
    lastNebulaTension = t;
    setNebulaTension(t);
  };

  // Re-apply on settings change so flipping the toggle has an
  // immediate effect on the vignette without waiting for the next
  // state tick.
  const offSettings = subscribeAmbientReactions(() => {
    lastNebulaTension = -1;
    const s = store.getState();
    const raw = selectTensionFromState(s);
    applyNebulaTension(raw * ambientIntensityScalar());
  });

  let lastProgress = -1;
  const offStore = store.subscribe((s) => {
    const raw = selectTensionFromState(s);
    const scalar = ambientIntensityScalar();
    const scaled = raw * scalar;
    applyNebulaTension(scaled);

    // 2026-05-18 P5.1: constellation backdrop progression. Drive
    // u_progress from goalIdx (0..11) so the starfield brightens
    // incrementally across the 12-blind run. Each blind clear bumps
    // the target by ~8.3%; boss clears (goalIdx % 3 === 2 before
    // clear) land on round numbers 0.25 / 0.5 / 0.75 / 1.0.
    const goalIdx = s.run.goalIdx ?? 0;
    const progressTarget = Math.min(1, goalIdx / 12);
    if (Math.abs(progressTarget - lastProgress) > 0.01) {
      lastProgress = progressTarget;
      // Discovery features (Tier 2.2 in spec) ignore the 'off' setting
      // for ambient reactions — they're informational, not motion-heavy.
      // But we DO honour the scalar so 'subtle' produces a smaller
      // brightness lift.
      setNebulaProgress(progressTarget * Math.max(0.5, scalar));
    }

    // Hysteresis on the near-bust threshold — operate against the
    // RAW tension so the band is consistent regardless of the
    // user's intensity scalar. 'off' (scalar 0) suppresses the
    // dispatch outright by short-circuiting before the threshold.
    if (scalar > 0) {
      if (!nearBustActive && raw >= NEAR_BUST_ENTER) {
        nearBustActive = true;
        bus.emit('onNearBust', { tension: scaled });
      } else if (nearBustActive && raw <= NEAR_BUST_EXIT) {
        nearBustActive = false;
        bus.emit('onSafe', {});
      }
    } else if (nearBustActive) {
      nearBustActive = false;
      bus.emit('onSafe', {});
    }

    // 2026-05-18 P5.4: clutch camera. setStageClutch is idempotent so
    // safe to call every tick. Disables when scalar=0 ('off').
    setStageClutch(scalar > 0 && isClutch(s));

    // Storm telegraph — fire onStormIncoming once per blind
    // transition when the upcoming blind would spawn a storm.
    // Boss blinds (blindIndex === 2) don't roll storms; the
    // peekNextStorm helper already handles that.
    if (s.run.goalIdx !== lastBlindIdx) {
      lastBlindIdx = s.run.goalIdx;
      const upcoming = peekNextStorm(s);
      if (upcoming && stormAnnouncedForBlind !== s.run.goalIdx + 1) {
        stormAnnouncedForBlind = s.run.goalIdx + 1;
        bus.emit('onStormIncoming', {
          stormId: upcoming,
          bindIdx: s.run.goalIdx + 1,
        });
      }
    }
  });

  return () => {
    offStore();
    offSettings();
    // Park the vignette at zero on dispose so dev HMR doesn't
    // leak the last state into the replacement module instance.
    setNebulaTension(0);
    setNebulaProgress(0);
    setStageClutch(false);
  };
}
