# Plan B — Round HUD Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` syntax.

**Goal:** Restructure the Round HUD into the Floating-Focus layout (stats top-left, danger top-right, score floats top, tray dominates middle, loadout bottom-left, actions bottom-right). Wire `round.scoring` toggle so Plan A's tension peak fires on Cast.

**Architecture:** Split the monolithic `TopBar` into three corner components. Merge oracle + consumable rails into one `LoadoutDock`. Add `END_SCORING` action; `SCORE_HAND` now flips `scoring: true`, a Round-level effect dispatches `END_SCORING` after a fixed delay (Plan C will replace with ScoreMoment).

**Tech Stack:** React 18 + Zustand + TypeScript. CSS materials from Plan A.

---

## File Structure

| Path | Action |
|---|---|
| `src-next/actions/types.ts` | add `END_SCORING` action |
| `src-next/actions/handlers/roll.ts` | flip `scoring: true` in SCORE_HAND base state |
| `src-next/actions/handlers/index.ts` (or wherever handlers register) | route END_SCORING |
| `src-next/actions/handlers/round.ts` (existing or new) | END_SCORING handler clears `round.scoring` |
| `src-next/audio/heat.test.ts` | add 1 test confirming SCORE_HAND-then-END_SCORING toggles selectTension to/from 1 |
| `src-next/app/hud/StatsCorner.tsx` | **new** — top-left ante/blind/hand-pip/reroll-pip |
| `src-next/app/hud/DangerCorner.tsx` | **new** — top-right boss sigil placeholder + debuff glyphs + last-hand pip |
| `src-next/app/hud/ScoreFloat.tsx` | **new** — center-top score + target |
| `src-next/app/hud/LoadoutDock.tsx` | **new** — merged oracles + consumables, bottom-left |
| `src-next/app/screens/Round.tsx` | replace TopBar + OracleStrip + ConsumableTray with new components, reposition action buttons |
| (delete usage of) `src-next/app/hud/TopBar.tsx` in Round; keep file for Hub/Shop screens until those plans rewrite them |

---

## Task 1 — `END_SCORING` action wiring

**Files:**
- Modify: `src-next/actions/types.ts`
- Modify: `src-next/actions/handlers/roll.ts`

- [ ] **Step 1: Inspect existing action types** — read `src-next/actions/types.ts` to find the `Action` union and how new variants are added.

- [ ] **Step 2: Add END_SCORING type** — append a new variant `{ type: 'END_SCORING' }` to the `Action` union.

- [ ] **Step 3: Flip `scoring` in SCORE_HAND** — in `src-next/actions/handlers/roll.ts`, modify the `baseState` returned by `case 'SCORE_HAND'` so `round.scoring: true`. Apply only when the hand is not also a clear/bust (those terminal states should leave scoring as `true` momentarily — fine, END_SCORING will clear). Concretely, change:

```ts
        round: {
          ...s.round,
          score: newScore,
          handsLeft: newHandsLeft,
          ...
        },
```

to:

```ts
        round: {
          ...s.round,
          score: newScore,
          handsLeft: newHandsLeft,
          scoring: true,
          ...
        },
```

- [ ] **Step 4: Add END_SCORING handler** — in the same `roll.ts` file (or wherever round-state actions are routed), add a `case 'END_SCORING':` branch that returns `{ state: { ...s, round: { ...s.round, scoring: false } }, events: [] }`.

- [ ] **Step 5: Verify dispatch routing** — read `src-next/actions/dispatch.ts` to confirm new action types are routed to `rollHandler` (or whichever handler registered `SCORE_HAND`). If a switch/case lookup is hand-rolled, add `END_SCORING`.

- [ ] **Step 6: Test in heat.test.ts**

Append:
```ts
import { selectTensionFromState } from '../state/selectors';

describe('selectTensionFromState x scoring lifecycle', () => {
  it('returns 1 immediately after SCORE_HAND sets scoring=true', () => {
    const s = {
      round: { score: 200, target: 1000, handsLeft: 2, handsMax: 4, scoring: true },
    } as unknown as Parameters<typeof selectTensionFromState>[0];
    expect(selectTensionFromState(s)).toBe(1);
  });
  it('returns gap×pace once END_SCORING clears scoring', () => {
    const s = {
      round: { score: 200, target: 1000, handsLeft: 2, handsMax: 4, scoring: false },
    } as unknown as Parameters<typeof selectTensionFromState>[0];
    expect(selectTensionFromState(s)).toBeGreaterThan(0);
    expect(selectTensionFromState(s)).toBeLessThan(1);
  });
});
```

- [ ] **Step 7: Run tests** — `npm test`. Expect 37 tests pass (35 + 2).

- [ ] **Step 8: Commit**

```bash
git add src-next/actions/types.ts src-next/actions/handlers/roll.ts src-next/actions/dispatch.ts src-next/audio/heat.test.ts
git commit -m "feat(round): toggle round.scoring on SCORE_HAND + END_SCORING action"
```

---

## Task 2 — `StatsCorner` component (top-left)

**Files:**
- Create: `src-next/app/hud/StatsCorner.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useStore } from '../../state/store';
import { selectAnte, selectBlindId, selectIsBoss, selectHandsLeft, selectRerollsLeft } from '../../state/selectors';
import { BLIND_DEFS, BOSS_BLINDS } from '../../data/blinds';
import { useStore as _ } from '../../state/store';

export function StatsCorner() {
  const ante     = useStore(selectAnte);
  const blindId  = useStore(selectBlindId);
  const isBoss   = useStore(selectIsBoss);
  const handsLeft = useStore(selectHandsLeft);
  const handsMax  = useStore((s) => s.round.handsMax);
  const rerolls   = useStore(selectRerollsLeft);
  const blindIdx  = useStore((s) => s.round.blindIndex);

  const blindName = isBoss
    ? BOSS_BLINDS.find((b) => b.id === blindId)?.name ?? 'Boss'
    : BLIND_DEFS[blindIdx]?.name ?? 'Blind';

  return (
    <div
      className="mat-obsidian"
      style={{
        position: 'absolute', top: 18, left: 18,
        padding: '10px 14px', borderRadius: 10,
        pointerEvents: 'auto', zIndex: 5,
      }}>
      <div className="f-mono uc" style={{ fontSize: 9, letterSpacing: '0.28em', color: '#bba8ff' }}>
        Ante {String(ante).padStart(2, '0')} · {blindName}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 6, alignItems: 'center' }}>
        <HandPips left={handsLeft} max={handsMax} />
        <RerollPips left={rerolls} />
      </div>
    </div>
  );
}

function HandPips({ left, max }: { left: number; max: number }) {
  return (
    <div className="has-tip" style={{ position: 'relative', display: 'flex', gap: 4 }}>
      {Array.from({ length: max }).map((_, i) => {
        const lit = i < left;
        const isLast = left === 1 && i === 0;
        return (
          <span
            key={i}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isLast ? '#e2334a' : lit ? '#7be3ff' : 'transparent',
              border: `1px solid ${isLast ? '#e2334a' : lit ? '#7be3ff' : 'rgba(149,119,255,0.4)'}`,
              boxShadow: isLast ? '0 0 8px #e2334a' : 'none',
              animation: isLast ? 'twinkle 1.4s ease-in-out infinite' : 'none',
            }}
          />
        );
      })}
      <span className="tip">{left} hand{left === 1 ? '' : 's'} left</span>
    </div>
  );
}

function RerollPips({ left }: { left: number }) {
  return (
    <div className="has-tip" style={{ position: 'relative', display: 'flex', gap: 4, alignItems: 'center' }}>
      <span className="f-mono" style={{ fontSize: 10, color: '#9577ff' }}>↻</span>
      {Array.from({ length: 2 }).map((_, i) => (
        <span key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: i < left ? '#9577ff' : 'transparent',
            border: '1px solid rgba(149,119,255,0.4)',
          }} />
      ))}
      <span className="tip">{left} reroll{left === 1 ? '' : 's'} left</span>
    </div>
  );
}
```

- [ ] **Step 2: Type/build sanity** — `npx tsc --noEmit` clean (only baseUrl warning).

- [ ] **Step 3: Commit**

```bash
git add src-next/app/hud/StatsCorner.tsx
git commit -m "feat(hud): add StatsCorner (top-left ante/blind/hand-pip/reroll-pip)"
```

---

## Task 3 — `DangerCorner` component (top-right)

**Files:**
- Create: `src-next/app/hud/DangerCorner.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useStore } from '../../state/store';
import { selectIsBoss, selectBlindId } from '../../state/selectors';
import { BOSS_BLINDS } from '../../data/blinds';
import { activeDebuffs } from '../../core/round/debuffs';
import type { GameState } from '../../state/store';

const selectDebuffsKey = (s: GameState): string => [...activeDebuffs(s)].sort().join(',');

const DEBUFF_GLYPHS: Record<string, { glyph: string; label: string }> = {
  no_rerolls: { glyph: '∅', label: 'No rerolls' },
  auto_unlock_after_roll: { glyph: '⌀', label: 'Auto-unlock after roll' },
  no_pairs: { glyph: '⊗', label: 'Pairs forsaken' },
  half_score: { glyph: '½', label: 'Half score' },
};

export function DangerCorner() {
  const isBoss = useStore(selectIsBoss);
  const blindId = useStore(selectBlindId);
  const debuffs = useStore(selectDebuffsKey);
  const debuffList = debuffs ? debuffs.split(',') : [];

  const bossDef = isBoss ? BOSS_BLINDS.find((b) => b.id === blindId) : null;

  return (
    <div style={{
      position: 'absolute', top: 18, right: 18,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
      pointerEvents: 'auto', zIndex: 5,
    }}>
      {bossDef && (
        <div
          className="mat-obsidian has-tip"
          style={{
            position: 'relative',
            padding: '8px 12px', borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 8,
            borderColor: 'rgba(226,51,74,0.6)',
            cursor: 'help',
          }}>
          <span style={{ fontSize: 22, color: '#e2334a', filter: 'drop-shadow(0 0 6px #e2334a)' }}>⛧</span>
          <span className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#ff8e9c' }}>
            Boss · {bossDef.name}
          </span>
          <span className="tip">{bossDef.description ?? 'Boss blind active'}</span>
        </div>
      )}
      {debuffList.length > 0 && (
        <div style={{ display: 'flex', gap: 4 }}>
          {debuffList.map((d) => {
            const meta = DEBUFF_GLYPHS[d] ?? { glyph: '⚠', label: d };
            return (
              <div key={d} className="has-tip" style={{ position: 'relative' }}>
                <span
                  className="mat-obsidian"
                  style={{
                    display: 'inline-grid', placeItems: 'center',
                    width: 24, height: 24, borderRadius: 6,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                    color: '#ff8e9c', borderColor: 'rgba(226,51,74,0.5)',
                  }}>
                  {meta.glyph}
                </span>
                <span className="tip">{meta.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: tsc clean.**

- [ ] **Step 3: Commit**

```bash
git add src-next/app/hud/DangerCorner.tsx
git commit -m "feat(hud): add DangerCorner (top-right boss sigil + debuff glyphs)"
```

---

## Task 4 — `ScoreFloat` component (center-top)

**Files:**
- Create: `src-next/app/hud/ScoreFloat.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useStore } from '../../state/store';
import { selectScore, selectTarget } from '../../state/selectors';

export function ScoreFloat() {
  const score = useStore(selectScore);
  const target = useStore(selectTarget);

  const pct = target > 0 ? Math.min(1, score / target) : 0;

  return (
    <div style={{
      position: 'absolute', top: 28, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      pointerEvents: 'none', zIndex: 5,
    }}>
      <div className="f-mono num" style={{
        fontSize: 56, lineHeight: 1, color: '#f3f0ff',
        textShadow: '0 0 24px rgba(123,227,255,0.5)',
        fontWeight: 700,
      }}>
        {score.toLocaleString()}
      </div>
      <div className="f-mono num" style={{
        fontSize: 13, color: '#ff7847', marginTop: 4, letterSpacing: '0.1em',
      }}>
        / {target ? target.toLocaleString() : '—'}
      </div>
      <div style={{
        marginTop: 6, width: 160, height: 2, borderRadius: 2,
        background: 'rgba(149,119,255,0.2)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct * 100}%`, height: '100%',
          background: pct >= 1 ? '#7be3ff' : '#f5c451',
          transition: 'width var(--snap, 120ms) var(--ease-snap, ease)',
        }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: tsc clean.**

- [ ] **Step 3: Commit**

```bash
git add src-next/app/hud/ScoreFloat.tsx
git commit -m "feat(hud): add ScoreFloat (center-top score + target + progress bar)"
```

---

## Task 5 — `LoadoutDock` component (bottom-left)

**Files:**
- Create: `src-next/app/hud/LoadoutDock.tsx`

- [ ] **Step 1: Create the component (merges OracleStrip + ConsumableTray functionality)**

```tsx
import { useState } from 'react';
import { useStore } from '../../state/store';
import { dispatch } from '../../actions/dispatch';
import { selectOracles } from '../../state/selectors';
import { lookupOracle } from '../../data/oracles';
import { lookupConsumable } from '../../core/consumables';
import type { GameState } from '../../state/store';

const selectConsumables = (s: GameState) => s.run.consumables;
const selectDiceCount = (s: GameState) => s.round.dice.length;

export function LoadoutDock() {
  const oracles = useStore(selectOracles);
  const consumables = useStore(selectConsumables);
  const diceCount = useStore(selectDiceCount);
  const [armed, setArmed] = useState<{ index: number; def: ReturnType<typeof lookupConsumable> } | null>(null);

  const onUseConsumable = (index: number) => {
    const id = consumables[index];
    if (!id) return;
    const def = lookupConsumable(id);
    if (!def) return;
    if (def.requiresTarget) { setArmed({ index, def }); return; }
    dispatch({ type: 'USE_CONSUMABLE', index });
  };
  const onTargetDie = (i: number) => {
    if (!armed) return;
    dispatch({ type: 'USE_CONSUMABLE', index: armed.index, targets: [i] });
    setArmed(null);
  };

  return (
    <>
      <div
        className="mat-obsidian"
        style={{
          position: 'absolute', bottom: 18, left: 18,
          padding: '10px 12px', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 10,
          pointerEvents: 'auto', zIndex: 5,
        }}>
        <span className="f-mono uc" style={{ fontSize: 8, letterSpacing: '0.28em', color: '#bba8ff' }}>Loadout</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {oracles.length === 0 && consumables.length === 0 && (
            <span className="f-mono" style={{ fontSize: 10, color: 'rgba(220,212,255,0.4)' }}>empty</span>
          )}
          {oracles.map((id, i) => {
            const o = lookupOracle(id);
            if (!o) return null;
            return (
              <div key={`o-${i}`} className="has-tip" style={{ position: 'relative' }}>
                <span style={{
                  display: 'inline-grid', placeItems: 'center',
                  width: 32, height: 32, borderRadius: 6,
                  background: `${o.color}25`,
                  border: `1px solid ${o.color}80`,
                  fontSize: 18, color: o.color,
                  filter: `drop-shadow(0 0 4px ${o.color})`,
                }}>{o.icon}</span>
                <span className="tip">{o.name} — {o.desc}</span>
              </div>
            );
          })}
          {consumables.map((id, i) => {
            const def = lookupConsumable(id);
            if (!def) return null;
            const accent = def.type === 'tarot' ? '#cc88ff' : '#f5c451';
            return (
              <button
                key={`c-${i}`}
                onClick={() => onUseConsumable(i)}
                className="has-tip"
                style={{
                  position: 'relative', display: 'inline-grid', placeItems: 'center',
                  width: 32, height: 32, borderRadius: 6,
                  background: `${accent}25`,
                  border: `1px solid ${accent}80`,
                  fontSize: 18, color: accent, cursor: 'pointer',
                }}>
                {def.icon}
                <span className="tip">{def.name} — {def.description}</span>
              </button>
            );
          })}
        </div>
      </div>
      {armed && (
        <div
          className="mat-crystal"
          style={{
            position: 'absolute', top: 96, left: '50%', transform: 'translateX(-50%)',
            padding: '8px 14px', borderRadius: 8, zIndex: 6, pointerEvents: 'auto',
          }}>
          <span className="f-mono uc" style={{ fontSize: 11, letterSpacing: '0.18em', color: '#7be3ff' }}>
            select a die for {armed.def?.name}
          </span>
          <button onClick={() => setArmed(null)} className="f-mono" style={{
            marginLeft: 12, fontSize: 10, color: '#bba8ff', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer',
          }}>cancel</button>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'center' }}>
            {Array.from({ length: diceCount }).map((_, i) => (
              <button key={i} onClick={() => onTargetDie(i)}
                className="mat-gold mat-interactive"
                style={{
                  width: 36, height: 36, borderRadius: 6,
                  fontFamily: "'Cinzel', serif", fontSize: 18, cursor: 'pointer',
                }}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: tsc clean.**

- [ ] **Step 3: Commit**

```bash
git add src-next/app/hud/LoadoutDock.tsx
git commit -m "feat(hud): add LoadoutDock (bottom-left merged oracles + consumables)"
```

---

## Task 6 — Refactor `Round.tsx` to use new corners

**Files:**
- Modify: `src-next/app/screens/Round.tsx`

- [ ] **Step 1: Replace TopBar/OracleStrip/ConsumableTray usage with new corners + ScoreFloat + LoadoutDock**

Open `src-next/app/screens/Round.tsx` and replace the entire file contents with:

```tsx
import { useEffect, useRef } from 'react';
import { dispatch } from '../../actions/dispatch';
import { useStore } from '../../state/store';
import { StatsCorner } from '../hud/StatsCorner';
import { DangerCorner } from '../hud/DangerCorner';
import { ScoreFloat } from '../hud/ScoreFloat';
import { LoadoutDock } from '../hud/LoadoutDock';
import { ComboBanner } from '../hud/ComboBanner';
import { ConstellationOverlay } from '../hud/ConstellationOverlay';
import {
  selectHandsLeft, selectRerollsLeft, selectIsBoss,
} from '../../state/selectors';

export function Round() {
  const hands   = useStore(selectHandsLeft);
  const rerolls = useStore(selectRerollsLeft);
  const isBoss  = useStore(selectIsBoss);
  const scoring = useStore((s) => s.round.scoring);
  const accent = isBoss ? '#e2334a' : '#7be3ff';

  // Auto-roll when handsLeft changes (existing behavior)
  const lastHandsRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastHandsRef.current !== hands && hands > 0) {
      lastHandsRef.current = hands;
      dispatch({ type: 'ROLL_REQUESTED' });
    }
  }, [hands]);

  // Clear scoring flag ~1.6s after a SCORE_HAND fires (Plan C will own the full sequence).
  useEffect(() => {
    if (!scoring) return;
    const t = window.setTimeout(() => dispatch({ type: 'END_SCORING' }), 1600);
    return () => window.clearTimeout(t);
  }, [scoring]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <StatsCorner />
      <DangerCorner />
      <ScoreFloat />
      <LoadoutDock />
      <ComboBanner accent={accent} />
      <ConstellationOverlay />
      <DiceLockOverlay />
      <ActionBar hands={hands} rerolls={rerolls} accent={accent} />
    </div>
  );
}

function ActionBar({ hands, rerolls, accent }: { hands: number; rerolls: number; accent: string }) {
  return (
    <div
      style={{
        position: 'absolute', right: 18, bottom: 18,
        display: 'flex', gap: 12, zIndex: 5, pointerEvents: 'auto',
      }}>
      <button
        className="btn btn-ghost mat-interactive"
        disabled={rerolls === 0 || hands === 0}
        onClick={() => dispatch({ type: 'REROLL_REQUESTED' })}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: accent }}>↻</span> Reroll
          <span className="f-mono" style={{ fontSize: 11, opacity: 0.7 }}>({rerolls})</span>
        </span>
      </button>
      <button
        className="btn btn-primary mat-interactive"
        disabled={hands === 0}
        onClick={() => dispatch({ type: 'SCORE_HAND' })}>
        ✦ Cast Hand
      </button>
    </div>
  );
}

function DiceLockOverlay() {
  const dice = useStore((s) => s.round.dice);
  const trayY = window.innerHeight / 2 + 80;
  const startX = window.innerWidth / 2 - (dice.length - 1) * 70;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 4 }}>
      {dice.map((d, i) => (
        <button
          key={i}
          onClick={() => dispatch({ type: 'TOGGLE_LOCK', dieIdx: i })}
          className="f-mono uc"
          style={{
            position: 'absolute',
            left: startX + i * 140 - 32,
            top: trayY,
            width: 64, padding: '4px 0', textAlign: 'center',
            fontSize: 9, letterSpacing: '0.2em', borderRadius: 6,
            background: d.locked ? 'rgba(123,227,255,0.18)' : 'rgba(28,18,69,0.6)',
            border: `1px solid ${d.locked ? '#7be3ff' : 'rgba(149,119,255,0.3)'}`,
            color: d.locked ? '#7be3ff' : '#bba8ff',
            cursor: 'pointer', pointerEvents: 'auto',
          }}>
          {d.locked ? '◆ locked' : 'lock'}
        </button>
      ))}
    </div>
  );
}
```

(Note: removed boss-name banner duplication since DangerCorner shows it; removed center title since ScoreFloat owns that; removed standalone debuff warning since DangerCorner glyphs cover it.)

- [ ] **Step 2: Run typecheck + build + test**

`npx tsc --noEmit` clean. `npm run build` succeeds. `npm test` passes.

- [ ] **Step 3: Manual smoke (or document if no browser)**

Run `npm run dev`. Begin Ascension → Hub → Begin blind. Verify:
- Stats top-left (ante/blind/pips).
- Boss sigil top-right when boss blind active; debuff glyph row below it.
- Score floats center-top.
- Loadout dock bottom-left with oracle/consumable tooltips.
- Reroll + Cast bottom-right.
- 3D tray dominates middle, lock chips align under dice.
- Cast Hand → tension peaks to 1 (audible filter close); after ~1.6s, returns to baseline.

- [ ] **Step 4: Commit**

```bash
git add src-next/app/screens/Round.tsx
git commit -m "feat(round): adopt floating-focus HUD layout (corners + dock + actions)"
```

---

## Verification

End-to-end after all 6 tasks:
1. `npm test` — 37 tests pass.
2. `npx tsc --noEmit` — only baseUrl warning.
3. `npm run build` — succeeds.
4. Dev preview: Round screen shows new layout. Boss reveals show DangerCorner. Cast Hand triggers `scoring=true` in store; tension goes to 1 and back via the END_SCORING dispatch.
5. Hover sigils/glyphs → tooltips render.
