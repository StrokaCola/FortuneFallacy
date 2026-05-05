import { bus } from '../events/bus';
import { store } from '../state/store';

const FIREBASE_URL = 'https://fortunefallacy-9908c-default-rtdb.firebaseio.com/scores_v2';

export type OnlineScore = {
  name: string;
  score: number;
  mode: string;
  constellation: string;
  date: number;
};

let cache: OnlineScore[] | null = null;
let fetchPromise: Promise<OnlineScore[]> | null = null;

export async function fetchOnlineScores(force = false): Promise<OnlineScore[]> {
  if (cache && !force) return cache;
  if (fetchPromise && !force) return fetchPromise;
  fetchPromise = (async () => {
    try {
      const res = await fetch(`${FIREBASE_URL}.json?orderBy="$key"&limitToLast=200`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Record<string, Partial<OnlineScore>> | null;
      if (!data) {
        cache = [];
        return cache;
      }
      cache = Object.values(data).map((entry) => ({
        name: entry.name ?? 'anon',
        score: entry.score ?? 0,
        mode: entry.mode ?? 'run',
        constellation: entry.constellation ?? 'lyra',
        date: entry.date ?? 0,
      }));
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

export async function submitOnlineScore(
  name: string,
  score: number,
  constellation: string,
  mode: 'run' | 'endless' = 'run',
): Promise<void> {
  try {
    const res = await fetch(`${FIREBASE_URL}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, mode, constellation, date: Date.now() }),
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
  return bus.on('onRunEnded', ({ score, constellation }) => {
    if (score <= 0) return;
    const s = store.getState();
    const name = s.meta.playerName || 'Wanderer';
    void submitOnlineScore(name, score, constellation, 'run');
  });
}
