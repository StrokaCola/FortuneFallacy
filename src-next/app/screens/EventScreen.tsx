// Event Screen (Pillar C) — renders the choice-driven encounter that
// occasionally replaces a non-boss Hub slot. Reads the active event id
// from the deterministic helper (same source the Hub uses), so the
// player sees the SAME event on the Hub card and on this screen.
//
// Layout: hero strip with glyph + name, prompt body, 2-3 choice
// buttons. Buttons grey out when costs aren't affordable.

import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { getEventForBlind, lookupEvent } from '../../data/events';
import { TopBar } from '../hud/TopBar';
import { OrnateFrame } from '../visual/OrnateFrame';
import { useIsTightStage } from '../hooks/useIsCompactStage';
import {
  selectAnte, selectGoalIdx, selectShards, selectScore, selectTarget,
  selectMaxCatalystSlots, selectEffectiveCatalystSlotsUsed,
  selectVouchers,
} from '../../state/selectors';

const selectSeed = (s: GameState) => s.run.seed;
const selectHandsLeft = (s: GameState) => s.round.handsLeft;
const selectRerollsLeft = (s: GameState) => s.round.rerollsLeft;

const accent = '#cc88ff';

export function EventScreen() {
  const ante = useStore(selectAnte);
  const goalIdx = useStore(selectGoalIdx);
  const seed = useStore(selectSeed);
  const shards = useStore(selectShards);
  const score = useStore(selectScore);
  const target = useStore(selectTarget);
  const handsLeft = useStore(selectHandsLeft);
  const rerollsLeft = useStore(selectRerollsLeft);
  const maxCatalysts = useStore(selectMaxCatalystSlots);
  const usedCatalystSlots = useStore(selectEffectiveCatalystSlotsUsed);
  const vouchers = useStore(selectVouchers);
  const tight = useIsTightStage();

  const eventId = getEventForBlind(seed, goalIdx, ante, false);
  const def = eventId ? lookupEvent(eventId) : undefined;
  if (!def) {
    // Defensive: if the player hit this screen without an active event
    // (e.g. via direct route on a non-event slot), bounce them back.
    setTimeout(() => dispatch({ type: 'SET_SCREEN', screen: 'hub' }), 0);
    return null;
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'auto',
      overflowY: 'auto', overflowX: 'hidden',
    }}>
      <TopBar
        ante={ante}
        blind="Event"
        shards={shards}
        hands={handsLeft}
        rerolls={rerollsLeft}
        target={target}
        score={score}
        catalystSlots={{ used: usedCatalystSlots, max: maxCatalysts }}
        voucherCount={vouchers.length}
        vouchers={vouchers}
        accent={accent}
      />
      <div style={{
        minHeight: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: tight ? 12 : 18,
        paddingTop: tight ? 'calc(var(--hud-top-h, 96px) + 8px)' : 'clamp(96px, 18vh, 150px)',
        paddingBottom: 32,
        paddingInline: 20,
      }}>
        <div className="f-mono uc" style={{
          fontSize: 11, color: accent, letterSpacing: '0.5em',
        }}>
          ◇ encounter ◇
        </div>
        <div className="f-display" style={{
          fontSize: 'clamp(22px, 5vw, 36px)', color: '#f3f0ff',
          textAlign: 'center',
        }}>
          <span style={{ marginRight: 12, fontSize: '1.2em' }}>{def.glyph}</span>
          {def.name}
        </div>
        <div className="panel-strong" style={{
          maxWidth: 640, width: '100%',
          padding: tight ? 14 : 22,
          borderRadius: 12,
          border: `1px solid ${accent}55`,
          background: 'linear-gradient(180deg, rgba(204,136,255,0.08), rgba(15,9,37,0.95))',
          boxShadow: `0 0 26px ${accent}33, 0 18px 40px rgba(0,0,0,0.45)`,
        }}>
          <OrnateFrame style={{ width: '100%', minHeight: 80 }} color={accent}>
            <div style={{
              padding: tight ? 14 : 22,
              fontFamily: '"Exo 2", sans-serif',
              fontSize: tight ? 13 : 15,
              color: '#f3f0ff',
              lineHeight: 1.55,
              textAlign: 'center',
              fontStyle: 'italic',
            }}>
              {def.prompt}
            </div>
          </OrnateFrame>
        </div>
        <div style={{
          display: 'flex',
          flexDirection: tight ? 'column' : 'row',
          gap: 12, flexWrap: 'wrap', justifyContent: 'center',
          maxWidth: 720, width: '100%',
        }}>
          {def.choices.map((choice, idx) => {
            const cost = choice.costs?.shards ?? 0;
            const affordable = shards >= cost;
            return (
              <button
                key={idx}
                type="button"
                disabled={!affordable}
                onClick={() => dispatch({ type: 'RESOLVE_EVENT_CHOICE', eventId: def.id, choiceIdx: idx })}
                className="btn-ghost mat-interactive"
                style={{
                  flex: tight ? '0 0 auto' : '1 1 220px',
                  minWidth: tight ? 0 : 220,
                  maxWidth: 320,
                  padding: tight ? 12 : 16,
                  borderRadius: 10,
                  background: affordable ? 'rgba(15,9,37,0.7)' : 'rgba(15,9,37,0.4)',
                  border: `1px solid ${affordable ? accent + '66' : 'rgba(122,111,166,0.3)'}`,
                  cursor: affordable ? 'pointer' : 'not-allowed',
                  opacity: affordable ? 1 : 0.55,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  textAlign: 'center',
                }}
              >
                <div className="f-mono uc" style={{
                  fontSize: 9, letterSpacing: '0.3em', color: accent,
                }}>
                  option {idx + 1}
                </div>
                <div className="f-display" style={{
                  fontSize: tight ? 13 : 15, color: '#f3f0ff',
                }}>
                  {choice.label}
                </div>
                {cost > 0 && (
                  <div className="f-mono" style={{
                    fontSize: 10, color: '#f5c451',
                  }}>
                    cost: {cost} ◆
                  </div>
                )}
                {choice.flavor && (
                  <div style={{
                    fontFamily: '"Exo 2", sans-serif',
                    fontSize: 11, color: '#bba8ff', opacity: 0.9,
                    fontStyle: 'italic',
                    lineHeight: 1.35,
                  }}>
                    {choice.flavor}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
