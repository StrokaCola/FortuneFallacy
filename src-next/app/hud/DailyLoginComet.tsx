// First-of-day comet streak across the screen + 5 cosmic dust grant.
// Mounts wherever called and self-dismisses after the comet finishes.
// Today's UTC date is compared to meta.dailyLogin.lastDate; on a fresh
// day the comet plays once and CLAIM_DAILY_LOGIN dispatches. The dust
// grant rides the standard onDustEarned channel so the toast + chime
// fire automatically.

import { useEffect, useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { getDailyDate } from '../../online/dailyChallenge';
import { Z } from './zLayers';

const selectLastLogin = (s: GameState) => s.meta.dailyLogin?.lastDate ?? null;

export function DailyLoginComet() {
  const lastDate = useStore(selectLastLogin);
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    const today = getDailyDate();
    if (lastDate === today) return;
    // Tiny startup grace so the comet doesn't fire mid-mount race.
    const t = window.setTimeout(() => {
      setShowing(true);
      dispatch({ type: 'CLAIM_DAILY_LOGIN', date: today });
      window.setTimeout(() => setShowing(false), 3200);
    }, 600);
    return () => window.clearTimeout(t);
  }, [lastDate]);

  if (!showing) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        zIndex: Z.fx,
        overflow: 'hidden',
      }}
    >
      <div className="daily-comet" />
      <div className="daily-comet-label f-mono uc">
        ★ cosmos rewards the constant · +5 dust ★
      </div>
    </div>
  );
}
