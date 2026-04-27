# Plan D — Risk Telegraphy Implementation Plan

> Subagent-driven. `- [ ]` checkboxes.

**Goal:** Diegetic risk language. Each boss has its own SVG sigil that draws line-by-line on reveal and rotates slowly during the round. Debuff glyphs replace icon-only labels. (Hand pip already done in Plan B.)

**Architecture:** Add `sigil: { paths: string[]; viewBox: string }` to each `BossBlind`. New `BossSigil` component takes a boss def + size + draw mode. BossReveal uses BossSigil with `drawIn=true`. DangerCorner uses BossSigil at small size with slow rotation.

---

## Task 1 — Per-boss sigil geometry + `BossSigil` component

**Files:**
- Modify: `src-next/data/blinds.ts`
- Create: `src-next/app/visual/BossSigil.tsx`

- [ ] **Step 1: Extend `BossBlind` type and add sigil geometry**

In `src-next/data/blinds.ts`, extend type:

```ts
export type BossBlind = {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  debuffs: string[];
  sigil: { viewBox: string; paths: string[] };
};
```

Add sigils to each entry (use simple geometric paths; viewBox 100×100):

```ts
export const BOSS_BLINDS: BossBlind[] = [
  { id: 'the_serpent', name: 'The Serpent', icon: '🐍', color: '#44bb66',
    description: 'All 1s stay 1s.', debuffs: ['no_rune_transforms_on_ones'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        'M 20 20 Q 50 10 80 30 Q 90 60 60 70 Q 30 75 20 50 Q 25 30 50 30',
        'M 50 30 L 50 50',
        'M 35 80 L 65 80',
      ],
    },
  },
  { id: 'the_fool', name: 'The Fool', icon: '🃏', color: '#ffaa44',
    description: 'Hand size capped to 4.', debuffs: ['hand_size_cap_4'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        'M 50 10 L 90 80 L 10 80 Z',
        'M 50 30 L 50 65',
        'M 30 75 L 70 75',
      ],
    },
  },
  { id: 'the_tower', name: 'The Tower', icon: '🏰', color: '#aa6644',
    description: 'No rerolls.', debuffs: ['no_rerolls'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        'M 25 90 L 25 30 L 75 30 L 75 90',
        'M 35 30 L 35 90 M 50 30 L 50 90 M 65 30 L 65 90',
        'M 20 30 L 80 30 L 75 20 L 25 20 Z',
        'M 40 10 L 50 0 L 60 10 Z',
      ],
    },
  },
  { id: 'the_devil', name: 'The Devil', icon: '👹', color: '#cc2244',
    description: 'Locks unlock after roll.', debuffs: ['auto_unlock_after_roll'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        'M 50 8 L 90 78 L 10 78 Z',
        'M 50 92 L 10 22 L 90 22 Z',
        'M 50 35 L 50 65 M 35 50 L 65 50',
      ],
    },
  },
  { id: 'the_high_priestess', name: 'The High Priestess', icon: '⚜', color: '#aa66ff',
    description: 'Oracles disabled.', debuffs: ['disable_oracles'],
    sigil: {
      viewBox: '0 0 100 100',
      paths: [
        'M 50 10 a 40 40 0 1 0 0 80 a 40 40 0 1 0 0 -80',
        'M 30 50 a 20 20 0 1 0 40 0 a 20 20 0 1 0 -40 0',
        'M 50 22 L 50 78 M 22 50 L 78 50',
      ],
    },
  },
];
```

- [ ] **Step 2: Create `src-next/app/visual/BossSigil.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import type { BossBlind } from '../../data/blinds';

export function BossSigil({
  boss, size = 64, drawIn = false, drawDurationMs = 1200, rotate = false, glow = true,
}: {
  boss: BossBlind;
  size?: number;
  drawIn?: boolean;
  drawDurationMs?: number;
  rotate?: boolean;
  glow?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!drawIn || !ref.current) return;
    const paths = ref.current.querySelectorAll('path');
    const perPath = drawDurationMs / Math.max(1, paths.length);
    paths.forEach((p, i) => {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
      p.style.transition = `stroke-dashoffset ${perPath}ms linear ${i * perPath}ms`;
      // eslint-disable-next-line no-void
      void p.getBoundingClientRect();
      requestAnimationFrame(() => { p.style.strokeDashoffset = '0'; });
    });
  }, [drawIn, drawDurationMs, mounted]);

  const filter = glow ? `drop-shadow(0 0 ${Math.max(4, size / 8)}px ${boss.color})` : 'none';

  return (
    <svg
      ref={ref}
      viewBox={boss.sigil.viewBox}
      width={size}
      height={size}
      style={{
        filter,
        animation: rotate ? 'orbit 12s linear infinite' : 'none',
        overflow: 'visible',
      }}>
      {boss.sigil.paths.map((d, i) => (
        <path key={i} d={d}
          stroke={boss.color}
          strokeWidth={size > 80 ? 1.2 : 1.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round" />
      ))}
    </svg>
  );
}
```

- [ ] **Step 3: tsc/test/build clean.**

- [ ] **Step 4: Commit**

```bash
git add src-next/data/blinds.ts src-next/app/visual/BossSigil.tsx
git commit -m "feat(visual): add per-boss sigil geometry + BossSigil component"
```

---

## Task 2 — Wire BossSigil into BossReveal + DangerCorner

**Files:**
- Modify: `src-next/app/hud/BossReveal.tsx`
- Modify: `src-next/app/hud/DangerCorner.tsx`

- [ ] **Step 1: Re-skin BossReveal**

Replace `src-next/app/hud/BossReveal.tsx` contents:

```tsx
import { useEffect, useState } from 'react';
import { bus } from '../../events/bus';
import { BOSS_BLINDS } from '../../data/blinds';
import { BossSigil } from '../visual/BossSigil';
import { sfxPlay } from '../../audio/sfx';

type Reveal = { id: string; ts: number; ante: number };

export function BossReveal() {
  const [reveal, setReveal] = useState<Reveal | null>(null);

  useEffect(() => {
    return bus.on('onBossRevealed', ({ blindId, ante }) => {
      setReveal({ id: blindId, ts: Date.now(), ante });
      sfxPlay('sigilDraw');
      setTimeout(() => sfxPlay('sigilDraw'), 350);
      setTimeout(() => sfxPlay('sigilDraw'), 700);
      setTimeout(() => setReveal(null), 2400);
    });
  }, []);

  if (!reveal) return null;
  const def = BOSS_BLINDS.find((b) => b.id === reveal.id);
  if (!def) return null;
  const arcanumIdx = BOSS_BLINDS.findIndex((b) => b.id === reveal.id) + 1;

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
      pointerEvents: 'none', zIndex: 30,
      background: 'rgba(7,5,26,0.65)',
      animation: 'fadein 0.4s ease-out',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <div className="f-mono uc" style={{ fontSize: 10, letterSpacing: '0.5em', color: def.color, opacity: 0.85 }}>
          boss blind · arcanum {String(arcanumIdx).padStart(2, '0')}
        </div>
        <div style={{ marginTop: 10 }}>
          <BossSigil boss={def} size={220} drawIn drawDurationMs={1200} glow />
        </div>
        <div className="f-display" style={{
          fontSize: 36, color: '#f3f0ff', textAlign: 'center',
          opacity: 0,
          animation: 'fadein 600ms ease-out 1300ms both',
        }}>
          {def.name}
        </div>
        <div className="f-mono" style={{
          fontSize: 13, color: '#bba8ff', textAlign: 'center', fontStyle: 'italic', maxWidth: 360,
          opacity: 0,
          animation: 'fadein 600ms ease-out 1700ms both',
        }}>
          "{def.description}"
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace ⛧ in DangerCorner with BossSigil**

In `src-next/app/hud/DangerCorner.tsx`, replace the boss block. Find:

```tsx
      {bossDef && (
        <div
          className="mat-obsidian has-tip"
          ...
          <span style={{ fontSize: 22, color: '#e2334a', filter: 'drop-shadow(0 0 6px #e2334a)' }}>⛧</span>
          ...
```

Replace the icon span:
```tsx
          <BossSigil boss={bossDef} size={28} rotate glow />
```

Add import at top of DangerCorner.tsx:
```tsx
import { BossSigil } from '../visual/BossSigil';
```

- [ ] **Step 3: tsc/test/build clean.**

- [ ] **Step 4: Commit**

```bash
git add src-next/app/hud/BossReveal.tsx src-next/app/hud/DangerCorner.tsx
git commit -m "feat(hud): wire BossSigil into BossReveal (line-draw) + DangerCorner (rotating)"
```

---

## Verification

1. Tests + tsc + build clean.
2. Dev preview: enter Round on a boss blind. Verify:
   - BossReveal overlay shows: sigil draws stroke-by-stroke (~1.2s), name fades in, hex fades in last.
   - During play, DangerCorner top-right shows the same sigil at 28px slowly rotating.
   - sigilDraw SFX plays per stroke.
