// Shared row layout for screen-level action buttons (Forge, Skip,
// Title; or Reroll, Next; or New Run, Codex, Daily, etc.).
//
// The tight-viewport behaviour every screen wants:
//   - children grow to share the row evenly with a sensible min-width
//   - row wraps before children get smaller than min-width
//   - vertical alignment + center justification stay consistent
// The non-tight behaviour:
//   - children flow at natural width with a generous gap between
//
// Each call site previously rolled its own flex container with these
// rules; consolidating here means one place to tune the row's tight
// behaviour for the whole game.

import type { CSSProperties, ReactNode } from 'react';

export type ActionBarProps = {
  tight: boolean;
  children: ReactNode;
  /** Minimum width per child on tight before the row wraps. Default 80. */
  minChildWidth?: number;
  /** Override gap between children. Defaults: tight 4px, normal 12px. */
  gap?: number;
  style?: CSSProperties;
};

export function ActionBar({
  tight, children, minChildWidth = 80, gap, style,
}: ActionBarProps) {
  return (
    <div
      data-action-bar
      data-action-bar-grow={tight ? 'true' : undefined}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: gap ?? (tight ? 4 : 12),
        // The `grow` rule is selector-driven from styles/index.css so
        // every child receives `flex: 1 1 auto; min-width: <X>px`
        // without each call site having to remember to pass it.
        ['--action-bar-min-w' as string]: `${minChildWidth}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
