// src-next/app/visual/BlackHole.tsx
// Title-screen procedural-mode portal. Faint SVG black hole + accretion
// arc + radial gradient. Click fires onClick. Always visible at low
// opacity — players notice on second look. No glow, no pulse.

import React from 'react';

type Props = {
  onClick: () => void;
};

export function BlackHole({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Enter Void Mode"
      data-testid="blackhole-hitbox"
      className="absolute right-8 bottom-8 w-12 h-12 p-0 bg-transparent border-0 cursor-pointer
                 focus-visible:outline-2 focus-visible:outline-violet-400 focus-visible:outline-offset-2"
      style={{ opacity: 0.6 }}
    >
      <svg
        data-testid="blackhole-svg"
        viewBox="0 0 48 48"
        width="48"
        height="48"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="bh-disc" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000000" stopOpacity="1" />
            <stop offset="55%" stopColor="#000000" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bh-accretion" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0" />
            <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g style={{ transformOrigin: '50% 50%', animation: 'bh-rotate 45s linear infinite' }}>
          <ellipse cx="24" cy="24" rx="22" ry="7" fill="none" stroke="url(#bh-accretion)" strokeWidth="1.2" />
        </g>
        <circle cx="24" cy="24" r="9" fill="url(#bh-disc)" />
        <style>{`@keyframes bh-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </svg>
    </button>
  );
}
