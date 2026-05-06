import { useEffect, useRef, useState } from 'react';
import { useStore, type GameState } from '../../state/store';
import { lookupCatalyst } from '../../data/catalysts';
import { bus } from '../../events/bus';
import { SellButton } from './SellButton';
import { editionColor } from '../../core/upgrades/editions';

// Stable fallback so the selector doesn't return a fresh object on every
// snapshot read (which tear-loops useSyncExternalStore).
const EMPTY_EDITIONS: Record<string, never> = {};
const selectCatalysts = (s: GameState) => s.run.catalysts;
const selectCatalystEditions = (s: GameState) => s.run.catalystEditions ?? EMPTY_EDITIONS;
const selectCompoundingStacks = (s: GameState) => s.run.compoundingStacks;
const selectHandsPlayed = (s: GameState) => s.run.handsPlayed;
const selectHandsLeft = (s: GameState) => s.round.handsLeft;
const selectActive = (s: GameState) => s.round.active;

const PULSE_DURATION_MS = 320;
const CHAIN_PULSE_STEP_MS = 80;

export function CatalystStrip() {
  const catalysts = useStore(selectCatalysts);
  const catalystEditions = useStore(selectCatalystEditions);
  const compoundingStacks = useStore(selectCompoundingStacks);
  const handsPlayed = useStore(selectHandsPlayed);
  const handsLeft = useStore(selectHandsLeft);
  const roundActive = useStore(selectActive);

  const [pulsing, setPulsing] = useState<Record<string, 'fire' | 'chain' | undefined>>({});
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

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

    const off = bus.on('onUpgradeTriggered', (payload: { id: string }) => {
      const id = payload.id;
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
      if (catalysts.includes(id)) {
        setPulsing((s) => ({ ...s, [id]: 'fire' }));
        track(() => {
          setPulsing((s) => ({ ...s, [id]: undefined }));
        }, PULSE_DURATION_MS);
      }
    });
    return () => {
      off();
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [catalysts]);

  if (catalysts.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      // Stack from the bottom edge of TopBar (with breathing room) so
      // catalysts never disappear under TopBar when it wraps onto two
      // rows on narrow viewports.
      top: 'calc(var(--hud-top-h, 134px) + 8px)',
      left: 18,
      display: 'flex', gap: 8, zIndex: 4,
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
          : pulseKind === 'fire'
          ? `mat-pulse-fire ${PULSE_DURATION_MS}ms ease-out`
          : undefined;
        const isLegendary = c.rarity === 'legendary';
        const edition = catalystEditions[id];
        const eColor = edition ? editionColor(edition) : null;
        // Holo edition gets the rainbow sweep already used for legendaries.
        // Foil gets a static rainbow border. Poly gets a chromatic-aberration
        // double-shadow on the icon. Legendary already shimmers; if it ALSO
        // has an edition, we just add the per-edition border accent.
        const showHolo = edition === 'holo' || isLegendary;
        const borderColor =
          edition === 'foil' && eColor ? eColor :
          edition === 'poly' && eColor ? eColor :
          isLegendary ? '#ff7847cc' : c.color + '80';
        const extraShadow =
          edition === 'foil' && eColor ? `0 0 18px ${eColor}88, ` :
          edition === 'poly' && eColor ? `0 0 14px ${eColor}88, ` :
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
                fontSize: 28, color: c.color,
                filter: edition === 'poly' && eColor
                  ? `drop-shadow(-1.5px 0 0 ${eColor}aa) drop-shadow(1.5px 0 0 ${c.color}aa) drop-shadow(0 0 6px ${c.color})`
                  : `drop-shadow(0 0 6px ${c.color})`,
                position: 'relative', zIndex: 2,
              }}>{c.icon}</div>
              <div className="f-mono uc" style={{ fontSize: 7, letterSpacing: '0.14em', color: c.color, textAlign: 'center', lineHeight: 1.2, position: 'relative', zIndex: 2 }}>
                {c.name.split(' ').pop()}
              </div>
              {edition && eColor && (
                <div
                  className="f-mono uc"
                  style={{
                    position: 'absolute', top: 3, left: 3, zIndex: 3,
                    fontSize: 7, letterSpacing: '0.14em',
                    padding: '1px 3px', borderRadius: 3,
                    color: eColor,
                    background: 'rgba(15,9,37,0.85)',
                    border: `1px solid ${eColor}88`,
                  }}
                  title={`${edition} edition`}
                >
                  {edition.slice(0, 3)}
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
            </div>
            <div className="tip">
              <span className="tip-title">{c.name}</span>
              {c.desc}
              {c.flavor && <span className="tip-flavor">{c.flavor}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
