import { useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { CONSTELLATIONS, type Constellation } from '../../data/constellations';
import { lookupConstellationUnlock } from '../../data/constellationUnlocks';
import { describeDiceSpec } from '../../data/dice';
import { STAKES, stakeIndex } from '../../data/stakes';
import { useStore, type GameState } from '../../state/store';
import { useIsCompactStage, useIsTightStage } from '../hooks/useIsCompactStage';

const selectStakeProgress = (s: GameState) => s.meta.stakeProgress;
const selectUnlocks = (s: GameState) => s.meta.unlocks;

export function ConstellationSelect() {
  const compact = useIsCompactStage();
  const tight = useIsTightStage();
  const stakeProgress = useStore(selectStakeProgress);
  const unlocks = useStore(selectUnlocks);
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'auto',
      // Tight viewports lock vertical scroll — the layout below shrinks
      // to fit. Wider viewports keep auto-scroll for the (rare) case
      // where a tall card description still overflows.
      overflow: tight ? 'hidden auto' : 'auto',
      padding: tight ? '6px 8px' : compact ? '20px 12px' : '36px 24px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        {/* Decorative header subtitle drops on tight to free vertical space. */}
        {!tight && (
          <div className="f-mono uc" style={{
            fontSize: compact ? 12 : 11, color: '#7be3ff', letterSpacing: '0.5em', marginBottom: 8,
          }}>
            ◇ choose your constellation ◇
          </div>
        )}
        <div className="f-display" style={{
          fontSize: tight ? 18 : compact ? 32 : 44,
          color: '#f3f0ff',
          marginBottom: tight ? 2 : 4,
          textShadow: '0 0 30px rgba(123,227,255,0.4)',
        }}>
          Pick your dice
        </div>
        {/* Subtitle drops on tight. */}
        {!tight && (
          <div className="f-mono" style={{ fontSize: compact ? 13 : 12, color: '#bba8ff', marginBottom: compact ? 16 : 28, opacity: 0.8 }}>
            Each constellation rolls a different set of dice for the entire run.
          </div>
        )}

        <div
          data-coach="constellation-grid"
          style={{
            display: 'grid',
            // Use min(target, 100%) so a single card on a 320px viewport
            // collapses to viewport width instead of overflowing.
            gridTemplateColumns: `repeat(auto-fit, minmax(min(${tight ? 180 : compact ? 220 : 260}px, 100%), 1fr))`,
            gap: tight ? 6 : compact ? 10 : 14,
            marginBottom: tight ? 8 : compact ? 16 : 28,
          }}>
          {CONSTELLATIONS.map((c) => (
            <Card
              key={c.id}
              c={c}
              compact={compact}
              tight={tight}
              progressId={stakeProgress[c.id] ?? null}
              unlocked={unlocks.includes(c.id)}
            />
          ))}
        </div>

        <button
          className="btn btn-ghost mat-interactive"
          style={{ width: tight ? 140 : 200 }}
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}>
          ← Back
        </button>
      </div>
    </div>
  );
}

function Card({ c, compact, tight, progressId, unlocked }: { c: Constellation; compact: boolean; tight: boolean; progressId: string | null; unlocked: boolean }) {
  const accent = '#7be3ff';
  // Highest stake the player has cleared for this constellation. Stakes up to
  // and including (cleared + 1) are playable. Spark is always playable.
  const clearedIdx = progressId ? stakeIndex(progressId) : -1;
  const maxPlayable = Math.min(STAKES.length - 1, clearedIdx + 1);
  const [picked, setPicked] = useState<number>(0);
  const stakePlayable = picked <= maxPlayable;
  const playable = unlocked && stakePlayable;
  const stake = STAKES[picked]!;
  const unlockHint = unlocked ? null : lookupConstellationUnlock(c.id)?.description ?? null;
  return (
    <div
      className="panel mat-interactive"
      style={{
        textAlign: 'left',
        padding: tight ? 8 : compact ? 12 : 16,
        background: 'rgba(15,9,37,0.6)',
        border: `1px solid ${unlocked ? 'rgba(149,119,255,0.25)' : 'rgba(149,119,255,0.12)'}`,
        borderRadius: 12,
        display: 'flex', flexDirection: 'column', gap: tight ? 4 : compact ? 6 : 10,
        minHeight: tight ? 190 : compact ? 240 : 320,
        // Whole card desaturates when locked. Glyph + text stay legible enough
        // to telegraph "this is real content you'll unlock", not a placeholder.
        opacity: unlocked ? 1 : 0.55,
        filter: unlocked ? undefined : 'grayscale(0.6)',
      }}>
      <Glyph points={c.glyph} accent={accent} tight={tight} />
      <div className="f-display" style={{
        fontSize: tight ? 16 : compact ? 22 : 18,
        color: '#f3f0ff', lineHeight: 1.1,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {!unlocked && <span aria-hidden="true" style={{ fontSize: '0.85em', color: '#bba8ff' }}>🔒</span>}
        {c.name}
      </div>
      <div className="f-mono uc" style={{
        fontSize: tight ? 9 : compact ? 11 : 9, letterSpacing: '0.18em', color: '#f5c451',
      }}>
        {describeDiceSpec(c.dice)}
      </div>
      {/* Flavor stays on tight — it's the one-line pitch ("The classic
          five-string sky.") that helps the player choose. The bullet
          rules list still drops on tight since it's longer mechanical
          detail that fights for vertical space. */}
      <div style={{
        fontSize: tight ? 11 : compact ? 13 : 11,
        color: '#bba8ff', fontStyle: 'italic', lineHeight: 1.3,
      }}>
        {c.flavor}
      </div>
      {!tight && (
        <ul style={{
          marginTop: 4, paddingLeft: 18, marginBottom: 0,
          fontSize: compact ? 12 : 10, color: '#dcd4ff', lineHeight: compact ? 1.3 : 1.4,
        }}>
          {c.rules.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}

      {/* Stake row */}
      <div style={{
        marginTop: 'auto', paddingTop: 8,
        borderTop: '1px dashed rgba(149,119,255,0.22)',
        // Lift the stake block 4px off the card's bottom edge so the
        // rules-row ("+1 hand, no rerolls, …") has breathing room on
        // tight 190px-tall landscape cards instead of sitting flush
        // against the border.
        marginBottom: tight ? 4 : 0,
      }}>
        <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.28em', color: '#bba8ff', marginBottom: 6 }}>
          stake
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {STAKES.map((s, i) => {
            const unlocked = i <= maxPlayable;
            const active = i === picked;
            return (
              <button
                key={s.id}
                onClick={() => unlocked && setPicked(i)}
                title={unlocked ? `${s.name} — ${s.flavor}` : `Clear ${STAKES[i - 1]?.name ?? 'previous stake'} first`}
                disabled={!unlocked}
                style={{
                  width: 18, height: 18, borderRadius: 4,
                  background: unlocked ? s.color : 'rgba(28,18,69,0.4)',
                  border: active ? '2px solid #f3f0ff' : `1px solid ${unlocked ? s.color : 'rgba(149,119,255,0.25)'}`,
                  cursor: unlocked ? 'pointer' : 'not-allowed',
                  opacity: unlocked ? 1 : 0.35,
                  padding: 0,
                  filter: active ? `drop-shadow(0 0 6px ${s.color})` : undefined,
                }}
              />
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="f-head" style={{ fontSize: 12, color: stake.color }}>{stake.name}</span>
          <span className="f-mono" style={{ fontSize: 9, color: '#9577ff' }}>
            {stake.rules.join(' · ')}
          </span>
        </div>
      </div>

      {unlocked ? (
        <button
          className="btn btn-primary mat-interactive"
          disabled={!playable}
          onClick={() => playable && dispatch({ type: 'NEW_RUN', constellationId: c.id, stakeId: stake.id })}
          style={{
            marginTop: 8, width: '100%', padding: '8px 14px', fontSize: 12,
            opacity: playable ? 1 : 0.4,
            cursor: playable ? 'pointer' : 'not-allowed',
          }}
        >
          Begin · {stake.name}
        </button>
      ) : (
        <div
          className="f-mono"
          title={unlockHint ?? undefined}
          style={{
            marginTop: 8, width: '100%', padding: '8px 14px',
            fontSize: 10, letterSpacing: '0.08em',
            color: '#bba8ff', textAlign: 'center',
            border: '1px dashed rgba(149,119,255,0.35)',
            borderRadius: 6,
            background: 'rgba(28,18,69,0.4)',
            lineHeight: 1.3,
          }}
        >
          <span style={{ display: 'block', color: '#7be3ff', fontSize: 9, letterSpacing: '0.22em', marginBottom: 2 }}>
            LOCKED
          </span>
          {unlockHint ?? 'Discover its unlock condition through play.'}
        </div>
      )}
    </div>
  );
}

function Glyph({ points, accent, tight }: { points: { x: number; y: number }[]; accent: string; tight?: boolean }) {
  const field = fieldStars(points);
  return (
    <svg viewBox="0 0 100 100" width="100%" height={tight ? 36 : 60} style={{ display: 'block' }}>
      {/* Dim field stars: deterministic seeded specks that give the picker
          a sense of depth so the connected constellation reads as figure
          against a sky, not a graph of nodes. */}
      {field.map((f, i) => (
        <circle key={`f${i}`} cx={f.x} cy={f.y} r={f.r}
          fill="#f3f0ff" opacity={f.o} />
      ))}
      {/* Solid main connector at half stroke (the actual line) + dashed
          overlay (memory of how the line was traced). Two-tone reads as
          sigil rather than diagram. */}
      {points.map((p, i, arr) => {
        if (i >= arr.length - 1) return null;
        const n = arr[i + 1]!;
        return (
          <g key={`l${i}`}>
            <line x1={p.x} y1={p.y} x2={n.x} y2={n.y}
              stroke={accent} strokeWidth="0.5" opacity="0.55"
              strokeLinecap="round" />
            <line x1={p.x} y1={p.y} x2={n.x} y2={n.y}
              stroke={accent} strokeWidth="0.8" strokeDasharray="0.4 3"
              opacity="0.85" strokeLinecap="round" />
          </g>
        );
      })}
      {points.map((p, i) => {
        const isPrimary = i === 0;
        const r = isPrimary ? 2.6 : 1.8;
        return (
          <g key={`s${i}`}>
            <circle cx={p.x} cy={p.y} r={r * 2.4} fill={accent} opacity="0.18" />
            <circle cx={p.x} cy={p.y} r={r * 1.5} fill={accent} opacity="0.35" />
            <circle cx={p.x} cy={p.y} r={r} fill="#fff7e0"
              style={{ filter: `drop-shadow(0 0 3px ${accent})` }} />
            {isPrimary && (
              <g stroke="#fff7e0" strokeWidth="0.4" strokeLinecap="round" opacity="0.9">
                <line x1={p.x - 5} y1={p.y} x2={p.x + 5} y2={p.y} />
                <line x1={p.x} y1={p.y - 5} x2={p.x} y2={p.y + 5} />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Deterministic dim background stars for the picker glyph. Seeded from
// the input points so each constellation gets a stable field pattern
// (no flicker on re-render, no two constellations sharing layout).
function fieldStars(points: { x: number; y: number }[]) {
  let seed = 0;
  for (const p of points) seed = (seed * 31 + (p.x | 0) * 17 + (p.y | 0)) | 0;
  const r = mulberry32(seed >>> 0);
  const stars: { x: number; y: number; r: number; o: number }[] = [];
  for (let i = 0; i < 6; i++) {
    stars.push({
      x: 4 + r() * 92,
      y: 4 + r() * 92,
      r: 0.4 + r() * 0.6,
      o: 0.18 + r() * 0.18,
    });
  }
  return stars;
}

function mulberry32(a: number) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
