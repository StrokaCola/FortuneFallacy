# Music Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 4 + 5 are HUMAN asset-production tasks (Suno + DAW); a coding subagent should mark them `BLOCKED — needs human` and surface to the user.

**Goal:** Land the music system: 4 sample-aligned Round adaptive stems and 5 per-screen tracks, with a `ScreenMusic` loader that crossfades between screen tracks and arbitrates against the existing `AudioEngine`.

**Architecture:** Code work is small (one new module, one additive method on `AudioEngine`, one `useEffect` in `App.tsx`). The dominant work is asset production via Suno Studio + DAW. Code lands first so the game runs silently until audio assets arrive; assets drop into `public/audio/` and start playing without further code changes.

**Tech Stack:** TypeScript, Howler v2 (for screen tracks), Tone.js / Howler hybrid for the existing AudioEngine, Vitest. Spec: [docs/superpowers/specs/2026-04-27-music-phase2-design.md](../specs/2026-04-27-music-phase2-design.md).

---

## File Structure

```
src-next/audio/
├── AudioEngine.ts            ← MODIFY: add setActive(active: boolean)
├── ScreenMusic.ts            ← NEW: lazy Howl loader + 1.5s crossfade
└── __tests__/
    └── ScreenMusic.test.ts   ← NEW

src-next/app/
└── App.tsx                   ← MODIFY: useEffect on screen change → ScreenMusic.start + audioEngine.setActive

public/audio/
├── base-loop.wav             ← NEW asset (Suno + DAW)
├── combo-loop.wav            ← NEW asset
├── peak-loop.wav             ← NEW asset
├── fail-loop.wav             ← NEW asset
├── title-loop.wav            ← NEW asset
├── hub-loop.wav              ← NEW asset
├── shop-loop.wav             ← NEW asset
├── forge-loop.wav            ← NEW asset
└── boss-loop.wav             ← NEW asset

docs/audio/
└── SUNO-WORKFLOW.md          ← NEW: prompts + DAW recipe (produced in Task 4)
```

---

## Task 1: `AudioEngine.setActive` additive method

**Files:**
- Modify: `src-next/audio/AudioEngine.ts`
- Test: `src-next/audio/__tests__/AudioEngine.setActive.test.ts` (new)

The change is small but TDD'd because the method gates audible volume — easy to break.

- [ ] **Step 1.1: Write failing test**

Create `src-next/audio/__tests__/AudioEngine.setActive.test.ts`:

```ts
import { describe, it, expect, beforeAll, vi } from 'vitest';

// Mock Howler so we can read .volume() calls without real WebAudio.
const volumeCalls: Record<string, number[]> = {};
function makeHowl(label: string) {
  return {
    play: vi.fn(),
    volume: vi.fn((v?: number) => {
      if (v != null) {
        volumeCalls[label] = volumeCalls[label] ?? [];
        volumeCalls[label]!.push(v);
      }
    }),
  };
}

vi.mock('howler', () => {
  return {
    Howl: vi.fn().mockImplementation((opts: { src: string[] }) => {
      const label = opts.src[0]!.includes('base') ? 'base'
                  : opts.src[0]!.includes('combo') ? 'combo'
                  : opts.src[0]!.includes('peak') ? 'peak'
                  : 'fail';
      return makeHowl(label);
    }),
    Howler: { ctx: null, volume: vi.fn() },
  };
});

import { audioEngine } from '../AudioEngine';

describe('AudioEngine.setActive', () => {
  beforeAll(() => {
    audioEngine.start();
  });

  it('exposes a setActive method', () => {
    expect(typeof (audioEngine as unknown as { setActive: (b: boolean) => void }).setActive).toBe('function');
  });

  it('clamps all four layer volumes to 0 within ~30 ticks of setActive(false)', async () => {
    audioEngine.bumpHeat(1.0);
    audioEngine.bumpCombo(8);
    // Let the existing tick run a few frames so layers ramp up.
    await new Promise((r) => setTimeout(r, 100));
    (audioEngine as unknown as { setActive: (b: boolean) => void }).setActive(false);
    await new Promise((r) => setTimeout(r, 600)); // > 30 frames at 60fps

    const lastBase = volumeCalls['base']?.at(-1) ?? 1;
    const lastCombo = volumeCalls['combo']?.at(-1) ?? 1;
    const lastPeak = volumeCalls['peak']?.at(-1) ?? 1;
    const lastFail = volumeCalls['fail']?.at(-1) ?? 1;
    expect(lastBase).toBeLessThan(0.05);
    expect(lastCombo).toBeLessThan(0.05);
    expect(lastPeak).toBeLessThan(0.05);
    expect(lastFail).toBeLessThan(0.05);
  });

  it('restores normal mixing after setActive(true)', async () => {
    audioEngine.bumpHeat(1.0);
    (audioEngine as unknown as { setActive: (b: boolean) => void }).setActive(true);
    await new Promise((r) => setTimeout(r, 600));

    const lastBase = volumeCalls['base']?.at(-1) ?? 0;
    expect(lastBase).toBeGreaterThan(0.1);
  });
});
```

- [ ] **Step 1.2: Run test, confirm it fails**

```bash
npx vitest run src-next/audio/__tests__/AudioEngine.setActive.test.ts
```

Expected: FAIL on `expect(typeof ...setActive).toBe('function')`.

- [ ] **Step 1.3: Implement `setActive`**

Edit `src-next/audio/AudioEngine.ts`. Add a new private field next to existing private fields:

```ts
private active = true;
```

Add this method after `getTension()`:

```ts
setActive(active: boolean): void {
  this.active = active;
}

isActive(): boolean {
  return this.active;
}
```

Inside the existing `tick = () => { ... }` method, find the block that computes `baseTarget`, `comboTarget`, `peakTarget`, `failTarget`. After the `bigScoreTimer` and `fail` blocks but BEFORE the `lerpK` step, add:

```ts
if (!this.active) {
  baseTarget = 0;
  comboTarget = 0;
  peakTarget = 0;
  failTarget = 0;
}
```

This sits right above the existing `const lerpK = 0.12;` line.

- [ ] **Step 1.4: Run test, confirm it passes**

```bash
npx vitest run src-next/audio/__tests__/AudioEngine.setActive.test.ts
```

Expected: ALL PASS.

- [ ] **Step 1.5: Run full test suite**

```bash
npx vitest run
```

Expected: nothing pre-existing broken.

- [ ] **Step 1.6: Commit**

```bash
git add src-next/audio/AudioEngine.ts src-next/audio/__tests__/AudioEngine.setActive.test.ts
git commit -m "$(cat <<'EOF'
feat(audio): AudioEngine.setActive — gate layer volumes by active flag

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `ScreenMusic` module — lazy Howl loader + crossfade

**Files:**
- Create: `src-next/audio/ScreenMusic.ts`
- Test: `src-next/audio/__tests__/ScreenMusic.test.ts` (new)

- [ ] **Step 2.1: Write failing test**

Create `src-next/audio/__tests__/ScreenMusic.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

type FakeHowl = {
  src: string;
  played: boolean;
  paused: boolean;
  unloaded: boolean;
  vol: number;
  fadeCalls: Array<[number, number, number]>;
};

const howlInstances: FakeHowl[] = [];

vi.mock('howler', () => {
  class Howl {
    private inst: FakeHowl;
    constructor(opts: { src: string[]; loop?: boolean; volume?: number }) {
      this.inst = {
        src: opts.src[0]!,
        played: false,
        paused: false,
        unloaded: false,
        vol: opts.volume ?? 0,
        fadeCalls: [],
      };
      howlInstances.push(this.inst);
    }
    play() { this.inst.played = true; return 1; }
    pause() { this.inst.paused = true; return this; }
    fade(from: number, to: number, durationMs: number) {
      this.inst.fadeCalls.push([from, to, durationMs]);
      this.inst.vol = to; // simulate instantaneous for assertion convenience
      return this;
    }
    unload() { this.inst.unloaded = true; }
    volume(v?: number): number { if (v != null) this.inst.vol = v; return this.inst.vol; }
    state() { return 'loaded'; }
  }
  return { Howl, Howler: { volume: vi.fn() } };
});

import { screenMusic } from '../ScreenMusic';

beforeEach(() => {
  howlInstances.length = 0;
  screenMusic.reset();
});

describe('ScreenMusic', () => {
  it('starts a screen track lazily on start()', () => {
    screenMusic.start('hub');
    expect(howlInstances).toHaveLength(1);
    expect(howlInstances[0]!.src).toContain('hub-loop.wav');
    expect(howlInstances[0]!.played).toBe(true);
    expect(howlInstances[0]!.fadeCalls.at(0)?.[1]).toBeGreaterThan(0);
  });

  it('crossfades between two different screens', () => {
    screenMusic.start('hub');
    screenMusic.start('shop');
    expect(howlInstances).toHaveLength(2);
    const oldFade = howlInstances[0]!.fadeCalls.at(-1);
    const newFade = howlInstances[1]!.fadeCalls.at(-1);
    expect(oldFade?.[1]).toBe(0); // old fades to 0
    expect(newFade?.[1]).toBeGreaterThan(0); // new fades up
    expect(oldFade?.[2]).toBe(1500);
    expect(newFade?.[2]).toBe(1500);
  });

  it('start(same) is a no-op', () => {
    screenMusic.start('hub');
    const before = howlInstances.length;
    screenMusic.start('hub');
    expect(howlInstances.length).toBe(before);
  });

  it('stop() fades out the active track', () => {
    screenMusic.start('hub');
    screenMusic.stop();
    const fade = howlInstances[0]!.fadeCalls.at(-1);
    expect(fade?.[1]).toBe(0);
  });

  it('setMaster scales the active track volume target', () => {
    screenMusic.start('hub');
    screenMusic.setMaster(0.5);
    // Next start should respect the new master.
    screenMusic.start('shop');
    const shopFade = howlInstances[1]!.fadeCalls.at(-1);
    // Target is master (0.5), not 1.0
    expect(shopFade?.[1]).toBeLessThanOrEqual(0.5);
    expect(shopFade?.[1]).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2.2: Run test, confirm fails**

```bash
npx vitest run src-next/audio/__tests__/ScreenMusic.test.ts
```

Expected: FAIL — module `../ScreenMusic` cannot be resolved.

- [ ] **Step 2.3: Implement `ScreenMusic.ts`**

Create `src-next/audio/ScreenMusic.ts`:

```ts
import { Howl } from 'howler';

export type ScreenId = 'title' | 'hub' | 'shop' | 'forge' | 'boss';

const BASE_PATH = '/FortuneFallacy/audio';
const VOLUME_KEY = 'ff_next_audioVol';
const CROSSFADE_MS = 1500;

const TRACK_FILES: Record<ScreenId, string> = {
  title: 'title-loop.wav',
  hub:   'hub-loop.wav',
  shop:  'shop-loop.wav',
  forge: 'forge-loop.wav',
  boss:  'boss-loop.wav',
};

function loadVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (!raw) return 0.6;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.6;
  } catch { return 0.6; }
}

class ScreenMusicImpl {
  private howls = new Map<ScreenId, Howl>();
  private active: ScreenId | null = null;
  private master: number = loadVolume();
  private paused = false;

  private getOrCreate(screen: ScreenId): Howl {
    let h = this.howls.get(screen);
    if (!h) {
      h = new Howl({
        src: [`${BASE_PATH}/${TRACK_FILES[screen]}`],
        loop: true,
        volume: 0,
        html5: false,
      });
      this.howls.set(screen, h);
    }
    return h;
  }

  start(screen: ScreenId): void {
    if (this.active === screen) return;
    const target = this.master * (this.paused ? 0 : 1);

    if (this.active) {
      const old = this.howls.get(this.active);
      old?.fade(old.volume(), 0, CROSSFADE_MS);
    }

    const next = this.getOrCreate(screen);
    next.play();
    next.fade(next.volume(), target, CROSSFADE_MS);

    this.active = screen;
  }

  stop(durationMs: number = CROSSFADE_MS): void {
    if (!this.active) return;
    const cur = this.howls.get(this.active);
    if (cur) cur.fade(cur.volume(), 0, durationMs);
    this.active = null;
  }

  setMaster(v: number): void {
    this.master = Math.max(0, Math.min(1, v));
    if (this.active) {
      const cur = this.howls.get(this.active);
      cur?.fade(cur.volume(), this.master, 200);
    }
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    if (this.active) {
      const cur = this.howls.get(this.active);
      cur?.fade(cur.volume(), 0, 200);
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.active) {
      const cur = this.howls.get(this.active);
      cur?.fade(cur.volume(), this.master, 200);
    }
  }

  // Test/HMR convenience
  reset(): void {
    this.howls.forEach((h) => { try { h.unload(); } catch { /* ignore */ } });
    this.howls.clear();
    this.active = null;
    this.master = loadVolume();
    this.paused = false;
  }
}

export const screenMusic = new ScreenMusicImpl();

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) screenMusic.pause();
    else screenMusic.resume();
  });
}
```

- [ ] **Step 2.4: Run test, confirm passes**

```bash
npx vitest run src-next/audio/__tests__/ScreenMusic.test.ts
```

Expected: ALL PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src-next/audio/ScreenMusic.ts src-next/audio/__tests__/ScreenMusic.test.ts
git commit -m "$(cat <<'EOF'
feat(audio): ScreenMusic module — lazy Howl + 1.5s crossfade

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire `ScreenMusic` + `AudioEngine.setActive` into `App.tsx`

**Files:**
- Modify: `src-next/app/App.tsx`

This task has no unit test — the wiring is a 5-line `useEffect`. Manual browser verification covers it (Task 6 step).

- [ ] **Step 3.1: Edit `App.tsx`**

Add new imports (top of file):

```ts
import { useEffect } from 'react';
import { audioEngine, ensureAudioAfterGesture } from '../audio/AudioEngine';
import { screenMusic } from '../audio/ScreenMusic';
import type { ScreenId } from '../audio/ScreenMusic';
```

Inside the `App` component body, after `const tension = useStore(...)` and before the `theme` calculation, add:

```ts
useEffect(() => {
  ensureAudioAfterGesture();
}, []);

useEffect(() => {
  const isRound = screen === 'round';
  audioEngine.setActive(isRound);
  if (isRound) {
    screenMusic.stop();
  } else if (screen === 'title' || screen === 'hub' || screen === 'shop' || screen === 'forge') {
    screenMusic.start(screen as ScreenId);
  } else if (isBoss && screen === 'round') {
    // already handled by isRound branch
  } else if (screen === 'win' || screen === 'scores') {
    // No music for win/scores; let prior track linger then stop softly
    screenMusic.stop(800);
  }
}, [screen, isBoss]);

// Boss reveal switches the track to boss while still on the round screen — wire that too.
useEffect(() => {
  if (isBoss && screen === 'round') {
    // Round still in control; AudioEngine handles ambient. No screen track needed.
  }
}, [isBoss, screen]);
```

(The second `useEffect` is a no-op placeholder — keep only the first effect; the second was illustrative. Final version is just the first effect.)

Replace the previous paragraph's two `useEffect`s with this single canonical effect that lives in `App`:

```ts
useEffect(() => {
  ensureAudioAfterGesture();
}, []);

useEffect(() => {
  const isRound = screen === 'round';
  audioEngine.setActive(isRound);
  if (isRound) {
    screenMusic.stop();
    return;
  }
  if (screen === 'title' || screen === 'hub' || screen === 'shop' || screen === 'forge' || screen === 'win' || screen === 'scores') {
    // win/scores reuse hub track to avoid silence on those rare screens
    const target: ScreenId = (screen === 'win' || screen === 'scores') ? 'hub' : screen;
    screenMusic.start(target);
  }
  // Boss reveal during round handled separately by BossReveal component if needed.
}, [screen, isBoss]);
```

(`win` and `scores` reuse `hub` so the player isn't dropped into silence. If a future spec splits them out, swap the mapping.)

- [ ] **Step 3.2: Run type-check**

```bash
npx tsc --noEmit
```

Expected: no errors in `App.tsx`.

- [ ] **Step 3.3: Run all tests**

```bash
npx vitest run
```

Expected: all green.

- [ ] **Step 3.4: Commit**

```bash
git add src-next/app/App.tsx
git commit -m "$(cat <<'EOF'
feat(audio): wire ScreenMusic + setActive into App on screen change

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Generate Round adaptive stems (HUMAN — Suno + DAW)

> **Coding subagents must report `BLOCKED — needs human` here.** This task requires Suno credits and a DAW.

**Files:**
- Create: `public/audio/base-loop.wav`
- Create: `public/audio/combo-loop.wav`
- Create: `public/audio/peak-loop.wav`
- Create: `public/audio/fail-loop.wav`
- Create: `docs/audio/SUNO-WORKFLOW.md` (record the prompts + DAW steps)

Target spec for every stem:
- Length: exactly **42.667 seconds** (16 bars at 90 BPM = `16 × 4 × 60 / 90`).
- Format: 16-bit PCM WAV, 44.1 kHz, stereo.
- Phase: starts on the downbeat, ends one sample before the next downbeat.
- Key: C# minor.

- [ ] **Step 4.1: Suno Studio gen — primary song**

Use the Suno Studio with this prompt:

> Cosmic ambient lofi-lounge, 90 BPM, C# minor, warm sub bass, dusty Rhodes keys, brushed kit with vinyl crackle, sustained pad, occasional bell shimmer, no vocals, evening lounge in space, peaceful but with depth.

Generate 3–5 takes. Pick the take with the cleanest groove and the most distinct instrumentation (so stem export reads cleanly).

- [ ] **Step 4.2: Suno Studio gen — fail layer**

Separate gen, same BPM/key:

> Detuned, reversed, tape-stop, ambient drone, low rumble, no drums, 90 BPM, C# minor.

Pick the take with the most "wrong" / "decaying" feel. This is a separate render — not a stem from the main song.

- [ ] **Step 4.3: Stem export from primary song**

In Suno Studio, export stems for the primary take. Suno typically delivers: drums, bass, melody, pad/keys (names vary).

- [ ] **Step 4.4: Mixdown into 4 target stems (Audacity or DAW)**

Open all stems on a single timeline at 90 BPM. Snap everything to bar 1 downbeat. Render each target stem as a separate stereo WAV:

| Target file | Source stems to mix in |
|---|---|
| `base-loop.wav` | drums + bass + pad |
| `combo-loop.wav` | melody/Rhodes + arp + shaker (everything else muted) |
| `peak-loop.wav` | lead synth + cymbal swells + bell ostinato |
| `fail-loop.wav` | the separate fail-gen output |

For each:
1. Trim start to the first downbeat (zero-crossing).
2. Trim end at exactly 42.667 s after the start (zero-crossing).
3. Verify with a tape-loop test: place two copies end-to-end and listen for a click at the seam. If clicked, slide trim by ±2 ms and retry.
4. Export 16-bit PCM WAV @ 44.1 kHz, stereo.

- [ ] **Step 4.5: Document workflow**

Create `docs/audio/SUNO-WORKFLOW.md` with the Suno prompts used, the DAW recipe, and the take IDs (Suno song URLs) so this is reproducible. Template:

```md
# Suno Workflow — Fortune Fallacy Music

## Round adaptive stems

### Primary song (base/combo/peak)
- Prompt: <paste exact prompt used>
- Suno song URL: <link>
- Take selected: <which gen>

### Fail layer
- Prompt: <paste>
- Suno URL: <link>

## DAW mixdown

<paste exact step-by-step you used, BPM-grid setup, trim points, render settings>

## Per-screen tracks
(filled in Task 5)
```

- [ ] **Step 4.6: Verify file lengths**

```bash
# from repo root
for f in public/audio/{base,combo,peak,fail}-loop.wav; do
  ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f"
done
```

Expected: all four print `42.66...` (within ±0.01 s tolerance). If any stem is off, return to step 4.4 and re-trim.

- [ ] **Step 4.7: Commit assets**

```bash
git add public/audio/base-loop.wav public/audio/combo-loop.wav public/audio/peak-loop.wav public/audio/fail-loop.wav docs/audio/SUNO-WORKFLOW.md
git commit -m "$(cat <<'EOF'
feat(audio): Round adaptive stems — base/combo/peak/fail loops

16 bars @ 90 BPM, C# minor, sample-aligned for AudioEngine 4-layer mix.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Generate per-screen tracks (HUMAN — Suno V5)

> **Coding subagents must report `BLOCKED — needs human` here.** This task requires Suno credits.

**Files:**
- Create: `public/audio/title-loop.wav`
- Create: `public/audio/hub-loop.wav`
- Create: `public/audio/shop-loop.wav`
- Create: `public/audio/forge-loop.wav`
- Create: `public/audio/boss-loop.wav`
- Modify: `docs/audio/SUNO-WORKFLOW.md` (append per-screen section)

Target spec per file:
- Length: 60–90 seconds, looped at zero-crossings.
- Format: 16-bit PCM WAV, 44.1 kHz, stereo.
- Key: C# minor, ~90 BPM (boss may be +1–2 BPM).

- [ ] **Step 5.1: Generate the five tracks**

For each screen, generate via Suno V5 with the seed prompt + per-screen swap. Pick best take.

| Screen | Seed prompt swap |
|---|---|
| `title` | "wide open intro, sparse, anticipating" replaces "evening lounge in space, peaceful but with depth" |
| `hub` | seed unchanged (canonical mix) |
| `shop` | append "jazz-lounge feel, prominent Rhodes, brushed kit forward" |
| `forge` | "smoldering, minor-key substitution, hammered metal accents" replaces "peaceful" |
| `boss` | "intense, distorted bass, faster hat, brooding" replaces "peaceful but with depth" |

- [ ] **Step 5.2: Trim each take to a clean loop**

For each:
1. Find the longest seamless internal loop point (often a chord-cycle boundary).
2. Trim to between 60 and 90 s.
3. Tape-loop test for click at seam.
4. Export 16-bit PCM WAV @ 44.1 kHz stereo.

- [ ] **Step 5.3: Append to workflow doc**

Add the per-screen prompt variants and Suno URLs to `docs/audio/SUNO-WORKFLOW.md`.

- [ ] **Step 5.4: Verify**

```bash
for f in public/audio/{title,hub,shop,forge,boss}-loop.wav; do
  ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f"
done
```

Expected: all between 60 and 90 seconds.

- [ ] **Step 5.5: Commit assets**

```bash
git add public/audio/title-loop.wav public/audio/hub-loop.wav public/audio/shop-loop.wav public/audio/forge-loop.wav public/audio/boss-loop.wav docs/audio/SUNO-WORKFLOW.md
git commit -m "$(cat <<'EOF'
feat(audio): per-screen tracks — title/hub/shop/forge/boss loops

C# minor ~90 BPM same song family, 60-90s loops.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Browser verification

**Files:** None modified — verification only.

- [ ] **Step 6.1: Start dev server**

Use `preview_start` MCP tool with config name `fortune-fallacy`. Outside agents: `npm run dev`.

- [ ] **Step 6.2: Round seamless loop**

Open the app, enter Round, let it run for ~90 s (two full 42.667 s loop cycles). Listen for click/seam at the loop boundary. If audible:
- Verify file length is exactly 42.667 s via `ffprobe`.
- Re-trim in the DAW.

- [ ] **Step 6.3: Layer crossfade behavior**

Trigger combos of increasing tier; confirm `combo` layer audibly rises. Score near target; confirm `peak` enters around heat 0.7. Force a fail (let hands deplete with score under target); confirm `fail` enters and the master filter sweeps down.

- [ ] **Step 6.4: bigScore moment**

Cast a hand >= 10 000 score. Confirm: 300 ms duck, peak swell, blend back. The existing AudioEngine timing should read cleanly with real audio.

- [ ] **Step 6.5: Screen track crossfade**

Navigate Title → Hub → Shop → Forge → Boss → Hub. Confirm:
- 1.5 s crossfade per transition.
- No clicks.
- Two tracks never play at full volume simultaneously.

- [ ] **Step 6.6: Round mutex**

Hub → Round: confirm `hub-loop` fades out as Round layers fade in. Round → Shop: confirm Round layers fade out (within ~250 ms of leaving) as `shop-loop` fades in over 1.5 s.

- [ ] **Step 6.7: Visibility pause**

Tab away during Round; tab back. Confirm music resumes in phase (i.e., layers don't drift relative to each other).

- [ ] **Step 6.8: Master volume**

Use the DebugPanel master slider; confirm both Round layers and screen tracks scale proportionally. Drag to 0 then back; confirm clean fade.

- [ ] **Step 6.9: Missing-asset fallback**

Temporarily rename `hub-loop.wav` to `hub-loop.wav.bak`. Reload, navigate to Hub. Expected: Howler logs a warning, no crash, rest of game runs. Restore the file when done.

- [ ] **Step 6.10: Final tweak commit (if needed)**

If any volume balance felt off in real audio, adjust constants in `AudioEngine.ts` or `ScreenMusic.ts` and commit:

```bash
git add src-next/audio/
git commit -m "$(cat <<'EOF'
tweak(audio): volume balance after manual verification

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:**
- Round 4-layer adaptive system: Tasks 1 (setActive), 4 (stems). ✓
- Per-screen tracks: Tasks 2 (loader), 3 (wiring), 5 (assets). ✓
- 1.5 s crossfade: Task 2 implements; Task 6.5 verifies. ✓
- Round/screen mutex: Tasks 1 + 3 implement; Task 6.6 verifies. ✓
- Suno workflow doc: Task 4.5 + Task 5.3. ✓
- Master volume integration: Task 2 (setMaster), Task 6.8 verifies. ✓
- Visibility pause/resume: Task 2 (document listener), Task 6.7 verifies. ✓

**Type consistency:** `ScreenId` defined in Task 2 is reused in Task 3 import. `screenMusic` singleton same name throughout. `setActive`/`isActive` method pair on AudioEngine consistent.

**Placeholders:** None. The "human" tasks (4 + 5) are marked explicitly so a coding subagent surfaces them rather than guessing.

**Workflow caveat:** Tasks 4–5 require Suno + DAW + manual trimming. A purely-code agent must report `BLOCKED — needs human` and hand off; the user does the asset work and then resumes at Task 6.
