import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { buildScoreSequence } from '../../core/scoring/sequence';
import { runScoreSequence } from '../../app/hud/useScoreSequence';
import type { Beat, ScoreSequence } from '../../core/scoring/types';
import type { DevTab } from './index';

function ScoringTabView() {
  const [last, setLast] = useState<{ seq: ScoreSequence; emitted: Beat[] } | null>(null);

  useEffect(() => {
    const offSeq = bus.on('onScoreSequenceBuilt', ({ sequence }) => {
      setLast({ seq: sequence, emitted: [] });
    });
    const offBeat = bus.on('onScoreBeat', ({ beat }) => {
      setLast((prev) => prev ? { ...prev, emitted: [...prev.emitted, beat] } : prev);
    });
    return () => { offSeq(); offBeat(); };
  }, []);

  const replay = () => {
    if (!last) return;
    runScoreSequence(last.seq, (b) => bus.emit('onScoreBeat', { beat: b }));
  };

  const fakeFire = () => {
    const seq = buildScoreSequence(
      { faces: [6, 6, 6, 5, 5], comboLabel: 'FULL_HOUSE', comboBonus: 25,
        mults: [{ label: 'mult', value: 4 }, { label: 'chain', value: 2 }], finalTotal: 424 },
      { target: 100, isLastHand: false, maxRemaining: 1000, reducedMotion: false },
    );
    bus.emit('onScoreSequenceBuilt', { sequence: seq });
    runScoreSequence(seq, (b) => bus.emit('onScoreBeat', { beat: b }));
  };

  return (
    <div style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <strong>Tier:</strong> {last?.seq.tier ?? '—'}{' · '}
        <strong>Beats:</strong> {last?.seq.beats.length ?? 0}{' · '}
        <strong>Dur:</strong> {last?.seq.totalDurMs ?? 0}ms
      </div>
      <div style={{ marginBottom: 8 }}>
        <button onClick={fakeFire}>Fire test sequence</button>{' '}
        <button onClick={replay} disabled={!last}>Replay last</button>
      </div>
      <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #444' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th>t</th><th>kind</th><th>payload</th></tr></thead>
          <tbody>
            {last?.seq.beats.map((b, i) => (
              <tr key={i} style={{ background: last.emitted.includes(b) ? '#234' : 'transparent' }}>
                <td>{b.t}</td>
                <td>{b.kind}</td>
                <td style={{ opacity: 0.7 }}>{JSON.stringify(b).slice(0, 80)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const scoringTab: DevTab = {
  id: 'scoring',
  label: 'scoring',
  render: () => <ScoringTabView />,
};
