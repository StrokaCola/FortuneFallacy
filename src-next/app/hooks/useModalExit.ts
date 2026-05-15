import { useEffect, useState } from 'react';

// useModalExit — keep a modal mounted long enough to play an exit
// animation when its `open` source flips false.
//
// Returns `{ rendered, exiting }`:
//   - `rendered` is true while the modal should be in the DOM (covers
//     both the "open" state and the brief "fading out" tail).
//   - `exiting` is true only during the fade-out tail. Apply the
//     exit animation / class while this is true.
//
// Pattern:
//   const { rendered, exiting } = useModalExit(open, 140);
//   if (!rendered) return null;
//   return <div style={{ animation: exiting ? exitAnim : enterAnim }} />;
//
// Defaults to `--modal-out` (140ms) — slightly faster than entry so
// the close release feels tighter than the deliberate open. Skip
// the fade entirely under reduce-motion.
export function useModalExit(
  open: boolean,
  exitMs = 140,
): { rendered: boolean; exiting: boolean } {
  const [rendered, setRendered] = useState(open);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      setExiting(false);
      return;
    }
    if (!rendered) return;
    const reduced =
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('reduce-motion');
    if (reduced) {
      setRendered(false);
      return;
    }
    setExiting(true);
    const t = window.setTimeout(() => {
      setRendered(false);
      setExiting(false);
    }, exitMs);
    return () => window.clearTimeout(t);
  }, [open, rendered, exitMs]);

  return { rendered, exiting };
}
