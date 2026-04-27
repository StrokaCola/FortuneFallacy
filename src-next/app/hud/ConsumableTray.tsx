import { useState } from 'react';
import { useStore, type GameState } from '../../state/store';
import { dispatch } from '../../actions/dispatch';
import { lookupConsumable } from '../../core/consumables';

const selectConsumables = (s: GameState) => s.run.consumables;
const selectDiceCount = (s: GameState) => s.round.dice.length;

export function ConsumableTray() {
  const items = useStore(selectConsumables);
  const diceCount = useStore(selectDiceCount);
  const [armed, setArmed] = useState<{ index: number; def: ReturnType<typeof lookupConsumable> } | null>(null);

  const onUse = (index: number) => {
    const id = items[index];
    if (!id) return;
    const def = lookupConsumable(id);
    if (!def) return;
    if (def.requiresTarget) {
      setArmed({ index, def });
      return;
    }
    dispatch({ type: 'USE_CONSUMABLE', index });
  };

  const onTargetDie = (idx: number) => {
    if (!armed) return;
    dispatch({ type: 'USE_CONSUMABLE', index: armed.index, targets: [idx] });
    setArmed(null);
  };

  return (
    <>
      <div className="absolute bottom-24 left-4 flex gap-2 pointer-events-auto">
        {items.length === 0 && (
          <div className="text-cosmos-300/60 text-xs font-mono">no consumables</div>
        )}
        {items.map((id, i) => {
          const def = lookupConsumable(id);
          if (!def) return null;
          return (
            <button
              key={`${id}-${i}`}
              onClick={() => onUse(i)}
              title={def.description}
              className={`w-14 h-20 rounded-lg ring-1 flex flex-col items-center justify-center
                          ${def.type === 'tarot' ? 'bg-cosmos-700/80 ring-astral/50' : 'bg-cosmos-800/80 ring-gold/50'}
                          hover:ring-2 transition`}>
              <div className="text-2xl">{def.icon}</div>
              <div className="text-[9px] font-mono text-cosmos-200 mt-1">{def.name.split(' ')[0]}</div>
            </button>
          );
        })}
      </div>
      {armed && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-astral/80
                        text-cosmos-900 font-head text-sm pointer-events-auto z-10">
          select a die for {armed.def?.name}
          <button onClick={() => setArmed(null)} className="ml-3 text-xs underline">cancel</button>
          <div className="flex gap-2 mt-2 justify-center">
            {Array.from({ length: diceCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => onTargetDie(i)}
                className="w-10 h-10 rounded bg-cosmos-50 text-cosmos-900 font-display text-lg
                           hover:bg-gold ring-1 ring-cosmos-300">
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
