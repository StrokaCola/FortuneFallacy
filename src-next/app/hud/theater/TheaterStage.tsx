// Wave T Scoring Theater (Batch J, 2026-05-19) — visual stage layer.
// Subscribes to onTheaterPhase and toggles full-stage CSS classes for:
//   - theater-zoom        — camera push-in on sustained when peak-mult ≥ 8
//   - theater-freeze      — pre-boom held-breath dim + saturate + drift-pause
//   - data-theater-tier   — 1-4 tier on #vfx-scoring-layer; CSS amplifies
//                            existing screen FX intensity by tier so ×2 and
//                            ×16 hands look measurably different.
// Released on phase:release so the boom hits with normal cosmos drift
// and full saturation restored.

import { useEffect } from 'react';
import { bus } from '../../../events/bus';

const ZOOM_MIN_PEAK_MULT = 8;

function setStageClass(cls: string, on: boolean): void {
  if (typeof document === 'undefined') return;
  const stage = document.getElementById('stage-root');
  if (!stage) return;
  if (on) stage.classList.add(cls);
  else stage.classList.remove(cls);
}

function setVfxTier(tier: 1 | 2 | 3 | 4 | null): void {
  if (typeof document === 'undefined') return;
  const layer = document.getElementById('vfx-scoring-layer');
  if (!layer) return;
  if (tier == null) {
    layer.removeAttribute('data-theater-tier');
  } else {
    layer.setAttribute('data-theater-tier', String(tier));
  }
}

function tierFromMult(peakMult: number): 1 | 2 | 3 | 4 {
  if (peakMult >= 16) return 4;
  if (peakMult >= 8) return 3;
  if (peakMult >= 4) return 2;
  return 1;
}

export function TheaterStage(): null {
  useEffect(() => {
    const off = bus.on('onTheaterPhase', ({ phase, peakMult }) => {
      if (phase === 'ramping') {
        setStageClass('theater-zoom', false);
        setStageClass('theater-freeze', false);
        setVfxTier(null);
      } else if (phase === 'sustained') {
        const m = peakMult ?? 1;
        const tier = tierFromMult(m);
        setVfxTier(tier);
        if (m >= ZOOM_MIN_PEAK_MULT) {
          setStageClass('theater-zoom', true);
        }
      } else if (phase === 'held-breath') {
        setStageClass('theater-freeze', true);
      } else if (phase === 'release') {
        setStageClass('theater-zoom', false);
        setStageClass('theater-freeze', false);
        // Keep tier briefly so the boom inherits the intensity, then
        // clear after the post-fill savor window.
        window.setTimeout(() => setVfxTier(null), 1200);
      }
    });
    return () => {
      off();
      // Safety net — make sure we never leave stale classes if the
      // component unmounts mid-sequence.
      setStageClass('theater-zoom', false);
      setStageClass('theater-freeze', false);
      setVfxTier(null);
    };
  }, []);
  return null;
}
