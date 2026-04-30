import { useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { MODS, lookupMod } from '../../core/mods';
import { maxModSlots } from '../../core/vouchers';
import { Die3DCSS } from '../visual/Die3DCSS';
import { DieView } from '../../render/three/DieView';
import { PauseButton } from '../hud/PauseButton';
import {
  selectAnte, selectShards, selectCatalysts, selectMaxCatalystSlots,
} from '../../state/selectors';

const selectDiceMods = (s: GameState) => s.round.diceMods;
const selectDice = (s: GameState) => s.round.dice;
const selectMaxMod = (s: GameState) => maxModSlots(s);

export function Forge() {
  const dice = useStore(selectDice);
  const diceMods = useStore(selectDiceMods);
  const ante = useStore(selectAnte);
  const shards = useStore(selectShards);
  const catalysts = useStore(selectCatalysts);
  const maxCatalysts = useStore(selectMaxCatalystSlots);
  const maxSlots = useStore(selectMaxMod);

  const [selectedDie, setSelectedDie] = useState(0);
  const useDieView = typeof window !== 'undefined'
    && window.localStorage.getItem('ff_dieview_central') === '1';

  const slots = diceMods[selectedDie] ?? [];
  const accent = '#7be3ff';
  const selectedFace = dice[selectedDie]?.face ?? 1;
  const selectedMods = slots
    .map(lookupMod)
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({ icon: r.icon, name: r.name, color: '#7be3ff' }));

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
      <div className="mat-obsidian"
        style={{
          position: 'absolute', top: 18, left: 18,
          padding: '10px 14px', borderRadius: 10, zIndex: 5,
        }}>
        <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.28em', color: '#bba8ff' }}>
          Ante {String(ante).padStart(2, '0')} · Forge
        </div>
      </div>
      <div className="mat-obsidian"
        style={{
          position: 'absolute', top: 18, right: 18,
          padding: '10px 14px', borderRadius: 10, zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
        <span className="f-mono" style={{ color: '#f5c451', fontSize: 16 }}>◆ {shards}</span>
        <span className="f-mono" style={{ fontSize: 10, color: '#bba8ff' }}>catalysts {catalysts.length}/{maxCatalysts}</span>
      </div>
      <PauseButton />

      <div style={{ position: 'absolute', left: '50%', top: 160, transform: 'translateX(-50%)', textAlign: 'center', zIndex: 4 }}>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
          ◇ etch a mod ◇
        </div>
        <div className="f-display" style={{ fontSize: 32, color: '#f3f0ff', marginTop: 6 }}>
          The Star Forge
        </div>
      </div>

      {/* Selected die orbit */}
      <div style={{
        position: 'absolute', left: 'calc(50% - 470px)', top: 280, width: 360, height: 360,
        display: 'grid', placeItems: 'center',
      }}>
        <div className="panel" style={{ width: '100%', height: '100%', position: 'relative', display: 'grid', placeItems: 'center' }}>
          <svg width="320" height="320" viewBox="0 0 320 320" style={{ position: 'absolute' }}>
            <circle cx="160" cy="160" r="140" stroke="rgba(149,119,255,0.3)" strokeWidth="1" fill="none" strokeDasharray="4 6" />
            <g style={{ transformOrigin: 'center', animation: 'orbit 30s linear infinite' }}>
              {[0, 90, 180, 270].map((a) => {
                const x = 160 + Math.cos((a * Math.PI) / 180) * 140;
                const y = 160 + Math.sin((a * Math.PI) / 180) * 140;
                return <circle key={a} cx={x} cy={y} r="3" fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />;
              })}
            </g>
          </svg>
          {useDieView ? (
            <DieView face={selectedFace} size={140} style="celestial" mods={selectedMods} />
          ) : (
            <Die3DCSS face={selectedFace} size={140} style="celestial" mods={selectedMods} />
          )}
          <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, textAlign: 'center' }}>
            <div className="f-mono uc" style={{ fontSize: 9, color: '#bba8ff', letterSpacing: '0.2em' }}>
              die {selectedDie + 1} · {slots.length}/{maxSlots} mods
            </div>
          </div>
        </div>
      </div>

      {/* Die selector strip */}
      <div style={{
        position: 'absolute', left: 'calc(50% - 470px)', bottom: 50, width: 360,
        display: 'flex', justifyContent: 'space-between',
      }}>
        {dice.map((d, i) => (
          <div
            key={i}
            onClick={() => setSelectedDie(i)}
            style={{
              cursor: 'pointer',
              opacity: i === selectedDie ? 1 : 0.5,
              transform: i === selectedDie ? 'translateY(-4px)' : 'none',
              transition: 'all 200ms',
            }}>
            <Die3DCSS face={d.face} size={56} style="celestial" />
          </div>
        ))}
      </div>

      {/* Mod library */}
      <div style={{ position: 'absolute', right: 'calc(50% - 470px)', top: 260, width: 380, height: 440 }}>
        <div className="panel-strong" style={{ width: '100%', height: '100%', padding: 18 }}>
          <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.3em', marginBottom: 12 }}>
            ◈ mod codex
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {MODS.map((r) => {
              const c = r.visual?.accentColor ?? '#7be3ff';
              const canAttach = slots.length < maxSlots;
              return (
                <div
                  key={r.id}
                  onClick={() => canAttach && dispatch({ type: 'ATTACH_MOD', dieIdx: selectedDie, modId: r.id })}
                  className="forge-mod-row"
                  style={{
                    cursor: canAttach ? 'pointer' : 'not-allowed',
                    opacity: canAttach ? 1 : 0.4,
                    padding: 14, borderRadius: 8,
                    background: 'rgba(15,9,37,0.5)',
                    border: '1px solid rgba(149,119,255,0.2)',
                    transition: 'all 150ms',
                    display: 'flex', alignItems: 'center', gap: 10,
                    ['--mod-c' as never]: c,
                  } as React.CSSProperties}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 6,
                    background: `${c}25`, border: `1px solid ${c}80`,
                    display: 'grid', placeItems: 'center',
                    color: c, fontSize: 16,
                    filter: `drop-shadow(0 0 4px ${c})`,
                  }}>{r.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="f-head" style={{ fontSize: 12, color: '#f3f0ff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#bba8ff', lineHeight: 1.3 }}>
                      {r.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Attached mods detach row */}
      {slots.length > 0 && (
        <div style={{
          position: 'absolute', left: 'calc(50% - 470px)', top: 660, width: 360,
          display: 'flex', gap: 10, justifyContent: 'center',
        }}>
          {slots.map((rid, idx) => {
            const r = lookupMod(rid);
            if (!r) return null;
            return (
              <button
                key={idx}
                onClick={() => dispatch({ type: 'DETACH_MOD', dieIdx: selectedDie, modIdx: idx })}
                className="f-mono uc"
                style={{
                  fontSize: 9, padding: '4px 10px', borderRadius: 6,
                  background: 'rgba(226,51,74,0.15)', border: '1px solid rgba(226,51,74,0.5)',
                  color: '#ff8e9c', letterSpacing: '0.18em', cursor: 'pointer',
                }}>
                ✕ {r.name}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)' }}>
        <button className="btn btn-primary mat-interactive" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'hub' })}>
          ✓ Done
        </button>
      </div>
    </div>
  );
}
