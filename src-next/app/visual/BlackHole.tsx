// src-next/app/visual/BlackHole.tsx
// Title-screen procedural-mode portal. Faint SVG black hole + accretion
// arc + radial gradient. Click fires onClick.
//
// Hints (kept light per spec):
//   - Slow opacity breathing (6s cycle, 0.5 -> 0.7) so the eye picks
//     it up on a second pass. Static would read as decoration.
//   - Periodic glint — every 14s the accretion arc briefly brightens
//     for ~800ms, drawing the eye without yelling. Skipped when the
//     player honors prefers-reduced-motion.
//   - Hover: opacity goes to 1.0, the disc scales up 8%, the accretion
//     arc grows a violet drop-shadow, and a small label appears
//     ("... pulled here"). Anything strong enough to read as "this
//     is interactive."

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
      title="Something pulls here"
      data-testid="blackhole-hitbox"
      className="ff-blackhole absolute right-8 bottom-8 w-12 h-12 p-0 bg-transparent border-0 cursor-pointer
                 focus-visible:outline-2 focus-visible:outline-violet-400 focus-visible:outline-offset-2"
    >
      <span
        className="ff-blackhole-label"
        aria-hidden="true"
      >
        ...
      </span>
      <svg
        data-testid="blackhole-svg"
        className="ff-blackhole-svg"
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
          <ellipse
            className="ff-blackhole-arc"
            cx="24" cy="24" rx="22" ry="7"
            fill="none" stroke="url(#bh-accretion)" strokeWidth="1.2"
          />
        </g>
        <circle className="ff-blackhole-disc" cx="24" cy="24" r="9" fill="url(#bh-disc)" />
        <style>{`
          @keyframes bh-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          /* Slow breath so the icon isn't fully static. 6s cycle keeps
             it under the threshold of "blinking distractor." */
          @keyframes ff-bh-breathe {
            0%, 100% { opacity: 0.5; }
            50%      { opacity: 0.7; }
          }
          /* Periodic glint — runs every 14s, brightens the accretion
             arc for ~800ms then settles. Cheap eye-catcher without a
             constant pulse. */
          @keyframes ff-bh-glint {
            0%, 90%, 100% { opacity: 0.45; filter: none; }
            93%           { opacity: 0.95; filter: drop-shadow(0 0 4px #a78bfa); }
            95%           { opacity: 0.7;  filter: drop-shadow(0 0 2px #a78bfa); }
          }
          .ff-blackhole { opacity: 0.5; animation: ff-bh-breathe 6s ease-in-out infinite; transition: opacity 240ms ease, transform 240ms ease; }
          .ff-blackhole:hover, .ff-blackhole:focus-visible { opacity: 1; animation-play-state: paused; transform: scale(1.08); }
          .ff-blackhole-svg { transition: filter 240ms ease; }
          .ff-blackhole:hover .ff-blackhole-svg, .ff-blackhole:focus-visible .ff-blackhole-svg { filter: drop-shadow(0 0 6px #a78bfa); }
          .ff-blackhole-arc { animation: ff-bh-glint 14s ease-in-out infinite; }
          .ff-blackhole-label {
            position: absolute; right: 100%; top: 50%;
            transform: translateY(-50%);
            margin-right: 10px;
            font-family: 'JetBrains Mono', 'Exo 2', system-ui, monospace;
            font-size: 9px; letter-spacing: 0.32em; text-transform: uppercase;
            color: #a78bfa;
            opacity: 0;
            pointer-events: none;
            white-space: nowrap;
            transition: opacity 240ms ease, transform 240ms ease;
            text-shadow: 0 0 6px #a78bfa66;
          }
          .ff-blackhole:hover .ff-blackhole-label, .ff-blackhole:focus-visible .ff-blackhole-label {
            opacity: 0.85;
            transform: translate(-3px, -50%);
          }
          @media (prefers-reduced-motion: reduce) {
            .ff-blackhole { animation: none; opacity: 0.6; }
            .ff-blackhole-arc { animation: none; }
          }
        `}</style>
      </svg>
    </button>
  );
}
