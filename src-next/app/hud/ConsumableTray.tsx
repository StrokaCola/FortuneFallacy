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
      <div style={{
        position: 'absolute', top: 142, right: 18,
        display: 'flex', gap: 8, zIndex: 4, pointerEvents: 'auto',
      }}>
        {items.map((id, i) => {
          const def = lookupConsumable(id);
          if (!def) return null;
          const color = def.type === 'tarot' ? '#bba8ff' : '#7be3ff';
          return (
            <div key={`${id}-${i}`} className="has-tip" style={{ position: 'relative' }}>
              <button
                onClick={() => onUse(i)}
                style={{
                  width: 64, height: 88, borderRadius: 8,
                  background: 'linear-gradient(180deg, rgba(28,18,69,0.9), rgba(15,9,37,0.95))',
                  border: `1px dashed ${color}60`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 4px',
                  cursor: 'pointer',
                  color: '#dcd4ff',
                }}>
                <div className="f-mono uc" style={{
                  fontSize: 8, letterSpacing: '0.18em', color,
                }}>
                  {def.type}
                </div>
                <div style={{
                  fontSize: 28, color,
                  filter: `drop-shadow(0 0 6px ${color}80)`,
                }}>{def.icon}</div>
                <div className="f-mono uc" style={{
                  fontSize: 7, letterSpacing: '0.14em', color: '#dcd4ff',
                  textAlign: 'center', lineHeight: 1.1,
                }}>
                  {def.name}
                </div>
              </button>
              <div className="tip">{def.description}</div>
            </div>
          );
        })}
      </div>

      {armed && (
        <div style={{
          position: 'absolute', top: 240, left: '50%', transform: 'translateX(-50%)',
          padding: '10px 16px', borderRadius: 10,
          background: 'rgba(123,227,255,0.85)', color: '#0f0925',
          fontFamily: 'Cinzel, serif', fontSize: 13, fontWeight: 600,
          pointerEvents: 'auto', zIndex: 10,
        }}>
          select a die for {armed.def?.name}
          <button
            onClick={() => setArmed(null)}
            style={{ marginLeft: 10, fontSize: 11, textDecoration: 'underline',
                     background: 'none', border: 'none', color: '#0f0925', cursor: 'pointer' }}>
            cancel
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
            {Array.from({ length: diceCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => onTargetDie(i)}
                style={{
                  width: 36, height: 36, borderRadius: 6,
                  background: '#f3f0ff', color: '#0f0925',
                  fontFamily: 'Cinzel Decorative, serif', fontSize: 16,
                  border: '1px solid #9577ff', cursor: 'pointer',
                }}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
