import { dispatch } from '../../actions/dispatch';
import { Z } from './zLayers';
import { useIsTightStage } from '../hooks/useIsCompactStage';

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
  return (
    <button
      onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
      className="f-mono tap"
      style={{
        position: 'absolute',
        // Wave V — tight viewports moved the pause button to the
        // bottom-right corner of the stage instead of floating
        // alongside the wrapped TopBar. On mobile portrait the prior
        // top-anchored placement overlapped the Shop "Celestial Bazaar"
        // title and the Hub trial card row at narrow widths. Pinning
        // bottom-right keeps it reachable for the thumb without
        // colliding with any screen's title row.
        top: tight ? undefined : 'max(80px, calc(var(--hud-top-h, 110px) - 24px))',
        bottom: tight ? 'calc(var(--hud-bottom-h, 60px) + 12px)' : undefined,
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
