import { dispatch } from '../../actions/dispatch';

export function PauseButton() {
  return (
    <button
      onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
      className="f-mono"
      style={{
        position: 'absolute',
        top: 110,
        right: 18,
        zIndex: 6,
        width: 36,
        height: 36,
        borderRadius: 8,
        background: 'rgba(15,9,37,0.6)',
        border: '1px solid rgba(149,119,255,0.4)',
        color: '#bba8ff',
        fontSize: 16,
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
