import { useMemo, useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { CONSTELLATIONS, type Constellation } from '../../data/constellations';
import { lookupConstellationUnlock } from '../../data/constellationUnlocks';
import { describeDiceSpec } from '../../data/dice';
import { STAKES, stakeIndex } from '../../data/stakes';
import { useStore, store, type GameState } from '../../state/store';
import { useIsCompactStage, useIsTightStage } from '../hooks/useIsCompactStage';
import { decodeSeed } from '../../core/seed/rng';

const selectStakeProgress = (s: GameState) => s.meta.stakeProgress;
const selectUnlocks = (s: GameState) => s.meta.unlocks;

export function ConstellationSelect() {
  const compact = useIsCompactStage();
  const tight = useIsTightStage();
  // 2026-05-18 desktop-no-scroll: short desktop windows (≤800px tall)
  // compress like `compact` so the 8 constellation cards fit a
  // 1280×800 design without scrolling.
  const short = !tight && typeof window !== 'undefined' && window.innerHeight <= 800;
  const stakeProgress = useStore(selectStakeProgress);
  const unlocks = useStore(selectUnlocks);
  // Optional seed entry. Empty → fresh random seed (default UX). A valid
  // XXXX-XXX code decodes to a 32-bit int that NEW_RUN consumes via the
  // Card → dispatch path, so every random decision in the run flows
  // from the entered value. Invalid input disables the Begin buttons
  // until cleared or fixed; the player sees inline feedback below.
  const [seedInput, setSeedInput] = useState('');
  const trimmed = seedInput.trim();
  const decodedSeed = useMemo(
    () => (trimmed === '' ? null : decodeSeed(trimmed)),
    [trimmed],
  );
  const seedInvalid = trimmed !== '' && decodedSeed === null;
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'auto',
      // 2026-05-18 desktop-no-scroll: tight (phone) keeps the
      // hidden-x / auto-y safety net so the picker grid wraps and
      // scrolls. Desktop locks both axes — 8 constellations fit
      // comfortably above the fold at 1280×800 via the `short`
      // compression path below.
      overflow: tight ? 'hidden auto' : 'hidden',
      padding: tight ? '6px 8px' : compact ? '20px 12px' : short ? '18px 24px' : '36px 24px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        {/* Decorative header subtitle drops on tight + short to free
            vertical space for the constellation grid. */}
        {!tight && !short && (
          <div className="f-mono uc" style={{
            fontSize: compact ? 12 : 11, color: '#7be3ff', letterSpacing: '0.5em', marginBottom: 8,
          }}>
            ◇ choose your constellation ◇
          </div>
        )}
        <div className="f-display" style={{
          fontSize: tight ? 18 : short ? 24 : compact ? 32 : 44,
          color: '#f3f0ff',
          marginBottom: tight ? 2 : short ? 2 : 4,
          textShadow: '0 0 30px rgba(123,227,255,0.4)',
        }}>
          Pick your dice
        </div>
        {/* Subtitle drops on tight + short. */}
        {!tight && !short && (
          <div className="f-mono" style={{ fontSize: compact ? 13 : 12, color: '#bba8ff', marginBottom: compact ? 8 : 14, opacity: 0.8 }}>
            Each constellation rolls a different set of dice for the entire run.
          </div>
        )}
        {/* Unlock progress chip — surfaces "5 / 8 constellations
            unlocked" as a single line so returning players see their
            progress at a glance. Hidden when the player has unlocked
            everything (no work left to do = no point showing). */}
        {unlocks.length < CONSTELLATIONS.length && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '4px 12px', borderRadius: 999,
            border: '1px solid rgba(123,227,255,0.35)',
            background: 'rgba(15,9,37,0.6)',
            marginBottom: tight ? 8 : compact ? 16 : 24,
          }}>
            <span className="f-mono uc" style={{
              fontSize: 9, letterSpacing: '0.28em', color: '#7be3ff',
            }}>
              {unlocks.length} / {CONSTELLATIONS.length} unlocked
            </span>
            <div style={{
              width: 64, height: 4, borderRadius: 2,
              background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
            }}>
              <div style={{
                width: `${(unlocks.length / CONSTELLATIONS.length) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #7be3ff, #cc88ff)',
                boxShadow: '0 0 8px rgba(123,227,255,0.55)',
                transition: 'width 400ms ease-out',
              }} />
            </div>
          </div>
        )}

        {/* Optional seed entry — empty means a fresh random run (the
            seed stays hidden in-game until postmortem). A valid
            XXXX-XXX code makes this a seeded run: every random call
            inside the run flows from it, the chip stays visible in
            the Hub, and the player can share it. */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: tight ? 8 : compact ? 8 : 18,
          flexWrap: 'wrap',
        }}>
          <label className="f-mono uc" style={{
            fontSize: 9, letterSpacing: '0.28em', color: '#bba8ff', opacity: 0.85,
          }} htmlFor="seed-input">
            seed (optional)
          </label>
          <input
            id="seed-input"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="XXXX-XXX"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            className="f-mono ff-input"
            style={{
              width: 132,
              fontSize: 12, letterSpacing: '0.12em',
              textTransform: 'uppercase', textAlign: 'center',
              borderColor: seedInvalid ? 'rgba(255,77,109,0.6)' : undefined,
              borderBottomColor: seedInvalid ? 'rgba(255,77,109,0.85)' : undefined,
            }}
          />
          {seedInvalid && (
            <span className="f-mono" style={{ fontSize: 10, color: '#ff4d6d' }}>
              not a valid seed
            </span>
          )}
        </div>

        <div
          data-coach="constellation-grid"
          style={{
            display: 'grid',
            // Use min(target, 100%) so a single card on a 320px viewport
            // collapses to viewport width instead of overflowing.
            gridTemplateColumns: `repeat(auto-fit, minmax(min(${tight ? 180 : compact ? 220 : short ? 220 : 260}px, 100%), 1fr))`,
            gap: tight ? 6 : compact ? 10 : short ? 10 : 14,
            marginBottom: tight ? 8 : compact ? 16 : short ? 12 : 28,
          }}>
          {CONSTELLATIONS.map((c) => (
            <Card
              key={c.id}
              c={c}
              compact={compact || short}
              tight={tight}
              progressId={stakeProgress[c.id] ?? null}
              unlocked={unlocks.includes(c.id)}
              enteredSeed={decodedSeed}
              seedBlocked={seedInvalid}
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

function Card({ c, compact, tight, progressId, unlocked, enteredSeed, seedBlocked }: { c: Constellation; compact: boolean; tight: boolean; progressId: string | null; unlocked: boolean; enteredSeed: number | null; seedBlocked: boolean }) {
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
        padding: tight ? 8 : compact ? 8 : 16,
        background: 'rgba(15,9,37,0.6)',
        border: `1px solid ${unlocked ? 'rgba(149,119,255,0.25)' : 'rgba(149,119,255,0.12)'}`,
        borderRadius: 12,
        display: 'flex', flexDirection: 'column', gap: tight ? 4 : compact ? 4 : 10,
        // 2026-05-18 desktop-no-scroll: drop compact minHeight from
        // 240→200 so the 2-row grid of 8 cards fits a 1280×800 viewport.
        minHeight: tight ? 190 : compact ? 200 : 320,
        // Whole card desaturates when locked. Glyph + text stay legible enough
        // to telegraph "this is real content you'll unlock", not a placeholder.
        opacity: unlocked ? 1 : 0.55,
        filter: unlocked ? undefined : 'grayscale(0.6)',
      }}>
      <Glyph points={c.glyph} accent={accent} tight={tight || compact} />
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
          rules list still drops on tight/compact since it's longer
          mechanical detail that fights for vertical space.
          2026-05-18 desktop-no-scroll: flavor also drops on compact
          (which now includes short desktop windows ≤800px tall) so
          the 2-row grid of 8 cards fits without scrolling. */}
      {!compact && (
        <div style={{
          fontSize: tight ? 11 : 11,
          color: '#bba8ff', fontStyle: 'italic', lineHeight: 1.3,
        }}>
          {c.flavor}
        </div>
      )}
      {!tight && !compact && (
        <ul style={{
          marginTop: 4, paddingLeft: 18, marginBottom: 0,
          fontSize: 10, color: '#dcd4ff', lineHeight: 1.4,
        }}>
          {c.rules.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}

      {/* Stake row — order: label → active details (name + rules) →
          picker buttons. Putting the details ABOVE the buttons makes
          the card read "this is what you've picked → tap a square to
          change it" instead of the prior side-by-side controls/output
          ambiguity. Rules stack vertically on tight so the cramped
          name·rules flexbox doesn't wrap awkwardly. */}
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
        <div style={{
          display: 'flex',
          flexDirection: tight ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: tight ? 'flex-start' : 'baseline',
          marginBottom: 8, gap: 2,
        }}>
          <span className="f-head" style={{ fontSize: 12, color: stake.color }}>{stake.name}</span>
          {/* Stake rules text hidden on compact (short desktop ≤800px)
              so the picker squares + Begin button fit without spilling
              under the fold. The active stake's name still shows. */}
          {!compact && (
            <span className="f-mono" style={{ fontSize: 9, color: '#9577ff' }}>
              {stake.rules.join(' · ')}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
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
      </div>

      {unlocked ? (
        <button
          className="btn btn-primary mat-interactive"
          disabled={!playable || seedBlocked}
          onClick={() => {
            if (!playable || seedBlocked) return;
            // Pass the entered seed only when one was supplied; otherwise
            // NEW_RUN generates a fresh random seed (and marks the run
            // as `seedSource: 'random'` so the chip stays hidden in-game).
            dispatch({
              type: 'NEW_RUN',
              constellationId: c.id,
              stakeId: stake.id,
              ...(enteredSeed != null ? { seed: enteredSeed } : {}),
            });
            // Surface the one-time guided-tour opt-in modal AFTER NEW_RUN
            // so the run is already set up when the player picks Yes/No.
            // The modal handles the screen transition (into Round for
            // tutorial, or stays on Hub for skip) so we don't race it
            // with the NEW_RUN handler's `ui.screen='hub'` write.
            // Defensive optional-chain in case a legacy save's meta
            // shape didn't carry the field through persistence.
            const onb = (store?.getState ? store.getState().meta.onboarding : undefined) ?? null;
            if (onb?.firstLaunch) {
              dispatch({ type: 'OPEN_OPT_IN' });
            }
          }}
          style={{
            marginTop: 8, width: '100%', padding: '8px 14px', fontSize: 12,
            opacity: (playable && !seedBlocked) ? 1 : 0.4,
            cursor: (playable && !seedBlocked) ? 'pointer' : 'not-allowed',
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
