import { bus } from '../events/bus';
import { store } from '../state/store';

const FIREBASE_URL = 'https://fortunefallacy-9908c-default-rtdb.firebaseio.com/scores';

export type OnlineScore = { name: string; score: number; mode: string; date: number };

let cache: OnlineScore[] | null = null;
let fetchPromise: Promise<OnlineScore[]> | null = null;

export async function fetchOnlineScores(force = false): Promise<OnlineScore[]> {
  if (cache && !force) return cache;
  if (fetchPromise && !force) return fetchPromise;
  fetchPromise = (async () => {
    try {
      const res = await fetch(`${FIREBASE_URL}.json?orderBy="$key"&limitToLast=200`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Record<string, OnlineScore> | null;
      cache = data ? Object.values(data).sort((a, b) => b.score - a.score).slice(0, 10) : [];
      return cache;
    } catch (e) {
      console.warn('[leaderboard] fetch failed:', e);
      return [];
    } finally {
      fetchPromise = null;
    }
  })();
  return fetchPromise;
}

export async function submitOnlineScore(name: string, score: number, mode: 'run' | 'endless' = 'run'): Promise<void> {
  try {
    const res = await fetch(`${FIREBASE_URL}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, mode, date: Date.now() }),
    });
    if (!res.ok) {
      console.warn('[leaderboard] submit failed:', res.status);
      return;
    }
    cache = null;
  } catch (e) {
    console.warn('[leaderboard] submit error:', e);
  }
}

export function startLeaderboard(): () => void {
  return bus.on('onBlindCleared', ({ ante }) => {
    const s = store.getState();
    if (s.run.goalIdx >= 12 && s.round.score > 0) {
      const name = s.meta.playerName || 'Wanderer';
      void submitOnlineScore(name, s.round.score, 'run');
      void ante;
    }
  });
}
