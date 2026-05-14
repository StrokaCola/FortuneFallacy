# Toast queue — architecture + migration guide

The studio review (`docs/company-review-2026-05-13.md`, Dept 6 — UX/UI
Design) flagged **toast inflation**: nine distinct toast components,
each portalling its own JSX, with no central scheduling. A score-clear
moment could plausibly fire four toasts within a 2-second window:
shard gain → achievement → resonance → arrival. The recommended fix
was a single queue with priority, throttle, and same-key merging.

This document describes the queue's architecture and the pattern for
migrating an existing toast onto it.

## Architecture

```
app/hud/toastQueue/
  types.ts             ToastDescriptor, ToastPriority, QueueState, EMPTY_STATE,
                       PRIORITY_RANK, QUEUE_LIMITS
  reducer.ts           Pure (state, action) => state reducer. Tested in reducer.test.ts.
  queue.ts             Module-level singleton + createQueue() factory. push/dismiss/tick
                       wrappers. Subscribe API for React.
  useToastQueue.ts     useSyncExternalStore hook + useToastTicker effect-runner.
  ToastHost.tsx        Renders the queue's visible slots top-center. Mounted in App.tsx.
  index.ts             Public surface.
```

The queue is a singleton living outside React. Components push via
`pushToast(...)`; the host subscribes and re-renders when visible
state changes. Tests can `createQueue()` for isolation.

### Invariants enforced by the reducer

| Rule | Why |
|---|---|
| `visible.length <= 2` (`QUEUE_LIMITS.MAX_VISIBLE`) | Two notifications at once is the most a player can track without cognitive overload. |
| Inter-promotion throttle ≥ 600ms (`MIN_PROMOTION_INTERVAL_MS`) | Rapid bursts read as a *sequence* rather than a wall of text. |
| Expiry-driven promotions bypass the throttle | A freed slot fills immediately, not 600ms after the previous push. |
| Same-key incoming → run `merge` reducer | Coalesces "+5 shards" + "+3 shards" into "+8 shards" instead of two pops. |
| Pending sorted by priority | `critical < high < normal < low`. Same priority is FIFO. |
| At most one promotion per `TICK` action | Throttle observability — even when multiple slots are free. |

### Anatomy of a `ToastDescriptor`

```ts
type ToastDescriptor<TData = unknown> = {
  id: string;                  // unique per push (React key)
  key?: string;                // optional grouping key (enables merge)
  priority: ToastPriority;     // 'critical' | 'high' | 'normal' | 'low'
  durationMs: number;          // visible time once promoted
  data: TData;                 // structured payload (read by render + merge)
  render: (data: TData) => ReactNode;
  merge?: (incoming: TData, current: TData) => TData;
};
```

Push from anywhere:

```ts
import { pushToast } from '../app/hud/toastQueue';

pushToast<{ amount: number }>({
  id: `shards-${Date.now()}`,
  key: 'shard-gain',
  priority: 'low',
  durationMs: 1100,
  data: { amount: 5 },
  render: ({ amount }) => <span>+{amount} ◇</span>,
  merge: (a, b) => ({ amount: a.amount + b.amount }),
});
```

## Migration pattern

The repository has ~10 toast-shaped components. Migrating each one
follows the same recipe.

### Before

```tsx
export function FooToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Set<Timeout>>(new Set());

  useEffect(() => {
    const off = bus.on('onFoo', (payload) => {
      const id = nextId++;
      setToasts((t) => [...t, { id, payload }]);
      const timer = setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
        timersRef.current.delete(timer);
      }, DURATION_MS);
      timersRef.current.add(timer);
    });
    return () => { off(); /* clear timers */ };
  }, []);

  return (
    <>
      {toasts.map((t) => <div key={t.id} style={{ position: 'absolute', ... }}>{t.payload.label}</div>)}
    </>
  );
}
```

### After

```tsx
type FooData = { label: string };

function renderFoo({ label }: FooData) {
  return <div style={{ /* same content styling */ }}>{label}</div>;
}

export function FooToast() {
  useEffect(() => {
    const off = bus.on('onFoo', (payload) => {
      pushToast<FooData>({
        id: `foo-${Date.now()}`,
        key: 'foo',                       // optional; enables merge
        priority: 'normal',
        durationMs: DURATION_MS,
        data: { label: payload.label },
        render: renderFoo,
        merge: payload.coalesce ? (a, b) => ({ label: `${a.label}, ${b.label}` }) : undefined,
      });
    });
    return () => off();
  }, []);

  return null;
}
```

### Migration checklist

1. **Drop the internal `useState<Toast[]>` and `timersRef`.** The queue owns visibility lifecycle.
2. **Drop the JSX `<>{toasts.map(...)}</>` block.** Return `null` from the component. The central `ToastHost` renders.
3. **Move the styled `<div>` into a top-level `renderFoo(data)` function.** It receives the descriptor's `data` argument; nothing else from component scope.
4. **Replace `setToasts((t) => [...t, ...])` with `pushToast(...)`.** Pick a priority + duration + optional `key` / `merge`.
5. **Keep side effects that aren't UI (SFX, haptics) inline.** Only the *visual* notification moves into the queue.
6. **Decide the `key` policy:**
   - **Unique key** (`shard-gain`, `shard-deduct`, `resonance-{pair-id}`) — events that benefit from coalescing.
   - **No key** — one-shot events that should each get their own toast (achievement unlocks, daily login).

### Positioning

The default `ToastHost` stacks toasts top-center under the TopBar. If
a toast needs a custom anchor (e.g. right of the treasury panel for
the shard pills), the cleanest path is to make `render` return a
`position: absolute` element with its own coordinates — the host's
flex wrapper won't constrain it.

For the first migration pass we accept the top-center layout
trade-off: rapid bursts now coalesce into one toast, which makes the
exact pixel position less precious.

## Current migration status

| Component | Status | Notes |
|---|---|---|
| `ShardGainToast` | ✅ migrated | Coalesces rapid gains into a single `+N ◇`. `key='shard-gain'`, `priority='low'`. |
| `ShardDeductToast` | ✅ migrated | Coalesces `shard_sink` fires. `key='shard-deduct'`, `priority='low'`. |
| `SellTriggerToast` | ✅ migrated | One descriptor per on-sell fire. `priority='normal'`, no `key` (each fire is its own beat). |
| `ArrivalToast` | ✅ migrated | Single one-shot on portal entry. `priority='low'`; click-to-dismiss preserved via `toastQueue.dismiss(id)`. |
| `AchievementToast` | ✅ migrated | `priority='high'` so it preempts shard pills. Bespoke internal queue removed — central queue handles serialisation. SFX (chime + delayed swell) stays inline because it's per-event, not per-toast. |
| `WhisperToast` | ✅ migrated | Per-session + per-save dedupe preserved. Sigil-flash + `whisper-toast-in` keyframes still applied via `style.animation`. `priority='normal'`. |
| `ResonanceToast` | ✅ migrated | `key='resonance:{pair-id}'` so a re-fire refreshes the visible window. Discovery vs everyday-fire flavors distinguished by `data.isDiscovery`; merge OR-folds the flag so a discovery always wins permanently. `priority='high'` for discoveries, `'normal'` for fires. |
| `ClearShardsToast` | 🔘 not in queue | True UI panel (mid-stage receipt of base/voucher/hands/interest/total breakdown), single-instance, fixed position. Not a stackable notification — keeps its own lifecycle. |
| `DailyLoginComet` | 🔘 not in queue | Full-screen FX (CSS `daily-comet` keyframe), `inset: 0`, `pointerEvents: none`. Not a notification at all; keeps its own lifecycle. |
| `AuditEvent` | 🔘 not in queue | Full event card (173 lines) with embedded action UI. Not a stackable pop; keeps its own lifecycle. |

**7 of 10 toast-shaped components now flow through the queue.** The
remaining 3 are intentional carve-outs: each is a fixed-position
single-instance panel with a custom lifecycle, not a stackable
notification competing for the same attention slot.

## Testing

`reducer.test.ts` covers the pure-function reducer comprehensively
(push, tick, dismiss, priority sort, merge-into-visible,
merge-into-pending, throttle, expiry-bypass, MAX_VISIBLE cap). React
integration is not unit-tested — verify by running the game and
firing real events.

## Future work

- Pause the queue while the screen is `paused` so the resume moment
  doesn't dump a backlog of toasts at the player.
- Add a Settings preference for "max simultaneous toasts" so
  cognitive-accessibility players can drop it to 1.
- Expose a "Recent notifications" review surface (a press-and-hold
  bell icon?) so a player can see what just happened if they missed
  a toast.
