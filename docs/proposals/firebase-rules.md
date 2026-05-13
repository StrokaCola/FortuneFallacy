# Firebase Realtime DB security rules — proposal

Paired with `src-next/online/leaderboard.ts`. Apply by pasting
`docs/proposals/firebase.rules.json` into the Firebase Console →
Realtime Database → Rules tab and clicking **Publish**.

## Why this matters

Currently the database is open to the public for both read *and* write.
Anyone reading the source (or the network tab on the live site) can `POST`
arbitrary `{name, score, …}` payloads. With no rules in place, a flood of
junk submissions can:

- Push real high scores out of the visible window.
- Insert visually disruptive name strings (RTL marks, ZWJ, emoji of any size).
- Silently bloat the database past the free-tier quota.

The rules below close all three holes without requiring auth.

## What the rules enforce

1. **Anyone can read** — the leaderboard is public.
2. **Anyone can append a new entry, but every field is validated:**
   - `name`: 1–24 chars, no HTML/quote chars (defence in depth — the client
     also sanitises in `sanitizeLeaderboardName()`).
   - `score`: number between 0 and 10^12.
   - `mode`: matches `^run|endless|daily-YYYY-MM-DD$`.
   - `constellation`: 1–32 chars.
   - `date`: ms-epoch within ±24h of server time (rejects backfilled scores).
   - `version`: 1–16 chars (optional but enforced when present).
   - Any **unknown field** is rejected (`$other.validate: false`).
3. **Existing entries are immutable** — `".write": "!data.exists()"` forbids
   client-side overwrite or delete. Mod tools can still edit via the Firebase
   Console (admin SDK bypasses rules).
4. **`orderBy="score"` is indexed** so `fetchOnlineScores()` returns the
   highest-scored 200 entries instead of the most-recently-submitted 200.

## Optional next steps

When you wire Firebase anonymous auth (post-Steam):

- Change `".write": "!data.exists()"` to
  `".write": "auth != null && !data.exists()"`.
- Add a per-UID rate limit by writing to a sibling `submissions/$uid/` path
  with `.validate: now > root.child('submissions/' + auth.uid + '/last').val() + 5000`.
- Tag each entry with `auth.uid` for accountability.

## Anti-cheat horizon

These rules constrain *shape*, not *truthfulness*. Anyone can still POST a
score of `999999999` for a run they didn't play. The full anti-cheat answer
is the **action-log replay** capability proposed in the engineering /
live-ops sections of the studio review — submitted scores include the action
log, and any client (or a Cloudflare Worker) can replay it against the
seeded sim to verify the score was earned.
