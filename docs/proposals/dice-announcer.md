# Proposal: `<DiceAnnouncer>` — screen-reader announcement for dice + scoring

**Status:** stubbed — skipped from the studio-review quick-wins batch by
direction (the announcement copy is a player-voice decision; deserves
a tuned authorial pass before shipping).

**Owner:** accessibility / UX.
**Effort:** ~1 hour for the component + wiring; ~1 day if you want to
nail the announcement strings across all combos and catalyst procs.

## The problem

For a dice game, the literal core experience is: dice settle, the player
reads what landed, decides what to lock. The 4 existing `aria-live`
regions in the project (`SellTriggerToast`, `TopBar`, `SoundCaptions`,
`Scores`) cover housekeeping events but *not the dice themselves*.

A screen-reader user playing FortuneFallacy today hears:
- The physics/clatter SFX (great).
- A caption strip describing what sounds played (good).
- Toast for sell/score events (good).

…but **never** the actual dice values. The most important moment of the
game is silent to assistive tech.

## The fix

A new component `app/hud/DiceAnnouncer.tsx` (~80 lines) that:

1. Subscribes to the existing `onRollSettled` event on the bus.
2. Formats a sentence describing the result.
3. Pushes the sentence into an `aria-live="polite"` div (visually hidden
   but read by screen readers).

Same for `onScoreCalculated` — announce the resulting combo + chips +
mult + total.

## Sketch

```tsx
// src-next/app/hud/DiceAnnouncer.tsx
import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';

function diceSentence(faces: number[], comboName?: string): string {
  if (!faces.length) return 'No dice settled.';
  const list = faces.join(', ');
  return comboName
    ? `Dice settled: ${list}. ${comboName} detected.`
    : `Dice settled: ${list}.`;
}

function scoreSentence(combo: string, chips: number, mult: number, total: number): string {
  return `${combo} scored. ${chips} chips, multiplier ${mult}. Total ${total}.`;
}

export function DiceAnnouncer() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const offRoll = bus.on('onRollSettled', (p) => {
      setMsg(diceSentence(p.faces, p.combo?.name));
    });
    const offScore = bus.on('onScoreCalculated', (p) => {
      setMsg(scoreSentence(p.comboName ?? 'Hand', p.chips, p.mult, p.total));
    });
    return () => { offRoll(); offScore(); };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        width: 1, height: 1, margin: -1, padding: 0,
        clip: 'rect(0 0 0 0)', overflow: 'hidden', whiteSpace: 'nowrap',
      }}
    >
      {msg}
    </div>
  );
}
```

Mount in `Round.tsx` alongside the existing HUD.

## Authorial decisions to make before shipping

1. **Voice register** — terse ("4, 5, 5, 6, 6 — Two Pair") or narrative
   ("The dice settle: a 4, two 5s, two 6s — a Two Pair appears")? The
   FortuneFallacy fiction is *cosmic-indifference*; the announcer should
   match.
2. **Catalyst procs** — should the announcer narrate "Stratifier fires:
   Full House mult times two" each time? That's high-fidelity but can
   become noisy on a chained scoring hand. Throttle / batch.
3. **Voidstorm + boss debuff awareness** — when active, should the
   announcer prefix the dice-settle line with the active modifier?
4. **Performance** — `aria-live="polite"` queues; an aggressive
   announcer firing 6+ messages in a 2-second scoring sequence will
   read for ~30 seconds. Need throttling / coalescing — see UX dept's
   "Toast Queue" recommendation; this should share the queue.

## Why this isn't shipped in the quick-wins batch

The component is mechanically simple. The *strings* it emits are a
narrative-design decision that touches the game's voice — a place where
"good enough" code shipped without authorial intent will hurt the
fiction. Better to stub now, ship intentionally later.

## Done when

- [ ] `<DiceAnnouncer>` mounted in `Round.tsx`.
- [ ] Manual test: VoiceOver (macOS) + NVDA (Windows) + TalkBack (Android)
      each read the dice result within 1s of settle.
- [ ] Throttle/coalesce policy documented (max 1 message per 600ms).
- [ ] Captions and Announcer share the same string-formatting helpers
      so HoH and blind players hear/read consistent vocabulary.
- [ ] Settings toggle: "Announce dice results" with default = on
      (the existing colorblind / motion / haptics pattern).
