import { useStore } from '../../state/store';
import { dispatch } from '../../actions/dispatch';
import type { GameState } from '../../state/store';

const selectHighScores = (s: GameState) => s.meta.highScores;

export function Scores() {
  const scores = useStore(selectHighScores);
  const sorted = [...scores].sort((a, b) => b.score - a.score).slice(0, 10);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto px-8">
      <h2 className="font-display text-4xl text-cosmos-50 mb-6">HIGH SCORES</h2>

      <div className="w-80 max-h-72 overflow-y-auto bg-cosmos-800/60 ring-1 ring-cosmos-300/30 rounded-xl p-4 mb-6">
        {sorted.length === 0 && <div className="text-cosmos-300 text-sm text-center">— no runs yet —</div>}
        {sorted.map((s, i) => (
          <div key={i} className="flex justify-between items-baseline py-1 border-b border-cosmos-300/10 last:border-0">
            <span className="font-mono text-xs text-cosmos-300 w-6">{i + 1}.</span>
            <span className="text-cosmos-100 flex-1">{s.name || 'anon'}</span>
            <span className="font-mono text-gold">{s.score.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}
        className="px-8 py-2 rounded-lg bg-cosmos-700/80 hover:bg-cosmos-600 text-cosmos-50
                   font-head ring-1 ring-cosmos-300/30">
        back
      </button>
    </div>
  );
}
