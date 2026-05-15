import { useEffect, useState } from 'react';
import { useStore, type GameState } from '../../state/store';
import { dispatch } from '../../actions/dispatch';
import { lookupConsumable, consumableRarity } from '../../core/consumables';
import { hasDebuff } from '../../core/round/debuffs';
import { SellButton } from './SellButton';
import { Z } from './zLayers';
import { useIsWideMode, useIsTightStage } from '../hooks/useIsCompactStage';
import { KindFrame } from '../visual/upgradeKindFrames';
import { bus } from '../../events/bus';
import { EmptySlot } from './EmptySlot';

const selectConsumables = (s: GameState) => s.run.consumables;
const selectDiceCount = (s: GameState) => s.round.dice.length;
const selectConsumablesLocked = (s: GameState) => hasDebuff(s, 'consumables_locked');

export function ConsumableTray() {
  const items = useStore(selectConsumables);
  const diceCount = useStore(selectDiceCount);
  const wide = useIsWideMode();
  // Tight viewports anchor tooltips ABOVE the tray cards so the player's
  // thumb (which holds the card during long-press) doesn't cover the
  // tip. Mirrors the CatalystStrip treatment.
  const tight = useIsTightStage();
  const locked = useStore(selectConsumablesLocked);
  const [armed, setArmed] = useState<{ index: number; def: ReturnType<typeof lookupConsumable> } | null>(null);

  // Fade the tray during the scoring sequence — consumables are inert
  // mid-score (they can't be used until the hand resolves), and on
  // tight viewports the row competes with centered banners + the
  // ScoreBreakdown strip for horizontal space. Dimming both communicates
  // "you can't use these right now" AND reclaims visual attention for
  // the score celebration. Re-engages 400ms after the boom beat to let
  // the explosion finish before the tray pops back to full opacity.
  const [scoring, setScoring] = useState(false);
  useEffect(() => {
    const offCalc = bus.on('onScoreCalculated', () => setScoring(true));
    const offBeat = bus.on('onScoreBeat', ({ beat }) => {
      if (beat.kind === 'boom') {
        const t = window.setTimeout(() => setScoring(false), 400);
        return () => window.clearTimeout(t);
      }
    });
    return () => { offCalc(); offBeat(); };
  }, []);

  const onUse = (index: number) => {
    if (locked) return;
    const id = items[index];
    if (!id) return;
    const def = lookupConsumable(id);
    if (!def) return;
    if (def.requiresTarget) {
      setArmed({ index, def });
      return;
    }
    dispatch({ type: 'USE_CONSUMABLE', index });
  };

  const onTargetDie = (idx: number) => {
    if (!armed) return;
    dispatch({ type: 'USE_CONSUMABLE', index: armed.index, targets: [idx] });
    setArmed(null);
  };

  return (
    <>
      <div data-coach="consumable-tray" style={{
        position: 'absolute',
        // Mirrors the CatalystStrip on the opposite side; stack from
        // TopBar's bottom edge so the row never collides with a wrapped TopBar.
        top: 'calc(var(--hud-top-h, 134px) + 8px)',
        right: 18,
        // Wide-mode: vertical right rail to mirror the catalyst left rail.
        display: 'flex',
        flexDirection: wide ? 'column' : 'row',
        gap: 8, zIndex: Z.hud,
        pointerEvents: scoring ? 'none' : 'auto',
        opacity: scoring ? 0.35 : 1,
        transition: 'opacity 220ms ease',
      }}>
        {items.length === 0 && <EmptySlot kind="consumable" />}
        {items.map((id, i) => {
          const def = lookupConsumable(id);
          if (!def) return null;
          const color = def.type === 'calibration' ? '#bba8ff' : '#7be3ff';
          return (
            <div key={`${id}-${i}`} className="has-tip has-sell" style={{ position: 'relative' }}>
              <SellButton kind="consumable" id={id} index={i} variant="badge" />
              <button
                onClick={() => onUse(i)}
                className="tap"
                disabled={locked}
                style={{
                  width: 64, height: 88, borderRadius: 8,
                  background: 'linear-gradient(180deg, rgba(28,18,69,0.9), rgba(15,9,37,0.95))',
                  border: `1px dashed ${color}60`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 4px',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  color: '#dcd4ff',
                  opacity: locked ? 0.4 : 1,
                  filter: locked ? 'grayscale(0.7)' : 'grayscale(0)',
                  transition: 'opacity 120ms ease, filter 120ms ease',
                }}>
                <div className="f-mono uc" style={{
                  fontSize: 8, letterSpacing: '0.18em', color,
                }}>
                  {def.type}
                </div>
                <KindFrame
                  kind="consumable"
                  rarity={consumableRarity(def.type)}
                  size={42}
                >
                  <span style={{
                    color,
                    filter: `drop-shadow(0 0 6px ${color}80)`,
                  }}>{def.icon}</span>
                </KindFrame>
                {/* 9px is the floor for HUD chip text — the tray
                    label used to drop to 7px which fell below readable
                    on tight viewports. Letter-spacing trimmed slightly
                    so the label still fits the 64px slot at the higher
                    font size. */}
                <div className="f-mono uc" style={{
                  fontSize: 9, letterSpacing: '0.10em', color: '#dcd4ff',
                  textAlign: 'center', lineHeight: 1.1,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  width: '100%',
                }}>
                  {def.name}
                </div>
              </button>
              {/* Tight portrait: tip-above to clear the top of the play
                  area. Wide-mode landscape: tip-left so the popover
                  lands in the play area instead of running off the
                  right edge or covering the card below in the rail. */}
              <div className={tight ? 'tip tip-above' : wide ? 'tip tip-left' : 'tip'}>
                <span className="tip-title">{def.name}</span>
                {def.description}
                {def.requiresTarget && <span style={{ display: 'block', marginTop: 4, color: '#7be3ff' }}>Click, then pick a die.</span>}
              </div>
            </div>
          );
        })}
      </div>

      {armed && (
        <>
          {/* Full-stage backdrop catches stray taps so the player can't
              accidentally trigger the ActionBar while choosing a target.
              Tapping the backdrop cancels the armed state. */}
          <div
            onClick={() => setArmed(null)}
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(7,5,26,0.45)',
              pointerEvents: 'auto', zIndex: Z.modal,
              animation: 'fadein 160ms ease-out',
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Select a die for ${armed.def?.name ?? 'consumable'}`}
            style={{
              position: 'absolute',
              // Pinned just below the consumable tray row; tracks TopBar
              // height so the prompt doesn't ride up under TopBar on
              // narrow viewports.
              top: 'calc(var(--hud-top-h, 134px) + 100px)',
              left: '50%', transform: 'translateX(-50%)',
              padding: '14px 20px', borderRadius: 12,
              background: 'rgba(123,227,255,0.92)', color: '#0f0925',
              fontFamily: 'Cinzel, serif', fontSize: 14, fontWeight: 600,
              pointerEvents: 'auto', zIndex: Z.modalStrong,
              boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
              maxWidth: 'calc(100% - 48px)',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
              <span>select a die for {armed.def?.name}</span>
              <button
                onClick={() => setArmed(null)}
                className="tap"
                style={{
                  fontSize: 12, padding: '6px 12px', borderRadius: 6,
                  background: 'rgba(15,9,37,0.12)', border: '1px solid rgba(15,9,37,0.3)',
                  color: '#0f0925', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                cancel
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {Array.from({ length: diceCount }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => onTargetDie(i)}
                  className="tap"
                  aria-label={`Target die ${i + 1}`}
                  style={{
                    width: 44, height: 44, borderRadius: 8,
                    background: '#f3f0ff', color: '#0f0925',
                    fontFamily: 'Cinzel Decorative, serif', fontSize: 18,
                    border: '1px solid #9577ff', cursor: 'pointer',
                  }}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
