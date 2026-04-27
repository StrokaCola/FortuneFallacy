import { useState } from 'react';
import { useStore } from '../../state/store';
import { dispatch } from '../../actions/dispatch';
import { selectOracles } from '../../state/selectors';
import { lookupOracle } from '../../data/oracles';
import { lookupConsumable } from '../../core/consumables';
import type { GameState } from '../../state/store';

const selectConsumables = (s: GameState) => s.run.consumables;
const selectDiceCount = (s: GameState) => s.round.dice.length;

export function LoadoutDock() {
  const oracles = useStore(selectOracles);
  const consumables = useStore(selectConsumables);
  const diceCount = useStore(selectDiceCount);
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
          {oracles.length === 0 && consumables.length === 0 && (
            <span className="f-mono" style={{ fontSize: 10, color: 'rgba(220,212,255,0.4)' }}>empty</span>
          )}
          {oracles.map((id, i) => {
            const o = lookupOracle(id);
            if (!o) return null;
            return (
              <div key={`o-${i}`} className="has-tip" style={{ position: 'relative' }}>
                <span style={{
                  display: 'inline-grid', placeItems: 'center',
                  width: 32, height: 32, borderRadius: 6,
                  background: `${o.color}25`,
                  border: `1px solid ${o.color}80`,
                  fontSize: 18, color: o.color,
                  filter: `drop-shadow(0 0 4px ${o.color})`,
                }}>{o.icon}</span>
                <span className="tip">{o.name} — {o.desc}</span>
              </div>
            );
          })}
          {consumables.map((id, i) => {
            const def = lookupConsumable(id);
            if (!def) return null;
            const accent = def.type === 'tarot' ? '#cc88ff' : '#f5c451';
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
