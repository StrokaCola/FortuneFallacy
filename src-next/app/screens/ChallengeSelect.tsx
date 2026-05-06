import { dispatch } from '../../actions/dispatch';
import { useStore, type GameState } from '../../state/store';
import { CHALLENGES } from '../../data/challenges';
import { lookupConstellation } from '../../data/constellations';
import { lookupStake } from '../../data/stakes';

const selectChallengeWins = (s: GameState) => s.meta.challengeWins;

export function ChallengeSelect() {
  const wins = useStore(selectChallengeWins);

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'auto',
      overflow: 'auto', padding: '32px 24px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div className="f-mono uc" style={{ fontSize: 11, color: '#7be3ff', letterSpacing: '0.5em' }}>
            ◇ constraint runs ◇
          </div>
          <div className="f-display" style={{
            fontSize: 40, color: '#f3f0ff', marginTop: 4,
            textShadow: '0 0 30px rgba(123,227,255,0.4)',
          }}>
            Challenges
          </div>
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
            return (
              <div
                key={ch.id}
                className="panel"
                style={{
                  padding: 16, borderRadius: 12,
                  border: `1px solid ${won ? '#f5c45166' : 'rgba(149,119,255,0.25)'}`,
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
                <div className="f-display" style={{ fontSize: 20, color: '#f3f0ff' }}>
                  {ch.name}
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
                  className="btn btn-primary mat-interactive tap"
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
