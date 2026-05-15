import { dispatch } from '../../actions/dispatch';
import { Z } from './zLayers';
import { useIsTightStage } from '../hooks/useIsCompactStage';

export function PauseButton() {
  const tight = useIsTightStage();
  return (
    <button
      onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
      className="f-mono tap"
      style={{
        position: 'absolute',
        // Desktop tucks the button under TopBar by 24px for a "ducked" look.
        // On tight portrait that overlap fights the TREASURY chip's catalyst
        // label — push the button cleanly BELOW TopBar instead.
        // `max(80px, …)` guards against screens that don't mount a
        // TopBar (Forge) where --hud-top-h stays 0; the calc would
        // otherwise resolve to a negative top.
        top: tight
          ? 'max(80px, calc(var(--hud-top-h, 110px) + 8px))'
          : 'max(80px, calc(var(--hud-top-h, 110px) - 24px))',
        // Tight portrait: shift LEFT of the right-rail consumable card so
        // they don't stack on top of each other. ConsumableTray sits at
        // `right: 18, width: 64` (left edge ≈ 82px from viewport right);
        // the 96 here parks the 44px-wide pause button just left of
        // that with a 14px gap. Desktop tucks under TopBar at `right: 18`
        // — there's no overlap there because the desktop button is
        // raised by `-24px`, ABOVE the consumable tray's top edge.
        right: tight ? 96 : 18,
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
