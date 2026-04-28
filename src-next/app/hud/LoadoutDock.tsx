import { useState } from 'react';
import { useStore } from '../../state/store';
import { dispatch } from '../../actions/dispatch';
import { selectCatalysts } from '../../state/selectors';
import { lookupCatalyst } from '../../data/catalysts';
import { lookupConsumable } from '../../core/consumables';
import type { GameState } from '../../state/store';

const selectConsumables = (s: GameState) => s.run.consumables;
const selectDiceCount = (s: GameState) => s.round.dice.length;
const selectCompoundingStacks = (s: GameState) => s.run.compoundingStacks;
const selectHandsPlayed = (s: GameState) => s.run.handsPlayed;

export function LoadoutDock() {
  const catalysts = useStore(selectCatalysts);
  const consumables = useStore(selectConsumables);
  const diceCount = useStore(selectDiceCount);
  const compoundingStacks = useStore(selectCompoundingStacks);
  const handsPlayed = useStore(selectHandsPlayed);
  const [armed, setArmed] = useState<{ index: number; def: ReturnType<typeof lookupConsumable> } | null>(null);

  const onUseConsumable = (index: number) => {
    const id = consumables[index];
    if (!id) return;
    const def = lookupConsumable(id);
    if (!def) return;
    if (def.requiresTarget) { setArmed({ index, def }); return; }
    dispatch({ type: 'USE_CONSUMABLE', index });
  };
  const onTargetDie = (i: number) => {
    if (!armed) return;
    dispatch({ type: 'USE_CONSUMABLE', index: armed.index, targets: [i] });
    setArmed(null);
  };

  return (
    <>
      <div
        className="mat-obsidian"
        style={{
          position: 'absolute', bottom: 18, left: 18,
          padding: '10px 12px', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 10,
          pointerEvents: 'auto', zIndex: 5,
        }}>
        <span className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.28em', color: '#bba8ff' }}>Loadout</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {catalysts.length === 0 && consumables.length === 0 && (
            <span className="f-mono" style={{ fontSize: 10, color: 'rgba(220,212,255,0.4)' }}>empty</span>
          )}
          {catalysts.map((id, i) => {
            const cat = lookupCatalyst(id);
            if (!cat) return null;
            return (
              <div key={`o-${i}`} className="has-tip" style={{ position: 'relative' }}>
                <span style={{
                  display: 'inline-grid', placeItems: 'center',
                  width: 32, height: 32, borderRadius: 6,
                  background: `${cat.color}25`,
                  border: `1px solid ${cat.color}80`,
                  fontSize: 18, color: cat.color,
                  filter: `drop-shadow(0 0 4px ${cat.color})`,
                }}>{cat.icon}</span>
                {id === 'compounding_bias' && compoundingStacks > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -6,
                    fontSize: 8, fontFamily: '"JetBrains Mono", monospace',
                    color: cat.color, fontWeight: 700,
                    background: 'rgba(15,9,37,0.9)',
                    padding: '0 3px', borderRadius: 3,
                  }}>+{compoundingStacks}</span>
                )}
                {id === 'patience_counter' && (
                  <span style={{
                    position: 'absolute', top: -4, right: -6,
                    fontSize: 8, fontFamily: '"JetBrains Mono", monospace',
                    color: cat.color, fontWeight: 700,
                    background: 'rgba(15,9,37,0.9)',
                    padding: '0 3px', borderRadius: 3,
                  }}>{handsPlayed % 5}/5</span>
                )}
                <span className="tip">{cat.name} — {cat.desc}</span>
              </div>
            );
          })}
          {consumables.map((id, i) => {
            const def = lookupConsumable(id);
            if (!def) return null;
            const accent = def.type === 'calibration' ? '#cc88ff' : '#f5c451';
            return (
              <button
                key={`c-${i}`}
                onClick={() => onUseConsumable(i)}
                className="has-tip"
                style={{
                  position: 'relative', display: 'inline-grid', placeItems: 'center',
                  width: 32, height: 32, borderRadius: 6,
                  background: `${accent}25`,
                  border: `1px solid ${accent}80`,
                  fontSize: 18, color: accent, cursor: 'pointer',
                }}>
                {def.icon}
                <span className="tip">{def.name} — {def.description}</span>
              </button>
            );
          })}
        </div>
      </div>
      {armed && (
        <div
          className="mat-crystal"
          style={{
            position: 'absolute', top: 96, left: '50%', transform: 'translateX(-50%)',
            padding: '8px 14px', borderRadius: 8, zIndex: 6, pointerEvents: 'auto',
          }}>
          <span className="f-mono uc" style={{ fontSize: 11, letterSpacing: '0.18em', color: '#7be3ff' }}>
            select a die for {armed.def?.name}
          </span>
          <button onClick={() => setArmed(null)} className="f-mono" style={{
            marginLeft: 12, fontSize: 10, color: '#bba8ff', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer',
          }}>cancel</button>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'center' }}>
            {Array.from({ length: diceCount }).map((_, i) => (
              <button key={i} onClick={() => onTargetDie(i)}
                className="mat-gold mat-interactive"
                style={{
                  width: 36, height: 36, borderRadius: 6,
                  fontFamily: "'Cinzel', serif", fontSize: 18, cursor: 'pointer',
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
