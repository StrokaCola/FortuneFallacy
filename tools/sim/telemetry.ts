// Captures bus events into per-blind summaries that the driver folds into
// each RunRecord. Subscribed once per run and unsubscribed at the end.

import { bus } from '../../src-next/events/bus';
import { store } from '../../src-next/state/store';
import type { RunRecord } from './driver';

export function attachTelemetry(record: RunRecord): () => void {
  const offBlind = bus.on('onBlindCleared', ({ blindId, ante, reward }) => {
    record.totalShardsEarned += reward.total;
    const s = store.getState();
    record.perBlind.push({
      ante,
      blindIdx: s.run.goalIdx - 1, // goalIdx already incremented in clearBlind
      blindId,
      isBoss: s.round.isBoss,
      target: s.round.target,
      score: s.round.score,
      handsUsed: s.round.handsMax - s.round.handsLeft,
      outcome: 'clear',
    });
  });
  const offRunEnd = bus.on('onRunEnded', ({ won, score, ante }) => {
    if (!won) {
      const s = store.getState();
      record.perBlind.push({
        ante,
        blindIdx: s.run.goalIdx,
        blindId: s.round.blindId ?? 'unknown',
        isBoss: s.round.isBoss,
        target: s.round.target,
        score,
        handsUsed: s.round.handsMax - s.round.handsLeft,
        outcome: 'bust',
      });
    }
  });
  return () => {
    offBlind();
    offRunEnd();
  };
}
