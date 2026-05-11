import { useMemo, useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { lookupMod } from '../../core/mods';
import { maxModSlots } from '../../core/vouchers';
import { sfxPlay } from '../../audio/sfx';
import { DieView } from '../../render/three/DieView';
import { PauseButton } from '../hud/PauseButton';
import { SellButton } from '../hud/SellButton';
import { useIsTightStage } from '../hooks/useIsCompactStage';
import { getDiceSpec } from '../../core/run/diceContext';
import {
  selectAnte, selectShards, selectCatalysts, selectMaxCatalystSlots, selectOwnedMods,
} from '../../state/selectors';
import type { ModEdition } from '../../state/slices/run';
import { editionLabel, editionColor } from '../../core/upgrades/editions';

const FORGE_COST = 5;
const ALL_EDITIONS: ModEdition[] = ['foil', 'holo', 'poly'];

// Stable empty-array fallback so the selector returns a consistent ref
// across renders (avoids useSyncExternalStore tear-loops on legacy saves).
const EMPTY_MOD_EDITIONS: never[] = [];
const selectOwnedModEditions = (s: GameState) => s.run.ownedModEditions ?? EMPTY_MOD_EDITIONS;

const selectDiceSpec = (s: GameState) => getDiceSpec(s);

const selectDiceMods = (s: GameState) => s.run.diceMods;
// 2026-05-11 polish — per-mod-instance stack counters surfaced in the
// detach row so the player can SEE what a Tally Mark or Dormant has
// accrued without opening tooltips. Fallback to an empty array on
// legacy saves (covered by persistence default, but defensive here too).
const EMPTY_STACKS: number[][] = [];
const selectDiceModStacks = (s: GameState) => s.run.diceModStacks ?? EMPTY_STACKS;
const selectDice = (s: GameState) => s.round.dice;
const selectMaxMod = (s: GameState) => maxModSlots(s);

export function Forge() {
  const dice = useStore(selectDice);
  const diceMods = useStore(selectDiceMods);
  const diceModStacks = useStore(selectDiceModStacks);
  const tight = useIsTightStage();
  const ante = useStore(selectAnte);
  const shards = useStore(selectShards);
  const catalysts = useStore(selectCatalysts);
  const maxCatalysts = useStore(selectMaxCatalystSlots);
  const maxSlots = useStore(selectMaxMod);
  const ownedMods = useStore(selectOwnedMods);
  const ownedModEditions = useStore(selectOwnedModEditions);

  const [selectedDie, setSelectedDie] = useState(0);
  // Per-mod-id forge picker state. null = closed; 'amplify' = picker open
  // for amplify. Closes after dispatch or click-outside.
  const [forgeOpenFor, setForgeOpenFor] = useState<string | null>(null);

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
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', overflowY: 'auto', overflowX: 'hidden' }}>
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

      <div style={{
        position: 'absolute', left: '50%',
        top: tight ? 80 : 130,
        transform: 'translateX(-50%)', textAlign: 'center', zIndex: 4,
        width: tight ? 'calc(100% - 32px)' : 'auto',
      }}>
        <div className="f-mono uc" style={{ fontSize: 11, color: '#bba8ff', letterSpacing: '0.4em' }}>
          ◇ etch a mod ◇
        </div>
        <div className="f-display" style={{
          fontSize: 'clamp(20px, 6vw, 32px)',
          color: '#f3f0ff', marginTop: tight ? 4 : 6,
          whiteSpace: 'nowrap',
        }}>
          The Star Forge
        </div>
      </div>

      {/* Centered two-column layout: left = orbit + dice strip + detach row, right = mod inventory.
          Tier 2: flex-wrap kicks in below ~840px so the columns stack on narrow screens. */}
      <div style={{
        position: 'absolute', left: '50%',
        top: tight ? 150 : 220,
        transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'flex-start', gap: 'clamp(20px, 4vw, 60px)',
        flexWrap: 'wrap', justifyContent: 'center',
        maxWidth: 'calc(100% - 40px)',
        paddingBottom: 100,
      }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: 'min(360px, 100%)' }}>
          {/* Selected die orbit */}
          <div className="panel" style={{
            width: tight ? 'min(320px, calc(100vw - 32px))' : 360,
            height: tight ? 'min(320px, calc(100vw - 32px))' : 360,
            position: 'relative', display: 'grid', placeItems: 'center',
          }}>
            <svg width={tight ? 280 : 320} height={tight ? 280 : 320} viewBox="0 0 320 320" style={{ position: 'absolute' }}>
              <circle cx="160" cy="160" r="140" stroke="rgba(149,119,255,0.3)" strokeWidth="1" fill="none" strokeDasharray="4 6" />
              <g className="forge-orbit" style={{ transformOrigin: 'center' }}>
                {[0, 90, 180, 270].map((a) => {
                  const x = 160 + Math.cos((a * Math.PI) / 180) * 140;
                  const y = 160 + Math.sin((a * Math.PI) / 180) * 140;
                  return <circle key={a} cx={x} cy={y} r="3" fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />;
                })}
              </g>
            </svg>
            <DieView face={selectedFace} size={tight ? 112 : 140} style="celestial" shape={selectedShape} faceValues={diceSpec[selectedDie]?.faces} mods={selectedMods} />
            <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, textAlign: 'center' }}>
              <div className="f-mono uc" style={{ fontSize: 9, color: '#bba8ff', letterSpacing: '0.2em' }}>
                die {selectedDie + 1} · {slots.length}/{maxSlots} mods
              </div>
            </div>
          </div>

          {/* Die selector strip */}
          <div style={{
            width: tight ? 'min(320px, calc(100vw - 32px))' : 360,
            display: 'flex', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 4,
          }}>
            {dice.map((d, i) => {
              const dieMods = allDiceMods[i] ?? [];
              const extraCount = Math.max(0, dieMods.length - 1);
              const badgeColor = dieMods[1]?.color ?? dieMods[0]?.color ?? accent;
              const isSelected = i === selectedDie;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDie(i)}
                  className="has-tip tap"
                  aria-label={`Select die ${i + 1}`}
                  aria-pressed={isSelected}
                  style={{
                    cursor: 'pointer',
                    opacity: isSelected ? 1 : 0.55,
                    transform: isSelected ? 'translateY(-4px)' : 'none',
                    transition: 'all 200ms',
                    position: 'relative',
                    padding: 6,
                    pointerEvents: 'auto',
                    background: 'transparent',
                    border: 'none',
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
                  <span className="tip tip-above">
                    <span className="tip-title">Die {i + 1}</span>
                    {dieMods.length === 0
                      ? 'No mods attached.'
                      : `Mods: ${dieMods.map((m) => m.name).join(', ')}`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Attached mods detach row */}
          {slots.length > 0 && (
            <div style={{
              width: tight ? 'min(320px, calc(100vw - 32px))' : 360,
              display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap',
            }}>
              {/* firstScalingSlot — the lowest slot index in this die that
                  carries a scaling mod with a non-null stackLabel. Used to
                  position the scaling_mod_first coachmark anchor. */}
              {(() => { return null; })()}
              {slots.map((rid, idx) => {
                const r = lookupMod(rid);
                if (!r) return null;
                const stack = diceModStacks[selectedDie]?.[idx] ?? 0;
                const stackLabel = formatModStackLabel(r, stack);
                // Compute on each row — cheap (≤2-3 mods per die typically).
                const firstScalingSlot = slots.findIndex((sid, si) => {
                  const sdef = lookupMod(sid);
                  const sStack = diceModStacks[selectedDie]?.[si] ?? 0;
                  return sdef ? formatModStackLabel(sdef, sStack) != null : false;
                });
                const accent = r.visual?.accentColor;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'DETACH_MOD', dieIdx: selectedDie, modIdx: idx });
                      sfxPlay('modDetach');
                    }}
                    aria-label={`Detach ${r.name} from die ${selectedDie + 1}`}
                    className="f-mono uc tap"
                    style={{
                      fontSize: 10, padding: '8px 14px', borderRadius: 8,
                      background: 'rgba(149,119,255,0.12)', border: '1px solid rgba(149,119,255,0.45)',
                      color: '#dcd4ff', letterSpacing: '0.18em', cursor: 'pointer',
                      maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                    title={stackLabel
                      ? `${r.desc}\nCurrently ${stackLabel} from ${stack} stack${stack === 1 ? '' : 's'}.`
                      : r.desc}>
                    ✕ {r.name}
                    {stackLabel && accent && (
                      <span
                        // Anchor for the scaling_mod_first coachmark — the
                        // first rendered chip in the detach row gets the
                        // data-coach attribute (the coachmark controller
                        // picks the first DOM match, so we only tag it
                        // when this slot is the first scaling-mod on the
                        // currently-selected die).
                        data-coach={idx === firstScalingSlot ? 'scaling-mod-chip' : undefined}
                        style={{
                          fontSize: 9, fontWeight: 700,
                          padding: '1px 5px', borderRadius: 4,
                          background: `${accent}25`,
                          color: accent,
                          border: `1px solid ${accent}88`,
                          letterSpacing: '0.04em',
                          textShadow: `0 0 4px ${accent}88`,
                        }}>
                        {stackLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: mod inventory */}
        <div style={{
          width: 'min(380px, calc(100vw - 32px))',
          height: tight ? 360 : 440,
        }}>
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
              <div style={{
                flex: '1 1 auto', overflowY: 'auto', minHeight: 0, paddingRight: 4,
                display: 'grid',
                // Tight viewports: 1-column so each mod card has the
                // full ~328px width on phones. The 2-column layout
                // produced ~164px columns at 360px wide, aggressively
                // truncating mod names and squeezing descriptions.
                gridTemplateColumns: tight ? '1fr' : '1fr 1fr',
                gap: 10, alignContent: 'start',
              }}>
                {(() => {
                  // Group by (id, edition). Each unique pair gets its own
                  // row so foil amplify + plain amplify show separately.
                  type Key = `${string}|${string}`;
                  const counts = new Map<Key, { id: string; edition: ModEdition | null; count: number; firstIndex: number }>();
                  for (let i = 0; i < ownedMods.length; i++) {
                    const id = ownedMods[i]!;
                    const ed = ownedModEditions[i] ?? null;
                    const key = `${id}|${ed ?? 'plain'}` as Key;
                    const cur = counts.get(key);
                    if (cur) cur.count++;
                    else counts.set(key, { id, edition: ed, count: 1, firstIndex: i });
                  }
                  // Plain count for the same id (used to gate Forge button —
                  // forging takes 2 plain copies of any edition combo with
                  // the same id; for v1 we restrict to 2 plain copies).
                  const plainCountById = new Map<string, number>();
                  for (let i = 0; i < ownedMods.length; i++) {
                    if ((ownedModEditions[i] ?? null) === null) {
                      plainCountById.set(ownedMods[i]!, (plainCountById.get(ownedMods[i]!) ?? 0) + 1);
                    }
                  }
                  return [...counts.values()].map(({ id, edition, count, firstIndex }) => {
                    const r = lookupMod(id);
                    if (!r) return null;
                    const c = r.visual?.accentColor ?? '#7be3ff';
                    const canAttach = slots.length < maxSlots;
                    const isLegendary = r.rarity === 'legendary';
                    const editionAccent = edition ? editionColor(edition) : c;
                    // Forging: only available on plain rows where the player
                    // has 2+ plain copies of this id and 5+ shards.
                    const canForge = edition === null && (plainCountById.get(id) ?? 0) >= 2 && shards >= FORGE_COST;
                    const isPickerOpen = forgeOpenFor === id;
                    return (
                      <div
                        key={`${id}|${edition ?? 'plain'}`}
                        role="button"
                        tabIndex={canAttach ? 0 : -1}
                        aria-disabled={!canAttach}
                        aria-label={`${r.name}${edition ? ` ${editionLabel(edition)}` : ''} — ${canAttach ? 'attach to selected die' : 'no free mod slots'}`}
                        onClick={() => {
                          if (!canAttach) return;
                          dispatch({ type: 'ATTACH_MOD', dieIdx: selectedDie, modId: r.id });
                          sfxPlay('modAttach');
                        }}
                        onKeyDown={(e) => {
                          if (!canAttach) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            dispatch({ type: 'ATTACH_MOD', dieIdx: selectedDie, modId: r.id });
                            sfxPlay('modAttach');
                          }
                        }}
                        className={`forge-mod-row has-tip tap${isLegendary ? ' legendary-aura' : ''}`}
                        style={{
                          cursor: canAttach ? 'pointer' : 'not-allowed',
                          opacity: canAttach ? 1 : 0.4,
                          padding: 14, borderRadius: 8,
                          background: 'rgba(15,9,37,0.5)',
                          border: isLegendary
                            ? '1px solid #ff7847aa'
                            : edition
                              ? `1px solid ${editionAccent}66`
                              : '1px solid rgba(149,119,255,0.2)',
                          transition: 'all 150ms',
                          display: 'flex', alignItems: 'center', gap: 10,
                          position: 'relative',
                          overflow: 'hidden',
                          ['--mod-c' as never]: c,
                        } as React.CSSProperties}>
                        {isLegendary && (
                          <>
                            <div className="ff-holo" style={{ borderRadius: 8 }} />
                            <div className="ff-holo-shimmer" style={{ borderRadius: 8 }} />
                          </>
                        )}
                        <div style={{
                          width: 36, height: 36, borderRadius: 6,
                          background: `${c}25`, border: `1px solid ${c}80`,
                          display: 'grid', placeItems: 'center',
                          color: c, fontSize: 16,
                          filter: `drop-shadow(0 0 4px ${c})`,
                          position: 'relative', zIndex: 2,
                        }}>{r.icon}</div>
                        <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 2 }}>
                          <div className="f-head" style={{
                            fontSize: 12, color: '#f3f0ff',
                            textTransform: 'uppercase', letterSpacing: '0.08em',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }} title={r.name}>
                            {r.name}
                            {edition && (
                              <span className="f-mono uc" style={{
                                marginLeft: 6, padding: '1px 5px',
                                fontSize: 8, letterSpacing: '0.18em',
                                borderRadius: 3,
                                color: editionAccent,
                                border: `1px solid ${editionAccent}88`,
                                background: `${editionAccent}22`,
                              }}>{editionLabel(edition).slice(0, 4).toLowerCase()}</span>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: '#bba8ff', lineHeight: 1.3 }}>
                            {r.desc}
                          </div>
                          {canForge && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setForgeOpenFor(isPickerOpen ? null : id);
                              }}
                              className="f-mono uc tap"
                              style={{
                                marginTop: 6, fontSize: 10, padding: '6px 12px', borderRadius: 6,
                                background: 'rgba(245,196,81,0.12)', border: '1px solid rgba(245,196,81,0.5)',
                                color: '#f5c451', letterSpacing: '0.18em', cursor: 'pointer',
                              }}>
                              {isPickerOpen ? '✕ cancel' : `🔨 forge ◆${FORGE_COST}`}
                            </button>
                          )}
                          {isPickerOpen && (
                            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {ALL_EDITIONS.map((ed) => (
                                <button
                                  key={ed}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    dispatch({ type: 'FORGE_MOD', modId: id, targetEdition: ed });
                                    setForgeOpenFor(null);
                                    sfxPlay('modAttach');
                                  }}
                                  className="f-mono uc tap"
                                  style={{
                                    fontSize: 10, padding: '6px 12px', borderRadius: 6,
                                    background: `${editionColor(ed)}22`,
                                    border: `1px solid ${editionColor(ed)}88`,
                                    color: editionColor(ed),
                                    letterSpacing: '0.16em',
                                    cursor: 'pointer',
                                  }}>
                                  {editionLabel(ed).slice(0, 4)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <SellButton kind="mod" id={id} index={firstIndex} />
                        {count > 1 && (
                          <div className="f-mono num" style={{
                            position: 'absolute', top: 4, right: 4,
                            fontSize: 10, color: edition ? editionAccent : c,
                            background: 'rgba(15,9,37,0.8)',
                            border: `1px solid ${edition ? editionAccent : c}80`,
                            borderRadius: 8, padding: '1px 6px',
                          }}>×{count}</div>
                        )}
                        <span className="tip">
                          <span className="tip-title">{r.name}{edition ? ` (${editionLabel(edition)})` : ''}</span>
                          {r.desc}
                          <span style={{ display: 'block', marginTop: 4, color: '#7be3ff', fontSize: 10 }}>
                            {canAttach ? 'Click to attach to the selected die.' : 'Selected die has no free mod slots.'}
                          </span>
                          {canForge && (
                            <span style={{ display: 'block', marginTop: 4, color: '#f5c451', fontSize: 10 }}>
                              Forge: combine 2 plain copies + ◆{FORGE_COST} into one editioned mod.
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute', left: '50%',
        bottom: tight ? `calc(var(--hud-bottom-h, 60px) + 12px)` : 28,
        transform: 'translateX(-50%)',
        zIndex: 5,
      }}>
        <button className="btn btn-primary mat-interactive" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'hub' })}>
          ✓ Done
        </button>
      </div>
    </div>
  );
}

// 2026-05-11 polish — per-mod-instance stack chip label.
// Returns null for non-scaling mods so the detach button doesn't render
// an empty badge. The math mirrors what applyDieModStep credits the
// die for at score time, so what the player sees here is what they'll
// see on the next hand.
import type { ModDef } from '../../core/mods';
function formatModStackLabel(def: ModDef, stack: number): string | null {
  if (stack <= 0) return null;
  if (def.tallyChipPerStack) return `+${stack * def.tallyChipPerStack}c`;
  if (def.cadenceMultPerStack) return `+${stack * def.cadenceMultPerStack}m (blind)`;
  if (def.veteranMultPerStack) return `+${(stack * def.veteranMultPerStack).toFixed(1)}m`;
  if (def.gluttonChipPerStack) return `+${stack * def.gluttonChipPerStack}c`;
  if (def.dormantAwakenAt != null) {
    return stack >= def.dormantAwakenAt ? '★ awake' : `${stack}/${def.dormantAwakenAt}`;
  }
  if (def.ballastChipPerStack) return `+${stack * def.ballastChipPerStack}c`;
  if (def.pyreChipPerStack) return `+${stack * def.pyreChipPerStack}c`;
  return null;
}
