import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { dispatch } from '../../actions/dispatch';
import { selectUnlocks } from '../../state/selectors';
import { CONSTELLATIONS, DEFAULT_CONSTELLATION_ID } from '../../data/constellations';
import { fetchOnlineScores, type OnlineScore } from '../../online/leaderboard';
import type { GameState } from '../../state/store';

const selectActiveConstellation = (s: GameState) => s.run.constellationId;

function shortName(fullName: string): string {
  // CONSTELLATIONS[*].name is "Lyra, the Lyre" — the picker only needs the lead noun.
  return fullName.split(',')[0]!.trim();
}

export function Scores() {
  const unlocks = useStore(selectUnlocks);
  const activeId = useStore(selectActiveConstellation);

  const initialId = unlocks.includes(activeId) ? activeId : DEFAULT_CONSTELLATION_ID;
  const [selectedId, setSelectedId] = useState<string>(initialId);
  const [allScores, setAllScores] = useState<OnlineScore[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // fetchOnlineScores swallows network errors and returns [] — we surface that
    // as "no runs yet" rather than an explicit offline state.
    fetchOnlineScores().then((scores) => {
      if (!cancelled) setAllScores(scores);
    });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => {
    if (!allScores) return null;
    return allScores
      .filter((s) => s.constellation === selectedId)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [allScores, selectedId]);

  const selectedUnlocked = unlocks.includes(selectedId);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto px-4">
      <h2 className="font-display text-4xl text-cosmos-50 mb-4">HIGH SCORES</h2>

      <div
        className="w-full max-w-md mb-4 overflow-x-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
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
                aria-disabled={!isUnlocked}
                onClick={() => setSelectedId(c.id)}
                className="f-mono uc"
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
                {isUnlocked ? shortName(c.name) : '???'}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="w-full max-w-md min-h-[18rem] max-h-72 overflow-y-auto bg-cosmos-800/60 ring-1 ring-cosmos-300/30 rounded-xl p-4 mb-6"
      >
        {!selectedUnlocked && (
          <div className="text-cosmos-300 text-sm text-center py-8">
            Locked — complete a run on this constellation to unlock.
          </div>
        )}
        {selectedUnlocked && visible === null && (
          <div className="text-cosmos-300 text-sm text-center py-8">loading…</div>
        )}
        {selectedUnlocked && visible !== null && visible.length === 0 && (
          <div className="text-cosmos-300 text-sm text-center py-8">— no runs yet —</div>
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
      </div>

      <button
        onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}
        className="px-8 py-2 rounded-lg bg-cosmos-700/80 hover:bg-cosmos-600 text-cosmos-50
                   font-head ring-1 ring-cosmos-300/30"
        style={{ minHeight: 44 }}
      >
        back
      </button>
    </div>
  );
}
