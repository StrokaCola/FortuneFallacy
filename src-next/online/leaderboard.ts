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

// Mode partitions the leaderboard. 'run' is the default standard run.
// 'daily-YYYY-MM-DD' is a daily-challenge entry; 'endless' is reserved for
// post-win endless mode. The Scores screen filters by mode prefix to show
// the right cohort.
export type LeaderboardMode = 'run' | 'endless' | `daily-${string}`;

export async function submitOnlineScore(
  name: string,
  score: number,
  constellation: string,
  mode: LeaderboardMode = 'run',
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
    // Daily runs submit under their dated mode so the global daily ladder
    // and the all-time ladder don't collide. One run can only land in one
    // bucket — daily wins the partition when both apply.
    const mode: LeaderboardMode = s.run.dailyDate
      ? `daily-${s.run.dailyDate}`
      : 'run';
    void submitOnlineScore(name, score, constellation, mode);
  });
}
