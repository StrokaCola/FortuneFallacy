import { useEffect, useRef } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore } from '../../state/store';
import { StatsCorner } from '../hud/StatsCorner';
import { DangerCorner } from '../hud/DangerCorner';
import { ScoreFloat } from '../hud/ScoreFloat';
import { LoadoutDock } from '../hud/LoadoutDock';
import { ComboBanner } from '../hud/ComboBanner';
import { ConstellationOverlay } from '../hud/ConstellationOverlay';
import {
  selectHandsLeft, selectRerollsLeft, selectIsBoss,
} from '../../state/selectors';

export function Round() {
  const hands   = useStore(selectHandsLeft);
  const rerolls = useStore(selectRerollsLeft);
  const isBoss  = useStore(selectIsBoss);
  const scoring = useStore((s) => s.round.scoring);
  const accent = isBoss ? '#e2334a' : '#7be3ff';

  // Auto-roll when handsLeft changes (existing behavior)
  const lastHandsRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastHandsRef.current !== hands && hands > 0) {
      lastHandsRef.current = hands;
      dispatch({ type: 'ROLL_REQUESTED' });
    }
  }, [hands]);

  // Clear scoring flag ~1.6s after a SCORE_HAND fires (Plan C will own the full sequence).
  useEffect(() => {
    if (!scoring) return;
    const t = window.setTimeout(() => dispatch({ type: 'END_SCORING' }), 1600);
    return () => window.clearTimeout(t);
  }, [scoring]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <StatsCorner />
      <DangerCorner />
      <ScoreFloat />
      <LoadoutDock />
      <ComboBanner accent={accent} />
      <ConstellationOverlay />
      <DiceLockOverlay />
      <ActionBar hands={hands} rerolls={rerolls} accent={accent} />
    </div>
  );
}

function ActionBar({ hands, rerolls, accent }: { hands: number; rerolls: number; accent: string }) {
  return (
    <div
      style={{
        position: 'absolute', right: 18, bottom: 18,
        display: 'flex', gap: 12, zIndex: 5, pointerEvents: 'auto',
      }}>
      <button
        className="btn btn-ghost mat-interactive"
        disabled={rerolls === 0 || hands === 0}
        onClick={() => dispatch({ type: 'REROLL_REQUESTED' })}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: accent }}>↻</span> Reroll
          <span className="f-mono" style={{ fontSize: 11, opacity: 0.7 }}>({rerolls})</span>
        </span>
      </button>
      <button
        className="btn btn-primary mat-interactive"
        disabled={hands === 0}
        onClick={() => dispatch({ type: 'SCORE_HAND' })}>
        ✦ Cast Hand
      </button>
    </div>
  );
}

function DiceLockOverlay() {
  const dice = useStore((s) => s.round.dice);
  const trayY = window.innerHeight / 2 + 80;
  const startX = window.innerWidth / 2 - (dice.length - 1) * 70;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4 }}>
      {dice.map((d, i) => (
        <button
          key={i}
          onClick={() => dispatch({ type: 'TOGGLE_LOCK', dieIdx: i })}
          className="f-mono uc"
          style={{
            position: 'absolute',
            left: startX + i * 140 - 32,
            top: trayY,
            width: 64, padding: '4px 0', textAlign: 'center',
            fontSize: 9, letterSpacing: '0.2em', borderRadius: 6,
            background: d.locked ? 'rgba(123,227,255,0.18)' : 'rgba(28,18,69,0.6)',
            border: `1px solid ${d.locked ? '#7be3ff' : 'rgba(149,119,255,0.3)'}`,
            color: d.locked ? '#7be3ff' : '#bba8ff',
            cursor: 'pointer', pointerEvents: 'auto',
          }}>
          {d.locked ? '◆ locked' : 'lock'}
        </button>
      ))}
    </div>
  );
}
