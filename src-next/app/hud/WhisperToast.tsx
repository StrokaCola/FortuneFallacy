// WhisperToast — quiet celebration when an easter egg is discovered
// for the first time. Migrated to the central toast queue 2026-05-14
// — the per-session + per-save dedupe still lives here; the JSX
// + sigil-flash overlay moved into the descriptor's render.

import { useEffect, useRef } from 'react';
import { bus } from '../../events/bus';
import { lookupEasterEgg, EASTER_EGGS } from '../../data/easterEggs';
import { store } from '../../state/store';
import { sfxPlay } from '../../audio/sfx';
import { playHaptic } from '../haptics/haptics';
import { pushToast } from './toastQueue';

const SHOW_MS = 2600;

type WhisperData = {
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

function renderWhisper({ name, icon }: WhisperData) {
  return (
    <div
      className="mat-crystal"
      style={{
        position: 'relative',
        padding: '8px 18px',
        borderRadius: 10,
        border: '1px solid rgba(245,196,81,0.45)',
        boxShadow: '0 0 20px rgba(245,196,81,0.28), 0 6px 18px rgba(0,0,0,0.35)',
        animation: 'whisper-toast-in 480ms cubic-bezier(0.2, 1.0, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        minWidth: 200,
        // Keep the sigil contained — it expands beyond the title and we
        // want the gold bloom to clip cleanly to the toast frame.
        overflow: 'hidden',
      }}
    >
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
        <span style={{ marginRight: 8, opacity: 0.9 }}>{icon}</span>
        {name}
      </div>
    </div>
  );
}

export function WhisperToast() {
  // Tracks which egg ids the player has already seen the toast for in
  // this session. Cleared on page reload — combined with the persisted
  // meta.easterEggs check below, the toast fires exactly once per egg
  // per save.
  const shownRef = useRef<Set<string>>(new Set());

  // Hydrate `shownRef` on mount from any already-discovered eggs so
  // the toast doesn't fire if a synthetic event somehow replays
  // (e.g., during a state-restore on dev hot-reload).
  useEffect(() => {
    const eggs = store.getState().meta.easterEggs ?? [];
    for (const id of eggs) shownRef.current.add(id);
  }, []);

  useEffect(() => {
    const off = bus.on('onUpgradeTriggered', (payload: { id: string }) => {
      // Resolve the egg id from either prefix form.
      let eggId: string | null = null;
      if (payload.id.startsWith('easter_egg:')) eggId = payload.id.slice('easter_egg:'.length);
      else if (payload.id === 'mirrored_hand') eggId = 'mirrored_hand';
      if (!eggId) return;
      // Dedupe: only fire once per run-per-egg.
      if (shownRef.current.has(eggId)) return;
      const meta = lookupEasterEgg(eggId);
      if (!meta) return;
      // Also dedupe against meta.easterEggs in case the player already
      // discovered this egg in a previous run (we don't want to
      // re-celebrate).
      const persisted = store.getState().meta.easterEggs ?? [];
      if (persisted.includes(eggId)) {
        shownRef.current.add(eggId);
        return;
      }
      shownRef.current.add(eggId);
      sfxPlay('whisperChime', { idx: EGG_NOTE_IDX[eggId] ?? 0 });
      playHaptic('tap');
      pushToast<WhisperData>({
        id: `whisper-${eggId}-${Date.now()}`,
        // No grouping key — easter eggs unlock once per run; if the
        // player somehow surfaces multiple in a row they should each
        // get their own toast.
        priority: 'normal',
        durationMs: SHOW_MS,
        data: { eggId, name: meta.name, icon: meta.icon },
        render: renderWhisper,
      });
    });
    return () => off();
  }, []);

  return null;
}

// Export for tests / future hookpoints.
export const __whisperToastInternal = { EGG_NOTE_IDX, EASTER_EGGS };
