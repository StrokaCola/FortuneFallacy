import { useStore, type GameState } from '../../state/store';
import { dispatch } from '../../actions/dispatch';

const selectDice = (s: GameState) => s.round.dice;

export function DiceLockBar() {
  const dice = useStore(selectDice);
  const count = dice.length;
  const slotW = 96;
  const totalW = count * slotW;
  return (
    <div
      className="absolute pointer-events-auto flex justify-center"
      style={{ left: '50%', transform: 'translateX(-50%)', bottom: 110, width: totalW }}>
      {dice.map((d, i) => (
        <button
          key={i}
          onClick={() => dispatch({ type: 'TOGGLE_LOCK', dieIdx: i })}
          className={`mx-1 w-20 h-7 rounded-md font-mono text-xs ring-1 transition
            ${d.locked
              ? 'bg-gold/30 text-gold ring-gold/60'
              : 'bg-cosmos-800/40 text-cosmos-300 ring-cosmos-300/30 hover:bg-cosmos-700/50'}`}>
          {d.locked ? '★ LOCK' : 'lock'}
        </button>
      ))}
    </div>
  );
}
