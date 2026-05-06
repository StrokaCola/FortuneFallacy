import { dispatch } from '../../actions/dispatch';
import { Z } from './zLayers';

export function PauseButton() {
  return (
    <button
      onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
      className="f-mono tap"
      style={{
        position: 'absolute',
        top: 110,
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
