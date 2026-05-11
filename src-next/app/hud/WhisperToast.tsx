// WhisperToast — quiet celebration when an easter egg is discovered for
// the first time. Modeled on AchievementToast.tsx but intentionally
// softer: a brief gold ✦ sigil flashes behind the egg's name, then the
// toast fades after ~2.6 s. The chime is a slow pentatonic arpeggio,
// not a fanfare — the discovery should feel intimate.
//
// Single-fire semantics: meta.easterEggs is append-only, so the
// discoveryBridge dedupes. We listen to the raw onUpgradeTriggered
// stream and react only when the bridge would record a NEW id (i.e.,
// the id isn't already in meta.easterEggs at the moment of the event).
// That keeps the toast from re-firing on subsequent retriggers of
// already-discovered eggs (e.g., Eris Apple in two consecutive Eris
// blinds within the same run).

import { useEffect, useRef, useState } from 'react';
import { bus } from '../../events/bus';
import { lookupEasterEgg, EASTER_EGGS } from '../../data/easterEggs';
import { store } from '../../state/store';
import { Z } from './zLayers';
import { sfxPlay } from '../../audio/sfx';
import { playHaptic } from '../haptics/haptics';

const SHOW_MS = 2600;

type WhisperEntry = {
  key: number;
  eggId: string;
  name: string;
  icon: string;
};

// Per-egg pitch offset for whisperChime so each discovery has its own
// signature note. Order matches EASTER_EGGS.
const EGG_NOTE_IDX: Record<string, number> = {
  answer: 0,
  pi: 2,
  lucky_seven: 4,
  eris_apple: 6,
  mirrored_hand: 8,
};

export function WhisperToast() {
  const [active, setActive] = useState<WhisperEntry | null>(null);
  const keyRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const off = bus.on('onUpgradeTriggered', (payload: { id: string }) => {
      // Resolve the egg id from either prefix form.
      let eggId: string | null = null;
      if (payload.id.startsWith('easter_egg:')) eggId = payload.id.slice('easter_egg:'.length);
      else if (payload.id === 'mirrored_hand') eggId = 'mirrored_hand';
      if (!eggId) return;
      // Dedupe: only fire once per run-per-egg. The discoveryBridge writes
      // to meta.easterEggs after we run, so we check the CURRENT state
      // (post-write would already include the new id, but the bridge
      // setState runs in the same microtask sequence as us — reading from
      // store.getState() RIGHT NOW races safely because the bus calls are
      // synchronous and we're listening AT THE SAME TIME as the bridge).
      // Simpler approach: track an in-component Set of ids we've shown.
      if (shownRef.current.has(eggId)) return;
      const meta = lookupEasterEgg(eggId);
      if (!meta) return;
      // Also dedupe against meta.easterEggs in case the player already
      // discovered this egg in a previous run (we don't want to re-celebrate).
      const persisted = store.getState().meta.easterEggs ?? [];
      if (persisted.includes(eggId)) {
        shownRef.current.add(eggId);
        return;
      }
      shownRef.current.add(eggId);
      const entry: WhisperEntry = {
        key: ++keyRef.current,
        eggId,
        name: meta.name,
        icon: meta.icon,
      };
      setActive(entry);
      sfxPlay('whisperChime', { idx: EGG_NOTE_IDX[eggId] ?? 0 });
      playHaptic('tap');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setActive(null), SHOW_MS);
    });
    return () => {
      off();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Tracks which egg ids the player has already seen the toast for in
  // this session. Cleared on page reload — combined with the persisted
  // meta.easterEggs check above, the toast fires exactly once per egg
  // per save.
  const shownRef = useRef<Set<string>>(new Set());

  // On mount, hydrate `shownRef` from any already-discovered eggs so
  // the toast doesn't fire for them if a synthetic event somehow
  // replays (e.g., during a state-restore on dev hot-reload).
  useEffect(() => {
    const eggs = store.getState().meta.easterEggs ?? [];
    for (const id of eggs) shownRef.current.add(id);
  }, []);

  if (!active) return null;

  return (
    <div
      onClick={() => setActive(null)}
      className="mat-crystal"
      style={{
        position: 'absolute',
        top: 'calc(var(--hud-top-h, 134px) + 92px)', // BELOW the AchievementToast slot so they can stack
        right: '50%',
        transform: 'translate(50%, 0)',
        padding: '8px 18px',
        borderRadius: 10,
        zIndex: Z.bannerArrival,
        cursor: 'pointer',
        pointerEvents: 'auto',
        border: '1px solid rgba(245,196,81,0.45)',
        boxShadow: '0 0 20px rgba(245,196,81,0.28), 0 6px 18px rgba(0,0,0,0.35)',
        animation: 'whisper-toast-in 480ms cubic-bezier(0.2, 1.0, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        minWidth: 200,
        // Keep the sigil contained — it expands beyond the title
        // and we want the gold bloom to clip cleanly to the toast frame.
        overflow: 'hidden',
      }}>
      {/* The ✦ sigil flash sits behind the title, blooms once, fades. */}
      <div
        className="whisper-sigil"
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '50%', top: '50%',
          fontSize: 64,
          color: '#f5c451',
          opacity: 0,
          pointerEvents: 'none',
          textShadow: '0 0 24px rgba(245,196,81,0.85), 0 0 48px rgba(245,196,81,0.5)',
          animation: 'whisper-sigil-flash 1100ms ease-out forwards',
          zIndex: 0,
        }}>
        ✦
      </div>
      <div className="f-mono uc" style={{
        position: 'relative', zIndex: 1,
        fontSize: 8, letterSpacing: '0.5em',
        color: '#f5c451',
        textShadow: '0 0 10px rgba(245,196,81,0.5)',
      }}>
        a whisper heard
      </div>
      <div className="f-display" style={{
        position: 'relative', zIndex: 1,
        fontSize: 14, color: '#f3f0ff', letterSpacing: '0.06em',
      }}>
        <span style={{ marginRight: 8, opacity: 0.9 }}>{active.icon}</span>
        {active.name}
      </div>
    </div>
  );
}

// Export for tests / future hookpoints.
export const __whisperToastInternal = { EGG_NOTE_IDX, EASTER_EGGS };
