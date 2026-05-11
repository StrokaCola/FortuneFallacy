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
import { ForgeBackdrop } from '../../render/bg/forgeBackdrop';
import { lookupConstellation } from '../../data/constellations';
import { activeAffinitiesOnDie, affinitySlotIndices } from '../../data/modAffinities';

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
  // 2026-05-11 Forge polish · Phase 1.2 — hover preview. When the player
  // hovers (or long-presses) a mod inventory row, the centerpiece DieView
  // gets that mod appended to its mods list so the player previews the
  // visual outcome BEFORE attaching. Null = no preview, render the real
  // attached mods. Released on leave / cancel.
  const [hoveredModId, setHoveredModId] = useState<string | null>(null);

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
  // 2026-05-11 polish — current constellation drives the backdrop accent
  // and the inner sigil ring inside the orbit panel.
  const constellationId = useStore((s) => s.run.constellationId);
  const constellation = lookupConstellation(constellationId);
  // Hover-preview composition: append the hovered mod to the centerpiece
  // die's mods array so the DieView shows what the player would see
  // post-attach. We only preview when there's still a free slot; a
  // hover on a row when slots are full doesn't change the preview
  // (the row is already aria-disabled, so it's the right read).
  const previewMod = hoveredModId ? lookupMod(hoveredModId) : null;
  const previewMods = previewMod && slots.length < maxSlots
    ? [
        ...(allDiceMods[selectedDie] ?? []),
        {
          id: previewMod.id,
          icon: previewMod.icon,
          name: previewMod.name,
          color: previewMod.visual?.accentColor ?? '#7be3ff',
        },
      ]
    : (allDiceMods[selectedDie] ?? []);
  const selectedFace = dice[selectedDie]?.face ?? 1;
  const selectedMods = allDiceMods[selectedDie] ?? [];
  const diceSpec = useStore(selectDiceSpec);
  const selectedShape = diceSpec[selectedDie]?.shape ?? 'd6';

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Phase 1.1 cosmic anvil backdrop — slow rotating anvil silhouette,
          rising sparks, ambient ember pulse. Sits behind everything. */}
      <ForgeBackdrop />
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
          display: 'inline-flex', alignItems: 'center', gap: 12,
        }}>
          {/* Animated constellation icon — small SVG built from the
              constellation's glyph nodes, slowly rotating. Reads as
              "the run's identity sigil". Phase 4.3 polish. */}
          <svg
            aria-hidden="true"
            width={tight ? 22 : 28}
            height={tight ? 22 : 28}
            viewBox="0 0 100 100"
            className="forge-header-sigil"
            style={{
              color: constellation.color,
              filter: `drop-shadow(0 0 6px ${constellation.color})`,
            }}>
            {constellation.glyph.length > 1 && (
              <polyline
                points={constellation.glyph.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none" stroke="currentColor" strokeWidth="1.2"
                strokeLinecap="round" strokeOpacity="0.85"
              />
            )}
            {constellation.glyph.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="currentColor" />
            ))}
          </svg>
          The Star Forge
        </div>
        {/* Subtitle — kept under 60 chars so it sits below the title on
            tight viewports without wrapping. */}
        <div className="f-mono" style={{
          marginTop: tight ? 2 : 4,
          fontSize: 10, letterSpacing: '0.24em',
          color: '#bba8ff', opacity: 0.85,
          fontStyle: 'italic',
        }}>
          strike the cosmos into your dice
        </div>
      </div>

      {/* Centered two-column layout: left = orbit + dice strip + detach row, right = mod inventory.
          Tier 2: flex-wrap kicks in below ~840px so the columns stack on narrow screens.
          Phase 4.x polish — tight viewports add extra paddingBottom so the
          frosted Done bar at the bottom doesn't overlap the last
          inventory row when fully scrolled. */}
      <div style={{
        position: 'absolute', left: '50%',
        top: tight ? 150 : 220,
        transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'flex-start', gap: 'clamp(20px, 4vw, 60px)',
        flexWrap: 'wrap', justifyContent: 'center',
        maxWidth: 'calc(100% - 40px)',
        paddingBottom: tight ? 140 : 100,
      }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: 'min(360px, 100%)' }}>
          {/* Selected die orbit — Phase 1.1 layered visuals:
              - Light shaft: vertical gradient column descending from above.
              - Inner sigil ring: constellation glyph rotating slowly behind the die.
              - Outer dashed orbit + 4 orbital nodes (already present, unchanged).
              - Centerpiece DieView levitates with a slow vertical bob. */}
          <div className="panel" style={{
            width: tight ? 'min(320px, calc(100vw - 32px))' : 360,
            height: tight ? 'min(320px, calc(100vw - 32px))' : 360,
            position: 'relative', display: 'grid', placeItems: 'center',
            overflow: 'hidden',
          }}>
            {/* Light shaft — column of soft warm/cool gradient descending
                onto the die. Breathes very slowly so the panel never
                feels static. */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0, bottom: 0,
                left: '50%',
                width: tight ? 120 : 150,
                marginLeft: tight ? -60 : -75,
                background: `linear-gradient(180deg,
                  ${constellation.color}38 0%,
                  ${constellation.color}1c 28%,
                  ${accent}10 60%,
                  transparent 100%)`,
                filter: 'blur(8px)',
                mixBlendMode: 'screen',
                animation: 'forge-shaft-pulse 4800ms ease-in-out infinite',
                pointerEvents: 'none',
              }}
            />
            {/* Inner sigil ring — constellation glyph projected onto a
                slowly-rotating SVG. Drawn UNDER the dashed orbit so the
                orbit nodes still cap the panel rim. */}
            <svg
              data-forge-sigil-ring
              aria-hidden="true"
              width={tight ? 220 : 250}
              height={tight ? 220 : 250}
              viewBox="0 0 100 100"
              style={{
                position: 'absolute',
                opacity: 0.18,
                color: constellation.color,
                animation: 'forge-sigil-rotate 90s linear infinite',
                transformOrigin: 'center',
                pointerEvents: 'none',
              }}>
              {/* The constellation glyph is a sparse node array. Draw a
                  faint stroke connecting them in order plus dots at each
                  point. Reads as a small "card of stars" behind the die. */}
              {constellation.glyph.length > 1 && (
                <polyline
                  points={constellation.glyph.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.6"
                  strokeLinecap="round"
                  strokeOpacity="0.65"
                />
              )}
              {constellation.glyph.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="1.2" fill="currentColor" />
              ))}
            </svg>
            {/* Outer dashed orbit + 4 orbital nodes — pre-existing element. */}
            <svg width={tight ? 280 : 320} height={tight ? 280 : 320} viewBox="0 0 320 320" style={{ position: 'absolute' }}>
              <circle cx="160" cy="160" r="140" stroke="rgba(149,119,255,0.3)" strokeWidth="1" fill="none" strokeDasharray="4 6" />
              <g className="forge-orbit" style={{ transformOrigin: 'center' }}>
                {[0, 90, 180, 270].map((a) => {
                  const x = 160 + Math.cos((a * Math.PI) / 180) * 140;
                  const y = 160 + Math.sin((a * Math.PI) / 180) * 140;
                  return <circle key={a} cx={x} cy={y} r="3" fill={accent} style={{ filter: `drop-shadow(0 0 6px ${accent})` }} />;
                })}
              </g>
              {/* 2026-05-11 Phase 3.1 — Affinity link arcs. When the
                  selected die carries an affinitied pair of mods, draw
                  a gold curve connecting their orbital "anchor" points.
                  The anchor positions are derived from the mod's slot
                  index — slot 0 anchors at NW, slot 1 at NE, slot 2 at
                  SE (matches the visual order in the detach row). */}
              {(() => {
                const modIds = diceMods[selectedDie] ?? [];
                const pairs = activeAffinitiesOnDie(modIds);
                if (pairs.length === 0) return null;
                // Slot anchor positions inside the 320×320 viewBox. Each
                // slot's anchor sits on the dashed orbit ring at a
                // pre-assigned angle, so adding more slots stays even.
                const slotAngles = [200, 340, 100, 60]; // NW, NE, SE, NE+
                const anchorFor = (slotIdx: number) => {
                  const a = (slotAngles[slotIdx] ?? 0) * Math.PI / 180;
                  return { x: 160 + Math.cos(a) * 130, y: 160 + Math.sin(a) * 130 };
                };
                return pairs.map((pair, i) => {
                  const idxs = affinitySlotIndices(pair, modIds);
                  if (!idxs) return null;
                  const [aIdx, bIdx] = idxs;
                  const p1 = anchorFor(aIdx);
                  const p2 = anchorFor(bIdx);
                  // Bezier arc bowed inward toward the center so it
                  // reads as a "linked" curve over the die, not a
                  // straight cord.
                  const cx = 160, cy = 160;
                  const bowed = `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${cx} ${cy} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
                  return (
                    <g key={pair.id} className="forge-affinity-arc">
                      <path d={bowed} stroke="#f5c451" strokeWidth="1.5"
                            fill="none" strokeLinecap="round"
                            opacity={0.55 - i * 0.05}
                            style={{ filter: 'drop-shadow(0 0 6px rgba(245,196,81,0.75))' }} />
                      <circle cx={p1.x} cy={p1.y} r="3"
                              fill="#f5c451" opacity="0.9"
                              style={{ filter: 'drop-shadow(0 0 6px rgba(245,196,81,0.85))' }} />
                      <circle cx={p2.x} cy={p2.y} r="3"
                              fill="#f5c451" opacity="0.9"
                              style={{ filter: 'drop-shadow(0 0 6px rgba(245,196,81,0.85))' }} />
                    </g>
                  );
                });
              })()}
            </svg>
            {/* Affinity badge — when at least one affinity is active on
                the selected die, show a small gold legend chip stacked
                below the die-label line so the player can see *what*
                they linked. Tooltip shows the flavor line. */}
            {(() => {
              const modIds = diceMods[selectedDie] ?? [];
              const pairs = activeAffinitiesOnDie(modIds);
              if (pairs.length === 0) return null;
              return (
                <div style={{
                  position: 'absolute', bottom: 38, left: 12, right: 12,
                  display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  {pairs.map((p) => (
                    <div key={p.id} className="f-mono uc has-tip" title={p.flavor}
                         style={{
                           fontSize: 8, letterSpacing: '0.24em',
                           color: '#f5c451',
                           padding: '2px 6px', borderRadius: 3,
                           background: 'rgba(245,196,81,0.10)',
                           border: '1px solid rgba(245,196,81,0.55)',
                           textShadow: '0 0 6px rgba(245,196,81,0.45)',
                           pointerEvents: 'auto',
                         }}>
                      ⌬ {p.name}
                    </div>
                  ))}
                </div>
              );
            })()}
            <DieView
              face={selectedFace}
              size={tight ? 112 : 140}
              style="celestial"
              shape={selectedShape}
              faceValues={diceSpec[selectedDie]?.faces}
              mods={previewMods}
              levitate
            />
            {/* Preview indicator — a tiny "preview" pill appears below
                the die when a mod is being hover-previewed, so the
                player understands the change is temporary. */}
            {hoveredModId && previewMods !== selectedMods && (
              <div className="f-mono uc" style={{
                position: 'absolute', top: 12, left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 8, letterSpacing: '0.32em',
                color: constellation.color,
                background: 'rgba(15,9,37,0.85)',
                padding: '3px 8px', borderRadius: 4,
                border: `1px solid ${constellation.color}88`,
                textShadow: `0 0 6px ${constellation.color}66`,
                pointerEvents: 'none',
                animation: 'fadein 200ms ease-out',
              }}>
                ◇ preview
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, textAlign: 'center' }}>
              <div className="f-mono uc" style={{ fontSize: 9, color: '#bba8ff', letterSpacing: '0.2em' }}>
                die {selectedDie + 1} · {slots.length}/{maxSlots} mods
              </div>
            </div>
          </div>

          {/* Die selector strip. Tight viewports: horizontal scroll +
              tighter spacing so 6-7 dice don't wrap into the inventory
              panel below. Wide: even space-between as before. */}
          <div style={{
            width: tight ? 'min(320px, calc(100vw - 32px))' : 360,
            display: 'flex',
            justifyContent: tight ? 'flex-start' : 'space-between',
            flexWrap: 'nowrap',
            overflowX: tight ? 'auto' : 'visible',
            overflowY: 'visible',
            paddingTop: 12,
            paddingBottom: 8,
            // Native scroll-snap so the user can flick between dies
            // without falling between two on tight viewports.
            scrollSnapType: tight ? 'x mandatory' : 'none',
            // Hide scrollbar cosmetically on iOS / Android — the dice
            // already cue scrollability through their visible overflow
            // (the row clearly has more than fits).
            scrollbarWidth: 'thin',
            gap: tight ? 8 : 4,
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
                  className={`has-tip tap forge-die-pick${isSelected ? ' forge-die-pick-selected' : ''}`}
                  aria-label={`Select die ${i + 1}`}
                  aria-pressed={isSelected}
                  style={{
                    cursor: 'pointer',
                    opacity: isSelected ? 1 : 0.55,
                    transform: isSelected ? 'translateY(-6px) scale(1.05)' : 'translateY(4px) scale(0.94)',
                    transition: 'all 280ms cubic-bezier(0.2, 1.1, 0.3, 1)',
                    position: 'relative',
                    padding: 6,
                    pointerEvents: 'auto',
                    background: 'transparent',
                    border: 'none',
                    flexShrink: 0,
                    scrollSnapAlign: 'center',
                  }}>
                  {isSelected && (
                    // Halo ring for the selected die — pulses faintly so
                    // the player's eye returns to the active pick on
                    // every visit. Constellation accent for identity.
                    <div aria-hidden="true" style={{
                      position: 'absolute',
                      left: '50%', top: '50%',
                      width: 72, height: 72,
                      marginLeft: -36, marginTop: -36,
                      borderRadius: '50%',
                      border: `1px solid ${constellation.color}80`,
                      boxShadow: `0 0 14px ${constellation.color}55, inset 0 0 12px ${constellation.color}33`,
                      pointerEvents: 'none',
                      animation: 'forge-die-pick-halo 3200ms ease-in-out infinite',
                    }} />
                  )}
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
                          // Drop the preview on click — the real attach now drives
                          // the DieView mods list.
                          setHoveredModId(null);
                          dispatch({ type: 'ATTACH_MOD', dieIdx: selectedDie, modId: r.id });
                          sfxPlay('modAttach');
                        }}
                        onKeyDown={(e) => {
                          if (!canAttach) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setHoveredModId(null);
                            dispatch({ type: 'ATTACH_MOD', dieIdx: selectedDie, modId: r.id });
                            sfxPlay('modAttach');
                          }
                        }}
                        onMouseEnter={() => setHoveredModId(r.id)}
                        onMouseLeave={() => setHoveredModId((cur) => (cur === r.id ? null : cur))}
                        onFocus={() => setHoveredModId(r.id)}
                        onBlur={() => setHoveredModId((cur) => (cur === r.id ? null : cur))}
                        className={`forge-mod-row forge-specimen has-tip tap${isLegendary ? ' legendary-aura' : ''}`}
                        style={{
                          cursor: canAttach ? 'pointer' : 'not-allowed',
                          opacity: canAttach ? 1 : 0.4,
                          padding: '14px 14px 14px 18px', borderRadius: 8,
                          background: `linear-gradient(135deg, rgba(15,9,37,0.65) 0%, ${c}10 100%)`,
                          border: isLegendary
                            ? '1px solid #ff7847aa'
                            : edition
                              ? `1px solid ${editionAccent}66`
                              : '1px solid rgba(149,119,255,0.2)',
                          transition: 'all 200ms cubic-bezier(0.2, 1, 0.3, 1)',
                          display: 'flex', alignItems: 'center', gap: 10,
                          position: 'relative',
                          overflow: 'hidden',
                          ['--mod-c' as never]: c,
                          // The vial silhouette sits behind the icon as a
                          // CSS background gradient column on the left
                          // edge. The icon box, name, and description
                          // stack normally on top — only the visual
                          // chrome changes.
                        } as React.CSSProperties}>
                        {/* Specimen vial silhouette — a thin vertical
                            translucent column of the accent color along
                            the card's left edge, with a brighter "core"
                            band centered on the icon. Pure decorative;
                            sits behind all other card content. */}
                        <div
                          aria-hidden="true"
                          className="forge-specimen-vial"
                          style={{
                            position: 'absolute',
                            top: 6, bottom: 6, left: 4,
                            width: 8,
                            borderRadius: 4,
                            background: `linear-gradient(180deg,
                              transparent 0%,
                              ${c}aa 30%,
                              ${c} 50%,
                              ${c}aa 70%,
                              transparent 100%)`,
                            boxShadow: `0 0 8px ${c}88, inset 0 0 4px ${c}66`,
                            opacity: 0.85,
                            pointerEvents: 'none',
                          }}
                        />
                        {isLegendary && (
                          <>
                            <div className="ff-holo" style={{ borderRadius: 8 }} />
                            <div className="ff-holo-shimmer" style={{ borderRadius: 8 }} />
                          </>
                        )}
                        <div style={{
                          marginLeft: 6, // breathing room past the vial column
                          width: 38, height: 38, borderRadius: 8,
                          background: `radial-gradient(circle at center, ${c}50 0%, ${c}18 60%, transparent 100%)`,
                          border: `1px solid ${c}80`,
                          display: 'grid', placeItems: 'center',
                          color: c, fontSize: 18,
                          filter: `drop-shadow(0 0 6px ${c})`,
                          position: 'relative', zIndex: 2,
                          flexShrink: 0,
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
                            // Phase 4.2 — edition forging as orbital ritual.
                            // The three editions appear in a small orbital
                            // ring above the card's icon. Hovering an
                            // orbital tilts and brightens it; clicking
                            // commits the forge. The whole thing reads as
                            // "pick a star to bind into this rune."
                            <div className="forge-edition-orbit" style={{
                              position: 'relative',
                              width: '100%', height: 64,
                              marginTop: 6,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              gap: 18,
                            }}>
                              {/* faint orbit ring */}
                              <div aria-hidden="true" style={{
                                position: 'absolute', inset: 0,
                                margin: 'auto', width: 180, height: 36,
                                borderRadius: 999,
                                border: '1px dashed rgba(245,196,81,0.3)',
                                pointerEvents: 'none',
                              }} />
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
                                  aria-label={`Forge ${editionLabel(ed)} edition`}
                                  className="forge-edition-orb f-mono uc tap"
                                  style={{
                                    width: 44, height: 44, borderRadius: '50%',
                                    background: `radial-gradient(circle at 35% 30%,
                                      ${editionColor(ed)}cc 0%,
                                      ${editionColor(ed)}44 60%,
                                      rgba(15,9,37,0.85) 100%)`,
                                    border: `1px solid ${editionColor(ed)}aa`,
                                    boxShadow: `0 0 16px ${editionColor(ed)}66, inset 0 0 12px ${editionColor(ed)}55`,
                                    fontSize: 9, letterSpacing: '0.16em',
                                    color: '#f3f0ff',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    display: 'grid', placeItems: 'center',
                                    transition: 'transform 200ms cubic-bezier(0.2, 1.2, 0.3, 1), box-shadow 200ms',
                                  }}>
                                  {editionLabel(ed).slice(0, 3)}
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

      {/* Done bar — tight viewports get a full-width frosted-glass bar
          across the bottom so the inventory panel header isn't obscured
          by an orphan button. The inner content has matching paddingBottom
          (see line ~190) so the last inventory row scrolls clear above
          the bar before reaching it. Wide viewports keep the centered
          floating button — there's plenty of room. */}
      {tight ? (
        <div
          style={{
            position: 'absolute', left: 0, right: 0,
            bottom: 0,
            zIndex: 5,
            padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)',
            background: 'linear-gradient(180deg, rgba(15,9,37,0) 0%, rgba(15,9,37,0.85) 35%, rgba(15,9,37,0.96) 100%)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderTop: '1px solid rgba(149,119,255,0.18)',
            display: 'flex', justifyContent: 'center',
          }}>
          <button
            className="btn btn-primary mat-interactive"
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'hub' })}
            style={{ width: 'min(280px, 100%)' }}>
            ✓ Done
          </button>
        </div>
      ) : (
        <div style={{
          position: 'absolute', left: '50%',
          bottom: 28,
          transform: 'translateX(-50%)',
          zIndex: 5,
        }}>
          <button className="btn btn-primary mat-interactive" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'hub' })}>
            ✓ Done
          </button>
        </div>
      )}
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
