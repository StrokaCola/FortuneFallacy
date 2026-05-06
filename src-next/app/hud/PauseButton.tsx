import { dispatch } from '../../actions/dispatch';
import { Z } from './zLayers';

export function PauseButton() {
  return (
    <button
      onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
      className="f-mono tap"
      style={{
        position: 'absolute',
        // Sit just below TopBar's bottom edge so the pause control follows
        // it when TopBar wraps onto more rows on narrow viewports.
        // `max(80px, …)` guards against screens that don't mount a
        // TopBar (Forge) where --hud-top-h stays 0; the calc would
        // otherwise resolve to a negative top.
        top: 'max(80px, calc(var(--hud-top-h, 110px) - 24px))',
        right: 18,
        zIndex: Z.hudControl,
        width: 44,
        height: 44,
        borderRadius: 10,
        background: 'rgba(15,9,37,0.6)',
        border: '1px solid rgba(149,119,255,0.4)',
        color: '#bba8ff',
        fontSize: 18,
        cursor: 'pointer',
        pointerEvents: 'auto',
        display: 'grid',
        placeItems: 'center',
      }}
      title="Pause (Esc)"
      aria-label="Pause"
    >
      ⏸
    </button>
  );
}
