# Plan A — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the cross-cutting primitives every other plan depends on: tension scalar, AudioEngine.setTension, motion bucket vars, useMotion hook, material CSS layer, ScreenTransition component, and CosmosBackground tension wiring.

**Architecture:** Pure-function selector (`selectTension`) drives a single audio engine setter (`setTension`) and a CSS-variable-driven motion system (`--snap`, `--savored`). Material classes are layered CSS (gradient + noise SVG data URI + shadows). `ScreenTransition` is a controlled wrapper around the active screen child that performs a constellation-wipe via state machine. Reduced-motion respect is handled by a single `useMotion()` hook that flips a class on `<html>`.

**Tech Stack:** TypeScript + React 18 + Zustand + Vite + Vitest. CSS in `src-next/styles/index.css` (existing). No new runtime deps.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src-next/audio/heat.ts` | **modify** — add `selectTension(s)` pure function + `TensionInputs` type |
| `src-next/audio/heat.test.ts` | **new** — vitest unit tests for `selectTension` |
| `src-next/audio/AudioEngine.ts` | **modify** — add public `setTension(t)` API + tension-driven biquad cutoff & layer mix nudge |
| `src-next/audio/audioBridge.ts` | **modify** — subscribe `selectTension(state)` → `audioEngine.setTension(t)` |
| `src-next/styles/index.css` | **modify** — add motion CSS vars, material classes, `.reduce-motion` override block |
| `src-next/app/hooks/useMotion.ts` | **new** — hook reading `prefers-reduced-motion`, toggles `.reduce-motion` on `<html>` |
| `src-next/app/visual/ScreenTransition.tsx` | **new** — wipe state machine (`idle → exiting → entering → idle`) |
| `src-next/app/App.tsx` | **modify** — wrap screen swap with `<ScreenTransition screenKey={screen}>` |
| `src-next/app/visual/CosmosBackground.tsx` | **modify** — accept `tension` prop; modulate drift speed + crimson tint |
| `src-next/state/selectors.ts` | **modify** — re-export `selectTension` for ergonomic imports |
| `vitest.config.ts` | **new** — vitest config (jsdom env, glob pattern excluding `node_modules`) |

---

## Task 1 — Vitest config + smoke test

**Files:**
- Create: `vitest.config.ts`
- Create: `src-next/audio/heat.test.ts`

- [ ] **Step 1: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src-next/**/*.test.ts', 'src-next/**/*.test.tsx'],
    exclude: ['node_modules/**', 'dist/**'],
  },
  resolve: {
    alias: {
      '@next': path.resolve(process.cwd(), 'src-next'),
    },
  },
});
```

- [ ] **Step 2: Install jsdom**

Run: `npm install --save-dev jsdom`
Expected: `jsdom` added to `package.json` devDependencies.

- [ ] **Step 3: Write smoke test for existing `smoothstep`**

Create `src-next/audio/heat.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { smoothstep } from './heat';

describe('smoothstep', () => {
  it('returns 0 below edge0', () => {
    expect(smoothstep(0, 0.5, 1)).toBe(0);
  });
  it('returns 1 above edge1', () => {
    expect(smoothstep(2, 0.5, 1)).toBe(1);
  });
  it('is monotonic in the interior', () => {
    const a = smoothstep(0.6, 0.5, 1);
    const b = smoothstep(0.8, 0.5, 1);
    expect(b).toBeGreaterThan(a);
  });
});
```

- [ ] **Step 4: Run tests to verify config + smoke**

Run: `npm test`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts src-next/audio/heat.test.ts package.json package-lock.json
git commit -m "test: add vitest config + heat smoothstep smoke test"
```

---

## Task 2 — `selectTension` pure function

**Files:**
- Modify: `src-next/audio/heat.ts`
- Modify: `src-next/audio/heat.test.ts`

- [ ] **Step 1: Add failing test for `selectTension`**

Append to `src-next/audio/heat.test.ts`:

```ts
import { selectTension, type TensionInputs } from './heat';

describe('selectTension', () => {
  const base: TensionInputs = { score: 0, target: 1000, handsLeft: 4, handsTotal: 4, scoring: false };

  it('returns 0 when score === target (cleared)', () => {
    expect(selectTension({ ...base, score: 1000 })).toBe(0);
  });

  it('returns near 1 when far behind on last hand', () => {
    expect(selectTension({ ...base, score: 100, handsLeft: 1 })).toBeGreaterThan(0.85);
  });

  it('is monotonic non-increasing as score rises (with same handsLeft)', () => {
    const t1 = selectTension({ ...base, score: 200, handsLeft: 2 });
    const t2 = selectTension({ ...base, score: 800, handsLeft: 2 });
    expect(t2).toBeLessThanOrEqual(t1);
  });

  it('rises as handsLeft drops at fixed score gap', () => {
    const t4 = selectTension({ ...base, score: 500, handsLeft: 4 });
    const t1 = selectTension({ ...base, score: 500, handsLeft: 1 });
    expect(t1).toBeGreaterThan(t4);
  });

  it('returns 1.0 while scoring is true regardless of inputs', () => {
    expect(selectTension({ ...base, score: 1000, scoring: true })).toBe(1);
  });

  it('returns 0 with non-positive target', () => {
    expect(selectTension({ ...base, target: 0 })).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `selectTension is not a function` / `TensionInputs` type missing.

- [ ] **Step 3: Implement `selectTension`**

Append to `src-next/audio/heat.ts`:

```ts
export type TensionInputs = {
  score: number;
  target: number;
  handsLeft: number;
  handsTotal: number;
  scoring: boolean;
};

export function selectTension(i: TensionInputs): number {
  if (i.scoring) return 1;
  if (i.target <= 0) return 0;
  const gap = Math.max(0, (i.target - i.score) / i.target);
  const handsRatio = i.handsTotal > 0 ? i.handsLeft / i.handsTotal : 1;
  // pace_factor: 1 when hands plentiful, 2.2 when on last hand
  const pace = 1 + (1 - handsRatio) * 1.2;
  return Math.max(0, Math.min(1, gap * pace));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: all `selectTension` tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-next/audio/heat.ts src-next/audio/heat.test.ts
git commit -m "feat(audio): add selectTension pure function"
```

---

## Task 3 — `selectTensionFromState` selector + selectors barrel re-export

**Files:**
- Modify: `src-next/state/selectors.ts`
- Modify: `src-next/audio/heat.test.ts`

- [ ] **Step 1: Add failing test for `selectTensionFromState`**

Append to `src-next/audio/heat.test.ts`:

```ts
import { selectTensionFromState } from '../state/selectors';

describe('selectTensionFromState', () => {
  it('reads round.score / round.target / round.handsLeft / handsMax / scoring', () => {
    const state = {
      round: { score: 500, target: 1000, handsLeft: 2, handsMax: 4, scoring: false },
    } as unknown as Parameters<typeof selectTensionFromState>[0];
    const t = selectTensionFromState(state);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(1);
  });
  it('returns 1 if state.round.scoring is true', () => {
    const state = {
      round: { score: 1000, target: 1000, handsLeft: 4, handsMax: 4, scoring: true },
    } as unknown as Parameters<typeof selectTensionFromState>[0];
    expect(selectTensionFromState(state)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `selectTensionFromState` not exported.

- [ ] **Step 3: Inspect `state/store.ts` to confirm field names**

Run: read `src-next/state/store.ts` and `src-next/state/slices/round.ts` (or wherever round shape lives). Confirm `round.score`, `round.target`, `round.handsLeft` exist. Identify `handsMax` (the per-blind allotment) and any `scoring` flag (might be `round.scoring` or derived from `state.run.castInProgress`). If field names differ, adjust the selector and re-run the test.

- [ ] **Step 4: Implement selector**

Append to `src-next/state/selectors.ts`:

```ts
import { selectTension, type TensionInputs } from '../audio/heat';

export const selectTensionFromState = (s: GameState): number => {
  const handsTotal = (s.round as { handsMax?: number }).handsMax ?? s.round.handsLeft + 0;
  const scoring = (s.round as { scoring?: boolean }).scoring ?? false;
  const inputs: TensionInputs = {
    score: s.round.score,
    target: s.round.target,
    handsLeft: s.round.handsLeft,
    handsTotal,
    scoring,
  };
  return selectTension(inputs);
};
```

If `handsMax` field doesn't exist on the round slice, add it during this task: add to the round state initialization and update `START_BLIND` action to set it. Do this only if needed — the field name in the codebase wins.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: both new tests pass.

- [ ] **Step 6: Commit**

```bash
git add src-next/state/selectors.ts src-next/audio/heat.test.ts
git commit -m "feat(state): add selectTensionFromState selector"
```

---

## Task 4 — `AudioEngine.setTension(t)` API

**Files:**
- Modify: `src-next/audio/AudioEngine.ts`

- [ ] **Step 1: Add `setTension` public method**

Open `src-next/audio/AudioEngine.ts`. Add a private field and public method on `AudioEngineImpl`:

```ts
  private tension = 0;

  setTension(t: number): void {
    this.tension = Math.max(0, Math.min(1, t));
  }

  getTension(): number {
    return this.tension;
  }
```

- [ ] **Step 2: Apply tension to biquad cutoff in `tick()`**

Find the existing block in `tick()`:

```ts
    if (this.filter) {
      const cutoff = this.state.mode === 'fail' ? 800 : 600 + this.state.heat * 15000;
      this.filter.frequency.setTargetAtTime(cutoff, this.filter.context.currentTime, 0.05);
    }
```

Replace with:

```ts
    if (this.filter) {
      // tension narrows the filter further; mode=fail still hard-overrides to 800Hz
      const heatCutoff = 600 + this.state.heat * 15000;
      const tensionFloor = 16000 - this.tension * 14000; // tension=0 → 16000, tension=1 → 2000
      const cutoff = this.state.mode === 'fail' ? 800 : Math.min(heatCutoff, tensionFloor);
      this.filter.frequency.setTargetAtTime(cutoff, this.filter.context.currentTime, 0.05);
    }
```

- [ ] **Step 3: Apply tension nudge to `combo` and `peak` layer targets**

Find:

```ts
    let baseTarget = 0.55 + 0.25 * this.state.stability + 0.15 * this.state.heat;
    let comboTarget = this.state.combo * (0.6 + 0.4 * this.state.heat);
    let peakTarget = smoothstep(this.state.heat, 0.7, 1.0) * 0.85;
    let failTarget = this.state.fail * 0.7;
```

Replace with:

```ts
    const tNudge = this.tension * 0.2;
    let baseTarget = 0.55 + 0.25 * this.state.stability + 0.15 * this.state.heat;
    let comboTarget = this.state.combo * (0.6 + 0.4 * this.state.heat) + tNudge * 0.6;
    let peakTarget = smoothstep(this.state.heat, 0.7, 1.0) * 0.85 + tNudge * 0.4;
    let failTarget = this.state.fail * 0.7;
```

- [ ] **Step 4: Manual smoke**

Run: `npm run dev`. Open localhost. In dev console (DEV mode exposes `window.__ff`):

```js
__ff.audio.setTension(0); // expect bright filter, neutral mix
__ff.audio.setTension(1); // expect dark filter, peak/combo nudged louder
__ff.audio.setTension(0); // returns to neutral
```

Expected: audible filter close at `t=1`; restoration on `t=0`.

- [ ] **Step 5: Commit**

```bash
git add src-next/audio/AudioEngine.ts
git commit -m "feat(audio): add setTension API for adaptive tension scalar"
```

---

## Task 5 — Wire `selectTensionFromState` into `audioBridge`

**Files:**
- Modify: `src-next/audio/audioBridge.ts`

- [ ] **Step 1: Inspect existing audioBridge structure**

Run: read `src-next/audio/audioBridge.ts`. Identify the existing `startAudioBridge()` function and how it currently subscribes to the store.

- [ ] **Step 2: Add tension subscription**

Inside `startAudioBridge()`, add a store subscription that calls `audioEngine.setTension(selectTensionFromState(s))` whenever the relevant fields change. Pattern:

```ts
import { store } from '../state/store';
import { selectTensionFromState } from '../state/selectors';
import { audioEngine } from './AudioEngine';

// inside startAudioBridge():
let lastT = -1;
const unsub = store.subscribe((s) => {
  const t = selectTensionFromState(s);
  if (Math.abs(t - lastT) > 0.005) {
    lastT = t;
    audioEngine.setTension(t);
  }
});
// (caller responsibility: keep `unsub` for cleanup if hot-reload requires)
```

If `audioBridge.ts` already has subscriptions, append rather than replace.

- [ ] **Step 3: Manual smoke**

Run: `npm run dev`. Start a run, enter Round, accumulate score below target. Open dev console:

```js
__ff.audio.getTension(); // expect > 0
```

Cast a hand that clears the blind. Verify `getTension()` returns 0 (or near 0) afterward.

- [ ] **Step 4: Commit**

```bash
git add src-next/audio/audioBridge.ts
git commit -m "feat(audio): subscribe AudioEngine to selectTensionFromState"
```

---

## Task 6 — Motion CSS variables + reduced-motion class

**Files:**
- Modify: `src-next/styles/index.css`

- [ ] **Step 1: Add motion vars to `:root`**

Find the existing `:root { --cosmos-50:... }` block. Append motion vars:

```css
:root {
  /* ...existing palette vars... */
  --snap-fast: 80ms;
  --snap: 120ms;
  --savored-short: 450ms;
  --savored: 600ms;
  --savored-long: 900ms;
  --ease-snap: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-savor: cubic-bezier(0.25, 0.46, 0.2, 1.0);
}
```

- [ ] **Step 2: Add reduced-motion override block**

Append to the bottom of `src-next/styles/index.css`:

```css
/* Reduced-motion: collapses all savored animations to short cross-fade.
   Applied via .reduce-motion class on <html> (set by useMotion hook),
   plus prefers-reduced-motion as a fallback. */
.reduce-motion *,
.reduce-motion *::before,
.reduce-motion *::after {
  animation-duration: 80ms !important;
  animation-delay: 0ms !important;
  transition-duration: 80ms !important;
  transition-delay: 0ms !important;
}
.reduce-motion .die3d-wrap.idle .die3d { animation: none; }
.reduce-motion .die3d-wrap.scoring::after { animation: none; }

@media (prefers-reduced-motion: reduce) {
  html:not(.allow-motion) *,
  html:not(.allow-motion) *::before,
  html:not(.allow-motion) *::after {
    animation-duration: 80ms !important;
    transition-duration: 80ms !important;
  }
}
```

- [ ] **Step 3: Manual smoke**

Run: `npm run dev`. Open localhost. In console:

```js
document.documentElement.classList.add('reduce-motion');
```

Expected: idle-tumble on dice stops, all transitions snap to 80ms. Remove the class to restore.

- [ ] **Step 4: Commit**

```bash
git add src-next/styles/index.css
git commit -m "feat(css): add motion bucket vars + reduced-motion override"
```

---

## Task 7 — `useMotion()` hook

**Files:**
- Create: `src-next/app/hooks/useMotion.ts`
- Create: `src-next/app/hooks/useMotion.test.tsx`

- [ ] **Step 1: Install testing-library**

Run: `npm install --save-dev @testing-library/react @testing-library/dom`
Expected: deps added.

- [ ] **Step 2: Write failing test**

Create `src-next/app/hooks/useMotion.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useMotion } from './useMotion';

function Probe() {
  useMotion();
  return null;
}

describe('useMotion', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('reduce-motion');
  });
  afterEach(() => {
    document.documentElement.classList.remove('reduce-motion');
  });

  it('adds .reduce-motion when prefers-reduced-motion matches', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (q: string) => ({
        matches: q === '(prefers-reduced-motion: reduce)',
        media: q,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    render(<Probe />);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
  });

  it('omits .reduce-motion when media query does not match', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (q: string) => ({
        matches: false,
        media: q,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    render(<Probe />);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — module `./useMotion` not found.

- [ ] **Step 4: Implement hook**

Create `src-next/app/hooks/useMotion.ts`:

```ts
import { useEffect } from 'react';

export function useMotion(): void {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      document.documentElement.classList.toggle('reduce-motion', mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
    };
  }, []);
}
```

- [ ] **Step 5: Mount hook in `App.tsx`**

In `src-next/app/App.tsx`, add at top of the `App` function body (before any returns):

```tsx
import { useMotion } from './hooks/useMotion';
// ...
export function App() {
  useMotion();
  // ...existing body...
}
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npm test`
Expected: both `useMotion` tests pass.

- [ ] **Step 7: Manual smoke**

Run: `npm run dev`. Toggle OS-level "reduce motion" preference (macOS: System Settings → Accessibility → Display → Reduce motion; Windows: Settings → Accessibility → Visual effects → Animation effects off). Reload. Inspect `<html>` class — should contain `reduce-motion` when OS pref is on.

- [ ] **Step 8: Commit**

```bash
git add src-next/app/hooks/useMotion.ts src-next/app/hooks/useMotion.test.tsx src-next/app/App.tsx package.json package-lock.json
git commit -m "feat(motion): add useMotion hook + auto-toggle reduce-motion class"
```

---

## Task 8 — Material CSS classes

**Files:**
- Modify: `src-next/styles/index.css`

- [ ] **Step 1: Append material classes**

Append to `src-next/styles/index.css`:

```css
/* Material vocabulary — every interactive surface picks one. */
/* Each material is: base color/gradient + grain (SVG noise data URI) + lit edges. */

.mat-parchment {
  background:
    radial-gradient(ellipse at 30% 20%, rgba(255, 220, 160, 0.08), transparent 60%),
    linear-gradient(180deg, #2a1f0e, #1a1308);
  border: 1px solid rgba(245, 196, 81, 0.25);
  box-shadow: inset 0 1px 0 rgba(255, 220, 160, 0.12), 0 8px 22px rgba(0, 0, 0, 0.4);
  position: relative;
}
.mat-parchment::before {
  content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0.18;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>");
  mix-blend-mode: overlay;
}

.mat-brass {
  background:
    linear-gradient(180deg, #d4a64c 0%, #8a6720 60%, #4a3810 100%);
  border: 1px solid rgba(255, 220, 130, 0.45);
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 200, 0.6),
    inset 0 -1px 0 rgba(40, 24, 6, 0.5),
    0 4px 10px rgba(0, 0, 0, 0.45);
}

.mat-velvet {
  background:
    radial-gradient(ellipse at 40% 30%, rgba(140, 30, 60, 0.6), transparent 65%),
    linear-gradient(180deg, #2a0815, #14040a);
  border: 1px solid rgba(140, 30, 60, 0.45);
  box-shadow: inset 0 1px 0 rgba(255, 200, 220, 0.08), 0 12px 32px rgba(0, 0, 0, 0.55);
  position: relative;
}
.mat-velvet::before {
  content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0.10;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><filter id='v'><feTurbulence baseFrequency='1.5' numOctaves='1'/></filter><rect width='100%' height='100%' filter='url(%23v)'/></svg>");
}

.mat-obsidian {
  background:
    radial-gradient(ellipse at 30% 20%, rgba(123, 227, 255, 0.18), transparent 65%),
    linear-gradient(180deg, #0f0925, #04020c);
  border: 1px solid rgba(149, 119, 255, 0.32);
  box-shadow:
    inset 0 1px 0 rgba(220, 212, 255, 0.10),
    inset 0 0 18px rgba(123, 227, 255, 0.06),
    0 10px 28px rgba(0, 0, 0, 0.55);
}

.mat-gold {
  background: linear-gradient(180deg, #ffd97a 0%, #f5c451 50%, #b88a1e 100%);
  color: #20100a;
  border: 1px solid rgba(255, 240, 200, 0.55);
  text-shadow: 0 1px 0 rgba(255, 255, 220, 0.4);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 220, 0.7),
    0 0 18px rgba(245, 196, 81, 0.4);
}

.mat-crystal {
  background: rgba(15, 9, 37, 0.72);
  border: 1px solid rgba(123, 227, 255, 0.32);
  box-shadow: inset 0 1px 0 rgba(220, 212, 255, 0.12), 0 8px 22px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px) saturate(1.1);
  -webkit-backdrop-filter: blur(8px) saturate(1.1);
}

/* Hover lift for any material element marked as interactive */
.mat-interactive { transition: transform var(--snap) var(--ease-snap), box-shadow var(--snap) var(--ease-snap); }
.mat-interactive:hover { transform: translateY(-1px); }
```

- [ ] **Step 2: Manual smoke — temporarily decorate one element to confirm**

In `src-next/app/screens/Title.tsx`, temporarily change the `Begin Ascension` button class to `btn btn-primary mat-gold mat-interactive` and reload. Verify the button reads as polished gold (specular highlight, drop shadow, gradient). After verifying, **revert this change** — Plan G will apply materials properly.

- [ ] **Step 3: Commit**

```bash
git add src-next/styles/index.css
git commit -m "feat(css): add material vocabulary (parchment/brass/velvet/obsidian/gold/crystal)"
```

---

## Task 9 — `ScreenTransition` component

**Files:**
- Create: `src-next/app/visual/ScreenTransition.tsx`
- Modify: `src-next/app/App.tsx`

- [ ] **Step 1: Create the component**

Create `src-next/app/visual/ScreenTransition.tsx`:

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';

type Phase = 'idle' | 'exiting' | 'entering';

const SAVORED_MS = 600;
const SNAP_MS = 120;

export function ScreenTransition({
  screenKey,
  children,
}: {
  screenKey: string;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [renderedKey, setRenderedKey] = useState(screenKey);
  const [renderedChildren, setRenderedChildren] = useState<ReactNode>(children);
  const lastKey = useRef(screenKey);

  useEffect(() => {
    if (screenKey === lastKey.current) return;
    const reduced = document.documentElement.classList.contains('reduce-motion');
    const half = reduced ? SNAP_MS : SAVORED_MS / 2;

    setPhase('exiting');
    const tExit = window.setTimeout(() => {
      lastKey.current = screenKey;
      setRenderedKey(screenKey);
      setRenderedChildren(children);
      setPhase('entering');
      const tEnter = window.setTimeout(() => setPhase('idle'), half);
      // store tEnter cleanup on next phase change implicitly
      return () => window.clearTimeout(tEnter);
    }, half);

    return () => window.clearTimeout(tExit);
  }, [screenKey, children]);

  // Keep rendered children fresh during 'entering'/'idle'
  useEffect(() => {
    if (phase === 'idle') setRenderedChildren(children);
  }, [phase, children]);

  const opacity = phase === 'exiting' ? 0 : 1;
  const scale = phase === 'exiting' ? 1.04 : phase === 'entering' ? 0.98 : 1;

  return (
    <div
      data-screen={renderedKey}
      data-phase={phase}
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        transform: `scale(${scale})`,
        transition: `opacity var(--savored, 600ms) var(--ease-savor, ease), transform var(--savored, 600ms) var(--ease-savor, ease)`,
        pointerEvents: phase === 'idle' ? 'auto' : 'none',
      }}
    >
      {/* constellation-wipe overlay (cheap radial dashed strokes) */}
      <ConstellationWipe phase={phase} />
      {renderedChildren}
    </div>
  );
}

function ConstellationWipe({ phase }: { phase: Phase }) {
  if (phase === 'idle') return null;
  const expand = phase === 'exiting' ? 1 : 0.5;
  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: phase === 'exiting' ? 0.7 : 0.35,
        transition: 'opacity var(--savored, 600ms) var(--ease-savor, ease)',
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* 8 radial lines from center out, growing during exit, shrinking during enter */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const len = 50 * expand;
        const x = 50 + Math.cos(angle) * len;
        const y = 50 + Math.sin(angle) * len;
        return (
          <line
            key={i}
            x1={50}
            y1={50}
            x2={x}
            y2={y}
            stroke="#7be3ff"
            strokeWidth={0.18}
            strokeDasharray="1.5 2.5"
          />
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Wrap screen swap in `App.tsx`**

Open `src-next/app/App.tsx`. Replace the inner screen-block:

```tsx
      <div className="absolute inset-0 pointer-events-none">
        {screen === 'title'  && <Title />}
        {screen === 'hub'    && <Hub />}
        {screen === 'round'  && <Round />}
        {screen === 'shop'   && <Shop />}
        {screen === 'forge'  && <Forge />}
        {screen === 'win'    && <Win />}
        {screen === 'scores' && <Scores />}
        <BossReveal />
        <Particles />
      </div>
```

with:

```tsx
import { ScreenTransition } from './visual/ScreenTransition';
// ...inside App return:
      <div className="absolute inset-0 pointer-events-none">
        <ScreenTransition screenKey={screen}>
          {screen === 'title'  && <Title />}
          {screen === 'hub'    && <Hub />}
          {screen === 'round'  && <Round />}
          {screen === 'shop'   && <Shop />}
          {screen === 'forge'  && <Forge />}
          {screen === 'win'    && <Win />}
          {screen === 'scores' && <Scores />}
        </ScreenTransition>
        <BossReveal />
        <Particles />
      </div>
```

(`BossReveal` and `Particles` stay outside the transition — they overlay across screens.)

- [ ] **Step 3: Manual smoke**

Run: `npm run dev`. Click "Begin Ascension". Verify a brief constellation-wipe (radial cyan dashed lines) on screen change with fade + scale. Open Hub → click a blind → verify wipe also fires on entering Round.

- [ ] **Step 4: Manual smoke (reduced motion)**

Add `reduce-motion` class via console:

```js
document.documentElement.classList.add('reduce-motion');
```

Trigger another transition. Verify total transition duration ≤ ~250ms (no constellation lines visibly draw). Remove class to restore.

- [ ] **Step 5: Commit**

```bash
git add src-next/app/visual/ScreenTransition.tsx src-next/app/App.tsx
git commit -m "feat(visual): add ScreenTransition with constellation wipe"
```

---

## Task 10 — Wire `CosmosBackground` to tension

**Files:**
- Modify: `src-next/app/visual/CosmosBackground.tsx`
- Modify: `src-next/app/App.tsx`

- [ ] **Step 1: Accept `tension` prop**

Open `src-next/app/visual/CosmosBackground.tsx`. Modify the `CosmosBackground` exported component signature:

```tsx
export function CosmosBackground({
  theme = 'voidlit',
  density = 1,
  nebula = true,
  drift = true,
  tension = 0,
}: { theme?: ThemeKey; density?: number; nebula?: boolean; drift?: boolean; tension?: number }) {
  const t = THEMES[theme];
  const tensionClamped = Math.max(0, Math.min(1, tension));
  const crimsonOpacity = tensionClamped < 0.3 ? 0 : (tensionClamped - 0.3) * (0.25 / 0.7);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: `radial-gradient(ellipse at 50% 35%, ${t.bgNear} 0%, ${t.bgMid} 45%, ${t.bgFar} 100%)`,
    }}>
      <Nebula theme={theme} intensity={nebula ? 1 : 0.3} />
      <Starfield density={density} theme={theme} drift={drift} tension={tensionClamped} />
      {crimsonOpacity > 0 && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(226,51,74,1) 100%)',
          opacity: crimsonOpacity,
          mixBlendMode: 'multiply',
          transition: 'opacity 600ms ease',
        }} />
      )}
    </div>
  );
}
```

Then update `Starfield` signature to accept `tension`:

```tsx
function Starfield({ density = 1, theme = 'voidlit', drift = true, tension = 0 }: { density?: number; theme?: ThemeKey; drift?: boolean; tension?: number }) {
  const t = THEMES[theme];
  // Speed up drift with tension: tension=0 → 1×, tension=1 → 1.4×
  const driftMul = 1 + 0.4 * tension;
  // ...existing layers useMemo unchanged...
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {layers.map((layer, li) => (
        <svg key={li}
          width="100%" height="100%"
          viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
          style={{
            position: 'absolute', inset: 0,
            animation: drift ? `drift ${(180 / layer.dist) / driftMul}s linear infinite alternate` : 'none',
            opacity: 0.5 + layer.dist * 0.4,
          }}>
          {/* ...existing star circles unchanged... */}
        </svg>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Pass tension from `App.tsx`**

Open `src-next/app/App.tsx`. Read the tension via the existing store + new selector:

```tsx
import { useStore } from '../state/store';
import { selectScreen, selectIsBoss, selectTensionFromState } from '../state/selectors';
// ...
export function App() {
  useMotion();
  const screen = useStore(selectScreen);
  const isBoss = useStore(selectIsBoss);
  const tension = useStore(selectTensionFromState);

  const theme: ThemeKey = /* ...existing... */;

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <CosmosBackground theme={theme} density={1} nebula drift tension={tension} />
      {/* ...rest unchanged... */}
    </div>
  );
}
```

- [ ] **Step 3: Manual smoke**

Run: `npm run dev`. Begin a run, enter Round, intentionally do not score. As `handsLeft` ticks down (you may force-burn hands by repeatedly casting weak hands, or use dev console: `__ff.dispatch({ type: 'SCORE_HAND' })` from the round screen), verify:
- Background drift speeds up subtly.
- Once tension > 0.3, a faint crimson radial vignette fades in around the edges.
- Filter bites down on the bed audio at the same time (Task 4 wiring).

- [ ] **Step 4: Commit**

```bash
git add src-next/app/visual/CosmosBackground.tsx src-next/app/App.tsx
git commit -m "feat(visual): wire CosmosBackground to tension scalar (drift + crimson tint)"
```

---

## Task 11 — Final integration smoke + lint pass

**Files:** none new

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all tests pass (smoothstep ×3, selectTension ×6, selectTensionFromState ×2, useMotion ×2 = 13 total).

- [ ] **Step 2: Run typecheck + build**

Run: `npx tsc --noEmit`
Expected: no type errors.

Run: `npm run build`
Expected: build succeeds, no Vite errors.

- [ ] **Step 3: End-to-end manual verify**

Run: `npm run dev`. Walk through:
1. Title → click Begin Ascension → constellation-wipe transition fires.
2. Hub → click current blind → wipe again, lands on Round.
3. In Round, score is 0; tension > 0; verify crimson vignette and tightened filter on audio bed.
4. Use console `__ff.audio.setTension(0)` to confirm bed audio brightens.
5. Toggle OS reduce-motion. Reload. Repeat — verify all transitions ≤ 250ms, no idle die tumble, no pulse animations.

- [ ] **Step 4: Final commit (if any final-pass tweaks)**

```bash
git add -A
git commit -m "chore: Plan A foundations final integration pass"
```

---

## Verification Summary

After all 11 tasks:

- **Unit tests:** 13 passing (heat + selectors + useMotion).
- **Audio:** `__ff.audio.setTension(t)` audibly affects filter cutoff and layer mix targets across `t ∈ [0,1]`.
- **Visual:** Crimson vignette appears when `tension > 0.3`; starfield drift speeds with tension.
- **Motion:** OS-level reduce-motion preference auto-applies `.reduce-motion` to `<html>`; all CSS animations clamp to ≤80ms.
- **Transitions:** Every screen change runs the constellation-wipe (savored ~600ms; clamps to ~250ms under reduced-motion).
- **Materials:** `.mat-parchment / -brass / -velvet / -obsidian / -gold / -crystal` available as classes for later plans to apply.

This unblocks Plans B–J. No further coordination needed across plans for these primitives.
