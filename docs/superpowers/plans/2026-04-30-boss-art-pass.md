# Boss Art Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder boss sigils + Unicode icons with hand-drawn astronomic-mechanical SVG art for all 7 bosses, plus reveal/idle CSS animations.

**Architecture:** Reshape `BossBlind` data (typed sigil groups + small `iconGlyph`); rewrite existing `BossSigil` component to render group-classed SVG so CSS targets specific elements; add `BossIcon` component for inline use; add 6 CSS @keyframes gated by existing `.reduce-motion` class hook.

**Tech Stack:** TypeScript, React 18, Vitest + jsdom, @testing-library/react, plain CSS (no animation library).

**Branch:** `feat/boss-art-pass` (already created from main). Spec committed at `cb0dcc0`.

**Spec coverage check:** 5–6 commits planned — data shape (T1) → BossIcon (T2) → BossSigil rewrite (T3) → CSS animations (T4) → DangerCorner icon swap (T5) → smoke (T6).

---

## File Structure

```
src-next/
├── data/
│   ├── blinds.ts                       MODIFIED — type changes + 7 entries redrawn
│   └── blinds.test.ts                  CREATED  — shape contract test
├── app/visual/
│   ├── BossSigil.tsx                   REWRITTEN — new prop API, group-classed render
│   ├── BossSigil.test.tsx              CREATED  — render + animation class tests
│   ├── BossIcon.tsx                    CREATED  — small inline 16px glyph
│   └── BossIcon.test.tsx               CREATED  — render test
├── app/hud/
│   ├── BossReveal.tsx                  MODIFIED — pass animate='both' prop
│   └── DangerCorner.tsx                MODIFIED — switch BossSigil→BossIcon, animate='idle' on remaining sigils
└── styles/index.css                    APPENDED — 6 @keyframes + 4 class hooks + reduce-motion gate
```

---

## Task 1: Data shape change + 7 entries redrawn

**Files:**
- Modify: `src-next/data/blinds.ts` (full rewrite of types + BOSS_BLINDS array)
- Create: `src-next/data/blinds.test.ts`

This task changes the public `BossBlind` shape. TS will flag every consumer in T3 / T5 — that is intentional (compile fence forces consumer sweep).

- [ ] **Step 1: Write the failing shape contract test**

Create `src-next/data/blinds.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { BOSS_BLINDS } from './blinds';

describe('BOSS_BLINDS shape contract', () => {
  it('has 7 entries', () => {
    expect(BOSS_BLINDS).toHaveLength(7);
  });

  it('every entry has iconGlyph with paths', () => {
    for (const b of BOSS_BLINDS) {
      expect(b.iconGlyph.viewBox).toMatch(/^\d+ \d+ \d+ \d+$/);
      expect(b.iconGlyph.paths.length).toBeGreaterThan(0);
    }
  });

  it('every sigil has at least one body-core group', () => {
    for (const b of BOSS_BLINDS) {
      const hasBody = b.sigil.groups.some((g) => g.class === 'body-core');
      expect(hasBody, `${b.id} missing body-core`).toBe(true);
    }
  });

  it('every sigil has at least one orbit-class group', () => {
    for (const b of BOSS_BLINDS) {
      const hasOrbit = b.sigil.groups.some(
        (g) => g.class === 'orbit-main' || g.class === 'orbit-aux',
      );
      expect(hasOrbit, `${b.id} missing orbit-main/orbit-aux`).toBe(true);
    }
  });

  it('every group class is a valid SigilGroupClass literal', () => {
    const valid = new Set(['orbit-main', 'orbit-aux', 'body-core', 'satellite', 'mark']);
    for (const b of BOSS_BLINDS) {
      for (const g of b.sigil.groups) {
        expect(valid.has(g.class), `${b.id}: invalid class "${g.class}"`).toBe(true);
      }
    }
  });

  it('no entry retains the legacy Unicode icon field', () => {
    for (const b of BOSS_BLINDS) {
      expect((b as Record<string, unknown>).icon).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src-next/data/blinds.test.ts`
Expected: FAIL — current `BossBlind.icon` is the Unicode string field (still exists), `sigil.paths` (no `groups`), no `iconGlyph`. Tests reference `.iconGlyph` and `.sigil.groups` which don't exist; TypeScript compilation errors.

- [ ] **Step 3: Update types in `src-next/data/blinds.ts`**

Replace the existing `BossBlind` type (lines 22–30 in current file) and the `BOSS_BLINDS` array. Keep `BlindDef`, `BLIND_DEFS`, `ANTE_BASE_TARGETS`, `targetForBlind`, `blindDefAt`, `pickBoss` exactly as-is.

Full file content for `src-next/data/blinds.ts`:

```ts
export type BlindDef = {
  index: number;
  name: string;
  targetMult: number;
  isBoss: boolean;
  skipReward: number;
};

export const BLIND_DEFS: BlindDef[] = [
  { index: 0, name: 'Small Blind', targetMult: 1.0, isBoss: false, skipReward: 3 },
  { index: 1, name: 'Big Blind',   targetMult: 1.5, isBoss: false, skipReward: 5 },
  { index: 2, name: 'Boss Blind',  targetMult: 2.0, isBoss: true,  skipReward: 0 },
];

export const ANTE_BASE_TARGETS: number[][] = [
  [300,   600,   1000 ],
  [1200,  2000,  3500 ],
  [4000,  6000,  10000],
  [12000, 16000, 30000],
];

export type SigilGroupClass =
  | 'orbit-main'
  | 'orbit-aux'
  | 'body-core'
  | 'satellite'
  | 'mark';

export type SigilGroup = {
  class: SigilGroupClass;
  paths: string[];
  strokeWidth?: number;   // default 1.5
  opacity?: number;       // default 1
  dashed?: boolean;       // applies stroke-dasharray "2 4"
  filled?: boolean;       // when true: fill=boss.color, stroke=none
};

export type BossBlind = {
  id: string;
  name: string;
  iconGlyph: { viewBox: string; paths: string[] };
  color: string;
  description: string;
  debuffs: string[];
  sigil: { viewBox: string; groups: SigilGroup[] };
};

export const BOSS_BLINDS: BossBlind[] = [
  {
    id: 'pluto', name: 'Pluto', color: '#44bb66',
    description: 'Demoted. 1s refuse to transform.', debuffs: ['no_mod_transforms_on_ones'],
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 7 12 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0',
      'M 17 12 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
      'M 11 12 L 17 12',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-main', paths: ['M 32 50 L 68 50'] },
        { class: 'body-core',  paths: ['M 21 50 a 11 11 0 1 0 22 0 a 11 11 0 1 0 -22 0'] },
        { class: 'satellite',  paths: ['M 62 50 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0'] },
        { class: 'mark', opacity: 0.7, paths: [
          'M 64 44 L 60 40',
          'M 72 44 L 76 40',
          'M 64 56 L 60 60',
          'M 72 56 L 76 60',
        ]},
        { class: 'mark', filled: true, paths: ['M 29.5 50 a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0'] },
      ],
    },
  },
  {
    id: 'ceres', name: 'Ceres', color: '#ffaa44',
    description: 'Belt-bound. Hand capped at 4.', debuffs: ['hand_size_cap_4'],
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 12 12 m -2 0 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
      'M 21 12 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0',
      'M 12 3 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0',
      'M 1 12 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0',
      'M 12 21 a 1 1 0 1 0 2 0 a 1 1 0 1 0 -2 0',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-aux', dashed: true, opacity: 0.5, paths: [
          'M 50 12 a 38 38 0 1 0 0 76 a 38 38 0 1 0 0 -76',
        ]},
        { class: 'body-core', filled: true, paths: ['M 45 50 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0'] },
        { class: 'satellite', filled: true, paths: ['M 85 50 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0'] },
        { class: 'mark', filled: true, paths: [
          'M 47 12 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
          'M 9 50 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
          'M 47 88 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
        ]},
      ],
    },
  },
  {
    id: 'triton', name: 'Triton', color: '#aa6644',
    description: 'Single flyby. No rerolls.', debuffs: ['no_rerolls'],
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 12 4 A 8 8 0 0 0 4 12',
      'M 4 12 A 8 8 0 0 0 12 20',
      'M 12 20 A 8 8 0 0 0 20 12',
      'M 20 12 L 17 9',
      'M 20 12 L 17 15',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-main', paths: [
          'M 50 14 A 36 36 0 0 0 14 50',
          'M 14 50 A 36 36 0 0 0 50 86',
          'M 50 86 A 36 36 0 0 0 86 50',
        ]},
        { class: 'body-core', paths: ['M 41 50 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0'] },
        { class: 'body-core', filled: true, paths: ['M 46.5 50 a 3.5 3.5 0 1 0 7 0 a 3.5 3.5 0 1 0 -7 0'] },
        { class: 'mark', strokeWidth: 2, paths: [
          'M 86 50 L 80 44',
          'M 86 50 L 80 56',
        ]},
      ],
    },
  },
  {
    id: 'phobos', name: 'Phobos', color: '#cc2244',
    description: 'Orbit decays. Locks release on roll.', debuffs: ['auto_unlock_after_roll'],
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 12 4 a 8 8 0 1 1 -0.01 0',
      'M 12 8 a 4 4 0 1 1 -0.01 0',
      'M 20 12 L 23 9',
      'M 20 12 L 23 15',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-main', opacity: 0.85, paths: [
          'M 50 18 a 32 32 0 1 1 -0.01 0',
          'M 50 24 a 26 26 0 1 1 -0.01 0',
          'M 50 30 a 20 20 0 1 1 -0.01 0',
        ]},
        { class: 'body-core', paths: ['M 39 50 a 11 11 0 1 0 22 0 a 11 11 0 1 0 -22 0'] },
        { class: 'body-core', filled: true, paths: ['M 47 50 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0'] },
        { class: 'mark', strokeWidth: 2, paths: [
          'M 82 50 L 88 44',
          'M 82 50 L 88 56',
        ]},
      ],
    },
  },
  {
    id: 'callisto', name: 'Callisto', color: '#aa66ff',
    description: 'Cratered silence. Catalysts inert.', debuffs: ['disable_catalysts'],
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 12 4 a 8 8 0 1 0 0.01 0',
      'M 8 9 a 1.5 1.5 0 1 0 3 0 a 1.5 1.5 0 1 0 -3 0',
      'M 14 13 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'body-core', paths: ['M 18 50 a 32 32 0 1 0 64 0 a 32 32 0 1 0 -64 0'] },
        { class: 'mark', opacity: 0.7, strokeWidth: 1, paths: [
          'M 33 40 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0',
          'M 59 36 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
          'M 50 62 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0',
          'M 31 62 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
          'M 65.5 58 a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0',
        ]},
        { class: 'mark', strokeWidth: 2, opacity: 0.85, paths: ['M 42 48 L 58 52'] },
      ],
    },
  },
  {
    id: 'eris', name: 'Eris', color: '#ff7847',
    description: 'Catalysts inert on first hand.', debuffs: ['disable_catalysts_first_hand'],
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 3 14 A 11 6 -25 1 0 21 10',
      'M 12 12 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-main', paths: ['M 50 14 A 38 22 -25 1 0 86 60'] },
        { class: 'orbit-aux', dashed: true, opacity: 0.4, paths: ['M 86 60 A 38 22 -25 0 0 50 14'] },
        { class: 'body-core', filled: true, paths: ['M 45 50 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0'] },
        { class: 'satellite', filled: true, paths: ['M 83.5 60 a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0'] },
        { class: 'mark', strokeWidth: 2, paths: [
          'M 46 10 L 54 18',
          'M 54 10 L 46 18',
        ]},
      ],
    },
  },
  {
    id: 'sedna', name: 'Sedna', color: '#4477cc',
    description: 'Mod slots capped at 1.', debuffs: ['mod_slots_capped_1'],
    iconGlyph: { viewBox: '0 0 24 24', paths: [
      'M 12 12 m -10 -2 a 10 4 -15 1 0 20 4 a 10 4 -15 1 0 -20 -4',
      'M 12 12 a 1.5 1.5 0 1 0 3 0 a 1.5 1.5 0 1 0 -3 0',
    ]},
    sigil: {
      viewBox: '0 0 100 100',
      groups: [
        { class: 'orbit-main', paths: [
          'M 8 50 a 42 14 -15 1 0 84 0 a 42 14 -15 1 0 -84 0',
        ]},
        { class: 'body-core', filled: true, paths: ['M 46 50 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0'] },
        { class: 'satellite', filled: true, paths: ['M 84 40 a 2 2 0 1 0 4 0 a 2 2 0 1 0 -4 0'] },
        { class: 'mark', strokeWidth: 2.5, paths: ['M 20 50 L 80 50'] },
      ],
    },
  },
];

export function targetForBlind(ante: number, blindIndex: number): number {
  const row = ANTE_BASE_TARGETS[Math.min(ante, ANTE_BASE_TARGETS.length) - 1]!;
  const base = row[blindIndex]!;
  return Math.ceil(base * BLIND_DEFS[blindIndex]!.targetMult);
}

export function blindDefAt(idx: number): BlindDef {
  return BLIND_DEFS[idx]!;
}

export function pickBoss(rng: () => number): BossBlind {
  return BOSS_BLINDS[Math.floor(rng() * BOSS_BLINDS.length)]!;
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npx vitest run src-next/data/blinds.test.ts`
Expected: PASS — all 6 contract tests green.

- [ ] **Step 5: Run full suite — confirm shape change has not broken non-render code paths**

Run: `npx vitest run`
Expected: failures will surface only in render/component tests that read the old shape. Existing tests at `src-next/core/round/transitions.test.ts` and others mock state shape locally and do NOT instantiate `BossBlind`, so they should remain green. If anything outside `src-next/app/visual/BossSigil.tsx` and consumers fails, investigate before continuing.

- [ ] **Step 6: Run typecheck — confirm consumer break is contained**

Run: `npx tsc --noEmit 2>&1 | grep -E "blinds|BossSigil|BossReveal|DangerCorner"`
Expected: errors in `src-next/app/visual/BossSigil.tsx` (reads `boss.sigil.paths` — field renamed to `groups`) and any other consumer reading `boss.icon` (Unicode field deleted). Note paths for T3.

- [ ] **Step 7: Commit**

```bash
git add src-next/data/blinds.ts src-next/data/blinds.test.ts
git commit -m "feat(bosses): reshape BossBlind to typed sigil groups + iconGlyph

Add SigilGroupClass union ('orbit-main' | 'orbit-aux' | 'body-core' |
'satellite' | 'mark') so CSS animations can target specific elements.
Replace sigil.paths with sigil.groups[]. Replace Unicode icon string
with iconGlyph (viewBox + paths). Redraw all 7 entries with
hybrid astronomy + debuff-overlay sigils per design spec.

BossSigil.tsx will TS-error until T3 rewrite — intentional fence."
```

---

## Task 2: BossIcon component (16px inline glyph)

**Files:**
- Create: `src-next/app/visual/BossIcon.tsx`
- Create: `src-next/app/visual/BossIcon.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src-next/app/visual/BossIcon.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BossIcon } from './BossIcon';
import type { BossBlind } from '../../data/blinds';

const fakeBoss: BossBlind = {
  id: 'test', name: 'Test', color: '#ff7847',
  description: '', debuffs: [],
  iconGlyph: { viewBox: '0 0 24 24', paths: ['M 0 0 L 24 24', 'M 12 0 L 12 24'] },
  sigil: { viewBox: '0 0 100 100', groups: [
    { class: 'body-core', paths: ['M 50 50 L 50 50'] },
  ]},
};

describe('BossIcon', () => {
  it('renders one path per iconGlyph.paths entry', () => {
    const { container } = render(<BossIcon boss={fakeBoss} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2);
  });

  it('uses iconGlyph.viewBox on the svg', () => {
    const { container } = render(<BossIcon boss={fakeBoss} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
  });

  it('applies boss color as stroke', () => {
    const { container } = render(<BossIcon boss={fakeBoss} />);
    const path = container.querySelector('path');
    expect(path?.getAttribute('stroke')).toBe('#ff7847');
  });

  it('defaults size to 16 and accepts override', () => {
    const { container, rerender } = render(<BossIcon boss={fakeBoss} />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('16');
    rerender(<BossIcon boss={fakeBoss} size={32} />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('32');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src-next/app/visual/BossIcon.test.tsx`
Expected: FAIL — `Cannot find module './BossIcon'`.

- [ ] **Step 3: Implement `src-next/app/visual/BossIcon.tsx`**

```tsx
import type { BossBlind } from '../../data/blinds';

export function BossIcon({ boss, size = 16 }: { boss: BossBlind; size?: number }) {
  return (
    <svg
      viewBox={boss.iconGlyph.viewBox}
      width={size}
      height={size}
      style={{ overflow: 'visible' }}
      aria-label={boss.name}
      role="img">
      {boss.iconGlyph.paths.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke={boss.color}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npx vitest run src-next/app/visual/BossIcon.test.tsx`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src-next/app/visual/BossIcon.tsx src-next/app/visual/BossIcon.test.tsx
git commit -m "feat(bosses): add BossIcon component for 16px inline glyph rendering"
```

---

## Task 3: Rewrite BossSigil with grouped rendering + animate prop

**Files:**
- Modify: `src-next/app/visual/BossSigil.tsx` (full rewrite)
- Create: `src-next/app/visual/BossSigil.test.tsx`
- Modify: `src-next/app/hud/BossReveal.tsx:63` (update prop usage)
- Modify: `src-next/app/hud/DangerCorner.tsx:41` (update prop usage)

This task changes the public component API. CSS keyframes are NOT yet added (T4). Static rendering only — `animate` prop is parsed but only adds class names; no animation runs yet.

- [ ] **Step 1: Write the failing test**

Create `src-next/app/visual/BossSigil.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BossSigil } from './BossSigil';
import type { BossBlind } from '../../data/blinds';

const fakeBoss: BossBlind = {
  id: 'test', name: 'Test', color: '#ff7847',
  description: '', debuffs: [],
  iconGlyph: { viewBox: '0 0 24 24', paths: ['M 0 0 L 24 24'] },
  sigil: {
    viewBox: '0 0 100 100',
    groups: [
      { class: 'orbit-main', paths: ['M 10 50 L 90 50'] },
      { class: 'body-core', filled: true, paths: ['M 45 50 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0'] },
      { class: 'satellite', paths: ['M 80 50 L 80 50'] },
      { class: 'mark', dashed: true, opacity: 0.5, paths: ['M 0 0 L 100 100'] },
    ],
  },
};

describe('BossSigil', () => {
  it('renders one <g> per sigil group with correct class hook', () => {
    const { container } = render(<BossSigil boss={fakeBoss} />);
    expect(container.querySelector('.boss-sigil__orbit-main')).toBeTruthy();
    expect(container.querySelector('.boss-sigil__body-core')).toBeTruthy();
    expect(container.querySelector('.boss-sigil__satellite')).toBeTruthy();
    expect(container.querySelector('.boss-sigil__mark')).toBeTruthy();
  });

  it('renders one <path> per group path', () => {
    const { container } = render(<BossSigil boss={fakeBoss} />);
    expect(container.querySelectorAll('path').length).toBe(4);
  });

  it('filled groups get fill=color, stroke=none; non-filled get stroke=color, fill=none', () => {
    const { container } = render(<BossSigil boss={fakeBoss} />);
    const filledPath = container.querySelector('.boss-sigil__body-core path');
    expect(filledPath?.getAttribute('fill')).toBe('#ff7847');
    expect(filledPath?.getAttribute('stroke')).toBe('none');

    const strokedPath = container.querySelector('.boss-sigil__orbit-main path');
    expect(strokedPath?.getAttribute('stroke')).toBe('#ff7847');
    expect(strokedPath?.getAttribute('fill')).toBe('none');
  });

  it('dashed groups apply stroke-dasharray', () => {
    const { container } = render(<BossSigil boss={fakeBoss} />);
    const dashedPath = container.querySelector('.boss-sigil__mark path');
    expect(dashedPath?.getAttribute('stroke-dasharray')).toBe('2 4');
  });

  it("animate='idle' adds .boss-sigil--idle-on but not .boss-sigil--reveal", () => {
    const { container } = render(<BossSigil boss={fakeBoss} animate="idle" />);
    const root = container.querySelector('.boss-sigil');
    expect(root?.classList.contains('boss-sigil--idle-on')).toBe(true);
    expect(root?.classList.contains('boss-sigil--reveal')).toBe(false);
  });

  it("animate='reveal' adds .boss-sigil--reveal but not .boss-sigil--idle-on", () => {
    const { container } = render(<BossSigil boss={fakeBoss} animate="reveal" />);
    const root = container.querySelector('.boss-sigil');
    expect(root?.classList.contains('boss-sigil--reveal')).toBe(true);
    expect(root?.classList.contains('boss-sigil--idle-on')).toBe(false);
  });

  it("animate='both' adds both classes", () => {
    const { container } = render(<BossSigil boss={fakeBoss} animate="both" />);
    const root = container.querySelector('.boss-sigil');
    expect(root?.classList.contains('boss-sigil--idle-on')).toBe(true);
    expect(root?.classList.contains('boss-sigil--reveal')).toBe(true);
  });

  it("animate='none' adds neither class", () => {
    const { container } = render(<BossSigil boss={fakeBoss} animate="none" />);
    const root = container.querySelector('.boss-sigil');
    expect(root?.classList.contains('boss-sigil--idle-on')).toBe(false);
    expect(root?.classList.contains('boss-sigil--reveal')).toBe(false);
  });

  it('default animate is "idle"', () => {
    const { container } = render(<BossSigil boss={fakeBoss} />);
    const root = container.querySelector('.boss-sigil');
    expect(root?.classList.contains('boss-sigil--idle-on')).toBe(true);
  });

  it('exposes --boss-color CSS variable on the svg root', () => {
    const { container } = render(<BossSigil boss={fakeBoss} />);
    const svg = container.querySelector('svg.boss-sigil') as SVGSVGElement;
    expect(svg.style.getPropertyValue('--boss-color')).toBe('#ff7847');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src-next/app/visual/BossSigil.test.tsx`
Expected: FAIL — current BossSigil reads `boss.sigil.paths` (TS error), no class hooks, no `animate` prop.

- [ ] **Step 3: Rewrite `src-next/app/visual/BossSigil.tsx`**

Full file replacement:

```tsx
import type { BossBlind, SigilGroup } from '../../data/blinds';

export type BossSigilAnimate = 'none' | 'idle' | 'reveal' | 'both';

type Props = {
  boss: BossBlind;
  size?: number;
  animate?: BossSigilAnimate;
  glow?: boolean;
};

export function BossSigil({
  boss,
  size = 96,
  animate = 'idle',
  glow = true,
}: Props) {
  const reveal = animate === 'reveal' || animate === 'both';
  const idle = animate === 'idle' || animate === 'both';

  const className = [
    'boss-sigil',
    idle && 'boss-sigil--idle-on',
    reveal && 'boss-sigil--reveal',
  ].filter(Boolean).join(' ');

  const filter = glow ? `drop-shadow(0 0 ${Math.max(4, size / 8)}px ${boss.color})` : 'none';

  return (
    <svg
      className={className}
      viewBox={boss.sigil.viewBox}
      width={size}
      height={size}
      style={{
        // CSS variable for keyframes / theming
        ['--boss-color' as string]: boss.color,
        filter,
        overflow: 'visible',
      } as React.CSSProperties}
      aria-label={boss.name}
      role="img">
      {boss.sigil.groups.map((group, i) => (
        <SigilGroupG key={i} group={group} bossColor={boss.color} />
      ))}
    </svg>
  );
}

function SigilGroupG({ group, bossColor }: { group: SigilGroup; bossColor: string }) {
  const stroke = group.filled ? 'none' : bossColor;
  const fill = group.filled ? bossColor : 'none';
  const strokeWidth = group.strokeWidth ?? 1.5;
  const strokeDasharray = group.dashed ? '2 4' : undefined;

  return (
    <g
      className={`boss-sigil__${group.class}`}
      style={{ opacity: group.opacity ?? 1 }}>
      {group.paths.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke={stroke}
          fill={fill}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}
```

- [ ] **Step 4: Update consumer call sites to new API**

Modify `src-next/app/hud/BossReveal.tsx` line 63 — replace:

```tsx
<BossSigil boss={def} size={180} drawIn drawDurationMs={1200} glow />
```

With:

```tsx
<BossSigil boss={def} size={180} animate="both" glow />
```

Modify `src-next/app/hud/DangerCorner.tsx` line 41 — replace:

```tsx
<BossSigil boss={bossDef} size={28} rotate glow />
```

With:

```tsx
<BossSigil boss={bossDef} size={28} animate="idle" glow />
```

(In T5 we further switch DangerCorner from BossSigil to BossIcon; for now we just update the prop API so it compiles.)

- [ ] **Step 5: Run BossSigil tests — verify they pass**

Run: `npx vitest run src-next/app/visual/BossSigil.test.tsx`
Expected: PASS — all 9 tests green.

- [ ] **Step 6: Run full suite — confirm consumers compile**

Run: `npx vitest run`
Expected: 100% green; same count as before T1 plus the new BossIcon (4) + BossSigil (9) + blinds (6) tests.

- [ ] **Step 7: Run typecheck — verify no remaining errors related to art pass**

Run: `npx tsc --noEmit 2>&1 | grep -E "BossSigil|BossReveal|DangerCorner|blinds"`
Expected: no output (pre-existing unrelated TS errors elsewhere in the repo are still tolerated, but nothing on touched files).

- [ ] **Step 8: Commit**

```bash
git add src-next/app/visual/BossSigil.tsx src-next/app/visual/BossSigil.test.tsx \
        src-next/app/hud/BossReveal.tsx src-next/app/hud/DangerCorner.tsx
git commit -m "refactor(bosses): rewrite BossSigil with grouped rendering + animate prop

New prop API: animate='none'|'idle'|'reveal'|'both' (default 'idle').
Each sigil group renders as <g class=boss-sigil__<class>> so CSS in
T4 can target specific elements (orbit rotation, body breathe, etc.).
Filled groups apply fill=color/stroke=none; dashed groups apply
stroke-dasharray; opacity per group.

Updated BossReveal (animate='both') and DangerCorner (animate='idle')
to new API. CSS keyframes follow in T4 — animation classes are present
but no rules target them yet."
```

---

## Task 4: CSS animations + reduce-motion gate

**Files:**
- Modify: `src-next/styles/index.css` (append)

The CSS file already has `.reduce-motion` class on `<html>` driven by the `useMotion` hook. New animation rules use `:not(.reduce-motion)` ancestor to gate.

- [ ] **Step 1: Read current end of `src-next/styles/index.css`**

Run: `wc -l src-next/styles/index.css`
Note line count to know where to append.

- [ ] **Step 2: Append animation rules to `src-next/styles/index.css`**

Append the following block at end of file:

```css

/* ---- Boss sigil animations (T4) ----------------------------------- */

@keyframes sigilReveal {
  0%   { transform: scale(0.4) rotate(-12deg); opacity: 0; }
  60%  { transform: scale(1.1) rotate(2deg);   opacity: 1; }
  100% { transform: scale(1) rotate(0);         opacity: 1; }
}
@keyframes drawStroke {
  from { stroke-dashoffset: 240; }
  to   { stroke-dashoffset: 0; }
}
@keyframes drawDots {
  0%, 50% { opacity: 0; transform: scale(0); }
  100%    { opacity: 1; transform: scale(1); }
}
@keyframes idleRotate {
  from { transform: rotate(0); }
  to   { transform: rotate(360deg); }
}
@keyframes idleBreathe {
  0%, 100% { transform: scale(1);    opacity: 1; }
  50%      { transform: scale(1.08); opacity: 0.85; }
}
@keyframes satOrbit {
  from { transform: rotate(0); }
  to   { transform: rotate(-360deg); }
}

.boss-sigil__orbit-main,
.boss-sigil__orbit-aux,
.boss-sigil__satellite {
  transform-origin: 50% 50%;
}
.boss-sigil__body-core {
  transform-origin: 50px 50px;
  transform-box: view-box;
}

html:not(.reduce-motion) .boss-sigil--idle-on .boss-sigil__orbit-main {
  animation: idleRotate 24s linear infinite;
}
html:not(.reduce-motion) .boss-sigil--idle-on .boss-sigil__orbit-aux {
  animation: idleRotate 36s linear infinite reverse;
}
html:not(.reduce-motion) .boss-sigil--idle-on .boss-sigil__body-core {
  animation: idleBreathe 4s ease-in-out infinite;
}
html:not(.reduce-motion) .boss-sigil--idle-on .boss-sigil__satellite {
  animation: satOrbit 12s linear infinite;
}

html:not(.reduce-motion) .boss-sigil--reveal {
  animation: sigilReveal 700ms cubic-bezier(.2,.8,.2,1) forwards;
  transform-origin: 50% 50%;
}
html:not(.reduce-motion) .boss-sigil--reveal .boss-sigil__orbit-main path {
  stroke-dasharray: 240;
  animation: drawStroke 600ms cubic-bezier(.4,0,.2,1) 100ms forwards;
}
html:not(.reduce-motion) .boss-sigil--reveal .boss-sigil__satellite path,
html:not(.reduce-motion) .boss-sigil--reveal .boss-sigil__mark path {
  transform-origin: center;
  transform-box: fill-box;
  animation: drawDots 700ms ease-out 300ms backwards;
}
```

- [ ] **Step 3: Run full vitest suite — confirm CSS append did not break anything**

Run: `npx vitest run`
Expected: PASS — CSS file is not parsed by tests; vitest sanity-check only confirms nothing was edited beyond CSS.

- [ ] **Step 4: Manual smoke — start dev server and verify motion**

Run: `npm run dev`
Open the game in browser. Trigger a boss reveal (play through to ante 1 boss blind, or seed the run). Verify:
- BossReveal screen sigil scales-up + draws-on (~700ms)
- After reveal completes, sigil idle: outer orbit rotates slowly, body breathes, satellite drifts
- DangerCorner sigil idle-animates while boss active (still using BossSigil — T5 swaps to BossIcon)
- Toggle OS prefers-reduced-motion (or set `document.documentElement.classList.add('reduce-motion')` in DevTools): all animations stop, static rendering remains

Stop server (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add src-next/styles/index.css
git commit -m "feat(bosses): add CSS keyframes for sigil reveal + idle motion

Six keyframes: sigilReveal (700ms scale-pop), drawStroke (orbit
draws-on), drawDots (satellites/marks fade-in), idleRotate (orbits
24s/36s reverse), idleBreathe (body 4s pulse), satOrbit (satellite
12s counter-rotate).

Gated by html:not(.reduce-motion) ancestor so existing useMotion
toggle disables all motion in one place."
```

---

## Task 5: DangerCorner — swap small sigil for BossIcon

At 28px, the new astronomic sigil's orbit + dashed marks + small dots all mush together. Swap to the simplified `iconGlyph`. The BossSigil there was decorative; BossIcon reads better at small sizes.

**Files:**
- Modify: `src-next/app/hud/DangerCorner.tsx` (import + render)

- [ ] **Step 1: Modify `src-next/app/hud/DangerCorner.tsx`**

Change the import block at top (around line 6):

```tsx
import { BossIcon } from '../visual/BossIcon';
```

(remove `import { BossSigil } from '../visual/BossSigil';` from this file — only this file's import; other files keep using BossSigil)

Replace the JSX at line 41:

```tsx
<BossSigil boss={bossDef} size={28} animate="idle" glow />
```

With:

```tsx
<BossIcon boss={bossDef} size={20} />
```

(20px is the visual sweet spot for inline tag context; 16px default felt too small next to the 10px label.)

- [ ] **Step 2: Run full vitest suite**

Run: `npx vitest run`
Expected: PASS — no test on DangerCorner, but the swap should not break anything.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "DangerCorner|BossSigil|BossIcon"`
Expected: no output (pre-existing unrelated errors elsewhere still tolerated).

- [ ] **Step 4: Manual smoke**

Run: `npm run dev`
Trigger boss blind. Verify DangerCorner's top-right boss tag renders the new BossIcon glyph (small, simplified, 20px). It should read crisply at that size where the full sigil mushed before.

Stop server.

- [ ] **Step 5: Commit**

```bash
git add src-next/app/hud/DangerCorner.tsx
git commit -m "refactor(hud): swap DangerCorner BossSigil(28) for BossIcon(20)

Astronomic sigils have orbit ellipses + small mark dots that blur
at 28px. BossIcon's simplified glyph reads cleanly at 20px in the
DangerCorner inline tag context. BossSigil retained for full-size
reveal banner and any future large displays."
```

---

## Task 6: Final smoke + cleanup

**Files:** none (verification only).

- [ ] **Step 1: Full vitest suite**

Run: `npx vitest run`
Expected: 100% green. Test count: previous total + 19 new (6 blinds + 4 BossIcon + 9 BossSigil).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds. No runtime warnings about missing CSS classes.

- [ ] **Step 3: Final manual smoke**

Run: `npm run dev`. Play through to first boss blind. Walk through:
1. **BossReveal screen** — sigil scales-pop, orbit draws-on, satellite/marks fade-in late, then settles into idle motion
2. **DangerCorner** — top-right tag shows simplified BossIcon glyph (not full sigil), boss color tint correct
3. **Multiple bosses** — restart and force different bosses (or play 7 runs); confirm each boss's sigil + icon look distinct and read clearly
4. **Reduce-motion** — DevTools: `document.documentElement.classList.add('reduce-motion')`. All animations halt. Static sigil + glyph still render.
5. **Resize-stress** — shrink browser; sigils scale via SVG viewBox; layout intact.

If any of those fail, file a bug; don't commit a "fix" reactively.

Stop server.

- [ ] **Step 4: Push branch + open PR**

```bash
git push -u origin feat/boss-art-pass
```

Open PR via printed URL (gh CLI may not be authenticated; manual open is acceptable — see prior D-2 pattern). PR title: "Boss art pass: 7 sigils + icons + reveal/idle motion". PR body should call out:
- Data shape change (BossBlind: icon→iconGlyph, sigil.paths→sigil.groups)
- Two new components: BossIcon, BossSigil rewritten
- 6 CSS @keyframes; respects existing `.reduce-motion` gate
- Visual smoke checklist for reviewer

---

## Self-Review

**1. Spec coverage.** Walked the spec section-by-section:

- *Decisions Locked* — captured (T1 entries reflect hybrid astronomy + debuff).
- *Data Shape Change* — T1 implements exactly the shapes spec proposed; one tweak: SigilGroup uses `paths: string[]` (not nested SVG primitives) per repo simplicity, plus `filled?: boolean` flag added during plan write because filled body-core circles need it.
- *Components* — T2 BossIcon, T3 BossSigil rewrite. ✓
- *CSS Animations* — T4. Spec called for `@media (prefers-reduced-motion: reduce)` gate; plan uses `html:not(.reduce-motion)` instead because repo already has `useMotion` hook driving that class — single source of truth for motion preference, dodges duplicate gates. Functionally equivalent. ✓
- *Consumer Sweep* — T3 updates BossReveal + DangerCorner; T5 further refines DangerCorner. ✓
- *Reveal Trigger* — Spec proposed parent-owned `useState`; reality is BossReveal already manages reveal lifecycle via bus subscription + `setReveal({...})` + `setTimeout(...3200)`. T3 just changes the prop value (`drawIn` → `animate='both'`). No new useState needed. ✓
- *A11y* — T4 `:not(.reduce-motion)` gate. ✓
- *Testing* — T1 + T2 + T3 cover spec's testing list. Snapshot for Eris not added (visual regression). Reasoning: existing repo has no Vitest snapshot setup, and `BOSS_BLINDS shape contract` covers the shape regression. Visual smoke covers art changes. Skipping snapshot is YAGNI per spec scope discipline.
- *Risks* — all four mitigated within the plan.

**2. Placeholder scan.** No "TBD" / "later" / "etc". Code blocks are concrete. Path data is real SVG — written in the plan body, not deferred.

**3. Type consistency.** `SigilGroupClass`, `SigilGroup`, `BossBlind`, `BossSigilAnimate` defined once and used uniformly across T1–T5. `animate` prop values `'none' | 'idle' | 'reveal' | 'both'` consistent across T3 implementation, tests, and T3/T4/T5 consumers. Test fakeBoss shape matches type definition exactly.

**Adjustments made inline during write:**
- Added `filled?: boolean` to SigilGroup (spec didn't enumerate but body-core circles need solid fill — would have been forced ad-hoc otherwise).
- Used `:not(.reduce-motion)` ancestor instead of `@media (prefers-reduced-motion: reduce)` to match existing `useMotion` plumbing (single source of truth).
- Skipped snapshot test (no setup; redundant with shape contract + visual smoke).
