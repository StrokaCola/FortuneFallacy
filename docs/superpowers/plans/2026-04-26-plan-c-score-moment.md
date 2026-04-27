# Plan C — Score Moment + SFX Implementation Plan

> Subagent-driven. `- [ ]` checkboxes.

**Goal:** Land the cast→reveal→cascade→boom score-moment sequence with synth-arcane SFX. Replace the 1.6s setTimeout in Round.tsx with a real ScoreMoment orchestrator. Add 7 new SFX voices.

**Architecture:** `onScoreCalculated` bus event drives a `ScoreMoment` React component that runs a state machine: dim → cascade chips (with rising-pitch FM bell ticks + granular swell) → boom (sub bass + bell strike) → fade. Component dispatches `END_SCORING` at completion. Constellation lines already drawn by existing `ConstellationOverlay` (overlaps tray, fine).

**Tech:** Tone.js synth voices, React state machine, existing bus.

---

## Task 1 — Add new SFX synth voices

**Files:**
- Modify: `src-next/audio/sfx/synthBank.ts`
- Modify: `src-next/audio/sfx/voices.ts`
- Modify: `src-next/audio/sfx/index.ts`

- [ ] **Step 1: Extend SynthBank type and builder**

In `src-next/audio/sfx/synthBank.ts`, add new fields to `SynthBank` type:

```ts
export type SynthBank = {
  // ...existing fields...
  chipTick: Tone.FMSynth;
  castSwell: Tone.NoiseSynth;
  castBoom: Tone.MembraneSynth;
  sigilDraw: Tone.NoiseSynth;
  cardFlip: Tone.NoiseSynth;
  nodePulse: Tone.MetalSynth;
  transitionWipe: Tone.NoiseSynth;
};
```

In `buildBank()`, before the final return, add:

```ts
  const chipTick = new Tone.FMSynth({
    harmonicity: 3.2,
    modulationIndex: 14,
    envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.05 },
    modulationEnvelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.05 },
  });
  chipTick.volume.value = -14;
  chipTick.connect(reverb);

  const castSwell = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.4, decay: 0.5, sustain: 0, release: 0.3 },
  });
  castSwell.volume.value = -22;
  castSwell.connect(reverb);

  const castBoom = new Tone.MembraneSynth({
    pitchDecay: 0.12,
    octaves: 6,
    envelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.4 },
  });
  castBoom.volume.value = -8;
  castBoom.connect(reverb);

  const sigilDraw = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.05, decay: 0.18, sustain: 0, release: 0.1 },
  });
  sigilDraw.volume.value = -24;
  sigilDraw.connect(reverb);

  const cardFlip = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
  });
  cardFlip.volume.value = -20;
  cardFlip.connect(master);

  const nodePulse = new Tone.MetalSynth({
    envelope: { attack: 0.002, decay: 0.2, release: 0.05 },
    harmonicity: 5.1,
    modulationIndex: 24,
    resonance: 3500,
    octaves: 1.5,
  });
  nodePulse.frequency.value = 1200;
  nodePulse.volume.value = -28;
  nodePulse.connect(master);

  const transitionWipe = new Tone.NoiseSynth({
    noise: { type: 'brown' },
    envelope: { attack: 0.1, decay: 0.3, sustain: 0, release: 0.2 },
  });
  transitionWipe.volume.value = -22;
  transitionWipe.connect(reverb);
```

Update the return object to include these new fields:

```ts
  return {
    diceClack, lockTap, rerollPool, buyPool, combo, upgrade,
    bossSting, bigScore, winFanfare, bust,
    chipTick, castSwell, castBoom, sigilDraw, cardFlip, nodePulse, transitionWipe,
    reverb, delay, master,
    rerollIdx: { i: 0 },
    buyIdx: { i: 0 },
  };
```

- [ ] **Step 2: Add voice functions**

In `src-next/audio/sfx/voices.ts`, append:

```ts
const CHIP_BASE_HZ = 440; // A4

export function chipTick(bank: SynthBank, opts: { idx?: number } = {}): void {
  const idx = opts.idx ?? 0;
  // Rise by semitone per chip (2^(1/12)).
  const freq = CHIP_BASE_HZ * Math.pow(1.0594630943592953, idx);
  bank.chipTick.triggerAttackRelease(freq, '32n', nextTime());
}

export function castSwell(bank: SynthBank): void {
  bank.castSwell.triggerAttackRelease('2n', nextTime());
}

export function castBoom(bank: SynthBank): void {
  bank.castBoom.triggerAttackRelease('A1', '2n', nextTime());
}

export function sigilDraw(bank: SynthBank): void {
  bank.sigilDraw.triggerAttackRelease('8n', nextTime());
}

export function cardFlip(bank: SynthBank): void {
  bank.cardFlip.triggerAttackRelease('32n', nextTime());
}

export function nodePulse(bank: SynthBank): void {
  bank.nodePulse.triggerAttackRelease('32n', nextTime());
}

export function transitionWipe(bank: SynthBank): void {
  bank.transitionWipe.triggerAttackRelease('4n', nextTime());
}
```

- [ ] **Step 3: Register in sfx/index.ts**

Update `SfxId` union to include the new ids. Update `sfxPlay` switch to route them.

```ts
export type SfxId =
  | 'diceClack' | 'lockTap' | 'reroll' | 'buy'
  | 'combo' | 'upgrade' | 'bossSting' | 'bigScore' | 'win' | 'bust'
  | 'chipTick' | 'castSwell' | 'castBoom' | 'sigilDraw' | 'cardFlip' | 'nodePulse' | 'transitionWipe';

export type SfxOpts = { tier?: number; volume?: number; idx?: number };
```

In `sfxPlay` switch, add cases:

```ts
      case 'chipTick':       voices.chipTick(bank, opts); break;
      case 'castSwell':      voices.castSwell(bank); break;
      case 'castBoom':       voices.castBoom(bank); break;
      case 'sigilDraw':      voices.sigilDraw(bank); break;
      case 'cardFlip':       voices.cardFlip(bank); break;
      case 'nodePulse':      voices.nodePulse(bank); break;
      case 'transitionWipe': voices.transitionWipe(bank); break;
```

- [ ] **Step 4: tsc + tests + build clean**.

- [ ] **Step 5: Commit**

```bash
git add src-next/audio/sfx/synthBank.ts src-next/audio/sfx/voices.ts src-next/audio/sfx/index.ts
git commit -m "feat(sfx): add 7 synth-arcane voices (chipTick, castSwell, castBoom, sigilDraw, cardFlip, nodePulse, transitionWipe)"
```

---

## Task 2 — `ScoreMoment` orchestrator

**Files:**
- Create: `src-next/app/hud/ScoreMoment.tsx`
- Modify: `src-next/app/screens/Round.tsx`

- [ ] **Step 1: Create the orchestrator**

```tsx
import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { dispatch } from '../../actions/dispatch';
import { sfxPlay } from '../../audio/sfx';

type Chip = { label: string; value: string; color: string };
type Phase = 'idle' | 'cascade' | 'boom' | 'fade';

export function ScoreMoment() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [chips, setChips] = useState<Chip[]>([]);
  const [name, setName] = useState<string>('');
  const [total, setTotal] = useState<number>(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const offCombo = bus.on('onComboDetected', ({ combo, tier }) => {
      setName(formatComboName(combo));
      // Stash tier so the boom voice can be louder for higher tiers (cosmetic only).
      tierRef.current = tier;
    });
    const offScore = bus.on('onScoreCalculated', ({ chips: chipCount, mult, total: t }) => {
      // Build cascade: base chip + mult chip (we don't have detailed contributors here).
      const built: Chip[] = [
        { label: 'Chips', value: String(chipCount), color: '#7be3ff' },
        { label: 'Mult', value: `× ${mult.toFixed(2)}`, color: '#ff7847' },
      ];
      setChips(built);
      setTotal(t);
      runSequence(built.length);
    });
    return () => { offCombo(); offScore(); clearTimers(); };
  }, []);

  const tierRef = useRef(1);

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }
  function schedule(ms: number, fn: () => void) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  function runSequence(chipCount: number) {
    clearTimers();
    setPhase('cascade');
    sfxPlay('castSwell');
    // Tick each chip with a rising pitch.
    for (let i = 0; i < chipCount; i++) {
      schedule(180 + i * 140, () => sfxPlay('chipTick', { idx: i }));
    }
    // Boom at end of cascade.
    const boomAt = 180 + chipCount * 140 + 80;
    schedule(boomAt, () => {
      setPhase('boom');
      sfxPlay('castBoom');
    });
    schedule(boomAt + 700, () => setPhase('fade'));
    schedule(boomAt + 1100, () => {
      setPhase('idle');
      dispatch({ type: 'END_SCORING' });
    });
  }

  if (phase === 'idle') return null;

  return (
    <div
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity: phase === 'fade' ? 0 : 1,
        transition: 'opacity 400ms ease',
      }}>
      {name && (
        <div className="f-display" style={{
          fontSize: 32, color: '#f5c451',
          textShadow: '0 0 24px rgba(245,196,81,0.7)',
          letterSpacing: '0.18em', marginBottom: 18,
          opacity: phase === 'cascade' || phase === 'boom' ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}>
          {name}
        </div>
      )}
      {phase === 'cascade' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {chips.map((c, i) => (
            <div key={i}
              className="f-mono"
              style={{
                padding: '4px 10px', borderRadius: 6,
                background: `${c.color}25`, border: `1px solid ${c.color}80`,
                color: c.color, fontSize: 12,
                animation: 'chipPop 200ms ease-out',
                animationDelay: `${i * 140}ms`,
                animationFillMode: 'both',
              }}>
              <span style={{ opacity: 0.7, marginRight: 6 }}>{c.label}</span>{c.value}
            </div>
          ))}
        </div>
      )}
      {(phase === 'boom' || phase === 'fade') && (
        <div className="f-mono num" style={{
          fontSize: 96, color: '#fff', fontWeight: 700,
          textShadow: '0 0 40px #7be3ff, 0 0 80px rgba(123,227,255,0.5)',
          animation: 'boomPop 400ms cubic-bezier(0.2, 1.4, 0.5, 1)',
          animationFillMode: 'both',
        }}>
          {total.toLocaleString()}
        </div>
      )}
    </div>
  );
}

function formatComboName(id: string): string {
  const map: Record<string, string> = {
    five_kind: 'Cygnus',
    four_kind: 'Orion',
    full_house: 'Pegasus',
    three_kind: 'Auriga',
    lg_straight: 'The Lyre',
    sm_straight: 'Cassiopeia',
    two_pair: 'Gemini',
    one_pair: 'Vela',
    chance: 'Wandering Star',
  };
  return map[id] ?? '';
}
```

- [ ] **Step 2: Add cascade animation keyframes**

Append to `src-next/styles/index.css`:

```css
@keyframes chipPop {
  0%   { opacity: 0; transform: translateY(8px) scale(0.7); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes boomPop {
  0%   { opacity: 0; transform: scale(0.6); }
  60%  { opacity: 1; transform: scale(1.15); }
  100% { opacity: 1; transform: scale(1); }
}
```

- [ ] **Step 3: Mount ScoreMoment in Round.tsx + remove temp setTimeout**

In `src-next/app/screens/Round.tsx`, add import:

```tsx
import { ScoreMoment } from '../hud/ScoreMoment';
```

Remove the `useEffect` that dispatched `END_SCORING` after 1.6s. ScoreMoment now owns that.

Add `<ScoreMoment />` to the JSX (near `<ConstellationOverlay />`):

```tsx
      <ConstellationOverlay />
      <ScoreMoment />
      <DiceLockOverlay />
```

- [ ] **Step 4: tsc/test/build clean.**

- [ ] **Step 5: Commit**

```bash
git add src-next/app/hud/ScoreMoment.tsx src-next/styles/index.css src-next/app/screens/Round.tsx
git commit -m "feat(round): add ScoreMoment orchestrator (cascade chips + boom + END_SCORING dispatch)"
```

---

## Verification

1. `npm test` — 37 tests pass.
2. Dev preview: enter Round, Cast Hand. Verify:
   - Constellation lines draw between scoring dice (existing ConstellationOverlay).
   - Constellation name fades in (e.g. "The Lyre").
   - Two chips animate (Chips/Mult) at top center.
   - Audio: granular swell rises, FM bell ticks rise in pitch per chip, sub bell strike at boom.
   - Big score number lands large.
   - Sequence completes ~1.6s, fades, END_SCORING fires (tension returns to baseline).
