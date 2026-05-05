import { useMemo, useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { lookupMod } from '../../core/mods';
import { maxModSlots } from '../../core/vouchers';
import { sfxPlay } from '../../audio/sfx';
import { DieView } from '../../render/three/DieView';
import { PauseButton } from '../hud/PauseButton';
import { getDiceSpec } from '../../core/run/diceContext';
import {
  selectAnte, selectShards, selectCatalysts, selectMaxCatalystSlots, selectOwnedMods,
} from '../../state/selectors';

const selectDiceSpec = (s: GameState) => getDiceSpec(s);

const selectDiceMods = (s: GameState) => s.run.diceMods;
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
  const ownedMods = useStore(selectOwnedMods);

  const [selectedDie, setSelectedDie] = useState(0);

  // Resolve every die's attached mods into renderable DieMod[] up front, so the
  // orbit and the strip share the same visual representation.
  const allDiceMods = useMemo(
    () => diceMods.map((slots) => slots
      .map(lookupMod)
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => ({ id: r.id, icon: r.icon, name: r.name, color: r.visual?.accentColor ?? '#7be3ff' }))),
    [diceMods],
  );

  const slots = diceMods[selectedDie] ?? [];
  const accent = '#7be3ff';
  const selectedFace = dice[selectedDie]?.face ?? 1;
  const selectedMods = allDiceMods[selectedDie] ?? [];
  const diceSpec = useStore(selectDiceSpec);
  const selectedShape = diceSpec[selectedDie]?.shape ?? 'd6';

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

      <div style={{ position: 'absolute', left: '50%', top: 130, transform: 'translateX(-50%)', textAlign: 'center', zIndex: 4 }}>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
          ◇ etch a mod ◇
        </div>
        <div className="f-display" style={{ fontSize: 32, color: '#f3f0ff', marginTop: 6 }}>
          The Star Forge
        </div>
      </div>

      {/* Centered two-column layout: left = orbit + dice strip + detach row, right = mod inventory */}
      <div style={{
        position: 'absolute', left: '50%', top: 220, transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'flex-start', gap: 60,
      }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: 360 }}>
          {/* Selected die orbit */}
          <div className="panel" style={{ width: 360, height: 360, position: 'relative', display: 'grid', placeItems: 'center' }}>
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
            <DieView face={selectedFace} size={140} style="celestial" shape={selectedShape} faceValues={diceSpec[selectedDie]?.faces} mods={selectedMods} />
            <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, textAlign: 'center' }}>
              <div className="f-mono uc" style={{ fontSize: 9, color: '#bba8ff', letterSpacing: '0.2em' }}>
                die {selectedDie + 1} · {slots.length}/{maxSlots} mods
              </div>
            </div>
          </div>

          {/* Die selector strip */}
          <div style={{
            width: 360,
            display: 'flex', justifyContent: 'space-between',
          }}>
            {dice.map((d, i) => {
              const dieMods = allDiceMods[i] ?? [];
              const extraCount = Math.max(0, dieMods.length - 1);
              const badgeColor = dieMods[1]?.color ?? dieMods[0]?.color ?? accent;
              return (
                <div
                  key={i}
                  onClick={() => setSelectedDie(i)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedDie(i); }}
                  style={{
                    cursor: 'pointer',
                    opacity: i === selectedDie ? 1 : 0.55,
                    transform: i === selectedDie ? 'translateY(-4px)' : 'none',
                    transition: 'all 200ms',
                    position: 'relative',
                    padding: 6,
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    pointerEvents: 'auto',
                  }}>
                  <DieView face={d.face} size={56} style="celestial" shape={diceSpec[i]?.shape ?? 'd6'} faceValues={diceSpec[i]?.faces} mods={dieMods} />
                  {extraCount > 0 && (
                    <div className="f-mono num" style={{
                      position: 'absolute', top: -2, right: -4,
                      fontSize: 9, color: badgeColor,
                      background: 'rgba(15,9,37,0.85)',
                      border: `1px solid ${badgeColor}80`,
                      borderRadius: 8, padding: '0 4px',
                      filter: `drop-shadow(0 0 4px ${badgeColor})`,
                    }}>+{extraCount}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Attached mods detach row */}
          {slots.length > 0 && (
            <div style={{
              width: 360,
              display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap',
            }}>
              {slots.map((rid, idx) => {
                const r = lookupMod(rid);
                if (!r) return null;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      dispatch({ type: 'DETACH_MOD', dieIdx: selectedDie, modIdx: idx });
                      sfxPlay('modDetach');
                    }}
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
        </div>

        {/* Right column: mod inventory */}
        <div style={{ width: 380, height: 440 }}>
          <div className="panel-strong" style={{ width: '100%', height: '100%', padding: 18, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.3em', marginBottom: 12, flex: '0 0 auto', display: 'flex', justifyContent: 'space-between' }}>
              <span>◈ mod inventory</span>
              <span style={{ color: '#f5c451' }}>{ownedMods.length}</span>
            </div>
            {ownedMods.length === 0 ? (
              <div style={{ flex: '1 1 auto', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20 }}>
                <div>
                  <div className="f-mono uc" style={{ fontSize: 10, color: '#bba8ff', letterSpacing: '0.2em', opacity: 0.6 }}>— empty —</div>
                  <div style={{ fontSize: 11, color: '#bba8ff', marginTop: 12, opacity: 0.7, lineHeight: 1.5 }}>
                    Buy mods at the Bazaar to etch them onto your dice here.
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ flex: '1 1 auto', overflowY: 'auto', minHeight: 0, paddingRight: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignContent: 'start' }}>
                {(() => {
                  const counts = new Map<string, number>();
                  for (const id of ownedMods) counts.set(id, (counts.get(id) ?? 0) + 1);
                  return [...counts.entries()].map(([id, count]) => {
                    const r = lookupMod(id);
                    if (!r) return null;
                    const c = r.visual?.accentColor ?? '#7be3ff';
                    const canAttach = slots.length < maxSlots;
                    return (
                      <div
                        key={id}
                        onClick={() => {
                          if (!canAttach) return;
                          dispatch({ type: 'ATTACH_MOD', dieIdx: selectedDie, modId: r.id });
                          sfxPlay('modAttach');
                        }}
                        className="forge-mod-row"
                        style={{
                          cursor: canAttach ? 'pointer' : 'not-allowed',
                          opacity: canAttach ? 1 : 0.4,
                          padding: 14, borderRadius: 8,
                          background: 'rgba(15,9,37,0.5)',
                          border: '1px solid rgba(149,119,255,0.2)',
                          transition: 'all 150ms',
                          display: 'flex', alignItems: 'center', gap: 10,
                          position: 'relative',
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
                        {count > 1 && (
                          <div className="f-mono num" style={{
                            position: 'absolute', top: 4, right: 4,
                            fontSize: 10, color: c,
                            background: 'rgba(15,9,37,0.8)',
                            border: `1px solid ${c}80`,
                            borderRadius: 8, padding: '1px 6px',
                          }}>×{count}</div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)' }}>
        <button className="btn btn-primary mat-interactive" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'hub' })}>
          ✓ Done
        </button>
      </div>
    </div>
  );
}
