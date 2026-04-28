import { useEffect, useRef, useState } from 'react';
import { useStore, type GameState } from '../../state/store';
import { lookupCatalyst } from '../../data/catalysts';
import { bus } from '../../events/bus';

const selectCatalysts = (s: GameState) => s.run.catalysts;
const selectCompoundingStacks = (s: GameState) => s.run.compoundingStacks;
const selectHandsPlayed = (s: GameState) => s.run.handsPlayed;
const selectHandsLeft = (s: GameState) => s.round.handsLeft;
const selectActive = (s: GameState) => s.round.active;

const PULSE_DURATION_MS = 320;
const CHAIN_PULSE_STEP_MS = 80;

export function CatalystStrip() {
  const catalysts = useStore(selectCatalysts);
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
      position: 'absolute', top: 142, left: 18,
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
        return (
          <div key={i} className="has-tip" style={{ position: 'relative' }}>
            <div style={{
              width: 64, height: 88, borderRadius: 8,
              background: `linear-gradient(180deg, ${c.color}25, rgba(15,9,37,0.85))`,
              border: `1px solid ${c.color}80`,
              boxShadow: `0 0 14px ${c.color}40, inset 0 0 10px ${c.color}20`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 4px',
              cursor: 'help',
              animation,
            }}>
              <div className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.18em', color: '#bba8ff' }}>catalyst</div>
              <div style={{ fontSize: 28, color: c.color, filter: `drop-shadow(0 0 6px ${c.color})` }}>{c.icon}</div>
              <div className="f-mono uc" style={{ fontSize: 7, letterSpacing: '0.14em', color: c.color, textAlign: 'center', lineHeight: 1.2 }}>
                {c.name.split(' ').pop()}
              </div>
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
            <div className="tip">{c.desc}</div>
          </div>
        );
      })}
    </div>
  );
}
