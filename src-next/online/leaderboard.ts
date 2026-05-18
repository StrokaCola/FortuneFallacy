import { bus } from '../events/bus';
import { store } from '../state/store';
import pkg from '../../package.json';

// URL is intentionally a public Realtime DB; the *real* security lives in
// the Firebase Realtime DB security rules - see
// docs/proposals/firebase.rules.json. Override locally via VITE_FIREBASE_URL
// when self-hosting / forking.
const FIREBASE_URL: string =
  (import.meta.env.VITE_FIREBASE_URL as string | undefined) ??
  'https://fortunefallacy-9908c-default-rtdb.firebaseio.com/scores_v2';

const APP_VERSION: string = (pkg as { version: string }).version;

export type OnlineScore = {
  name: string;
  score: number;
  mode: string;
  constellation: string;
  date: number;
  version?: string;
};

// Strip HTML/markup chars, ZWJ + bidi/RTL marks, control chars; collapse
// whitespace; cap length. React already escapes on display, so this is
// belt-and-suspenders against visual griefing on the Scores screen.
const NAME_MAX = 24;
// Build the regexes from string sources so this file stays pure ASCII -
// the corresponding code points are never embedded in the source text.
const RE_HTML = new RegExp('[<>&"\']', 'g');
const RE_BIDI = new RegExp('[\\u200B-\\u200F\\u202A-\\u202E\\u2066-\\u2069]', 'g');
const RE_CONTROL = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F]', 'g');
const RE_WS = /\s+/g;

export function sanitizeLeaderboardName(raw: string): string {
  const cleaned = raw
    .replace(RE_HTML, '')
    .replace(RE_BIDI, '')
    .replace(RE_CONTROL, '')
    .replace(RE_WS, ' ')
    .trim();
  return cleaned.slice(0, NAME_MAX) || 'Wanderer';
}

let cache: OnlineScore[] | null = null;
let fetchPromise: Promise<OnlineScore[]> | null = null;

export async function fetchOnlineScores(force = false): Promise<OnlineScore[]> {
  if (cache && !force) return cache;
  if (fetchPromise && !force) return fetchPromise;
  fetchPromise = (async () => {
    try {
      // orderBy="score" returns the highest-scored 200 entries instead of
      // the most-recently-submitted 200. Requires `".indexOn": "score"` on
      // the Firebase rules (see docs/proposals/firebase.rules.json).
      const res = await fetch(`${FIREBASE_URL}.json?orderBy="score"&limitToLast=200`);
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
        version: entry.version,
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
// post-win endless mode; 'lap-N' partitions endless runs by lap so deep
// runs aren't drowned in shallow-endless noise. The Scores screen
// filters by mode prefix to show the right cohort.
export type LeaderboardMode = 'run' | 'endless' | `daily-${string}` | `lap-${number}`;

export async function submitOnlineScore(
  name: string,
  score: number,
  constellation: string,
  mode: LeaderboardMode = 'run',
): Promise<void> {
  const safeName = sanitizeLeaderboardName(name);
  try {
    const res = await fetch(`${FIREBASE_URL}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: safeName,
        score,
        mode,
        constellation,
        date: Date.now(),
        version: APP_VERSION,
      }),
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
    // bucket — daily wins the partition when both apply, otherwise:
    //   * endlessLap > 0 → lap-N partition (Cosmic Lap leaderboards)
    //   * standard run → 'run'
    // 2026-05-18 P4: lap-N partition added so deep endless runs get
    // their own cohort. Without this, a lap-7 score competes against
    // lap-1 scores on the global 'run' ladder, drowning the long-tail
    // achievement.
    const lapNow = s.run.endlessLap ?? 0;
    const mode: LeaderboardMode = s.run.dailyDate
      ? `daily-${s.run.dailyDate}`
      : (lapNow > 0 ? `lap-${lapNow}` : 'run');
    void submitOnlineScore(name, score, constellation, mode);
  });
}
