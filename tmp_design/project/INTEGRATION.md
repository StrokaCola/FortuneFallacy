# Fortune Fallacy — Mockup → Game Integration Guide

This mockup is a React/JSX prototype. Your game (`src-next/`) is React + Tailwind + Zustand. Integration is mostly **lifting visual decisions** (tokens, layouts, components) into your existing screens. Game logic stays put — only swap the presentation.

---

## 1. Token & font sync (already 90% done)

Your `tailwind.config.ts` already has `cosmos.*`, `ember`, `astral`, `gold`, `crimson`, plus `Cinzel`, `Cinzel Decorative`, `Exo 2`, `JetBrains Mono`. Good — keep using those classes and the components below will compose cleanly.

Add to `src-next/styles/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;500;600;700&family=Exo+2:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

/* shared keyframes the prototype uses */
@keyframes twinkle           { 0%,100% { opacity: .25; } 50% { opacity: 1; } }
@keyframes orbit             { to { transform: rotate(360deg); } }
@keyframes pulse-glow        { 0%,100% { filter: drop-shadow(0 0 6px theme(colors.astral)); } 50% { filter: drop-shadow(0 0 18px theme(colors.astral)); } }
@keyframes float-y           { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes constellation-draw{ from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
@keyframes idle-tumble {
  0%,100%{ transform: var(--face-rot) rotateX(0) rotateY(0); }
  25%    { transform: var(--face-rot) rotateX(4deg)  rotateY(-3deg); }
  50%    { transform: var(--face-rot) rotateX(-3deg) rotateY(5deg); }
  75%    { transform: var(--face-rot) rotateX(2deg)  rotateY(-2deg); }
}
```

---

## 2. Folder layout to add

```
src-next/app/
  visual/
    Die3D.tsx           ← lift from cosmos.jsx Die() → TS
    Astrolabe.tsx       ← score ring
    ConstellationLines.tsx
    OrnateFrame.tsx     ← gold-corner flourishes
    Sigil.tsx           ← small unicode glyph wrapper
    CosmosBackground.tsx← starfield + nebula
  hud/
    TopBar.tsx          ← REPLACES ScorePanel + center blind chip + shards chip
    OracleStrip.tsx     ← lift from screens.jsx
    ConsumableTray.tsx  ← already exists, restyle
    ComboBanner.tsx     ← new
```

---

## 3. Screen-by-screen mapping

Your screen files already exist — replace their JSX, keep their hooks and `dispatch` calls.

| Mockup component | Replaces in your code | Keep these calls |
|---|---|---|
| `TitleScreen` | `app/screens/Title.tsx` | existing menu actions |
| `HubScreen` (3 blind cards) | `app/screens/Hub.tsx` | `dispatch({type:'START_BLIND'})`, `SKIP_BLIND`, `SET_SCREEN forge` |
| `BossRevealScreen` | `app/hud/BossReveal.tsx` | reads `BOSS_BLINDS` from `data/blinds.ts` |
| `RoundScreen` | `app/screens/Round.tsx` + the HUD bits it composes | `ROLL_REQUESTED`, `REROLL_REQUESTED`, `SCORE_HAND` |
| `ShopScreen` | `app/screens/Shop.tsx` | `OPEN_SHOP`, `BUY_OFFER`, `SET_SCREEN hub` |
| `ForgeScreen` | `app/screens/Forge.tsx` | rune attach actions you already have |

Wiring example for **Round.tsx**:

```tsx
import { useStore } from '../../state/store';
import { selectScore, selectTarget, selectShards, selectAnte,
         selectHandsLeft, selectRerollsLeft, selectBlindId,
         selectOracles, selectConsumables } from '../../state/selectors';
import { dispatch } from '../../actions/dispatch';

export function Round() {
  const score   = useStore(selectScore);
  const target  = useStore(selectTarget);
  const shards  = useStore(selectShards);
  const ante    = useStore(selectAnte);
  const hands   = useStore(selectHandsLeft);
  const rerolls = useStore(selectRerollsLeft);
  const blindId = useStore(selectBlindId);
  const dice    = useStore(s => s.round.dice);   // [{face, locked, runes}, ...]
  const combo   = useStore(s => s.round.detectedCombo);  // or compute via detectCombo
  const oracles = useStore(selectOracles);

  return <>
    <TopBar ante={ante} blind={blindId} shards={shards} hands={hands}
            rerolls={rerolls} target={target} score={score} accent="#7be3ff" />
    <OracleStrip oracles={oracles} />
    <ConsumableTray />
    {combo && <ComboBanner combo={combo} />}

    <Tray dice={dice}
          onLock={(i) => dispatch({type:'TOGGLE_LOCK', idx:i})} />

    <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex gap-4">
      <button className="btn-ghost"
              disabled={rerolls===0}
              onClick={() => dispatch({type:'REROLL_REQUESTED'})}>
        ↻ Reroll ({rerolls})
      </button>
      <button className="btn-primary"
              disabled={hands===0}
              onClick={() => dispatch({type:'SCORE_HAND'})}>
        ✦ Cast Hand
      </button>
    </div>
  </>;
}
```

---

## 4. The 3D die — drop-in replacement for your three.js die

You currently have `render/three/Dice3D.ts` plus `simulation/rapierSim.ts` (real physics). Two options:

### Option A — Keep physics, restyle the three.js material
Edit `Dice3D.ts` to use the cosmos colors:
- die body: dark `#0f0925` with subtle radial gradient texture
- pip color: `#dcd4ff` with bloom
- emissive astral edge `#7be3ff` when scoring

This keeps your real rolling animation intact.

### Option B — Use the CSS 3D die (lighter, no physics)
For a non-physics path or for hover states / forge / shop previews, lift the `Die` component from `cosmos.jsx` line ~175. It's a 6-face cube with `transform-style: preserve-3d`. Standard die: `front=1, back=6, right=2, left=5, top=3, bottom=4`. To show face N, apply rotation `FACE_ROT[N]` to the cube wrapper.

Recommended hybrid:
- **Round screen rolling phase** → keep the three.js + rapier physics
- **Forge / Shop / locked-static states** → CSS 3D die (cheaper, prettier hover)

---

## 5. Constellation lines (the signature visual)

`ConstellationLines.tsx`:

```tsx
type Pt = { x: number; y: number };
export function ConstellationLines({ points, color = '#7be3ff' }: { points: Pt[]; color?: string }) {
  if (points.length < 2) return null;
  const path = points.map((p,i) => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
  let len = 0;
  for (let i=1; i<points.length; i++) {
    const dx = points[i].x - points[i-1].x, dy = points[i].y - points[i-1].y;
    len += Math.hypot(dx, dy);
  }
  return (
    <svg className="absolute inset-0 pointer-events-none overflow-visible">
      <path d={path} stroke={color} strokeWidth="6" opacity="0.25" fill="none" filter="blur(2px)" />
      <path d={path} stroke={color} strokeWidth="1.5" fill="none"
            strokeDasharray={len} strokeDashoffset={len}
            style={{ animation: `constellation-draw 900ms forwards`, ['--len' as any]: len }} />
      {points.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" />)}
    </svg>
  );
}
```

Feed it dice center positions for indices returned by your existing `scoringIndices` logic in `core/scoring/detectCombo.ts`. Put a `ref` on each die in your `Tray`, then on `onScoreCalculated` event, compute their `getBoundingClientRect()` centers (relative to the tray) and pass to `<ConstellationLines>`.

---

## 6. Migration order (smallest steps first)

1. **Tokens + fonts only.** Add Google Fonts import, double-check `f-display`, `f-head` classes work.
2. **TopBar.** Replace `ScorePanel` with the 3-panel TopBar. You already have all the selectors (`selectScore`, `selectTarget`, `selectShards`, `selectAnte`, etc.).
3. **Hub.** Lift the 3-blind-card layout. The current Hub already has the data; just restructure JSX.
4. **Boss reveal.** Lift the tarot card; pass current boss from `selectIsBoss` + `BOSS_BLINDS` lookup.
5. **Background.** Drop `<CosmosBackground />` into `App.tsx` behind everything (replace `bg-shader.js` background, or layer on top).
6. **Constellation lines.** Wire to `onScoreCalculated` event from `events/bus.ts`.
7. **Forge + Shop.** Last, since they're more complex.

---

## 7. What NOT to copy

- Don't bring `cosmos.jsx` / `screens.jsx` directly — they're plain JSX without your TS types. Lift component-by-component into `src-next/app/` as `.tsx`.
- Don't replace the three.js dice rendering during the actual roll — your physics-based dice are the soul of the game. Just restyle them.
- Don't move state into the components. Keep the Zustand store as source of truth; components stay presentational.

---

## 8. Tweaks panel (optional)

Your `devtools/DebugPanel.tsx` already exists. The tweaks system from this mockup (`window.__TWEAK_DEFAULTS` + `__edit_mode_set_keys`) is host-specific and won't carry over — but if you want a similar in-game settings panel for theme/dieStyle/density, expose them as fields in the Zustand `ui` slice and read from `selectUiTheme()` etc.
