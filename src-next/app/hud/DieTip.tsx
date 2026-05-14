import { useEffect, useState } from 'react';
import { useStore, type GameState } from '../../state/store';
import { dispatch } from '../../actions/dispatch';
import { lookupMod } from '../../core/mods';
import { ModIcon } from '../visual/ModIcon';
import { editionColor, editionLabel } from '../../core/upgrades/editions';
import { describeFace, WILD_SENTINEL } from '../../core/run/faceReadable';
import { formatModStackLabel } from './modStackLabel';
import { Z } from './zLayers';

// Long-press info tooltip for in-round 3D dice.
//
// Dice live in a WebGL canvas (Dice3D) and can't carry the `.has-tip` class
// the HTML long-press system uses. Instead, Dice3D detects a 450ms hold on a
// die's raycast hit and dispatches SHOW_DIE_TIP with the die's projected
// screen coords; this component reads that UI state and renders a sticky
// chip-style tooltip near the die.

const selectDieTip = (s: GameState) => s.ui.dieTip;
const selectDice = (s: GameState) => s.round.dice;
const selectDiceMods = (s: GameState) => s.run.diceMods;
const selectDiceModEditions = (s: GameState) => s.run.diceModEditions;
const EMPTY_STACKS: number[][] = [];
const selectDiceModStacks = (s: GameState) => s.run.diceModStacks ?? EMPTY_STACKS;

// Vertical pixel offset from the die center to the tooltip's anchor edge.
// Picks up the die radius + a small gap so the tip floats clear of the
// rolling pip.
const ANCHOR_GAP_PX = 70;

export function DieTip() {
  const tip = useStore(selectDieTip);
  const dice = useStore(selectDice);
  const diceMods = useStore(selectDiceMods);
  const diceModEditions = useStore(selectDiceModEditions);
  const diceModStacks = useStore(selectDiceModStacks);

  // Re-render on viewport resize so the flip-above check uses the current
  // window height. Resize fires on orientation change too.
  const [vh, setVh] = useState<number>(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight,
  );
  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!tip) return null;
  const die = dice[tip.dieIdx];
  if (!die) return null;

  const mods = diceMods[tip.dieIdx] ?? [];
  const eds = diceModEditions[tip.dieIdx] ?? [];
  const stacks = diceModStacks[tip.dieIdx] ?? [];

  // Flip above the die when the anchor would push the tip off-screen below.
  // Rough estimate: the chip block is ~140-180px tall depending on mod count;
  // we leave 120px headroom which is generous on the smallest phones.
  const flipBelow = tip.screenY < 200;
  const topPx = flipBelow
    ? tip.screenY + ANCHOR_GAP_PX
    : tip.screenY - ANCHOR_GAP_PX;
  const translateY = flipBelow ? '0%' : '-100%';

  const isWild = die.face === WILD_SENTINEL;

  return (
    <div
      role="tooltip"
      onClick={(e) => {
        // Tapping the tip itself dismisses it (mirrors the .has-tip behavior
        // where any click clears stickiness). Stop propagation so the tap
        // doesn't bubble to the dice canvas and toggle the lock.
        e.stopPropagation();
        dispatch({ type: 'HIDE_DIE_TIP' });
      }}
      style={{
        position: 'fixed',
        left: tip.screenX,
        top: topPx,
        transform: `translate(-50%, ${translateY})`,
        zIndex: Z.dieTip,
        pointerEvents: 'auto',
        minWidth: 180,
        maxWidth: 280,
        padding: '8px 10px',
        background: 'rgba(7,5,26,0.95)',
        border: '1px solid rgba(149,119,255,0.4)',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        animation: 'fadein 120ms ease-out',
      }}
      data-die-tip
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="f-mono uc" style={{
          fontSize: 9, letterSpacing: '0.28em', color: '#9577ff',
          padding: '2px 6px', border: '1px solid #9577ff66', borderRadius: 4,
        }}>
          d{tip.dieIdx + 1}
        </span>
        <span className="f-mono uc" style={{
          fontSize: 9, letterSpacing: '0.24em',
          color: die.locked ? '#7be3ff' : '#6a6080',
        }}>
          {die.locked ? 'held' : 'free'}
        </span>
      </div>
      <div className="f-display num" style={{
        fontSize: 28, lineHeight: 1, textAlign: 'center',
        color: isWild ? '#f5c451' : '#f3f0ff',
        textShadow: isWild ? '0 0 12px #f5c451' : 'none',
      }}>
        {describeFace(die.face)}
      </div>
      {mods.length === 0 ? (
        <div className="f-mono" style={{ fontSize: 10, color: '#6a6080', fontStyle: 'italic', textAlign: 'center' }}>
          no mods
        </div>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6,
          paddingTop: 4, borderTop: '1px solid rgba(149,119,255,0.18)',
        }}>
          {mods.map((mid, j) => {
            const m = lookupMod(mid);
            const ed = eds[j];
            const eC = ed ? editionColor(ed) : null;
            const accent = m?.visual?.accentColor ?? '#bba8ff';
            const stackLabel = m ? formatModStackLabel(m, stacks[j] ?? 0) : null;
            return (
              <div key={j} style={{
                display: 'flex', flexDirection: 'column', gap: 2,
                padding: '4px 6px', borderRadius: 4,
                background: `${accent}10`, border: `1px solid ${accent}33`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <ModIcon modId={mid} fallbackChar={m?.icon ?? '⫶'} color={accent} size={13} />
                    <span className="f-mono uc" style={{
                      fontSize: 9.5, letterSpacing: '0.18em', color: accent,
                    }}>
                      {m?.name ?? mid}
                    </span>
                    {eC && (
                      <span className="f-mono uc" style={{
                        fontSize: 8, letterSpacing: '0.18em', color: eC,
                        padding: '1px 4px', border: `1px solid ${eC}55`, borderRadius: 2,
                      }}>
                        {editionLabel(ed!)}
                      </span>
                    )}
                  </div>
                  {stackLabel && (
                    <span className="f-mono num" style={{
                      fontSize: 9, color: '#f5c451',
                    }}>
                      {stackLabel}
                    </span>
                  )}
                </div>
                {m?.desc && (
                  <div style={{
                    fontSize: 10, lineHeight: 1.35, color: '#cbc4e6',
                    fontFamily: '"Exo 2", sans-serif',
                  }}>
                    {m.desc}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
