import { useEffect, useMemo, useRef, useState } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { lookupMod } from '../../core/mods';
import { ModIcon } from '../visual/ModIcon';
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
import { ForgeVFX, forgeVFX } from '../hud/ForgeVFX';
import { formatModStackLabel } from '../hud/modStackLabel';
import { invalidateRects } from '../../render/three/sharedRenderer';
import '../hud/ForgeVFX.css';

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

  // Drive the ambient constellation sigil glow off the active affinity
  // count on the selected die — it brightens as the player builds links.
  useEffect(() => {
    const modIds = diceMods[selectedDie] ?? [];
    forgeVFX.updateConstellation(activeAffinitiesOnDie(modIds).length);
  }, [diceMods, selectedDie]);

  // When the player switches dice, the previously-selected button shrinks
  // (scale 1.05 → 0.94) and the newly-selected one grows. The shared
  // dice renderer caches each view's bounding rect and only refreshes
  // them on scroll/resize/visibilitychange — selection swaps aren't
  // covered, so the canvas keeps drawing each cube at its old (stale)
  // rect. That's what produced the off-centre cubes in the halo.
  // Invalidating the cache here re-measures every view on the next
  // frame so the cubes line up with their buttons again.
  useEffect(() => {
    invalidateRects();
    // Re-invalidate after the selection transform animation finishes
    // (280ms) — the cube would otherwise lock to the rect captured
    // mid-animation.
    const t = setTimeout(invalidateRects, 320);
    return () => clearTimeout(t);
  }, [selectedDie]);

  // VFX anchor: the stellar ritual + edition burst + affinity rings all
  // center on this ref's bounding rect rather than the viewport, so the
  // effect stays glued to the die when the Forge content scrolls.
  const dieAnchorRef = useRef<HTMLDivElement>(null);

  // Lift the shared dice canvas above the React tree while we're on the
  // Forge. Default architecture pins the canvas at z-index:1 inside
  // #stage-root with #next-root above at z-index:2, so any React
  // background (.panel chrome, picker bg, sticky col) literally paints
  // over the dice behind it. Here the dice ARE the centerpiece and the
  // panel/picker chrome is supposed to be around them, not on top —
  // raising the canvas inverts that. The canvas is only painted at
  // each DieView's screen rect via scissor, so non-dice areas stay
  // transparent and the rest of the Forge UI still composes normally.
  // Restored on unmount so modals like Pause / Settings on other
  // screens keep covering the dice.
  useEffect(() => {
    const canvas = document.querySelector('canvas[data-shared-renderer]') as HTMLCanvasElement | null;
    if (!canvas) return;
    const prev = canvas.style.zIndex;
    canvas.style.zIndex = '15';
    return () => { canvas.style.zIndex = prev; };
  }, []);

  return (
    <div data-forge-scroll style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', overflowY: 'auto', overflowX: 'hidden' }}>
      <ForgeVFX anchorRef={dieAnchorRef} />
      {/* Debug overlay only mounts when the ?dbg=forge query flag is
          set. Previously it always rendered a fixed-position DBG ON/OFF
          toggle in the bottom-right at z-index 99999 — fine for
          development, but a real player can accidentally hit it on
          touch screens and lose the corner of the UI. */}
      {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dbg') === 'forge' && (
        <ForgeDebugOverlay dieAnchorRef={dieAnchorRef} />
      )}
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
          fixed Done bar at the bottom doesn't overlap the last
          inventory row when fully scrolled. */}
      <div style={{
        position: 'absolute', left: '50%',
        top: tight ? 150 : 220,
        transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'flex-start', gap: 'clamp(20px, 4vw, 60px)',
        flexWrap: 'wrap', justifyContent: 'center',
        maxWidth: 'calc(100% - 40px)',
        paddingBottom: tight ? 200 : 120,
      }}>
        {/* Left column. Sticky so the die centerpiece + picker + detach
            row stay pinned to the top of the scrollport as the player
            scrolls through the mod inventory below — they need the die
            visible to know what they're modifying. On wide viewports
            (no wrap) the right column is its own flex item and scrolls
            past the sticky left col naturally.

            We deliberately leave the column itself transparent: the
            DieView cubes use a translucent THREE.js canvas, so an
            opaque backdrop directly behind them alpha-blends the
            transparent pixels with dark color and makes the dice look
            muddy. Bleed-through of the inventory beneath is blocked
            by per-row backdrops on the picker strip and detach row
            (added below) — those backdrops aren't behind the dice
            cubes themselves, so the cubes stay vibrant against the
            Forge ambient. zIndex 20 keeps the picker halo, dice, and
            attached-mod chips above the inventory panel below. */}
        <div data-forge-sticky-col style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 14, width: 'min(360px, 100%)',
          position: 'sticky', top: 0, zIndex: 20,
          alignSelf: 'flex-start',
          padding: '8px 0 14px',
          // Important: do NOT add backdrop-filter here. The .panel class
          // already applies its own backdrop-filter to the die panel,
          // and stacking a second backdrop-filter on this parent breaks
          // WebGL canvas rendering inside (the centerpiece DieView and
          // every picker die go invisible). The picker strip below
          // gets its own simple opaque background instead — that
          // blocks inventory bleed-through without nesting filters.
        }}>
          {/* Selected die orbit — Phase 1.1 layered visuals:
              - Light shaft: vertical gradient column descending from above.
              - Inner sigil ring: constellation glyph rotating slowly behind the die.
              - Outer dashed orbit + 4 orbital nodes (already present, unchanged).
              - Centerpiece DieView levitates with a slow vertical bob. */}
          <div ref={dieAnchorRef} data-forge-die-panel className="panel" style={{
            width: tight ? 'min(320px, calc(100vw - 32px))' : 360,
            // On landscape phones (360px-tall) the bare width-as-height
            // orbit can swallow the whole viewport vertically, pushing
            // the mod inventory off-screen. Clamp the height to half
            // the viewport (minus a 40px buffer for the header strip)
            // so the inventory always stays reachable below.
            height: tight ? 'min(320px, calc(100vw - 32px), calc(50vh - 40px))' : 360,
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
            {/* Centerpiece die. The wrapper that used to elevate it
                above the panel's SVG chrome is gone now that the dice
                canvas itself rides at z-index 15 over all React UI —
                the wrapper was a block-level shim and its rect was
                what the shared renderer was reading, throwing the
                cube's scissor area off-centre from the actual
                placeholder. */}
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
              panel below. Wide: even space-between as before.

              The horizontal scroll lives on an INNER wrapper so the
              outer strip can keep `overflow: visible` — the selected
              die's halo glow extends ~14px past the cube and would
              otherwise be clipped vertically (the CSS rule that
              `overflowX: auto` forces overflowY to auto would cut the
              glow off and let the inventory below cover what remains). */}
          <div
            className="forge-dice-strip"
            style={{
              // A bit wider so the dice row breathes — and so adding a
              // 6th die from a voucher doesn't force horizontal scroll
              // until we actually run out of room.
              width: tight ? 'min(380px, calc(100vw - 8px))' : 360,
              overflow: 'visible',
              // Trimmed outer paddings to compensate for the larger
              // inner paddings below — the halo glow needs room
              // *inside* the scroll-clipped inner wrapper, not outside
              // it. Net picker height grows ~12px to make room.
              paddingTop: 4,
              paddingBottom: 8,
              // Solid translucent backdrop blocks inventory bleed-through.
              // We can be opaque here without dimming the dice because
              // the shared dice canvas is elevated to z-index 15 while
              // we're on the Forge (see Forge mount effect), so the
              // cubes physically paint on top of this background rather
              // than alpha-blending with it from behind.
              background: 'rgba(15,9,37,0.86)',
              borderRadius: 14,
            }}>
          <div
            style={{
              display: 'flex',
              // Centred horizontally so the row sits cleanly inside the
              // picker bounds when the user has the default 5 dice.
              // (At 6+ dice the row overflows and `overflowX: auto`
              // takes over, scrolling from the left as before.)
              justifyContent: 'center',
              // Centred vertically so the cubes sit on the picker's
              // visual midline. Without this, the buttons stretch to
              // the full inner cross-axis height and the cubes —
              // which only occupy their inner padding box — drift
              // toward the bottom edge.
              alignItems: 'center',
              flexWrap: 'nowrap',
              overflowX: tight ? 'auto' : 'visible',
              overflowY: 'visible',
              // Native scroll-snap so the user can flick between dies
              // without falling between two on tight viewports.
              scrollSnapType: tight ? 'x mandatory' : 'none',
              // Hide the scrollbar entirely — on Android Chrome a
              // `thin` bar renders as a visible horizontal "rail" that
              // cuts through the dice. The row is clearly scrollable
              // by the dice falling off the right edge, so no chrome
              // is needed. WebKit rule lives in styles/index.css.
              scrollbarWidth: 'none',
              gap: tight ? 4 : 4,
              // The inner wrapper effectively gets `overflow-y: auto`
              // too because `overflow-x: auto` is set above (CSS spec:
              // when one axis is non-visible, `visible` on the other
              // computes to `auto`). That means the selected die's
              // halo, which is `position: absolute` inside its button
              // and projects a 14px box-shadow blur ~50px outward
              // from the cube centre, gets *clipped* at the inner
              // wrapper's bounds. We pad the inner wrapper vertically
              // by enough to hold a full halo glow: 36px halo radius
              // + 14px shadow blur = 50px from the cube centre, and
              // half a button is 35.5px, so 16px of padding on each
              // side leaves a 0.5px margin before clipping.
              paddingTop: 16,
              paddingBottom: 14,
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
                    // 0.55 left non-selected dice looking faded behind
                    // the picker backdrop — 0.85 keeps them clearly
                    // legible while still being visually subordinate
                    // to the selected one.
                    opacity: isSelected ? 1 : 0.85,
                    // Cut the translateY magnitudes roughly in half:
                    // the old (-6, +4) split was pushing non-selected
                    // dice ~4px below the picker midline, so the row
                    // visually sat in the bottom half of the strip.
                    // Smaller offsets still convey "selected pops up"
                    // without dragging the whole row off-centre.
                    transform: isSelected ? 'translateY(-3px) scale(1.05)' : 'translateY(0) scale(0.94)',
                    transition: 'all 280ms cubic-bezier(0.2, 1.1, 0.3, 1)',
                    position: 'relative',
                    padding: 6,
                    pointerEvents: 'auto',
                    background: 'transparent',
                    border: 'none',
                    flexShrink: 0,
                    scrollSnapAlign: 'center',
                    // Explicit flex centering on the button itself so
                    // the DieView placeholder always sits at the
                    // button's geometric centre. Default <button>
                    // content layout is inline-block-style, which
                    // baseline-aligns the placeholder div and sinks
                    // it toward the bottom of the button — that's
                    // what was producing the offset between the cube
                    // (rendered at placeholder.getBoundingClientRect)
                    // and the halo (which uses top:50% of the button).
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  {isSelected && (
                    // Halo ring for the selected die — pulses faintly so
                    // the player's eye returns to the active pick on
                    // every visit. Constellation accent for identity.
                    // The inset shadow used to project a constellation
                    // tint INWARD over the die area, which alpha-blended
                    // with the celestial DieView and made the selected
                    // cube look duller than its neighbors. Dropping it
                    // lets the cube read cleanly inside the halo while
                    // the outer glow still marks selection.
                    <div aria-hidden="true" style={{
                      position: 'absolute',
                      left: '50%', top: '50%',
                      width: 72, height: 72,
                      marginLeft: -36, marginTop: -36,
                      borderRadius: '50%',
                      border: `1px solid ${constellation.color}80`,
                      boxShadow: `0 0 14px ${constellation.color}55`,
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
        <div data-forge-inventory style={{
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
                          const prevModIds = diceMods[selectedDie] ?? [];
                          const prevPairs = activeAffinitiesOnDie(prevModIds);
                          forgeVFX.triggerAttach(r.id, r.rarity, edition ?? 'base');
                          dispatch({ type: 'ATTACH_MOD', dieIdx: selectedDie, modId: r.id });
                          sfxPlay('modAttach');
                          const newModIds = [...prevModIds, r.id];
                          const newPairs = activeAffinitiesOnDie(newModIds);
                          if (newPairs.length > prevPairs.length) {
                            const added = newPairs.find((p) => !prevPairs.some((pp) => pp.id === p.id));
                            if (added) forgeVFX.triggerAffinityActivate(added.id, newModIds);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (!canAttach) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setHoveredModId(null);
                            const prevModIds = diceMods[selectedDie] ?? [];
                            const prevPairs = activeAffinitiesOnDie(prevModIds);
                            forgeVFX.triggerAttach(r.id, r.rarity, edition ?? 'base');
                            dispatch({ type: 'ATTACH_MOD', dieIdx: selectedDie, modId: r.id });
                            sfxPlay('modAttach');
                            const newModIds = [...prevModIds, r.id];
                            const newPairs = activeAffinitiesOnDie(newModIds);
                            if (newPairs.length > prevPairs.length) {
                              const added = newPairs.find((p) => !prevPairs.some((pp) => pp.id === p.id));
                              if (added) forgeVFX.triggerAffinityActivate(added.id, newModIds);
                            }
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
                          color: c,
                          // fontSize only applies when the fallback char
                          // is rendered; SVGs ignore it via inline-flex.
                          fontSize: 18,
                          filter: `drop-shadow(0 0 6px ${c})`,
                          position: 'relative', zIndex: 2,
                          flexShrink: 0,
                        }}><ModIcon modId={r.id} fallbackChar={r.icon} color={c} size={24} /></div>
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
                                    forgeVFX.triggerForge(id, ed);
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
          pinned to the actual viewport bottom (position: fixed, relative
          to the transformed ScreenTransition ancestor → reliably tracks
          the visible viewport across mobile URL-bar resizes). The
          centered layout above adds paddingBottom so the last inventory
          row scrolls clear above this bar before reaching it. Wide
          viewports keep the centered floating button — there's plenty
          of room. */}
      {tight ? (
        <div
          style={{
            position: 'fixed', left: 0, right: 0,
            bottom: 0,
            zIndex: 5,
            padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)',
            background: 'linear-gradient(180deg, rgba(15,9,37,0) 0%, rgba(15,9,37,0.85) 35%, rgba(15,9,37,0.96) 100%)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderTop: '1px solid rgba(149,119,255,0.18)',
            display: 'flex', justifyContent: 'center',
            pointerEvents: 'auto',
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
          position: 'fixed', left: '50%',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
          transform: 'translateX(-50%)',
          zIndex: 5,
          pointerEvents: 'auto',
        }}>
          <button className="btn btn-primary mat-interactive" onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'hub' })}>
            ✓ Done
          </button>
        </div>
      )}
    </div>
  );
}

// Debug overlay for the Forge layout. Toggled via a small DBG button in
// the corner — when open, draws colored outlines around each major
// layout element with its computed position/zIndex/background so we
// can tell at a glance which element is covering which. Also lets us
// fire the stellar VFX manually at any rarity to verify it lands on
// the die anchor and stays in front of the rest of the UI.
type DbgRow = {
  label: string;
  color: string;
  rect: { x: number; y: number; w: number; h: number };
  zIndex: string;
  position: string;
  bg: string;
  backdropFilter: string;
};

const DBG_TARGETS: Array<{ sel: string; label: string; color: string }> = [
  { sel: '[data-forge-scroll]',    label: 'scroll',    color: '#ffffff' },
  { sel: '[data-forge-sticky-col]',label: 'stickyCol', color: '#ff52c8' },
  { sel: '[data-forge-die-panel]', label: 'diePanel',  color: '#ffd97a' },
  { sel: '.forge-dice-strip',      label: 'picker',    color: '#7be3ff' },
  { sel: '.forge-die-pick',        label: 'dieBtn',    color: '#6ee7a7' },
  { sel: '[data-forge-inventory]', label: 'inv',       color: '#ff4d6d' },
];

function ForgeDebugOverlay({ dieAnchorRef }: { dieAnchorRef: React.RefObject<HTMLDivElement | null> }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DbgRow[]>([]);
  const [meta, setMeta] = useState<{ vw: number; vh: number; scrollTop: number; anchor: { x: number; y: number } | null }>(
    { vw: 0, vh: 0, scrollTop: 0, anchor: null },
  );

  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const tick = () => {
      const next: DbgRow[] = [];
      for (const t of DBG_TARGETS) {
        const nodes = document.querySelectorAll(t.sel);
        nodes.forEach((node, i) => {
          const r = (node as HTMLElement).getBoundingClientRect();
          const cs = getComputedStyle(node as HTMLElement);
          next.push({
            label: nodes.length > 1 ? `${t.label}[${i}]` : t.label,
            color: t.color,
            rect: { x: r.left, y: r.top, w: r.width, h: r.height },
            zIndex: cs.zIndex,
            position: cs.position,
            bg: cs.backgroundColor || 'transparent',
            backdropFilter: cs.backdropFilter || (cs as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || 'none',
          });
        });
      }
      const scroller = document.querySelector('[data-forge-scroll]') as HTMLElement | null;
      const anchorEl = dieAnchorRef.current;
      const ar = anchorEl?.getBoundingClientRect();
      setRows(next);
      setMeta({
        vw: window.innerWidth,
        vh: window.innerHeight,
        scrollTop: scroller?.scrollTop ?? 0,
        anchor: ar ? { x: ar.left + ar.width / 2, y: ar.top + ar.height / 2 } : null,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, dieAnchorRef]);

  const fireVfx = (rarity: 'common' | 'uncommon' | 'rare' | 'legendary') => {
    forgeVFX.triggerAttach(`__dbg_${rarity}`, rarity, 'base');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'fixed', bottom: 88, right: 8,
          zIndex: 99999,
          background: open ? '#ff52c8' : 'rgba(0,0,0,0.7)',
          color: '#fff', border: '1px solid #fff',
          padding: '4px 8px', borderRadius: 4,
          fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em',
          pointerEvents: 'auto', cursor: 'pointer',
        }}>
        DBG {open ? 'ON' : 'OFF'}
      </button>

      {open && rows.map((row, i) => (
        <div key={i} aria-hidden="true" style={{
          position: 'fixed',
          left: row.rect.x, top: row.rect.y,
          width: row.rect.w, height: row.rect.h,
          border: `2px solid ${row.color}`,
          pointerEvents: 'none',
          zIndex: 99997,
          boxSizing: 'border-box',
        }}>
          <span style={{
            position: 'absolute', top: -14, left: 0,
            fontSize: 9, color: row.color,
            background: 'rgba(0,0,0,0.85)',
            padding: '1px 4px',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
          }}>{row.label} z:{row.zIndex} {row.position}</span>
        </div>
      ))}

      {open && meta.anchor && (
        <div aria-hidden="true" style={{
          position: 'fixed',
          left: meta.anchor.x - 8, top: meta.anchor.y - 8,
          width: 16, height: 16,
          borderRadius: '50%',
          background: '#ff52c8',
          boxShadow: '0 0 12px #ff52c8',
          pointerEvents: 'none',
          zIndex: 99998,
        }} />
      )}

      {open && (
        <div style={{
          position: 'fixed',
          top: 60, left: 8, right: 8,
          maxHeight: 'calc(45vh)',
          overflow: 'auto',
          zIndex: 99998,
          background: 'rgba(0,0,0,0.92)',
          color: '#7be3ff',
          padding: 8,
          border: '1px solid #ff52c8',
          borderRadius: 4,
          fontSize: 10,
          fontFamily: 'monospace',
          lineHeight: 1.45,
          pointerEvents: 'auto',
        }}>
          <div style={{ color: '#ffd97a', marginBottom: 4 }}>FORGE DEBUG</div>
          <div>vw {meta.vw}  vh {meta.vh}  scrollTop {meta.scrollTop}</div>
          <div>anchor {meta.anchor ? `(${meta.anchor.x.toFixed(0)}, ${meta.anchor.y.toFixed(0)})` : '—'}</div>
          <div style={{ borderTop: '1px solid #444', margin: '6px 0' }} />
          {rows.map((r, i) => (
            <div key={i} style={{ color: r.color, marginBottom: 2 }}>
              {r.label.padEnd(12)} pos={r.position} z={r.zIndex} rect=({r.rect.x.toFixed(0)},{r.rect.y.toFixed(0)},{r.rect.w.toFixed(0)}x{r.rect.h.toFixed(0)})
              {r.bg !== 'rgba(0, 0, 0, 0)' && r.bg !== 'transparent' && <span> bg={r.bg}</span>}
              {r.backdropFilter !== 'none' && <span> bdf={r.backdropFilter}</span>}
            </div>
          ))}
          <div style={{ borderTop: '1px solid #444', margin: '6px 0' }} />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ color: '#ffd97a', alignSelf: 'center' }}>fire VFX:</span>
            {(['common', 'uncommon', 'rare', 'legendary'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => fireVfx(r)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: '1px solid #555',
                  padding: '2px 6px',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  borderRadius: 3,
                }}>
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// formatModStackLabel — per-mod-instance stack chip label. Lives in
// ../hud/modStackLabel and is shared with DieTip so the in-round
// long-press tip and the Forge detach row stay aligned. Imported above.
