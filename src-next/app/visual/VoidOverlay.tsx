// src-next/app/visual/VoidOverlay.tsx
// Play-scene tint + accretion ambient. Mounted by Round when
// run.mode === 'void'. Below HUD (z-30), above 3D scene.

import React from 'react';

type Props = { active: boolean };

export function VoidOverlay({ active }: Props) {
  if (!active) return null;
  return (
    <div
      data-testid="void-overlay"
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-30"
      style={{
        background:
          'radial-gradient(circle at 50% 50%, rgba(35,10,55,0.0) 0%, rgba(15,5,30,0.65) 70%, rgba(0,0,0,0.85) 100%)',
        mixBlendMode: 'multiply',
      }}
    >
      <svg
        viewBox="0 0 800 800"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        width="800"
        height="800"
        style={{ opacity: 0.15, animation: 'bh-rotate 120s linear infinite' }}
      >
        <ellipse cx="400" cy="400" rx="380" ry="120" fill="none" stroke="#a78bfa" strokeWidth="2" />
        <ellipse cx="400" cy="400" rx="320" ry="100" fill="none" stroke="#c4b5fd" strokeWidth="1" />
      </svg>
    </div>
  );
}
