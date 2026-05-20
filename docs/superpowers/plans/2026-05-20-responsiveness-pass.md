# Responsiveness pass + Night Market rename — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle the player-visible Celestial Bazaar → The Night Market rename with a targeted dead-spot triage on Round, score theater, and screen transitions/modals, using existing feedback systems without rewrites.

**Architecture:** Four phases of bite-sized commits. Phase 1 is a mechanical rename across 12 player-visible string sites + 1 test update. Phases 2–4 each follow the same audit→fix→verify loop on one surface using the dead-spot taxonomy from the spec. Fixes lean on `buttonJuice.ts`, `sfxPlay`, `playHaptic`, and existing CSS keyframes — no new abstractions.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Howler (`sfx`), Tone (`audio`), Tailwind, simplex-noise, three.js. Preview verification via `mcp__Claude_Preview__*`.

**Spec:** `docs/superpowers/specs/2026-05-20-responsiveness-pass-design.md`

---

## Phase 0: Setup

### Task 0.1: Branch + preview baseline

**Files:** none

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feat/responsiveness-pass-night-market
```

- [ ] **Step 2: Start dev server**

Call `mcp__Claude_Preview__preview_start` with command `npm run dev` from the repo root. Wait for "ready in" message in `preview_logs`.

- [ ] **Step 3: Capture baseline screenshots**

For reference during verification. Use `mcp__Claude_Preview__preview_screenshot` after navigating to each surface in turn (via `preview_click`):

1. Title screen.
2. Hub (`Press Play`).
3. Round (start a trial — click first challenge card).
4. Shop (clear a trial — or temporarily use a debug shortcut if Round is too slow).

Store as in-context references for later diffing. No file artifacts needed.

- [ ] **Step 4: Confirm test + typecheck baseline**

```bash
npm run typecheck
npm test
```

Expected: both pass. If either fails on `main`, stop and report — this plan assumes a green starting state.

---

## Phase 1: Rename Celestial Bazaar → The Night Market

Mechanical, surgical, low-risk. One commit. 12 source files + 1 test.

### Task 1.1: Update title + Shop call site

**Files:**
- Modify: `src-next/app/screens/Shop.tsx:1,116,149,249`

- [ ] **Step 1: Update Shop title + comment + tooltip + blind prop**

In `src-next/app/screens/Shop.tsx`:

Replace line 1 comment:
```ts
// Shop screen — the Celestial Bazaar between blinds. Renders the
```
with:
```ts
// Shop screen — the Night Market between blinds. Renders the
```

Replace line 116 (TopBar prop):
```tsx
        blind="Bazaar"
```
with:
```tsx
        blind="Night Market"
```

Replace line 149 (display title):
```tsx
          The Celestial Bazaar
```
with:
```tsx
          The Night Market
```

Replace line 249 (Next Trial tooltip):
```tsx
          <span className="tip tip-above">Leave the Bazaar and return to the Tribunal of Stars.</span>
```
with:
```tsx
          <span className="tip tip-above">Leave the Night Market and return to the Tribunal of Stars.</span>
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

### Task 1.2: Update screen tooltips (Hub, Forge, Codex, SkipBounty, EmptySlot)

**Files:**
- Modify: `src-next/app/screens/Hub.tsx:163`
- Modify: `src-next/app/screens/Forge.tsx:814`
- Modify: `src-next/app/screens/Codex.tsx:443,501,553`
- Modify: `src-next/app/screens/SkipBountyOverlay.tsx:241`
- Modify: `src-next/app/hud/EmptySlot.tsx:28`

- [ ] **Step 1: Hub.tsx line 163**

Replace:
```tsx
              Three trials bar your ascension. Clear them for shards and admittance to the Bazaar.
```
with:
```tsx
              Three trials bar your ascension. Clear them for shards and admittance to the Night Market.
```

- [ ] **Step 2: Forge.tsx line 814**

Replace:
```tsx
                    Buy mods at the Bazaar to etch them onto your dice here.
```
with:
```tsx
                    Buy mods at the Night Market to etch them onto your dice here.
```

- [ ] **Step 3: Codex.tsx three undiscovered tips (lines 443, 501, 553)**

Replace line 443:
```tsx
            tipBody={seen ? undefined : 'Encounter this catalyst at the Bazaar in a run to reveal its name, effect, and flavor here.'}
```
with:
```tsx
            tipBody={seen ? undefined : 'Encounter this catalyst at the Night Market in a run to reveal its name, effect, and flavor here.'}
```

Replace line 501:
```tsx
            tipBody={seen ? undefined : 'Encounter this mod (drops as a Bazaar offer or pack reward) to reveal its name, effect, and flavor here.'}
```
with:
```tsx
            tipBody={seen ? undefined : 'Encounter this mod (drops as a Night Market offer or pack reward) to reveal its name, effect, and flavor here.'}
```

Replace line 553:
```tsx
            tipBody={seen ? undefined : 'Buy this voucher at the Bazaar in a run to reveal its name and permanent perk here.'}
```
with:
```tsx
            tipBody={seen ? undefined : 'Buy this voucher at the Night Market in a run to reveal its name and permanent perk here.'}
```

- [ ] **Step 4: SkipBountyOverlay.tsx line 241**

Replace:
```tsx
        body: 'A handful of galaxies, opened when you next visit the bazaar.',
```
with:
```tsx
        body: 'A handful of galaxies, opened when you next visit the Night Market.',
```

- [ ] **Step 5: EmptySlot.tsx line 28**

Replace:
```ts
    tip: 'Catalysts modify how your dice score. Buy them at the Bazaar between blinds; up to your slot cap can ride along on a run.',
```
with:
```ts
    tip: 'Catalysts modify how your dice score. Buy them at the Night Market between blinds; up to your slot cap can ride along on a run.',
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

### Task 1.3: Update HUD + data flavor strings (TopBar, events, stakes, challenges, catalysts)

**Files:**
- Modify: `src-next/app/hud/TopBar.tsx:500,513,547`
- Modify: `src-next/data/events.ts:163`
- Modify: `src-next/data/stakes.ts:75`
- Modify: `src-next/data/challenges.ts:43`
- Modify: `src-next/data/catalysts.ts:183`

- [ ] **Step 1: TopBar.tsx — three player-visible strings**

Replace line 500:
```tsx
            Run currency. Earned by clearing trials and unused hands; spent at the Bazaar on upgrades and rerolls.
```
with:
```tsx
            Run currency. Earned by clearing trials and unused hands; spent at the Night Market on upgrades and rerolls.
```

Replace line 513:
```tsx
                  'Catalysts are persistent run-long modifiers. The Bench voucher and some constellations grant extra slots.'
```
Leave alone — does not mention Bazaar.

Replace line 547:
```tsx
                  'Permanent run perks bought at the Bazaar.'
```
with:
```tsx
                  'Permanent run perks bought at the Night Market.'
```

- [ ] **Step 2: events.ts line 163 (choice flavor)**

Replace:
```ts
        flavor: 'A galaxy pack opens in your next bazaar.',
```
with:
```ts
        flavor: 'A galaxy pack opens in your next Night Market.',
```

- [ ] **Step 3: stakes.ts line 75 (Beacon flavor)**

Replace:
```ts
    flavor: 'The bazaar grows greedy.',
```
with:
```ts
    flavor: 'The Night Market grows greedy.',
```

- [ ] **Step 4: challenges.ts line 43 (Silent Market flavor)**

Replace:
```ts
    flavor: 'No bazaar. Make do with what you have.',
```
with:
```ts
    flavor: 'No Night Market. Make do with what you have.',
```

- [ ] **Step 5: catalysts.ts line 183 (Dust-Off flavor)**

Replace:
```ts
    flavor: 'A quick scrub for the bazaar dust.', rarity: 'common', archetype: 'utility' },
```
with:
```ts
    flavor: 'A quick scrub for the night-market dust.', rarity: 'common', archetype: 'utility' },
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

### Task 1.4: Update test expectations + dev comments

**Files:**
- Modify: `src-next/app/hud/EmptySlot.test.tsx:13,27`
- Modify: `src-next/app/hud/PauseButton.tsx:63`

- [ ] **Step 1: EmptySlot.test.tsx test strings (lines 13 + 27)**

Replace line 13:
```ts
    expect(container.textContent).toContain('Buy them at the Bazaar');
```
with:
```ts
    expect(container.textContent).toContain('Buy them at the Night Market');
```

Replace line 27:
```ts
    expect(container.textContent).not.toContain('Buy them at the Bazaar');
```
with:
```ts
    expect(container.textContent).not.toContain('Buy them at the Night Market');
```

- [ ] **Step 2: PauseButton.tsx line 63 comment**

Replace:
```ts
        // top-anchored placement overlapped the Shop "Celestial Bazaar"
```
with:
```ts
        // top-anchored placement overlapped the Shop "Night Market"
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all green, including the two updated EmptySlot expectations.

- [ ] **Step 4: Final grep check**

Run a case-insensitive grep for "bazaar" under `src-next/`:

```bash
grep -ri "bazaar" src-next/
```

Expected output: only the comment in `src-next/core/round/transitions.ts:676` (`// Challenge overlays can disable the bazaar entirely; skip straight to hub.`). Leave this — it's dev-only documentation of the phase semantics, not player-visible.

If anything else returns, fix it in the same task before committing.

- [ ] **Step 5: Commit**

```bash
git add src-next/ docs/
git commit -m "$(cat <<'EOF'
ux: rename Celestial Bazaar to The Night Market

Player-visible string flip across 12 files plus the EmptySlot
test expectation update. Code identifiers (Shop.tsx filename,
internal blind/data ids) untouched.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Preview reload + visual confirm**

Call `mcp__Claude_Preview__preview_eval` with `window.location.reload()` then `preview_screenshot` of the Shop screen. Confirm the big title reads "The Night Market" and the title still fits one line.

---

## Phase 2: Round screen dead-spot fixes

Audit-driven. The audit produces a dead-spot list inline; fixes apply the recipes below. Single commit at the end of the phase.

### Task 2.1: Round screen audit walkthrough

**Files:** none modified (audit only)

- [ ] **Step 1: Navigate to Round in preview**

Use `mcp__Claude_Preview__preview_click` to:
1. Click "Press Play" on Hub if needed.
2. Click the first available trial card on the Tribunal screen.

Confirm you can see the dice tray and roll button. `preview_screenshot` for baseline.

- [ ] **Step 2: Walk each interaction and score against taxonomy**

For each interaction below, perform it, screenshot, listen via `preview_console_logs` for any sfxPlay/audio cues, and score against the dead-spot taxonomy:

| Channel | Tap (instant) | Commit (action lands) | Denied (blocked) |
|---|---|---|---|
| Visual | <16ms press state | <80ms reaction | shake or X overlay |
| Audio | <50ms SFX cue | layer cue | denied SFX |
| Motion | release ease-out | follow-through | reset bounce |

Interactions to walk:
1. Tap a die (single tap → lock toggle).
2. Tap an already-locked die (unlock).
3. Tap a die when locks at cap (denied).
4. Long-press a die (tip surface).
5. Tap a die outside the play zone (e.g. tray slot).
6. Click Roll button (commit).
7. Click Roll button when no rerolls left (denied).
8. Hover Roll button (mouse-only).
9. Tap a catalyst card in the strip.
10. Tap a consumable tile in the tray.
11. Watch a passive cue fire (heat meter tick, hot-streak banner) by playing a scoring round.
12. Press the Sell button on a catalyst (if reachable in Round) — denied + confirm.
13. Open the pause menu via PauseButton, close it.
14. Tap an empty slot ghost.
15. Tap the hand-name badge (if interactive).

For each, write a line in your scratch notes: `interaction → missing channel(s) or OK`.

- [ ] **Step 3: Produce dead-spot list**

Consolidate scratch notes into a short list of dead spots, each with:
- the element
- the missing channel
- the recipe from the fix vocabulary below

Examples (illustrative, not prescriptive):
- `die tap (touch): missing haptic — add playHaptic('tap')`
- `roll denied: silent — add sfxPlay('uiDenied') + deflect attr`
- `catalyst strip card: no press state — add data-pressed CSS rule`

Hold this list in scratch notes; it drives Task 2.2.

### Task 2.2: Apply fixes from dead-spot list

**Files:** depends on dead-spot list. Likely candidates:
- Modify: `src-next/app/hud/CatalystStrip.tsx` (catalyst card press states)
- Modify: `src-next/app/hud/ConsumableTray.tsx` (tile press states)
- Modify: `src-next/app/screens/Round.tsx` (die wiring if dice live there directly)
- Modify: `src-next/app/hud/scoring.css` or surface-specific CSS for press keyframes
- Modify: `src-next/styles/index.css` (only if a new shared keyframe is needed and no surface-local CSS exists)

**Fix recipe — non-`.btn` element press state:**

For an element that should react on touch/click but isn't a `.btn`:

```tsx
import { useRef, useCallback } from 'react';
import { sfxPlay } from '../../audio/sfx';
import { playHaptic } from '../haptics/haptics';

function someInteractiveCard(props) {
  const ref = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    sfxPlay('uiHoverSoft'); // or 'uiClick' for committal, 'uiHover' for tap-only
    if (e.pointerType === 'touch') playHaptic('tap');
    if (ref.current) ref.current.setAttribute('data-pressed', 'true');
  }, []);

  const onPointerUp = useCallback(() => {
    if (ref.current) ref.current.removeAttribute('data-pressed');
  }, []);

  const onPointerCancel = onPointerUp;
  const onPointerLeave = onPointerUp;

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      ...
    >
      ...
    </div>
  );
}
```

Plus CSS in the nearest surface stylesheet (or an inline style block on the parent screen — match existing pattern in that file):

```css
.ff-interactive[data-pressed='true'] {
  transform: scale(0.97);
  transition: transform 80ms ease-out;
}
.ff-interactive {
  transition: transform 160ms ease-out;
}
```

Pick a unique class name per surface (`.ff-cat-card`, `.ff-die`, etc.) — do not collide with existing names.

**Fix recipe — denied (blocked) click on a non-`.btn` element:**

```tsx
import { sfxPlay } from '../../audio/sfx';

function reject() {
  sfxPlay('uiDenied');
  if (ref.current) {
    ref.current.removeAttribute('data-denied');
    void ref.current.offsetWidth; // force reflow so the animation replays
    ref.current.setAttribute('data-denied', 'true');
    setTimeout(() => ref.current?.removeAttribute('data-denied'), 260);
  }
}
```

Plus CSS (or reuse existing `.btn[data-denied="true"]` shake keyframe if applicable — check `index.css`):

```css
@keyframes ff-deny-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}
.ff-interactive[data-denied='true'] {
  animation: ff-deny-shake 220ms ease-out;
}
```

**Fix recipe — missing audio on commit:**

Find the React `onClick` / commit handler. Add `sfxPlay('uiCommit')` or `sfxPlay('cardFlip')` (whichever already plays elsewhere for the same kind of action). Don't invent new cues.

**Fix recipe — missing haptic on touch tap:**

Inside the existing `onPointerDown` / `onTouchStart`:
```ts
if (e.pointerType === 'touch') playHaptic('tap');
```
(Use `'tick'` for chained micro-feedback, `'clear'` for big-clear moments — refer to `haptics.ts` PATTERNS map.)

- [ ] **Step 1: Apply each fix from the dead-spot list**

Work down the list one item at a time. For each:
1. Open the source file.
2. Apply the appropriate recipe.
3. Save.
4. `preview_eval window.location.reload()`.
5. Repeat the originally-dead interaction in preview.
6. Screenshot + console-log check.
7. If the dead spot is no longer dead, tick it off. If you can't tell, capture before/after pair and add a `// TODO(uxpass-2026-05-20):` comment with the reason — surface for user review at end of phase.

- [ ] **Step 2: Tests + typecheck**

```bash
npm run typecheck
npm test
```

Expected: both green. Fix regressions before continuing.

- [ ] **Step 3: Reduce-motion spot check**

```js
// in preview_eval:
document.documentElement.classList.add('reduce-motion');
```

Replay one of the fixed interactions. Confirm: shockwaves + shake suppressed, SFX still fires. Remove the class:

```js
document.documentElement.classList.remove('reduce-motion');
```

- [ ] **Step 4: Commit**

```bash
git add src-next/
git commit -m "$(cat <<'EOF'
ux: fix Round screen dead spots

Wire missing press/commit/denied feedback on non-btn
interactives in the round loop using buttonJuice patterns
(sfxPlay, playHaptic, data-pressed/data-denied attrs).
No new abstractions; reuses existing SFX + haptic palette.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

The commit body should list the specific dead spots fixed (rewrite from the dead-spot list).

---

## Phase 3: Score theater pacing residuals

Recent work landed scoring theater + voice-steal throttle restoration. This phase only polishes residuals — no rewrites.

### Task 3.1: Theater audit walkthrough

**Files:** none modified (audit only)

- [ ] **Step 1: Trigger a full scoring sequence in preview**

Play a real hand in Round. Capture the full chip-tick → mult-slam → payout sequence via:
- A series of `preview_screenshot` at regular intervals (you may need `preview_eval` to pause animations if too fast).
- `preview_console_logs` to capture audio cue order.

- [ ] **Step 2: Score against the taxonomy**

Specifically check:
1. **Chip tick cadence** — is the cadence consistent? Does it stutter or feel rushed? Look at `useScoreSequence.ts` and `scoreSequenceController.ts` if a timing tweak is needed.
2. **Voice-steal** — do multiple overlapping ticks audibly stack and clip, or does throttling kick in cleanly? Look at the recent commit `add319c` (revert chipTick/multSlam voice-steal throttle) to understand the current state.
3. **Mult slam** — does the slam have visible follow-through (settle anim) or does it freeze at peak?
4. **Payout reveal** — does the final number land cleanly, or does it pop in without easing?
5. **Pause-button overlap** — does the pause icon collide with the score moment overlay at any viewport?
6. **Reduce-motion** — replay with `.reduce-motion` set; visual should suppress but timing/audio order must hold.

- [ ] **Step 3: Produce residual list**

Same scratch-notes pattern as Phase 2. For each residual, note: timing problem vs audio problem vs visual problem vs overlap problem.

### Task 3.2: Apply theater residual fixes

**Files:** depends on residual list. Candidates:
- Modify: `src-next/app/hud/useScoreSequence.ts` (timing)
- Modify: `src-next/app/hud/scoreSequenceController.ts` (sequencing)
- Modify: `src-next/app/hud/ScoreMoment.tsx` (visual settle)
- Modify: `src-next/app/hud/ScoringVFX.css` (easing)
- Modify: `src-next/app/hud/theater/*` (specifically broken theater pieces)

**Constraint:** scoring math + state shape must not change. Only timings, easings, and audio cue order.

- [ ] **Step 1: Apply each fix one at a time**

Same loop as Task 2.2 Step 1 — edit, reload, re-screenshot, verify.

- [ ] **Step 2: Tests + typecheck**

```bash
npm run typecheck
npm test
```

Expected: both green. The `useScoreSequence.test.ts` suite should still pass — if a timing tweak broke it, the tweak is wrong, not the test (unless it tests an exact ms value that is no longer the intended value, in which case update the test + add a comment).

- [ ] **Step 3: Commit**

```bash
git add src-next/
git commit -m "$(cat <<'EOF'
ux: polish score theater pacing residuals

Tune chip-tick/mult-slam/payout timings and easings without
touching scoring math. Verify voice-steal throttle holds
under stacked ticks. Pause button no longer collides with
score moment overlay at narrow widths.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Commit body should list the specific residuals fixed.

---

## Phase 4: Screen transitions + modals

### Task 4.1: Transitions + modals audit

**Files:** none modified (audit only)

- [ ] **Step 1: Navigate every transition**

Walk every cross-screen nav in preview, screenshotting on each side of the transition:

1. Title → Hub
2. Hub → Round (start trial)
3. Round → Shop (clear blind)
4. Shop → Hub (Next Trial)
5. Hub → Forge (if reachable from Hub)
6. Forge → Hub (back button)
7. Hub → Codex / Settings / Scores

For each, judge: is there a fade or are screens swap-cutting? Time from click to interactive?

- [ ] **Step 2: Walk every modal/overlay open + close**

Modals:
- PauseMenu (PauseButton → ESC + click backdrop)
- PackOverlay (open a galaxy / spectral pack — if reachable in current preview state, otherwise note as deferred)
- SkipBountyOverlay (skip a blind — trigger via Hub if available)
- CollectionSheet (Shop → Collection button)
- DieTip (long-press a die in Round)

For each, score the enter and exit independently against the taxonomy.

- [ ] **Step 3: Produce dead-spot list**

Same scratch-notes pattern. Common patterns to expect:
- Hard cut between screens (missing fade)
- Modal pops in with no scale/opacity ease
- Backdrop click commits with no audio
- ESC commits with no audio

### Task 4.2: Apply transition + modal fixes

**Files:** depends on list. Candidates:
- Modify: `src-next/app/App.tsx` (screen mount/unmount keying)
- Modify: each modal component (`PauseMenu.tsx`, `PackOverlay.tsx`, `SkipBountyOverlay.tsx`, `CollectionPanel.tsx`)
- Modify: `src-next/styles/index.css` (shared fade keyframes if needed)

**Fix recipe — screen fade-in:**

If `App.tsx` renders screens by `switch(screen)`, wrap each screen in a keyed `<div className="ff-screen-enter">` so React replays the animation on mount:

```tsx
<div className="ff-screen-enter" key={screen}>
  {/* existing screen content */}
</div>
```

CSS in `index.css` (or wherever similar shared rules already live — check the file first):

```css
.ff-screen-enter {
  animation: ff-screen-enter 220ms ease-out;
}
@keyframes ff-screen-enter {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

If a `ff-screen-enter`-equivalent already exists in `index.css`, reuse it — do not duplicate.

**Fix recipe — modal enter/exit:**

```tsx
const [closing, setClosing] = useState(false);

function requestClose() {
  setClosing(true);
  sfxPlay('uiClick'); // or whatever close cue is canonical
  setTimeout(onClose, 180);
}

return (
  <div className={`ff-modal-backdrop ${closing ? 'is-closing' : ''}`}>
    <div className={`ff-modal-content ${closing ? 'is-closing' : ''}`}>
      ...
    </div>
  </div>
);
```

CSS:

```css
.ff-modal-backdrop {
  opacity: 0;
  animation: ff-modal-fade-in 120ms ease-out forwards;
}
.ff-modal-backdrop.is-closing {
  animation: ff-modal-fade-out 180ms ease-in forwards;
}
.ff-modal-content {
  transform: scale(0.96);
  opacity: 0;
  animation: ff-modal-pop-in 200ms 40ms ease-out forwards;
}
.ff-modal-content.is-closing {
  animation: ff-modal-pop-out 180ms ease-in forwards;
}
@keyframes ff-modal-fade-in { to { opacity: 1; } }
@keyframes ff-modal-fade-out { to { opacity: 0; } }
@keyframes ff-modal-pop-in { to { transform: scale(1); opacity: 1; } }
@keyframes ff-modal-pop-out { to { transform: scale(0.96); opacity: 0; } }
```

Pick class names that don't collide with existing CSS. Check `src-next/styles/index.css` and surface-specific stylesheets first.

- [ ] **Step 1: Apply fixes from list**

Same loop as Task 2.2 Step 1.

- [ ] **Step 2: Reduce-motion spot check**

```js
document.documentElement.classList.add('reduce-motion');
```

Replay a transition + a modal open. Confirm: animations suppressed but layout still settles correctly (no missing content, no permanent invisibility).

For reduce-motion, add a guard CSS rule:

```css
.reduce-motion .ff-screen-enter,
.reduce-motion .ff-modal-backdrop,
.reduce-motion .ff-modal-content {
  animation: none !important;
  opacity: 1 !important;
  transform: none !important;
}
```

Remove the class:
```js
document.documentElement.classList.remove('reduce-motion');
```

- [ ] **Step 3: Tests + typecheck**

```bash
npm run typecheck
npm test
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add src-next/
git commit -m "$(cat <<'EOF'
ux: add screen transition + modal feedback

Cross-screen navs now fade-in; modals enter/exit with scale +
opacity. Backdrop click and ESC fire close SFX. Reduce-motion
suppresses animation but preserves layout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: Done-criteria verification + (optional) postmortem

### Task 5.1: Done-criteria walkthrough

**Files:** none modified

- [ ] **Step 1: Run all gates**

```bash
npm run typecheck
npm test
```

Expected: both green.

- [ ] **Step 2: Rename grep gate**

```bash
grep -ri "bazaar" src-next/
```

Expected: only `src-next/core/round/transitions.ts:676` (the dev comment).

- [ ] **Step 3: Manual surface re-walk**

In preview, walk:
1. Round — die tap, lock, roll, score. Confirm every interaction has visual + audio.
2. Score theater — play one full scoring sequence. Confirm chip tick → mult slam → payout reads cleanly.
3. Transitions — Hub↔Round↔Shop↔Forge. Each transition has a fade.
4. Modals — Pause open/close, Collection open/close. Each has enter+exit anim.

If any criterion fails, that's a regression — fix and re-commit before claiming the phase done.

- [ ] **Step 4: Reduce-motion full pass**

```js
document.documentElement.classList.add('reduce-motion');
```

Re-walk #3 (Round) above. Confirm: SFX still fires on every action, but shockwaves/screen-shake/modal-pop are suppressed. Remove the class.

### Task 5.2: (Optional) Postmortem commit

**Files:**
- Modify: `docs/superpowers/specs/2026-05-20-responsiveness-pass-design.md` (append postmortem section)

- [ ] **Step 1: Append postmortem section**

Add at end of the spec:

```markdown
## Postmortem (2026-05-20)

**Surfaces touched:** Round, score theater, transitions+modals.
**Commits:** [list with short hashes from `git log --oneline feat/responsiveness-pass-night-market`]
**Dead spots fixed:** [bullet list from commit bodies]
**Residuals deferred:** [anything still marked TODO(uxpass-2026-05-20) in the codebase]
**Verification screenshots:** [list of before/after pairs captured in preview, if saved]
```

- [ ] **Step 2: Commit postmortem**

```bash
git add docs/superpowers/specs/2026-05-20-responsiveness-pass-design.md
git commit -m "$(cat <<'EOF'
docs: postmortem for responsiveness pass

Capture surfaces fixed, residuals deferred, and verification
notes from the 2026-05-20 UX pass.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push branch + open PR (only when user explicitly asks)**

Do NOT push without user confirmation. The plan ends with all work committed locally on `feat/responsiveness-pass-night-market`; the user decides when to push/open PR.

---

## Done

When all phase commits land + done-criteria gates pass, this plan is complete.
