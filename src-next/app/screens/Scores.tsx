import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { dispatch } from '../../actions/dispatch';
import { ScreenHeader, AstralSpinner, ScreenWatermark } from '../visual/AstralPrimitives';
import { Sigil } from '../visual/Sigil';
import { selectUnlocks } from '../../state/selectors';
import { CONSTELLATIONS, DEFAULT_CONSTELLATION_ID } from '../../data/constellations';
import { fetchOnlineScores, type OnlineScore } from '../../online/leaderboard';
import { getDailyDate } from '../../online/dailyChallenge';
import type { GameState } from '../../state/store';

const selectActiveConstellation = (s: GameState) => s.run.constellationId;

type LeaderboardScope = 'all_time' | 'daily_today';

function shortName(fullName: string): string {
  // CONSTELLATIONS[*].name is "Lyra, the Lyre" — the picker only needs the lead noun.
  return fullName.split(',')[0]!.trim();
}

export function Scores() {
  const unlocks = useStore(selectUnlocks);
  const activeId = useStore(selectActiveConstellation);

  const initialId = unlocks.includes(activeId) ? activeId : DEFAULT_CONSTELLATION_ID;
  const [selectedId, setSelectedId] = useState<string>(initialId);
  const [scope, setScope] = useState<LeaderboardScope>('all_time');
  const [allScores, setAllScores] = useState<OnlineScore[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const todayKey = `daily-${getDailyDate()}`;

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    fetchOnlineScores().then(
      (scores) => { if (!cancelled) setAllScores(scores); },
      (err: unknown) => {
        if (cancelled) return;
        setAllScores([]);
        setLoadError(err instanceof Error ? err.message : 'Could not reach the leaderboard.');
      },
    );
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    if (!allScores) return null;
    // Daily scope ignores the constellation picker — today's daily is
    // ONE shared run across every player, so partitioning further by
    // constellation would always show empty for non-matching ones.
    return allScores
      .filter((s) => {
        if (scope === 'daily_today') return s.mode === todayKey;
        // All-time: hide daily entries (they belong on the daily tab)
        // and filter by constellation.
        if (typeof s.mode === 'string' && s.mode.startsWith('daily-')) return false;
        return s.constellation === selectedId;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [allScores, selectedId, scope, todayKey]);

  // Daily scope is always "unlocked" — every player sees the same
  // global daily ladder regardless of constellation progression.
  const selectedUnlocked = scope === 'daily_today' || unlocks.includes(selectedId);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto px-4">
      <ScreenWatermark color="#f5c451" position="bottom-right">
        <Sigil kind="star" size={220} color="#f5c451" />
      </ScreenWatermark>
      <ScreenHeader title="High Scores" subtitle="◇ records ◇" />

      {/* Scope tabs — All-time / Today's daily. Daily is the shared
          single-seed run across every player; all-time is per-
          constellation. */}
      <div className="flex gap-2 mb-3" role="radiogroup" aria-label="Leaderboard scope">
        {([
          { id: 'all_time',    label: 'All time' },
          { id: 'daily_today', label: `Daily · ${getDailyDate()}` },
        ] as { id: LeaderboardScope; label: string }[]).map((s) => {
          const active = scope === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setScope(s.id)}
              className="f-mono uc tap"
              style={{
                minHeight: 36,
                padding: '6px 14px',
                fontSize: 10,
                letterSpacing: '0.24em',
                borderRadius: 6,
                border: active
                  ? '1px solid rgba(245,196,81,0.85)'
                  : '1px solid rgba(149,119,255,0.35)',
                background: active
                  ? 'rgba(245,196,81,0.18)'
                  : 'rgba(8,4,28,0.55)',
                color: active ? '#f5c451' : '#dcd4ff',
                cursor: 'pointer',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div
        className="w-full max-w-md mb-4 overflow-x-auto"
        style={{
          WebkitOverflowScrolling: 'touch',
          // The constellation picker is meaningless on the daily scope —
          // hide it but keep layout space stable so the list doesn't
          // jump up when the player toggles.
          visibility: scope === 'daily_today' ? 'hidden' : 'visible',
          pointerEvents: scope === 'daily_today' ? 'none' : undefined,
        }}
      >
        <div className="flex gap-2 px-1 pb-2">
          {CONSTELLATIONS.map((c) => {
            const isUnlocked = unlocks.includes(c.id);
            const isSelected = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={isSelected}
                disabled={!isUnlocked}
                onClick={() => setSelectedId(c.id)}
                className="f-mono uc tap"
                style={{
                  flexShrink: 0,
                  minHeight: 44,
                  minWidth: 88,
                  padding: '0 14px',
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  borderRadius: 999,
                  border: isSelected
                    ? '1px solid rgba(123,227,255,0.85)'
                    : '1px solid rgba(149,119,255,0.35)',
                  background: isSelected
                    ? 'rgba(123,227,255,0.18)'
                    : 'rgba(8,4,28,0.55)',
                  color: isUnlocked ? '#f3f0ff' : '#5a4f8a',
                  opacity: isUnlocked ? 1 : 0.55,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {isUnlocked ? shortName(c.name) : '⌧ ???'}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="w-full max-w-md min-h-[18rem] max-h-72 overflow-y-auto bg-cosmos-800/60 ring-1 ring-cosmos-300/30 rounded-xl p-4 mb-6"
        aria-live="polite"
        aria-busy={selectedUnlocked && visible === null}
      >
        {!selectedUnlocked && (
          <div className="text-cosmos-300 text-sm text-center py-8">
            Locked — complete a run on this constellation to unlock.
          </div>
        )}
        {selectedUnlocked && visible === null && (
          <div className="text-cosmos-300 text-sm text-center py-8" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <AstralSpinner size={42} />
            <span className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.32em', color: '#bba8ff', opacity: 0.8 }}>· consulting the firmament ·</span>
          </div>
        )}
        {selectedUnlocked && visible !== null && visible.length === 0 && !loadError && (
          <div className="text-cosmos-300 text-sm text-center py-8">— no runs yet —</div>
        )}
        {selectedUnlocked && loadError && (
          <div className="text-sm text-center py-8" style={{ color: '#ff8e9c' }}>
            Could not load leaderboard.<br />
            <span className="f-mono" style={{ fontSize: 10, opacity: 0.7 }}>{loadError}</span>
          </div>
        )}
        {selectedUnlocked && visible !== null && visible.length > 0 && visible.map((s, i) => (
          <div
            key={`${s.date}-${i}`}
            className="flex justify-between items-baseline py-1 border-b border-cosmos-300/10 last:border-0"
          >
            <span className="font-mono text-xs text-cosmos-300 w-6">{i + 1}.</span>
            <span className="text-cosmos-100 flex-1 truncate">{s.name || 'anon'}</span>
            <span className="font-mono text-gold">{s.score.toLocaleString()}</span>
          </div>
        ))}
        {/* Empty-state: leaderboard loaded successfully but has zero rows
            for this scope (no runs ever logged, or first-time visit on
            a constellation the player hasn't shipped a run with). The
            "No runs yet" copy + Start-a-Run CTA gives the screen
            something to point at instead of dead space. */}
        {selectedUnlocked && visible !== null && visible.length === 0 && !loadError && (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              fontSize: 36, opacity: 0.45,
              filter: 'drop-shadow(0 0 12px #7be3ff66)',
            }}>★</div>
            <div className="f-mono uc" style={{
              fontSize: 11, letterSpacing: '0.32em', color: '#bba8ff',
            }}>
              no runs yet
            </div>
            <div style={{
              fontSize: 12, color: '#9577ff', lineHeight: 1.5,
              maxWidth: 280, fontFamily: '"Exo 2", sans-serif',
            }}>
              Finish a run to record your first score. Top finishers stay
              listed across runs.
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}
              className="btn btn-primary mat-interactive tap"
              style={{ marginTop: 4, padding: '8px 18px', fontSize: 12 }}
            >
              Start a run
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}
        className="px-8 py-2 rounded-lg bg-cosmos-700/80 hover:bg-cosmos-600 text-cosmos-50
                   font-head ring-1 ring-cosmos-300/30 tap"
        style={{ minHeight: 44 }}
      >
        back
      </button>
    </div>
  );
}
