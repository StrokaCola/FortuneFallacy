import { useEffect, useRef, useState } from 'react';
import { useStore, type GameState } from '../../state/store';
import { lookupCatalyst, awakeningThreshold, isAwakened } from '../../data/catalysts';
import { bus } from '../../events/bus';
import { SellButton } from './SellButton';
import { editionColor } from '../../core/upgrades/editions';
import { useIsWideMode, useIsTightStage } from '../hooks/useIsCompactStage';
import { KindFrame } from '../visual/upgradeKindFrames';
import { catalystIdFromEvent, resonanceIdFromEvent } from '../../core/upgrades/eventId';
import { lookupResonance, activeResonances } from '../../data/resonances';
import { Z } from './zLayers';

// Stable fallback so the selector doesn't return a fresh object on every
// snapshot read (which tear-loops useSyncExternalStore).
const EMPTY_EDITIONS: Record<string, never> = {};
const selectCatalysts = (s: GameState) => s.run.catalysts;
const selectCatalystEditions = (s: GameState) => s.run.catalystEditions ?? EMPTY_EDITIONS;
const selectCompoundingStacks = (s: GameState) => s.run.compoundingStacks;
const selectHandsPlayed = (s: GameState) => s.run.handsPlayed;
const selectHandsLeft = (s: GameState) => s.round.handsLeft;
const selectActive = (s: GameState) => s.round.active;
const EMPTY_CONTRIB: Record<string, number> = {};
const selectCatalystChips = (s: GameState) => s.run.runStats?.catalystChips ?? EMPTY_CONTRIB;
const EMPTY_FIRES: Record<string, number> = {};
const selectCatalystFires = (s: GameState) => s.run.runStats?.catalystFires ?? EMPTY_FIRES;
// 2026-05-11 scaling pack — selector for per-catalyst stack counters used by
// star_chart, lodestone, comet_trail, memento_star, ouroboros, event_horizon,
// highwater, heirloom_locket.
const EMPTY_STACKS: Record<string, number> = {};
const selectCatalystStacks = (s: GameState) => s.run.catalystStacks ?? EMPTY_STACKS;
const selectLunarPhase = (s: GameState) => s.run.lunarPhase ?? 0;
const selectLunarBaked = (s: GameState) => s.run.lunarBakedMult ?? 0;
const selectMirroredHand = (s: GameState) => s.run.mirroredHandActive;

const PULSE_DURATION_MS = 380;
const PULSE_DURATION_LEGENDARY_MS = 540;
const CHAIN_PULSE_STEP_MS = 80;
const FLOATER_DURATION_MS = 900;
const RING_DURATION_MS = 720;

type FloaterRecord = {
  key: number;
  catalystId: string;
  text: string;
  tone: 'chips' | 'mult';
};

type RingRecord = { key: number; catalystId: string; color: string };

const RESONANCE_RING_COLOR = '#ffd84a';
const RESONANCE_FLOATER_TEXT_COLOR = '#ffd84a';

// Shared corner-badge for scaling-pack counters. Same shape as
// compounding_bias' inline badge — color comes from the catalyst's
// own identity hue.
function renderBadge(color: string, text: string) {
  return (
    <div style={{
      position: 'absolute', top: 4, right: 4,
      fontSize: 9, fontFamily: '"JetBrains Mono", monospace',
      color, fontWeight: 700,
      background: 'rgba(15,9,37,0.85)',
      padding: '1px 4px', borderRadius: 4,
      border: `1px solid ${color}80`,
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {text}
    </div>
  );
}

export function CatalystStrip() {
  const catalysts = useStore(selectCatalysts);
  const catalystEditions = useStore(selectCatalystEditions);
  const compoundingStacks = useStore(selectCompoundingStacks);
  const handsPlayed = useStore(selectHandsPlayed);
  const wide = useIsWideMode();
  // Tight viewports: suppress the ring burst that emanates from each
  // catalyst card on fire. The card-pulse (scale+glow) AND the rising
  // floater both already celebrate the same event; the ring is the
  // third concurrent celebration with zero informational value. On a
  // 4-catalyst Five-of-a-Kind that means 4-5 expanding rings stacked
  // on top of the strip — instant visual mud. Wide/desktop keeps them.
  // Also throttle floaters: stagger each one's launch by 120ms instead
  // of letting them all spawn in the same frame, so a chain reads as
  // a sequence rather than a chaotic burst.
  const tight = useIsTightStage();
  const handsLeft = useStore(selectHandsLeft);
  const roundActive = useStore(selectActive);
  const catalystChips = useStore(selectCatalystChips);
  const catalystFires = useStore(selectCatalystFires);
  const catalystStacks = useStore(selectCatalystStacks);
  const lunarPhase = useStore(selectLunarPhase);
  const lunarBaked = useStore(selectLunarBaked);
  const mirroredHandActive = useStore(selectMirroredHand);

  const [pulsing, setPulsing] = useState<Record<string, 'fire' | 'fire-legendary' | 'chain' | undefined>>({});
  const [floaters, setFloaters] = useState<FloaterRecord[]>([]);
  const [rings, setRings] = useState<RingRecord[]>([]);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const floaterKeyRef = useRef(0);
  const ringKeyRef = useRef(0);
  // Tight-viewport floater staggering: tracks the earliest time the
  // NEXT floater can launch. Resets when the gap expires. Lets a chain
  // of catalyst fires play as a sequence instead of a simultaneous
  // burst — the user can actually attribute each floater to its source.
  const floaterStaggerRef = useRef(0);
  const FLOATER_STAGGER_MS = 120;

  useEffect(() => {
    const timers = timersRef.current;
    const track = (cb: () => void, delayMs: number): ReturnType<typeof setTimeout> => {
      const t = setTimeout(() => {
        timers.delete(t);
        cb();
      }, delayMs);
      timers.add(t);
      return t;
    };

    const off = bus.on('onUpgradeTriggered', (payload: { id: string; deltaChips: number; deltaMult: number }) => {
      const id = payload.id;

      // Resonance: a hand-authored pair fired. Pulse BOTH halves with the
      // legendary fire animation so the player sees the link visually,
      // and float a single resonance label off the FIRST owned catalyst
      // card (we don't double the floater — the player just saw "+5 mult"
      // once, attributed to the named pair).
      const resonanceId = resonanceIdFromEvent(id);
      if (resonanceId) {
        const pair = lookupResonance(resonanceId);
        if (!pair) return;
        const halves = [pair.a, pair.b].filter((cId) => catalysts.includes(cId));
        for (const half of halves) {
          setPulsing((s) => ({ ...s, [half]: 'fire-legendary' }));
          track(() => {
            setPulsing((s) => ({ ...s, [half]: undefined }));
          }, PULSE_DURATION_LEGENDARY_MS);
          // Same tight-mode ring suppression as below — keeps the
          // legendary pulse + named-beat floater, drops the rings.
          if (!tight) {
            const ringKey = ++ringKeyRef.current;
            setRings((rs) => [...rs, { key: ringKey, catalystId: half, color: RESONANCE_RING_COLOR }]);
            track(() => {
              setRings((rs) => rs.filter((r) => r.key !== ringKey));
            }, RING_DURATION_MS);
          }
        }
        // Single floater on the first owned half — shows the named beat
        // ("Symphony +5 mult") rather than two anonymous deltas.
        if (halves[0]) {
          const dChips = payload.deltaChips ?? 0;
          const dMult = payload.deltaMult ?? 0;
          const parts: string[] = [pair.name];
          if (dChips > 0) parts.push(`+${Math.round(dChips)}`);
          if (dMult > 0) parts.push(`+${(Math.round(dMult * 10) / 10).toString().replace(/\.0$/, '')} mult`);
          const floaterKey = ++floaterKeyRef.current;
          const launchAt = tight ? Math.max(performance.now(), floaterStaggerRef.current) : performance.now();
          const delay = launchAt - performance.now();
          if (tight) floaterStaggerRef.current = launchAt + FLOATER_STAGGER_MS;
          const launch = () => {
            setFloaters((fs) => [...fs, {
              key: floaterKey,
              catalystId: halves[0]!,
              text: parts.join(' · '),
              tone: 'mult',
            }]);
            track(() => {
              setFloaters((fs) => fs.filter((f) => f.key !== floaterKey));
            }, FLOATER_DURATION_MS);
          };
          if (delay > 0) track(launch, delay);
          else launch();
        }
        return;
      }

      // catalyst_bench is special: it ripples through every OTHER owned
      // catalyst with a chain pulse, so its fire payload itself stays
      // attributed to the bench card.
      if (id === 'catalyst_bench') {
        const others = catalysts.filter((c) => c !== 'catalyst_bench');
        others.forEach((otherId, i) => {
          track(() => {
            setPulsing((s) => ({ ...s, [otherId]: 'chain' }));
            track(() => {
              setPulsing((s) => ({ ...s, [otherId]: undefined }));
            }, PULSE_DURATION_MS);
          }, i * CHAIN_PULSE_STEP_MS);
        });
        return;
      }

      const catalystId = catalystIdFromEvent(id);
      if (!catalystId || !catalysts.includes(catalystId)) return;

      const meta = lookupCatalyst(catalystId);
      const isLegendary = meta?.rarity === 'legendary';
      const pulseKind: 'fire' | 'fire-legendary' = isLegendary ? 'fire-legendary' : 'fire';
      const pulseDuration = isLegendary ? PULSE_DURATION_LEGENDARY_MS : PULSE_DURATION_MS;

      setPulsing((s) => ({ ...s, [catalystId]: pulseKind }));
      track(() => {
        setPulsing((s) => ({ ...s, [catalystId]: undefined }));
      }, pulseDuration);

      // Ring burst emanates from the card; lower-cost than the floater and
      // fires for every catalyst contribution (incl. edition stamps).
      // Tight viewports skip the ring entirely — the card-pulse already
      // communicates "this card fired" and the floater carries the
      // actual delta. The ring is pure redundant celebration on small
      // screens where 4+ concurrent rings stack into visual mud.
      if (!tight) {
        const ringKey = ++ringKeyRef.current;
        const ringColor = isLegendary ? '#ff9466' : meta?.color ?? '#7be3ff';
        setRings((rs) => [...rs, { key: ringKey, catalystId, color: ringColor }]);
        track(() => {
          setRings((rs) => rs.filter((r) => r.key !== ringKey));
        }, RING_DURATION_MS);
      }

      // Floater — only when there's a material delta. Skips silent fires
      // (utility catalysts that mutate state without moving chips/mult)
      // so the strip doesn't spam +0 toasts.
      const dChips = payload.deltaChips ?? 0;
      const dMult = payload.deltaMult ?? 0;
      let text = '';
      let tone: 'chips' | 'mult' = 'chips';
      if (dChips !== 0) {
        text = `+${Math.round(dChips)}`;
        tone = 'chips';
      } else if (dMult !== 0) {
        const rounded = Math.round(dMult * 10) / 10;
        text = `+${rounded.toString().replace(/\.0$/, '')} mult`;
        tone = 'mult';
      }
      if (text) {
        const floaterKey = ++floaterKeyRef.current;
        // Tight: stagger floaters by 120ms so a chain of 4 catalyst
        // fires reads as four sequential reveals instead of four
        // overlapping +chips numbers stacking at the same Y. Wide
        // keeps the simultaneous-burst behavior (more space, clearer
        // spatial attribution per card).
        const now = performance.now();
        const launchAt = tight ? Math.max(now, floaterStaggerRef.current) : now;
        const delay = launchAt - now;
        if (tight) floaterStaggerRef.current = launchAt + FLOATER_STAGGER_MS;
        const launch = () => {
          setFloaters((fs) => [...fs, { key: floaterKey, catalystId, text, tone }]);
          track(() => {
            setFloaters((fs) => fs.filter((f) => f.key !== floaterKey));
          }, FLOATER_DURATION_MS);
        };
        if (delay > 0) track(launch, delay);
        else launch();
      }
    });
    return () => {
      off();
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [catalysts]);

  if (catalysts.length === 0) return null;

  // Set of catalyst ids that are currently half of an active resonance
  // pair. Used to draw a "linked" gold accent on the card so players
  // see synergies at a glance, not just on fire.
  const linkedIds = new Set<string>();
  for (const r of activeResonances(catalysts)) {
    linkedIds.add(r.a);
    linkedIds.add(r.b);
  }

  return (
    <div style={{
      position: 'absolute',
      // Stack from the bottom edge of TopBar (with breathing room) so
      // catalysts never disappear under TopBar when it wraps onto two
      // rows on narrow viewports.
      top: 'calc(var(--hud-top-h, 134px) + 8px)',
      left: 18,
      // Wide-mode (desktop landscape, ≥1280×760): turn the row into a
      // left rail so catalysts use the otherwise-empty side margin and
      // 6+ cards don't run off the play area horizontally.
      display: 'flex',
      flexDirection: wide ? 'column' : 'row',
      gap: 8, zIndex: Z.hud,
    }}>
      {catalysts.map((id, i) => {
        const c = lookupCatalyst(id);
        if (!c) return null;
        const pulseKind = pulsing[id];
        const showLastThrowWarn = id === 'last_throw' && roundActive && handsLeft === 1;
        const animation = showLastThrowWarn
          ? 'mat-telegraph-warn 1s ease-in-out infinite'
          : pulseKind === 'chain'
          ? `mat-chain-pulse ${PULSE_DURATION_MS}ms ease-out`
          : pulseKind === 'fire-legendary'
          ? `mat-pulse-fire-legendary ${PULSE_DURATION_LEGENDARY_MS}ms cubic-bezier(0.2, 1.2, 0.4, 1)`
          : pulseKind === 'fire'
          ? `mat-pulse-fire ${PULSE_DURATION_MS}ms cubic-bezier(0.2, 1.2, 0.4, 1)`
          : undefined;
        const isLegendary = c.rarity === 'legendary';
        const cardFloaters = floaters.filter((f) => f.catalystId === id);
        const cardRings = rings.filter((r) => r.catalystId === id);
        const edition = catalystEditions[id];
        const eColor = edition ? editionColor(edition) : null;
        // Holo edition gets the rainbow sweep already used for legendaries.
        // Foil gets a static rainbow border. Poly gets a chromatic-aberration
        // double-shadow on the icon. Legendary already shimmers; if it ALSO
        // has an edition, we just add the per-edition border accent.
        const showHolo = edition === 'holo' || isLegendary;
        const isLinked = linkedIds.has(id);
        const isVoid = edition === 'void';
        // Void edition wins the border slot — it's the most build-defining
        // edition and needs the strongest visual grammar. Cosmic-purple
        // double-pulse glow distinguishes it from poly's orange.
        const borderColor =
          isVoid && eColor ? eColor :
          edition === 'foil' && eColor ? eColor :
          edition === 'poly' && eColor ? eColor :
          isLegendary ? '#ff7847cc' :
          isLinked ? '#ffd84acc' :
          c.color + '80';
        const extraShadow =
          isVoid && eColor ? `0 0 22px ${eColor}cc, 0 0 44px ${eColor}66, ` :
          edition === 'foil' && eColor ? `0 0 18px ${eColor}88, ` :
          edition === 'poly' && eColor ? `0 0 14px ${eColor}88, ` :
          isLinked ? '0 0 12px rgba(255,216,74,0.55), ' :
          '';
        return (
          <div
            key={i}
            className="has-tip has-sell card-wobble"
            style={{ position: 'relative', animationDelay: `${(i * 230) % 1700}ms` }}
          >
            <SellButton kind="catalyst" id={id} index={i} variant="badge" />
            <div
              className={isLegendary ? 'legendary-aura legendary-aura-static' : undefined}
              style={{
                width: 64, height: 88, borderRadius: 8,
                background: `linear-gradient(180deg, ${c.color}25, rgba(15,9,37,0.85))`,
                border: `1px solid ${borderColor}`,
                boxShadow: isLegendary
                  ? undefined
                  : `${extraShadow}0 0 14px ${c.color}40, inset 0 0 10px ${c.color}20`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 4px',
                cursor: 'help',
                animation,
                position: 'relative',
                overflow: 'hidden',
              }}>
              {showHolo && (
                <>
                  <div className="ff-holo" />
                  <div className="ff-holo-shimmer" />
                </>
              )}
              <div className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.18em', color: '#bba8ff', position: 'relative', zIndex: 2 }}>catalyst</div>
              <div style={{
                position: 'relative', zIndex: 2,
                // Poly edition keeps its chromatic-aberration outer wrapper so
                // the silhouette + glyph both pick up the offset shadow.
                filter: edition === 'poly' && eColor
                  ? `drop-shadow(-1.5px 0 0 ${eColor}aa) drop-shadow(1.5px 0 0 ${c.color}aa)`
                  : undefined,
              }}>
                <KindFrame
                  kind="catalyst"
                  // Rarity drives the hexagon stroke + glow. Legendary
                  // already has the outer .legendary-aura on the tile, so
                  // we suppress the silhouette's own glow there.
                  rarity={isLegendary ? null : c.rarity ?? null}
                  size={42}
                >
                  {/* Icon stays in the catalyst's identity color so each
                      catalyst is recognizable independent of rarity. */}
                  <span style={{
                    color: c.color,
                    filter: `drop-shadow(0 0 6px ${c.color})`,
                  }}>{c.icon}</span>
                </KindFrame>
              </div>
              <div className="f-mono uc" style={{ fontSize: 7, letterSpacing: '0.14em', color: c.color, textAlign: 'center', lineHeight: 1.2, position: 'relative', zIndex: 2 }}>
                {c.name.split(' ').pop()}
              </div>
              {edition && eColor && (
                <div
                  className="f-mono uc"
                  style={{
                    position: 'absolute', top: 3, left: 3, zIndex: 3,
                    fontSize: edition === 'void' ? 9 : 7,
                    letterSpacing: '0.14em',
                    padding: '1px 3px', borderRadius: 3,
                    color: eColor,
                    background: 'rgba(15,9,37,0.85)',
                    border: `1px solid ${eColor}88`,
                    fontWeight: edition === 'void' ? 700 : undefined,
                    textShadow: edition === 'void' ? `0 0 6px ${eColor}` : undefined,
                  }}
                  title={`${edition} edition`}
                >
                  {edition === 'void' ? '★' : edition.slice(0, 3)}
                </div>
              )}
              {id === 'compounding_bias' && compoundingStacks > 0 && (
                <div style={{
                  position: 'absolute', top: 4, right: 4,
                  fontSize: 10, fontFamily: '"JetBrains Mono", monospace',
                  color: c.color, fontWeight: 700,
                  background: 'rgba(15,9,37,0.85)',
                  padding: '1px 4px', borderRadius: 4,
                  border: `1px solid ${c.color}80`,
                }}>
                  +{compoundingStacks}
                </div>
              )}
              {/* 2026-05-11 scaling pack — visible per-catalyst counters.
                  Same corner-badge style as compounding_bias. */}
              {(() => {
                const stack = catalystStacks[id];
                if (id === 'star_chart' && stack) return renderBadge(c.color, `+${(stack * 0.25).toFixed(2)}×`);
                if (id === 'lodestone' && stack) return renderBadge(c.color, `+${stack * 2}c`);
                if (id === 'comet_trail' && stack) return renderBadge(c.color, `+${stack * 10}c`);
                if (id === 'memento_star' && stack) return renderBadge(c.color, `+${(stack * 0.5).toFixed(1)}×`);
                if (id === 'ouroboros' && stack) return renderBadge(c.color, `+${stack * 3}m`);
                if (id === 'event_horizon' && stack) return renderBadge(c.color, `+${stack}%`);
                if (id === 'highwater' && stack) return renderBadge(c.color, `+${stack}m`);
                if (id === 'heirloom_locket' && stack) return renderBadge(c.color, `+${(stack * 0.15).toFixed(2)}×`);
                if (id === 'lunar_phases') return renderBadge(c.color, `${'●'.repeat(lunarPhase)}${'○'.repeat(8 - lunarPhase)}`);
                if (id === 'tide') return renderBadge(c.color, (handsPlayed % 2 === 0) ? 'ebb' : 'flow');
                return null;
              })()}
              {/* Mirrored Hand armed indicator — small star on the strip
                  edge when the player is holding 2+ palindrome catalysts.
                  Shown on every owned catalyst card for ambient visibility. */}
              {mirroredHandActive && i === 0 && (
                <div className="has-tip" style={{
                  position: 'absolute', top: -6, left: -6, zIndex: 4,
                  fontSize: 14, color: '#f5c451',
                  textShadow: '0 0 8px #f5c451, 0 0 14px rgba(245,196,81,0.6)',
                }}
                  title="Mirrored Hand armed — first hand of every blind retriggers."
                >
                  ⟁
                </div>
              )}
              {id === 'patience_counter' && (
                <div style={{
                  position: 'absolute', top: 4, right: 4,
                  fontSize: 9, fontFamily: '"JetBrains Mono", monospace',
                  color: c.color, fontWeight: 700,
                  background: 'rgba(15,9,37,0.85)',
                  padding: '1px 4px', borderRadius: 4,
                  border: `1px solid ${c.color}80`,
                }}>
                  {handsPlayed % 5}/5
                </div>
              )}
              {/* Awakening — visible once the catalyst has fired enough
                  times this run. Pure cosmetic in v1; mechanical
                  multipliers gated behind playtest data. */}
              {(() => {
                const fires = catalystFires[id] ?? 0;
                const threshold = awakeningThreshold(id);
                const awakened = isAwakened(id, fires);
                if (threshold == null) return null;
                return awakened ? (
                  <div className="awakened-badge has-tip" style={{
                    position: 'absolute', bottom: 4, right: 4, zIndex: 3,
                    fontSize: 11, fontWeight: 700,
                    color: '#f5c451',
                    textShadow: '0 0 8px #f5c451, 0 0 14px rgba(245,196,81,0.6)',
                    background: 'rgba(15,9,37,0.85)',
                    padding: '1px 4px', borderRadius: 4,
                    border: '1px solid #f5c451aa',
                  }}>★</div>
                ) : null;
              })()}
            </div>
            {/* Ring bursts emanate from the card center on each fire. Live
                outside the inner card div so overflow: hidden doesn't clip
                them as they expand. */}
            {cardRings.map((r) => (
              <div
                key={`r-${r.key}`}
                className="catalyst-fire-ring"
                style={{
                  position: 'absolute',
                  top: 44, left: 32,
                  width: 64, height: 64,
                  borderRadius: '50%',
                  border: `2px solid ${r.color}`,
                  boxShadow: `0 0 18px ${r.color}, 0 0 36px ${r.color}88`,
                  pointerEvents: 'none',
                  transformOrigin: 'center',
                  animation: `mat-fire-ring ${RING_DURATION_MS}ms cubic-bezier(0.15, 0.6, 0.3, 1) forwards`,
                  zIndex: 5,
                }}
              />
            ))}
            {/* Delta floaters — "+24" or "+1.5 mult" rises off the card. */}
            {cardFloaters.map((f) => (
              <div
                key={`f-${f.key}`}
                className="catalyst-floater f-mono"
                style={{
                  position: 'absolute',
                  left: 32, top: 18,
                  pointerEvents: 'none',
                  fontSize: f.tone === 'mult' ? 13 : 14,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  color: f.tone === 'mult' ? '#ff7847' : '#7be3ff',
                  textShadow: f.tone === 'mult'
                    ? '0 0 12px rgba(255,120,71,0.95), 0 0 24px rgba(255,120,71,0.55)'
                    : '0 0 12px rgba(123,227,255,0.95), 0 0 24px rgba(123,227,255,0.55)',
                  whiteSpace: 'nowrap',
                  animation: `catalyst-floater-up ${FLOATER_DURATION_MS}ms cubic-bezier(0.2, 1.0, 0.4, 1) forwards`,
                  zIndex: 6,
                }}
              >
                {f.text}
              </div>
            ))}
            <div className="tip">
              <span className="tip-title">{c.name}</span>
              {c.desc}
              {c.flavor && <span className="tip-flavor">{c.flavor}</span>}
              {/* Live "currently" line for the 2026-05-11 scaling pack so
                  the player can see what they've accrued without doing the
                  math in their head. */}
              {(() => {
                const stack = catalystStacks[id];
                let line: string | null = null;
                if (id === 'star_chart' && stack) line = `currently +${(stack * 0.25).toFixed(2)}× mult · ${stack} straights`;
                else if (id === 'lodestone' && stack) line = `currently +${stack * 2} chips · ${stack} pairs`;
                else if (id === 'comet_trail' && stack) line = `currently +${stack * 10} chips · ${stack}-blind streak`;
                else if (id === 'memento_star' && stack) line = `currently +${(stack * 0.5).toFixed(1)}× mult · ${stack} overflows`;
                else if (id === 'ouroboros' && stack) line = `currently +${stack * 3} mult · ${stack} loops`;
                else if (id === 'event_horizon' && stack) line = `currently +${stack}% mult · ${stack} big hits absorbed`;
                else if (id === 'highwater' && stack) line = `currently +${stack} mult · ${stack} personal bests`;
                else if (id === 'heirloom_locket' && stack) line = `currently +${(stack * 0.15).toFixed(2)}× mult · ${stack} blinds`;
                else if (id === 'lunar_phases') line = `phase ${lunarPhase}/8 · baked ×${(1 + lunarBaked).toFixed(2)}`;
                if (!line) return null;
                return (
                  <span style={{
                    display: 'block', marginTop: 6,
                    color: '#7be3ff',
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 10,
                  }}>
                    ◇ {line}
                  </span>
                );
              })()}
              {(catalystChips[id] ?? 0) > 0 && (
                <span style={{
                  display: 'block', marginTop: 6,
                  color: '#7be3ff',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 10,
                }}>
                  ◇ contributed +{Math.round(catalystChips[id] ?? 0).toLocaleString()} chips this run
                </span>
              )}
              {(() => {
                const fires = catalystFires[id] ?? 0;
                const threshold = awakeningThreshold(id);
                if (threshold == null) return null;
                const awakened = fires >= threshold;
                return (
                  <span style={{
                    display: 'block', marginTop: 4,
                    color: awakened ? '#f5c451' : '#bba8ff',
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 10,
                  }}>
                    {awakened
                      ? `★ Awakened — ${fires} fires this run`
                      : `Awakening: ${fires} / ${threshold} fires`}
                  </span>
                );
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
