// Wave K — two-stage destructive button.
//
// First click "arms" the button: label flips to confirmLabel, a crimson
// pulse runs, and a watchdog clears the armed state after `armedMs`
// (default 2200ms) so a misclick on Restore Defaults / Forfeit Run can't
// commit by accident. Second click within that window fires onConfirm.
//
// The component reuses the existing .btn-danger tier so it picks up the
// crimson shockwave + uiCommit click + 20ms haptic from buttonJuice
// automatically. The arm pulse is purely CSS so reduce-motion users
// still see the label flip + ARIA pressed state without animation.

import { useEffect, useRef, useState } from 'react';

export type ConfirmPressProps = {
  /** First-stage label (idle). */
  label: string;
  /** Second-stage label (armed) — shown after first click. Defaults to "Hold to confirm". */
  confirmLabel?: string;
  /** Called on the second click within the armed window. */
  onConfirm: () => void;
  /** Ms before the armed state auto-clears. Default 2200. */
  armedMs?: number;
  /** Optional extra className appended after .btn .btn-danger. */
  className?: string;
  /** Optional aria-label override (defaults to the active label). */
  ariaLabel?: string;
  /** Optional inline style passthrough. */
  style?: React.CSSProperties;
  /** Disabled gate from the caller. */
  disabled?: boolean;
};

export function ConfirmPress({
  label,
  confirmLabel = 'Hold to confirm',
  onConfirm,
  armedMs = 2200,
  className = '',
  ariaLabel,
  style,
  disabled,
}: ConfirmPressProps) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Clear the watchdog if the component unmounts mid-arm so onConfirm
  // can't fire after the consumer has gone away.
  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const onClick = () => {
    if (disabled) return;
    if (!armed) {
      setArmed(true);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setArmed(false);
        timerRef.current = null;
      }, armedMs);
      return;
    }
    // Confirmed — clear the watchdog and fire.
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setArmed(false);
    onConfirm();
  };

  const active = armed ? confirmLabel : label;

  return (
    <button
      type="button"
      className={`btn btn-danger mat-interactive tap ${armed ? 'is-armed' : ''} ${className}`.trim()}
      aria-pressed={armed}
      aria-label={ariaLabel ?? active}
      data-confirm-armed={armed ? 'true' : undefined}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {active}
    </button>
  );
}
