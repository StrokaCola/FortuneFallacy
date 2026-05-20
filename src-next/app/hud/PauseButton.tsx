import { dispatch } from '../../actions/dispatch';
import { Z } from './zLayers';
import { useIsTightStage } from '../hooks/useIsCompactStage';
import { sfxPlay } from '../../audio/sfx';
import { playHaptic } from '../haptics/haptics';

// Bespoke pause icon — twin orbital arcs replace the Unicode ⏸
// glyph. Reads as "two suspended cosmic objects" instead of a
// flat pair of rectangles. SVG so it can pick up hover glow via
// CSS without an additional layer.
function PauseIcon() {
  return (
    <svg
      className="ff-pause-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      style={{ overflow: 'visible' }}
    >
      <path
        d="M 8 5 Q 7 12 8 19"
        stroke="#bba8ff"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 16 5 Q 17 12 16 19"
        stroke="#bba8ff"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function PauseButton() {
  const tight = useIsTightStage();
  // 2026-05-17 — desktop hides the floating pause button entirely; the
  // Escape key handler in App.tsx already routes to TOGGLE_PAUSE so the
  // affordance is preserved without the persistent on-screen widget
  // (which was overlapping the ConsumableTray right rail). Touch /
  // tight viewports keep the button since there's no keyboard there.
  if (!tight) return null;
  return (
    <button
      // Wave KK — pause button picks up its own press feedback. It
      // intentionally doesn't carry a .btn-* tier (the Wave K juice
      // would override its bespoke icon-square style) so play the
      // ghost-tier cues manually: uiClick + tap haptic on press.
      onClick={() => {
        sfxPlay('uiClick');
        playHaptic('tap');
        dispatch({ type: 'TOGGLE_PAUSE' });
      }}
      className="f-mono tap ff-pause-btn"
      style={{
        position: 'absolute',
        // Wave V — tight viewports moved the pause button to the
        // bottom-right corner of the stage instead of floating
        // alongside the wrapped TopBar. On mobile portrait the prior
        // top-anchored placement overlapped the Shop "Night Market"
        // title and the Hub trial card row at narrow widths. Pinning
        // bottom-right keeps it reachable for the thumb without
        // colliding with any screen's title row.
        top: tight ? undefined : 'max(80px, calc(var(--hud-top-h, 110px) - 24px))',
        // Wave SS — push pause CLEAR of any bottom action bar on tight
        // viewports. Earlier offset (hud-bottom-h + 12px) wasn't enough
        // when --hud-bottom-h reported 0 (some screens like Forge don't
        // self-measure their action row into the var). Use a hard 64px
        // floor so the 44px icon always sits ≥20px above the action bar
        // baseline regardless of which screen renders.
        bottom: tight ? 'max(64px, calc(var(--hud-bottom-h, 60px) + 12px))' : undefined,
        right: 18,
        zIndex: Z.hudControl,
        width: 44,
        height: 44,
        borderRadius: 10,
        background: 'rgba(15,9,37,0.6)',
        border: '1px solid rgba(149,119,255,0.4)',
        color: '#bba8ff',
        cursor: 'pointer',
        pointerEvents: 'auto',
        display: 'grid',
        placeItems: 'center',
        // Subtle backdrop blur on tight so the bottom-right placement
        // still reads clearly over dice/canvas content underneath.
        backdropFilter: tight ? 'blur(8px)' : undefined,
      }}
      title="Pause (Esc)"
      aria-label="Pause"
    >
      <PauseIcon />
    </button>
  );
}
