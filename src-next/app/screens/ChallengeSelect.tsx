import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { ScreenHeader, ScreenWatermark } from '../visual/AstralPrimitives';
import { Sigil } from '../visual/Sigil';
import { CHALLENGES } from '../../data/challenges';
import { lookupConstellation } from '../../data/constellations';
import { lookupStake } from '../../data/stakes';

// Wave M — per-challenge glyph + accent. Each challenge id maps to a
// unicode glyph + tint so the row of cards differentiates at a glance
// instead of all reading as "another orange BEGIN button". Falls back
// to a neutral sigil if a new challenge ships without an entry.
const CHALLENGE_VISUALS: Record<string, { glyph: string; color: string }> = {
  silent_market: { glyph: '◌', color: '#bba8ff' }, // closed lips / no exchange
  cold_forge:    { glyph: '❄', color: '#7be3ff' }, // ice over the hammer
  one_breath:    { glyph: '◉', color: '#ff7847' }, // single ember
  austere:       { glyph: '⊞', color: '#f5c451' }, // capped grid
  siege:         { glyph: '▣', color: '#e2334a' }, // walled
};
const FALLBACK_VISUAL = { glyph: '◇', color: '#bba8ff' };

const selectChallengeWins = (s: GameState) => s.meta.challengeWins;

export function ChallengeSelect() {
  const wins = useStore(selectChallengeWins);

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'auto',
      overflow: 'auto', padding: '32px 24px',
    }}>
      <ScreenWatermark color="#ff4d6d" position="bottom-right">
        <Sigil kind="comet" size={220} color="#ff4d6d" />
      </ScreenWatermark>
      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <ScreenHeader title="Challenges" subtitle="◇ constraint runs ◇" />
          <div className="f-mono" style={{ fontSize: 11, color: '#bba8ff', marginTop: 4, opacity: 0.85 }}>
            Curated runs with handcrafted restrictions. Beat one to earn its badge.
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
          marginBottom: 22,
        }}>
          {CHALLENGES.map((ch) => {
            const won = wins.includes(ch.id);
            const constellation = lookupConstellation(ch.constellationId);
            const stake = lookupStake(ch.stakeId ?? 'spark');
            const visual = CHALLENGE_VISUALS[ch.id] ?? FALLBACK_VISUAL;
            return (
              <div
                key={ch.id}
                className="panel"
                style={{
                  padding: 16, borderRadius: 12,
                  border: `1px solid ${won ? '#f5c45166' : `${visual.color}40`}`,
                  background: 'rgba(15,9,37,0.65)',
                  display: 'flex', flexDirection: 'column', gap: 10,
                  position: 'relative',
                }}
              >
                {won && (
                  <span className="f-mono uc" style={{
                    position: 'absolute', top: 12, right: 12,
                    fontSize: 8, letterSpacing: '0.28em',
                    padding: '3px 7px', borderRadius: 4,
                    color: '#f5c451', background: 'rgba(245,196,81,0.15)',
                    border: '1px solid #f5c45166',
                  }}>
                    ✓ cleared
                  </span>
                )}
                {/* Per-challenge glyph header — differentiates the
                    row at a glance instead of relying on the name
                    alone. Color also tints the BEGIN button border. */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span aria-hidden style={{
                    fontSize: 28, lineHeight: 1,
                    color: visual.color,
                    textShadow: `0 0 12px ${visual.color}66`,
                    width: 36, textAlign: 'center',
                  }}>{visual.glyph}</span>
                  <div className="f-display" style={{ fontSize: 20, color: '#f3f0ff', flex: 1 }}>
                    {ch.name}
                  </div>
                </div>
                <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.22em', color: '#bba8ff' }}>
                  {constellation.name} · {stake.name}
                </div>
                <div style={{ fontSize: 12, color: '#bba8ff', fontStyle: 'italic', lineHeight: 1.4 }}>
                  {ch.flavor}
                </div>
                <ul style={{
                  margin: 0, paddingLeft: 18,
                  fontSize: 11, color: '#dcd4ff', lineHeight: 1.5,
                }}>
                  {ch.rules.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
                <div className="f-mono uc" style={{
                  fontSize: 9, letterSpacing: '0.24em', color: '#f5c451',
                  marginTop: 4,
                }}>
                  reward · {won ? 'badge cleared' : 'codex badge'}
                </div>
                <button
                  type="button"
                  className="btn btn-cta mat-interactive tap"
                  onClick={() => dispatch({
                    type: 'NEW_RUN',
                    constellationId: ch.constellationId,
                    stakeId: ch.stakeId ?? 'spark',
                    challengeId: ch.id,
                  })}
                  style={{ marginTop: 'auto', width: '100%', padding: '10px 14px', fontSize: 13 }}
                >
                  Begin Challenge
                </button>
              </div>
            );
          })}
        </div>

        {/* Wave R — challenge badge progress strip. Fills the empty
            band below the wrapped card grid with a "you've beaten N
            of M" stat so the screen has a goal post instead of dead
            space. Clean clear-all triggers a celebratory variant. */}
        <ChallengeProgressStrip won={wins.length} total={CHALLENGES.length} />

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button
            type="button"
            className="btn btn-ghost mat-interactive tap"
            style={{ width: 200 }}
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'title' })}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}

function ChallengeProgressStrip({ won, total }: { won: number; total: number }) {
  const all = won >= total;
  const ratio = total > 0 ? won / total : 0;
  return (
    <div style={{
      maxWidth: 420, margin: '24px auto 0',
      padding: '12px 22px', borderRadius: 12,
      border: `1px solid ${all ? 'rgba(245,196,81,0.55)' : 'rgba(149,119,255,0.3)'}`,
      background: 'rgba(15,9,37,0.6)',
      textAlign: 'center',
      boxShadow: all ? '0 0 22px rgba(245,196,81,0.18)' : undefined,
    }}>
      <div className="f-mono uc" style={{
        fontSize: 9, letterSpacing: '0.32em',
        color: all ? '#f5c451' : '#bba8ff',
      }}>
        {all ? '✦ every constraint cleared ✦' : '◇ codex badges earned ◇'}
      </div>
      <div className="f-display num" style={{
        fontSize: 22, color: '#f3f0ff', marginTop: 4,
      }}>
        {won} <span style={{ color: '#9577ff', fontSize: 16 }}>/ {total}</span>
      </div>
      <div style={{
        marginTop: 8, height: 3, borderRadius: 2,
        background: 'rgba(149,119,255,0.18)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${Math.round(ratio * 100)}%`,
          background: all
            ? 'linear-gradient(90deg, #f5c451, #ff8a5e)'
            : 'linear-gradient(90deg, #7be3ff, #c084fc)',
          boxShadow: all ? '0 0 10px rgba(245,196,81,0.6)' : undefined,
          transition: 'width 600ms ease-out',
        }} />
      </div>
    </div>
  );
}
